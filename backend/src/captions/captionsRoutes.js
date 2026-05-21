import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { generateCaption, updateCaption } from './captionsController.js';

const router = Router();
router.use(authenticate);

router.post('/generate', generateCaption);
router.put('/:imageId', updateCaption);

export default router;
