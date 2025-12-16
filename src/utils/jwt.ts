import { Buffer } from 'buffer';

/**
 * Decode base64url string safely using Buffer, works on RN and Web.
 */
function base64UrlDecode(input: string): string {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function decodeJwtPayload<T = any>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    return JSON.parse(payloadJson) as T;
  } catch {
    return null;
  }
}

export function getJwtExpirationMs(token: string): number | null {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000;
}

export function isJwtExpiringSoon(token: string, bufferMs: number): boolean {
  const expMs = getJwtExpirationMs(token);
  if (!expMs) return true;
  return Date.now() + bufferMs >= expMs;
}


