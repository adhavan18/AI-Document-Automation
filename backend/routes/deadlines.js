import { Router } from 'express';
import { getDeadlines, addDeadline, completeDeadline, reopenDeadline } from '../lib/store.js';

const router = Router();

// ─── GET /api/deadlines ───────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { caseId, includeCompleted } = req.query;
  let rows = getDeadlines(caseId || undefined);
  if (!includeCompleted) rows = rows.filter((d) => !d.completed);

  const today = new Date();
  const enriched = rows.map((d) => {
    const due = new Date(d.due_date);
    const diffDays = Math.ceil((due - today) / 86400000);
    let urgency = 'normal';
    if (diffDays < 0)   urgency = 'overdue';
    else if (diffDays <= 7)  urgency = 'critical';
    else if (diffDays <= 30) urgency = 'warning';
    return { ...d, daysUntil: diffDays, urgency };
  });

  enriched.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  res.json({ deadlines: enriched });
});

// ─── POST /api/deadlines ──────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { caseId, label, dueDate, type } = req.body;
  if (!label || !dueDate) return res.status(400).json({ error: 'label and dueDate required' });
  addDeadline({ caseId, label, dueDate, type });
  res.status(201).json({ deadlines: getDeadlines(caseId || undefined) });
});

// ─── PATCH /api/deadlines/:id/complete ───────────────────────────────────────
router.patch('/:id/complete', (req, res) => {
  completeDeadline(req.params.id);
  res.json({ ok: true });
});

// ─── PATCH /api/deadlines/:id/reopen ─────────────────────────────────────────
router.patch('/:id/reopen', (req, res) => {
  reopenDeadline(req.params.id);
  res.json({ ok: true });
});

export default router;
