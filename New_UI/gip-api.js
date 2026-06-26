// GIP API client — shared by all New_UI pages.
// Reads API_BASE, CLIENT_CODE, AGENT_KEY from window.GIP_CONFIG (set by env-config.js).

const TOKEN_KEY      = 'gip_token';
const USER_KEY       = 'gip_user';
const SOURCE_ID_KEY  = 'gip_source_id';

export function setToken(t)    { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }
export function getToken()     { return localStorage.getItem(TOKEN_KEY) || ''; }
export function setUser(u)     { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
export function getUser()      { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
export function setSourceId(id){ id ? localStorage.setItem(SOURCE_ID_KEY, id) : localStorage.removeItem(SOURCE_ID_KEY); }
export function getSourceId()  { return localStorage.getItem(SOURCE_ID_KEY) || ''; }
export function clearAuth()    { [TOKEN_KEY, USER_KEY, SOURCE_ID_KEY].forEach(k => localStorage.removeItem(k)); }
export function isLoggedIn()   { return !!getToken(); }

function cfg(key) {
  const c = window.GIP_CONFIG || {};
  if (!c[key]) throw new Error(`GIP_CONFIG.${key} missing — check env-config.js`);
  return c[key];
}

async function _fetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token)  headers['Authorization'] = `Bearer ${token}`;
  try { headers['X-Client-Code'] = cfg('CLIENT_CODE'); } catch {}
  try { headers['X-Agent-Key']   = cfg('AGENT_KEY');   } catch {}
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const base = (() => { try { return cfg('API_BASE'); } catch { return ''; } })();
  const resp = await fetch(base + endpoint, { ...options, headers });
  if (resp.status === 401) {
    clearAuth();
    if (!window.location.pathname.endsWith('gip-login.html')) {
      window.location.href = 'gip-login.html';
    }
    return null;
  }
  return resp;
}

