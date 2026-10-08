/**
 * Categorias da galeria de trabalhos. Os mesmos valores existem no banco
 * (gallery_images.category); um teste garante que as listas são iguais.
 */
export const GALLERY_CATEGORIES = ['platinado', 'luzes', 'corte', 'outros'] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<GalleryCategory, string> = {
  platinado: 'Platinado',
  luzes: 'Luzes e mechas',
  corte: 'Cortes',
  outros: 'Outros',
};

export function isGalleryCategory(value: unknown): value is GalleryCategory {
  return typeof value === 'string' && (GALLERY_CATEGORIES as readonly string[]).includes(value);
}
