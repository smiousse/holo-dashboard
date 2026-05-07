// HOLO HOME OS — Camera snapshot modal.
// Blink does NOT support live video — we show the latest snapshot only,
// with a manual RE-TRIGGER button to fetch a fresh one (~3s).

function FootageModal({ alert, camera, onClose }) {
  const ha       = useHA();
  const camEnt   = useEntity(camera.id);
  const motion   = useEntity(camera.motionEntity);
  const battery  = useEntity(camera.batteryEntity);
  const signal   = useEntity(camera.signalEntity);
  const armed    = useEntity(camera.armSwitch);
  const temp     = useEntity(camera.tempEntity);

  const [refreshing, setRefreshing] = useState(false);

  const motionOn = motion?.state === "on";
  const lowBat   = battery?.state === "on";
  const armedOn  = armed?.state === "on";

  const snapshotToken = camEnt?.attributes?._snapshot_token || 0;
  const snapshotUrl   = useMemo(
    () => ha?.resolveSnapshot ? ha.resolveSnapshot(camera.id) : null,
    [ha, camera.id, snapshotToken]
  );

  const lastRecord = camEnt?.attributes?.last_record;
  const ago        = useRelativeTime(lastRecord);
  const lastUpdated = useRelativeTime(camEnt?.attributes?._snapshot_token
    ? new Date(+camEnt.attributes._snapshot_token).toISOString()
    : camEnt?.last_updated);

  const triggerNow = () => {
    if (!ha) return;
    window.playBeep("tap");
    setRefreshing(true);
    ha.callService("blink", "trigger_camera", { entity_id: camera.id });
    setTimeout(() => setRefreshing(false), 3000);
  };

  const toggleArm = () => {
    if (!ha) return;
    window.playBeep(armedOn ? "off" : "on");
    ha.callService("switch", "toggle", { entity_id: camera.armSwitch });
  };

  const bars = signalToBars(signal?.state, camera.signalKind);

  // Modal must portal to body — the parent panel uses backdrop-filter,
  // which creates a containing block for position:fixed and breaks coverage.
  return ReactDOM.createPortal(
    <div className="modal-back" onClick={onClose}>
      <div
        className="panel panel--glow"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(960px, 90vw)",
          padding: 20,
          display: "flex", flexDirection: "column", gap: 14,
          position: "relative",
        }}
      >
        <CornerBrackets />

        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0, flex: 1 }}>
            <div style={{
              width: 44, height: 44,
              border: `1px solid ${motionOn ? "var(--warn)" : "var(--accent)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: motionOn ? "rgba(255,181,71,0.12)" : "rgba(0,217,255,0.10)",
              boxShadow: `0 0 14px ${motionOn ? "rgba(255,181,71,0.3)" : "rgba(0,217,255,0.25)"}`,
              flexShrink: 0,
            }}>
              <Icon name="cam" color={motionOn ? "var(--warn)" : "var(--accent)"} size={22} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="label-tag" style={{ color: motionOn ? "var(--warn)" : "var(--accent)" }}>
                {motionOn ? window.t("footage.motion_detected") : (armedOn ? window.t("footage.armed") : window.t("footage.disarmed"))}
              </div>
              <div className="h-display" style={{ fontSize: 18, color: "var(--text-0)", letterSpacing: "0.14em", marginTop: 4, textShadow: "0 0 10px rgba(0,217,255,0.3)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {camera.name?.toUpperCase()}
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", marginTop: 6, letterSpacing: "0.2em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {camera.id} · {camera.type?.toUpperCase()}
              </div>
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Icon name="x" size={12} /> CLOSE
          </button>
        </div>

        {/* snapshot panel */}
        <div style={{
          position: "relative", aspectRatio: "16/9", overflow: "hidden",
          border: motionOn ? "1px solid var(--warn)" : "1px solid var(--line)",
          background: "#04080d",
          boxShadow: motionOn ? "0 0 22px rgba(255,181,71,0.35), inset 0 0 30px rgba(255,181,71,0.08)" : "inset 0 0 30px rgba(0,217,255,0.05)",
        }}>
          {snapshotUrl ? (
            <img src={snapshotUrl} alt={camera.name}
                 style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: armedOn ? "none" : "grayscale(0.6) brightness(0.5)" }}/>
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontFamily: "var(--font-mono)", fontSize: 14 }}>
              NO SNAPSHOT AVAILABLE
            </div>
          )}

          {/* refresh shimmer */}
          {refreshing && (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(0,217,255,0.25) 50%, transparent 100%)", animation: "snapshot-shimmer 1.5s ease-in-out infinite", pointerEvents: "none" }}/>
          )}

          {/* HUD overlay — minimal, no fake live indicators */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: "var(--font-mono)", fontSize: 10 }}>
            <div style={{ position: "absolute", top: 10, left: 12, color: motionOn ? "var(--warn)" : "var(--accent)", letterSpacing: "0.18em", textShadow: "0 0 4px currentColor, 0 0 3px black" }}>
              {motionOn ? "◆ MOTION" : "◇ STILL"}
            </div>
            <div style={{ position: "absolute", top: 10, right: 12, color: "var(--text-1)", letterSpacing: "0.18em", textShadow: "0 0 3px black" }}>
              SNAPSHOT · {lastUpdated || "—"} ago
            </div>
            <div style={{ position: "absolute", bottom: 10, left: 12, color: "var(--text-2)", letterSpacing: "0.15em", textShadow: "0 0 3px black" }}>
              BLINK · {camera.type?.toUpperCase()} · NO LIVE FEED
            </div>
            <div style={{ position: "absolute", bottom: 10, right: 12, color: "var(--text-2)", letterSpacing: "0.15em", textShadow: "0 0 3px black" }}>
              {new Date().toISOString().slice(11, 19)}
            </div>
            {/* corner brackets */}
            {[[0,0,1,1],[100,0,-1,1],[0,100,1,-1],[100,100,-1,-1]].map(([x,y,dx,dy], i) => (
              <svg key={i} viewBox="0 0 10 10" style={{ position: "absolute", left: `calc(${x}% - ${x === 100 ? 14 : -4}px)`, top: `calc(${y}% - ${y === 100 ? 14 : -4}px)`, width: 14, height: 14 }}>
                <path d={`M0 ${dy>0?0:10} L0 ${5+dy*-3} M0 ${dy>0?0:10} L${5+dx*-3} ${dy>0?0:10}`} stroke="var(--accent)" strokeWidth="1" fill="none"/>
              </svg>
            ))}
          </div>
        </div>

        {/* meta + actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) auto", gap: 10, alignItems: "stretch" }}>
          <MetaCell
            label={window.t("footage.battery")}
            value={camera.battery ? (lowBat ? window.t("footage.battery_low") : window.t("footage.battery_ok")) : window.t("footage.battery_wired")}
            k={lowBat ? "danger" : "ok"} />
          <MetaCell
            label={camera.signalKind === "sync" ? window.t("footage.signal_sync") : window.t("footage.signal_wifi")}
            value={bars != null
              ? (camera.signalKind === "wifi"
                  ? window.t("footage.dbm_bars", { dbm: signal?.state, bars })
                  : window.t("footage.bars", { val: signal?.state || bars }))
              : "—"}
            k={bars != null ? (bars >= 3 ? "ok" : bars >= 2 ? "warn" : "danger") : "info"} />
          <MetaCell
            label={window.t("footage.temp")}
            value={temp?.state && temp.state !== "unknown" ? `${(+temp.state).toFixed(0)} °C` : "—"} />
          <MetaCell
            label={window.t("footage.last_clip")}
            value={ago ? window.t("footage.ago", { ago }) : "—"} />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn" onClick={toggleArm}>
              {armedOn ? window.t("footage.disarm") : window.t("footage.arm")}
            </button>
            <button className={"btn btn--active " + (refreshing ? "" : "")}
                    onClick={triggerNow} disabled={refreshing}>
              {refreshing ? window.t("footage.triggering") : window.t("footage.retrigger")}
            </button>
            <button className="btn" onClick={onClose}>{window.t("common.close")}</button>
          </div>
        </div>

        {/* helper note */}
        <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", letterSpacing: "0.15em", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          {window.t("footage.note")}
        </div>
      </div>
    </div>,
    document.body
  );
}

function MetaCell({ label, value, k }) {
  const color = k === "warn" ? "var(--warn)" : k === "danger" ? "var(--danger)" : k === "ok" ? "var(--ok)" : "var(--accent)";
  return (
    <div style={{ borderLeft: `1px solid ${color}`, padding: "6px 12px", background: "rgba(0,0,0,0.3)" }}>
      <div className="label-tag">{label}</div>
      <div className="t-mono" style={{ fontSize: 13, color: "var(--text-0)", marginTop: 3 }}>{value}</div>
    </div>
  );
}

window.FootageModal = FootageModal;
