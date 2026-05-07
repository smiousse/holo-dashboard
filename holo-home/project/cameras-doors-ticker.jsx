// HOLO HOME OS — Cameras (Blink), garage doors, ticker
//
// The Blink HA integration does NOT support live video — only the latest
// snapshot JPEG (served at /api/camera_proxy/<entity_id>?token=...).
// To preserve battery: NO automatic polling. Snapshots refresh only when
//   (a) the user clicks a camera (fires `blink.trigger_camera`)
//   (b) the user clicks REFRESH ALL (fires `script.refresh_cameras_maison`)
//   (c) the camera reports motion (the snapshot updates "for free")

function CamerasRow({ cameras, onCameraClick }) {
  const ha = useHA();
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = () => {
    if (!ha) return;
    window.playBeep("tap");
    setRefreshing(true);
    ha.callService("script", "turn_on", { entity_id: HOME_LAYOUT.refreshCamerasScript });
    setTimeout(() => setRefreshing(false), 3000);
  };

  return (
    <div className="panel panel--glow" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
      <CornerBrackets />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="label-tag label-tag--accent">{window.t("cameras.header")}</span>
          <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>
            {window.t("cameras.snapshots_only")}
          </span>
        </div>
        <button
          className={"btn " + (refreshing ? "btn--active" : "")}
          onClick={refreshAll}
          disabled={refreshing}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9 }}
          title={window.t("cameras.refresh_title")}
        >
          <Icon name="cam" size={11} />
          {refreshing ? window.t("cameras.refreshing") : window.t("cameras.refresh")}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cameras.length}, 1fr)`, gap: 8 }}>
        {cameras.map(c => <CameraTile key={c.id} cam={c} onClick={() => onCameraClick(c)} />)}
      </div>
    </div>
  );
}

function CameraTile({ cam, onClick }) {
  const ha       = useHA();
  const camEnt   = useEntity(cam.id);
  const motion   = useEntity(cam.motionEntity);
  const battery  = useEntity(cam.batteryEntity);
  const signal   = useEntity(cam.signalEntity);
  const armed    = useEntity(cam.armSwitch);

  const [refreshing, setRefreshing] = useState(false);

  const motionOn = motion?.state === "on";
  const lowBat   = battery?.state === "on";   // battery binary_sensor: on = LOW
  const armedOn  = armed?.state === "on";

  // Snapshot URL — re-resolves whenever the entity's _snapshot_token changes
  const snapshotToken = camEnt?.attributes?._snapshot_token || 0;
  const snapshotUrl   = useMemo(
    () => ha?.resolveSnapshot ? ha.resolveSnapshot(cam.id) : null,
    [ha, cam.id, snapshotToken]
  );

  // Last record timestamp
  const lastRecord = camEnt?.attributes?.last_record;
  const ago = useRelativeTime(lastRecord);

  const handleClick = () => {
    window.playBeep("tap");
    if (ha && armedOn) {
      setRefreshing(true);
      ha.callService("blink", "trigger_camera", { entity_id: cam.id });
      setTimeout(() => setRefreshing(false), 3000);
    }
    onClick();
  };

  // Signal strength bars
  const bars = signalToBars(signal?.state, cam.signalKind);

  return (
    <div className="tile"
         onClick={handleClick}
         style={{ padding: 0, position: "relative", aspectRatio: "16/10", overflow: "hidden", cursor: "pointer", border: motionOn ? "1px solid var(--warn)" : undefined, boxShadow: motionOn ? "0 0 14px rgba(255,181,71,0.4)" : undefined }}>

      {/* snapshot */}
      {snapshotUrl ? (
        <img src={snapshotUrl} alt={cam.name}
             style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: armedOn ? "none" : "grayscale(0.6) brightness(0.5)" }}/>
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "#0a1218", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontSize: 9, fontFamily: "var(--font-mono)" }}>
          NO SNAPSHOT
        </div>
      )}

      {/* refresh shimmer */}
      {refreshing && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(0,217,255,0.25) 50%, transparent 100%)", animation: "snapshot-shimmer 1.5s ease-in-out infinite", pointerEvents: "none" }}/>
      )}

      {/* HUD overlay */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 6, fontFamily: "var(--font-mono)", fontSize: 8, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.65) 100%)" }}>
        {/* top row: status + signal/battery */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
          <span style={{ color: armedOn ? (motionOn ? "var(--warn)" : "var(--accent)") : "var(--text-2)", textShadow: "0 0 4px currentColor, 0 0 3px black", letterSpacing: "0.1em", fontWeight: 600 }}>
            {motionOn ? "◆ MOTION" : (armedOn ? "● ARMED" : "○ DISARMED")}
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {cam.battery && (
              <span style={{ color: lowBat ? "var(--danger)" : "var(--ok)", textShadow: "0 0 3px black", letterSpacing: "0.05em" }}>
                {lowBat ? "⚡LOW" : "⚡OK"}
              </span>
            )}
            {bars != null && <SignalBars bars={bars} />}
          </div>
        </div>

        {/* bottom row: name + last seen */}
        <div>
          <div style={{ color: "var(--text-0)", fontSize: 10, letterSpacing: "0.08em", textShadow: "0 0 3px black", fontWeight: 600 }}>
            {cam.shortName || cam.name}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)", marginTop: 1, letterSpacing: "0.1em", textShadow: "0 0 3px black" }}>
            <span>{cam.type?.toUpperCase()}</span>
            <span>{ago || "—"}</span>
          </div>
        </div>
      </div>

      {/* corner ticks */}
      <span style={{ position: "absolute", top: 0, left: 0, width: 8, height: 8, borderTop: "1px solid var(--accent)", borderLeft: "1px solid var(--accent)" }}></span>
      <span style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, borderTop: "1px solid var(--accent)", borderRight: "1px solid var(--accent)" }}></span>
      <span style={{ position: "absolute", bottom: 0, left: 0, width: 8, height: 8, borderBottom: "1px solid var(--accent)", borderLeft: "1px solid var(--accent)" }}></span>
      <span style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderBottom: "1px solid var(--accent)", borderRight: "1px solid var(--accent)" }}></span>
    </div>
  );
}

// Wifi dBm or 1-4 bars sync_signal_strength → 0..4 bars
function signalToBars(val, kind) {
  if (val == null || val === "unknown" || val === "unavailable") return null;
  if (kind === "sync") {
    const n = Math.max(0, Math.min(4, Math.round(+val || 0)));
    return n;
  }
  if (kind === "wifi") {
    const dBm = +val;
    if (Number.isNaN(dBm)) return null;
    if (dBm >= -55) return 4;
    if (dBm >= -65) return 3;
    if (dBm >= -75) return 2;
    if (dBm >= -85) return 1;
    return 0;
  }
  return null;
}

function SignalBars({ bars }) {
  const color = bars >= 3 ? "var(--ok)" : bars >= 2 ? "var(--warn)" : "var(--danger)";
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1, height: 8 }}>
      {[1,2,3,4].map(n => (
        <span key={n} style={{ display: "inline-block", width: 2, height: n*2, background: n <= bars ? color : "rgba(255,255,255,0.18)", boxShadow: n <= bars ? "0 0 3px black" : "none" }}/>
      ))}
    </span>
  );
}

// "12s", "4m", "2h", "3d" — relative time without external libs
function useRelativeTime(iso) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setT(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

function GarageCard() {
  const door  = useEntity("cover.gdo_home_door");
  const hum   = useEntity("sensor.garage_humidity");
  const temp  = useEntity("sensor.garage_temperature");
  const { toggleCover } = useEntityActions("cover.gdo_home_door");
  const open = door?.state === "open";
  const fmtInt = (s) => { const n = +s; return Number.isFinite(n) ? String(Math.round(n)) : (s || "—"); };

  return (
    <div className="panel panel--glow" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <CornerBrackets />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
        <span className="label-tag label-tag--accent">{window.t("cameras.garage")}</span>
        <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>cover.gdo_home_door</span>
      </div>
      <div className={"tile " + (open ? "tile--active" : "")} style={{ padding: 10, cursor: "pointer" }}
           onClick={() => { window.playBeep(open ? "off" : "on"); toggleCover(); }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Icon name="garage-cover" color={open ? "var(--warn)" : "var(--accent)"} size={20}/>
          <Tag kind={open ? "warn" : "ok"}>{open ? window.t("common.open") : window.t("common.closed")}</Tag>
        </div>
        <div className="h-display" style={{ fontSize: 12 }}>{window.t("cameras.garage_door")}</div>
        <div style={{ marginTop: 8, height: 4, background: "rgba(0,0,0,0.4)", border: "1px solid var(--line)", position: "relative" }}>
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: 0,
            width: open ? "100%" : "8%",
            background: open ? "var(--warn)" : "var(--accent)",
            boxShadow: "0 0 8px currentColor",
            transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
          }}/>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="tile" style={{ padding: 8 }}>
          <div className="label-tag" style={{ fontSize: 8 }}>{window.t("common.humidity")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
            <span className="h-display" style={{ fontSize: 18, color: hum && +hum.state > 70 ? "var(--warn)" : "var(--ok)" }}>{fmtInt(hum?.state)}</span>
            <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>%</span>
          </div>
        </div>
        <div className="tile" style={{ padding: 8 }}>
          <div className="label-tag" style={{ fontSize: 8 }}>{window.t("footage.temp")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
            <span className="h-display" style={{ fontSize: 18, color: temp && +temp.state < 5 ? "var(--accent)" : "var(--text-0)" }}>{fmtInt(temp?.state)}</span>
            <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)" }}>°C</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Ticker ---
function Ticker({ items }) {
  return (
    <div className="panel" style={{ height: 36, display: "flex", alignItems: "center", padding: "0 12px", gap: 12, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase" }}>
      <span className="label-tag label-tag--accent" style={{ flexShrink: 0 }}>{window.t("ticker.telemetry")}</span>
      <div className="ticker" style={{ flex: 1 }}>
        <div className="ticker__track">
          {[...items, ...items].map((t, i) => (
            <span key={i} style={{ color: t.k === "warn" ? "var(--warn)" : t.k === "ok" ? "var(--ok)" : "var(--text-1)" }}>
              <span style={{ color: "var(--text-2)" }}>{t.label}</span>{" "}
              <span style={{ color: "var(--accent)" }}>›</span>{" "}
              {t.value}
            </span>
          ))}
        </div>
      </div>
      <span className="t-mono" style={{ flexShrink: 0, color: "var(--text-2)", fontSize: 9 }}>UPLINK · 138 ms</span>
    </div>
  );
}

window.CamerasRow = CamerasRow;
window.CameraTile = CameraTile;
window.GarageCard = GarageCard;
window.Ticker = Ticker;
window.useRelativeTime = useRelativeTime;
window.signalToBars = signalToBars;
window.SignalBars = SignalBars;
