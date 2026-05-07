import { Router } from 'express';
import { callWithFallback } from '../lib/ai-with-fallback.js';

const router = Router();

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
      return res
        .status(400)
        .json({ error: 'Unsupported file type. Upload a PDF or image.' });
    }

    const contentBlock = isPdf
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Data,
          },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Data,
          },
        };

    const prompt = `You are an AI extraction engine for immigration documents. You have been given a USCIS I-797 Notice of Action.

Extract exactly these 5 fields from the document:
1. receipt_number — the USCIS receipt number (format: 3 letters + 10 digits, e.g. WAC2190123456)
2. beneficiary_name — the full name of the beneficiary/applicant
3. notice_date — the date printed on the notice (format it as "Month DD, YYYY")
4. receipt_date — the date the petition was received (format it as "Month DD, YYYY")
5. service_center — the USCIS service center name (e.g. "California Service Center")

For each field, also provide a confidence score from 0 to 100 representing how clearly the field was visible and extracted.

Respond ONLY with a valid JSON object. No explanation, no markdown, no code fences. Exactly this structure:

{
  "fields": [
    { "key": "receipt_number", "label": "Receipt Number", "value": "<extracted value>", "confidence": <0-100> },
    { "key": "beneficiary_name", "label": "Beneficiary Name", "value": "<extracted value>", "confidence": <0-100> },
    { "key": "notice_date", "label": "Notice Date", "value": "<extracted value>", "confidence": <0-100> },
    { "key": "receipt_date", "label": "Receipt Date", "value": "<extracted value>", "confidence": <0-100> },
    { "key": "service_center", "label": "Service Center", "value": "<extracted value>", "confidence": <0-100> }
  ],
  "processing_time_ms": <actual ms taken>,
  "document_type": "I-797 Notice of Action"
}

If a field cannot be found, set value to "Not found" and confidence to 0.`;

    const start = Date.now();

    const { text: rawText, provider } = await callWithFallback(
      {
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [contentBlock, { type: 'text', text: prompt }],
          },
        ],
      },
      () => {
        const part = isImage
          ? { inlineData: { mimeType, data: base64Data } }
          : { inlineData: { mimeType: 'application/pdf', data: base64Data } };
        return [part, prompt];
      }
    );

    const elapsed = Date.now() - start;
    console.log(`[extract] responded via ${provider}`);

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    parsed.processing_time_ms = elapsed;

    res.json(parsed);
  } catch (err) {
    console.error('[extract] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
