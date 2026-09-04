import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './db';

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-secret-change-me');
const COOKIE_NAME = 'or_session';
const SESSION_DAYS = 14;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  email_verified: boolean;
  stripe_customer_id: string | null;
}

// ---- Password hashing ----
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---- JWT signing/verifying ----
export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(SECRET);
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---- Cookie helpers ----
export async function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  const { rows } = await query<{
    id: string; email: string; name: string | null; email_verified: boolean; stripe_customer_id: string | null;
  }>(`SELECT id, email, name, email_verified, stripe_customer_id FROM or_users WHERE id = $1`, [userId]);
  return rows[0] ?? null;
}

// ---- Sign up / log in ----
export async function createUser(email: string, password: string, name: string | null): Promise<SessionUser> {
  const hash = await hashPassword(password);
  const { rows } = await query<SessionUser & { password_hash: string }>(
    `INSERT INTO or_users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, email_verified, stripe_customer_id`,
    [email.toLowerCase(), hash, name]
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...user } = rows[0] as SessionUser & { password_hash: string };
  return user;
}

export async function findUserByEmail(email: string): Promise<(SessionUser & { password_hash: string }) | null> {
  const { rows } = await query<SessionUser & { password_hash: string }>(
    `SELECT id, email, name, email_verified, stripe_customer_id, password_hash
     FROM or_users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<SessionUser | null> {
  const { rows } = await query<SessionUser>(
    `SELECT id, email, name, email_verified, stripe_customer_id
     FROM or_users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}
