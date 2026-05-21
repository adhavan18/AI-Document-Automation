import { authService } from './authService.js';
import { asyncWrap } from '../middleware/errorHandler.js';

export const register = asyncWrap(async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }
  const result = await authService.register({ email, password, name });
  res.status(201).json(result);
});

export const login = asyncWrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const result = await authService.login({ email, password });
  res.json(result);
});

export const logout = (_req, res) => {
  res.json({ success: true });
};

export const me = asyncWrap(async (req, res) => {
  const user = authService.me(req.user.id);
  res.json(user);
});
