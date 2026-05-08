import jwt, { SignOptions } from 'jsonwebtoken';

export interface AccessClaims {
  sub: string;
  handle: string;
  type: 'access';
}

export interface RefreshClaims {
  sub: string;
  jti: string;
  type: 'refresh';
}

function accessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_ACCESS_SECRET must be set in production');
    return 'dev-only-change-me-access-secret';
  }
  if (process.env.NODE_ENV === 'production' && secret.startsWith('dev-only')) {
    throw new Error('Refusing to start in production with default JWT_ACCESS_SECRET');
  }
  return secret;
}

function refreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_REFRESH_SECRET must be set in production');
    return 'dev-only-change-me-refresh-secret';
  }
  if (process.env.NODE_ENV === 'production' && secret.startsWith('dev-only')) {
    throw new Error('Refusing to start in production with default JWT_REFRESH_SECRET');
  }
  return secret;
}

function accessTTL(): number {
  return parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? '300', 10);
}

function refreshTTL(): number {
  return parseInt(process.env.JWT_REFRESH_TTL_SECONDS ?? String(60 * 60 * 24 * 30), 10);
}

export function signAccessToken(claims: Omit<AccessClaims, 'type'>): string {
  const payload: AccessClaims = { ...claims, type: 'access' };
  const opts: SignOptions = { expiresIn: accessTTL(), algorithm: 'HS256', issuer: 'ather.auth' };
  return jwt.sign(payload, accessSecret(), opts);
}

export function signRefreshToken(claims: Omit<RefreshClaims, 'type'>): string {
  const payload: RefreshClaims = { ...claims, type: 'refresh' };
  const opts: SignOptions = { expiresIn: refreshTTL(), algorithm: 'HS256', issuer: 'ather.auth' };
  return jwt.sign(payload, refreshSecret(), opts);
}

export function verifyAccessToken(token: string): AccessClaims {
  const decoded = jwt.verify(token, accessSecret(), { algorithms: ['HS256'], issuer: 'ather.auth' });
  if (typeof decoded === 'string' || (decoded as AccessClaims).type !== 'access') {
    throw new Error('Invalid access token');
  }
  return decoded as AccessClaims;
}

export function verifyRefreshToken(token: string): RefreshClaims {
  const decoded = jwt.verify(token, refreshSecret(), { algorithms: ['HS256'], issuer: 'ather.auth' });
  if (typeof decoded === 'string' || (decoded as RefreshClaims).type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return decoded as RefreshClaims;
}

export function getAccessTTLSeconds(): number {
  return accessTTL();
}
