import { WORK_PHOTOS } from '@/components/site/static-photos';

/** Fotos fixas do site (para o painel poder ocultá-las). */
export const STATIC_WORKS = WORK_PHOTOS.map((p) => ({ category: p.category, alt: p.alt }));
