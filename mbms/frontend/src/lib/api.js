export class ApiRequestError extends Error {
  constructor(apiError, status) {
    super(apiError.message);
    this.apiError = apiError;
    this.status = status;
  }
}

const ACCESS_KEY = 'mbms.access_token';
const REFRESH_KEY = 'mbms.refresh_token';
const USER_KEY = 'mbms.user';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function storeSession(access_token, refresh_token, user) {
  localStorage.setItem(ACCESS_KEY, access_token);
  localStorage.setItem(REFRESH_KEY, refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

let refreshInFlight = null;

async function tryRefresh() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/v1/identity/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = await res.json();
        storeSession(body.data.access_token, body.data.refresh_token, body.data.user);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiRequest(path, options = {}, _retry = true) {
  const { method = 'GET', body, query } = options;
  let url = `/api/v1${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  // Fastify's JSON body parser rejects an empty body sent with
  // Content-Type: application/json (FST_ERR_CTP_EMPTY_JSON_BODY) — only set
  // it when there's actually a body, e.g. not for bodyless POSTs like
  // .../activate or .../post.
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && _retry && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiRequest(path, options, false);
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const error = json?.error ?? { code: 'ERROR', message: `Request failed (${res.status}).` };
    if (res.status === 401) {
      clearSession();
    }
    throw new ApiRequestError(error, res.status);
  }

  return json.data;
}

// Sprint 13 (RPT-06): report export endpoints return a raw file
// (text/csv or application/pdf), not the {data,error} envelope every other
// endpoint uses — apiRequest's res.json() would fail on these, so this is
// a separate helper that fetches a Blob and triggers a normal browser
// download via a throwaway <a download> element.
export async function downloadReport(path, query) {
  const url = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.set(k, String(v));
    });
  }
  const token = getAccessToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/v1${path}${url.toString() ? `?${url}` : ''}`, { headers });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiRequestError(json?.error ?? { code: 'ERROR', message: `Export failed (${res.status}).` }, res.status);
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match ? match[1] : 'report';
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function apiRequestWithMeta(path, query) {
  const url = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.set(k, String(v));
    });
  }
  const token = getAccessToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/v1${path}${url.toString() ? `?${url}` : ''}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new ApiRequestError(json.error, res.status);
  return { items: json.data, meta: json.meta };
}
