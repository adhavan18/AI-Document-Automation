import { Router } from 'express';
import { extractTextWithTextract } from '../lib/textract.js';
import { callWithFallback } from '../lib/ai-with-fallback.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mimetype, buffer } = req.file;
    const isImage = mimetype.startsWith('image/');
    const isPdf = mimetype === 'application/pdf';

    if (!isImage && !isPdf) {
      return res
        .status(400)
        .json({ error: 'Unsupported file type. Upload a PDF or image.' });
    }

    const start = Date.now();

    const rawText = await extractTextWithTextract(buffer);

    const prompt = `You are an AI extraction engine for immigration documents. Below is the text extracted from a USCIS I-797 Notice of Action.

EXTRACTED TEXT:
${rawText}

Extract exactly these 5 fields from the text above:
1. receipt_number — the USCIS receipt number (format: 3 letters + 10 digits, e.g. WAC2190123456)
2. beneficiary_name — the full name of the beneficiary/applicant
3. notice_date — the date printed on the notice (format it as "Month DD, YYYY")
4. receipt_date — the date the petition was received (format it as "Month DD, YYYY")
5. service_center — the USCIS service center name (e.g. "California Service Center")

For each field, also provide a confidence score from 0 to 100 representing how clearly the field was found in the text.

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

    const { text: rawResponse, provider } = await callWithFallback({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const elapsed = Date.now() - start;
    console.log(`[extract] responded via ${provider}`);

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      const cleaned = rawResponse.replace(/```json|```/g, '').trim();
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
