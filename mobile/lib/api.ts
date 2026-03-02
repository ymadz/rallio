/**
 * Mobile API Client
 * Centralized utility for making authenticated requests to the web API.
 * Eliminates duplicated fetch logic across mobile screens.
 */

import { supabase } from './supabase';

const getApiUrl = () =>
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.254.170:3000';

/**
 * Get the current user's access token from the Supabase session.
 * Throws if not authenticated.
 */
async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

/**
 * Standard API response envelope.
 */
export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Make an authenticated POST request to a mobile API route.
 */
export async function apiPost<T = any>(
  path: string,
  body: Record<string, any>
): Promise<ApiResponse<T>> {
  const token = await getAccessToken();
  const url = `${getApiUrl()}${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status})`);
  }

  return result;
}

/**
 * Make an authenticated GET request to a mobile API route.
 */
export async function apiGet<T = any>(
  path: string,
  params?: Record<string, string>
): Promise<ApiResponse<T>> {
  const token = await getAccessToken();
  const url = new URL(`${getApiUrl()}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status})`);
  }

  return result;
}

/**
 * Make an unauthenticated GET request (for public endpoints like time slots).
 */
export async function apiGetPublic<T = any>(
  path: string,
  params?: Record<string, string>
): Promise<any> {
  const url = new URL(`${getApiUrl()}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status})`);
  }

  return result;
}

/**
 * Make an unauthenticated POST request (for public endpoints like validate-booking).
 */
export async function apiPostPublic<T = any>(
  path: string,
  body: Record<string, any>
): Promise<any> {
  const url = `${getApiUrl()}${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status})`);
  }

  return result;
}
