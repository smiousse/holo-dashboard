// HOLO HOME OS — i18n.
// Translates hardcoded UI strings driven by APP_CONFIG.language ("en" | "fr").
// Config labels (zone names, scene labels, calendar source names) are NOT
// translated — author per-language config.json files instead.
//
// Globals exposed:
//   • window.LANG               — Intl-compatible locale ("en-CA" | "fr-CA")
//   • window.t(key, vars?)      — flat-key dict lookup, {var} interpolation
//   • window.formatDate(d, opts?) — Intl.DateTimeFormat in current lang
//   • window.formatTime(d)      — locale HH:mm
//   • window.weekdayNames(style)— ["Mon","Tue",...] (style: short|long|narrow)
//
// Load order: AFTER config-loader.jsx (chains on __configReady), BEFORE all
// consumers. LANG is guaranteed set before any consumer renders because we
// extend the __configReady promise chain.

(function () {
  const LANG_TO_LOCALE = { en: "en-CA", fr: "fr-CA" };

  // Seed dictionary — extend per file as the JSX sweep progresses.
  // Keep flat. Values may be strings (with {var} placeholders) or arrays.
  const DICT = {
    en: {
      "alerts.high_garage_humidity": "High garage humidity · {pct}%",
      "alerts.garage_door_open":     "Garage door open",
      "alerts.dryer_running":        "Dryer running · {time}",
      "alerts.motion":               "Motion · {name}",
      "alerts.low_battery":          "Low battery · {name}",

      "token.label":       "CONNECTION · HOME ASSISTANT",
      "token.heading":     "ACCESS TOKEN REQUIRED",
      "token.target":      "TARGET",
      "token.help":        "Paste a long-lived access token. HA → Profile → Security → Create token.",
      "token.persistence": "The token is kept in this browser's localStorage only.",

      "tweaks.ha_connection": "HA connection",
      "tweaks.reset_token":   "Reset HA token",

      "calendar.fallback_view": "Month",
      "calendar.placeholder":   "e.g. Practice D1",

      "common.open":     "OPEN",
      "common.closed":   "CLOSED",
      "common.target":   "TARGET",
      "common.sensor":   "SENSOR",
      "common.appliance":"APPLIANCE",
      "common.remaining":"REMAINING",
      "common.end":      "END",
      "common.humidity": "HUMIDITY",
      "common.condition":"CONDITION",
      "common.close":    "CLOSE",

      "tags.light":     "LIGHT",
      "tags.fan":       "FAN",
      "tags.switch":    "SWITCH",

      "topbar.indoor":      "INDOOR",
      "topbar.outdoor":     "OUTDOOR",
      "topbar.avg_zones":   "AVG · {count} zones",
      "topbar.feels":       "FEELS {temp}°",
      "topbar.agenda":      "AGENDA",
      "topbar.tap_open":    "TAP TO OPEN",
      "topbar.armed":       "ARMED · HOME",
      "topbar.disarmed":    "DISARMED",
      "topbar.tap_disarm":  "TAP TO DISARM",
      "topbar.tap_arm":     "TAP TO ARM",
      "topbar.stardate":    "STARDATE",
      "topbar.operator":    "OPERATOR PRESENT",
      "topbar.calendar":    "CALENDAR",
      "topbar.security":    "SECURITY",
      "topbar.residence":   "v3.14 · NORTH RESIDENCE",

      "floorplan.upper":    "UPPER",
      "floorplan.basement": "BASEMENT",
      "floorplan.live":     "PLAN · LIVE · HA-WS",
      "floorplan.zones_north": "{count} ZONES · NORTH ↑",

      "boot.0": "INIT · CORE BOOTLOADER",
      "boot.1": "MOUNTING /home/* PARTITIONS",
      "boot.2": "LINKING THERMOSTAT MESH · 6 NODES",
      "boot.3": "LINKING LIGHTING MESH · 6 NODES",
      "boot.4": "AUTH · WELL PUMP · OK",
      "boot.5": "AUTH · WATER HEATER · OK",
      "boot.6": "AUTH · FLOOR LOOP · OK",
      "boot.7": "PINGING CAMERAS · 5 ONLINE",
      "boot.8": "WEATHER FEED · LOCKED",
      "boot.9": "HOLO HOME OS · READY",
      "boot.tagline": "v3.14 · RESIDENTIAL CORE",
      "boot.footer":  "STARDATE LOCK · NORTH ZONE · OPERATOR PRESENT",

      "systems.critical":   "CRITICAL SYSTEMS",
      "systems.active":     "{on}/{total} ACTIVE",
      "systems.alerts":     "● ALERTS",
      "systems.open":       "{count} OPEN",

      "cameras.header":     "CAMERAS",
      "cameras.refresh":    "REFRESH ALL",
      "cameras.refreshing": "REFRESHING…",
      "cameras.refresh_title": "Trigger snapshot upload on all cameras",
      "cameras.snapshots_only": "SNAPSHOTS · NO LIVE FEED",
      "cameras.garage":     "GARAGE",
      "cameras.garage_door":"GARAGE DOOR",

      "ticker.telemetry":   "TELEMETRY ▸",

      "weather.today":      "TODAY",
      "weather.day_plus":   "D+{n}",

      "calendar.today":     "TODAY",
      "calendar.tomorrow":  "TOMORROW",
      "calendar.all_day":   "ALL DAY",
      "calendar.today_btn": "TODAY",
      "calendar.filters":   "FILTERS",
      "calendar.all":       "ALL",
      "calendar.none":      "NONE",
      "calendar.add_day":   "Add to this day",
      "calendar.title":     "TITLE",
      "calendar.cal":       "CALENDAR",
      "calendar.when":      "WHEN",
      "calendar.location":  "LOCATION",
      "calendar.description":"DESCRIPTION",
      "calendar.full_day":  "ALL DAY",
      "calendar.optional":  "Optional",
      "calendar.cancel":    "CANCEL",
      "calendar.cancel_title":"Cancel",
      "calendar.event_placeholder":"Event title…",
      "calendar.modal":     "MODAL",
      "calendar.drawer":    "DRAWER",
      "calendar.inline":    "INLINE",
      "calendar.empty":     "EMPTY",
      "calendar.no_events": "NO EVENTS · 7 D",
      "calendar.no_events_inline":"◇ NO EVENTS",
      "calendar.close_btn": "CLOSE",

      "floorplan.no_zones": "— NO ZONES —",

      "garage.tag":         "GARAGE",
      "garage.open":        "OPEN",
      "garage.closed":      "CLOSED",

      "ticker.dehum":       "DEHUM",
      "ticker.playroom_hum":"PLAY HUM",
      "ticker.dryer":       "DRYER",

      "floorplan.zone_active":"ZONE ACTIVE",
      "floorplan.tap":      "TAP",

      "extra.footer":       "TAP TO TRIGGER · THESE ACTIONS CALL",

      "weather.sunny":          "SUNNY",
      "weather.clear-night":    "CLEAR NIGHT",
      "weather.cloudy":         "CLOUDY",
      "weather.partlycloudy":   "PARTLY CLOUDY",
      "weather.rainy":          "RAINY",
      "weather.pouring":        "POURING",
      "weather.snowy":          "SNOWY",
      "weather.snowy-rainy":    "SNOWY · RAINY",
      "weather.fog":            "FOG",
      "weather.windy":          "WINDY",
      "weather.lightning":      "STORM",
      "weather.lightning-rainy":"STORM",
      "weather.hail":           "HAIL",
      "weather.exceptional":    "EXCEPTIONAL",

      "scenes.tap_trigger": "TAP TO TRIGGER",
      "scenes.more_actions":"More actions",
      "scenes.more_actions_btn":"MORE ACTIONS",
      "scenes.header":      "SCENES · MACROS",

      "footage.battery":     "BATTERY",
      "footage.battery_low": "LOW",
      "footage.battery_ok":  "OK",
      "footage.battery_wired":"WIRED",
      "footage.signal_sync": "SYNC",
      "footage.signal_wifi": "WI-FI",
      "footage.temp":        "TEMP.",
      "footage.last_clip":   "LAST CLIP",
      "footage.disarm":      "DISARM",
      "footage.arm":         "ARM",
      "footage.triggering":  "TRIGGERING…",
      "footage.retrigger":   "RE-TRIGGER",
      "footage.dbm_bars":    "{dbm} dBm · {bars}/4",
      "footage.bars":        "{val}/4 bars",
      "footage.ago":         "{ago} ago",
      "footage.note":        "ⓘ THE INTEGRATION DOES NOT PROVIDE A LIVE VIDEO FEED · SNAPSHOTS ARE TRIGGERED ON DEMAND OR ON MOTION",

      "extra.filter":   "Filter actions…",
      "extra.library":  "ACTION LIBRARY",
      "extra.title":    "AUTOMATIONS",
      "extra.count":    "{actions} ACTIONS · {cats} CATEGORIES",
      "extra.close":    "CLOSE",
      "extra.no_results":"◇ NO ACTION FOUND",

      "calendar.header":  "CALENDAR · {days}D",
      "calendar.add_to":      "ADD TO CALENDAR",
      "calendar.add_day_btn": "ADD TO THIS DAY",
      "calendar.until":       "UNTIL",
      "calendar.sent_to":     "◇ SENT TO",
      "calendar.new_event":   "NEW EVENT",
      "calendar.add":         "ADD",

      "footage.motion_detected":"● MOTION DETECTED",
      "footage.armed":          "● ARMED",
      "footage.disarmed":       "○ DISARMED",

      "extra.script_run":   "SCRIPT EXECUTED ·",

      "weather.forecast":   "FORECAST · 5 DAYS",
      "weather.loading":    "LOADING FORECAST…",

      "tweaks.title":       "Tweaks",
      "tweaks.close":       "Close tweaks",

      "zone.detail":        "ZONE · DETAIL · {floor}",
      "zone.entities":      "{count} ENTITIES",
      "zone.link_ok":       "● HA · LINK OK",
      "zone.linking":       "… LINKING {id}",
      "zone.cover_garage":  "GARAGE COVER",
      "zone.current_c":     "CURRENT °C",
      "zone.printer_3d":    "3D PRINTER",
    },
    fr: {
      "alerts.high_garage_humidity": "Humidité garage élevée · {pct}%",
      "alerts.garage_door_open":     "Porte de garage ouverte",
      "alerts.dryer_running":        "Sécheuse en cours · {time}",
      "alerts.motion":               "Mouvement · {name}",
      "alerts.low_battery":          "Batterie faible · {name}",

      "token.label":       "CONNEXION · HOME ASSISTANT",
      "token.heading":     "JETON D'ACCÈS REQUIS",
      "token.target":      "CIBLE",
      "token.help":        "Coller un long-lived access token. HA → Profil → Sécurité → Créer un jeton.",
      "token.persistence": "Le jeton est conservé dans le localStorage de ce navigateur uniquement.",

      "tweaks.ha_connection": "Connexion HA",
      "tweaks.reset_token":   "Réinitialiser le jeton HA",

      "calendar.fallback_view": "Mois",
      "calendar.placeholder":   "Ex. Pratique D1",

      "common.open":     "OUVERT",
      "common.closed":   "FERMÉ",
      "common.target":   "CIBLE",
      "common.sensor":   "CAPTEUR",
      "common.appliance":"APPAREIL",
      "common.remaining":"RESTANT",
      "common.end":      "FIN",
      "common.humidity": "HUMIDITÉ",
      "common.condition":"CONDITION",
      "common.close":    "FERMER",

      "tags.light":     "LUMIÈRE",
      "tags.fan":       "VENTILATEUR",
      "tags.switch":    "SWITCH",

      "topbar.indoor":      "INTÉRIEUR",
      "topbar.outdoor":     "EXTÉRIEUR",
      "topbar.avg_zones":   "MOY · {count} zones",
      "topbar.feels":       "RESSENTI {temp}°",
      "topbar.agenda":      "AGENDA",
      "topbar.tap_open":    "TOUCHER POUR OUVRIR",
      "topbar.armed":       "ARMÉ · MAISON",
      "topbar.disarmed":    "DÉSARMÉ",
      "topbar.tap_disarm":  "TOUCHER POUR DÉSARMER",
      "topbar.tap_arm":     "TOUCHER POUR ARMER",
      "topbar.stardate":    "STARDATE",
      "topbar.operator":    "OPÉRATEUR PRÉSENT",
      "topbar.calendar":    "CALENDRIER",
      "topbar.security":    "SÉCURITÉ",
      "topbar.residence":   "v3.14 · RÉSIDENCE NORD",

      "floorplan.upper":    "RDC",
      "floorplan.basement": "SOUS-SOL",
      "floorplan.live":     "PLAN · LIVE · HA-WS",
      "floorplan.zones_north": "{count} ZONES · NORD ↑",

      "boot.0": "INIT · BOOTLOADER PRINCIPAL",
      "boot.1": "MONTAGE /home/* PARTITIONS",
      "boot.2": "LIAISON RÉSEAU THERMOSTAT · 6 NŒUDS",
      "boot.3": "LIAISON RÉSEAU ÉCLAIRAGE · 6 NŒUDS",
      "boot.4": "AUTH · POMPE À PUITS · OK",
      "boot.5": "AUTH · CHAUFFE-EAU · OK",
      "boot.6": "AUTH · BOUCLE PLANCHER · OK",
      "boot.7": "PING CAMÉRAS · 5 EN LIGNE",
      "boot.8": "FLUX MÉTÉO · VERROUILLÉ",
      "boot.9": "HOLO HOME OS · PRÊT",
      "boot.tagline": "v3.14 · NOYAU RÉSIDENTIEL",
      "boot.footer":  "VERROU STARDATE · ZONE NORD · OPÉRATEUR PRÉSENT",

      "systems.critical":   "SYSTÈMES CRITIQUES",
      "systems.active":     "{on}/{total} ACTIFS",
      "systems.alerts":     "● ALERTES",
      "systems.open":       "{count} OUVERTES",

      "cameras.header":     "CAMÉRAS",
      "cameras.refresh":    "RAFRAÎCHIR TOUT",
      "cameras.refreshing": "RAFRAÎCHISSEMENT…",
      "cameras.refresh_title":"Déclencher un snapshot sur toutes les caméras",
      "cameras.snapshots_only": "SNAPSHOTS · PAS DE FLUX LIVE",
      "cameras.garage":     "GARAGE",
      "cameras.garage_door":"PORTE DE GARAGE",

      "ticker.telemetry":   "TÉLÉMÉTRIE ▸",

      "weather.today":      "AUJOURD'HUI",
      "weather.day_plus":   "J+{n}",

      "calendar.today":     "AUJOURD'HUI",
      "calendar.tomorrow":  "DEMAIN",
      "calendar.all_day":   "JOURNÉE",
      "calendar.today_btn": "AUJOURD'HUI",
      "calendar.filters":   "FILTRES",
      "calendar.all":       "TOUS",
      "calendar.none":      "AUCUN",
      "calendar.add_day":   "Ajouter à cette journée",
      "calendar.title":     "TITRE",
      "calendar.cal":       "CALENDRIER",
      "calendar.when":      "QUAND",
      "calendar.location":  "LIEU",
      "calendar.description":"DESCRIPTION",
      "calendar.full_day":  "TOUTE LA JOURNÉE",
      "calendar.optional":  "Optionnel",
      "calendar.cancel":    "ANNULER",
      "calendar.cancel_title":"Annuler",
      "calendar.event_placeholder":"Titre de l'événement…",
      "calendar.modal":     "MODAL",
      "calendar.drawer":    "DRAWER",
      "calendar.inline":    "INLINE",
      "calendar.empty":     "VIDE",
      "calendar.no_events": "AUCUN ÉVÉNEMENT · 7 J",
      "calendar.no_events_inline":"◇ AUCUN ÉVÉNEMENT",
      "calendar.close_btn": "FERMER",

      "floorplan.no_zones": "— AUCUNE ZONE —",

      "garage.tag":         "GARAGE",
      "garage.open":        "OUVERT",
      "garage.closed":      "FERMÉ",

      "ticker.dehum":       "DÉSHUM",
      "ticker.playroom_hum":"S.JEUX HUM",
      "ticker.dryer":       "SÉCHEUSE",

      "floorplan.zone_active":"ZONE ACTIVE",
      "floorplan.tap":      "TOUCHEZ",

      "extra.footer":       "TOUCHEZ POUR DÉCLENCHER · CES ACTIONS APPELLENT",

      "weather.sunny":          "SOLEIL",
      "weather.clear-night":    "NUIT CLAIRE",
      "weather.cloudy":         "NUAGEUX",
      "weather.partlycloudy":   "PARTIEL",
      "weather.rainy":          "PLUIE",
      "weather.pouring":        "AVERSES",
      "weather.snowy":          "NEIGE",
      "weather.snowy-rainy":    "NEIGE · PLUIE",
      "weather.fog":            "BROUILLARD",
      "weather.windy":          "VENTEUX",
      "weather.lightning":      "ORAGE",
      "weather.lightning-rainy":"ORAGE",
      "weather.hail":           "GRÊLE",
      "weather.exceptional":    "EXCEPTIONNEL",

      "scenes.tap_trigger": "TOUCHER POUR DÉCLENCHER",
      "scenes.more_actions":"Plus d'actions",
      "scenes.more_actions_btn":"PLUS D'ACTIONS",
      "scenes.header":      "SCÈNES · MACROS",

      "footage.battery":     "BATTERIE",
      "footage.battery_low": "FAIBLE",
      "footage.battery_ok":  "OK",
      "footage.battery_wired":"BRANCHÉE",
      "footage.signal_sync": "SYNC",
      "footage.signal_wifi": "WI-FI",
      "footage.temp":        "TEMP.",
      "footage.last_clip":   "DERN. CLIP",
      "footage.disarm":      "DÉSARMER",
      "footage.arm":         "ARMER",
      "footage.triggering":  "DÉCLENCHEMENT…",
      "footage.retrigger":   "RE-DÉCLENCHER",
      "footage.dbm_bars":    "{dbm} dBm · {bars}/4",
      "footage.bars":        "{val}/4 barres",
      "footage.ago":         "il y a {ago}",
      "footage.note":        "ⓘ L'INTÉGRATION N'OFFRE PAS DE FLUX VIDÉO EN DIRECT · LES SNAPSHOTS SONT DÉCLENCHÉS À LA DEMANDE OU AU MOUVEMENT",

      "extra.filter":   "Filtrer les actions…",
      "extra.library":  "BIBLIOTHÈQUE D'ACTIONS",
      "extra.title":    "AUTOMATISATIONS",
      "extra.count":    "{actions} ACTIONS · {cats} CATÉGORIES",
      "extra.close":    "FERMER",
      "extra.no_results":"◇ AUCUNE ACTION TROUVÉE",

      "calendar.header":  "CALENDRIER · {days}J",
      "calendar.add_to":      "AJOUTER AU CALENDRIER",
      "calendar.add_day_btn": "AJOUTER À CETTE JOURNÉE",
      "calendar.until":       "JUSQU'AU",
      "calendar.sent_to":     "◇ ENVOYÉ À",
      "calendar.new_event":   "NOUVEL ÉVÉNEMENT",
      "calendar.add":         "AJOUTER",

      "footage.motion_detected":"● MOUVEMENT DÉTECTÉ",
      "footage.armed":          "● ARMÉE",
      "footage.disarmed":       "○ DÉSARMÉE",

      "extra.script_run":   "SCRIPT EXÉCUTÉ ·",

      "weather.forecast":   "PRÉVISIONS · 5 JOURS",
      "weather.loading":    "CHARGEMENT DES PRÉVISIONS…",

      "tweaks.title":       "Réglages",
      "tweaks.close":       "Fermer les réglages",

      "zone.detail":        "ZONE · DÉTAIL · {floor}",
      "zone.entities":      "{count} ENTITÉS",
      "zone.link_ok":       "● HA · LIEN OK",
      "zone.linking":       "… LIAISON {id}",
      "zone.cover_garage":  "COUVERTURE · GARAGE",
      "zone.current_c":     "ACTUEL °C",
      "zone.printer_3d":    "IMPRIMANTE 3D",
    },
  };

  const warned = new Set();

  function shortLang() {
    return (window.LANG || "en-CA").startsWith("fr") ? "fr" : "en";
  }

  function interp(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : "{" + k + "}"
    );
  }

  window.t = function t(key, vars) {
    const l = shortLang();
    let v = DICT[l] && DICT[l][key];
    if (v === undefined) v = DICT.en[key];
    if (v === undefined) {
      if (!warned.has(key)) { warned.add(key); console.warn("[i18n] missing key:", key); }
      return key;
    }
    return typeof v === "string" ? interp(v, vars) : v;
  };

  window.formatDate = function (d, opts) {
    return new Intl.DateTimeFormat(window.LANG || "en-CA", opts || { dateStyle: "medium" }).format(d);
  };

  window.formatTime = function (d) {
    return new Intl.DateTimeFormat(window.LANG || "en-CA", { hour: "2-digit", minute: "2-digit" }).format(d);
  };

  // Returns 7 names starting Monday — derived from Intl, no hand-translation.
  window.weekdayNames = function (style = "short") {
    const fmt = new Intl.DateTimeFormat(window.LANG || "en-CA", { weekday: style });
    const monday = new Date(2026, 0, 5); // 2026-01-05 is a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(d.getDate() + i);
      return fmt.format(d);
    });
  };

  // Chain on __configReady so LANG is set before any consumer awaits it.
  // Extending the promise (rather than fire-and-forget) means anyone awaiting
  // __configReady will only see a resolved cfg once LANG is ready.
  if (window.__configReady && typeof window.__configReady.then === "function") {
    window.__configReady = window.__configReady.then((cfg) => {
      const l = (cfg && cfg.language) || "en";
      window.LANG = LANG_TO_LOCALE[l] || "en-CA";
      return cfg;
    });
  } else {
    window.LANG = "en-CA";
  }
})();
