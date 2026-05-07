// HOLO HOME OS — primitives & hooks
// Small reusable building blocks shared across panels.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// --- helpers ---
function pad(n, w = 2) { return String(n).padStart(w, "0"); }

// stardate-style clock: HH:MM:SS · 26122.045
function useStardate() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const stardate = useMemo(() => {
    // year-derived stardate-ish: year suffix + day-of-year + fractional
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const day = Math.floor(diff / 86400000);
    const yearSuffix = String(now.getFullYear()).slice(-2);
    const frac = ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400 * 1000) | 0;
    return `${yearSuffix}${pad(day, 3)}.${pad(frac, 3)}`;
  }, [now]);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const date = window.formatDate(now, { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return { now, time, date, stardate };
}

// click sound helper using WebAudio (synthesised — no asset)
const audioCtxRef = { ctx: null };
function ensureAudio() {
  if (!audioCtxRef.ctx) {
    try { audioCtxRef.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtxRef.ctx = null; }
  }
  return audioCtxRef.ctx;
}
function playBeep(kind = "tap") {
  if (!window.__sfx_on) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine";
  const cfg = {
    tap:    { f: 880,  d: 0.05, v: 0.04 },
    on:     { f: 1320, d: 0.10, v: 0.05 },
    off:    { f: 440,  d: 0.10, v: 0.05 },
    warn:   { f: 200,  d: 0.18, v: 0.06 },
  }[kind] || { f: 800, d: 0.05, v: 0.04 };
  o.frequency.value = cfg.f;
  g.gain.setValueAtTime(cfg.v, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + cfg.d);
  o.start();
  o.stop(ctx.currentTime + cfg.d + 0.02);
}
window.__sfx_on = true;
window.playBeep = playBeep;

// --- icons (line-only, sci-fi flavoured) ---
function Icon({ name, size = 18, color = "currentColor", strokeWidth = 1.4 }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "thermo": return (
      <svg {...props}><path d="M12 14V4a2 2 0 1 1 4 0v10a4 4 0 1 1-4 0Z" transform="translate(-2 0)"/><circle cx="12" cy="17" r="1.4" fill={color}/></svg>
    );
    case "bulb": return (
      <svg {...props}><path d="M9 18h6M10 21h4M9 14a5 5 0 1 1 6 0c-.8.6-1 1.3-1 2v1H10v-1c0-.7-.2-1.4-1-2Z"/></svg>
    );
    case "fan": return (
      <svg {...props}><circle cx="12" cy="12" r="2"/><path d="M12 10c0-3 1-5 3-5s2 2 1 4-2 1-4 1Z"/><path d="M14 12c3 0 5 1 5 3s-2 2-4 1-1-2-1-4Z"/><path d="M12 14c0 3-1 5-3 5s-2-2-1-4 2-1 4-1Z"/><path d="M10 12c-3 0-5-1-5-3s2-2 4-1 1 2 1 4Z"/></svg>
    );
    case "drop": return (
      <svg {...props}><path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z"/></svg>
    );
    case "pump": return (
      <svg {...props}><rect x="4" y="10" width="10" height="10"/><path d="M14 13h4l2 2-2 2h-4M9 10V6h-2"/><circle cx="9" cy="15" r="1.4"/></svg>
    );
    case "flame": return (
      <svg {...props}><path d="M12 3c1 3 4 4 4 8a4 4 0 1 1-8 0c0-2 2-2 2-5 0 0 1 1 2-3Z"/></svg>
    );
    case "garage": return (
      <svg {...props}><path d="M3 10 12 4l9 6v10H3V10Z"/><path d="M6 13h12M6 16h12M6 19h12"/></svg>
    );
    case "cam": return (
      <svg {...props}><rect x="3" y="6" width="13" height="12" rx="1"/><path d="m21 8-5 4 5 4V8Z"/></svg>
    );
    case "tractor": return (
      <svg {...props}><circle cx="6" cy="17" r="3"/><circle cx="17" cy="18" r="2"/><path d="M9 17h6M3 11h7l1-5h4l1 5h3v6"/></svg>
    );
    case "shield": return (
      <svg {...props}><path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
    );
    case "alert": return (
      <svg {...props}><path d="M12 4 2 20h20L12 4Z"/><path d="M12 10v5M12 18v.5"/></svg>
    );
    case "wind": return (
      <svg {...props}><path d="M3 8h12a3 3 0 1 0-3-3M3 12h17a3 3 0 1 1-3 3M3 16h10"/></svg>
    );
    case "humid": return (
      <svg {...props}><path d="M12 3s5 6 5 10a5 5 0 1 1-10 0c0-4 5-10 5-10Z"/><path d="M9 14a2 2 0 0 0 3 2"/></svg>
    );
    case "plus": return (<svg {...props}><path d="M12 5v14M5 12h14"/></svg>);
    case "minus": return (<svg {...props}><path d="M5 12h14"/></svg>);
    case "x": return (<svg {...props}><path d="M6 6l12 12M18 6 6 18"/></svg>);
    case "lock": return (<svg {...props}><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></svg>);
    case "wave": return (<svg {...props}><path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>);
    case "bed": return (<svg {...props}><path d="M3 17V8M3 13h18v4M21 13V11a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/></svg>);
    case "bath": return (<svg {...props}><path d="M4 12V6a2 2 0 0 1 4 0v1M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3ZM6 19l-1 2M18 19l1 2"/></svg>);
    case "kitchen": return (<svg {...props}><path d="M4 8h16v3H4zM5 11v9h14v-9M9 14h6"/></svg>);
    case "sofa": return (<svg {...props}><path d="M3 14a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v3M21 14a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v3M7 14h10v3H3v3M21 17v3"/></svg>);
    case "gamepad": return (<svg {...props}><path d="M6 17H5a3 3 0 0 1 0-6h14a3 3 0 0 1 0 6h-1l-2-2H8l-2 2Z"/><circle cx="9" cy="14" r="0.6" fill={color}/><circle cx="15" cy="14" r="0.6" fill={color}/></svg>);
    case "office": return (<svg {...props}><rect x="4" y="3" width="16" height="18"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/></svg>);
    case "garage-cover": return (<svg {...props}><path d="M3 11 12 5l9 6v9H3V11Z"/><path d="M6 14h12v6H6z"/><path d="M6 17h12"/></svg>);
    case "printer": return (<svg {...props}><path d="M6 9V3h12v6M6 18H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-2"/><rect x="6" y="14" width="12" height="7"/></svg>);
    case "washer": return (<svg {...props}><rect x="4" y="3" width="16" height="18"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="7" cy="6" r="0.5" fill={color}/></svg>);
    case "dryer": return (<svg {...props}><rect x="4" y="3" width="16" height="18"/><circle cx="12" cy="13" r="5"/><path d="M9 13a3 3 0 0 1 6 0 3 3 0 0 1-6 0Z"/></svg>);
    // extras for the Action Library popup
    case "bulb-off": return (<svg {...props}><path d="M9 18h6M10 21h4M9 14a5 5 0 1 1 6 0c-.8.6-1 1.3-1 2v1H10v-1c0-.7-.2-1.4-1-2Z"/><path d="M3 3l18 18" strokeWidth="2"/></svg>);
    case "tree": return (<svg {...props}><path d="M12 3 6 11h3l-3 5h4l-2 4h8l-2-4h4l-3-5h3z"/><path d="M11 20h2v2h-2z" fill={color}/></svg>);
    case "home": return (<svg {...props}><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/></svg>);
    case "home-out": return (<svg {...props}><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/><path d="M14 13h7M18 10l3 3-3 3" strokeWidth="1.7"/></svg>);
    case "cabin": return (<svg {...props}><path d="M3 11 12 4l9 7"/><path d="M5 11v10h14V11"/><path d="M9 21v-5h6v5"/><path d="M5 14h14M5 17h14"/></svg>);
    case "moon": return (<svg {...props}><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/></svg>);
    case "sun": return (<svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>);
    case "reload": return (<svg {...props}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>);
    case "power": return (<svg {...props}><path d="M12 3v9"/><path d="M7.5 6A8 8 0 1 0 16.5 6"/></svg>);
    case "screen": return (<svg {...props}><rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8M12 17v4"/></svg>);
    case "sparkle": return (<svg {...props}><path d="M12 4v6M12 14v6M4 12h6M14 12h6"/><path d="M7 7l3 3M14 14l3 3M17 7l-3 3M10 14l-3 3" strokeWidth="1.4"/></svg>);
    case "thermo-up": return (<svg {...props}><path d="M12 14V4a2 2 0 1 1 4 0v10a4 4 0 1 1-4 0Z" transform="translate(-2 0)"/><path d="M18 9l3-3 3 3M21 6v9" transform="translate(-3 -2)"/></svg>);
    case "thermo-down": return (<svg {...props}><path d="M12 14V4a2 2 0 1 1 4 0v10a4 4 0 1 1-4 0Z" transform="translate(-2 0)"/><path d="M18 9l3 3 3-3M21 6v9" transform="translate(-3 -2)"/></svg>);
    case "thermo-off": return (<svg {...props}><path d="M12 14V4a2 2 0 1 1 4 0v10a4 4 0 1 1-4 0Z" transform="translate(-2 0)"/><path d="M3 3l18 18" strokeWidth="2"/></svg>);
    case "clock": return (<svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case "lights": return (<svg {...props}><path d="M3 6c2 2 4 2 6 0s4-2 6 0 4 2 6 0"/><path d="M5 8v2M9 8v2M13 8v2M17 8v2M21 8v2"/><circle cx="5" cy="13" r="2" fill={color}/><circle cx="13" cy="13" r="2" fill={color}/><circle cx="9" cy="13" r="2" fill={color}/><circle cx="17" cy="13" r="2" fill={color}/></svg>);
    case "lights-off": return (<svg {...props}><path d="M3 6c2 2 4 2 6 0s4-2 6 0 4 2 6 0"/><path d="M5 8v2M9 8v2M13 8v2M17 8v2M21 8v2"/><circle cx="5" cy="13" r="2"/><circle cx="9" cy="13" r="2"/><circle cx="13" cy="13" r="2"/><circle cx="17" cy="13" r="2"/><path d="M3 3l18 18" strokeWidth="2"/></svg>);
    case "more": return (<svg {...props}><circle cx="6" cy="12" r="1.4" fill={color}/><circle cx="12" cy="12" r="1.4" fill={color}/><circle cx="18" cy="12" r="1.4" fill={color}/></svg>);
    default: return null;
  }
}

// --- shared bits ---
function CornerBrackets() {
  return (<>
    <span className="bracket-tr"></span>
    <span className="bracket-bl"></span>
  </>);
}

function Tag({ children, kind }) {
  const color = {
    ok: "var(--ok)",
    warn: "var(--warn)",
    danger: "var(--danger)",
    accent: "var(--accent)",
  }[kind] || "var(--text-2)";
  return (
    <span className="t-mono" style={{
      fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
      color, padding: "2px 6px", border: `1px solid ${color}`,
      opacity: 0.9,
    }}>{children}</span>
  );
}

function PulseDot({ kind }) {
  const cls = "pulse-dot" + (kind ? ` pulse-dot--${kind}` : "");
  return <span className={cls}></span>;
}

function ScanOverlay() { return <span className="scan-overlay"></span>; }

// --- exports ---
Object.assign(window, {
  pad, useStardate, playBeep, Icon, CornerBrackets, Tag, PulseDot, ScanOverlay,
});
