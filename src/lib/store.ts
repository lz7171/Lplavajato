import { hasDb, query } from './db';
import { BUSINESS, type Biz } from './config';
import { HOURS, SERVICES, type CatalogHours } from './data/catalog';
import { isGalleryCategory, type GalleryCategory } from './gallery';

export interface ServiceInput {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  priceIsFrom: boolean;
  durationMinutes: number;
}
export interface RemotePhoto {
  url: string;
  category: GalleryCategory;
  alt: string;
  width: number;
  height: number;
}
export interface Settings {
  business: Biz;
  services: ServiceInput[];
  hours: CatalogHours[];
  photos: RemotePhoto[];
  hiddenStatic: number[];
}

/** Sem DATABASE_URL o site usa os dados padrão e o painel avisa para conectar o banco. */
export { hasDb };
const KEY = 'settings';
const PHOTO_URL = /^\/api\/foto\/(\d{1,10})$/;
const photoId = (url: string) => Number(PHOTO_URL.exec(url)?.[1] ?? 0);

export function defaults(): Settings {
  return {
    business: { name: BUSINESS.name, whatsapp: BUSINESS.whatsapp, instagram: BUSINESS.instagram, address: BUSINESS.address, mapsUrl: BUSINESS.mapsUrl, specialty: BUSINESS.specialty },
    services: SERVICES.map((s) => ({ ...s })),
    hours: HOURS.map((h) => ({ ...h })),
    photos: [],
    hiddenStatic: [],
  };
}

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const time = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);

/** Valida e normaliza qualquer entrada (arquivo salvo ou enviada pelo painel). */
export function sanitize(input: unknown, base: Settings = defaults()): Settings {
  const j = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const b = (j.business && typeof j.business === 'object' ? j.business : {}) as Record<string, unknown>;
  const digits = str(b.whatsapp, 20, base.business.whatsapp).replace(/\D/g, '');
  const insta = str(b.instagram, 120, base.business.instagram).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0] ?? '';
  const maps = str(b.mapsUrl, 500, base.business.mapsUrl);
  const business: Biz = {
    name: base.business.name,
    whatsapp: /^55\d{10,11}$/.test(digits) ? digits : base.business.whatsapp,
    instagram: /^[A-Za-z0-9._]{0,30}$/.test(insta) ? insta : base.business.instagram,
    address: str(b.address, 200, base.business.address),
    mapsUrl: maps === '' || /^https:\/\//.test(maps) ? maps : base.business.mapsUrl,
    specialty: str(b.specialty, 200, base.business.specialty) || base.business.specialty,
  };
  const services = Array.isArray(j.services)
    ? j.services.slice(0, 30).flatMap((raw, i) => {
        const s = (raw ?? {}) as Record<string, unknown>;
        const name = str(s.name, 60);
        if (!name) return [];
        return [{ id: str(s.id, 40) || `servico-${i}`, name, description: str(s.description, 160), priceCents: num(s.priceCents, 0, 10_000_000, 0), priceIsFrom: s.priceIsFrom === true, durationMinutes: num(s.durationMinutes, 5, 1440, 40) }];
      })
    : base.services;
  const hours: CatalogHours[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const h = Array.isArray(j.hours) ? ((j.hours.find((x) => (x as { weekday?: number })?.weekday === weekday) ?? {}) as Record<string, unknown>) : null;
    const fb = base.hours.find((x) => x.weekday === weekday)!;
    if (!h) return fb;
    const open = time(h.open);
    const close = time(h.close);
    const isOpen = h.isOpen === true && !!open && !!close;
    const bs = time(h.breakStart);
    const be = time(h.breakEnd);
    return { weekday, isOpen, open: isOpen ? open : null, close: isOpen ? close : null, breakStart: isOpen && bs && be ? bs : null, breakEnd: isOpen && bs && be ? be : null };
  });
  const photos = Array.isArray(j.photos)
    ? j.photos.slice(0, 200).flatMap((raw) => {
        const p = (raw ?? {}) as Record<string, unknown>;
        const url = str(p.url, 600);
        if (!PHOTO_URL.test(url)) return [];
        return [{ url, category: isGalleryCategory(p.category) ? p.category : ('outros' as const), alt: str(p.alt, 140) || 'Trabalho do Jef Barber', width: num(p.width, 50, 4000, 1200), height: num(p.height, 50, 4000, 1200) }];
      })
    : base.photos;
  const hiddenStatic = Array.isArray(j.hiddenStatic) ? [...new Set(j.hiddenStatic.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 200))] : base.hiddenStatic;
  return { business, services, hours, photos, hiddenStatic };
}

export async function loadSettings(): Promise<Settings> {
  const d = defaults();
  if (!hasDb()) return d;
  try {
    const rows = await query<{ v: string }>('SELECT v FROM jb_kv WHERE k=?', [KEY]);
    return rows[0] ? sanitize(JSON.parse(rows[0].v), d) : d;
  } catch (e) {
    console.error('loadSettings:', e);
    return d;
  }
}

/** Lança erro se o banco falhar (o painel mostra o motivo). */
export async function loadSettingsStrict(): Promise<Settings> {
  const d = defaults();
  const rows = await query<{ v: string }>('SELECT v FROM jb_kv WHERE k=?', [KEY]);
  return rows[0] ? sanitize(JSON.parse(rows[0].v), d) : d;
}

export async function saveSettings(s: Settings, previous?: Settings) {
  await query('INSERT INTO jb_kv (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v=VALUES(v)', [KEY, JSON.stringify(s)]);
  if (previous) {
    const keep = new Set(s.photos.map((p) => p.url));
    const gone = previous.photos.filter((p) => !keep.has(p.url)).map((p) => photoId(p.url)).filter(Boolean);
    if (gone.length) await query('DELETE FROM jb_foto WHERE id IN (?)', [gone]).catch(() => undefined);
  }
}

export async function savePhoto(mime: string, img: Buffer): Promise<string> {
  const res = (await query<never>('INSERT INTO jb_foto (mime, img, criado_em) VALUES (?, ?, ?)', [mime, img, Date.now()])) as unknown as { insertId: number };
  return `/api/foto/${res.insertId}`;
}

export async function deletePhoto(url: string) {
  const id = photoId(url);
  if (id) await query('DELETE FROM jb_foto WHERE id=?', [id]).catch(() => undefined);
}
