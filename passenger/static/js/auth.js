// auth.js

// Simple cookie helpers

const DEBUG = true;
export const baseUrl = DEBUG ? '' : 'https://www.passenger.lk';

function getCookie(name) {
  const match = document.cookie.match(
    new RegExp('(^| )' + name + '=([^;]+)')
  );
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name, val, days = 7) {
  const expires = new Date(
    Date.now() + days * 864e5
  ).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(val)}; path=/; expires=${expires}`;
}

// Call this to refresh both tokens.
// Throws on any failure, so callers can handle redirect.
export async function refreshTokens() {
  const refresh = getCookie('refresh_token');
  if (!refresh) {
    // no refresh token → bail out
    throw new Error('No refresh token');
  }

  const res = await fetch(`${baseUrl}/refresh/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh })
  });
  if (!res.ok) {
    throw new Error('Refresh failed');
  }

  const { access, refresh: newRefresh } = await res.json();
  setCookie('access_token', access);
  setCookie('refresh_token', newRefresh);
}

// A wrapper around fetch() that automatically tries to refresh tokens on 401.
// If refreshing fails, clears tokens and redirects to the login page.
export async function authFetch(input, init = {}) {
  init.credentials = 'include';
  init.headers = {
    ...(init.headers || {}),
    Authorization: `Bearer ${getCookie('access_token')}`,
  };

  let res = await fetch(input, init);
  if (res.status === 401) {
    try {
      await refreshTokens();
      // retry original request
      init.headers.Authorization = `Bearer ${getCookie('access_token')}`;
      res = await fetch(input, init);
    } catch (err) {
      // clear any stale tokens
      setCookie('access_token', '', -1);
      setCookie('refresh_token', '', -1);
      // redirect to login
      window.location.href = `${baseUrl}/bus-owners/web/login-or-register/`;
      return;
    }
  }
  return res;
}
