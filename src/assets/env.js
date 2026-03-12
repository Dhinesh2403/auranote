// Runtime environment configuration (DO NOT commit secrets here).
//
// Deployment options:
//  - For static hosting, replace this file during CI/CD with real values.
//  - For Capacitor/Android, prefer a backend/proxy or native secure storage; anything shipped in the app can be extracted.
//
// Example injected at deploy time:
//   window.__ENV = { /* values injected here */ };
//
// Notes about GitHub Pages / browser builds:
//  - GitHub Actions "Secrets" and "Variables" are ONLY available to the CI runner during the workflow.
//  - They are NOT automatically exposed to the deployed site, and they won't show up in `window.__ENV` by themselves.
//  - To use them in this app, you must inject them at build/deploy time (e.g., generate/replace this file in a workflow step)
//    or host an env script that sets the desired properties on window.__ENV before the app loads.

(function () {
  window.__ENV = window.__ENV || {};
  // Intentionally blank by default.
  // Provide AURA runtime configuration to enable chat features.
  window.__ENV.AURA_ENDPOINT = window.__ENV.AURA_ENDPOINT || '';
  window.__ENV.AURA_API_KEY = window.__ENV.AURA_API_KEY || '';

})();
