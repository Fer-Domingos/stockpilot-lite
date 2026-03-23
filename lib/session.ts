const SESSION_COOKIE = 'stockpilot_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type SessionRole = 'ADMIN' | 'PM';

export type SessionPayload = {
  email: string;
  issuedAt: number;
  role: SessionRole;
  name?: string;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'stockpilot-lite-default-auth-secret';
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export async function encodeSession(payload: SessionPayload) {
  const base = toBase64Url(JSON.stringify(payload));
  const signature = await sign(base);
  return `${base}.${signature}`;
}

export async function decodeSession(token?: string) {
  if (!token) {
    return null;
  }

  const [base, signature] = token.split('.');
  if (!base || !signature) {
    return null;
  }

  const expected = await sign(base);
  if (!timingSafeEqualHex(expected, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(base)) as SessionPayload;
    const isExpired = Date.now() - payload.issuedAt > SESSION_MAX_AGE_SECONDS * 1000;

    if (!payload.email || !payload.role || isExpired) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export const authConfig = {
  sessionCookieName: SESSION_COOKIE,
  sessionMaxAgeSeconds: SESSION_MAX_AGE_SECONDS
};
