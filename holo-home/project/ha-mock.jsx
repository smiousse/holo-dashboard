// HOLO HOME OS — Home Assistant WebSocket MOCK.
// Implements (a small subset of) the Home Assistant WebSocket API:
//   • auth_required → auth_ok handshake
//   • get_states  → returns current entity states (with attributes)
//   • subscribe_events(event_type=state_changed) → pushes state_changed events
//   • call_service(domain, service, target) → mutates state, fires state_changed
// Reference: https://developers.home-assistant.io/docs/api/websocket
//
// We expose a single-module fake server + a client that mimics the standard
// home-assistant-js-websocket connection lifecycle, all in-process. Drop-in
// for the real thing if/when you swap to a real socket.

(function () {
  // ===== Initial state (matches entity_ids in ZONES_AND_DEVICES.md) =========
  const NOW = () => new Date().toISOString();

  // helpers
  const sw = (id, friendly, on=false) => ({
    entity_id: id, state: on ? "on" : "off",
    attributes: { friendly_name: friendly },
    last_changed: NOW(), last_updated: NOW(),
  });
  const climate = (id, friendly, current, target, hvac="heat", action="idle") => ({
    entity_id: id, state: hvac,
    attributes: {
      friendly_name: friendly,
      current_temperature: current,
      temperature: target,
      hvac_action: action, // heating | cooling | idle
      hvac_modes: ["off","heat","cool","auto"],
      min_temp: 10, max_temp: 30, target_temp_step: 0.5,
      unit_of_measurement: "°C",
    },
    last_changed: NOW(), last_updated: NOW(),
  });
  const sensor = (id, friendly, val, unit) => ({
    entity_id: id, state: String(val),
    attributes: { friendly_name: friendly, unit_of_measurement: unit },
    last_changed: NOW(), last_updated: NOW(),
  });
  const cover = (id, friendly, state="closed") => ({
    entity_id: id, state,
    attributes: { friendly_name: friendly, device_class: "garage" },
    last_changed: NOW(), last_updated: NOW(),
  });

  const INITIAL_STATES = [
    // ---- Garage ----
    cover("cover.gdo_home_door", "Garage door", "closed"),
    sensor("sensor.garage_humidity", "Garage humidity", 62, "%"),
    sensor("sensor.garage_temperature", "Garage temperature", 4.2, "°C"),

    // ---- Gaming ----
    sw("switch.smartswitchkitchen_right", "Gaming light", true),
    climate("climate.thermostatofficeroom", "Gaming thermostat", 21.4, 21.5, "heat", "idle"),

    // ---- Living room ----
    sw("light.switchtvroom", "TV light", true),
    sw("switch.smartplugfanlivingroom", "Living room fan", false),
    climate("climate.thermostatlivingroom", "Living room thermostat", 21.8, 22.0, "heat", "heating"),

    // ---- Kitchen ----
    sw("switch.smartswitchkitchen_left", "Kitchen light", false),
    sw("switch.switchkitchencounter", "Counter light", false),
    climate("climate.thermostatdiningroom", "Kitchen thermostat", 21.0, 21.0, "heat", "idle"),

    // ---- Upstairs bathroom ----
    sw("switch.smartswitchbathroom_center", "Bath center light", false),
    sw("switch.smartswitchbathroom_right",  "Bath right light",  false),
    sw("switch.smartswitchbathroom_left",   "Bath fan",          false),
    climate("climate.thermostatbathroom", "Upstairs bath thermostat", 22.1, 22.5, "heat", "heating"),

    // ---- Downstairs bathroom (laundry) ----
    sensor("sensor.dryer_remaining_time", "Dryer remaining", "00:34", ""),
    sensor("sensor.dryer_current_status", "Dryer status", "running", ""),
    sensor("sensor.washer_remaining_time", "Washer remaining", "00:00", ""),
    sensor("sensor.washer_current_status", "Washer status", "power_off", ""),
    sw("switch.fanbasementbathroom",   "Basement bath fan",   false),
    sw("switch.lightbasementbathroom", "Basement bath light", false),

    // ---- Playroom ----
    sw("switch.lightkidsroom", "Playroom light", true),
    sw("switch.plug_sumpump", "Sump pump", true),
    sw("switch.deshumidificateur_sous_sol", "Dehumidifier", false),
    sensor("sensor.sallejeuxtemphumsensor_salle_de_jeux_humidity", "Playroom humidity", 58, "%"),
    climate("climate.thermostatgamingroom", "Playroom thermostat", 19.6, 20.0, "heat", "heating"),

    // ---- Bedrooms ----
    sw("switch.plug_fan_master_bedroom", "Master fan", false),
    climate("climate.thermostatmasterbedroom",  "Master thermostat", 19.0, 19.5, "heat", "heating"),
    climate("climate.thermostat_mia_bedroom",     "Mia thermostat",   19.4, 19.5, "heat", "idle"),
    climate("climate.thermostat_noah_bedroom",  "Noah thermostat",  18.8, 19.0, "heat", "heating"),
    climate("climate.thermostat_liam_bedroom",  "Liam thermostat",  19.1, 19.0, "heat", "idle"),
    climate("climate.thermostat_alex_bedroom",  "Alex thermostat",  19.0, 19.0, "heat", "idle"),

    // ---- Office (Bambu) ----
    sensor("sensor.bambu_lab_a1_heure_de_fin", "Bambu finish time", "—", ""),
    sensor("sensor.bambu_lab_a1_etat_de_l_impression", "Print state", "idle", ""),
    climate("climate.thermostat_office", "Office thermostat", 20.2, 20.5, "heat", "heating"),

    // ---- Outside / weather / alarm / scene entities ----
    sensor("sensor.tempsensorhomeoutside_temperature", "Outside temperature", -6.4, "°C"),
    {
      entity_id: "weather.forecast_home", state: "snowy",
      attributes: {
        friendly_name: "Forecast Home",
        temperature: -6, temperature_unit: "°C",
        humidity: 78, wind_speed: 14, wind_bearing: "NE",
        forecast: [
          { datetime: NOW(), condition: "snowy", temperature: -4, templow: -9 },
        ],
      },
      last_changed: NOW(), last_updated: NOW(),
    },
    {
      entity_id: "alarm_control_panel.blink_home", state: "disarmed",
      attributes: {
        friendly_name: "Blink Home",
        code_format: null,
        supported_features: 31,
      },
      last_changed: NOW(), last_updated: NOW(),
    },
    { entity_id: "input_boolean.presence_maison", state: "on",
      attributes: { friendly_name: "Home presence" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_button.pickup_remote_start", state: NOW(),
      attributes: { friendly_name: "Pickup remote start" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "script.refresh_cameras_maison", state: "off",
      attributes: { friendly_name: "Refresh cameras" },
      last_changed: NOW(), last_updated: NOW() },

    // ---- Cameras (Blink — shape mirrors real HA Blink integration) ----
    // entity_picture is a data: URL pointing at a synthesized SVG snapshot;
    // bumped via attributes._snapshot_token whenever motion fires or
    // blink.trigger_camera is called, so React re-renders the <img>.
    ...((() => {
      const mkCam = (id, fn, type, batteryOk, motionEnabled, signalKind, signalVal) => ({
        entity_id: id, state: "idle",
        attributes: {
          friendly_name: fn, brand: "Blink", type,
          motion_detection: motionEnabled, motion_detected: false,
          motion_enabled: motionEnabled,
          battery: batteryOk ? "ok" : null,
          wifi_strength: signalKind === "wifi" ? signalVal : null,
          sync_signal_strength: signalKind === "sync" ? signalVal : null,
          last_record: new Date(Date.now() - 60_000 * (5 + Math.random()*240)).toISOString(),
          entity_picture: `__snapshot__/${id}?t=${Date.now()}`,
          _snapshot_token: Date.now(),
        },
        last_changed: NOW(), last_updated: NOW(),
      });
      return [
        mkCam("camera.front_door",      "Home - Front door camera", "catalina", true,  true,  "wifi", -67),
        mkCam("camera.front_door_bell", "Home - Doorbell camera",   "lotus",    true,  true,  "sync", 4),
        mkCam("camera.garage_door",     "Home - Garage camera",     "catalina", true,  true,  "wifi", -67),
        mkCam("camera.salon",           "Home - Living room camera","hawk",     null,  false, null,   null),
      ];
    })()),

    // ---- Blink companion entities ----
    ...((() => {
      const out = [];
      const cams = [
        ["front_door",      "front door", true],
        ["front_door_bell", "doorbell",   true],
        ["garage_door",     "garage",     true],
        ["salon",           "living room",false], // indoor, no battery / signals
      ];
      for (const [slug, fn, full] of cams) {
        out.push({
          entity_id: `binary_sensor.${slug}_motion`, state: "off",
          attributes: { friendly_name: `Home - ${fn} camera motion`, device_class: "motion" },
          last_changed: NOW(), last_updated: NOW(),
        });
        out.push({
          entity_id: `binary_sensor.${slug}_battery`,
          state: slug === "salon" ? "on" : "off",  // salon shows "on" in your dump (no battery / odd state)
          attributes: { friendly_name: `Home - ${fn} camera battery`, device_class: "battery" },
          last_changed: NOW(), last_updated: NOW(),
        });
        out.push({
          entity_id: `switch.${slug}_camera_motion_detection`,
          state: slug === "salon" ? "off" : "on",
          attributes: { friendly_name: `Home - ${fn} camera motion detection`, device_class: "switch" },
          last_changed: NOW(), last_updated: NOW(),
        });
        if (full) {
          out.push({
            entity_id: `sensor.blink_${slug}_temperature`,
            state: (5 + Math.random()*15).toFixed(1),
            attributes: { friendly_name: `Home - ${fn} camera temperature`, unit_of_measurement: "°C", device_class: "temperature" },
            last_changed: NOW(), last_updated: NOW(),
          });
          out.push({
            entity_id: `sensor.blink_${slug}_wi_fi_signal_strength`,
            state: "-67",
            attributes: { friendly_name: `Home - ${fn} camera Wi-Fi`, unit_of_measurement: "dBm", device_class: "signal_strength" },
            last_changed: NOW(), last_updated: NOW(),
          });
        }
      }
      return out;
    })()),

    // ---- Calendars (one per family member, mirrors HA YAML) ----
    // state: "on" if an event is currently active, "off" otherwise.
    // Attributes follow HA's calendar entity contract:
    //   message, start_time, end_time, description, location.
    { entity_id: "calendar.jordan",           state: "off",
      attributes: { friendly_name: "Jordan", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "calendar.jordan_reminders", state: "off",
      attributes: { friendly_name: "Jordan · Reminders", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "calendar.alex",             state: "off",
      attributes: { friendly_name: "Alex", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "calendar.noah",          state: "off",
      attributes: { friendly_name: "Noah", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "calendar.mia",             state: "off",
      attributes: { friendly_name: "Mia", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "calendar.mia_school",       state: "off",
      attributes: { friendly_name: "Mia · School", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "calendar.riley",          state: "off",
      attributes: { friendly_name: "Riley", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "calendar.liam",          state: "off",
      attributes: { friendly_name: "Liam", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },
    { entity_id: "calendar.famille",         state: "off",
      attributes: { friendly_name: "Family", message:"", start_time:"", end_time:"", description:"", location:"" },
      last_changed: NOW(), last_updated: NOW() },

    // ---- Calendar filter inputs (mirror HA YAML) ----
    { entity_id: "input_text.calendar_filter_jordan",           state: "",
      attributes: { friendly_name: "Filter Jordan"          }, last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_text.calendar_filter_jordan_reminders", state: "",
      attributes: { friendly_name: "Filter Jordan Reminders"}, last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_text.calendar_filter_alex",             state: "",
      attributes: { friendly_name: "Filter Alex"            }, last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_text.calendar_filter_noah",          state: "",
      attributes: { friendly_name: "Filter Noah"            }, last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_text.calendar_filter_mia",             state: "",
      attributes: { friendly_name: "Filter Mia"             }, last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_text.calendar_filter_riley",          state: "",
      attributes: { friendly_name: "Filter Riley"           }, last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_text.calendar_filter_liam",          state: "",
      attributes: { friendly_name: "Filter Liam"            }, last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_text.calendar_filter_famille",         state: "",
      attributes: { friendly_name: "Filter Family"          }, last_changed: NOW(), last_updated: NOW() },
    { entity_id: "input_select.calendar_view", state: "Month",
      attributes: {
        friendly_name: "Calendar view",
        options: ["Today","Tomorrow","Week","2 Weeks","Month","2 Months"],
      }, last_changed: NOW(), last_updated: NOW() },
  ];

  // ===== In-memory store =================================================
  const store = {
    states: new Map(INITIAL_STATES.map(s => [s.entity_id, s])),
    listeners: new Set(),  // (event) => void
    msgId: 0,
  };

  function emitStateChanged(entity_id, oldState, newState) {
    const ev = {
      type: "event",
      event: {
        event_type: "state_changed",
        data: { entity_id, old_state: oldState, new_state: newState },
        origin: "LOCAL",
        time_fired: NOW(),
      },
    };
    for (const l of store.listeners) try { l(ev); } catch {}
  }

  // seedEntity — idempotent insert. Use this from feature modules that own
  // their own entity catalog (e.g. extra-actions.jsx). No-op if the entity
  // already exists, so re-imports / hot reloads stay clean.
  function seedEntity(entity_id, init = {}) {
    if (store.states.get(entity_id)) return store.states.get(entity_id);
    const ent = {
      entity_id,
      state: init.state ?? "unknown",
      attributes: init.attributes || {},
      last_changed: NOW(),
      last_updated: NOW(),
    };
    store.states.set(entity_id, ent);
    emitStateChanged(entity_id, null, ent);
    return ent;
  }

  function setState(entity_id, patch) {
    const prev = store.states.get(entity_id);
    if (!prev) return;
    const next = {
      ...prev,
      ...("state" in patch ? { state: patch.state } : {}),
      attributes: { ...prev.attributes, ...(patch.attributes || {}) },
      last_changed: ("state" in patch && patch.state !== prev.state) ? NOW() : prev.last_changed,
      last_updated: NOW(),
    };
    store.states.set(entity_id, next);
    emitStateChanged(entity_id, prev, next);
    return next;
  }

  // ===== Service handlers =================================================
  // Mirrors `hass.services.call(domain, service, {entity_id, ...data})`.
  function callService(domain, service, target) {
    const entity_id = target?.entity_id;
    if (!entity_id) return;
    const cur = store.states.get(entity_id);
    if (!cur) return;

    if (domain === "switch" || domain === "light") {
      if (service === "toggle")    setState(entity_id, { state: cur.state === "on" ? "off" : "on" });
      else if (service === "turn_on")  setState(entity_id, { state: "on" });
      else if (service === "turn_off") setState(entity_id, { state: "off" });
    }
    else if (domain === "cover") {
      if (service === "open_cover")   setState(entity_id, { state: "open" });
      if (service === "close_cover")  setState(entity_id, { state: "closed" });
      if (service === "toggle")       setState(entity_id, { state: cur.state === "open" ? "closed" : "open" });
    }
    else if (domain === "climate") {
      if (service === "set_temperature") {
        const t = +target.temperature;
        if (!Number.isNaN(t)) {
          const newAttrs = { temperature: t };
          // recompute hvac_action
          const cT = cur.attributes.current_temperature;
          newAttrs.hvac_action = t > cT + 0.1 ? "heating" : t < cT - 0.1 ? "cooling" : "idle";
          setState(entity_id, { attributes: newAttrs });
        }
      }
      else if (service === "set_hvac_mode") {
        setState(entity_id, { state: target.hvac_mode });
      }
    }
    else if (domain === "input_boolean") {
      if (service === "toggle")    setState(entity_id, { state: cur.state === "on" ? "off" : "on" });
      else if (service === "turn_on")  setState(entity_id, { state: "on" });
      else if (service === "turn_off") setState(entity_id, { state: "off" });
    }
    else if (domain === "input_button") {
      // pulse: state becomes the timestamp it was pressed; UI watches last_updated
      setState(entity_id, { state: NOW() });
    }
    else if (domain === "script") {
      // script.refresh_cameras_maison mirrors your HA YAML — fan-out to
      // blink.trigger_camera on every Blink camera entity.
      if (entity_id === "script.refresh_cameras_maison") {
        const camIds = [...store.states.keys()].filter(k =>
          k.startsWith("camera.") && store.states.get(k).attributes.brand === "Blink"
        );
        for (const cid of camIds) {
          callService("blink", "trigger_camera", { entity_id: cid });
        }
      }
      // simulate: on briefly, then off (mirrors HA's running -> off behavior)
      setState(entity_id, { state: "on" });
      setTimeout(() => setState(entity_id, { state: "off" }), 1400);
    }
    else if (domain === "blink") {
      // blink.trigger_camera — pokes Blink to upload a fresh thumbnail.
      // The HA integration mutates `last_record` + `entity_picture` ts.
      // Targets can be passed by entity_id OR device_id; we only handle entity_id.
      if (service === "trigger_camera") {
        // entity_id can be array or string per HA spec
        const ids = [].concat(target.entity_id || []);
        for (const id of ids) {
          const c = store.states.get(id);
          if (!c) continue;
          // simulate the ~2-3s upload then bump
          setTimeout(() => {
            const tok = Date.now();
            setState(id, { attributes: {
              entity_picture: `__snapshot__/${id}?t=${tok}`,
              _snapshot_token: tok,
              last_record: new Date().toISOString(),
            }});
          }, 1800 + Math.random()*900);
        }
      }
    }
    else if (domain === "alarm_control_panel") {
      if (service === "alarm_arm_away")  setState(entity_id, { state: "armed_away"  });
      else if (service === "alarm_arm_home")  setState(entity_id, { state: "armed_home"  });
      else if (service === "alarm_arm_night") setState(entity_id, { state: "armed_night" });
      else if (service === "alarm_disarm")    setState(entity_id, { state: "disarmed"    });
    }
  }

  // ===== Calendar events ===================================================
  // Generated for the current month so the UI always has data to show.
  // Modeled on HA's calendar event shape:
  //   { uid, summary, start: {dateTime|date}, end: {dateTime|date}, description, location }
  function buildCalendarEvents() {
    const events = {};
    const today = new Date();
    const yr = today.getFullYear();
    const mo = today.getMonth();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();

    function add(entity, day, sH, sM, durMin, summary, opts={}) {
      const start = new Date(yr, mo, day, sH, sM);
      const end   = new Date(start.getTime() + durMin*60000);
      const evt = {
        uid: `${entity}-${day}-${sH}${sM}-${summary}`.replace(/\s+/g,"_"),
        summary,
        start: { dateTime: start.toISOString() },
        end:   { dateTime: end.toISOString() },
        description: opts.description || "",
        location:    opts.location    || "",
      };
      (events[entity] ||= []).push(evt);
    }
    function addAllDay(entity, fromDay, toDay, summary, opts={}) {
      const startD = new Date(yr, mo, fromDay);
      const endD   = new Date(yr, mo, toDay+1);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const evt = {
        uid: `${entity}-allday-${fromDay}-${summary}`.replace(/\s+/g,"_"),
        summary,
        start: { date: fmt(startD) },
        end:   { date: fmt(endD)   },
        description: opts.description || "",
        location:    opts.location    || "",
      };
      (events[entity] ||= []).push(evt);
    }

    // ---- Hope Tournament (multi-day all-day, multi-person) ----
    addAllDay("calendar.alex",     1, 3, "Hope Tournament", { location: "Quebec City" });
    addAllDay("calendar.jordan",   1, 3, "Hope Tournament", { location: "Quebec City" });
    addAllDay("calendar.famille", 1, 3, "Hope Tournament", { location: "Quebec City" });

    // ---- Recurring training (Zak hockey schedule from screenshot) ----
    for (let d = 1; d <= daysInMonth; d++) {
      const wd = new Date(yr, mo, d).getDay();
      if (wd === 2) { // Tue
        add("calendar.alex", d,  7, 30,  60, "Strength training D1");
        add("calendar.alex", d, 15,  0, 180, "Practice D1");
        if (d <= 7) add("calendar.alex", d, 20, 0, 120, "Online theory class");
      }
      if (wd === 3) add("calendar.alex", d, 16, 0,  60, "Strength training D1");// Wed
      if (wd === 4) add("calendar.alex", d, 16, 0, 120, "Practice D1");         // Thu
      if (wd === 5) add("calendar.alex", d,  7,15,  75, "Open Gym");            // Fri

      if (wd === 3 || wd === 5) add("calendar.noah", d, 18, 0,  90, "Hockey");
      if (wd === 6)             add("calendar.mia",    d,  9, 0,  60, "Skating");
      if (wd === 1 || wd === 3) add("calendar.liam", d, 17,30, 60, "Soccer");

      // Emy School — MWF mornings
      if (wd === 1 || wd === 3 || wd === 5) {
        add("calendar.mia_school", d, 8, 30, 90, "School class");
      }
    }

    // ---- One-offs ----
    const firstThu = (() => {
      for (let d = 1; d <= 7; d++) if (new Date(yr, mo, d).getDay() === 4) return d;
      return 1;
    })();
    add("calendar.alex", firstThu, 19, 0, 60, "Driving lesson", { description: "Practice" });

    add("calendar.jordan", Math.min(daysInMonth, 12), 19,  0,  90, "Yoga");
    add("calendar.jordan", Math.min(daysInMonth, 22), 18, 30,  60, "Dinner with friends");

    add("calendar.jordan_reminders", Math.min(daysInMonth, 8),  10, 0, 30, "Reminder · Dentist appointment");
    add("calendar.jordan_reminders", Math.min(daysInMonth, 20), 14, 0, 30, "Reminder · Renew license");

    add("calendar.riley", Math.min(daysInMonth, 14), 12,  0, 60, "Work lunch", { location: "Bistro" });
    add("calendar.riley", Math.min(daysInMonth, 28), 19, 30, 120, "Concert",   { location: "Bell Centre" });

    add("calendar.famille", Math.min(daysInMonth, 17), 18, 30, 120, "Family dinner");
    add("calendar.famille", Math.min(daysInMonth, 25),  9,  0,   8*60, "Ski trip", { location: "Mont Sainte-Anne" });

    // sort each list by start ts ascending for stable iteration
    for (const k of Object.keys(events)) {
      events[k].sort((a,b)=>{
        const A = new Date(a.start.dateTime || (a.start.date + "T00:00:00")).getTime();
        const B = new Date(b.start.dateTime || (b.start.date + "T00:00:00")).getTime();
        return A - B;
      });
    }
    return events;
  }

  const calendarEvents = buildCalendarEvents();

  // Mirror calendar entity state (on/off) + next-up attrs.
  function refreshCalendarStates() {
    const now = Date.now();
    for (const entity of Object.keys(calendarEvents)) {
      const list = calendarEvents[entity];
      const annotated = list.map(e => ({
        ...e,
        _s: new Date(e.start.dateTime || (e.start.date + "T00:00:00")).getTime(),
        _e: new Date(e.end.dateTime   || (e.end.date   + "T00:00:00")).getTime(),
      }));
      const current = annotated.find(e => now >= e._s && now < e._e);
      const next    = annotated.find(e => e._s > now);
      const t       = current || next;
      if (!t) continue;
      setState(entity, {
        state: current ? "on" : "off",
        attributes: {
          message:     t.summary,
          start_time:  new Date(t._s).toISOString(),
          end_time:    new Date(t._e).toISOString(),
          description: t.description || "",
          location:    t.location    || "",
        },
      });
    }
  }
  refreshCalendarStates();
  setInterval(refreshCalendarStates, 60_000);

  // listEvents(entity, fromISO, toISO) — mimics HA's calendar/list_events ws cmd.
  function listEvents(entity_id, startISO, endISO) {
    const list = calendarEvents[entity_id] || [];
    const sMs = new Date(startISO).getTime();
    const eMs = new Date(endISO).getTime();
    return list.filter(ev => {
      const _s = new Date(ev.start.dateTime || (ev.start.date + "T00:00:00")).getTime();
      const _e = new Date(ev.end.dateTime   || (ev.end.date   + "T00:00:00")).getTime();
      return _e > sMs && _s < eMs;
    });
  }

  // createEvent(entity_id, { summary, start, end, allDay, description, location })
  // start/end are JS Date objects (or ISO strings). For allDay we store {date}.
  // Returns the created event.
  function createEvent(entity_id, { summary, start, end, allDay, description, location }) {
    const s = new Date(start);
    const e = new Date(end);
    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const ev = {
      uid: `${entity_id}-${Date.now()}-${(summary||"event").replace(/\s+/g,"_")}`,
      summary: summary || "Sans titre",
      start: allDay ? { date: fmtDate(s) } : { dateTime: s.toISOString() },
      end:   allDay ? { date: fmtDate(e) } : { dateTime: e.toISOString() },
      description: description || "",
      location:    location    || "",
    };
    (calendarEvents[entity_id] ||= []).push(ev);
    // keep sorted (matches buildCalendarEvents output)
    calendarEvents[entity_id].sort((a,b)=>{
      const A = new Date(a.start.dateTime || (a.start.date + "T00:00:00")).getTime();
      const B = new Date(b.start.dateTime || (b.start.date + "T00:00:00")).getTime();
      return A - B;
    });
    refreshCalendarStates();
    // emit a state_changed-style nudge so any listeners (e.g. CalendarScreen) re-fetch
    const ent = store.states.get(entity_id);
    if (ent) emitStateChanged(entity_id, ent, ent);
    return ev;
  }

  // ===== Drift simulation (so the dashboard feels alive) =================
  setInterval(() => {
    for (const [id, s] of store.states) {
      if (id.startsWith("climate.")) {
        const cT = s.attributes.current_temperature;
        const tT = s.attributes.temperature;
        const drift = (tT - cT) * 0.04 + (Math.random() - 0.5) * 0.06;
        const next = +(cT + drift).toFixed(2);
        const action = next < tT - 0.15 ? "heating" : next > tT + 0.15 ? "cooling" : "idle";
        setState(id, { attributes: { current_temperature: next, hvac_action: action } });
      }
      else if (id === "sensor.garage_humidity" || id === "sensor.sallejeuxtemphumsensor_salle_de_jeux_humidity") {
        const v = +s.state;
        const next = Math.max(35, Math.min(85, +(v + (Math.random()-0.5)*0.6).toFixed(1)));
        setState(id, { state: String(next) });
      }
      else if (id === "sensor.garage_temperature") {
        const v = +s.state;
        const next = +(v + (Math.random()-0.5)*0.1).toFixed(2);
        setState(id, { state: String(next) });
      }
      else if (id === "sensor.tempsensorhomeoutside_temperature") {
        const v = +s.state;
        const next = +(v + (Math.random()-0.5)*0.15).toFixed(1);
        setState(id, { state: String(next) });
      }
    }
  }, 2200);

  // ===== Mock motion events for cameras =====
  // Every ~25s, randomly fire motion on one camera (only if its
  // motion_detection switch is "on"), then clear after 8s. Triggers a
  // snapshot bump too, so the dashboard sees a fresh thumbnail.
  setInterval(() => {
    const cams = ["front_door", "front_door_bell", "garage_door", "salon"];
    const slug = cams[Math.floor(Math.random() * cams.length)];
    const armSwitch = store.states.get(`switch.${slug}_camera_motion_detection`);
    if (!armSwitch || armSwitch.state !== "on") return;
    const motionEnt = `binary_sensor.${slug}_motion`;
    const camEnt    = `camera.${slug}`;
    setState(motionEnt, { state: "on" });
    // motion event -> snapshot bump (mirrors what the real integration does)
    const tok = Date.now();
    setState(camEnt, { attributes: {
      entity_picture: `__snapshot__/${camEnt}?t=${tok}`,
      _snapshot_token: tok,
      motion_detected: true,
      last_record: new Date().toISOString(),
    }});
    setTimeout(() => {
      setState(motionEnt, { state: "off" });
      setState(camEnt,    { attributes: { motion_detected: false } });
    }, 8000);
  }, 25_000);

  // ===== Snapshot synthesis =====
  // The real HA serves JPEG bytes at /api/camera_proxy/<id>?token=...
  // For the mock we synthesize a deterministic SVG keyed by the camera's
  // current _snapshot_token so it changes on motion / trigger.
  function resolveSnapshot(entity_id) {
    const c = store.states.get(entity_id);
    if (!c) return null;
    const tok = c.attributes._snapshot_token || 0;
    const slug = entity_id.replace("camera.", "");
    // Per-camera scene tint so each looks distinct. Labels are LANG-aware,
    // read at call time so a re-render after __configReady picks up FR.
    const isFR = (window.LANG || "").startsWith("fr");
    const tints = isFR ? {
      front_door:      ["#3a4a52", "#1a2530", "PORTE ENTRÉE"],
      front_door_bell: ["#52453a", "#2a1a15", "SONNETTE"],
      garage_door:     ["#3a3a52", "#1a1a30", "GARAGE"],
      salon:           ["#52503a", "#1a1a18", "SALON"],
    } : {
      front_door:      ["#3a4a52", "#1a2530", "FRONT DOOR"],
      front_door_bell: ["#52453a", "#2a1a15", "DOORBELL"],
      garage_door:     ["#3a3a52", "#1a1a30", "GARAGE"],
      salon:           ["#52503a", "#1a1a18", "LIVING ROOM"],
    };
    const [bg, fg, label] = tints[slug] || ["#222", "#111", entity_id];
    // deterministic noise from token
    const seed = tok % 100000;
    const blobs = Array.from({ length: 6 }, (_, i) => {
      const x = (seed * (i+1) * 37) % 100;
      const y = (seed * (i+1) * 71) % 100;
      const r = 8 + ((seed * (i+1)) % 22);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fg}" opacity="0.4"/>`;
    }).join("");
    const ts = new Date(c.last_updated).toLocaleTimeString(window.LANG || "en-CA");
    const motion = c.attributes.motion_detected;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${bg}"/>
          <stop offset="1" stop-color="${fg}"/>
        </linearGradient>
        <pattern id="grain" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="1" height="1" fill="rgba(255,255,255,0.05)"/>
        </pattern>
      </defs>
      <rect width="100" height="60" fill="url(#g)"/>
      ${blobs}
      <rect width="100" height="60" fill="url(#grain)"/>
      ${motion ? `<rect x="20" y="20" width="20" height="25" fill="none" stroke="#ffb547" stroke-width="0.5"/>
                  <text x="22" y="18" font-family="monospace" font-size="3" fill="#ffb547">SUBJECT</text>` : ""}
      <text x="3" y="6" font-family="monospace" font-size="3" fill="rgba(255,255,255,0.7)">${label}</text>
      <text x="97" y="57" font-family="monospace" font-size="2.5" fill="rgba(255,255,255,0.5)" text-anchor="end">${ts}</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  // dryer countdown demo
  setInterval(() => {
    const dryer = store.states.get("sensor.dryer_remaining_time");
    const status = store.states.get("sensor.dryer_current_status");
    if (!dryer || !status || status.state === "power_off") return;
    const [h, m] = String(dryer.state).split(":").map(Number);
    let total = (h||0)*60 + (m||0) - 1;
    if (total <= 0) {
      setState("sensor.dryer_current_status",  { state: "power_off" });
      setState("sensor.dryer_remaining_time",  { state: "00:00" });
    } else {
      const nh = Math.floor(total/60), nm = total%60;
      setState("sensor.dryer_remaining_time", {
        state: String(nh).padStart(2,"0") + ":" + String(nm).padStart(2,"0")
      });
    }
  }, 60_000);

  // ===== Localization overlay (FR) ========================================
  // The mock seeds INITIAL_STATES + calendar events synchronously at script
  // load, before window.LANG is set. After __configReady resolves, if the
  // chosen language is "fr", we patch friendly_names, rewrite calendar event
  // summaries/locations, and swap the input_select.calendar_view options.
  // English is the default and needs no overlay.
  const FRIENDLY_FR = {
    "cover.gdo_home_door":          "Porte de garage",
    "sensor.garage_humidity":       "Humidité garage",
    "sensor.garage_temperature":    "Température garage",
    "switch.smartswitchkitchen_right":      "Lumière Gaming",
    "climate.thermostatofficeroom":         "Thermostat Gaming",
    "light.switchtvroom":                   "Lumière TV",
    "switch.smartplugfanlivingroom":        "Ventilateur salon",
    "climate.thermostatlivingroom":         "Thermostat salon",
    "switch.smartswitchkitchen_left":       "Lumière cuisine",
    "switch.switchkitchencounter":          "Lumière comptoir",
    "climate.thermostatdiningroom":         "Thermostat cuisine",
    "switch.smartswitchbathroom_center":    "Lumière SDB centre",
    "switch.smartswitchbathroom_right":     "Lumière SDB droite",
    "switch.smartswitchbathroom_left":      "Ventilateur SDB",
    "climate.thermostatbathroom":           "Thermostat SDB haut",
    "sensor.dryer_remaining_time":          "Sécheuse restante",
    "sensor.dryer_current_status":          "État sécheuse",
    "sensor.washer_remaining_time":         "Laveuse restante",
    "sensor.washer_current_status":         "État laveuse",
    "switch.fanbasementbathroom":           "Ventilateur SDB bas",
    "switch.lightbasementbathroom":         "Lumière SDB bas",
    "switch.lightkidsroom":                 "Lumière salle de jeux",
    "switch.plug_sumpump":                  "Pompe puisard",
    "switch.deshumidificateur_sous_sol":    "Déshumidificateur",
    "sensor.sallejeuxtemphumsensor_salle_de_jeux_humidity": "Humidité salle de jeux",
    "climate.thermostatgamingroom":         "Thermostat salle de jeux",
    "switch.plug_fan_master_bedroom":       "Ventilateur maîtres",
    "climate.thermostatmasterbedroom":      "Thermostat maîtres",
    "climate.thermostat_mia_bedroom":       "Thermostat Mia",
    "climate.thermostat_noah_bedroom":      "Thermostat Noah",
    "climate.thermostat_liam_bedroom":      "Thermostat Liam",
    "climate.thermostat_alex_bedroom":      "Thermostat Alex",
    "sensor.bambu_lab_a1_heure_de_fin":     "Heure de fin Bambu",
    "sensor.bambu_lab_a1_etat_de_l_impression": "État impression",
    "climate.thermostat_office":            "Thermostat bureau",
    "sensor.tempsensorhomeoutside_temperature": "Température extérieure",
    "weather.forecast_home":                "Prévisions maison",
    "alarm_control_panel.blink_home":       "Alarme Blink",
    "input_boolean.presence_maison":        "Présence maison",
    "input_button.pickup_remote_start":     "Démarrage truck",
    "script.refresh_cameras_maison":        "Rafraîchir caméras",
    "camera.front_door":                    "Maison - Caméra porte entrée",
    "camera.front_door_bell":               "Maison - Caméra sonnette",
    "camera.garage_door":                   "Maison - Caméra garage",
    "camera.salon":                         "Maison - Caméra salon",
    "binary_sensor.front_door_motion":      "Maison - Caméra porte entrée Mouvement",
    "binary_sensor.front_door_bell_motion": "Maison - Caméra sonnette Mouvement",
    "binary_sensor.garage_door_motion":     "Maison - Caméra garage Mouvement",
    "binary_sensor.salon_motion":           "Maison - Caméra salon Mouvement",
    "binary_sensor.front_door_battery":      "Maison - Caméra porte entrée Batterie",
    "binary_sensor.front_door_bell_battery": "Maison - Caméra sonnette Batterie",
    "binary_sensor.garage_door_battery":     "Maison - Caméra garage Batterie",
    "binary_sensor.salon_battery":           "Maison - Caméra salon Batterie",
    "switch.front_door_camera_motion_detection":      "Maison - Caméra porte entrée Détection mouvement",
    "switch.front_door_bell_camera_motion_detection": "Maison - Caméra sonnette Détection mouvement",
    "switch.garage_door_camera_motion_detection":     "Maison - Caméra garage Détection mouvement",
    "switch.salon_camera_motion_detection":           "Maison - Caméra salon Détection mouvement",
    "sensor.blink_front_door_temperature":      "Maison - Caméra porte entrée Température",
    "sensor.blink_front_door_bell_temperature": "Maison - Caméra sonnette Température",
    "sensor.blink_garage_door_temperature":     "Maison - Caméra garage Température",
    "sensor.blink_front_door_wi_fi_signal_strength":      "Maison - Caméra porte entrée Wi-Fi",
    "sensor.blink_front_door_bell_wi_fi_signal_strength": "Maison - Caméra sonnette Wi-Fi",
    "sensor.blink_garage_door_wi_fi_signal_strength":     "Maison - Caméra garage Wi-Fi",
    "calendar.jordan":            "Jordan",
    "calendar.jordan_reminders":  "Jordan · Rappels",
    "calendar.alex":              "Alex",
    "calendar.noah":              "Noah",
    "calendar.mia":               "Mia",
    "calendar.mia_school":        "Mia · École",
    "calendar.riley":             "Riley",
    "calendar.liam":              "Liam",
    "calendar.famille":           "Famille",
    "input_text.calendar_filter_jordan":            "Filtre Jordan",
    "input_text.calendar_filter_jordan_reminders":  "Filtre Jordan Rappels",
    "input_text.calendar_filter_alex":              "Filtre Alex",
    "input_text.calendar_filter_noah":              "Filtre Noah",
    "input_text.calendar_filter_mia":               "Filtre Mia",
    "input_text.calendar_filter_riley":             "Filtre Riley",
    "input_text.calendar_filter_liam":              "Filtre Liam",
    "input_text.calendar_filter_famille":           "Filtre Famille",
    "input_select.calendar_view":                   "Vue calendrier",
  };

  const EVENT_FR = {
    "Hope Tournament":              "Tournoi Hope",
    "Strength training D1":         "Musculation D1",
    "Practice D1":                  "Pratique D1",
    "Online theory class":          "Cours théoriques en ligne",
    "Open Gym":                     "Open Gym",
    "Hockey":                       "Hockey",
    "Skating":                      "Patin",
    "Soccer":                       "Soccer",
    "School class":                 "Cours école",
    "Driving lesson":               "Cours de conduite",
    "Yoga":                         "Yoga",
    "Dinner with friends":          "Souper amis",
    "Reminder · Dentist appointment": "Rappel · RDV dentiste",
    "Reminder · Renew license":     "Rappel · Renouveler permis",
    "Work lunch":                   "Lunch travail",
    "Concert":                      "Concert",
    "Family dinner":                "Souper famille",
    "Ski trip":                     "Sortie ski",
  };
  const LOCATION_FR = {
    "Quebec City":      "Québec",
    "Bistro":           "Bistrot",
    "Bell Centre":      "Centre Bell",
    "Mont Sainte-Anne": "Mont Sainte-Anne",
  };
  const DESCRIPTION_FR = {
    "Practice": "Pratique",
  };

  function localizeMock(lang) {
    if (lang !== "fr") return; // English is the seeded default

    // friendly_names overlay
    for (const [id, fn] of Object.entries(FRIENDLY_FR)) {
      const ent = store.states.get(id);
      if (ent) ent.attributes.friendly_name = fn;
    }

    // calendar events: rewrite summaries/locations/descriptions in place
    for (const list of Object.values(calendarEvents)) {
      for (const e of list) {
        if (EVENT_FR[e.summary])           e.summary     = EVENT_FR[e.summary];
        if (LOCATION_FR[e.location])       e.location    = LOCATION_FR[e.location];
        if (DESCRIPTION_FR[e.description]) e.description = DESCRIPTION_FR[e.description];
      }
    }
    refreshCalendarStates();

    // input_select.calendar_view: swap state + options to FR
    setState("input_select.calendar_view", {
      state: "Mois",
      attributes: {
        friendly_name: "Vue calendrier",
        options: ["Aujourd'hui","Demain","Semaine","2 Semaines","Mois","2 Mois"],
      },
    });

    // Bump every camera's snapshot token so resolveSnapshot re-renders the
    // SVG with the FR tint labels. (Tints are read lazily on each call, but
    // existing <img> elements have cached src URLs — bumping forces React
    // to refetch.)
    for (const id of store.states.keys()) {
      if (id.startsWith("camera.") && store.states.get(id).attributes.brand === "Blink") {
        const tok = Date.now();
        setState(id, { attributes: { _snapshot_token: tok, entity_picture: `__snapshot__/${id}?t=${tok}` } });
      }
    }
  }

  if (window.__configReady && typeof window.__configReady.then === "function") {
    window.__configReady.then((cfg) => { try { localizeMock(cfg && cfg.language); } catch (e) { console.warn("[mock] localize failed:", e); } });
  }

  // ===== "Connection" — JSON-WS-style API, but in-process ================
  // Mirrors home-assistant-js-websocket: connect() resolves to an object with
  // sendMessagePromise, subscribeEvents, getStates, callService.
  function connect() {
    const subs = new Map(); // id -> handler

    return Promise.resolve({
      // hass.getStates()
      async getStates() {
        return Array.from(store.states.values());
      },
      // hass.callService(domain, service, data, target)
      async callService(domain, service, data, target) {
        callService(domain, service, { ...(target || {}), ...(data || {}) });
        return { context: { id: "ctx_" + (++store.msgId) } };
      },
      // hass.subscribeEvents(handler, "state_changed")
      async subscribeEvents(handler, event_type) {
        const id = ++store.msgId;
        const wrapped = (msg) => {
          if (msg.type !== "event") return;
          if (event_type && msg.event.event_type !== event_type) return;
          handler(msg.event);
        };
        store.listeners.add(wrapped);
        subs.set(id, wrapped);
        return () => { store.listeners.delete(wrapped); subs.delete(id); };
      },
      // hass.subscribeMessage — used for templates etc., stubbed
      async subscribeMessage() { return () => {}; },
      // weather/subscribe_forecasts mock — emit a 14-day synthetic forecast
      // derived from the current weather entity, then no further updates.
      async subscribeForecast(entity_id, forecast_type, handler) {
        const wx = store.states.get(entity_id);
        const baseHi = wx?.attributes?.forecast?.[0]?.temperature ?? -4;
        const baseLo = wx?.attributes?.forecast?.[0]?.templow     ?? -9;
        const conds = ["snowy","cloudy","partlycloudy","snowy-rainy","snowy"];
        const today = new Date(); today.setHours(0,0,0,0);
        const forecast = Array.from({ length: 14 }, (_, i) => {
          const d = new Date(today); d.setDate(d.getDate() + i);
          const drift = ((i*37) % 11 - 5) * 0.6;
          return {
            datetime: d.toISOString(),
            condition: conds[(d.getDay() + i) % conds.length],
            temperature: Math.round(baseHi + drift),
            templow:     Math.round(baseLo + drift * 0.8),
          };
        });
        setTimeout(() => handler(forecast), 0);
        return () => {};
      },
      // hass.callApi('GET', `calendars/${entity_id}?start=...&end=...`) — stubbed.
      // Returns events for `entity_id` whose [start..end) overlaps the requested window.
      async listEvents(entity_id, startISO, endISO) {
        return listEvents(entity_id, startISO, endISO);
      },
      // hass.callApi('POST', `calendars/${entity_id}`, payload) — stubbed.
      async createEvent(entity_id, payload) {
        return createEvent(entity_id, payload);
      },
      // direct state read
      getState(entity_id) { return store.states.get(entity_id); },
      // for debugging
      __setState: setState,
    });
  }

  // expose as a singleton client
  window.HA_MOCK = {
    connect,
    // raw helpers (handy for tests / tweaks panel)
    getState: (id) => store.states.get(id),
    setState,
    seedEntity,
    callService,
    listEvents,
    createEvent,
    resolveSnapshot,
    onAny: (fn) => { store.listeners.add(fn); return () => store.listeners.delete(fn); },
  };
})();
