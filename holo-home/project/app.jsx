// HOLO HOME OS — App root.
// Now wraps everything in HAProvider so all panels read live HA-mock state.

function prettyCondition(c) {
  if (!c) return "—";
  const v = window.t("weather." + c);
  // t() returns the key itself when missing — fall back to the raw HA code.
  return v === "weather." + c ? String(c).toUpperCase() : v;
}

const PALETTES = {
  cyan:    { accent: "#00d9ff", deep: "#007a96", soft: "#4be6ff", line: "rgba(0,217,255,0.18)", lineStrong: "rgba(0,217,255,0.55)", glow: "0 0 12px rgba(0,217,255,0.55), 0 0 32px rgba(0,217,255,0.18)" },
  amber:   { accent: "#ffb547", deep: "#b3691a", soft: "#ffd28a", line: "rgba(255,181,71,0.20)", lineStrong: "rgba(255,181,71,0.55)", glow: "0 0 12px rgba(255,181,71,0.55), 0 0 32px rgba(255,181,71,0.18)" },
  green:   { accent: "#4bffb5", deep: "#1a8a5a", soft: "#a8ffd6", line: "rgba(75,255,181,0.18)", lineStrong: "rgba(75,255,181,0.55)", glow: "0 0 12px rgba(75,255,181,0.55), 0 0 32px rgba(75,255,181,0.18)" },
  magenta: { accent: "#ff6dc6", deep: "#9a3a82", soft: "#ffb6e2", line: "rgba(255,109,198,0.20)", lineStrong: "rgba(255,109,198,0.55)", glow: "0 0 12px rgba(255,109,198,0.55), 0 0 32px rgba(255,109,198,0.18)" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "cyan",
  "motion": 1,
  "gridDensity": 28,
  "radarOn": true,
  "tickerOn": true,
  "soundOn": false,
  "skipBoot": false,
  "viewport": "fluid"
}/*EDITMODE-END*/;

function applyPalette(name) {
  const p = PALETTES[name] || PALETTES.cyan;
  const r = document.documentElement.style;
  r.setProperty("--accent", p.accent);
  r.setProperty("--accent-soft", p.soft);
  r.setProperty("--accent-deep", p.deep);
  r.setProperty("--line", p.line);
  r.setProperty("--line-strong", p.lineStrong);
  r.setProperty("--accent-glow", p.glow);
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [booted, setBooted] = useState(tweaks.skipBoot);
  const [configReady, setConfigReady] = useState(!!window.APP_CONFIG);
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    if (configReady) return;
    if (!window.__configReady) {
      setConfigError("config-loader.jsx did not run before app.jsx");
      return;
    }
    window.__configReady
      .then(() => setConfigReady(true))
      .catch((e) => setConfigError(String(e?.message || e)));
  }, [configReady]);

  if (configError) {
    return (
      <div style={{
        position: "fixed", inset: 24, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", color: "var(--danger)", fontSize: 12, whiteSpace: "pre-wrap",
      }}>
        [config] {configError}
      </div>
    );
  }
  if (!configReady) {
    return (
      <>
        <div className="backdrop"></div>
        <BootSequence onComplete={() => {}} />
      </>
    );
  }

  return (
    <>
      <div className="backdrop"></div>
      <div className="orb" style={{ width: 400, height: 400, background: "var(--accent)", top: -100, left: "30%" }}></div>
      <div className="orb" style={{ width: 500, height: 500, background: "var(--accent-deep)", bottom: -150, right: "10%", animationDelay: "5s" }}></div>

      {!booted && <BootSequence onComplete={() => setBooted(true)} />}

      <HAProvider>
        <Shell tweaks={tweaks} setTweak={setTweak} />
      </HAProvider>
    </>
  );
}

