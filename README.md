# Legal Document Intelligence

3-tab  app showcasing AI document processing for immigration workflows.

## Quick Start

### 1. Backend
cd backend
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and GOOGLE_GEMINI_API_KEY in .env
npm install
node server.js

### 2. Frontend
cd frontend
npm install
npm run dev

Frontend: http://localhost:5173
Backend health: http://localhost:3001/health

## Demo Flow (12 minutes)

**Before the demo:** Open http://localhost:5173. Press Ctrl+Shift+D to show the demo banner.

**Tab 1 — Notice Extraction (3 min)**
1. Click "Notice Extraction" tab
2. Click "Use Sample I-797"
3. Click "Extract Fields"
4. Walk through the 5 extracted fields and confidence badges
   - Talking point: "What used to take 5 minutes of manual entry, the AI did in 8 seconds."

**Tab 2 — Compliance Document (3 min)**
1. Click "Compliance Document" tab
2. Select "Matter 001 — H-1B Extension · Acme Corp"
3. Click "Generate Document"
4. Walk through the rendered compliance document
5. Click "Download PDF" to show the downloadable output
   - Talking point: "Every field on this PDF came from data that already existed. No reviewer typed anything."

**Tab 3 — Automate Filing (H4 EAD) (3 min)**
1. Click "Automate Filing (H4 EAD)" tab
2. Click "Use Sample Passport"
3. Click "Run Validation"
4. Walk through the comparison table — point out the 3 red mismatch rows
   - Talking point: "Three mismatches — the human reviewer would have caught one, maybe two. The AI caught all three."

**Close (1 min)**
- "The pilot adds breadth, integrations, and production stability. Today you saw the core."
