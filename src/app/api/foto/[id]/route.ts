import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return new NextResponse(null, { status: 404 });
  try {
    const rows = await query<{ mime: string; img: Buffer }>('SELECT mime, img FROM jb_foto WHERE id=?', [id]);
    const r = rows[0];
    if (!r) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(r.img), { headers: { 'Content-Type': r.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
