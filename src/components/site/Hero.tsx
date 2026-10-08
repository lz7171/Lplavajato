import Image from 'next/image';
import logo from '@/images/logo-jef-barber.png';
import type { Biz } from '@/lib/config';
import { whatsappLink } from '@/lib/phone';
import { HeroGlow } from './HeroGlow';

export function Hero({ biz }: { biz: Biz }) {
  return (
    <header className="hero" id="inicio">
      <HeroGlow />
      <div className="wrap">
        <div className="stage">
          <div className="pole" aria-hidden="true" />
          <div className="sign">
            <Image
              src={logo}
              alt={`${biz.name} Academy`}
              priority
              quality={80}
              sizes="(min-width: 760px) 560px, calc(100vw - 90px)"
            />
          </div>
          <div className="pole" aria-hidden="true" />
        </div>
        <svg className="scis" viewBox="0 0 120 60" aria-hidden="true">
          <g className="b1">
            <path d="M10 8 L78 34" />
            <circle cx="86" cy="42" r="9" />
          </g>
          <g className="b2">
            <path d="M10 52 L78 26" />
            <circle cx="86" cy="18" r="9" />
          </g>
          <circle cx="52" cy="30" r="3" className="pv" />
        </svg>
        <h1>Corte, luzes e platinado</h1>
        <p>{biz.specialty} Veja os serviços, os trabalhos e fale com o Jef pelo WhatsApp.</p>
        <div className="btn-row">
          <a className="btn" href={whatsappLink(biz.whatsapp, 'Olá, Jef! Vim pelo site.')} target="_blank" rel="noopener noreferrer">
            Chamar no WhatsApp
          </a>
          <a className="btn ghost" href="#trabalhos">
            Ver trabalhos
          </a>
        </div>
      </div>
    </header>
  );
}

const WORDS = ['CORTE', 'DISFARÇADO', 'CABELO E BARBA', 'LUZES', 'PLATINADO', 'CABELO LISO'];

export function Ticker() {
  const items = [...WORDS, ...WORDS];
  return (
    <div className="ticker-clip" aria-hidden="true">
      <div className="ticker">
        <div className="track">
          {items.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
