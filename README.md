# LZ Lava-Jato — site + agendamento com contas

HTML/CSS/JS puro + funções em `/api` (Vercel) + banco MySQL/TiDB (`DATABASE_URL`). As tabelas são criadas sozinhas no primeiro acesso.

## Configurar no Vercel (Settings → Environment Variables)
1. `DATABASE_URL` — `mysql://usuario:senha@host:3306/banco`. Senha com símbolos precisa ser codificada (`@` = `%40`, `#` = `%23`). Teste em `/api/db-ping` (deve responder `ok: true`).
2. `ADMIN_PASSWORD` — senha do painel (recomendado 8+ caracteres). Espaços, aspas e quebra de linha sobrando são ignorados. Sem ela vale a senha padrão (guardada só como hash em `api/admin.js`). Mantenha o repositório **privado**.
3. SSL do banco (opcional): por padrão o site tenta conexão segura e, se o banco não tiver SSL, conecta sem. Para forçar: `DB_SSL=false` (ou `?ssl=false` na URL) / `DB_SSL=true` (exige TLS). `DB_CA` só é necessário para provedores com certificado próprio (ex.: Aiven); apague-o se trocar de provedor.
4. Faça um novo deploy. O `@vercel/kv` não é mais usado.

## Painel secreto
Abra `/lz-painel` (não aparece no site nem no Google) ou dê 5 toques rápidos na logo do rodapé. Mostra resumo, pendentes, agenda, clientes e estatísticas, e permite confirmar, concluir, marcar falta, cancelar, reativar, bloquear cliente e trocar senha de cliente.

## Como o site evita "agendamento fantasma"
- Só agenda quem tem conta (WhatsApp + senha de 4–8 números). Senhas ficam com hash (scrypt).
- Cliente novo: 1 agendamento ativo por vez e a reserva fica **pendente por 90 min**; se você não confirmar no painel (após ver a mensagem chegar do mesmo WhatsApp), o horário volta para a agenda e o cliente ganha 1 strike.
- Cliente com 1 atendimento concluído vira confiável: até 2 ativos e confirmação automática.
- 3 strikes (reserva expirada ou falta) = bloqueio do agendamento online (você desbloqueia no painel).
- Antecedência mínima de 90 min; limites por IP/conta no cadastro, login e reservas; cliente pode cancelar o próprio horário.
- Regras ajustáveis no topo de `api/_core.js` (`HOLD_MIN`, `MAX_STRIKES`, `MAX_NEW`, `MAX_TRUSTED`) e `api/_lib.js` (dias, horários, preços).

## Novidades (v2.1)
- **Quadro de serviços**: no painel, aba *Quadro*, envie fotos (reduzidas automaticamente) com data e legenda; elas aparecem no site agrupadas por dia (Hoje, Ontem…). Ficam no próprio banco (tabela `galeria`), sem serviço extra.
- **Folgas**: aba *Folgas* bloqueia um horário ou o dia todo (some da agenda do cliente).
- **Painel**: botão WhatsApp (lembrete/agradecimento), exportar CSV, reativar falta devolve o strike.
- **Login guiado**: o cartão de conta fica no topo da agenda, o botão do topo vira *Entrar* e a reserva sem login leva direto ao cadastro.
- Defina `ADMIN_PASSWORD` no Vercel.

## Correções (v2.2)
- Banco sem SSL (ex.: optiklink) não derruba mais o site/painel (`HANDSHAKE_NO_SSL_SUPPORT`).
- Lista de clientes do painel compatível com MySQL/MariaDB em modo estrito (`ONLY_FULL_GROUP_BY`).
- Senha do painel aceita mesmo com espaço/quebra de linha salvos na variável, ou com menos de 8 caracteres.
- O painel abre mesmo com o banco fora do ar e mostra o motivo (código + dica) com "Tentar de novo".
- Tabelas são recriadas sozinhas se o banco for trocado/recriado com o site no ar.
- `/api/db-ping` (usado pelo gvp) mostra só `ok`, código do erro e dica — nunca host ou senha.
