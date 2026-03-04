// Runtime environment configuration (DO NOT commit secrets here).
//
// Deployment options:
//  - For static hosting, replace this file during CI/CD with real values.
//  - For Capacitor/Android, prefer a backend/proxy or native secure storage; anything shipped in the app can be extracted.
//
// Example injected at deploy time:
//   window.__ENV = { GEMINI_API_KEY: "..." };

(function () {
  window.__ENV = window.__ENV || {};
  // Intentionally blank by default.
  window.__ENV.GEMINI_API_KEY = window.__ENV.GEMINI_API_KEY || '';
})();
