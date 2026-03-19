const SESSION_COOKIE = 'stockpilot_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const SESSION_REFRESH_THRESHOLD_SECONDS = 60 * 30;
const INSECURE_DEFAULT_SECRET = 'stockpilot-lite-default-auth-secret';

type SessionPayload = {
  email: string;
  issuedAt: number;
};

type SessionVerificationResult = {
  payload: SessionPayload;
  needsRefresh: boolean;
};

function assertConfiguredSecret(secret: string | undefined, label: string) {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${label} must be configured in production to keep sessions stable across deploys.`);
    }

    return INSECURE_DEFAULT_SECRET;
  }

  if (process.env.NODE_ENV === 'production' && secret === INSECURE_DEFAULT_SECRET) {
    throw new Error(`${label} must not use the development fallback in production.`);
  }

  return secret;
}

function getSessionSecrets() {
  const primarySecret = assertConfiguredSecret(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET, 'AUTH_SECRET');
  const previousSecret = process.env.AUTH_SECRET_PREVIOUS?.trim() || null;

  if (process.env.NODE_ENV === 'production' && previousSecret === INSECURE_DEFAULT_SECRET) {
    throw new Error('AUTH_SECRET_PREVIOUS must not use the development fallback in production.');
  }

  return {
    primarySecret,
    verificationSecrets: previousSecret ? [primarySecret, previousSecret] : [primarySecret]
  };
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

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  };
}

export async function encodeSession(payload: SessionPayload) {
  const { primarySecret } = getSessionSecrets();
  const base = toBase64Url(JSON.stringify(payload));
  const signature = await sign(base, primarySecret);
  return `${base}.${signature}`;
}

export async function verifySessionToken(token?: string): Promise<SessionVerificationResult | null> {
  if (!token) {
    return null;
  }

  const [base, signature] = token.split('.');
  if (!base || !signature) {
    return null;
  }

  const { primarySecret, verificationSecrets } = getSessionSecrets();
  let matchedSecret: string | null = null;

  for (const secret of verificationSecrets) {
    const expected = await sign(base, secret);
    if (timingSafeEqualHex(expected, signature)) {
      matchedSecret = secret;
      break;
    }
  }

  if (!matchedSecret) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(base)) as SessionPayload;
    const ageMs = Date.now() - payload.issuedAt;
    const isExpired = ageMs > SESSION_MAX_AGE_SECONDS * 1000;

    if (!payload.email || !Number.isFinite(payload.issuedAt) || isExpired) {
      return null;
    }

    const needsRefresh = matchedSecret !== primarySecret || ageMs > SESSION_REFRESH_THRESHOLD_SECONDS * 1000;

    return { payload, needsRefresh };
  } catch {
    return null;
  }
}

export async function decodeSession(token?: string) {
  const verification = await verifySessionToken(token);
  return verification?.payload ?? null;
}

export const authConfig = {
  sessionCookieName: SESSION_COOKIE,
  sessionMaxAgeSeconds: SESSION_MAX_AGE_SECONDS,
  sessionRefreshThresholdSeconds: SESSION_REFRESH_THRESHOLD_SECONDS
};
