import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { explainDbError, hasDb } from '@/lib/db';
import { defaults, loadSettingsStrict, sanitize, saveSettings } from '@/lib/store';
import { STATIC_WORKS } from '@/lib/static-count';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'auth' }, { status: 401 });
  if (!hasDb()) return NextResponse.json({ settings: defaults(), db: false, dbError: explainDbError({ code: 'ENV_MISSING' }), staticWorks: STATIC_WORKS });
  try {
    return NextResponse.json({ settings: await loadSettingsStrict(), db: true, staticWorks: STATIC_WORKS });
  } catch (e) {
    console.error('settings GET:', e);
    return NextResponse.json({ settings: defaults(), db: false, dbError: explainDbError(e), staticWorks: STATIC_WORKS });
  }
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'auth' }, { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: 'Defina DATABASE_URL na Vercel (veja o README).' }, { status: 503 });
  try {
    const previous = await loadSettingsStrict();
    const next = sanitize(await req.json().catch(() => ({})), previous);
    await saveSettings(next, previous);
    revalidatePath('/');
    return NextResponse.json({ settings: next });
  } catch (e) {
    console.error('settings PUT:', e);
    const { code, hint } = explainDbError(e);
    return NextResponse.json({ error: `${hint} (${code})` }, { status: 500 });
  }
}
