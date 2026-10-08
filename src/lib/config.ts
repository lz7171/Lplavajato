/**
 * Dados fixos da barbearia. Para alterar, edite este arquivo e publique de
 * novo.
 */
export const BUSINESS = {
  name: 'Jef Barber',
  /** Fuso oficial. */
  timezone: 'America/Sao_Paulo',
  /** WhatsApp no formato 55 + DDD + número (sem espaços). */
  whatsapp: '5522988187207',
  /** Preencha quando tiver (ex.: 'jefbarber'). Vazio = não aparece no site. */
  instagram: 'jefbarber_',
  /** Endereço completo. Vazio = não aparece no site. */
  address: 'Av. Nilo Peçanha, 845 - Miracema, RJ',
  /** Link do Google Maps. Vazio = não aparece no site. */
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Av.+Nilo+Pe%C3%A7anha+845+Miracema+RJ',
  specialty: 'Especialista em cabelo liso, luzes e platinado.',
} as const;

export type Biz = { name: string; whatsapp: string; instagram: string; address: string; mapsUrl: string; specialty: string };
