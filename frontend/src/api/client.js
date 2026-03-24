let csrfToken = null;

async function fetchCsrf() {
  if (csrfToken) return csrfToken;
  const res = await fetch('/csrfToken');
  const data = await res.json();
  csrfToken = data._csrf;
  return csrfToken;
}

export async function api(url, options = {}) {
  const { method = 'GET', body, ...rest } = options;

  const headers = { 'Content-Type': 'application/json', ...rest.headers };

  if (method !== 'GET') {
    headers['X-CSRF-Token'] = await fetchCsrf();
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (res.status === 403) {
    // CSRF token might be expired, reset and retry once
    csrfToken = null;
    headers['X-CSRF-Token'] = await fetchCsrf();
    const retry = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(text || `HTTP ${retry.status}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export function resetCsrf() {
  csrfToken = null;
}
