import jwt, { SignOptions } from 'jsonwebtoken';
import type { Config } from '../config';

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

export function signAccessToken(config: Config, claims: Omit<AccessClaims, 'type'>): string {
  const payload: AccessClaims = { ...claims, type: 'access' };
  const opts: SignOptions = {
    expiresIn: config.JWT_ACCESS_TTL_SECONDS,
    algorithm: 'HS256',
    issuer: 'ather.auth'
  };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(config: Config, claims: Omit<RefreshClaims, 'type'>): string {
  const payload: RefreshClaims = { ...claims, type: 'refresh' };
  const opts: SignOptions = {
    expiresIn: config.JWT_REFRESH_TTL_SECONDS,
    algorithm: 'HS256',
    issuer: 'ather.auth'
  };
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, opts);
}

export function verifyAccessToken(config: Config, token: string): AccessClaims {
  const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: 'ather.auth'
  });
  if (typeof decoded === 'string' || (decoded as AccessClaims).type !== 'access') {
    throw new Error('Invalid access token');
  }
  return decoded as AccessClaims;
}

export function verifyRefreshToken(config: Config, token: string): RefreshClaims {
  const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: 'ather.auth'
  });
  if (typeof decoded === 'string' || (decoded as RefreshClaims).type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return decoded as RefreshClaims;
}
