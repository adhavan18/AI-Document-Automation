import { Router } from 'express';
import puppeteer from 'puppeteer';
import { buildI129HTML } from '../templates/i129-template.js';

const router = Router();

const MATTERS = {
  '001': {
    id: '001',
    type: 'H-1B Extension',
    company: 'Acme Corporation',
    company_address: '100 Market Street, San Francisco, CA 94105',
    position: 'Software Engineer II',
    soc_code: '15-1252',
    soc_title: 'Software Developers',
    worksite: 'San Francisco, CA',
    wage_level: 'Level II',
    wage_amount: '$134,000',
    wage_period: 'per year',
    prevailing_wage: '$128,000 per year',
    start_date: 'July 1, 2024',
    end_date: 'June 30, 2027',
    beneficiary: 'John A. Smith',
    attorney: 'Jane Doe, Esq.',
    law_firm: 'Doe Immigration Law Group',
  },
  '002': {
    id: '002',
    type: 'L-1A Transfer',
    company: 'GlobalTech Inc',
    company_address: '500 Fifth Avenue, New York, NY 10110',
    position: 'Senior Manager, Engineering',
    soc_code: '11-1021',
    soc_title: 'General and Operations Managers',
    worksite: 'New York, NY',
    wage_level: 'Level III',
    wage_amount: '$175,000',
    wage_period: 'per year',
    prevailing_wage: '$162,000 per year',
    start_date: 'August 15, 2024',
    end_date: 'August 14, 2027',
    beneficiary: 'Priya Nair',
    attorney: 'Robert Chen, Esq.',
    law_firm: 'Chen & Associates Immigration',
  },
  '003': {
    id: '003',
    type: 'O-1 Initial',
    company: 'Innovate LLC',
    company_address: '2000 University Ave, Palo Alto, CA 94301',
    position: 'Principal Research Scientist',
    soc_code: '15-2051',
    soc_title: 'Data Scientists',
    worksite: 'Palo Alto, CA',
    wage_level: 'Level IV',
    wage_amount: '$220,000',
    wage_period: 'per year',
    prevailing_wage: '$198,000 per year',
    start_date: 'September 1, 2024',
    end_date: 'August 31, 2027',
    beneficiary: 'Dr. Amir Hassan',
    attorney: 'Susan Park, Esq.',
    law_firm: 'Park Immigration Group',
  },
};

router.post('/', async (req, res) => {
  let browser;
  try {
    const { matter_id } = req.body;

    if (!matter_id) {
      return res.status(400).json({ error: 'matter_id is required' });
    }

    const matter = MATTERS[matter_id];
    if (!matter) {
      return res.status(404).json({ error: `Matter ${matter_id} not found` });
    }

    const start = Date.now();

    const html = buildI129HTML(matter);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      printBackground: true,
    });

    await browser.close();
    browser = null;

    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    const elapsed = Date.now() - start;

    console.log(`[generate] I-129 PDF built for matter ${matter_id} in ${elapsed}ms (${pdfBuffer.length} bytes)`);

    res.json({
      pdfBase64,
      matter,
      processing_time_ms: elapsed,
    });
  } catch (err) {
    console.error('[generate] error:', err.message);
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
