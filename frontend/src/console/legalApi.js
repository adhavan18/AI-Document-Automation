import axios from 'axios';

// Talks to the legal-backend FastAPI service (proxied via Vite: /legal -> :8001)
const http = axios.create({ baseURL: '/legal' });

export const legal = {
  // POST /upload — runs the 4-stage pipeline, returns the new case summary
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return http
      .post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 })
      .then((r) => r.data);
  },

  // GET /queue — pending + in_review cases, sorted by priority then upload time
  listQueue: () => http.get('/queue').then((r) => r.data),

  // GET /queue/{id} — full case detail (fields, exceptions, audit log)
  getCase: (caseId) => http.get(`/queue/${caseId}`).then((r) => r.data),

  // GET /cases/{id}/status — poll processing progress
  getStatus: (caseId) => http.get(`/cases/${caseId}/status`).then((r) => r.data),

  // POST /queue/{id}/assign — claim a case (status -> in_review)
  assign: (caseId) => http.post(`/queue/${caseId}/assign`).then((r) => r.data),

  // POST /queue/{id}/confirm — confirm fields (status -> approved)
  confirm: (caseId, fields) =>
    http.post(`/queue/${caseId}/confirm`, { fields }).then((r) => r.data),

  // POST /queue/{id}/reject — reject with a reason (status -> rejected)
  reject: (caseId, reason) =>
    http.post(`/queue/${caseId}/reject`, { reason }).then((r) => r.data),

  // GET /queue/{id}/pdf — inline PDF stream URL (use directly in <iframe>/<embed>)
  pdfUrl: (caseId) => `/legal/queue/${caseId}/pdf`,
};
