# LZ Lava-Jato

## Estrutura recomendada

Este projeto tem uma arquitetura simples:

- `index.html` — frontend da landing page e do formulário de agendamento
- `api/book.js` — API para criar reservas
- `api/slots.js` — API para consultar horários disponíveis
- `package.json` — dependência do Vercel KV

## Arquivos duplicados

Há cópias duplicadas dos endpoints em:

- `book.js`
- `slots.js`

Esses arquivos duplicados não devem ser a fonte de verdade. O backend oficial e a referência para deploy é a pasta `api/`.

## Regras de operação

1. Mantenha o código principal em `api/`.
2. Evite duplicar lógicas em arquivos na raiz.
3. Configure as variáveis do Vercel KV antes do deploy.
4. Teste o app em um ambiente HTTP real, e não só abrindo `index.html` diretamente.

## Variáveis de ambiente necessárias

Use as seguintes variáveis no Vercel ou em um arquivo `.env` local:

```bash
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

## Erros frequentes

- `500` ao reservar ou consultar horários: normalmente indica que o Vercel KV não está configurado corretamente.
- `404` nas rotas `/api/book` ou `/api/slots`: geralmente indica que a aplicação não foi deployada com a pasta `api/` correta.
- `409` ao reservar: significa que o horário já foi tomado por outra pessoa.

## Execução local

Para testar localmente em ambiente HTTP:

```bash
npm install
npx serve .
```

ou use o ambiente do Vercel para emular as funções.
