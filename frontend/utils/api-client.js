export const API_BASE = 'http://20.102.105.142:8000';
export const CLIENT_CODE = 'GCMNOTICEAI';
export const AGENT_KEY = 'ps_ucwwlgNVHBP7-BbOy1w34Nze-CysWLaREP8ZehhHu8I';

function getToken() {
  return localStorage.getItem('azure_access_token') || '';
}

function loginRedirect() {
  const inPublic = window.location.pathname !== '/' && window.location.pathname !== '/index.html';
  window.location.href = 'login.html';
}

export async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const resp = await fetch(API_BASE + endpoint, { ...options, headers });
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
