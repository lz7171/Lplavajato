const { db } = require("./_db");
const C = require("./_core");
const L = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    await C.init();
    await C.sweep();
    if (req.method === "GET") {
      const me = await C.clientFrom(req);
      return res.status(200).json({ cliente: me ? await C.publico(me) : null, agendamentos: me ? await C.meus(me.id) : [] });
    }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Método não permitido." }); }

    const b = L.readBody(req);
    const ip = L.clientIp(req);
    if (b.action === "logout") { C.setCookie(res, "lz_c", "", 0); return res.status(200).json({ ok: true }); }

    const phone = L.cleanPhone(b.phone);
    const pin = String(b.pin || "");
    if (!phone) return res.status(400).json({ error: "Informe um WhatsApp válido com DDD, ex.: (22) 99999-9999." });
    if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: "A senha deve ter de 4 a 8 números." });

    if (b.action === "register") {
      const name = L.cleanName(b.name);
      if (!name) return res.status(400).json({ error: "Informe seu nome (2 a 60 letras)." });
      if (!(await C.limite(`reg:${ip}`, 10, 24 * 3600e3))) return res.status(429).json({ error: "Muitas contas criadas deste aparelho hoje. Fale conosco pelo WhatsApp." });
      let id;
      try {
        const [r] = await db().query("INSERT INTO clientes(nome,telefone,senha,criado_em) VALUES(?,?,?,?)", [name, phone, C.hashPin(pin), Date.now()]);
        id = r.insertId;
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Esse WhatsApp já tem conta. Toque em Entrar." });
        throw e;
      }
      C.login(res, id);
      return res.status(200).json({ ok: true });
    }

    if (b.action === "login") {
      if (!(await C.limite(`lg:ip:${ip}`, 30, 15 * 60e3)) || !(await C.limite(`lg:tel:${phone}`, 6, 15 * 60e3))) {
        return res.status(429).json({ error: "Muitas tentativas. Aguarde 15 minutos." });
      }
      const [[row]] = await db().query("SELECT id,senha FROM clientes WHERE telefone=?", [phone]);
      if (!row || !C.checkPin(pin, row.senha)) return res.status(401).json({ error: "WhatsApp ou senha incorretos." });
      C.login(res, row.id);
      return res.status(200).json({ ok: true });
    }
    res.status(400).json({ error: "Ação inválida." });
  } catch (err) {
    console.error("auth error:", err);
    res.status(500).json({ error: "Não foi possível acessar sua conta agora. Tente novamente." });
  }
};
