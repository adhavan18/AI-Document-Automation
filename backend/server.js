import './lib/env.js';

import express from 'express';
import cors from 'cors';

import authRouter      from './routes/auth.js';
import uc1Router       from './routes/uc1.js';
import uc2Router       from './routes/uc2.js';
import uc3Router       from './routes/uc3.js';
import dashboardRouter from './routes/dashboard.js';
import deadlinesRouter from './routes/deadlines.js';
import uscisRouter     from './routes/uscis.js';
import searchRouter    from './routes/search.js';
import generatePdfRouter from './routes/generate-pdf.js';

const app = express();
const port = process.env.PORT || 3002;

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

app.use('/api/auth',     authRouter);
app.use('/api/uc1',      uc1Router);
app.use('/api/uc2',       uc2Router);
app.use('/api/uc3',       uc3Router);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/deadlines', deadlinesRouter);
app.use('/api/uscis',     uscisRouter);
app.use('/api/search',    searchRouter);
app.use('/api/generate/pdf', generatePdfRouter);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  WARNING: ANTHROPIC_API_KEY is not set. Claude calls will fail.');
}
if (!process.env.GOOGLE_GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: GOOGLE_GEMINI_API_KEY is not set. Gemini fallback will fail.');
}

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
