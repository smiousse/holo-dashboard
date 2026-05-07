## Local dev

```
./run_dev.sh            # serves project/ on http://localhost:8000/
./run_dev.sh -p 8080    # custom port
./run_dev.sh -h         # help
```

`file://` won't work — `config-loader.jsx` does `fetch("./config.json")`.

## HA token

The dashboard needs a long-lived Home Assistant access token. Two ways to provide it:

1. **TokenPrompt** (default) — first load shows a fullscreen prompt; paste the token, it's saved to `localStorage` of that browser only.
2. **`config.json`** — for kiosk/local-network deploys, set `connection.haLongLivedToken` in `project/config.json`. `localStorage` still wins (so the prompt overrides it), but this provides a default so a freshly-flashed device boots straight into the dashboard.

> Storing the token in `config.json` is fine for a private LAN-only kiosk. Don't commit it.

HA also needs this app's origin in `http.cors_allowed_origins` (then restart HA).