async function _json(endpoint, options = {}) {
  const r = await _fetch(endpoint, options);
  if (!r) return null;
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${r.status}`);
  }
  return r.json();
}

async function _blob(endpoint, options = {}) {
  const r = await _fetch(endpoint, options);
  if (!r) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.blob();
}

function qs(params) {
  const p = Object.entries(params || {}).filter(([, v]) => v != null && v !== '');
  return p.length ? '?' + new URLSearchParams(p) : '';
}

const G   = (p, q)   => _json(p + qs(q));
const P   = (p, b)   => _json(p, { method: 'POST', body: JSON.stringify(b ?? {}) });
const PUT = (p, b)   => _json(p, { method: 'PUT',  body: JSON.stringify(b ?? {}) });

// ── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  login: async (username, password) => {
    const data = await P('/api/auth/login', { username, password });
    if (data?.access_token) setToken(data.access_token);
    else if (data?.token)   setToken(data.token);
    if (data?.user) setUser(data.user);
    // Fetch user profile and notice source ID in parallel
    try {
      const [me, sources] = await Promise.allSettled([
        G('/api/auth/me'),
        G('/api/notice-sources', { client_code: (window.GIP_CONFIG || {}).CLIENT_CODE }),
      ]);
      if (me.status === 'fulfilled' && me.value) setUser(me.value);
      if (sources.status === 'fulfilled' && sources.value) {
        const list = sources.value.notice_sources || sources.value;
        if (Array.isArray(list) && list[0]) setSourceId(list[0].id);
      }
    } catch {}
    return data;
  },
  me:     () => G('/api/auth/me'),
  logout: () => { clearAuth(); window.location.href = 'gip-login.html'; },
};

// ── Notices ──────────────────────────────────────────────────────────────────
// Auto-injects notice_source_id from stored value when not explicitly provided.
function withSource(p = {}) {
  if (!p.notice_source_id) {
    const sid = getSourceId();
    if (sid) return { ...p, notice_source_id: sid };
  }
  return p;
}

export const notices = {
  reviewQueue: (p = {}) => G('/api/notices/review-queue', withSource(p)),
  readyToPost: (p = {}) => G('/api/notices/ready-to-post', withSource(p)),
  autoPosted:  (p = {}) => G('/api/notices/auto-posted',   withSource(p)),
  failed:      (p = {}) => G('/api/notices/failed',        withSource(p)),
  get:         (id)     => G(`/api/notices/${id}`),
  attempts:    (id)     => G(`/api/notices/${id}/attempts`),
  review:      (id, b)  => PUT(`/api/notices/${id}/review`, b),
  post:        (id, by) => _json(`/api/notices/${id}/post${qs({ posted_by: by })}`, { method: 'POST' }),
  gcmAutoMatch:   (id, b) => P(`/api/notices/${id}/gcm-auto-match`, b),
  gcmMatchReview: (id, b) => P(`/api/notices/${id}/gcm-match-review`, b),
  gcmPost:        (id, b) => P(`/api/notices/${id}/gcm-post`, b),
  phase1Classify: (b)     => P('/api/notices/phase1-gcm-classify', b),
  phase1AutoPost: (b)     => P('/api/notices/phase1-auto-post', b),
};

// ── Notice UI ─────────────────────────────────────────────────────────────────
export const noticeUi = {
  queue:  (p = {}) => G('/api/notice-ui/queue',        withSource(p)),
  detail: (id)     => G(`/api/notice-ui/${id}/detail`),
};

// ── Notice Agent ─────────────────────────────────────────────────────────────
export const noticeAgent = {
  status:       (p = {}) => G('/api/notice-agent/status', withSource(p)),
  getLogs:      (p = {}) => G('/api/notice-agent/logs',   withSource(p)),
  sendLog:      (b)      => P('/api/notice-agent/logs', b),
  heartbeat:    (b)      => P('/api/notice-agent/heartbeat', b),
  bootstrap:    (b)      => P('/api/notice-agent/bootstrap', b),
  uploadDocument:(b)     => P('/api/notice-agent/upload-document', b),
};

// ── Notice Sources ───────────────────────────────────────────────────────────
export const noticeSources = {
  list:   (clientCode) => G('/api/notice-sources', { client_code: clientCode || (window.GIP_CONFIG || {}).CLIENT_CODE }),
  get:    (id)         => G(`/api/notice-sources/${id}`),
  update: (id, b)      => PUT(`/api/notice-sources/${id}`, b),
  listDocs:(id)        => G(`/api/notice-sources/${id}/documents`),
  processSelected:(id, b) => P(`/api/notice-sources/${id}/process-selected`, b),
};

// ── Company Documents ─────────────────────────────────────────────────────────
export const companyDocuments = {
  pdfUrl:          (id) => G(`/api/company-documents/${id}/pdf-url`),
  noticeExtraction:(id) => G(`/api/company-documents/${id}/notice-extraction`),
  pdfBlob:         (id) => _blob(`/api/company-documents/${id}/pdf-preview`),
};

// ── Review ────────────────────────────────────────────────────────────────────
export const review = {
  // Main queue — returns { review_queue, processed_notices, reviewed_notices, stats }
  allQueues:       (p = {}) => G('/api/review/queue',   withSource(p)),
  queue:           (p = {}) => G('/api/review/queue',   withSource(p)),
  metrics:         (p = {}) => G('/api/review/metrics', withSource(p)),
  reasonCatalog:   (activeOnly = true) => G('/api/review/reason-catalog', { active_only: activeOnly }),
  // decision body: { decision: 'APPROVED'|'REJECTED', comment?, issues?: [{reason_code, reviewer_description?}] }
  decision:        (id, b)  => P(`/api/review/notices/${id}/decision`, b),
  gcmLinkedRecord: (id)     => G(`/api/review/notices/${id}/gcm-linked-record`),
};

// ── GCM ───────────────────────────────────────────────────────────────────────
export const gcm = {
  search:        (p = {}) => G('/api/gcm/search', p),
  diagnostics:   ()       => G('/api/gcm/diagnostics'),
  tokenStatus:   (force)  => G('/api/gcm/token-status', { force_refresh: force }),
  compareNotice: (id)     => G(`/api/gcm/compare-notice/${id}`),
  matters:       (p = {}) => G('/api/gcm/app/matters', p),
  matterByCode:  (code)   => G(`/api/gcm/app/matters/by-code/${code}`),
  foreignNationals:(p={}) => G('/api/gcm/app/foreign-nationals', p),
  documentTypes: ()       => G('/api/gcm/app/document-types'),
  matterTasks:   (id)     => G(`/api/gcm/app/matters/${id}/tasks`),
  matterSteps:   (id)     => G(`/api/gcm/app/matters/${id}/steps`),
};

// ── Platform Admin ────────────────────────────────────────────────────────────
export const platform = {
  summary:    ()     => G('/api/platform/admin/summary'),
  agentLogs:  (p={}) => G('/api/platform/admin/agent-logs', withSource(p)),
  listSetups: (p={}) => G('/api/platform/admin/client-setups', p),
};

// ── Field mapping helpers (shared by all pages) ───────────────────────────────
const STATUS_MAP = {
  AUTO_POSTED:      'completed',
  POSTED:           'completed',
  REVIEW_REQUIRED:  'ready',
  PROCESSING:       'processing',
  FAILED:           'failed',
  APPROVED:         'approved',
  REJECTED:         'rejected',
  RECEIVED:         'ready',
  PENDING:          'queued',
  READY_TO_POST:    'ready',
  EXTRACTED:        'ready',
};

// Maps a notice row from /api/review/queue response (review_queue, processed_notices, reviewed_notices)
export function mapNoticeToRow(n) {
  // Primary fields per API spec
  const rawStatus = n.validation_status || n.review_decision || n.post_status || n.auto_post_status || n.notice_status || n.status || '';
  const dateRaw   = n.display_date || n.notice_date || n.receipt_date || n.created_at || '';
  let   dateStr   = '';
  if (dateRaw) {
    try { dateStr = new Date(dateRaw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch {}
  }
  return {
    id:          n.notice_flat_id || n.id || '',
    file:        n.file_name || n.source_file_name || n.original_filename || `Notice_${n.notice_flat_id || n.id}.pdf`,
    size:        n.file_size_mb ? `${n.file_size_mb} MB` : '',
    date:        dateStr,
    form:        n.form_type || n.notice_type || '',
    fn:          n.display_name || n.beneficiary_name || n.foreign_national_name || n.applicant_name || '',
    receipt:     n.receipt_number || '',
    noticeStatus:n.notice_status || '',
    accuracy:    n.accuracy_percent != null
                   ? Math.round(n.accuracy_percent)
                   : n.overall_extraction_confidence != null
                     ? Math.round(n.overall_extraction_confidence)
                     : null,
    status:      STATUS_MAP[rawStatus.toUpperCase?.()] || rawStatus.toLowerCase() || 'ready',
    // Reviewed-tab extras
    decision:    n.review_decision || '',
    errorDetail: n.error_detail || n.primary_reason_label || n.reviewer_comment || '',
    reviewedBy:  n.reviewed_by || '',
    reviewedAt:  n.reviewed_at || '',
    raw:         n,
  };
}

// Maps a notice for the card-based review page (gip-notice.html)
export function mapNoticeToCard(n) {
  const rawStatus = n.validation_status || n.review_decision || n.notice_status || n.status || 'PENDING';
  return {
    id:       n.notice_flat_id || n.id || '',
    type:     n.form_type || n.notice_type || '',
    label:    n.form_type || '',
    applicant:n.display_name || n.beneficiary_name || n.foreign_national_name || '',
    status:   STATUS_MAP[rawStatus.toUpperCase?.()] || 'ready',
    priority: (n.gcm_match_confidence != null && n.gcm_match_confidence < 80) ? 'high' : 'normal',
    fields:   n.low_confidence_fields?.length ?? 0,
    pages:    n.page_count || 1,
    raw:      n,
  };
}

export default {
  setToken, getToken, setUser, getUser, setSourceId, getSourceId,
  clearAuth, isLoggedIn, mapNoticeToRow, mapNoticeToCard,
  auth, notices, noticeUi, noticeAgent, noticeSources,
  companyDocuments, review, gcm, platform,
};
