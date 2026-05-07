// HOLO HOME OS — Floor plan with floor switcher (haut / principal / bas).
// Reads zone shapes from HOME_LAYOUT and live activity from HA states.

function FloorPlan({ activeId, onPick, radarOn, currentFloor, setCurrentFloor }) {
  const ha = useHA();
  const zones = window.HOME_LAYOUT.zones.filter(z => !z.hidden);
  const floorZones = zones.filter(z => z.floor === currentFloor);

  const FLOORS = (window.HOME_LAYOUT.floors || []).map(f => ({ id: f.id, label: f.label }));

  return (
    <div className="panel panel--glow" style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <CornerBrackets />
      <ScanOverlay />

      {/* header strip */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, padding: "12px 18px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid var(--line)",
        background: "linear-gradient(180deg, rgba(0,217,255,0.06), transparent)", zIndex: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="label-tag label-tag--accent">{window.t("floorplan.live")}</span>
          <span style={{ width: 1, height: 10, background: "var(--line-strong)" }}></span>
          <span className="t-mono" style={{ fontSize: 10, color: "var(--text-2)" }}>{window.t("floorplan.zones_north", { count: floorZones.length })}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {FLOORS.map(f => (
            <button key={f.id}
              className={"btn " + (currentFloor === f.id ? "btn--active" : "")}
              style={{ padding: "4px 10px", fontSize: 10 }}
              onClick={() => { window.playBeep("tap"); setCurrentFloor(f.id); }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", inset: "52px 18px 60px 18px" }}>
        <svg viewBox="0 0 84 84" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", overflow: "visible" }}>
          <defs>
            <linearGradient id="sweep-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(0,217,255,0)"/>
              <stop offset="80%" stopColor="rgba(0,217,255,0.35)"/>
              <stop offset="100%" stopColor="rgba(0,217,255,0.6)"/>
            </linearGradient>
            <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* outer outline per floor */}
          <rect x="2" y="0" width="80" height="84" fill="rgba(0,217,255,0.02)" stroke="var(--accent)" strokeWidth="0.25" filter="url(#glow-soft)"/>

          {/* radar */}
          {radarOn && (
            <g style={{ transformOrigin: "50% 50%" }}>
              <circle cx="42" cy="42" r="44" fill="none" stroke="rgba(0,217,255,0.1)" strokeWidth="0.15"/>
              <circle cx="42" cy="42" r="30" fill="none" stroke="rgba(0,217,255,0.12)" strokeWidth="0.15"/>
              <circle cx="42" cy="42" r="18" fill="none" stroke="rgba(0,217,255,0.14)" strokeWidth="0.15"/>
              <line x1="0"  y1="42" x2="84" y2="42" stroke="rgba(0,217,255,0.06)" strokeWidth="0.1"/>
              <line x1="42" y1="0"  x2="42" y2="84" stroke="rgba(0,217,255,0.06)" strokeWidth="0.1"/>
              <g style={{ transformOrigin: "42px 42px", animation: "boot-spin calc(8s / max(var(--motion), 0.05)) linear infinite" }}>
                <path d="M42 42 L42 -8 A50 50 0 0 1 92 32 Z" fill="url(#sweep-grad)" opacity="0.45"/>
              </g>
            </g>
          )}

          {/* zones */}
          {floorZones.map(z => {
            const active = z.id === activeId;
            // any "on" device?
            const anyOn = (z.entities || []).some(e => {
              const s = ha?.states?.get(e.id);
              if (!s) return false;
              if (e.kind === "thermo") return s.attributes.hvac_action === "heating" || s.attributes.hvac_action === "cooling";
              return s.state === "on";
            });
            // thermostat preview
            const thermoEnt = (z.entities || []).find(e => e.kind === "thermo");
            const thermoState = thermoEnt ? ha?.states?.get(thermoEnt.id) : null;
            const cT = thermoState?.attributes?.current_temperature;
            return (
              <g key={z.id} onClick={() => { window.playBeep("tap"); onPick(z.id); }} style={{ cursor: "pointer" }}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h}
                  fill={active ? "rgba(0,217,255,0.14)" : "rgba(0,217,255,0.03)"}
                  stroke={active ? "var(--accent)" : "rgba(0,217,255,0.35)"}
                  strokeWidth={active ? "0.4" : "0.2"}
                  filter={active ? "url(#glow-soft)" : undefined}/>
                {[[0,0],[1,0],[0,1],[1,1]].map(([cx,cy], i) => (
                  <g key={i}>
                    <line x1={z.x + cx*z.w + (cx?-2:2)} y1={z.y + cy*z.h} x2={z.x + cx*z.w} y2={z.y + cy*z.h} stroke="var(--accent)" strokeWidth="0.3"/>
                    <line x1={z.x + cx*z.w} y1={z.y + cy*z.h + (cy?-2:2)} x2={z.x + cx*z.w} y2={z.y + cy*z.h} stroke="var(--accent)" strokeWidth="0.3"/>
                  </g>
                ))}
                <circle cx={z.x + z.w/2} cy={z.y + z.h/2} r={anyOn ? 1.1 : 0.5}
                  fill={anyOn ? "var(--accent)" : "rgba(0,217,255,0.4)"}
                  filter={anyOn ? "url(#glow-soft)" : undefined}/>
                {anyOn && radarOn && (
                  <circle cx={z.x + z.w/2} cy={z.y + z.h/2} r="1.1" fill="none" stroke="var(--accent)" strokeWidth="0.2" opacity="0.6">
                    <animate attributeName="r" values="1.1;4;1.1" dur="3.6s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.7;0;0.7" dur="3.6s" repeatCount="indefinite"/>
                  </circle>
                )}
                {/* label */}
                <text x={z.x + 1.3} y={z.y + 3.2}
                  fontFamily="var(--font-mono)" fontSize="1.7"
                  fill={active ? "var(--accent)" : "var(--text-1)"}
                  letterSpacing="0.08">{z.name.toUpperCase()}</text>
                {/* temp readout */}
                {cT != null && z.h > 8 && (
                  <text x={z.x + 1.3} y={z.y + z.h - 1.2}
                    fontFamily="var(--font-display)" fontSize="3"
                    fontWeight="500"
                    fill={active ? "var(--accent)" : "var(--text-1)"}
                    style={{ textShadow: "0 0 4px currentColor" }}>{(+cT).toFixed(0)}°</text>
                )}
                {/* device dot count */}
                <text x={z.x + z.w - 1.3} y={z.y + 3.2} textAnchor="end"
                  fontFamily="var(--font-mono)" fontSize="1.7"
                  fill="var(--text-2)">×{(z.entities || []).length}</text>
              </g>
            );
          })}

          {/* empty floor message */}
          {floorZones.length === 0 && (
            <text x="42" y="42" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="3" fill="var(--text-2)">{window.t("floorplan.no_zones")}</text>
          )}
        </svg>
      </div>

      {/* footer */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 18px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: "1px solid var(--line)", gap: 12,
      }}>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", flexShrink: 0 }}>{window.t("floorplan.zone_active")}</div>
        <div className="h-display" style={{
          fontSize: 14, color: "var(--accent)", letterSpacing: "0.16em",
          textShadow: "0 0 6px rgba(0,217,255,0.4)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          flex: 1, textAlign: "center",
        }}>
          {(window.HOME_LAYOUT.zones.find(z => z.id === activeId)?.name || "—").toUpperCase()}
        </div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", flexShrink: 0 }}>{window.t("floorplan.tap")}</div>
      </div>
    </div>
  );
}

window.FloorPlan = FloorPlan;
