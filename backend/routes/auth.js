import express from 'express';

const router = express.Router();
const GIP_API_BASE = process.env.GIP_API_BASE || 'http://20.102.105.142:8000';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ detail: 'username and password required' });
  }

  try {
    const gipRes = await fetch(`${GIP_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!gipRes.ok) {
      const err = await gipRes.json().catch(() => ({}));
      return res.status(gipRes.status).json(err || { detail: 'Authentication failed' });
    }

    const data = await gipRes.json();
    res.json(data);
  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ detail: 'Server error. Please try again.' });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ detail: 'No token provided' });
  }

  try {
    const gipRes = await fetch(`${GIP_API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!gipRes.ok) {
      return res.status(gipRes.status).json({ detail: 'User info unavailable' });
    }

    const data = await gipRes.json();
    res.json(data);
  } catch (err) {
    console.error('[auth] /me error:', err.message);
    res.status(500).json({ detail: 'Server error' });
  }
});

export default router;
