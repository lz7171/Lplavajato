// Teste de conexão: abra /api/db-ping no site (o gvp também usa). Não mostra senha nem host.
const { db, infoConexao, explicarErro } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const t0 = Date.now();
  try {
    const [rows] = await db().query('SELECT NOW() AS agora');
    res.status(200).json({ ok: true, agora: rows[0].agora, ms: Date.now() - t0, tls: infoConexao().tls });
  } catch (e) {
    console.error('[db-ping]', e.code || '', e.message);
    const config = e.code === 'ENV_MISSING' || e.code === 'ENV_INVALID';
    const { code, dica } = explicarErro(e);
    // "code" (ex.: ER_ACCESS_DENIED_ERROR, ECONNREFUSED) não revela segredo e permite o gvp corrigir sozinho
    res.status(500).json({
      ok: false,
      error: config ? e.message : 'falha ao consultar o banco',
      code,
      dica,
    });
  }
};
