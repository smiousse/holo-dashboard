// HOLO HOME OS — Critical systems rail. Live from HA mock entities.

function SystemsRail({ alerts, onAlertClick }) {
  const ha = useHA();
  const refs = window.HOME_LAYOUT.systemRefs;
  const onCount = refs.filter(r => {
    if (!r.entity) return true;
    return ha?.states?.get(r.entity)?.state === "on";
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, height: "100%" }}>
      <div className="panel panel--glow" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
        <CornerBrackets />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
          <span className="label-tag label-tag--accent">{window.t("systems.critical")}</span>
          <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>{window.t("systems.active", { on: onCount, total: refs.length })}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "auto", flex: 1, minHeight: 0 }} className="no-scroll">
          {refs.map(r => <SystemRow key={r.id} def={r} />)}
        </div>
      </div>

      <div className="panel panel--glow" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 200, flexShrink: 0 }}>
        <CornerBrackets />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
          <span className="label-tag" style={{ color: "var(--warn)" }}>{window.t("systems.alerts")}</span>
          <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>{window.t("systems.open", { count: alerts.length })}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, overflow: "auto" }} className="no-scroll">
          {alerts.map(a => {
            const clickable = !!a.cameraId;
            return (
              <div key={a.id}
                onClick={clickable ? () => { window.playBeep("warn"); onAlertClick(a); } : undefined}
                style={{
                  display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px",
                  border: "1px solid " + (a.level === "danger" ? "var(--danger)" : "var(--line)"),
                  background: a.level === "danger" ? "rgba(255,74,107,0.08)" : "rgba(0,0,0,0.25)",
                  cursor: clickable ? "pointer" : "default", position: "relative",
                  boxShadow: a.level === "danger" ? "0 0 10px rgba(255,74,107,0.18)" : "none",
                  transition: "all 0.18s",
                }}>
                <div style={{ marginTop: 2 }}>
                  <PulseDot kind={a.level === "warn" ? "warn" : a.level === "danger" ? "danger" : "ok"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-mono" style={{ fontSize: 11, color: "var(--text-0)", lineHeight: 1.3 }}>{a.text}</div>
                  <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", marginTop: 3, display: "flex", justifyContent: "space-between" }}>
                    <span>{a.time.toUpperCase()}</span>
                    {clickable && <span style={{ color: "var(--danger)", letterSpacing: "0.18em" }}>VOIR ▸</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SystemRow({ def: r }) {
  const ha = useHA();
  const { callService } = ha || {};
  const main = r.entity ? ha?.states?.get(r.entity) : null;
  const metric = r.metricEntity ? ha?.states?.get(r.metricEntity) : null;
  const sub = r.subEntity ? ha?.states?.get(r.subEntity) : null;
  const on = r.entity ? main?.state === "on" : true;

  const toggle = () => {
    if (!r.entity || !callService) return;
    window.playBeep(on ? "off" : "on");
    callService("switch", "toggle", { entity_id: r.entity });
  };

  return (
    <div className={"tile " + (on ? "tile--active" : "")} style={{ padding: 10, flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: on ? "rgba(0,217,255,0.1)" : "transparent", flexShrink: 0,
          }}>
            <Icon name={r.icon || "wave"} color={on ? "var(--accent)" : "var(--text-2)"} size={15} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="h-display" style={{ fontSize: 11, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name.toUpperCase()}</div>
            <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", marginTop: 2 }}>{r.detail}</div>
          </div>
        </div>
        {r.entity && (
          <div onClick={toggle} className={"toggle-pill " + (on ? "toggle-pill--on" : "")} role="button" style={{ flexShrink: 0 }}></div>
        )}
      </div>
      {(metric || sub) && (
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: sub ? "1fr 1fr" : "1fr", gap: 8 }}>
          {metric && <Metric label={r.metricLabel} value={metric.state} unit={r.metricUnit} on={on} />}
          {sub && <Metric label={r.subLabel} value={sub.state} unit={r.subUnit} on={on} />}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, unit, on }) {
  const num = +value;
  const display = Number.isFinite(num) ? String(Math.round(num)) : value;
  return (
    <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: 8 }}>
      <div className="label-tag" style={{ fontSize: 8 }}>{(label || "").toUpperCase()}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 14, color: on ? "var(--accent)" : "var(--text-1)", fontWeight: 500, textShadow: on ? "0 0 6px rgba(0,217,255,0.4)" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>{display}</span>
        <span style={{ fontSize: 9, color: "var(--text-2)" }}>{unit}</span>
      </div>
    </div>
  );
}

window.SystemsRail = SystemsRail;
