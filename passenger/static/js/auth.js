// auth.js

// Simple cookie helpers

const DEBUG = true;
export const baseUrl = DEBUG ? '' : 'https://www.passenger.lk';

/**
 * Gets a cookie value by name.
 * @param {string} name The name of the cookie.
 * @returns {string|null} The cookie value or null if not found.
 */
function getCookie(name) {
  const match = document.cookie.match(
    new RegExp('(^| )' + name + '=([^;]+)')
  );
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Sets a cookie.
 * @param {string} name The name of the cookie.
 * @param {string} val The value of the cookie.
 * @param {number} days The number of days until the cookie expires.
 */
export function setCookie(name, val, days = 7) {
  const expires = new Date(
    Date.now() + days * 864e5
  ).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(val)}; path=/; expires=${expires}`;
}

/**
 * Call this to refresh both access and refresh tokens.
 * Throws an error on any failure, so callers can handle the error.
 */
export async function refreshTokens() {
  const refresh = getCookie('refresh_token');
  if (!refresh) {
    // No refresh token, so we can't proceed.
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

/**
 * A wrapper around fetch() that automatically tries to refresh tokens on a 401 Unauthorized response.
 * If refreshing fails, it clears tokens and redirects to the login page.
 * @param {RequestInfo} input The resource to fetch.
 * @param {RequestInit} [init={}] An object containing any custom settings.
 * @returns {Promise<Response|undefined>} The fetch Response or undefined on redirect.
 */
export async function authFetch(input, init = {}) {
  init.credentials = 'include';
  init.headers = {
    ...(init.headers || {}),
    'Authorization': `Bearer ${getCookie('access_token')}`,
  };

  let res = await fetch(input, init);

  if (res.status === 401) {
    try {
      // Token expired, try to refresh it.
      await refreshTokens();
      // Retry the original request with the new token.
      init.headers.Authorization = `Bearer ${getCookie('access_token')}`;
      res = await fetch(input, init);
    } catch (err) {
      console.error('Token refresh failed, redirecting to login.', err);
      // Clear any stale tokens.
      setCookie('access_token', '', -1);
      setCookie('refresh_token', '', -1);
      // Redirect to the login page.
      window.location.href = `${baseUrl}/bus-owners/web/login-or-register/`;
      return; // Return undefined as we are redirecting.
    }
  }
  return res;
}
