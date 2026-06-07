import './lib/env.js';

import express from 'express';
import cors from 'cors';
import multer from 'multer';

import extractRouter from './routes/extract.js';
import generateRouter from './routes/generate.js';
import generatePdfRouter from './routes/generate-pdf.js';
import validateRouter from './routes/validate.js';

const app = express();
const port = process.env.PORT || 3001;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(cors());

app.use((req, res, next) => {
  res.setTimeout(60000, () => {
    console.error(`[timeout] ${req.method} ${req.path} exceeded 60s`);
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
  });
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/extract', upload.single('file'), extractRouter);
app.use('/api/generate/pdf', generatePdfRouter);
app.use('/api/generate', generateRouter);
app.use('/api/validate', upload.single('file'), validateRouter);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  WARNING: ANTHROPIC_API_KEY is not set. Claude calls will fail.');
}
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.warn('⚠️  WARNING: AWS credentials are not set. Textract calls will fail.');
}

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
