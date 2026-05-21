import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getConnections,
  instagramAuth,
  instagramCallback,
  disconnectInstagram,
  linkedinAuth,
  linkedinCallback,
  disconnectLinkedin,
} from './socialController.js';

const router = Router();

router.get('/connections', authenticate, getConnections);
router.get('/instagram/auth', authenticate, instagramAuth);
router.get('/instagram/callback', instagramCallback);     // no authenticate — browser redirect from OAuth
router.delete('/instagram', authenticate, disconnectInstagram);
router.get('/linkedin/auth', authenticate, linkedinAuth);
router.get('/linkedin/callback', linkedinCallback);       // no authenticate — browser redirect from OAuth
router.delete('/linkedin', authenticate, disconnectLinkedin);

export default router;
