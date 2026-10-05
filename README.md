# LZ Lava-Jato — site + agendamento com contas

HTML/CSS/JS puro + funções em `/api` (Vercel) + banco MySQL/TiDB (`DATABASE_URL`). As tabelas são criadas sozinhas no primeiro acesso.

## Configurar no Vercel (Settings → Environment Variables)
1. `DATABASE_URL` — a mesma que você já testou em `/api/db-ping` (deve responder `ok: true`).
2. `ADMIN_PASSWORD` (opcional) — nova senha do painel (mín. 8 caracteres). Sem ela vale a senha padrão (guardada só como hash em `api/admin.js`). Mantenha o repositório **privado**.
3. Faça um novo deploy. O `@vercel/kv` não é mais usado.

## Painel secreto
Abra `/lz-painel` (não aparece no site nem no Google) ou dê 5 toques rápidos na logo do rodapé. Mostra resumo, pendentes, agenda, clientes e estatísticas, e permite confirmar, concluir, marcar falta, cancelar, reativar, bloquear cliente e trocar senha de cliente.

## Como o site evita "agendamento fantasma"
- Só agenda quem tem conta (WhatsApp + senha de 4–8 números). Senhas ficam com hash (scrypt).
- Cliente novo: 1 agendamento ativo por vez e a reserva fica **pendente por 90 min**; se você não confirmar no painel (após ver a mensagem chegar do mesmo WhatsApp), o horário volta para a agenda e o cliente ganha 1 strike.
- Cliente com 1 atendimento concluído vira confiável: até 2 ativos e confirmação automática.
- 3 strikes (reserva expirada ou falta) = bloqueio do agendamento online (você desbloqueia no painel).
- Antecedência mínima de 90 min; limites por IP/conta no cadastro, login e reservas; cliente pode cancelar o próprio horário.
- Regras ajustáveis no topo de `api/_core.js` (`HOLD_MIN`, `MAX_STRIKES`, `MAX_NEW`, `MAX_TRUSTED`) e `api/_lib.js` (dias, horários, preços).
