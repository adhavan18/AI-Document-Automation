import { Router } from 'express';
import { getCases, getMatters, getNotices } from '../lib/store.js';

const router = Router();

function norm(s) { return String(s || '').toLowerCase(); }

// ─── GET /api/search?q=<query> ────────────────────────────────────────────────
router.get('/', (req, res) => {
  const q = norm(req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ results: [] });

  const results = [];

  // Search cases
  for (const c of getCases()) {
    if (norm(c.applicant).includes(q) || norm(c.id).includes(q) || norm(c.primary).includes(q)) {
      results.push({ type: 'case', id: c.id, label: c.applicant, sub: `${c.visaType} · ${c.id}`, module: 'uc3' });
    }
  }

  // Search matters
  for (const m of getMatters()) {
    if (norm(m.employer).includes(q) || norm(m.position).includes(q) || norm(m.id).includes(q)) {
      results.push({ type: 'matter', id: m.id, label: m.employer, sub: `${m.position} · ${m.worksite}`, module: 'uc2' });
    }
  }

  // Search notices
  for (const n of getNotices()) {
    if (
      norm(n.beneficiary).includes(q) ||
      norm(n.petitioner).includes(q) ||
      norm(n.receiptNumber).includes(q) ||
      norm(n.id).includes(q)
    ) {
      results.push({
        type: 'notice',
        id: n.id,
        label: n.beneficiary || n.id,
        sub: `${n.petitioner || ''} · ${n.receiptNumber || n.id}`,
        module: 'uc1',
      });
    }
  }

  res.json({ results: results.slice(0, 20) });
});

export default router;
