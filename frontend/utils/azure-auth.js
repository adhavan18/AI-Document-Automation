const MSAL_CONFIG = {
  auth: {
    clientId: '7bba318f-5cbe-422f-924c-4fe464585950',
    authority: 'https://login.microsoftonline.com/656818f9-40ee-4f41-9857-72df40fc198b',
    redirectUri: window.location.origin + (window.location.pathname.includes('/public/') ? '/public/' : '/'),
  },
  cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
};

const TOKEN_KEY = 'azure_access_token';
const TOKEN_EXPIRY_KEY = 'azure_token_expiry';
const USER_KEY = 'gip_user';
const API_BASE = 'http://20.102.105.142:8000';
const API_SCOPE = 'api://7bba318f-5cbe-422f-924c-4fe464585950/.default';

let _msalInstance = null;

function getMsal() {
  if (!_msalInstance) {
    _msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);
  }
  return _msalInstance;
}

export async function handleRedirect() {
  const msalApp = getMsal();
  try {
    const result = await msalApp.handleRedirectPromise();
    if (result && result.accessToken) {
      _storeToken(result.accessToken, result.expiresOn);
      await _fetchAndStoreUser(result.accessToken);
      return true;
    }
  } catch (e) {
    console.error('[auth] redirect error', e);
  }
  return false;
}

export async function signIn() {
  const msalApp = getMsal();
  try {
    const result = await msalApp.loginPopup({ scopes: [API_SCOPE] });
    if (result && result.accessToken) {
      _storeToken(result.accessToken, result.expiresOn);
      await _fetchAndStoreUser(result.accessToken);
      return true;
    }
  } catch (e) {
    if (e.errorCode !== 'user_cancelled') console.error('[auth] sign-in error', e);
  }
  return false;
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
  const msalApp = getMsal();
  const accounts = msalApp.getAllAccounts();
  if (accounts.length > 0) {
    msalApp.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: window.location.origin + '/login.html' });
  } else {
    window.location.href = '/login.html';
  }
}

export async function getAccessToken() {
  const cached = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
  if (cached && Date.now() < expiry - 60000) return cached;

  const msalApp = getMsal();
  const accounts = msalApp.getAllAccounts();
  if (accounts.length === 0) {
    _redirectToLogin();
    return null;
  }
  try {
    const result = await msalApp.acquireTokenSilent({ scopes: [API_SCOPE], account: accounts[0] });
    _storeToken(result.accessToken, result.expiresOn);
    return result.accessToken;
  } catch (e) {
    console.error('[auth] silent token failed', e);
    _redirectToLogin();
    return null;
  }
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}

export function isAuthenticated() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
  return !!(token && Date.now() < expiry);
}

function _storeToken(token, expiresOn) {
  localStorage.setItem(TOKEN_KEY, token);
  const expiry = expiresOn ? new Date(expiresOn).getTime() : Date.now() + 3600000;
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
}

async function _fetchAndStoreUser(token) {
  try {
    const r = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (r.ok) {
      const user = await r.json();
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  } catch (e) { console.error('[auth] user fetch failed', e); }
}

function _redirectToLogin() {
  const login = window.location.pathname.includes('/public/') ? '../login.html' : 'login.html';
  window.location.href = login;
}
