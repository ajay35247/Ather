import jwt from 'jsonwebtoken';
import type { Config } from '../config';

export interface AccessClaims {
  sub: string;
  handle: string;
  type: 'access';
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
