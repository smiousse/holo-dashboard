// HOLO HOME OS — Zone detail. Pure entity-id driven; pulls live state from
// the HA mock socket via useEntity().

function ZoneDetail({ zone }) {
  if (!zone) return null;

  return (
    <div className="panel panel--glow" style={{ position: "relative", padding: 18, display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
      <CornerBrackets />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name={zone.icon || "sofa"} color="var(--accent)" size={22} />
          <div>
            <div className="label-tag label-tag--accent">{window.t("zone.detail", { floor: (window.HOME_LAYOUT.floors?.find(f => f.id === zone.floor)?.label || zone.floor || "").toUpperCase() })}</div>
            <div className="h-display" style={{ fontSize: 22, color: "var(--text-0)", marginTop: 4, letterSpacing: "0.14em", textShadow: "0 0 10px rgba(0,217,255,0.25)" }}>{zone.name.toUpperCase()}</div>
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", textAlign: "right" }}>
          <div>{window.t("zone.entities", { count: (zone.entities || []).length + (zone.cover ? 1 : 0) })}</div>
          <div style={{ color: "var(--ok)" }}>{window.t("zone.link_ok")}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }} className="no-scroll">
        {zone.cover && <CoverControl id={zone.cover.id} label={zone.cover.label} />}
        {(zone.entities || []).map(e => <EntityRow key={e.id} ent={e} />)}
      </div>
    </div>
  );
}

function EntityRow({ ent }) {
  const state = useEntity(ent.id);
  if (!state) return <SkeletonRow id={ent.id} label={ent.label} />;
  if (ent.kind === "thermo")    return <ThermostatControl ent={ent} />;
  if (ent.kind === "light")     return <SwitchControl ent={ent} icon="bulb" tag={window.t("tags.light")} />;
  if (ent.kind === "fan")       return <SwitchControl ent={ent} icon="fan" tag={window.t("tags.fan")} spin />;
  if (ent.kind === "switch")    return <SwitchControl ent={ent} icon={ent.icon || "wave"} tag={window.t("tags.switch")} />;
  if (ent.kind === "sensor")    return <SensorControl ent={ent} />;
  if (ent.kind === "appliance") return <ApplianceControl ent={ent} />;
  if (ent.kind === "printer")   return <PrinterControl ent={ent} />;
  return null;
}

