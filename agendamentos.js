// api/agendamentos.js
// Serverless Function do Vercel. Sobe automaticamente quando você faz deploy
// do repositório (basta a pasta /api existir na raiz do projeto).
//
// Rotas:
//   POST /api/agendamentos      -> salva um novo agendamento
//   GET  /api/agendamentos      -> lista os agendamentos (precisa da chave admin)
//
// Requer a variável de ambiente POSTGRES_URL (criada automaticamente quando
// você conecta um banco "Vercel Postgres" ao projeto) e ADMIN_KEY (você define).

const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  // CORS básico (permite chamar de qualquer origem; ajuste se quiser travar)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await ensureTable();

    if (req.method === 'POST') {
      return await criarAgendamento(req, res);
    }

    if (req.method === 'GET') {
      return await listarAgendamentos(req, res);
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      veiculo TEXT NOT NULL,
      servico_id TEXT,
      data_agendamento DATE NOT NULL,
      horario TEXT NOT NULL,
      observacao TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

async function criarAgendamento(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { nome, telefone, veiculo, servicoId, data, horario, observacao } = body;

  if (!nome || !telefone || !veiculo || !data || !horario) {
    return res.status(400).json({ ok: false, error: 'Campos obrigatórios faltando (nome, telefone, veiculo, data, horario).' });
  }

  // Evita duplicar o mesmo horário no mesmo dia
  const existente = await sql`
    SELECT id FROM agendamentos WHERE data_agendamento = ${data} AND horario = ${horario};
  `;
  if (existente.rows.length > 0) {
    return res.status(409).json({ ok: false, error: 'Esse horário já foi reservado.' });
  }

  const result = await sql`
    INSERT INTO agendamentos (nome, telefone, veiculo, servico_id, data_agendamento, horario, observacao)
    VALUES (${nome}, ${telefone}, ${veiculo}, ${servicoId || null}, ${data}, ${horario}, ${observacao || null})
    RETURNING id, criado_em;
  `;

  return res.status(201).json({ ok: true, id: result.rows[0].id, criado_em: result.rows[0].criado_em });
}

async function listarAgendamentos(req, res) {
  // Proteção simples: exige a mesma chave definida em ADMIN_KEY (env do Vercel)
  const chave = req.headers['x-admin-key'] || req.query.key;
  if (!process.env.ADMIN_KEY || chave !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Não autorizado' });
  }

  const { data } = req.query;
  const result = data
    ? await sql`SELECT * FROM agendamentos WHERE data_agendamento = ${data} ORDER BY horario;`
    : await sql`SELECT * FROM agendamentos ORDER BY data_agendamento DESC, horario DESC LIMIT 200;`;

  return res.status(200).json({ ok: true, agendamentos: result.rows });
}
