import { Router } from 'express';
import { callWithFallback } from '../lib/ai-with-fallback.js';

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
  try {
    const { matter_id } = req.body;

    if (!matter_id) {
      return res.status(400).json({ error: 'matter_id is required' });
    }

    const matter = MATTERS[matter_id];
    if (!matter) {
      return res.status(404).json({ error: `Matter ${matter_id} not found` });
    }

    const prompt = `You are a compliance document generator for US immigration cases. Generate a complete, professional Labor Condition Application (LCA) support letter / compliance document for the following matter.

Matter data:
${JSON.stringify(matter, null, 2)}

Generate a complete HTML document. Requirements:
- Use clean, professional HTML with inline CSS only (no external stylesheets, no <link> tags)
- Include a document header with the law firm name, date (use today's date), and "CONFIDENTIAL" label
- Include sections: Case Summary, Employer Information, Position Details, Wage Information, Compliance Statement, Attorney Certification
- The Compliance Statement must assert that the employer will pay the required wage, maintain LCA records, and notify relevant parties of material changes
- Use a clean serif font (Georgia) for the document body
- Page-like appearance: white background, max-width 750px, margins, proper heading hierarchy
- Professional legal document tone throughout
- Include a signature block at the bottom for the attorney

Respond ONLY with the complete HTML string starting with <div and ending with </div>. No explanation, no markdown, no code fences. Just the HTML.`;

    const start = Date.now();

    const { text: html, provider } = await callWithFallback(
      {
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      },
      () => [prompt]
    );

    const elapsed = Date.now() - start;
    console.log(`[generate] responded via ${provider}`);

    res.json({
      html,
      matter,
      processing_time_ms: elapsed,
    });
  } catch (err) {
    console.error('[generate] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
