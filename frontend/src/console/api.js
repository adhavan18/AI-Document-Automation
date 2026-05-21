import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

function b64ToBlob(b64, mime = 'application/pdf') {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function pdfBlobUrl(b64) {
  return URL.createObjectURL(b64ToBlob(b64));
}

// ─── UC-01 ────────────────────────────────────────────────────────────────────

export const uc1 = {
  getStats:      ()         => http.get('/uc1/stats').then((r) => r.data),
  listNotices:   ()         => http.get('/uc1/notices').then((r) => r.data),
  getNotice:     (id)       => http.get(`/uc1/notices/${id}`).then((r) => r.data),
  extract:       (id)       => http.post(`/uc1/notices/${id}/extract`).then((r) => r.data),
  verify:        (id)       => http.post(`/uc1/notices/${id}/verify`).then((r) => r.data),
  routeManual:   (id)       => http.post(`/uc1/notices/${id}/route-manual`).then((r) => r.data),
  uploadNotice:  (formData) => http.post('/uc1/notices', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data),
};

// ─── UC-02 ────────────────────────────────────────────────────────────────────

export const uc2 = {
  listMatters:    ()              => http.get('/uc2/matters').then((r) => r.data),
  getMatter:      (id)            => http.get(`/uc2/matters/${id}`).then((r) => r.data),
  uploadLca:      (file)          => {
    const fd = new FormData();
    fd.append('file', file);
    return http.post('/uc2/matters/upload-lca', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  generate:       (id)            => http.post(`/uc2/matters/${id}/generate`).then((r) => r.data),
  submitReview:   (id)            => http.post(`/uc2/matters/${id}/submit-review`).then((r) => r.data),
  approve:        (id, body = {}) => http.post(`/uc2/matters/${id}/approve`, body).then((r) => r.data),
  requestChanges: (id, body)      => http.post(`/uc2/matters/${id}/request-changes`, body).then((r) => r.data),
};

// ─── UC-03 ────────────────────────────────────────────────────────────────────

export const uc3 = {
  listCases:     ()              => http.get('/uc3/cases').then((r) => r.data),
  createCase:    (data)          => http.post('/uc3/cases', data).then((r) => r.data),
  getCase:       (id)            => id
    ? http.get(`/uc3/cases/${id}`).then((r) => r.data)
    : http.get('/uc3/case').then((r) => r.data),
  runValidation: (id, file)      => {
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      return http.post(`/uc3/cases/${id}/run`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    }
    return http.post(`/uc3/cases/${id}/run`).then((r) => r.data);
  },
  resolve:       (id, field, choice) => http.post(`/uc3/cases/${id}/resolve`, { field, choice }).then((r) => r.data),
  save:          (id)            => http.post(`/uc3/cases/${id}/save`, {}, { responseType: 'blob' }).then((r) => r.data),
  getChecklist:  (id)            => http.get(`/uc3/cases/${id}/checklist`).then((r) => r.data),
  updateChecklistItem: (id, itemId, data = {}) => {
    if (data.file) {
      const fd = new FormData();
      fd.append('file', data.file);
      fd.append('received', data.received ?? true);
      return http.patch(`/uc3/cases/${id}/checklist/${itemId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    }
    return http.patch(`/uc3/cases/${id}/checklist/${itemId}`, data).then((r) => r.data);
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboard = {
  getSummary: () => http.get('/dashboard/summary').then((r) => r.data),
};

// ─── Deadlines ────────────────────────────────────────────────────────────────

export const deadlines = {
  list:     (params = {}) => http.get('/deadlines', { params }).then((r) => r.data),
  create:   (data)        => http.post('/deadlines', data).then((r) => r.data),
  complete: (id)          => http.patch(`/deadlines/${id}/complete`).then((r) => r.data),
  reopen:   (id)          => http.patch(`/deadlines/${id}/reopen`).then((r) => r.data),
};

// ─── USCIS ────────────────────────────────────────────────────────────────────

export const uscis = {
  checkStatus: (receiptNumber) => http.get(`/uscis/status/${receiptNumber}`).then((r) => r.data),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const search = {
  query: (q) => http.get('/search', { params: { q } }).then((r) => r.data),
};
