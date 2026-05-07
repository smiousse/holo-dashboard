// HOLO HOME OS — Home Assistant client hook layer.
// Wraps the HA_MOCK or a real HA WebSocket connection into ergonomic
// React hooks: useHA(), useEntity(entity_id), useEntityActions(entity_id).
//
// Connection settings come from config.json (window.APP_CONFIG.connection):
//   • useRealHA       — boolean; false to keep the in-process mock
//   • url             — HA base URL (https://...)
//   • tokenStorageKey — localStorage key for the long-lived token
//
// The long-lived token is NEVER stored in source or in config.json. It lives
// only in the browser's localStorage. If missing or rejected (auth_invalid),
// the dashboard renders <TokenPrompt/> until the user pastes a valid token.

const DEFAULT_TOKEN_KEY = "holohome.haToken";
const TOKEN_EVENT       = "holohome:token-set";

function tokenStorageKey() {
  const cfg = window.APP_CONFIG?.connection;
  return (cfg && cfg.tokenStorageKey) || DEFAULT_TOKEN_KEY;
}
function configToken() {
  const t = window.APP_CONFIG?.connection?.haLongLivedToken;
  return (typeof t === "string" && t.trim()) ? t.trim() : null;
}
// localStorage takes precedence (user-entered via TokenPrompt); fall back to
// config.json connection.haLongLivedToken for kiosk/local-network deploys.
function readToken()  { try { return localStorage.getItem(tokenStorageKey()) || configToken(); } catch { return configToken(); } }
function writeToken(t){ try { localStorage.setItem(tokenStorageKey(), t); } catch {} }
function clearToken() { try { localStorage.removeItem(tokenStorageKey()); } catch {} }

window.holohomeClearToken = () => {
  clearToken();
  window.dispatchEvent(new CustomEvent(TOKEN_EVENT, { detail: { token: null } }));
};