function SkeletonRow({ id, label }) {
  return (
    <div className="tile" style={{ padding: 12, opacity: 0.5 }}>
      <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)" }}>{window.t("zone.linking", { id })}</div>
      <div className="h-display" style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// --- Cover (garage door) -----
function CoverControl({ id, label }) {
  const state = useEntity(id);
  const { toggleCover } = useEntityActions(id);
  if (!state) return null;
  const open = state.state === "open";
  return (
    <div className={"tile " + (open ? "tile--active" : "")} style={{ padding: 14, cursor: "pointer" }}
         onClick={() => { window.playBeep(open ? "off" : "on"); toggleCover(); }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Icon name="garage-cover" color={open ? "var(--warn)" : "var(--accent)"} size={20} />
          <div>
            <div className="label-tag">{window.t("zone.cover_garage")}</div>
            <div className="h-display" style={{ fontSize: 13, marginTop: 2 }}>{label.toUpperCase()}</div>
          </div>
        </div>
        <Tag kind={open ? "warn" : "ok"}>{open ? window.t("common.open") : window.t("common.closed")}</Tag>
      </div>
      <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>{id}</div>
    </div>
  );
}

// --- Thermostat ---
function ThermostatControl({ ent }) {
  const state = useEntity(ent.id);
  const { setTemperature } = useEntityActions(ent.id);
  if (!state) return null;
  const cur = +state.attributes.current_temperature;
  const tgt = +state.attributes.temperature;
  const action = state.attributes.hvac_action || "idle"; // heating | cooling | idle

  const COL = window.THERMO_COLORS;
  const stripeColor = action === "heating" ? COL.heating : action === "cooling" ? COL.cooling : COL.idle;
  const iconColor   = action === "heating" ? COL.heating_icon : action === "cooling" ? COL.cooling : COL.idle_icon;

  const setTarget = (delta) => {
    window.playBeep("tap");
    const next = Math.max(10, Math.min(30, +(tgt + delta).toFixed(1)));
    setTemperature(next);
  };
  const pct    = ((cur - 10) / 20) * 100;
  const tgtPct = ((tgt - 10) / 20) * 100;
  const gid = "g-" + ent.id.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="tile tile--active" style={{ padding: 14, borderLeft: `3px solid ${stripeColor}`, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", background: action === "heating" ? "rgba(251,57,39,0.12)" : action === "cooling" ? "rgba(43,173,251,0.12)" : "rgba(0,0,0,0.2)" }}>
            <Icon name={action === "cooling" ? "wind" : "flame"} color={action === "idle" ? "var(--text-1)" : iconColor} size={15} />
          </div>
          <div>
            <div className="label-tag">THERMOSTAT · {action.toUpperCase()}</div>
            <div className="h-display" style={{ fontSize: 13, marginTop: 2 }}>{ent.label.toUpperCase()}</div>
          </div>
        </div>
        <Tag kind={action === "heating" ? "danger" : action === "cooling" ? "accent" : null}>{state.state.toUpperCase()}</Tag>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "center" }}>
        <div style={{ position: "relative", width: 100, height: 100 }}>
          <svg viewBox="0 0 120 120" width="100" height="100">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,217,255,0.2)"/>
                <stop offset="100%" stopColor={action === "heating" ? COL.heating : action === "cooling" ? COL.cooling : "var(--accent)"}/>
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--line)" strokeWidth="1"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke={`url(#${gid})`} strokeWidth="3"
              strokeDasharray={`${(pct / 100) * 235} 999`} strokeLinecap="round"
              transform="rotate(135 60 60)"
              style={{ transition: "stroke-dasharray 0.5s ease", filter: `drop-shadow(0 0 3px ${stripeColor})` }}/>
            <g transform={`rotate(${135 + (tgtPct / 100) * 270} 60 60)`}>
              <line x1="60" y1="6" x2="60" y2="14" stroke="var(--warn)" strokeWidth="2" />
            </g>
            <text x="60" y="58" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="500" fontSize="26" fill="var(--text-0)">{cur.toFixed(0)}</text>
            <text x="60" y="74" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-2)" letterSpacing="2">{window.t("zone.current_c")}</text>
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="label-tag">{window.t("common.target")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="h-display" style={{ fontSize: 32, color: "var(--accent)", lineHeight: 1, textShadow: "0 0 10px rgba(0,217,255,0.5)" }}>{tgt.toFixed(0)}</span>
            <span className="t-mono" style={{ fontSize: 12, color: "var(--text-2)" }}>°C</span>
          </div>
          <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>
            ΔT {tgt > cur ? "+" : ""}{(tgt - cur).toFixed(0)}°
          </div>
          <div className="t-mono" style={{ fontSize: 8, color: "var(--text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ent.id}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="btn" onClick={() => setTarget(0.5)} style={{ padding: "10px 14px" }}><Icon name="plus" /></button>
          <button className="btn" onClick={() => setTarget(-0.5)} style={{ padding: "10px 14px" }}><Icon name="minus" /></button>
        </div>
      </div>
    </div>
  );
}

// --- Switch (light / fan / generic) ---
function SwitchControl({ ent, icon, tag, spin }) {
  const state = useEntity(ent.id);
  const { toggle } = useEntityActions(ent.id);
  if (!state) return null;
  const on = state.state === "on";
  const fire = (e) => {
    e?.stopPropagation?.();
    window.playBeep(on ? "off" : "on");
    toggle();
  };
  return (
    <div onClick={fire}
         className={"tile " + (on ? "tile--active" : "")}
         style={{ padding: 12, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: spin ? "50%" : 0,
            border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: on ? "rgba(0,217,255,0.12)" : "transparent",
            boxShadow: on ? "0 0 12px rgba(0,217,255,0.3)" : "none",
            animation: on && spin ? "boot-spin 2s linear infinite" : "none",
          }}>
            <Icon name={icon} color={on ? "var(--accent)" : "var(--text-2)"} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="label-tag">{tag}</div>
            <div className="h-display" style={{ fontSize: 13, marginTop: 2 }}>{ent.label.toUpperCase()}</div>
            <div className="t-mono" style={{ fontSize: 8, color: "var(--text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{ent.id}</div>
          </div>
        </div>
        <div onClick={fire} className={"toggle-pill " + (on ? "toggle-pill--on" : "")} role="button"></div>
      </div>
    </div>
  );
}

// --- Sensor (read-only) ---
function SensorControl({ ent }) {
  const state = useEntity(ent.id);
  if (!state) return null;
  const v = state.state;
  const num = +v;
  let valueColor = "var(--text-0)";
  if (ent.coloring === "humidity" && !Number.isNaN(num)) {
    valueColor = num > 70 ? "var(--warn)" : num < 30 ? "var(--accent)" : "var(--ok)";
  }
  if (ent.coloring === "temperature" && !Number.isNaN(num)) {
    valueColor = num > 24 ? "var(--warn)" : num < 5 ? "var(--accent)" : "var(--text-0)";
  }
  const display = Number.isFinite(num) ? String(Math.round(num)) : v;
  return (
    <div className="tile" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name={ent.icon || "drop"} color="var(--text-1)" />
          <div>
            <div className="label-tag">{window.t("common.sensor")}</div>
            <div className="h-display" style={{ fontSize: 13, marginTop: 2 }}>{ent.label.toUpperCase()}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="h-display" style={{ fontSize: 24, color: valueColor, textShadow: "0 0 8px currentColor" }}>{display}</span>
          <span className="t-mono" style={{ fontSize: 11, color: "var(--text-2)", marginLeft: 4 }}>{ent.unit || state.attributes.unit_of_measurement || ""}</span>
        </div>
      </div>
    </div>
  );
}

// --- Appliance (washer/dryer) — only visible when running ---
function ApplianceControl({ ent }) {
  const time = useEntity(ent.id);
  const status = useEntity(ent.statusEntity);
  if (!time || !status) return null;
  const off = status.state === "power_off";
  const isWasher = ent.id.includes("washer");
  return (
    <div className={"tile " + (!off ? "tile--active" : "")} style={{ padding: 12, opacity: off ? 0.5 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", background: !off ? "rgba(0,217,255,0.1)" : "transparent" }}>
            <Icon name={isWasher ? "washer" : "dryer"} color={!off ? "var(--accent)" : "var(--text-2)"} />
          </div>
          <div>
            <div className="label-tag">{window.t("common.appliance")}</div>
            <div className="h-display" style={{ fontSize: 13, marginTop: 2 }}>{ent.label.toUpperCase()}</div>
            <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", marginTop: 2 }}>{status.state.toUpperCase()}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>{window.t("common.remaining")}</div>
          <div className="h-display" style={{ fontSize: 22, color: !off ? "var(--accent)" : "var(--text-2)" }}>{time.state}</div>
        </div>
      </div>
    </div>
  );
}

// --- Printer (Bambu A1) ---
function PrinterControl({ ent }) {
  const eta = useEntity(ent.id);
  const stat = useEntity(ent.stateEntity);
  if (!eta || !stat) return null;
  const printing = ["init","pause","prepare","running","slicing"].includes(stat.state);
  return (
    <div className={"tile " + (printing ? "tile--active" : "")} style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="printer" color={printing ? "var(--accent)" : "var(--text-2)"} />
          <div>
            <div className="label-tag">{window.t("zone.printer_3d")}</div>
            <div className="h-display" style={{ fontSize: 13, marginTop: 2 }}>{ent.label.toUpperCase()}</div>
            <div className="t-mono" style={{ fontSize: 9, color: printing ? "var(--accent)" : "var(--text-2)", marginTop: 2 }}>● {stat.state.toUpperCase()}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {printing
            ? (<><div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>{window.t("common.end")}</div>
                 <div className="h-display" style={{ fontSize: 18, color: "var(--accent)" }}>{eta.state}</div></>)
            : (<Tag kind="ok">{stat.state.toUpperCase()}</Tag>)}
        </div>
      </div>
    </div>
  );
}

window.ZoneDetail = ZoneDetail;
