/**
 * Dinheiro é sempre tratado em centavos inteiros. Nada de float.
 */

export const MAX_CENTS = 10_000_000; // R$ 100.000,00 por lançamento

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 4000 → "R$ 40,00" (apenas formatação; não faz conta com float). */
export function formatBRL(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError('Valor em centavos deve ser inteiro');
  }
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100);
  const rest = abs - reais * 100;
  const text = `R$ ${groupThousands(String(reais))},${String(rest).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

/** Preço de serviço: "R$ 40,00" ou "a partir de R$ 120,00". */
export function formatServicePrice(cents: number, isFrom: boolean): string {
  return isFrom ? `a partir de ${formatBRL(cents)}` : formatBRL(cents);
}

/**
 * Converte o que o usuário digitou em centavos, sem float.
 * Aceita: "40", "40,5", "40,50", "1.234,56", "R$ 1.234,56", "40.50".
 * Retorna null se o texto não for um valor válido.
 */
export function parseBRLToCents(input: string): number | null {
  if (typeof input !== 'string') return null;
  let text = input.trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '');
  if (text.length === 0 || text.length > 16) return null;

  if (text.includes(',')) {
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(text) && !/^\d+(,\d{1,2})?$/.test(text)) return null;
    text = text.replace(/\./g, '');
  } else if (/^\d+\.\d{1,2}$/.test(text)) {
    text = text.replace('.', ',');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  } else if (!/^\d+$/.test(text)) {
    return null;
  }

  const [reaisPart = '0', centsPart = ''] = text.split(',');
  const reais = Number.parseInt(reaisPart, 10);
  const centsValue = Number.parseInt(centsPart.padEnd(2, '0') || '0', 10);
  if (!Number.isSafeInteger(reais) || !Number.isSafeInteger(centsValue)) return null;
  const total = reais * 100 + centsValue;
  if (!Number.isSafeInteger(total) || total > MAX_CENTS * 10) return null;
  return total;
}

/** Centavos → texto para preencher um campo de formulário ("40,00"). */
export function centsToInput(cents: number): string {
  return formatBRL(cents).replace('R$ ', '').replace(/\./g, '');
}
