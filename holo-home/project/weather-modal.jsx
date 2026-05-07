// HOLO HOME OS — Weather forecast modal.
// Subscribes to weather/subscribe_forecasts via useForecast and shows
// the next five days with condition glyph + hi/lo temps.

function WxGlyph({ condition, size = 28 }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (condition) {
    case "snowy":
    case "snowy-rainy":
      return (<svg {...props} style={{ color: "var(--accent-soft)" }}><path d="M5 18h11a4 4 0 0 0 .5-7.96A6 6 0 0 0 5 11"/><path d="M9 21l.5-.5M12 22v-1M15 21l-.5-.5"/></svg>);
    case "rainy":
    case "pouring":
      return (<svg {...props} style={{ color: "var(--accent)" }}><path d="M5 16h11a4 4 0 0 0 .5-7.96A6 6 0 0 0 5 9"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/></svg>);
    case "cloudy":
      return (<svg {...props} style={{ color: "var(--text-2)" }}><path d="M5 18h11a4 4 0 0 0 .5-7.96A6 6 0 0 0 5 11"/></svg>);
    case "partlycloudy":
      return (<svg {...props} style={{ color: "var(--warn)" }}><circle cx="9" cy="9" r="3"/><path d="M9 4v1M14 9h1M5 9H4M12 6l1-1M5 13l1-1"/><path d="M9 18h8a4 4 0 0 0 .5-7.96"/></svg>);
    case "sunny":
    case "clear-night":
      return (<svg {...props} style={{ color: "var(--warn)" }}><circle cx="12" cy="12" r="4"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6"/></svg>);
    case "windy":
      return (<svg {...props} style={{ color: "var(--text-1)" }}><path d="M3 8h12a3 3 0 1 0-3-3M3 12h17a3 3 0 1 1-3 3M3 16h10"/></svg>);
    case "fog":
      return (<svg {...props} style={{ color: "var(--text-2)" }}><path d="M4 9h16M3 13h18M5 17h14"/></svg>);
    case "lightning":
    case "lightning-rainy":
    case "hail":
      return (<svg {...props} style={{ color: "var(--warn)" }}><path d="M5 16h11a4 4 0 0 0 .5-7.96A6 6 0 0 0 5 9"/><path d="M11 14l-2 4h3l-2 4"/></svg>);
    default:
      return (<svg {...props} style={{ color: "var(--text-2)" }}><circle cx="12" cy="12" r="6"/></svg>);
  }
}

function WeatherModal({ forecast, current, onClose }) {
  const days = useMemo(() => (forecast || []).slice(0, 5), [forecast]);

  const dayLabel = (iso, idx) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return window.t("weather.day_plus", { n: idx });
    if (idx === 0) return window.t("weather.today");
    return window.formatDate(d, { weekday: "long" }).toUpperCase();
  };
  const dateLabel = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return window.formatDate(d, { day: "2-digit", month: "short" }).toUpperCase();
  };

  return ReactDOM.createPortal(
    <div className="modal-back" onClick={onClose}>
      <div
        className="panel panel--glow"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, 92vw)",
          padding: 22,
          display: "flex", flexDirection: "column", gap: 16,
          position: "relative",
        }}
      >
        <CornerBrackets />

        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0, flex: 1 }}>
            <div style={{
              width: 44, height: 44,
              border: "1px solid var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,217,255,0.10)",
              boxShadow: "0 0 14px rgba(0,217,255,0.25)",
              flexShrink: 0,
            }}>
              <WxGlyph condition={current?.rawCondition} size={26} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="label-tag label-tag--accent">{window.t("weather.forecast")}</div>
              <div className="h-display" style={{ fontSize: 18, color: "var(--text-0)", letterSpacing: "0.14em", marginTop: 4, textShadow: "0 0 10px rgba(0,217,255,0.3)" }}>
                {current?.condition || "—"} · {current?.outside}°C
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", marginTop: 6, letterSpacing: "0.2em" }}>
                <Icon name="wind" size={10} /> {current?.wind} KM/H · <Icon name="humid" size={10} /> {current?.humidity}%
              </div>
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Icon name="x" size={12} /> {window.t("common.close")}
          </button>
        </div>

        {/* 5-day grid */}
        {days.length === 0 ? (
          <div className="t-mono" style={{ fontSize: 12, color: "var(--text-2)", padding: "32px 0", textAlign: "center", letterSpacing: "0.2em" }}>
            {window.t("weather.loading")}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 10 }}>
            {days.map((d, i) => {
              const hi = d.temperature == null ? null : Math.round(d.temperature);
              const lo = (d.templow ?? d.temperature) == null ? null : Math.round(d.templow ?? d.temperature);
              const isToday = i === 0;
              return (
                <div key={d.datetime || i} style={{
                  border: `1px solid ${isToday ? "var(--accent)" : "var(--line)"}`,
                  background: isToday ? "rgba(0,217,255,0.07)" : "rgba(0,0,0,0.3)",
                  boxShadow: isToday ? "0 0 14px rgba(0,217,255,0.18)" : "none",
                  padding: "14px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                }}>
                  <div className="t-mono" style={{ fontSize: 10, color: isToday ? "var(--accent)" : "var(--text-1)", letterSpacing: "0.22em" }}>
                    {dayLabel(d.datetime, i)}
                  </div>
                  <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", letterSpacing: "0.18em", marginTop: -4 }}>
                    {dateLabel(d.datetime)}
                  </div>
                  <WxGlyph condition={d.condition} size={36} />
                  <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", letterSpacing: "0.18em", marginTop: -2 }}>
                    {prettyCondition(d.condition)}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                    <span className="h-display" style={{ fontSize: 22, color: "var(--text-0)", lineHeight: 1, textShadow: "0 0 8px rgba(0,217,255,0.25)" }}>
                      {hi == null ? "--" : hi}°
                    </span>
                    <span className="t-mono" style={{ fontSize: 13, color: "var(--text-2)" }}>
                      {lo == null ? "--" : lo}°
                    </span>
                  </div>
                  <div className="t-mono" style={{ fontSize: 8, color: "var(--text-2)", letterSpacing: "0.2em", marginTop: -4 }}>
                    MAX · MIN
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* footer note */}
        <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", letterSpacing: "0.15em", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          ⓘ SOURCE · {window.HOME_LAYOUT?.weatherEntity || "weather.*"} · WEATHER/SUBSCRIBE_FORECASTS
        </div>
      </div>
    </div>,
    document.body
  );
}

window.WeatherModal = WeatherModal;
