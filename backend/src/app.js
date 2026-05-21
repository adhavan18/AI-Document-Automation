import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import authRoutes from './auth/authRoutes.js';
import generationRoutes from './generation/generationRoutes.js';
import editorRoutes from './editor/editorRoutes.js';
import captionsRoutes from './captions/captionsRoutes.js';
import socialRoutes from './social/socialRoutes.js';
import publishingRoutes from './publishing/publishingRoutes.js';

const app = express();

app.use(cors({
  origin: config.cors.origins,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mosaic-manage',
    authMode: config.auth.mode,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/generate', generationRoutes);
app.use('/api/v1/editor', editorRoutes);
app.use('/api/v1/captions', captionsRoutes);
app.use('/api/v1/social', socialRoutes);
app.use('/api/v1/publish', publishingRoutes);

app.use(errorHandler);

export default app;
