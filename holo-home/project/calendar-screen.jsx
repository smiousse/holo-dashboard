// HOLO HOME OS — Full-screen "CALENDRIER" route.
// Mirrors the user's Home Assistant week-planner-card config (data.jsx > HOME_LAYOUT.calendar)
// but reskinned in the holo visual language. Pulls events directly from the
// in-process HA mock via window.HA_MOCK.listEvents().

(function () {
  // Lazy view of HOME_LAYOUT.calendar — config-loader.jsx is async, so the
  // global isn't set when this IIFE evaluates. Proxy resolves every read at
  // access time, by which point App has gated render on __configReady.
  const CAL = new Proxy({}, {
    get(_t, prop) { return window.HOME_LAYOUT?.calendar?.[prop]; },
    has(_t, prop) { return prop in (window.HOME_LAYOUT?.calendar || {}); },
  });

  // Brighten the YAML colors so they stay readable on dark holo bg.
  // The originals are dark navy/forest/etc — fine on a light card, too low-contrast on black.
  function brighten(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lift = (v) => Math.min(255, Math.round(v + (255 - v) * 0.55));
    r = lift(r); g = lift(g); b = lift(b);
    return `rgb(${r},${g},${b})`;
  }
  function withAlpha(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // ---- date utils ----
  const MS = 86400000;
  function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  function addDays(d, n)  { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function sameYMD(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  // Locale-driven day/month names via Intl. Sunday-indexed (0..6) to match getDay().
  const __sun = new Date(2026, 0, 4); // 2026-01-04 is a Sunday
  const __wkShort = new Intl.DateTimeFormat(window.LANG || "en-CA", { weekday: "short" });
  const __wkLong  = new Intl.DateTimeFormat(window.LANG || "en-CA", { weekday: "long" });
  const __moLong  = new Intl.DateTimeFormat(window.LANG || "en-CA", { month: "long" });
  const WEEKDAYS_FR = Array.from({ length: 7 }, (_, i) => { const d = new Date(__sun); d.setDate(d.getDate()+i); return __wkShort.format(d); });
  const WEEKDAYS_FR_LONG = Array.from({ length: 7 }, (_, i) => { const d = new Date(__sun); d.setDate(d.getDate()+i); return __wkLong.format(d); });
  const MONTHS_FR = Array.from({ length: 12 }, (_, i) => __moLong.format(new Date(2026, i, 1)));

  function fmtTime(iso) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  // Maps any localized view label to a canonical key. Required because the mock
  // ships EN options by default ("Month") and only swaps to FR ("Mois") when
  // APP_CONFIG.language === "fr". Switch sites below use vk() to stay agnostic.
  const VIEW_KEY = {
    "Today": "today", "Tomorrow": "tomorrow", "Week": "week",
    "2 Weeks": "2weeks", "Month": "month", "2 Months": "2months",
    "Aujourd'hui": "today", "Demain": "tomorrow", "Semaine": "week",
    "2 Semaines": "2weeks", "Mois": "month", "2 Mois": "2months",
  };
  const VIEW_DAYS = { today: 1, tomorrow: 2, week: 7, "2weeks": 14, month: 28, "2months": 56 };
  function vk(view) { return VIEW_KEY[view] || "month"; }

  // ---- selected view → canonical key (locale-agnostic) ----
  // Config viewOptions / input_select state may be EN ("Month") or FR ("Mois"),
  // depending on APP_CONFIG.language and the mock's localizeMock overlay. All
  // switch logic routes through vk() so labels can change freely.
  function viewToDays(view) {
    return CAL.viewDays?.[view] ?? VIEW_DAYS[vk(view)] ?? 28;
  }

  // ============================================================
  // Main screen
  // ============================================================
  function CalendarScreen({ onClose }) {
    const ha = useHA();

    // ---- view selector (persisted in localStorage; mirrored to input_select.calendar_view) ----
    // Precedence: localStorage > HA input_select > "Mois". HA still gets the write so server-side
    // automations stay in sync, but the UI no longer waits on (or follows) HA on reload.
    const viewState = ha?.states?.get(CAL.viewEntity);
    const [view, setView] = useState(() => {
      try {
        const saved = localStorage.getItem("__holo_calendar_view");
        if (saved && CAL.viewOptions.includes(saved)) return saved;
      } catch {}
      return viewState?.state || window.t("calendar.fallback_view");
    });
    function pickView(v) {
      setView(v);
      try { localStorage.setItem("__holo_calendar_view", v); } catch {}
      ha?.callService("input_select", "select_option", { entity_id: CAL.viewEntity }, { option: v });
      window.playBeep("tap");
    }

    // ---- person filter chips ----
    // toggling OFF a person sets a "EXCLUDE_ALL" sentinel into their filter input,
    // mirroring the HA week-planner-card filter mechanism.
    const [activeIds, setActiveIds] = useState(() => new Set(CAL.sources.map(s => s.id)));
    function togglePerson(id) {
      setActiveIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        // mirror to the corresponding input_text.* (sentinel non-empty = filtered out)
        const src = CAL.sources.find(s => s.id === id);
        if (src) {
          ha?.callService("input_text", "set_value",
            { entity_id: src.filterEntity },
            { value: next.has(id) ? "" : "__hidden__" });
        }
        window.playBeep("tap");
        return next;
      });
    }
    const allActive  = activeIds.size === CAL.sources.length;
    const noneActive = activeIds.size === 0;
    function selectAll(on) {
      const next = on ? new Set(CAL.sources.map(s => s.id)) : new Set();
      setActiveIds(next);
      for (const s of CAL.sources) {
        ha?.callService("input_text", "set_value",
          { entity_id: s.filterEntity },
          { value: on ? "" : "__hidden__" });
      }
      window.playBeep(on ? "on" : "off");
    }

    // ---- range anchor (today by default) ----
    const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
    const days = viewToDays(view);

    // ---- composer state ----
    const [composer, setComposer] = useState(null); // null | { date }
    const [refreshTick, setRefreshTick] = useState(0);

    // For Mois/2 Mois we snap to a calendar grid that starts on Sunday
    // covering the displayed days. For Aujourd'hui/Demain/Semaine/2 Sem we just
    // start at the anchor.
    const grid = useMemo(() => buildGrid(anchor, days, view), [anchor, days, view]);

    // ---- events: pull from HA conn (real or mock) for active calendars across the grid window ----
    const [events, setEvents] = useState({}); // entity_id -> events[]
    useEffect(() => {
      if (grid.cells.length === 0 || !ha?.conn?.listEvents) return;
      const startISO = grid.cells[0].date.toISOString();
      const endISO   = addDays(grid.cells[grid.cells.length-1].date, 1).toISOString();
      let cancelled = false;
      (async () => {
        const out = {};
        for (const src of CAL.sources) {
          let evs = [];
          try {
            evs = await ha.conn.listEvents(src.entity, startISO, endISO);
          } catch (err) {
            console.warn(`[calendar] listEvents failed for ${src.entity}:`, err?.message || err);
          }
          if (!Array.isArray(evs)) evs = [];
          out[src.entity] = evs.map(e => ({
            ...e,
            sourceId: src.id,
            color: src.color,
            personName: src.name,
            _start: new Date(e.start.dateTime || (e.start.date + "T00:00:00")).getTime(),
            _end:   new Date(e.end.dateTime   || (e.end.date   + "T00:00:00")).getTime(),
            allDay: !!e.start.date,
          }));
        }
        if (!cancelled) setEvents(out);
      })();
      return () => { cancelled = true; };
    }, [grid, view, refreshTick, ha?.conn]);

    // index events by YMD
    const byDay = useMemo(() => {
      const out = {};
      for (const src of CAL.sources) {
        if (!activeIds.has(src.id)) continue;
        const list = events[src.entity] || [];
        for (const ev of list) {
          // For multi-day all-day events, attach to every day in [start, end)
          if (ev.allDay) {
            let d = startOfDay(new Date(ev._start));
            const end = startOfDay(new Date(ev._end));
            while (d < end) {
              const key = ymd(d);
              (out[key] ||= []).push({ ...ev, _slotStart: d.getTime() });
              d = addDays(d, 1);
            }
          } else {
            const key = ymd(new Date(ev._start));
            (out[key] ||= []).push({ ...ev, _slotStart: ev._start });
          }
        }
      }
      // sort each day: all-day first then by start time
      for (const k of Object.keys(out)) {
        out[k].sort((a,b) => (a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a._start - b._start));
      }
      return out;
    }, [events, activeIds]);

    // ---- weather forecast (per-day, from weather/subscribe_forecasts) ----
    const forecast = window.useForecast(CAL.weatherEntity, "daily");
    const forecastByDay = useMemo(() => {
      const out = {};
      for (const f of forecast) {
        if (!f?.datetime) continue;
        const d = new Date(f.datetime);
        if (Number.isNaN(d.getTime())) continue;
        const hi = f.temperature;
        const lo = f.templow ?? f.temperature;
        out[ymd(d)] = {
          hi: hi == null ? null : Math.round(hi),
          lo: lo == null ? null : Math.round(lo),
          condition: f.condition,
        };
      }
      return out;
    }, [forecast]);

    // ---- range nav ----
    function shift(dir) {
      window.playBeep("tap");
      const k = vk(view);
      if (k === "month")   { const d = new Date(anchor); d.setMonth(d.getMonth() + dir);     setAnchor(startOfDay(d)); return; }
      if (k === "2months") { const d = new Date(anchor); d.setMonth(d.getMonth() + 2*dir);   setAnchor(startOfDay(d)); return; }
      setAnchor(addDays(anchor, dir * days));
    }
    function gotoToday() { setAnchor(startOfDay(new Date())); window.playBeep("on"); }

    return (
      <div className="modal-back" onClick={onClose} style={{ alignItems: "stretch", justifyContent: "stretch", padding: 14 }}>
        <div className="panel panel--glow" onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", height: "100%",
            display: "grid",
            gridTemplateRows: "auto auto 1fr",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <CornerBrackets />

          <CalHeader
            anchor={anchor} view={view} days={days}
            onShift={shift} onToday={gotoToday}
            onPickView={pickView}
            onClose={onClose}
            onAdd={() => setComposer({ date: startOfDay(new Date()) })}
            grid={grid}
          />

          <CalFilterRow
            sources={CAL.sources}
            activeIds={activeIds}
            onToggle={togglePerson}
            onAll={() => selectAll(true)}
            onNone={() => selectAll(false)}
            allActive={allActive}
            noneActive={noneActive}
          />

          <CalGrid
            view={view}
            grid={grid}
            byDay={byDay}
            forecastByDay={forecastByDay}
            onAddOnDay={(d) => setComposer({ date: startOfDay(d) })}
          />
        </div>

        {composer && (
          <EventComposer
            initialDate={composer.date}
            onCancel={() => setComposer(null)}
            onSubmit={(payload) => {
              const data = payload.allDay
                ? {
                    summary: payload.summary,
                    start_date: ymd(payload.start),
                    end_date:   ymd(payload.end),
                    description: payload.description || undefined,
                    location:    payload.location    || undefined,
                  }
                : {
                    summary: payload.summary,
                    start_date_time: payload.start.toISOString(),
                    end_date_time:   payload.end.toISOString(),
                    description: payload.description || undefined,
                    location:    payload.location    || undefined,
                  };
              ha?.callService("calendar", "create_event",
                { entity_id: payload.entity_id }, data);
              setComposer(null);
              setRefreshTick(t => t + 1);
              window.playBeep("on");
            }}
          />
        )}
      </div>
    );
  }

  // ============================================================
  // Header (title + range nav + view selector)
  // ============================================================
  function CalHeader({ anchor, view, days, onShift, onToday, onPickView, onClose, onAdd, grid }) {
    const rangeLabel = (() => {
      const k = vk(view);
      if (k === "today" || k === "tomorrow") {
        return WEEKDAYS_FR_LONG[anchor.getDay()] + " · " + anchor.getDate() + " " + MONTHS_FR[anchor.getMonth()].toUpperCase();
      }
      if (k === "month")   return MONTHS_FR[anchor.getMonth()].toUpperCase() + " " + anchor.getFullYear();
      if (k === "2months") {
        const a = MONTHS_FR[anchor.getMonth()].toUpperCase();
        const b = MONTHS_FR[(anchor.getMonth()+1)%12].toUpperCase();
        return a + " — " + b + " " + anchor.getFullYear();
      }
      const last = grid.cells[grid.cells.length-1]?.date || anchor;
      return `${anchor.getDate()} ${MONTHS_FR[anchor.getMonth()].slice(0,3)} — ${last.getDate()} ${MONTHS_FR[last.getMonth()].slice(0,3)} ${anchor.getFullYear()}`;
    })();

    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        padding: "16px 22px",
        borderBottom: "1px solid var(--line)",
        gap: 22,
      }}>
        {/* identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
          <div className="label-tag label-tag--accent" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PulseDot /> {window.t("calendar.header", { days })}
          </div>
          <div className="h-display" style={{ fontSize: 28, color: "var(--text-0)", letterSpacing: "0.18em", textShadow: "0 0 12px rgba(0,217,255,0.3)", lineHeight: 1 }}>
            {rangeLabel}
          </div>
        </div>

        {/* range nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
          <button className="btn" onClick={() => onShift(-1)} aria-label="précédent">◀</button>
          <button className="btn btn--active" onClick={onToday}>{window.t("calendar.today_btn")}</button>
          <button className="btn" onClick={() => onShift(1)} aria-label="suivant">▶</button>
        </div>

        {/* view selector */}
        <div style={{ display: "flex", gap: 4 }}>
          {CAL.viewOptions.map(v => (
            <button
              key={v}
              className={"btn" + (v === view ? " btn--active" : "")}
              onClick={() => onPickView(v)}
              style={{ padding: "8px 10px", fontSize: 10 }}
            >{v.toUpperCase()}</button>
          ))}
        </div>

        {/* close + add */}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--active" onClick={onAdd} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="plus" size={12} /> {window.t("calendar.add")}
          </button>
          <button className="btn" onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="x" size={12} /> {window.t("calendar.close_btn")}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // Filter row (avatar chips + select all/none)
  // ============================================================
  function CalFilterRow({ sources, activeIds, onToggle, onAll, onNone, allActive, noneActive }) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 22px",
        borderBottom: "1px solid var(--line)",
        background: "rgba(0,0,0,0.2)",
        overflowX: "auto",
      }} className="no-scroll">
        <div className="label-tag" style={{ flexShrink: 0 }}>{window.t("calendar.filters")}</div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className={"btn" + (allActive ? " btn--active" : "")} onClick={onAll} style={{ padding: "6px 10px", fontSize: 10 }}>{window.t("calendar.all")}</button>
          <button className={"btn" + (noneActive ? " btn--active" : "")} onClick={onNone} style={{ padding: "6px 10px", fontSize: 10 }}>{window.t("calendar.none")}</button>
        </div>
        <div style={{ width: 1, height: 22, background: "var(--line)", flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {sources.map(s => {
            const on = activeIds.has(s.id);
            const c = brighten(s.color);
            return (
              <button
                key={s.id}
                onClick={() => onToggle(s.id)}
                className="t-mono"
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px 6px 6px",
                  background: on ? withAlpha(s.color, 0.18) : "rgba(0,0,0,0.4)",
                  border: `1px solid ${on ? c : "var(--line)"}`,
                  color: on ? "var(--text-0)" : "var(--text-2)",
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all 0.18s",
                  boxShadow: on ? `0 0 10px ${withAlpha(s.color, 0.45)}, inset 0 0 6px ${withAlpha(s.color, 0.2)}` : "none",
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: on ? c : "rgba(0,0,0,0.5)",
                  border: `1.5px solid ${on ? c : "var(--line)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700,
                  color: on ? "#03070d" : "var(--text-2)",
                  letterSpacing: 0,
                  boxShadow: on ? `0 0 8px ${withAlpha(s.color, 0.6)}` : "none",
                }}>{s.name.slice(0,2)}</span>
                {s.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================================
  // Grid (month-style)
  // ============================================================
  function buildGrid(anchor, days, view) {
    const cells = [];
    const k = vk(view);
    if (k === "month") {
      // first day of month → snap back to Sunday
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const start = addDays(first, -first.getDay());
      // 6 weeks (42 cells) — covers any month
      for (let i = 0; i < 42; i++) cells.push({ date: addDays(start, i), inMonth: addDays(start, i).getMonth() === anchor.getMonth() });
      return { cells, cols: 7, rows: 6, mode: "month", anchorMonth: anchor.getMonth() };
    }
    if (k === "2months") {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const start = addDays(first, -first.getDay());
      for (let i = 0; i < 70; i++) cells.push({ date: addDays(start, i), inMonth: addDays(start, i).getMonth() === anchor.getMonth() || addDays(start, i).getMonth() === (anchor.getMonth()+1)%12 });
      return { cells, cols: 7, rows: 10, mode: "month", anchorMonth: anchor.getMonth() };
    }
    if (k === "today") {
      cells.push({ date: startOfDay(anchor), inMonth: true });
      return { cells, cols: 1, rows: 1, mode: "list" };
    }
    if (k === "tomorrow") {
      cells.push({ date: startOfDay(anchor),                inMonth: true });
      cells.push({ date: addDays(startOfDay(anchor), 1),    inMonth: true });
      return { cells, cols: 2, rows: 1, mode: "list" };
    }
    if (k === "week") {
      for (let i = 0; i < 7; i++)  cells.push({ date: addDays(anchor, i), inMonth: true });
      return { cells, cols: 7, rows: 1, mode: "week" };
    }
    if (k === "2weeks") {
      for (let i = 0; i < 14; i++) cells.push({ date: addDays(anchor, i), inMonth: true });
      return { cells, cols: 7, rows: 2, mode: "week" };
    }
    return { cells: [], cols: 7, rows: 0, mode: "month" };
  }

  function CalGrid({ view, grid, byDay, forecastByDay, onAddOnDay }) {
    if (grid.mode === "list") return <CalListMode grid={grid} byDay={byDay} forecastByDay={forecastByDay} onAddOnDay={onAddOnDay} />;

    return (
      <div style={{ overflow: "auto", padding: "12px 22px 22px" }} className="no-scroll">
        {/* weekday header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
          gap: 8,
          marginBottom: 8,
        }}>
          {WEEKDAYS_FR.map((wd, i) => (
            <div key={wd} className="label-tag" style={{
              padding: "4px 8px",
              textAlign: "left",
              borderBottom: "1px solid var(--line)",
              color: i === 0 || i === 6 ? "var(--accent)" : "var(--text-2)",
            }}>{wd.toUpperCase()}</div>
          ))}
        </div>
        {/* day cells */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
          gridAutoRows: grid.rows >= 6 ? "minmax(98px, 1fr)" : "minmax(120px, 1fr)",
          gap: 8,
        }}>
          {grid.cells.map((cell, i) => (
            <DayCell
              key={ymd(cell.date) + "-" + i}
              cell={cell}
              events={byDay[ymd(cell.date)] || []}
              forecast={forecastByDay[ymd(cell.date)]}
              compact={grid.rows >= 6}
              onAdd={onAddOnDay ? () => onAddOnDay(cell.date) : null}
            />
          ))}
        </div>
      </div>
    );
  }

  function DayCell({ cell, events, forecast, compact, onAdd }) {
    const today = sameYMD(cell.date, new Date());
    const dim   = !cell.inMonth;
    const dayNum = cell.date.getDate();
    const dow = cell.date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const [hover, setHover] = useState(false);

    const maxVisible = compact ? 3 : 6;
    const visible = events.slice(0, maxVisible);
    const overflow = Math.max(0, events.length - maxVisible);

    return (
      <div className="tile"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
        padding: 8,
        opacity: dim ? 0.35 : 1,
        borderColor: today ? "var(--accent)" : "var(--line)",
        boxShadow: today ? "var(--accent-glow)" : "none",
        background: today
          ? "linear-gradient(180deg, rgba(0,217,255,0.10), rgba(0,217,255,0.02)), rgba(5,16,28,0.7)"
          : undefined,
        display: "flex", flexDirection: "column", gap: 4,
        minHeight: 0, overflow: "hidden",
        cursor: "default",
        position: "relative",
      }}>
        {/* day-cell quick-add (appears on hover) */}
        {onAdd && hover && !dim && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            title={window.t("calendar.add_day")}
            style={{
              position: "absolute", top: 6, right: 6, zIndex: 2,
              width: 22, height: 22,
              border: "1px solid var(--accent)",
              background: "rgba(0,217,255,0.15)",
              color: "var(--accent)",
              cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 8px rgba(0,217,255,0.45)",
            }}
          >
            <Icon name="plus" size={12} color="currentColor" />
          </button>
        )}
        {/* day header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="h-display" style={{
              fontSize: today ? 24 : 20,
              color: today ? "var(--accent)" : (isWeekend ? "var(--accent-soft)" : "var(--text-0)"),
              textShadow: today ? "0 0 8px rgba(0,217,255,0.5)" : "none",
              lineHeight: 1,
            }}>{dayNum}</span>
            <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", letterSpacing: "0.2em" }}>
              {WEEKDAYS_FR[dow].toUpperCase()}
            </span>
          </div>
          {forecast && (
            <span className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", letterSpacing: "0.05em", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}>
              <WxIcon condition={forecast.condition} />
              <span style={{ color: "var(--warn)" }}>{forecast.hi}°</span>
              <span style={{ opacity: 0.5 }}>/</span>
              <span style={{ color: "var(--accent-soft)" }}>{forecast.lo}°</span>
            </span>
          )}
        </div>

        {/* events */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minHeight: 0, overflow: "hidden" }}>
          {visible.map((ev, i) => <EventChip key={ev.uid + "-" + i} event={ev} compact={compact} />)}
          {overflow > 0 && (
            <div className="t-mono" style={{ fontSize: 9, color: "var(--text-2)", letterSpacing: "0.18em", padding: "2px 4px" }}>
              + {overflow} DE PLUS
            </div>
          )}
        </div>
      </div>
    );
  }

  function EventChip({ event, compact }) {
    const c = brighten(event.color);
    return (
      <div title={`${event.personName} · ${event.summary}${event.location ? " · " + event.location : ""}`} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: compact ? "2px 5px 2px 0" : "3px 6px 3px 0",
        borderLeft: `3px solid ${c}`,
        background: withAlpha(event.color, 0.18),
        color: "var(--text-0)",
        fontFamily: "var(--font-mono)",
        fontSize: compact ? 10 : 11,
        letterSpacing: "0.04em",
        overflow: "hidden",
        cursor: "pointer",
      }}>
        {!event.allDay && (
          <span style={{ color: c, fontWeight: 600, paddingLeft: 6, flexShrink: 0, textShadow: `0 0 4px ${withAlpha(event.color,0.7)}` }}>
            {fmtTime(new Date(event._start).toISOString())}
          </span>
        )}
        {event.allDay && (
          <span style={{ color: c, paddingLeft: 6, flexShrink: 0, fontSize: 8, letterSpacing: "0.2em" }}>
            ◆ JOUR
          </span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {event.summary}
        </span>
      </div>
    );
  }

  // ============================================================
  // List mode (Aujourdhui / Demain) — vertical stack with full event details.
  // ============================================================
  function CalListMode({ grid, byDay, forecastByDay, onAddOnDay }) {
    return (
      <div style={{ overflow: "auto", padding: "16px 22px 22px", display: "grid", gap: 14, gridTemplateColumns: grid.cells.length > 1 ? "1fr 1fr" : "1fr" }} className="no-scroll">
        {grid.cells.map((cell, i) => {
          const today = sameYMD(cell.date, new Date());
          const events = byDay[ymd(cell.date)] || [];
          const fc = forecastByDay[ymd(cell.date)];
          return (
            <div key={i} className="panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                  <span className="h-display" style={{
                    fontSize: 64,
                    color: today ? "var(--accent)" : "var(--text-0)",
                    textShadow: today ? "0 0 16px rgba(0,217,255,0.6)" : "none",
                    lineHeight: 1,
                  }}>{cell.date.getDate()}</span>
                  <div>
                    <div className="h-display" style={{ fontSize: 22, color: "var(--text-0)", letterSpacing: "0.16em" }}>
                      {WEEKDAYS_FR_LONG[cell.date.getDay()].toUpperCase()}
                    </div>
                    <div className="t-mono" style={{ fontSize: 11, color: "var(--text-2)", letterSpacing: "0.18em", marginTop: 4 }}>
                      {MONTHS_FR[cell.date.getMonth()].toUpperCase()} {cell.date.getFullYear()}
                    </div>
                  </div>
                </div>
                {fc && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <WxIcon condition={fc.condition} size={20} />
                    <div className="t-mono" style={{ fontSize: 14, color: "var(--text-1)", letterSpacing: "0.06em" }}>
                      <span style={{ color: "var(--warn)" }}>{fc.hi}°</span>
                      <span style={{ opacity: 0.5, margin: "0 4px" }}>/</span>
                      <span style={{ color: "var(--accent-soft)" }}>{fc.lo}°</span>
                    </div>
                  </div>
                )}
              </div>

              {events.length === 0 ? (
                <div className="t-mono" style={{ padding: 24, textAlign: "center", color: "var(--text-2)", letterSpacing: "0.18em", fontSize: 11 }}>
                  {window.t("calendar.no_events_inline")}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {events.map((ev, j) => (
                    <ListEventRow key={ev.uid + j} event={ev} />
                  ))}
                </div>
              )}
              {onAddOnDay && (
                <button
                  className="btn"
                  onClick={() => onAddOnDay(cell.date)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
                >
                  <Icon name="plus" size={12} /> {window.t("calendar.add_day_btn")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function ListEventRow({ event }) {
    const c = brighten(event.color);
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr auto",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px",
        background: withAlpha(event.color, 0.12),
        borderLeft: `3px solid ${c}`,
        borderTop: "1px solid var(--line)",
        borderRight: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div className="t-mono" style={{ fontSize: 13, color: c, letterSpacing: "0.1em", textShadow: `0 0 6px ${withAlpha(event.color,0.6)}` }}>
          {event.allDay ? window.t("calendar.all_day") : `${fmtTime(new Date(event._start).toISOString())} – ${fmtTime(new Date(event._end).toISOString())}`}
        </div>
        <div>
          <div className="h-display" style={{ fontSize: 16, color: "var(--text-0)", letterSpacing: "0.08em" }}>
            {event.summary}
          </div>
          {(event.location || event.description) && (
            <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", letterSpacing: "0.12em", marginTop: 3 }}>
              {[event.location, event.description].filter(Boolean).join(" · ").toUpperCase()}
            </div>
          )}
        </div>
        <div className="t-mono" style={{
          fontSize: 10, letterSpacing: "0.18em", color: c,
          padding: "3px 10px", border: `1px solid ${c}`,
          background: "rgba(0,0,0,0.4)",
        }}>{event.personName.toUpperCase()}</div>
      </div>
    );
  }

  // ============================================================
  // Tiny weather glyph
  // ============================================================
  function WxIcon({ condition, size = 12 }) {
    const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
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
      default:
        return (<svg {...props} style={{ color: "var(--text-2)" }}><circle cx="12" cy="12" r="6"/></svg>);
    }
  }

  // ============================================================
  // Event Composer — 3 layouts (modal / drawer / inline) chosen by Tweak.
  // Single calendar (one event = one source), as requested.
  // ============================================================
  function EventComposer({ initialDate, onCancel, onSubmit }) {
    // pick layout from a localStorage-persisted tweak (mirrored in app TWEAK_DEFAULTS)
    const [layout, setLayout] = useState(() => {
      try { return localStorage.getItem("__holo_composer_layout") || "modal"; } catch { return "modal"; }
    });
    function pickLayout(L) {
      setLayout(L);
      try { localStorage.setItem("__holo_composer_layout", L); } catch {}
      window.playBeep("tap");
    }

    // ---- form state ----
    const [entityId,   setEntityId]   = useState(CAL.sources[0].entity);
    const [summary,    setSummary]    = useState("");
    const [date,       setDate]       = useState(initialDate || startOfDay(new Date()));
    const [allDay,     setAllDay]     = useState(false);
    const [startTime,  setStartTime]  = useState("18:00");
    const [endTime,    setEndTime]    = useState("19:00");
    const [endDate,    setEndDate]    = useState(initialDate || startOfDay(new Date()));
    const [location,   setLocation]   = useState("");
    const [description,setDescription]= useState("");

    const titleRef = useRef(null);
    useEffect(() => { setTimeout(() => titleRef.current?.focus(), 60); }, []);

    function buildPayload() {
      if (allDay) {
        const s = startOfDay(date);
        const e = addDays(startOfDay(endDate || date), 1);
        return { entity_id: entityId, summary: summary.trim(), start: s, end: e, allDay: true, location, description };
      }
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const s = new Date(date); s.setHours(sh||0, sm||0, 0, 0);
      const e = new Date(date); e.setHours(eh||0, em||0, 0, 0);
      if (e <= s) e.setTime(s.getTime() + 60*60000);
      return { entity_id: entityId, summary: summary.trim(), start: s, end: e, allDay: false, location, description };
    }

    function submit() {
      const p = buildPayload();
      if (!p.summary) { titleRef.current?.focus(); return; }
      onSubmit(p);
    }

    const selSrc = CAL.sources.find(s => s.entity === entityId) || CAL.sources[0];

    const formProps = {
      titleRef, summary, setSummary,
      entityId, setEntityId,
      allDay, setAllDay,
      date, setDate, endDate, setEndDate,
      startTime, setStartTime, endTime, setEndTime,
      location, setLocation, description, setDescription,
      selSrc, layout, pickLayout, onCancel, submit,
    };

    if (layout === "drawer") return <ComposerDrawer  {...formProps} />;
    if (layout === "inline") return <ComposerInline  {...formProps} />;
    return <ComposerModal {...formProps} />;
  }

  // ---- shared form fields ----
  function ComposerFields(p) {
    return (
      <>
        <Field label={window.t("calendar.title")}>
          <input
            ref={p.titleRef}
            value={p.summary}
            onChange={(e) => p.setSummary(e.target.value)}
            placeholder={window.t("calendar.placeholder")}
            className="t-mono composer-input"
            style={inputStyle}
            onKeyDown={(e) => { if (e.key === "Enter" && p.summary.trim()) p.submit(); }}
          />
        </Field>

        <Field label={window.t("calendar.cal")}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CAL.sources.map(s => {
              const active = s.entity === p.entityId;
              const c = brighten(s.color);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { p.setEntityId(s.entity); window.playBeep("tap"); }}
                  className="t-mono"
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 10px 5px 5px",
                    background: active ? withAlpha(s.color, 0.22) : "rgba(0,0,0,0.4)",
                    border: `1px solid ${active ? c : "var(--line)"}`,
                    color: active ? "var(--text-0)" : "var(--text-2)",
                    fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    cursor: "pointer",
                    boxShadow: active ? `0 0 8px ${withAlpha(s.color, 0.5)}` : "none",
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: active ? c : "rgba(0,0,0,0.5)",
                    border: `1.5px solid ${active ? c : "var(--line)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 700,
                    color: active ? "#03070d" : "var(--text-2)",
                  }}>{s.name.slice(0,2)}</span>
                  {s.name}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={window.t("calendar.when")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              type="date"
              value={ymd(p.date)}
              onChange={(e) => {
                const [y,m,d] = e.target.value.split("-").map(Number);
                p.setDate(new Date(y, m-1, d));
              }}
              style={{ ...inputStyle, width: 150 }}
              className="t-mono composer-input"
            />
            {!p.allDay && (
              <>
                <input
                  type="time"
                  value={p.startTime}
                  onChange={(e) => p.setStartTime(e.target.value)}
                  style={{ ...inputStyle, width: 110 }}
                  className="t-mono composer-input"
                />
                <span className="t-mono" style={{ color: "var(--text-1)" }}>—</span>
                <input
                  type="time"
                  value={p.endTime}
                  onChange={(e) => p.setEndTime(e.target.value)}
                  style={{ ...inputStyle, width: 110 }}
                  className="t-mono composer-input"
                />
              </>
            )}
            {p.allDay && (
              <>
                <span className="t-mono" style={{ color: "var(--text-1)" }}>{window.t("calendar.until")}</span>
                <input
                  type="date"
                  value={ymd(p.endDate || p.date)}
                  onChange={(e) => {
                    const [y,m,d] = e.target.value.split("-").map(Number);
                    p.setEndDate(new Date(y, m-1, d));
                  }}
                  style={{ ...inputStyle, width: 150 }}
                  className="t-mono composer-input"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => { p.setAllDay(!p.allDay); window.playBeep("tap"); }}
              className={"btn" + (p.allDay ? " btn--active" : "")}
              style={{ padding: "6px 10px", fontSize: 10 }}
            >{window.t("calendar.full_day")}</button>
          </div>
        </Field>

        <Field label={window.t("calendar.location")}>
          <input
            value={p.location}
            onChange={(e) => p.setLocation(e.target.value)}
            placeholder={window.t("calendar.optional")}
            className="t-mono composer-input"
            style={inputStyle}
          />
        </Field>

        <Field label={window.t("calendar.description")}>
          <textarea
            value={p.description}
            onChange={(e) => p.setDescription(e.target.value)}
            placeholder={window.t("calendar.optional")}
            rows={2}
            className="t-mono composer-input"
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.4 }}
          />
        </Field>
      </>
    );
  }

  function Field({ label, children }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="label-tag" style={{ color: "var(--accent-soft)", textShadow: "0 0 4px rgba(0,217,255,0.2)" }}>{label}</div>
        {children}
      </div>
    );
  }
  const inputStyle = {
    background: "rgba(0,0,0,0.5)",
    border: "1px solid var(--line-strong)",
    color: "#ffffff",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.04em",
    width: "100%",
    outline: "none",
    colorScheme: "dark", // makes native date/time pickers + their icons render light-on-dark
  };

  // brighten placeholder + native picker icons inside the composer
  if (typeof document !== "undefined" && !document.getElementById("__composer-input-css")) {
    const s = document.createElement("style");
    s.id = "__composer-input-css";
    s.textContent = `
      .composer-input::placeholder { color: rgba(232,244,248,0.55); }
      .composer-input::-webkit-calendar-picker-indicator { filter: invert(1) brightness(1.4); cursor: pointer; opacity: 0.85; }
      .composer-input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 1px var(--accent), 0 0 12px rgba(0,217,255,0.35); }
    `;
    document.head.appendChild(s);
  }

  function LayoutSwitch({ layout, pickLayout }) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        {[
          { id: "modal",  label: window.t("calendar.modal")  },
          { id: "drawer", label: window.t("calendar.drawer") },
          { id: "inline", label: window.t("calendar.inline") },
        ].map(o => (
          <button
            key={o.id}
            className={"btn" + (layout === o.id ? " btn--active" : "")}
            onClick={() => pickLayout(o.id)}
            style={{ padding: "5px 9px", fontSize: 9 }}
          >{o.label}</button>
        ))}
      </div>
    );
  }

  function ComposerActions({ onCancel, submit, summary, selSrc }) {
    const c = brighten(selSrc.color);
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", letterSpacing: "0.16em" }}>
          {window.t("calendar.sent_to")} <span style={{ color: c, textShadow: `0 0 6px ${withAlpha(selSrc.color, 0.6)}` }}>{selSrc.entity.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onCancel}>{window.t("calendar.cancel")}</button>
          <button
            className="btn btn--active"
            onClick={submit}
            disabled={!summary.trim()}
            style={{ opacity: summary.trim() ? 1 : 0.4, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Icon name="plus" size={12} /> {window.t("calendar.add")}
          </button>
        </div>
      </div>
    );
  }

  // ---- layout 1: centered modal ----
  function ComposerModal(p) {
    return (
      <div className="modal-back" onClick={p.onCancel} style={{ zIndex: 600 }}>
        <div className="panel panel--glow" onClick={(e) => e.stopPropagation()} style={{
          width: "min(640px, 92vw)", padding: 22,
          display: "flex", flexDirection: "column", gap: 14,
          position: "relative",
        }}>
          <CornerBrackets />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
            <div>
              <div className="label-tag label-tag--accent" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PulseDot /> {window.t("calendar.new_event")}
              </div>
              <div className="h-display" style={{ fontSize: 22, color: "var(--text-0)", letterSpacing: "0.16em", marginTop: 4 }}>
                {window.t("calendar.add_to")}
              </div>
            </div>
            <LayoutSwitch layout={p.layout} pickLayout={p.pickLayout} />
          </div>
          <ComposerFields {...p} />
          <ComposerActions onCancel={p.onCancel} submit={p.submit} summary={p.summary} selSrc={p.selSrc} />
        </div>
      </div>
    );
  }

  // ---- layout 2: right-hand drawer ----
  function ComposerDrawer(p) {
    return (
      <div onClick={p.onCancel} style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(3,7,13,0.5)",
        backdropFilter: "blur(3px)",
        animation: "fade-in 0.2s ease",
      }}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="panel panel--glow"
          style={{
            position: "absolute",
            top: 14, right: 14, bottom: 14,
            width: "min(440px, 92vw)",
            padding: 22,
            display: "flex", flexDirection: "column", gap: 14,
            overflow: "auto",
          }}
        >
          <CornerBrackets />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: 12, gap: 10 }}>
            <div>
              <div className="label-tag label-tag--accent" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PulseDot /> {window.t("calendar.new_event")}
              </div>
              <div className="h-display" style={{ fontSize: 18, color: "var(--text-0)", letterSpacing: "0.14em", marginTop: 4 }}>
                {window.t("calendar.add")}
              </div>
            </div>
            <LayoutSwitch layout={p.layout} pickLayout={p.pickLayout} />
          </div>
          <ComposerFields {...p} />
          <div style={{ flex: 1 }} />
          <ComposerActions onCancel={p.onCancel} submit={p.submit} summary={p.summary} selSrc={p.selSrc} />
        </div>
      </div>
    );
  }

  // ---- layout 3: inline expand bar (bottom of screen, slim) ----
  function ComposerInline(p) {
    return (
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 600,
        padding: 14,
        animation: "fade-in 0.2s ease",
      }}>
        <div className="panel panel--glow" style={{
          padding: 16, display: "grid",
          gridTemplateColumns: "auto 1fr auto auto auto",
          gap: 12, alignItems: "center",
          position: "relative",
        }}>
          <CornerBrackets />
          {/* Compact source selector */}
          <select
            value={p.entityId}
            onChange={(e) => p.setEntityId(e.target.value)}
            className="t-mono composer-input"
            style={{ ...inputStyle, width: 170, cursor: "pointer" }}
          >
            {CAL.sources.map(s => <option key={s.id} value={s.entity} style={{ background: "#03070d" }}>{s.name}</option>)}
          </select>

          <input
            ref={p.titleRef}
            value={p.summary}
            onChange={(e) => p.setSummary(e.target.value)}
            placeholder={window.t("calendar.event_placeholder")}
            className="t-mono composer-input"
            style={{ ...inputStyle, fontSize: 14 }}
            onKeyDown={(e) => { if (e.key === "Enter" && p.summary.trim()) p.submit(); }}
          />

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="date"
              value={ymd(p.date)}
              onChange={(e) => {
                const [y,m,d] = e.target.value.split("-").map(Number);
                p.setDate(new Date(y, m-1, d));
              }}
              style={{ ...inputStyle, width: 140 }}
              className="t-mono composer-input"
            />
            {!p.allDay && (
              <>
                <input type="time" value={p.startTime} onChange={(e) => p.setStartTime(e.target.value)} style={{ ...inputStyle, width: 100 }} className="t-mono composer-input" />
                <span className="t-mono" style={{ color: "var(--text-1)" }}>—</span>
                <input type="time" value={p.endTime}   onChange={(e) => p.setEndTime(e.target.value)}   style={{ ...inputStyle, width: 100 }} className="t-mono composer-input" />
              </>
            )}
            <button
              type="button"
              onClick={() => p.setAllDay(!p.allDay)}
              className={"btn" + (p.allDay ? " btn--active" : "")}
              style={{ padding: "6px 8px", fontSize: 9 }}
            >24H</button>
          </div>

          <LayoutSwitch layout={p.layout} pickLayout={p.pickLayout} />

          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn" onClick={p.onCancel} title={window.t("calendar.cancel_title")}><Icon name="x" size={12}/></button>
            <button
              className="btn btn--active"
              onClick={p.submit}
              disabled={!p.summary.trim()}
              style={{ opacity: p.summary.trim() ? 1 : 0.4, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="plus" size={12} /> {window.t("calendar.add")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- exports ----
  Object.assign(window, { CalendarScreen });
})();
