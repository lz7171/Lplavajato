import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { explainDbError, hasDb } from '@/lib/db';
import { isGalleryCategory } from '@/lib/gallery';
import { deletePhoto, loadSettingsStrict, savePhoto, saveSettings } from '@/lib/store';

const MAGIC: Record<string, number[]> = { 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/webp': [0x52, 0x49, 0x46, 0x46] };

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'auth' }, { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: 'Defina DATABASE_URL na Vercel (veja o README).' }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File)) return NextResponse.json({ error: 'Arquivo ausente.' }, { status: 400 });
  const magic = MAGIC[file.type];
  if (!magic) return NextResponse.json({ error: 'Use JPG, PNG ou WEBP.' }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Imagem acima de 4 MB.' }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (!magic.every((b, i) => buf[i] === b)) return NextResponse.json({ error: 'Arquivo não é uma imagem válida.' }, { status: 400 });
  const rawCategory = form.get('category');
  const category = isGalleryCategory(rawCategory) ? rawCategory : 'outros';
  const alt = String(form.get('alt') ?? '').trim().slice(0, 140) || 'Trabalho do Jef Barber';
  const width = Math.min(4000, Math.max(50, Number(form.get('width')) || 1200));
  const height = Math.min(4000, Math.max(50, Number(form.get('height')) || 1200));
  let url = '';
  try {
    url = await savePhoto(file.type, buf);
    const current = await loadSettingsStrict();
    const photo = { url, category, alt, width, height };
    await saveSettings({ ...current, photos: [photo, ...current.photos] });
    revalidatePath('/');
    return NextResponse.json({ photo });
  } catch (e) {
    if (url) await deletePhoto(url);
    console.error('upload:', e);
    const { code, hint } = explainDbError(e);
    return NextResponse.json({ error: `${hint} (${code})` }, { status: 500 });
  }
}