// Pulls the next upcoming event across every configured calendar source via
// HA's calendar API (works against both the in-process mock and real HA).
// Polls every 60s so the label stays current as events roll past, and re-runs
// whenever the underlying connection swaps (mock↔real, reconnect after auth).
function useCalendarBadge(ha) {
  const [tick, setTick] = useState(0);
  const [badge, setBadge] = useState({ label: "AGENDA", sub: "TAP TO OPEN" });

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const conn = ha?.conn;
    if (!conn?.listEvents) return;

    const sources = window.HOME_LAYOUT?.calendar?.sources || [];
    if (!sources.length) return;

    let cancelled = false;
    const now = new Date();
    const startISO = new Date(now.getTime() - 60_000).toISOString();
    const endISO   = new Date(now.getTime() + 7 * 86_400_000).toISOString();

    (async () => {
      const events = [];
      for (const s of sources) {
        try {
          const evs = await conn.listEvents(s.entity, startISO, endISO);
          for (const e of (evs || [])) {
            const startMs = new Date(e.start.dateTime || (e.start.date + "T00:00:00")).getTime();
            const endMs   = new Date(e.end.dateTime   || (e.end.date   + "T00:00:00")).getTime();
            if (!Number.isFinite(startMs) || endMs <= now.getTime()) continue;
            events.push({
              startMs, endMs,
              summary: e.summary || "—",
              name: s.name,
              allDay: !!e.start.date,
            });
          }
        } catch (err) {
          console.warn("[topbar] calendar listEvents failed", s.entity, err?.message || err);
        }
      }
      if (cancelled) return;

      if (!events.length) {
        setBadge({ label: window.t("calendar.empty"), sub: window.t("calendar.no_events") });
        return;
      }
      events.sort((a, b) => a.startMs - b.startMs);
      const best = events[0];
      const startD = new Date(best.startMs);
      const todayKey    = new Date(now).toDateString();
      const tomorrowKey = new Date(now.getTime() + 86_400_000).toDateString();
      const evKey       = startD.toDateString();
      const dayTag = evKey === todayKey
        ? window.t("calendar.today")
        : evKey === tomorrowKey
          ? window.t("calendar.tomorrow")
          : window.formatDate(startD, { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
      const when = best.allDay
        ? window.t("calendar.all_day")
        : `${String(startD.getHours()).padStart(2,"0")}:${String(startD.getMinutes()).padStart(2,"0")}`;
      const title = best.summary.length > 14 ? best.summary.slice(0, 14) + "…" : best.summary;
      setBadge({
        label: `${when} · ${title}`,
        sub: `${best.name.toUpperCase()} · ${dayTag}`,
      });
    })();

    return () => { cancelled = true; };
  }, [ha?.conn, tick]);

  return badge;
}

