import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const NAME = 'jb_admin';
const secret = () => process.env.APP_SECRET || process.env.ADMIN_PASSWORD || '';
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('hex');
const sha = (v: string) => createHash('sha256').update(v).digest();

export function checkPassword(input: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || typeof input !== 'string') return false;
  return timingSafeEqual(sha(input), sha(real));
}

export async function startSession() {
  const exp = String(Date.now() + 7 * 864e5);
  (await cookies()).set(NAME, `${exp}.${sign(exp)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 7 * 86400 });
}

export async function endSession() {
  (await cookies()).delete(NAME);
}

export async function isAdmin(): Promise<boolean> {
  if (!secret()) return false;
  const v = (await cookies()).get(NAME)?.value;
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
