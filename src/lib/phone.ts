/**
 * Telefones são guardados como 55 + DDD + 9 + 8 dígitos (13 dígitos),
 * o mesmo formato usado pelo WhatsApp (wa.me).
 */
const STORED = /^55[1-9][1-9]9\d{8}$/;

/** Normaliza o que o cliente digitou. Retorna null se não for um celular válido. */
export function normalizeBrazilMobile(input: string): string | null {
  if (typeof input !== 'string' || input.length > 30) return null;
  let digits = input.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (digits.length === 11) digits = `55${digits}`;
  return STORED.test(digits) ? digits : null;
}

export function isStoredPhone(value: string): boolean {
  return STORED.test(value);
}

/** Telefone removido a pedido do cliente (LGPD). */
export function isAnonymized(stored: string): boolean {
  return stored.startsWith('anon-');
}

/** 5522988187207 → "(22) 98818-7207" */
export function formatPhone(stored: string): string {
  if (isAnonymized(stored)) return '— (dados removidos)';
  if (!STORED.test(stored)) return stored;
  const ddd = stored.slice(2, 4);
  const first = stored.slice(4, 9);
  const last = stored.slice(9);
  return `(${ddd}) ${first}-${last}`;
}

/** Link do WhatsApp com mensagem pronta. */
export function whatsappLink(stored: string, text?: string): string {
  const base = `https://wa.me/${stored}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
