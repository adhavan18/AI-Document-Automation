import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { userRepository } from '../repositories/userRepository.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const token = header.slice(7);

  try {
    if (config.auth.mode === 'local') {
      const payload = jwt.verify(token, config.auth.jwtSecret);
      const user = userRepository.findById(payload.userId);
      if (!user) return res.status(401).json({ error: 'User not found' });
      req.user = { id: user.id, email: user.email };
      return next();
    }

    if (config.auth.mode === 'mosaic') {
      if (!config.auth.mosaicApiUrl) {
        return res.status(500).json({ error: 'MOSAIC_API_URL not configured' });
      }
      const response = await fetch(`${config.auth.mosaicApiUrl}/api/auth/validate`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return res.status(401).json({ error: 'Invalid Mosaic token' });
      const mosaicUser = await response.json();
      req.user = { id: String(mosaicUser.id), email: mosaicUser.email, fromMosaic: true };
      return next();
    }

    return res.status(500).json({ error: `Unknown AUTH_MODE: ${config.auth.mode}` });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
