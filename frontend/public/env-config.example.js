// env-config.js is now served dynamically by Vite from frontend/.env
// Do NOT create a static env-config.js — it will be ignored.
//
// Instead, create frontend/.env with these keys:
//
//   API_BASE=http://<your-api-host>:8000
//   CLIENT_CODE=<agent-client-code>
//   AGENT_KEY=<agent-key>
//
// Vite reads .env at startup and serves /env-config.js with API_BASE set to ''
// so all browser requests go through the Vite proxy (no CORS issues).
