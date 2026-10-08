import Image from 'next/image';
import { Footer, WhatsAppButton } from '@/components/site/Footer';
import { Gallery, type GalleryItem } from '@/components/site/Gallery';
import { Hero, Ticker } from '@/components/site/Hero';
import { Services } from '@/components/site/Services';
import { SPACE_PHOTOS, WORK_PHOTOS } from '@/components/site/static-photos';
import { VideoPlayer } from '@/components/site/VideoPlayer';
import { formatServicePrice } from '@/lib/money';
import { loadSettings } from '@/lib/store';
import { whatsappLink } from '@/lib/phone';
import type { Biz } from '@/lib/config';
import { siteUrl } from '@/lib/env';

// Página estática regenerada a cada 60 s (e na hora quando o painel altera algo).
export const revalidate = 60;

function jsonLd(BUSINESS: Biz, catalogHours: { weekday: number; isOpen: boolean; open: string | null; close: string | null }[]) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: BUSINESS.name,
    url: siteUrl(),
    telephone: `+${BUSINESS.whatsapp}`,
    description: BUSINESS.specialty,
    openingHoursSpecification: catalogHours
      .filter((h) => h.isOpen && h.open && h.close)
      .map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: days[h.weekday], opens: h.open, closes: h.close })),
  };
  if (BUSINESS.address) data.address = BUSINESS.address;
  // Escapa "<" para não permitir fechar a tag script.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function HomePage() {
  const settings = await loadSettings();
  const biz = settings.business;
  const catalog = {
    ok: true as const,
    catalog: {
      services: settings.services.map((v) => ({ ...v, priceLabel: formatServicePrice(v.priceCents, v.priceIsFrom) })),
      hours: settings.hours,
    },
  };
  const galleryItems: GalleryItem[] = [
    ...settings.photos.map((p, i) => ({ kind: 'remote' as const, key: `remote-${i}`, category: p.category, src: p.url, width: p.width, height: p.height, alt: p.alt })),
    ...WORK_PHOTOS.flatMap((p, i) => (settings.hiddenStatic.includes(i) ? [] : [{ kind: 'static' as const, key: `static-${i}`, category: p.category, src: p.src, alt: p.alt }])),
  ];

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {catalog.ok && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(biz, catalog.catalog.hours) }} />}
      <Hero biz={biz} />
      <Ticker />
      <main id="conteudo">
        <Services catalog={catalog} biz={biz} />

        <section id="trabalhos" aria-labelledby="trabalhos-titulo">
          <div className="wrap">
            <h2 id="trabalhos-titulo">Trabalhos</h2>
            <p className="sub">Escolha o serviço para ver só aquele tipo de trabalho. O ponto forte do Jef é cabelo liso. Toque numa foto para ampliar.</p>
            <Gallery items={galleryItems} />
          </div>
        </section>

        <section className="cta-band" aria-label="Chamar no WhatsApp">
          <div className="wrap">
            <h2>Gostou? Garanta o seu horário</h2>
            <p>Mande uma mensagem e o Jef responde para combinar dia e hora.</p>
            <a className="btn" href={whatsappLink(biz.whatsapp, 'Olá, Jef! Vim pelo site e quero marcar um horário.')} target="_blank" rel="noopener noreferrer">
              Marcar pelo WhatsApp
            </a>
          </div>
        </section>

        <section id="espaco" aria-labelledby="espaco-titulo">
          <div className="wrap vgrid">
            <div>
              <h2 id="espaco-titulo">Conheça o espaço</h2>
              <p className="sub">Ar-condicionado, cadeiras de couro e um lugar para ficar à vontade. Veja como é por dentro antes de chegar.</p>
              <div className="space-photos">
                {SPACE_PHOTOS.map((p) => (
                  <Image key={p.alt} src={p.src} alt={p.alt} sizes="(min-width: 1080px) 330px, (min-width: 700px) 30vw, 50vw" quality={70} placeholder="blur" />
                ))}
              </div>
            </div>
            <VideoPlayer src="/video/jef-barber.mp4" poster="/video/poster.jpg" />
          </div>
        </section>
      </main>
      <Footer catalog={catalog} biz={biz} />
      <WhatsAppButton biz={biz} />
    </>
  );
}
