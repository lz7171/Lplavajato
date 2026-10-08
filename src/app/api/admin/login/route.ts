import { NextResponse } from 'next/server';
import { checkPassword, endSession, startSession } from '@/lib/auth';

export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Defina a variável ADMIN_PASSWORD na Vercel.' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(String(body.password ?? ''))) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
  }
  await startSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await endSession();
  return NextResponse.json({ ok: true });
}
