import { Router } from 'express';
import { getCases, getMatters, getNotices, getDeadlines, computeCaseCounts } from '../lib/store.js';

const router = Router();

router.get('/summary', (req, res) => {
  const cases   = getCases();
  const matters = getMatters();
  const notices = getNotices();
  const allDeadlines = getDeadlines();

  const today   = new Date();
  const in30    = new Date(today); in30.setDate(today.getDate() + 30);
  const in7     = new Date(today); in7.setDate(today.getDate() + 7);

  const upcomingDeadlines = allDeadlines
    .filter((d) => !d.completed && d.due_date)
    .filter((d) => new Date(d.due_date) <= in30)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 10)
    .map((d) => {
      const due = new Date(d.due_date);
      const diffDays = Math.ceil((due - today) / 86400000);
      const urgency = diffDays < 0 ? 'overdue' : diffDays <= 7 ? 'critical' : diffDays <= 30 ? 'warning' : 'normal';
      return { ...d, daysUntil: diffDays, urgent: diffDays <= 7, urgency };
    });

  const urgentCount = upcomingDeadlines.filter((d) => d.urgent).length;
  const pendingReview = matters.filter((m) => m.status === 'Pending Review').length;
  const openCases = cases.filter((c) => c.status === 'open').length;
  const noticeQueue = notices.filter((n) => n.status === 'New').length;

  // recent activity: last 5 verified notices + last 5 approved matters + open cases
  const recentNotices = notices
    .filter((n) => n.verifiedAt)
    .sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt))
    .slice(0, 3)
    .map((n) => ({ type: 'notice', id: n.id, label: `Notice verified: ${n.beneficiary || n.id}`, at: n.verifiedAt }));

  const recentMatters = matters
    .filter((m) => m.reviewedAt)
    .sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt))
    .slice(0, 3)
    .map((m) => ({ type: 'matter', id: m.id, label: `PAF ${m.status.toLowerCase()}: ${m.employer}`, at: m.reviewedAt }));

  const recentActivity = [...recentNotices, ...recentMatters]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 6);

  const casesSummary = cases.slice(0, 8).map((c) => {
    const counts = computeCaseCounts(c.id);
    const deadlines = getDeadlines(c.id)
      .filter((d) => !d.completed && new Date(d.due_date) <= in30)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return {
      id: c.id,
      applicant: c.applicant,
      visaType: c.visaType,
      intake: c.intake,
      counts,
      nextDeadline: deadlines[0] ?? null,
    };
  });

  res.json({
    stats: {
      openCases,
      pendingReview,
      urgentDeadlines: urgentCount,
      noticeQueue,
    },
    upcomingDeadlines,
    recentActivity,
    cases: casesSummary,
  });
});

export default router;
