import localFont from 'next/font/local';

// Fontes servidas pelo próprio site (sem Google Fonts em tempo de execução).
export const display = localFont({
  src: [
    { path: '../../node_modules/@fontsource/big-shoulders-display/files/big-shoulders-display-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../node_modules/@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Arial Narrow', 'Impact', 'sans-serif'],
});

export const body = localFont({
  src: [
    { path: '../../node_modules/@fontsource/barlow/files/barlow-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/barlow/files/barlow-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/barlow/files/barlow-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});
