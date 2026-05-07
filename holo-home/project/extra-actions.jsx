// HOLO HOME OS — Extra Actions modal
// Categorized library of pre-configured automation scripts. Mirrors the
// user's HA Bubble-Card popup config: Lumières, Skylight Calendar, Présence,
// Thermostats, Caméras, Noël. Each row calls `script.turn_on` against the
// real entity_id (auto-registered into the mock on first import).

(() => {
  const { useState, useMemo, useEffect } = React;

  // ---- catalog ------------------------------------------------------------
  // Sourced from APP_CONFIG.extraActions.groups at render time. The literal
  // below is kept ONLY as a fallback if config.json is missing the section.
  function getCatalog() {
    const fromCfg = window.APP_CONFIG?.extraActions?.groups;
    return Array.isArray(fromCfg) && fromCfg.length ? fromCfg : FALLBACK_CATALOG;
  }
  const FALLBACK_CATALOG = [
    {
      id: "lumieres",
      name: "Lumières",
      icon: "bulb",
      tint: "#ffd54a",
      actions: [
        { id: "script.light_close_all", label: "Fermer toutes les lumières", icon: "bulb-off", danger: true },
      ],
    },
    {
      id: "skylight",
      name: "Skylight Calendar",
      icon: "screen",
      tint: "#7fb8ff",
      actions: [
        { id: "script.skylight_calendar_turn_off_screen", label: "Mettre en veille",  icon: "moon" },
        { id: "script.skylight_calendar_turn_on_screen",  label: "Réveiller",         icon: "sun"  },
        { id: "script.skylight_calendar_reboot",          label: "Redémarrer",        icon: "reload" },
        { id: "script.skylight_calendar_shutdown",        label: "Arrêter",           icon: "power", danger: true },
      ],
    },
    {
      id: "presence",
      name: "Présence",
      icon: "home",
      tint: "#4be6ff",
      actions: [
        { id: "script.security_arriving_home",           label: "Arriver à la maison",   icon: "home" },
        { id: "script.quitter_la_maison",                label: "Quitter la maison",     icon: "home-out" },
        { id: "script.retour_a_la_maison",               label: "Retour à la maison",    icon: "home" },
        { id: "script.preparer_maison",                  label: "Préparer la maison",    icon: "sparkle" },
        { id: "script.aller_au_chalet",                  label: "Aller au chalet",       icon: "cabin" },
        { id: "script.quitter_chalet_preparer_maison",   label: "Quitter le chalet",     icon: "cabin" },
        { id: "script.preparer_le_chalet",               label: "Préparer le chalet",    icon: "cabin" },
      ],
    },
    {
      id: "thermostats",
      name: "Thermostats",
      icon: "thermo",
      tint: "#ff9e66",
      actions: [
        { id: "script.thermostat_set_temp_high",    label: "Augmenter tous les thermostats",         icon: "thermo-up" },
        { id: "script.thermostat_set_temp_default", label: "Par défaut tous les thermostats",        icon: "thermo" },
        { id: "script.thermostat_set_temp_low",     label: "Baisser tous les thermostats",           icon: "thermo-down" },
        { id: "script.thermostat_turn_off_all",     label: "Fermer tous les thermostats (printemps)",icon: "thermo-off", danger: true },
        { id: "script.thermostat_turn_heat_all",    label: "Ouvrir tous les thermostats (automne)",  icon: "flame" },
        { id: "script.thermostat_fix_time",         label: "Corriger l'heure",                       icon: "clock" },
      ],
    },
    {
      id: "cameras",
      name: "Caméras",
      icon: "cam",
      tint: "#ff4a6b",
      subtitle: "Rafraîchir les snapshots",
      actions: [
        { id: "script.refresh_cameras_maison",                    label: "Maison · Toutes",       icon: "home" },
        { id: "script.refresh_camera_charage",                    label: "Charage · Toutes",      icon: "garage" },
        { id: "script.refresh_camera_charage_exterieur_1",        label: "Charage · Extérieur 1", icon: "garage" },
        { id: "script.refresh_camera_charage_exterieur_2",        label: "Charage · Extérieur 2", icon: "garage" },
        { id: "script.refresh_camera_charage_garage",             label: "Charage · Garage 1",    icon: "garage" },
        { id: "script.refresh_camera_charage_maisoncharage_garage", label: "Charage · Garage 2",  icon: "garage" },
      ],
    },
    {
      id: "noel",
      name: "Noël",
      icon: "tree",
      tint: "#4bffb5",
      seasonal: true,
      actions: [
        { id: "script.christmas_all_on",      label: "Ouvrir toutes les lumières",     icon: "lights" },
        { id: "script.christmas_all_off",     label: "Fermer toutes les lumières",     icon: "lights-off", danger: true },
        { id: "script.christmas_outside_on",  label: "Ouvrir les lumières extérieur",  icon: "lights" },
        { id: "script.christmas_outside_off", label: "Fermer les lumières extérieur",  icon: "lights-off" },
        { id: "script.christmas_inside_on",   label: "Ouvrir les lumières intérieur",  icon: "lights" },
        { id: "script.christmas_inside_off",  label: "Fermer les lumières intérieur",  icon: "lights-off" },
      ],
    },
  ];

  // ---- ensure all script entities exist in the mock ----------------------
  // The mock starts with only a few scripts; auto-register everything from
  // the catalog so callService("script","turn_on",…) won't drop on the floor.
  function ensureMockScripts(catalog) {
    if (!window.HA_MOCK?.seedEntity) return;
    for (const grp of catalog) {
      for (const a of grp.actions) {
        window.HA_MOCK.seedEntity(a.id, {
          state: "off",
          attributes: { friendly_name: a.label },
        });
      }
    }
  }

  // ---- modal --------------------------------------------------------------
  function ExtraActionsModal({ onClose }) {
    const ha = window.useHA ? window.useHA() : null;
    const catalog = useMemo(() => getCatalog(), []);
    useEffect(() => { ensureMockScripts(catalog); }, [catalog]);

    const [query, setQuery] = useState("");
    const [openId, setOpenId] = useState(catalog[0]?.id || null);
    const [lastFired, setLastFired] = useState(null);

    const groups = useMemo(() => {
      if (!query.trim()) return catalog;
      const q = query.trim().toLowerCase();
      return catalog
        .map(g => ({ ...g, actions: g.actions.filter(a =>
          a.label.toLowerCase().includes(q) || a.id.includes(q) || g.name.toLowerCase().includes(q)
        )}))
        .filter(g => g.actions.length > 0);
    }, [query, catalog]);

    function fire(action) {
      window.playBeep("on");
      if (ha?.callService) {
        ha.callService("script", "turn_on", { entity_id: action.id });
      } else if (window.HA_MOCK?.callService) {
        window.HA_MOCK.callService("script", "turn_on", { entity_id: action.id });
      }
      setLastFired({ id: action.id, label: action.label, t: Date.now() });
      setTimeout(() => setLastFired(null), 1800);
    }

    const totalCount = catalog.reduce((s, g) => s + g.actions.length, 0);

    return ReactDOM.createPortal(
      <div className="modal-back" onClick={onClose} style={{ zIndex: 600, alignItems: "stretch", justifyContent: "stretch", padding: 14 }}>
        <div
          className="panel panel--glow"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "100%",
            display: "flex", flexDirection: "column",
            position: "relative", overflow: "hidden",
          }}
        >
          <CornerBrackets />

          {/* header */}
          <div style={{
            padding: "18px 22px 14px",
            borderBottom: "1px solid var(--line)",
            display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
          }}>
            <div>
              <div className="label-tag label-tag--accent" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PulseDot /> {window.t("extra.library")}
              </div>
              <div className="h-display" style={{
                fontSize: 22, color: "var(--text-0)", letterSpacing: "0.16em",
                marginTop: 4, textShadow: "0 0 12px rgba(0,217,255,0.3)",
              }}>
                {window.t("extra.title")}
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: "var(--text-1)", letterSpacing: "0.18em", marginTop: 6 }}>
                {window.t("extra.count", { actions: totalCount, cats: catalog.length })}
              </div>
            </div>
            <button className="btn" onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="x" size={12} /> {window.t("extra.close")}
            </button>
          </div>

          {/* search */}
          <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={window.t("extra.filter")}
                className="t-mono composer-input"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid var(--line-strong)",
                  color: "#fff", width: "100%",
                  padding: "9px 12px 9px 34px",
                  fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                  outline: "none", colorScheme: "dark",
                }}
                autoFocus
              />
              <span style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-2)", display: "flex", alignItems: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
                </svg>
              </span>
            </div>
          </div>

          {/* groups (scroll area) */}
          <div className="no-scroll" style={{ overflow: "auto", padding: "8px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.length === 0 && (
              <div className="t-mono" style={{ padding: 36, textAlign: "center", color: "var(--text-2)", letterSpacing: "0.18em", fontSize: 11 }}>
                {window.t("extra.no_results")}
              </div>
            )}
            {groups.map(g => {
              const open = !!query.trim() || openId === g.id;
              return (
                <CategoryGroup
                  key={g.id}
                  group={g}
                  open={open}
                  onToggle={() => setOpenId(openId === g.id ? null : g.id)}
                  onFire={fire}
                  lastFired={lastFired}
                  forceOpen={!!query.trim()}
                />
              );
            })}
          </div>

          {/* status bar */}
          <div style={{
            padding: "10px 22px", borderTop: "1px solid var(--line)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            background: "rgba(0,0,0,0.4)",
          }}>
            <div className="t-mono" style={{ fontSize: 10, color: "var(--text-1)", letterSpacing: "0.16em", display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
              {lastFired ? (
                <>
                  <span style={{
                    display: "inline-block", width: 6, height: 6,
                    background: "var(--ok)", boxShadow: "0 0 8px var(--ok)",
                    transform: "rotate(45deg)",
                    animation: "pulse 0.8s ease",
                  }}/>
                  <span style={{ color: "var(--ok)" }}>{window.t("extra.script_run")}</span>
                  <span style={{ color: "var(--text-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastFired.label}</span>
                </>
              ) : (
                <>
                  <span style={{ color: "var(--text-2)" }}>◇</span>
                  {window.t("extra.footer")} <span style={{ color: "var(--accent)" }}>script.turn_on</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  function CategoryGroup({ group, open, onToggle, onFire, lastFired, forceOpen }) {
    const tint = group.tint || "var(--accent)";
    return (
      <div style={{
        border: `1px solid ${withAlpha(tint, 0.25)}`,
        background: `linear-gradient(180deg, ${withAlpha(tint, 0.05)}, rgba(0,0,0,0.35))`,
      }}>
        <button
          onClick={forceOpen ? undefined : onToggle}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px",
            background: "transparent",
            border: "none", borderBottom: open ? `1px solid ${withAlpha(tint, 0.35)}` : "none",
            color: "var(--text-0)", cursor: forceOpen ? "default" : "pointer",
            textAlign: "left",
          }}
        >
          <span style={{
            width: 30, height: 30,
            border: `1px solid ${withAlpha(tint, 0.6)}`,
            background: withAlpha(tint, 0.15),
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 8px ${withAlpha(tint, 0.35)}`,
          }}>
            <Icon name={group.icon} color={tint} size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-display" style={{ fontSize: 14, color: "var(--text-0)", letterSpacing: "0.14em" }}>
              {group.name.toUpperCase()}
            </div>
            {group.subtitle && (
              <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", letterSpacing: "0.16em", marginTop: 2 }}>
                {group.subtitle.toUpperCase()}
              </div>
            )}
          </div>
          <span className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", letterSpacing: "0.18em" }}>
            {group.actions.length}
          </span>
          {!forceOpen && (
            <span style={{
              transition: "transform 0.2s ease",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              color: tint,
              display: "flex",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          )}
        </button>

        {open && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 6, padding: 8,
          }}>
            {group.actions.map(a => (
              <ActionRow
                key={a.id}
                action={a}
                tint={tint}
                onFire={() => onFire(a)}
                justFired={lastFired && lastFired.id === a.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  function ActionRow({ action, tint, onFire, justFired }) {
    const [hot, setHot] = useState(false);
    const danger = action.danger;
    const c = danger ? "var(--danger)" : tint;

    function go() {
      setHot(true);
      setTimeout(() => setHot(false), 500);
      onFire();
    }

    return (
      <button
        onClick={go}
        className="tile"
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px",
          background: hot || justFired
            ? `linear-gradient(180deg, ${withAlpha(danger ? "#ff4a6b" : tint, 0.25)}, rgba(0,0,0,0.4))`
            : "rgba(0,0,0,0.35)",
          border: `1px solid ${justFired ? c : "var(--line)"}`,
          borderLeft: `3px solid ${c}`,
          color: "var(--text-0)",
          textAlign: "left",
          cursor: "pointer",
          minWidth: 0,
          transition: "background 0.15s ease, border-color 0.15s ease",
          position: "relative", overflow: "hidden",
        }}
      >
        {hot && (
          <span style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 50% 50%, ${withAlpha(danger ? "#ff4a6b" : tint, 0.5)} 0%, transparent 70%)`,
            opacity: 0.6, animation: "fade-in 0.4s ease", pointerEvents: "none",
          }}/>
        )}
        <Icon name={action.icon} color={c} size={15} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-mono" style={{
            fontSize: 11, letterSpacing: "0.06em",
            color: "var(--text-0)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{action.label}</div>
          <div className="t-mono" style={{
            fontSize: 8, color: "var(--text-2)", letterSpacing: "0.12em",
            marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{action.id}</div>
        </div>
        {justFired && (
          <span className="t-mono" style={{
            fontSize: 8, color: "var(--ok)", letterSpacing: "0.18em",
            border: "1px solid var(--ok)", padding: "2px 6px",
            boxShadow: "0 0 6px rgba(75,255,181,0.5)",
          }}>OK</span>
        )}
      </button>
    );
  }

  // helper copied from calendar-screen — alpha overlay for hex colors
  function withAlpha(hex, a) {
    if (!hex || hex.startsWith("var(")) return `rgba(0,217,255,${a})`;
    const h = hex.replace("#", "");
    const n = h.length === 3
      ? h.split("").map(c => parseInt(c+c, 16))
      : [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    return `rgba(${n[0]},${n[1]},${n[2]},${a})`;
  }

  Object.assign(window, { ExtraActionsModal });
})();
