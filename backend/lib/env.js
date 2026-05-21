import { existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env');
const envExamplePath = join(here, '..', '.env.example');

if (!existsSync(envPath) && existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envPath);
  console.warn(
    '[startup] .env not found — created from .env.example. Add your ANTHROPIC_API_KEY before calling Claude routes.'
  );
}

dotenv.config({ path: envPath });

const key = process.env.ANTHROPIC_API_KEY;
if (!key || key === 'your_anthropic_api_key_here') {
  console.warn(
    '[startup] ANTHROPIC_API_KEY is missing or placeholder — Claude routes will fail until it is set in backend/.env.'
  );
}
