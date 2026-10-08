import { formatServicePrice } from '../money';

export interface CatalogService {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  priceIsFrom: boolean;
  priceLabel: string;
  durationMinutes: number;
}

export interface CatalogHours {
  weekday: number;
  isOpen: boolean;
  open: string | null;
  close: string | null;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface Catalog {
  services: CatalogService[];
  hours: CatalogHours[];
}

export type CatalogResult = { ok: true; catalog: Catalog };

/** Serviços e preços. Para alterar, edite aqui e publique de novo. */
export const SERVICES: Omit<CatalogService, 'priceLabel'>[] = [
  { id: 'corte', name: 'Corte', description: 'Corte simples, disfarçado em geral.', priceCents: 4000, priceIsFrom: false, durationMinutes: 40 },
  { id: 'cabelo-barba', name: 'Cabelo e barba', description: 'Corte e barba completos.', priceCents: 6000, priceIsFrom: false, durationMinutes: 60 },
  { id: 'luzes', name: 'Luzes', description: 'Valor final depende do comprimento e do volume.', priceCents: 12000, priceIsFrom: true, durationMinutes: 120 },
  { id: 'platinado', name: 'Platinado', description: 'Valor final depende do comprimento e do volume.', priceCents: 13000, priceIsFrom: true, durationMinutes: 180 },
];

/** Horário de funcionamento (0 = domingo). */
export const HOURS: CatalogHours[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
  weekday === 0
    ? { weekday, isOpen: false, open: null, close: null, breakStart: null, breakEnd: null }
    : { weekday, isOpen: true, open: '07:00', close: '19:00', breakStart: '12:00', breakEnd: '13:00' },
);

export async function getCatalog(): Promise<CatalogResult> {
  return {
    ok: true,
    catalog: {
      services: SERVICES.map((s) => ({ ...s, priceLabel: formatServicePrice(s.priceCents, s.priceIsFrom) })),
      hours: HOURS,
    },
  };
}

const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Agrupa dias com o mesmo horário: "Seg a Sáb · 07:00–19:00 · almoço 12:00–13:00". */
export function describeHours(hours: CatalogHours[]): { days: string; text: string }[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  const label = (h: CatalogHours | undefined) =>
    !h || !h.isOpen
      ? 'Fechado'
      : `${h.open}–${h.close}${h.breakStart ? ` · almoço ${h.breakStart}–${h.breakEnd}` : ''}`;
  const groups: { days: number[]; text: string }[] = [];
  for (const d of order) {
    const text = label(byDay.get(d));
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.days.push(d);
    else groups.push({ days: [d], text });
  }
  return groups.map((g) => ({
    days: g.days.length > 2 ? `${SHORT[g.days[0]!]} a ${SHORT[g.days[g.days.length - 1]!]}` : g.days.map((d) => SHORT[d]).join(' e '),
    text: g.text,
  }));
}
