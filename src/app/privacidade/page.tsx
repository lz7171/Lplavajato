import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS } from '@/lib/config';
import { formatPhone, whatsappLink } from '@/lib/phone';

export const metadata: Metadata = {
  title: 'Privacidade',
  description: 'Como a Jef Barber usa os dados informados no contato e no atendimento.',
  alternates: { canonical: '/privacidade' },
};

export default function PrivacyPage() {
  return (
    <main className="page">
      <div className="wrap prose">
        <Link className="back" href="/">
          ← Voltar ao site
        </Link>
        <h1>Privacidade</h1>
        <p>Esta página explica, de forma simples, como a {BUSINESS.name} trata os dados informados no contato e no atendimento (Lei nº 13.709/2018 — LGPD).</p>
        <h2>Quais dados coletamos</h2>
        <ul>
          <li>Nome e número de WhatsApp que você mesmo envia ao falar com o Jef.</li>
          <li>Serviço e horário combinados na conversa.</li>
        </ul>
        <h2>Para que usamos</h2>
        <ul>
          <li>Combinar o horário e falar com você sobre o atendimento.</li>
        </ul>
        <p>Não vendemos nem compartilhamos seus dados para publicidade. Outros clientes nunca veem seus dados.</p>
        <h2>Onde ficam guardados</h2>
        <p>Este site não pede cadastro. Os dados do WhatsApp ficam apenas no seu aplicativo, em conversa direta com o Jef.</p>
        <h2>Seus direitos</h2>
        <p>
          Você pode pedir para ver, corrigir ou apagar seus dados pelo WhatsApp{' '}
          <a href={whatsappLink(BUSINESS.whatsapp, 'Olá! Quero falar sobre meus dados.')}>{formatPhone(BUSINESS.whatsapp)}</a>. Registros financeiros
          podem ser mantidos pelo prazo exigido em lei.
        </p>
      </div>
    </main>
  );
}
