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

const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicKey || anthropicKey === 'your_anthropic_api_key_here') {
  console.warn(
    '[startup] ANTHROPIC_API_KEY is missing or placeholder — Claude routes will fail until it is set in backend/.env.'
  );
}

const awsKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
if (!awsKeyId || awsKeyId === 'your_aws_access_key_id_here' || !awsSecret || awsSecret === 'your_aws_secret_access_key_here') {
  console.warn(
    '[startup] AWS credentials are missing or placeholder — Textract routes will fail until AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in backend/.env.'
  );
}
