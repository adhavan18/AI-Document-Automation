import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { generationLimiter } from '../middleware/rateLimiter.js';
import { generateImages, regenerateImage, getHistory } from './generationController.js';

const router = Router();
router.use(authenticate);

router.post('/images', generationLimiter, generateImages);
router.post('/regenerate', generationLimiter, regenerateImage);
router.get('/history', getHistory);

export default router;
