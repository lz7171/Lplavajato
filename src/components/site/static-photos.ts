import type { StaticImageData } from 'next/image';
import espacoEntrada from '@/images/espaco-entrada.jpg';
import espacoSalao from '@/images/espaco-salao.jpg';
import corte1 from '@/images/trabalho-corte-1.jpg';
import corte2 from '@/images/trabalho-corte-2.jpg';
import corte3 from '@/images/trabalho-corte-3.jpg';
import corte4 from '@/images/trabalho-corte-4.jpg';
import corte5 from '@/images/trabalho-corte-5.jpg';
import luzes1 from '@/images/trabalho-luzes-1.jpg';
import luzes2 from '@/images/trabalho-luzes-2.jpg';
import luzes3 from '@/images/trabalho-luzes-3.jpg';
import luzesCacheado from '@/images/trabalho-luzes-cacheado.jpg';
import mechas from '@/images/trabalho-mechas.jpg';
import plat1 from '@/images/trabalho-platinado-1.jpg';
import plat2 from '@/images/trabalho-platinado-2.jpg';
import plat4 from '@/images/trabalho-platinado-4.jpg';
import plat5 from '@/images/trabalho-platinado-5.jpg';
import type { GalleryCategory } from '@/lib/gallery';

export interface Photo {
  src: StaticImageData;
  alt: string;
}

export interface WorkPhoto extends Photo {
  category: GalleryCategory;
}

/** Fotos do salão (seção "Conheça o espaço"). */
export const SPACE_PHOTOS: Photo[] = [
  { src: espacoSalao, alt: 'Salão da Jef Barber com cadeiras de couro, espelho iluminado, sofá e lavatório' },
  { src: espacoEntrada, alt: 'Entrada da Jef Barber com cadeiras de couro, geladeira de bebidas e porta de vidro para a rua' },
];

/** Trabalhos enviados pelo Jef, por serviço (ordem de exibição). */
export const WORK_PHOTOS: WorkPhoto[] = [
  { category: 'platinado', src: plat2, alt: 'Platinado com topete e degradê alto' },
  { category: 'platinado', src: plat4, alt: 'Platinado com topete, degradê e barba' },
  { category: 'platinado', src: plat5, alt: 'Platinado com topete texturizado e degradê' },
  { category: 'platinado', src: plat1, alt: 'Platinado curto com disfarçado nas laterais' },
  { category: 'luzes', src: luzes1, alt: 'Luzes em cabelo liso penteado para o lado, com degradê' },
  { category: 'luzes', src: luzesCacheado, alt: 'Luzes em cabelo cacheado com disfarçado' },
  { category: 'luzes', src: mechas, alt: 'Mechas claras com degradê e risca' },
  { category: 'luzes', src: luzes2, alt: 'Luzes vistas de cima em cabelo liso' },
  { category: 'luzes', src: luzes3, alt: 'Luzes em cabelo liso com disfarçado, vista lateral' },
  { category: 'corte', src: corte2, alt: 'Corte curto com degradê baixo bem marcado' },
  { category: 'corte', src: corte4, alt: 'Corte com volume penteado para trás e barba alinhada' },
  { category: 'corte', src: corte1, alt: 'Corte social penteado para trás com barba' },
  { category: 'corte', src: corte3, alt: 'Degradê baixo na nuca e nas laterais, outro ângulo' },
  { category: 'corte', src: corte5, alt: 'Acabamento reto na nuca com cabelo penteado para trás' },
];
