import { Router } from 'express';
import puppeteer from 'puppeteer';

const router = Router();

router.post('/', async (req, res) => {
  let browser;
  try {
    const { html, filename } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'html is required' });
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm',
      },
      printBackground: true,
    });

    await browser.close();
    browser = null;

    const safeFilename = (filename || 'compliance-document').replace(
      /[^a-z0-9-_]/gi,
      '_'
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('[generate-pdf] error:', err.message);
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore close errors
      }
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
