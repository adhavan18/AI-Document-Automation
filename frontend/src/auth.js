const SESSION_KEY = 'poc_session';

const USERS = [
  {
    email: 'demo@lawfirm.com',
    password: 'demo2024',
    name: 'Sarah Mitchell',
    role: 'Immigration Paralegal',
  },
  {
    email: 'admin@lawfirm.com',
    password: 'admin2024',
    name: 'James Thornton',
    role: 'Senior Attorney',
  },
];

export function authenticate(email, password) {
  const user = USERS.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  return user || null;
}

export function saveSession(user) {
  const session = {
    email: user.email,
    name: user.name,
    role: user.role,
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('poc_cache_extract');
  localStorage.removeItem('poc_cache_generate');
  localStorage.removeItem('poc_cache_validate');
}
