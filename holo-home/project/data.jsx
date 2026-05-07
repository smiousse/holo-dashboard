// HOLO HOME OS — domain data shim.
//
// The previous version of this file inlined the full HOME_LAYOUT object.
// All wiring now lives in `config.json`, loaded and validated by
// `config-loader.jsx` (which runs before this file). That loader publishes:
//
//   • window.APP_CONFIG     — full validated config
//   • window.HOME_LAYOUT    — alias of APP_CONFIG (back-compat for components)
//   • window.THERMO_COLORS  — promoted out of here, sourced from config.thermoColors
//
// This file is kept as a barrier in the script load order: nothing here, but
// removing it would require updating the HTML and the consumers that still
// expect `window.HOME_LAYOUT` synchronously. Keep it; the components below it
// in the load order already gate on `window.__configReady` via App.
