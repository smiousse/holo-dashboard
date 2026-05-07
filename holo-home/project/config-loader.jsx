// HOLO HOME OS — config loader.
// Fetches project/config.json, validates the shape, exposes:
//   • window.APP_CONFIG     — full validated config object
//   • window.HOME_LAYOUT    — alias kept for back-compat with components
//   • window.THERMO_COLORS  — promoted out of data.jsx
//   • window.__configReady  — Promise<APP_CONFIG> consumers await before render
//
// Loaded BEFORE data.jsx in the HTML script order. Validator is hand-rolled
// (no external deps) — fails fast with a fixed error overlay listing every
// violation, mirroring the bundler's __bundler_err sink.

(function () {
  const ENTITY_RX = /^[a-z_]+\.[a-z0-9_]+$/;
  const ALLOWED_KINDS = new Set([
    "thermo", "light", "switch", "fan", "sensor", "appliance", "printer",
  ]);
  const REQUIRED_PER_KIND = {
    thermo:    ["id", "label"],
    light:     ["id", "label"],
    switch:    ["id", "label"],
    fan:       ["id", "label"],
    sensor:    ["id", "label"],
    appliance: ["id", "label", "statusEntity"],
    printer:   ["id", "label", "stateEntity"],
  };

  function showFatal(messages) {
    const div = document.createElement("div");
    div.style.cssText =
      "position:fixed;inset:12px;font:12px/1.5 ui-monospace,monospace;" +
      "background:#2a1215;color:#ff8a80;padding:14px 18px;border-radius:8px;" +
      "border:1px solid #5c2b2e;z-index:99999;white-space:pre-wrap;" +
      "max-height:calc(100vh - 24px);overflow:auto";
    div.textContent =
      "[config] " + messages.length + " validation error(s):\n\n" +
      messages.map((m, i) => (i + 1) + ". " + m).join("\n");
    (document.body || document.documentElement).appendChild(div);
  }

  function validate(cfg) {
    const errs = [];
    const seenZone = new Set();
    const seenScene = new Set();
    const seenCamera = new Set();
    const seenEntityId = new Set();

    if (!cfg || typeof cfg !== "object") return ["root must be an object"];
    if (cfg.version !== 1) errs.push("version must be 1, got " + JSON.stringify(cfg.version));

    if (cfg.language !== undefined && cfg.language !== "en" && cfg.language !== "fr") {
      errs.push("language must be 'en' or 'fr' if set, got " + JSON.stringify(cfg.language));
    }

    if (!cfg.connection || typeof cfg.connection !== "object") {
      errs.push("connection block missing");
    } else {
      if (typeof cfg.connection.url !== "string" || !/^https?:\/\//.test(cfg.connection.url)) {
        errs.push("connection.url must be an http(s) URL");
      }
      if (cfg.connection.useRealHA !== undefined && typeof cfg.connection.useRealHA !== "boolean") {
        errs.push("connection.useRealHA must be boolean if set");
      }
      if (cfg.connection.haLongLivedToken !== undefined) {
        if (typeof cfg.connection.haLongLivedToken !== "string" || !cfg.connection.haLongLivedToken.trim()) {
          errs.push("connection.haLongLivedToken must be a non-empty string if set");
        }
      }
    }

    const checkEntityId = (id, where) => {
      if (typeof id !== "string" || !ENTITY_RX.test(id)) {
        errs.push(where + ": invalid entity_id " + JSON.stringify(id));
      }
    };

    for (const key of ["weatherEntity", "outsideTempEntity", "alarmEntity", "refreshCamerasScript"]) {
      if (cfg[key] !== undefined) checkEntityId(cfg[key], key);
    }

    const FLOOR_ID_RX = /^[a-z][a-z0-9_]*$/;
    const seenFloor = new Set();
    if (!Array.isArray(cfg.floors) || cfg.floors.length === 0) {
      errs.push("floors must be a non-empty array");
    } else {
      cfg.floors.forEach((f, fi) => {
        const where = "floors[" + fi + "]" + (f?.id ? " (" + f.id + ")" : "");
        if (typeof f.id !== "string" || !FLOOR_ID_RX.test(f.id)) {
          errs.push(where + ": id must match /^[a-z][a-z0-9_]*$/");
        } else {
          if (seenFloor.has(f.id)) errs.push(where + ": duplicate floor id");
          seenFloor.add(f.id);
        }
        if (typeof f.label !== "string" || !f.label.trim()) {
          errs.push(where + ": label must be a non-empty string");
        }
      });
    }

    if (!Array.isArray(cfg.zones)) {
      errs.push("zones must be an array");
    } else {
      cfg.zones.forEach((z, zi) => {
        const where = "zones[" + zi + "]" + (z?.id ? " (" + z.id + ")" : "");
        if (!z.id || typeof z.id !== "string") errs.push(where + ": missing id");
        if (z.id && seenZone.has(z.id)) errs.push(where + ": duplicate zone id");
        if (z.id) seenZone.add(z.id);
        if (!z.name) errs.push(where + ": missing name");
        if (typeof z.floor !== "string" || !seenFloor.has(z.floor)) {
          errs.push(where + ": floor must reference a defined floor id (" + Array.from(seenFloor).join("|") + ")");
        }
        if (!z.geometry || typeof z.geometry !== "object") errs.push(where + ": missing geometry {x,y,w,h}");
        else for (const k of ["x", "y", "w", "h"]) {
          if (typeof z.geometry[k] !== "number") errs.push(where + ": geometry." + k + " must be number");
        }
        if (z.cover) {
          checkEntityId(z.cover.id, where + ".cover.id");
          if (!z.cover.label) errs.push(where + ".cover: missing label");
        }
        if (!Array.isArray(z.entities)) {
          errs.push(where + ": entities must be an array");
        } else {
          z.entities.forEach((e, ei) => {
            const ew = where + ".entities[" + ei + "]" + (e?.id ? " (" + e.id + ")" : "");
            if (!ALLOWED_KINDS.has(e.kind)) {
              errs.push(ew + ": kind must be one of " + Array.from(ALLOWED_KINDS).join("|"));
              return;
            }
            for (const f of REQUIRED_PER_KIND[e.kind]) {
              if (e[f] === undefined || e[f] === null || e[f] === "") {
                errs.push(ew + ": missing required field '" + f + "' for kind '" + e.kind + "'");
              }
            }
            if (e.id) checkEntityId(e.id, ew + ".id");
            if (e.statusEntity) checkEntityId(e.statusEntity, ew + ".statusEntity");
            if (e.stateEntity)  checkEntityId(e.stateEntity,  ew + ".stateEntity");
            if (e.id) seenEntityId.add(e.id);
          });
        }
      });
    }

    if (cfg.systemRefs && !Array.isArray(cfg.systemRefs)) errs.push("systemRefs must be an array");
    if (cfg.cameras && !Array.isArray(cfg.cameras)) errs.push("cameras must be an array");
    if (Array.isArray(cfg.cameras)) {
      cfg.cameras.forEach((c, i) => {
        const where = "cameras[" + i + "]" + (c?.id ? " (" + c.id + ")" : "");
        if (c.id && seenCamera.has(c.id)) errs.push(where + ": duplicate camera id");
        if (c.id) seenCamera.add(c.id);
        if (c.id) checkEntityId(c.id, where + ".id");
        if (c.motionEntity)  checkEntityId(c.motionEntity,  where + ".motionEntity");
        if (c.batteryEntity) checkEntityId(c.batteryEntity, where + ".batteryEntity");
        if (c.armSwitch)     checkEntityId(c.armSwitch,     where + ".armSwitch");
      });
    }

    if (Array.isArray(cfg.scenes)) {
      cfg.scenes.forEach((s, i) => {
        const where = "scenes[" + i + "]" + (s?.id ? " (" + s.id + ")" : "");
        if (s.id && seenScene.has(s.id)) errs.push(where + ": duplicate scene id");
        if (s.id) seenScene.add(s.id);
        if (s.entity) checkEntityId(s.entity, where + ".entity");
        if (!["toggle", "press", "alarm"].includes(s.kind)) {
          errs.push(where + ": kind must be 'toggle' | 'press' | 'alarm'");
        }
      });
    }

    if (cfg.extraActions) {
      if (!Array.isArray(cfg.extraActions.groups)) {
        errs.push("extraActions.groups must be an array");
      } else {
        cfg.extraActions.groups.forEach((g, gi) => {
          if (!Array.isArray(g.actions)) {
            errs.push("extraActions.groups[" + gi + "]: actions must be an array");
          } else {
            g.actions.forEach((a, ai) => {
              const where = "extraActions.groups[" + gi + "].actions[" + ai + "]";
              checkEntityId(a.id, where + ".id");
              if (!a.label) errs.push(where + ": missing label");
            });
          }
        });
      }
    }

    if (cfg.calendar && Array.isArray(cfg.calendar.sources)) {
      cfg.calendar.sources.forEach((s, i) => {
        const where = "calendar.sources[" + i + "]" + (s?.id ? " (" + s.id + ")" : "");
        if (s.entity) checkEntityId(s.entity, where + ".entity");
        if (s.filterEntity) checkEntityId(s.filterEntity, where + ".filterEntity");
      });
    }

    return errs;
  }

  async function loadConfig() {
    let res;
    try {
      res = await fetch("./config.json", { cache: "no-cache" });
    } catch (e) {
      throw new Error("config.json fetch failed: " + e.message);
    }
    if (!res.ok) throw new Error("config.json HTTP " + res.status);
    let cfg;
    try {
      cfg = await res.json();
    } catch (e) {
      throw new Error("config.json is not valid JSON: " + e.message);
    }
    const errs = validate(cfg);
    if (errs.length) {
      showFatal(errs);
      throw new Error("config.json validation failed (" + errs.length + " issue(s))");
    }
    if (Array.isArray(cfg.zones)) {
      for (const z of cfg.zones) {
        if (z.geometry) {
          if (z.x === undefined) z.x = z.geometry.x;
          if (z.y === undefined) z.y = z.geometry.y;
          if (z.w === undefined) z.w = z.geometry.w;
          if (z.h === undefined) z.h = z.geometry.h;
        }
      }
    }
    if (!cfg.language) cfg.language = "en";
    window.APP_CONFIG    = cfg;
    window.HOME_LAYOUT   = cfg;
    window.THERMO_COLORS = cfg.thermoColors;
    return cfg;
  }

  window.__configReady = loadConfig().catch((e) => {
    console.error("[config] " + e.message);
    if (!document.querySelector("[data-config-fatal]")) {
      const div = document.createElement("div");
      div.dataset.configFatal = "1";
      div.style.cssText =
        "position:fixed;inset:12px;font:12px/1.5 ui-monospace,monospace;" +
        "background:#2a1215;color:#ff8a80;padding:14px 18px;border-radius:8px;" +
        "border:1px solid #5c2b2e;z-index:99999;white-space:pre-wrap";
      div.textContent = "[config] " + e.message;
      (document.body || document.documentElement).appendChild(div);
    }
    throw e;
  });
})();
