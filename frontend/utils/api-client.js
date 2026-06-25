function _cfg(key) {
  const c = window.GIP_CONFIG;
  if (!c || !c[key]) throw new Error(`GIP_CONFIG.${key} is not set — check env-config.js`);
  return c[key];
}

export function getApiBase()    { return _cfg('API_BASE'); }
export function getClientCode() { return _cfg('CLIENT_CODE'); }
export function getAgentKey()   { return _cfg('AGENT_KEY'); }

function getToken() {
  return localStorage.getItem('azure_access_token') || '';
}

function loginRedirect() {
  window.location.href = 'login.html';
}

export async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const resp = await fetch(getApiBase() + endpoint, { ...options, headers });
  if (resp.status === 401) {
    localStorage.removeItem('azure_access_token');
    localStorage.removeItem('azure_token_expiry');
    loginRedirect();
    return null;
  }
  return resp;
}

export async function apiJSON(endpoint, options = {}) {
  const resp = await apiCall(endpoint, options);
  if (!resp) return null;
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.json();
}

export async function apiBlob(endpoint, options = {}) {
  const resp = await apiCall(endpoint, options);
  if (!resp) return null;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.blob();
}
