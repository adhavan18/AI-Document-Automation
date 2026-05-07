import { Router } from 'express';
import { callWithFallback } from '../lib/ai-with-fallback.js';

const router = Router();

const QUESTIONNAIRE = {
  applicant_name: 'John Smith',
  date_of_birth: '03/15/1990',
  passport_number: 'A12345679',
  nationality: 'USA',
  expiry_date: '01/15/2030',
};

const FIELD_LABELS = {
  applicant_name: 'Full Name',
  date_of_birth: 'Date of Birth',
  passport_number: 'Passport Number',
  nationality: 'Nationality',
  expiry_date: 'Expiry Date',
};

function normalize(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function compareFields(docValue, questionnaireValue) {
  if (normalize(docValue) === normalize(questionnaireValue)) return 'MATCH';
  return 'MISMATCH';
}

router.post('/', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const base64Data = fileBuffer.toString('base64');

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (!isImage && !isPdf) {
      return res.status(400).json({
        error: 'Unsupported file type. Upload a passport image or PDF.',
      });
    }

    const contentBlock = isImage
      ? {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64Data },
        }
      : {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Data,
          },
        };

    const prompt = `You are an AI document extraction engine. You have been given a passport image or scan.

Extract exactly these 5 fields from the passport exactly as they appear printed on the document — do not reformat, normalize, or change the values:
1. applicant_name — the full name as printed (usually in all caps in the Machine Readable Zone)
2. date_of_birth — the date of birth exactly as printed on the passport (e.g. "15 MAR 1990")
3. passport_number — the passport number exactly as printed
4. nationality — the nationality/country code as printed
5. expiry_date — the expiry/date of expiry exactly as printed (e.g. "20 JAN 2030")

Respond ONLY with a valid JSON object. No explanation, no markdown, no code fences. Exactly this structure:

{
  "extracted": {
    "applicant_name": "<value as printed>",
    "date_of_birth": "<value as printed>",
    "passport_number": "<value as printed>",
    "nationality": "<value as printed>",
    "expiry_date": "<value as printed>"
  }
}

If a field cannot be found, use "Not found".`;

    const start = Date.now();

    const { text: rawText, provider } = await callWithFallback(
      {
        model: 'claude-opus-4-5',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [contentBlock, { type: 'text', text: prompt }],
          },
        ],
      },
      () => {
        const part = { inlineData: { mimeType, data: base64Data } };
        return [part, prompt];
      }
    );

    const elapsed = Date.now() - start;
    console.log(`[validate] responded via ${provider}`);

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const extracted = parsed.extracted;

    const comparison = Object.keys(QUESTIONNAIRE).map((key) => {
      const docValue = extracted[key] || 'Not found';
      const questionnaireValue = QUESTIONNAIRE[key];
      const status = compareFields(docValue, questionnaireValue);
      return {
        field: key,
        label: FIELD_LABELS[key],
        document_value: docValue,
        questionnaire_value: questionnaireValue,
        status,
      };
    });

    const mismatches = comparison.filter((r) => r.status === 'MISMATCH').length;
    const matches = comparison.filter((r) => r.status === 'MATCH').length;

    res.json({
      comparison,
      summary: { mismatches, matches, total: comparison.length },
      processing_time_ms: elapsed,
    });
  } catch (err) {
    console.error('[validate] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
