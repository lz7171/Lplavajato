# LZ Lava-Jato — site + agendamento

Site de uma página (HTML/CSS/JS puro) com agendamento online. As reservas ficam no **Vercel KV** (Redis) e a confirmação final é enviada pelo WhatsApp.

## Estrutura

| Caminho | Função |
|---|---|
| `index.html` | Página (conteúdo, estilos e SEO) |
| `assets/app.js` | Lógica do agendamento no navegador |
| `assets/*.webp/png/jpg` | Logo, hero, favicon e imagem de compartilhamento |
| `api/_lib.js` | **Configuração central** (dias, horários, preços, adicionais) e validações |
| `api/slots.js` | `GET /api/slots?date=AAAA-MM-DD` — horários livres |
| `api/book.js` | `POST /api/book` — reserva um horário |
| `api/admin.js` | `GET/DELETE /api/admin` — ver e cancelar agendamentos (protegido por token) |
| `vercel.json` | Cabeçalhos de segurança e cache |
| `tests/api.test.js` | Testes automatizados da API (`npm test`) |

## Configuração no Vercel

1. Conecte um banco Redis/KV ao projeto (Storage → Create/Connect). Isso cria as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` automaticamente.
2. Crie a variável de ambiente **`ADMIN_TOKEN`** com um texto longo e aleatório (mínimo 16 caracteres). Sem ela, `/api/admin` fica desativado.
3. Faça um novo deploy depois de criar as variáveis.

## Ver os agendamentos pelo Termux

```bash
export SITE="https://lplavajato.vercel.app"
export TOKEN="seu-admin-token"

# próximos 7 dias, em texto simples
curl -s -H "Authorization: Bearer $TOKEN" "$SITE/api/admin?format=text"

# próximos 14 dias em JSON
curl -s -H "Authorization: Bearer $TOKEN" "$SITE/api/admin?days=14"

# um dia específico
curl -s -H "Authorization: Bearer $TOKEN" "$SITE/api/admin?date=2026-10-10&format=text"

# cancelar (libera o horário)
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$SITE/api/admin?date=2026-10-10&time=09:00"
```

## Como mudar regras

- **Dias, horários, preços, adicionais:** edite `api/_lib.js`. Os preços também aparecem em `index.html` (lista de serviços e botões) — mantenha iguais. O servidor recalcula o total e ignora preços enviados pelo navegador.
- **Horários:** um atendimento a cada 2 horas (08h, 10h, 12h, 14h, 16h). A agenda abre uma semana por vez (quinta a domingo da semana atual); no domingo, depois do último horário, abre a semana seguinte.
- **Telefone/nome do WhatsApp:** `WHATSAPP_NUMBER` em `assets/app.js`, links `wa.me` e dados estruturados em `index.html`.
- **Domínio próprio:** troque `https://lplavajato.vercel.app/` no `index.html` (canonical, og:url, og:image), em `robots.txt` e em `sitemap.xml`.

## Proteções implementadas

- Validação de nome, telefone, veículo e adicionais no servidor (lista fechada).
- Datas passadas, fora do expediente ou com mais de 60 dias são recusadas; horários que já passaram hoje também (fuso de Brasília).
- Limite de tentativas: 6 reservas por IP a cada 10 min e 4 por telefone por hora.
- Reserva atômica: dois clientes nunca ficam com o mesmo horário; se algo falhar no meio, o horário é liberado.
- Dados antigos expiram sozinhos (3 dias depois da data do agendamento).

## Testes

```bash
npm test
```
