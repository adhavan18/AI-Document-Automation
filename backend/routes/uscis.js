import { Router } from 'express';

const router = Router();

// Simple 1-hour in-memory cache
const cache = new Map();

// ─── GET /api/uscis/status/:receiptNumber ─────────────────────────────────────
router.get('/status/:receiptNumber', async (req, res) => {
  const receipt = req.params.receiptNumber.toUpperCase().replace(/\s/g, '');

  if (!receipt.match(/^[A-Z]{3}\d{10}$/)) {
    return res.status(400).json({ error: 'Invalid receipt number format (expected e.g. EAC2490123456)' });
  }

  const cached = cache.get(receipt);
  if (cached && Date.now() - cached.fetchedAt < 3600000) {
    return res.json({ ...cached, fromCache: true });
  }

  try {
    const params = new URLSearchParams({
      appReceiptNum: receipt,
      caseStatusSearchBtn: 'CHECK STATUS',
    });

    const response = await fetch('https://egov.uscis.gov/casestatus/mycasestatus.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; immigration-pilot/1.0)',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`USCIS returned ${response.status}`);
    }

    const html = await response.text();

    // Extract status heading
    const titleMatch = html.match(/<h1[^>]*>\s*(.*?)\s*<\/h1>/is);
    const statusTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Extract status body paragraph
    const bodyMatch = html.match(/<p[^>]*class="[^"]*current[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      || html.match(/<div[^>]*class="[^"]*rows[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      || html.match(/<p>([\s\S]{20,500}?)<\/p>/);
    const statusBody = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    const result = {
      receiptNumber: receipt,
      statusTitle: statusTitle || 'Status retrieved',
      statusBody: statusBody || 'See USCIS.gov for details.',
      fetchedAt: Date.now(),
    };

    cache.set(receipt, result);
    res.json(result);
  } catch (err) {
    console.error('[uscis/status]', err.message);
    res.status(502).json({ error: `Could not reach USCIS: ${err.message}` });
  }
});

export default router;
