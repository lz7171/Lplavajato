# JEF BARBER — site + painel

Site da barbearia (Next.js) com **painel administrativo** em `/admin`: enviar fotos, editar serviços, preços, horários e contato — sem mexer em código.

## Ativar o painel (uma vez, na Vercel)
Mesmo esquema do LZ Lava-Jato: banco MySQL + variáveis de ambiente. Fotos e configurações ficam no próprio banco (tabelas `jb_kv` e `jb_foto`, criadas sozinhas no primeiro acesso).
1. **Settings → Environment Variables**: `DATABASE_URL` (`mysql://usuario:senha@host:3306/banco`; na senha `@` = `%40`, `#` = `%23`) e `ADMIN_PASSWORD` (senha do painel). Opcionais: `APP_SECRET`, `DB_SSL` (`false` se o banco não tem SSL), `DB_CA`.
2. **Redeploy**. Acesse `https://SEU-SITE/admin`. Se o banco falhar, o painel mostra o motivo.

Sem essas variáveis o site funciona normalmente com os dados padrão de `src/lib/config.ts` e `src/lib/data/catalog.ts`.

## Publicar com o gvp (Termux)
```
gvp import jef-barber-com-painel.zip
gvp preflight --fix   # pergunta a senha do painel (Enter = gera uma forte e mostra uma vez)
gvp deploy
```
O gvp pede `ADMIN_PASSWORD` e `DATABASE_URL`. `APP_SECRET`, `DB_SSL`, `DB_CA` e `SITE_URL` são opcionais.

## Rodar
```
npm install
npm run dev     # desenvolvimento
npm run check   # lint + typecheck + build
```