function Shell({ tweaks, setTweak }) {
  const ha = useHA();
  const [activeZoneId, setActiveZoneId] = useState("salon");
  const [currentFloor, setCurrentFloor] = useState(() => window.HOME_LAYOUT.floors?.[0]?.id || "");
  const [openAlert, setOpenAlert] = useState(null);
  const [route, setRoute] = useState("home"); // "home" | "calendar"
  const [weatherOpen, setWeatherOpen] = useState(false);

  // alerts: derived from a few interesting live entities + cam motion
  const alerts = useAlertsFromState();

  const VIEWPORTS = {
    fluid:    { w: null, h: null, label: "Fluid" },
    "1280":   { w: 1280, h: 800,  label: "Lenovo Smart View · 1280×800" },
    "1920":   { w: 1920, h: 1080, label: "1080p · 1920×1080" },
  };
  const vp = VIEWPORTS[tweaks.viewport] || VIEWPORTS.fluid;
  const isTablet = tweaks.viewport === "1280";

  useEffect(() => { applyPalette(tweaks.palette); }, [tweaks.palette]);
  useEffect(() => { document.documentElement.style.setProperty("--motion", String(tweaks.motion)); }, [tweaks.motion]);
  useEffect(() => { document.documentElement.style.setProperty("--grid-density", `${tweaks.gridDensity}px`); }, [tweaks.gridDensity]);
  useEffect(() => { window.__sfx_on = tweaks.soundOn; }, [tweaks.soundOn]);

  // pick floor based on selected zone
  useEffect(() => {
    const z = window.HOME_LAYOUT.zones.find(z => z.id === activeZoneId);
    if (z && z.floor) setCurrentFloor(z.floor);
  }, [activeZoneId]);

  const indoorAvg = useMemo(() => {
    if (!ha) return 0;
    const temps = [];
    for (const [id, s] of ha.states) {
      if (!id.startsWith("climate.")) continue;
      const t = +s.attributes?.current_temperature;
      if (Number.isFinite(t)) temps.push(t);
    }
    if (!temps.length) return 0;
    return temps.reduce((a, b) => a + b, 0) / temps.length;
  }, [ha?.states]);

  // live ticker from HA states
  const tickerItems = useTickerItems();

  const activeZone = window.HOME_LAYOUT.zones.find(z => z.id === activeZoneId);

  // ---- live weather + alarm wiring ----
  const wx = ha?.states?.get(window.HOME_LAYOUT.weatherEntity);
  const outside = ha?.states?.get(window.HOME_LAYOUT.outsideTempEntity);
  const alarmEnt = ha?.states?.get(window.HOME_LAYOUT.alarmEntity);

  // Daily forecast: subscribed live via weather/subscribe_forecasts.
  // forecast[0] is today — used for hi/lo in the topbar and the modal header.
  const dailyForecast = window.useForecast(window.HOME_LAYOUT.weatherEntity, "daily");
  const today = dailyForecast?.[0];
  const tempHigh = today && today.temperature != null ? Math.round(today.temperature) : null;
  const tempLow  = today && (today.templow ?? today.temperature) != null
    ? Math.round(today.templow ?? today.temperature) : null;

  const liveWeather = {
    outside: outside ? Number(outside.state).toFixed(0) : (wx ? Number(wx.attributes.temperature).toFixed(0) : "--"),
    feelsLike: wx ? Math.round(Number(wx.attributes.temperature) - 4) : "--",
    condition: wx ? prettyCondition(wx.state) : "—",
    rawCondition: wx ? wx.state : null,
    wind: wx ? Math.round(Number(wx.attributes.wind_speed || 0)) : 0,
    humidity: wx ? Math.round(Number(wx.attributes.humidity || 0)) : 0,
    tempHigh,
    tempLow,
  };
  const securityArmed = alarmEnt ? String(alarmEnt.state).startsWith("armed") : false;
  const onToggleSecurity = () => {
    const svc = securityArmed ? "alarm_disarm" : "alarm_arm_away";
    window.HA_MOCK.callService("alarm_control_panel", svc, { entity_id: window.HOME_LAYOUT.alarmEntity });
  };

  // ---- calendar badge: live next-up event across all sources ----
  // Queries HA's calendar API over a 7-day window (mock + real both expose
  // conn.listEvents). HA only refreshes calendar.* entity attributes on a
  // ~15min schedule and clamps them to "next event ever", so polling the
  // calendar list here keeps the topbar in step with what's actually next.
  const calendarBadge = useCalendarBadge(ha);

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: vp.w ? "#000" : "transparent",
        overflow: "auto",
      }}>
        <div data-tablet={isTablet ? "1" : undefined} style={{
          position: "relative",
          width: vp.w ? `${vp.w}px` : "100vw",
          height: vp.h ? `${vp.h}px` : "100vh",
          padding: isTablet ? 8 : 12,
          flexShrink: 0,
          outline: vp.w ? "1px solid var(--line-strong)" : "none",
          boxShadow: vp.w ? "0 0 60px rgba(0,217,255,0.18)" : "none",
          display: "grid",
          gridTemplateAreas: `
            "top    top      top"
            "left   center   right"
            "bottom bottom   bottom"
            "ticker ticker   ticker"
          `,
          gridTemplateColumns: isTablet
            ? "minmax(280px, 1fr) minmax(0, 1.4fr) minmax(280px, 1fr)"
            : "minmax(360px, 1.05fr) minmax(0, 1.6fr) minmax(360px, 1.05fr)",
          gridTemplateRows: "auto minmax(0, 1fr) auto auto",
          gap: isTablet ? 8 : 12,
        }}>
          <TopBar
            indoorAvg={indoorAvg}
            zoneCount={window.HOME_LAYOUT.zones.filter(z => !z.hidden).length}
            weather={liveWeather}
            securityArmed={securityArmed}
            onToggleSecurity={onToggleSecurity}
            onOpenCalendar={() => setRoute("calendar")}
            calendarBadge={calendarBadge}
            onOpenWeather={() => setWeatherOpen(true)}
          />

          <div style={{ gridArea: "left", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <ZoneDetail zone={activeZone} />
          </div>

          <div style={{ gridArea: "center", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <FloorPlan
              activeId={activeZoneId}
              onPick={setActiveZoneId}
              radarOn={tweaks.radarOn}
              currentFloor={currentFloor}
              setCurrentFloor={setCurrentFloor}
            />
          </div>

          <div style={{ gridArea: "right", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <SystemsRail alerts={alerts} onAlertClick={(a) => setOpenAlert(a)} />
          </div>

          <div style={{ gridArea: "bottom", display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.6fr) minmax(0, 1fr)", gap: isTablet ? 8 : 12 }}>
            <ScenesPanel />
            <CamerasRow
              cameras={window.HOME_LAYOUT.cameras}
              onCameraClick={(c) => setOpenAlert({ id: "cam_" + c.id, level: "info", text: `Snapshot · ${c.name}`, time: "now", cameraId: c.id })}
            />
            <GarageCard />
          </div>

          <div style={{ gridArea: "ticker" }}>
            {tweaks.tickerOn && <Ticker items={tickerItems} />}
          </div>
        </div>
      </div>

      {vp.w && (
        <div style={{
          position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)",
          zIndex: 2, fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--accent)", letterSpacing: "0.2em",
          padding: "4px 10px", border: "1px solid var(--line)",
          background: "rgba(0,0,0,0.6)", pointerEvents: "none",
        }}>
          ◇ {vp.label.toUpperCase()}
        </div>
      )}

      <HoloTweaks tweaks={tweaks} setTweak={setTweak} />

      {openAlert && (
        <FootageModal
          alert={openAlert}
          camera={window.HOME_LAYOUT.cameras.find(c => c.id === openAlert.cameraId) || window.HOME_LAYOUT.cameras[0]}
          onClose={() => setOpenAlert(null)}
        />
      )}

      {route === "calendar" && (
        <CalendarScreen onClose={() => setRoute("home")} />
      )}

      {weatherOpen && (
        <WeatherModal
          forecast={dailyForecast}
          current={liveWeather}
          onClose={() => setWeatherOpen(false)}
        />
      )}
    </>
  );
}

// ---- derived ticker items from HA state ----
function useTickerItems() {
  const ha = useHA();
  return useMemo(() => {
    const get = (id) => ha?.states?.get(id);
    const out = [];
    const garageHum = get("sensor.garage_humidity");
    if (garageHum) out.push({ label: "GARAGE HUM", value: `${(+garageHum.state).toFixed(0)}%`, k: +garageHum.state > 70 ? "warn" : "ok" });
    const garageT = get("sensor.garage_temperature");
    if (garageT) out.push({ label: "GARAGE T°", value: `${(+garageT.state).toFixed(0)}°C`, k: +garageT.state < 5 ? "" : "ok" });
    const sumpump = get("switch.plug_sumpump");
    if (sumpump) out.push({ label: "SUMPUMP", value: sumpump.state.toUpperCase(), k: sumpump.state === "on" ? "ok" : "warn" });
    const dehum = get("switch.deshumidificateur_sous_sol");
    if (dehum) out.push({ label: window.t("ticker.dehum"), value: dehum.state.toUpperCase(), k: "" });
    const sjHum = get("sensor.sallejeuxtemphumsensor_salle_de_jeux_humidity");
    if (sjHum) out.push({ label: window.t("ticker.playroom_hum"), value: `${sjHum.state}%`, k: "" });
    const dryer = get("sensor.dryer_current_status");
    if (dryer) out.push({ label: window.t("ticker.dryer"), value: dryer.state.toUpperCase(), k: dryer.state === "running" ? "warn" : "" });
    const printer = get("sensor.bambu_lab_a1_etat_de_l_impression");
    if (printer) out.push({ label: "BAMBU A1", value: printer.state.toUpperCase(), k: "" });
    const door = get("cover.gdo_home_door");
    if (door) out.push({ label: window.t("garage.tag"), value: door.state === "open" ? window.t("garage.open") : window.t("garage.closed"), k: door.state === "open" ? "warn" : "ok" });
    const outside = ha?.states?.get(window.HOME_LAYOUT.outsideTempEntity);
    out.push({ label: "OUTSIDE", value: outside ? `${(+outside.state).toFixed(0)}°C` : "--", k: "" });
    out.push({ label: "WS", value: "MOCK · LIVE", k: "ok" });
    return out;
  }, [ha?.states]);
}

// helper for ticker — outside ref
function getOutside(ha) { return ha?.states?.get(window.HOME_LAYOUT.outsideTempEntity); }

function useAlertsFromState() {
  const ha = useHA();
  return useMemo(() => {
    const out = [];
    const garageHum = ha?.states?.get("sensor.garage_humidity");
    if (garageHum && +garageHum.state > 65) {
      out.push({ id: "a_gh", level: "warn", text: window.t("alerts.high_garage_humidity", { pct: (+garageHum.state).toFixed(0) }), time: "now" });
    }
    const door = ha?.states?.get("cover.gdo_home_door");
    if (door?.state === "open") {
      out.push({ id: "a_door", level: "danger", text: window.t("alerts.garage_door_open"), time: "now" });
    }
    const dryer = ha?.states?.get("sensor.dryer_current_status");
    if (dryer?.state === "running") {
      const tEnt = ha?.states?.get("sensor.dryer_remaining_time");
      out.push({ id: "a_dry", level: "info", text: window.t("alerts.dryer_running", { time: tEnt?.state || "—" }), time: "now" });
    }
    // Live camera motion alerts — surface real binary_sensor state.
    for (const cam of window.HOME_LAYOUT.cameras) {
      const m = ha?.states?.get(cam.motionEntity);
      if (m?.state === "on") {
        out.push({ id: "a_cam_" + cam.id, level: "warn", text: window.t("alerts.motion", { name: cam.name }), time: "now", cameraId: cam.id });
      }
      const b = ha?.states?.get(cam.batteryEntity);
      if (cam.battery && b?.state === "on") {
        out.push({ id: "a_bat_" + cam.id, level: "warn", text: window.t("alerts.low_battery", { name: cam.name }), time: "now", cameraId: cam.id });
      }
    }
    return out;
  }, [ha?.states]);
}

function HoloTweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title={window.t("tweaks.title")}>
      <TweakSection title="Viewport">
        <TweakRadio value={tweaks.viewport} onChange={(v) => setTweak("viewport", v)}
          options={[
            { value: "fluid",  label: "Fluid" },
            { value: "1280",  label: "1280×800" },
            { value: "1920",  label: "1920×1080" },
          ]}/>
      </TweakSection>
      <TweakSection title="Palette">
        <TweakRadio value={tweaks.palette} onChange={(v) => setTweak("palette", v)}
          options={[
            { value: "cyan",    label: "Cyan" },
            { value: "amber",   label: "Amber" },
            { value: "green",   label: "Green" },
            { value: "magenta", label: "Magenta" },
          ]}/>
      </TweakSection>
      <TweakSection title="Motion">
        <TweakSlider value={tweaks.motion} onChange={(v) => setTweak("motion", v)} min={0} max={1.5} step={0.05} />
      </TweakSection>
      <TweakSection title="Grid Density">
        <TweakSlider value={tweaks.gridDensity} onChange={(v) => setTweak("gridDensity", v)} min={16} max={56} step={2} unit="px" />
      </TweakSection>
      <TweakSection title="Modules">
        <TweakToggle label="Radar Sweep" value={tweaks.radarOn} onChange={(v) => setTweak("radarOn", v)} />
        <TweakToggle label="Telemetry Ticker" value={tweaks.tickerOn} onChange={(v) => setTweak("tickerOn", v)} />
        <TweakToggle label="Sound FX" value={tweaks.soundOn} onChange={(v) => setTweak("soundOn", v)} />
        <TweakToggle label="Skip Boot Sequence" value={tweaks.skipBoot} onChange={(v) => setTweak("skipBoot", v)} />
      </TweakSection>
      <TweakSection title={window.t("tweaks.ha_connection")}>
        <TweakButton label={window.t("tweaks.reset_token")} onClick={() => window.holohomeClearToken && window.holohomeClearToken()} />
      </TweakSection>
      <TweakSection title="HA Mock">
        <TweakButton label="Toggle garage door" onClick={() => window.HA_MOCK?.callService("cover", "toggle", { entity_id: "cover.gdo_home_door" })} />
        <TweakButton label="Start dryer cycle" onClick={() => {
          window.HA_MOCK?.setState("sensor.dryer_current_status", { state: "running" });
          window.HA_MOCK?.setState("sensor.dryer_remaining_time", { state: "00:34" });
        }} />
        <TweakButton label="Trigger motion (Blink)" onClick={() => {
          window.playBeep && window.playBeep("warn");
        }} />
      </TweakSection>
    </TweaksPanel>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
