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
  listMatters:   ()         => http.get('/uc2/matters').then((r) => r.data),
  getMatter:     (id)       => http.get(`/uc2/matters/${id}`).then((r) => r.data),
  extractLca:    (id, file) => {
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      return http.post(`/uc2/matters/${id}/extract-lca`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    }
    return http.post(`/uc2/matters/${id}/extract-lca`).then((r) => r.data);
  },
  generate:      (id)       => http.post(`/uc2/matters/${id}/generate`).then((r) => r.data),
  approve:       (id)       => http.post(`/uc2/matters/${id}/approve`).then((r) => r.data),
};

// ─── UC-03 ────────────────────────────────────────────────────────────────────

export const uc3 = {
  getCase:       ()              => http.get('/uc3/case').then((r) => r.data),
  runValidation: (file)          => {
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      return http.post('/uc3/case/run', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    }
    return http.post('/uc3/case/run').then((r) => r.data);
  },
  resolve:       (field, choice) => http.post('/uc3/case/resolve', { field, choice }).then((r) => r.data),
  save:          ()              => http.post('/uc3/case/save', {}, { responseType: 'blob' }).then((r) => r.data),
};
