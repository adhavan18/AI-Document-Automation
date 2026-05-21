import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { generationLimiter } from '../middleware/rateLimiter.js';
import { promptEdit, saveCanvas } from './editorController.js';

const router = Router();
router.use(authenticate);

router.post('/prompt-edit', generationLimiter, promptEdit);
router.post('/save', saveCanvas);

export default router;
