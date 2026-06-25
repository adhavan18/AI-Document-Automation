// Copy this file to env-config.js and fill in your values.
// env-config.js is gitignored — never commit real credentials.
window.GIP_CONFIG = {
  API_BASE:    'http://<your-api-host>:8000',
  CLIENT_ID:   '<azure-ad-client-id>',
  TENANT_ID:   '<azure-ad-tenant-id>',
  API_SCOPE:   'api://<azure-ad-client-id>/.default',
  CLIENT_CODE: '<agent-client-code>',
  AGENT_KEY:   '<agent-key>',
};
