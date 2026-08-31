// Mirrors mbms/frontend/src/lib/api.js's apiRequest/apiRequestWithMeta
// pattern exactly (same {data,error}/{data,meta,error} envelope, same
// 401-refresh-retry flow) — pointed at /customer-portal/auth/refresh and a
// separate storefront.* localStorage namespace so a staff session in the
// admin app and a customer session here can coexist in the same browser.
export class ApiRequestError extends Error {
  constructor(apiError, status) {
    super(apiError.message);
    this.apiError = apiError;
    this.status = status;
  }
}

const ACCESS_KEY = 'storefront.access_token';
const REFRESH_KEY = 'storefront.refresh_token';
const CUSTOMER_KEY = 'storefront.customer';
const LANG_KEY = 'storefront.lang';

// Content localisation (27 August 2026): tell the API which language the
// customer is browsing in. Read endpoints return database text in it; write
// endpoints use it to normalise the customer's input back to English for
// storage (see backend src/common/translation).
function contentLangHeader() {
  try {
    const lang = localStorage.getItem(LANG_KEY);
    return lang && lang !== 'en' ? { 'Accept-Language': lang } : {};
  } catch {
    return {};
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
export function getStoredCustomer() {
  const raw = localStorage.getItem(CUSTOMER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function storeSession(access_token, refresh_token, customer) {
  localStorage.setItem(ACCESS_KEY, access_token);
  localStorage.setItem(REFRESH_KEY, refresh_token);
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
}
export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(CUSTOMER_KEY);
}

let refreshInFlight = null;

async function tryRefresh() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/v1/customer-portal/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = await res.json();
        storeSession(body.data.access_token, body.data.refresh_token, body.data.customer);
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

  const headers = { ...contentLangHeader() };
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
    if (res.status === 401) clearSession();
    throw new ApiRequestError(error, res.status);
  }

  return json.data;
}

export async function apiRequestWithMeta(path, query) {
  const url = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.set(k, String(v));
    });
  }
  const token = getAccessToken();
  const headers = { ...contentLangHeader() };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/v1${path}${url.toString() ? `?${url}` : ''}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new ApiRequestError(json.error, res.status);
  return { items: json.data, meta: json.meta };
}

// PDF export endpoints (invoice/statement) return a raw file, not the
// {data,error} envelope — same downloadReport shape as the admin app's own
// report exports.
export async function downloadFile(path) {
  const token = getAccessToken();
  // Content localisation (30 August 2026): the statement / invoice PDF is
  // labelled in the customer's chosen language too.
  const headers = { ...contentLangHeader() };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/v1${path}`, { headers });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiRequestError(json?.error ?? { code: 'ERROR', message: `Download failed (${res.status}).` }, res.status);
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match ? match[1] : 'download';
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
