// HOLO HOME OS — Scenes panel.
// Each tile is bound to a real Home Assistant entity. Tapping it calls the
// correct service for the entity's domain (input_boolean.toggle,
// input_button.press, script.turn_on, alarm_control_panel.alarm_arm_away/disarm).

function ScenesPanel() {
  const scenes = window.HOME_LAYOUT.scenes;
  const [extraOpen, setExtraOpen] = useState(false);
  return (
    <div className="panel panel--glow" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <CornerBrackets />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
        <span className="label-tag label-tag--accent">{window.t("scenes.header")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>{window.t("scenes.tap_trigger")}</span>
          <button
            onClick={() => { window.playBeep("tap"); setExtraOpen(true); }}
            title={window.t("scenes.more_actions")}
            className="t-mono"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 9px",
              background: "rgba(0,217,255,0.12)",
              border: "1px solid var(--line-strong)",
              color: "var(--accent)",
              fontSize: 9, letterSpacing: "0.18em",
              cursor: "pointer",
              boxShadow: "0 0 6px rgba(0,217,255,0.25)",
            }}
          >
            <Icon name="more" size={12} color="var(--accent)" />
            {window.t("scenes.more_actions_btn")}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {scenes.map(s => <SceneTile key={s.id} scene={s} />)}
      </div>
      {extraOpen && <ExtraActionsModal onClose={() => setExtraOpen(false)} />}
    </div>
  );
}

function isSceneActive(scene, ent) {
  if (!ent) return false;
  if (scene.kind === "alarm")  return String(ent.state).startsWith("armed");
  if (scene.kind === "toggle") return ent.state === "on";
  return false; // press tiles never look "stuck on"
}

function SceneTile({ scene }) {
  const ha  = useHA();
  const ent = useEntity(scene.entity);
  const [flash, setFlash] = useState(false);
  const active = isSceneActive(scene, ent);

  const onTap = () => {
    window.playBeep(active ? "off" : "on");
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
    if (!ha?.callService) return;

    if (scene.kind === "toggle") {
      ha.callService("input_boolean", "toggle", { entity_id: scene.entity });
    }
    else if (scene.kind === "press" && scene.domain === "input_button") {
      ha.callService("input_button", "press", { entity_id: scene.entity });
    }
    else if (scene.kind === "press" && scene.domain === "script") {
      ha.callService("script", "turn_on", { entity_id: scene.entity });
    }
    else if (scene.kind === "alarm") {
      const next = active ? "alarm_disarm" : "alarm_arm_away";
      ha.callService("alarm_control_panel", next, { entity_id: scene.entity });
    }
  };

  // sub-label
  let sub;
  if (scene.kind === "alarm") {
    sub = active ? scene.onLabel : scene.offLabel;
  } else if (scene.kind === "toggle") {
    sub = active ? scene.onLabel : scene.offLabel;
  } else {
    sub = flash ? scene.pressLabel : scene.idleLabel;
  }

  return (
    <div
      className={"tile " + (active ? "tile--active" : "")}
      onClick={onTap}
      style={{ padding: 12, position: "relative", overflow: "hidden", cursor: "pointer", minHeight: 96 }}
    >
      {flash && (
        <span style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(circle at 50% 50%, var(--accent) 0%, transparent 70%)",
          opacity: 0.35, animation: "fade-in 0.5s ease", pointerEvents: "none",
        }}/>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          width: 32, height: 32,
          border: "1px solid " + (active ? "var(--accent)" : "var(--line)"),
          display: "flex", alignItems: "center", justifyContent: "center",
          background: active ? "rgba(0,217,255,0.12)" : "transparent",
          boxShadow: active ? "0 0 10px rgba(0,217,255,0.3)" : "none",
        }}>
          <Icon name={scene.icon} color={active ? "var(--accent)" : "var(--text-1)"} size={15} />
        </div>
        {scene.kind !== "press" && <PulseDot kind={active ? "ok" : undefined} />}
      </div>
      <div className="h-display" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.2 }}>{scene.name.toUpperCase()}</div>
      <div className="t-mono" style={{ fontSize: 9, color: active ? "var(--accent)" : "var(--text-2)", marginTop: 4, letterSpacing: "0.15em" }}>
        {sub}
      </div>
      {/* entity reference for the tooltip-ish detail */}
      <div className="t-mono" style={{ fontSize: 8, color: "var(--text-2)", marginTop: 4, opacity: 0.55, letterSpacing: "0.1em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {scene.entity}
      </div>
    </div>
  );
}

window.ScenesPanel = ScenesPanel;
