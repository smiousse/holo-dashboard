// HOLO HOME OS — Top bar (stardate clock + always-visible vitals + weather)

function TopBar({ indoorAvg, zoneCount, weather, securityArmed, onToggleSecurity, onOpenCalendar, calendarBadge, onOpenWeather }) {
  const { time, date, stardate } = useStardate();
  const data = { zones: { length: zoneCount }, weather };

  return (
    <div className="panel panel--glow" style={{
      gridArea: "top",
      display: "grid",
      gridTemplateColumns: "auto 1fr auto auto auto auto auto auto",
      alignItems: "stretch",
      gap: 0,
      padding: 0,
      height: 92,
    }}>
      <CornerBrackets />

      {/* identity */}
      <div style={{ padding: "12px 22px", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid var(--line)", minWidth: 240 }}>
        <div className="h-display" style={{ fontSize: 22, color: "var(--text-0)", lineHeight: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--accent)", boxShadow: "0 0 10px var(--accent)", transform: "rotate(45deg)" }}></span>
          HOLO HOME
        </div>
        <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", marginTop: 6, letterSpacing: "0.3em" }}>
          {window.t("topbar.residence")}
        </div>
      </div>

      {/* clock */}
      <div style={{ padding: "10px 22px", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <div className="t-mono" style={{ fontSize: 38, color: "var(--text-0)", letterSpacing: "0.06em", lineHeight: 1, textShadow: "0 0 14px rgba(0,217,255,0.35)" }}>{time}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", letterSpacing: "0.25em" }}>{window.t("topbar.stardate")}</div>
            <div className="t-mono" style={{ fontSize: 14, color: "var(--accent)", letterSpacing: "0.1em", textShadow: "0 0 6px rgba(0,217,255,0.5)" }}>{stardate}</div>
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", marginTop: 6, letterSpacing: "0.25em" }}>{date} · {window.t("topbar.operator")}</div>
      </div>

      {/* indoor */}
      <Vital label={window.t("topbar.indoor")} value={indoorAvg.toFixed(0)} unit="°C" sub={window.t("topbar.avg_zones", { count: data.zones.length })} />
      {/* outdoor */}
      <Vital label={window.t("topbar.outdoor")} value={data.weather.outside} unit="°C" sub={window.t("topbar.feels", { temp: data.weather.feelsLike })} accent />
      {/* condition */}
      <div
        onClick={() => { window.playBeep("tap"); onOpenWeather && onOpenWeather(); }}
        style={{ padding: "12px 18px", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid var(--line)", minWidth: 180, cursor: onOpenWeather ? "pointer" : "default" }}
      >
        <div className="label-tag">{window.t("common.condition")}</div>
        <div className="h-display" style={{ fontSize: 18, marginTop: 4 }}>{data.weather.condition.toUpperCase()}</div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", marginTop: 4, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "var(--text-1)" }}>
            <span style={{ color: "var(--accent)" }}>↑{data.weather.tempHigh ?? "--"}°</span>
            <span style={{ margin: "0 4px", color: "var(--text-2)" }}>·</span>
            <span style={{ color: "var(--accent-soft)" }}>↓{data.weather.tempLow ?? "--"}°</span>
          </span>
        </div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", marginTop: 3, display: "flex", gap: 12 }}>
          <span><Icon name="wind" size={11} /> {data.weather.wind} KM/H</span>
          <span><Icon name="humid" size={11} /> {data.weather.humidity}%</span>
        </div>
      </div>

      {/* calendrier */}
      <div
        onClick={() => { window.playBeep("on"); onOpenCalendar && onOpenCalendar(); }}
        style={{ padding: "12px 18px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 170, cursor: "pointer", background: "rgba(0,217,255,0.05)", borderRight: "1px solid var(--line)" }}
      >
        <div className="label-tag label-tag--accent" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PulseDot /> {window.t("topbar.calendar")}
        </div>
        <div className="h-display" style={{ fontSize: 18, marginTop: 4, color: "var(--accent)", textShadow: "0 0 8px rgba(0,217,255,0.4)" }}>
          {calendarBadge?.label || window.t("topbar.agenda")}
        </div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", marginTop: 4, letterSpacing: "0.18em" }}>
          {calendarBadge?.sub || window.t("topbar.tap_open")}
        </div>
      </div>

      {/* security */}
      <div
        onClick={() => { window.playBeep(securityArmed ? "off" : "on"); onToggleSecurity(); }}
        style={{ padding: "12px 18px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 170, cursor: "pointer", background: securityArmed ? "rgba(75, 255, 181, 0.06)" : "rgba(255, 74, 107, 0.06)" }}
      >
        <div className="label-tag" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PulseDot kind={securityArmed ? "ok" : "danger"} /> {window.t("topbar.security")}
        </div>
        <div className="h-display" style={{ fontSize: 18, marginTop: 4, color: securityArmed ? "var(--ok)" : "var(--danger)", textShadow: securityArmed ? "0 0 8px rgba(75,255,181,0.4)" : "0 0 8px rgba(255,74,107,0.4)" }}>
          {securityArmed ? window.t("topbar.armed") : window.t("topbar.disarmed")}
        </div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", marginTop: 4 }}>
          {securityArmed ? window.t("topbar.tap_disarm") : window.t("topbar.tap_arm")}
        </div>
      </div>
    </div>
  );
}

function Vital({ label, value, unit, sub, accent }) {
  return (
    <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid var(--line)", minWidth: 130 }}>
      <div className="label-tag">{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
        <div className="h-display" style={{ fontSize: 28, color: accent ? "var(--accent)" : "var(--text-0)", lineHeight: 1, textShadow: accent ? "0 0 8px rgba(0,217,255,0.4)" : "none" }}>{value}</div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--text-2)" }}>{unit}</div>
      </div>
      <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", marginTop: 4, letterSpacing: "0.2em" }}>{sub}</div>
    </div>
  );
}

window.TopBar = TopBar;
