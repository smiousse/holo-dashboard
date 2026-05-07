// HOLO HOME OS — Boot sequence shown on first load.

function BootSequence({ onComplete }) {
  const lines = Array.from({ length: 10 }, (_, i) => window.t("boot." + i));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= lines.length) {
      const t = setTimeout(onComplete, 320);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown(s => s + 1), 220 + Math.random() * 90);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <div className="boot">
      <div className="boot__crest">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <defs>
            <radialGradient id="bg-grad" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(0,217,255,0.4)"/>
              <stop offset="100%" stopColor="rgba(0,217,255,0)"/>
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="55" fill="url(#bg-grad)"/>
          <g style={{ transformOrigin: "60px 60px", animation: "boot-spin 4s linear infinite" }}>
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="2 6" opacity="0.6"/>
          </g>
          <g style={{ transformOrigin: "60px 60px", animation: "boot-spin-rev 6s linear infinite" }}>
            <circle cx="60" cy="60" r="40" fill="none" stroke="var(--accent)" strokeWidth="0.6" strokeDasharray="20 4 4 4" opacity="0.7"/>
          </g>
          <circle cx="60" cy="60" r="22" fill="none" stroke="var(--accent)" strokeWidth="1.2"/>
          <circle cx="60" cy="60" r="6" fill="var(--accent)" filter="url(#glow)"/>
          <text x="60" y="64" fill="var(--bg-0)" fontFamily="var(--font-mono)" fontSize="6" textAnchor="middle" fontWeight="700" letterSpacing="1">H·H</text>
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="h-display" style={{ fontSize: 22, color: "var(--text-0)", marginBottom: 6 }}>HOLO HOME OS</div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", letterSpacing: "0.3em" }}>{window.t("boot.tagline")}</div>
      </div>
      <div style={{ width: 460, maxWidth: "80vw", display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} className="t-mono" style={{ fontSize: 11, opacity: i === shown - 1 ? 1 : 0.55, display: "flex", justifyContent: "space-between" }}>
            <span><span style={{ opacity: 0.4 }}>{`> `}</span>{l}</span>
            <span style={{ color: "var(--ok)" }}>OK</span>
          </div>
        ))}
        {shown < lines.length && (
          <div className="t-mono flicker" style={{ fontSize: 11, color: "var(--accent)" }}>
            <span style={{ opacity: 0.4 }}>{`> `}</span>...
          </div>
        )}
      </div>
      <div style={{ position: "absolute", bottom: 30, fontSize: 10, letterSpacing: "0.3em" }} className="t-mono">
        {window.t("boot.footer")}
      </div>
    </div>
  );
}

window.BootSequence = BootSequence;