// =============================================================================
// Real-HA WebSocket connection (implements the same surface as HA_MOCK.connect)
// Reference: https://developers.home-assistant.io/docs/api/websocket
// =============================================================================
async function connectRealHA(url, token) {
  const wsURL = url.replace(/^http/, "ws").replace(/\/$/, "") + "/api/websocket";
  const ws = new WebSocket(wsURL);
  let msgId = 0;
  const pending = new Map();    // id -> { resolve, reject }
  const subs    = new Map();    // id -> handler

  await new Promise((resolve, reject) => {
    ws.onopen  = () => resolve();
    ws.onerror = (e) => reject(new Error("WS error: " + (e?.message || "open failed")));
  });

  // Auth handshake
  await new Promise((resolve, reject) => {
    ws.onmessage = (raw) => {
      const msg = JSON.parse(raw.data);
      if (msg.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
      } else if (msg.type === "auth_ok") {
        resolve();
      } else if (msg.type === "auth_invalid") {
        reject(new Error("auth_invalid: " + (msg.message || "bad token")));
      }
    };
  });

  // Switch to the steady-state message router
  ws.onmessage = (raw) => {
    const msg = JSON.parse(raw.data);
    if (msg.type === "result") {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); msg.success ? p.resolve(msg.result) : p.reject(new Error(msg.error?.message || "result failed")); }
    } else if (msg.type === "event") {
      const h = subs.get(msg.id);
      if (h) h(msg.event);
    }
  };

  function send(payload) {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, ...payload }));
    });
  }

  return {
    async getStates() { return await send({ type: "get_states" }); },
    async callService(domain, service, data, target) {
      return await send({
        type: "call_service",
        domain, service,
        service_data: data || undefined,
        target: target || undefined,
      });
    },
    async subscribeEvents(handler, event_type) {
      const id = ++msgId;
      subs.set(id, (event) => {
        if (event_type && event.event_type !== event_type) return;
        handler(event);
      });
      await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, type: "subscribe_events", event_type }));
      });
      return () => {
        subs.delete(id);
        send({ type: "unsubscribe_events", subscription: id }).catch(()=>{});
      };
    },
    async subscribeMessage() { return () => {}; },
    // weather/subscribe_forecast — pushes forecast arrays for an entity.
    // Source: homeassistant/components/weather/websocket_api.py (ws_subscribe_forecast)
    async subscribeForecast(entity_id, forecast_type, handler) {
      const id = ++msgId;
      subs.set(id, (event) => {
        const f = event?.forecast || event?.data?.forecast || [];
        handler(f);
      });
      await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, type: "weather/subscribe_forecast", forecast_type, entity_id }));
      });
      return () => {
        subs.delete(id);
        send({ type: "unsubscribe_events", subscription: id }).catch(()=>{});
      };
    },
    // REST GET — HA must allow this origin in `http.cors_allowed_origins`.
    async listEvents(entity_id, startISO, endISO) {
      const r = await fetch(`${url.replace(/\/$/, "")}/api/calendars/${entity_id}?start=${startISO}&end=${endISO}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    },
    // Calendar UI uses calendar.create_event service via WS (no CORS needed).
    async createEvent(entity_id, payload) {
      return await send({
        type: "call_service",
        domain: "calendar",
        service: "create_event",
        target: { entity_id },
        service_data: payload,
      });
    },
    getState(entity_id) { return null; },
    close() { try { ws.close(); } catch {} },
    __ha: { url, ws },
  };
}

// =============================================================================
// React layer
// =============================================================================
const HAContext = React.createContext(null);

function HAProvider({ children }) {
  const cfgConn   = window.APP_CONFIG?.connection || {};
  const useReal   = cfgConn.useRealHA !== false;
  const haUrl     = cfgConn.url || "";

  const [token,   setToken]   = useState(() => readToken());
  const [conn,    setConn]    = useState(null);
  const [states,  setStates]  = useState(() => new Map());
  const [authErr, setAuthErr] = useState(null);

  // Listen for token writes from <TokenPrompt/> or the Tweaks reset button.
  useEffect(() => {
    const onTokenSet = () => { setAuthErr(null); setToken(readToken()); };
    window.addEventListener(TOKEN_EVENT, onTokenSet);
    return () => window.removeEventListener(TOKEN_EVENT, onTokenSet);
  }, []);

  // Connect (or reconnect) whenever the token changes and we want real HA.
  useEffect(() => {
    let cancelled = false;
    let activeConn = null;
    let unsub = null;

    (async () => {
      if (useReal && !token) return;                   // wait for prompt
      try {
        const c = useReal
          ? await connectRealHA(haUrl, token)
          : await window.HA_MOCK.connect();
        if (cancelled) { c.close?.(); return; }
        activeConn = c;

        const all = await c.getStates();
        const m = new Map(all.map(s => [s.entity_id, s]));
        if (cancelled) { c.close?.(); return; }
        setStates(m);

        let pending = null;
        unsub = await c.subscribeEvents((ev) => {
          const { entity_id, new_state } = ev.data;
          if (!new_state) return;
          if (!pending) pending = new Map(m);
          pending.set(entity_id, new_state);
          requestAnimationFrame(() => {
            if (!pending) return;
            m.clear();
            for (const [k, v] of pending) m.set(k, v);
            setStates(new Map(m));
            pending = null;
          });
        }, "state_changed");
        if (cancelled) return;
        setConn(c);
      } catch (e) {
        if (cancelled) return;
        const msg = String(e?.message || e);
        if (/auth_invalid/i.test(msg)) {
          clearToken();
          setToken(null);
        }
        setAuthErr(msg);
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) { try { unsub(); } catch {} }
      if (activeConn?.close) { try { activeConn.close(); } catch {} }
    };
  }, [token, useReal, haUrl]);

  const callService = useCallback((domain, service, target, data) => {
    if (!conn) {
      console.warn("[ha] callService skipped — no connection yet", { domain, service, target, data });
      return;
    }
    console.debug("[ha] callService", { domain, service, target, data });
    Promise.resolve(conn.callService(domain, service, data, target))
      .catch((e) => console.error("[ha] callService failed", { domain, service, target, data, error: e?.message || e }));
  }, [conn]);

  // Resolve a camera entity_picture to a renderable URL.
  // - Mock: synthesises an SVG.
  // - Real HA: returns the proxied JPEG URL with the entity's signed token,
  //   prefixed by the configured HA URL.
  const resolveSnapshot = useCallback((entity_id) => {
    if (!useReal && window.HA_MOCK?.resolveSnapshot) {
      return window.HA_MOCK.resolveSnapshot(entity_id);
    }
    const ent = states.get(entity_id);
    const path = ent?.attributes?.entity_picture;
    if (!path) return null;
    return path.startsWith("http") ? path : (haUrl.replace(/\/$/, "") + path);
  }, [states, useReal, haUrl]);

  const value = useMemo(
    () => ({ conn, states, callService, resolveSnapshot }),
    [conn, states, callService, resolveSnapshot]
  );

  // Token gate — we render the prompt over the dashboard until we have a
  // token AND a successful connection. The prompt also surfaces auth errors.
  if (useReal && (!token || authErr)) {
    return <TokenPrompt error={authErr} url={haUrl} />;
  }

  return <HAContext.Provider value={value}>{children}</HAContext.Provider>;
}

function useHA()                       { return React.useContext(HAContext); }
function useEntity(entity_id)          { return useHA()?.states?.get(entity_id) || null; }
// useForecast — subscribes to weather/subscribe_forecasts for entity_id and
// returns the latest forecast array. Empty array until the first event arrives.
function useForecast(entity_id, forecast_type = "daily") {
  const ha = useHA();
  const [forecast, setForecast] = useState([]);
  useEffect(() => {
    if (!ha?.conn || !entity_id) return;
    let cancelled = false;
    let unsub = null;
    (async () => {
      try {
        const u = await ha.conn.subscribeForecast(entity_id, forecast_type, (f) => {
          if (!cancelled) setForecast(Array.isArray(f) ? f : []);
        });
        if (cancelled) { try { u(); } catch {} return; }
        unsub = u;
      } catch (e) {
        console.error("[ha] subscribeForecast failed", { entity_id, forecast_type, error: e?.message || e });
      }
    })();
    return () => {
      cancelled = true;
      if (unsub) { try { unsub(); } catch {} }
    };
  }, [ha?.conn, entity_id, forecast_type]);
  return forecast;
}
function useEntityActions(entity_id) {
  const ha = useHA();
  return useMemo(() => {
    if (!ha || !entity_id) return {};
    const domain = entity_id.split(".")[0];
    return {
      toggle: () => ha.callService(domain, "toggle", { entity_id }),
      turnOn: () => ha.callService(domain, "turn_on", { entity_id }),
      turnOff: () => ha.callService(domain, "turn_off", { entity_id }),
      setTemperature: (t) => ha.callService("climate", "set_temperature", { entity_id }, { temperature: t }),
      openCover: () => ha.callService("cover", "open_cover", { entity_id }),
      closeCover: () => ha.callService("cover", "close_cover", { entity_id }),
      toggleCover: () => ha.callService("cover", "toggle", { entity_id }),
    };
  }, [ha, entity_id]);
}

// =============================================================================
// Token prompt — fullscreen modal, shown when localStorage is empty or HA
// returned auth_invalid. Submitting writes the token to localStorage and
// dispatches `holohome:token-set` so the provider reconnects.
// =============================================================================
function TokenPrompt({ error, url }) {
  const [val, setVal]       = useState("");
  const [showVal, setShow]  = useState(false);
  const [submitting, setSb] = useState(false);

  const submit = (e) => {
    e?.preventDefault?.();
    const t = val.trim();
    if (!t) return;
    setSb(true);
    writeToken(t);
    window.dispatchEvent(new CustomEvent(TOKEN_EVENT, { detail: { token: t } }));
    // The provider effect will pick it up; we keep the spinner until a
    // re-render swaps us out.
    setTimeout(() => setSb(false), 800);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(3,7,13,0.92)",
      backdropFilter: "blur(6px)",
    }}>
      <form onSubmit={submit}
        className="panel panel--glow"
        style={{
          position: "relative", width: 460, maxWidth: "92vw",
          padding: 24, display: "flex", flexDirection: "column", gap: 14,
          border: "1px solid var(--line-strong)",
          background: "rgba(5,16,28,0.9)",
        }}>
        <CornerBrackets />
        <div className="label-tag label-tag--accent">{window.t("token.label")}</div>
        <div className="h-display" style={{ fontSize: 20, letterSpacing: "0.12em", color: "var(--text-0)", textShadow: "0 0 10px rgba(0,217,255,0.25)" }}>
          {window.t("token.heading")}
        </div>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-2)", lineHeight: 1.6 }}>
          {window.t("token.target")}&nbsp;<span style={{ color: "var(--accent)" }}>{url || "—"}</span><br/>
          {window.t("token.help")}<br/>
          {window.t("token.persistence")}
        </div>

        {error && (
          <div className="t-mono" style={{
            fontSize: 10, color: "var(--danger)",
            border: "1px solid var(--danger)", padding: "6px 10px",
            background: "rgba(255,74,107,0.08)",
          }}>
            ✕ {error}
          </div>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="label-tag">TOKEN</span>
          <input
            type={showVal ? "text" : "password"}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="eyJhbGciOi…"
            style={{
              padding: "10px 12px",
              fontFamily: "var(--font-mono)", fontSize: 12,
              background: "rgba(0,0,0,0.4)",
              color: "var(--text-0)",
              border: "1px solid var(--line-strong)",
              outline: "none",
            }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "var(--text-2)" }}>
          <input type="checkbox" checked={showVal} onChange={(e) => setShow(e.target.checked)} />
          <span className="t-mono" style={{ letterSpacing: "0.12em" }}>AFFICHER</span>
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button type="submit" className="btn" disabled={submitting || !val.trim()}
            style={{ padding: "10px 16px", flex: 1, letterSpacing: "0.18em" }}>
            {submitting ? "CONNEXION…" : "CONNECTER"}
          </button>
        </div>
      </form>
    </div>
  );
}

window.HAProvider        = HAProvider;
window.useHA             = useHA;
window.useEntity         = useEntity;
window.useEntityActions  = useEntityActions;
window.useForecast       = useForecast;
window.TokenPrompt       = TokenPrompt;
