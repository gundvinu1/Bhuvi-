// ============================================================
// Authentication Request & Response Types
// ============================================================

import { SafeUser } from './user.types';

/** Registration request body */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

/** Login request body */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Authentication response payload returned on register and login */
export interface AuthResponseData {
  user: SafeUser;
  accessToken: string;
  expiresIn: string | number;
}

/** Decoded JWT access token payload */
export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}
