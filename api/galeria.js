// Quadro de serviços: GET público (lista e imagem); POST/DELETE só com sessão do painel.
const { db } = require("./_db");
const C = require("./_core");
const L = require("./_lib");

const MAX_BYTES = 1500000;
const TIPOS = { "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/webp": [0x52, 0x49, 0x46, 0x46] };

module.exports = async function handler(req, res) {
  try {
    await C.init();
    const q = req.query || {};
    if (req.method === "GET" && q.img) {
      const [[r]] = await db().query("SELECT mime,img FROM galeria WHERE id=?", [parseInt(q.img, 10) || 0]);
      if (!r) return res.status(404).end();
      res.setHeader("Content-Type", r.mime);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(r.img);
    }
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
      const [rows] = await db().query("SELECT id,legenda,data FROM galeria ORDER BY data DESC,id DESC LIMIT 60");
      return res.status(200).json({ fotos: rows });
    }
    res.setHeader("Cache-Control", "no-store");
    if (!C.isAdmin(req)) return res.status(401).json({ error: "Não autorizado." });
    if (req.method === "DELETE") {
      const [r] = await db().query("DELETE FROM galeria WHERE id=?", [parseInt(q.id, 10) || 0]);
      return r.affectedRows ? res.status(200).json({ ok: true }) : res.status(404).json({ error: "Essa foto já tinha sido apagada." });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
    const b = L.readBody(req);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.img || ""));
    if (!m) return res.status(400).json({ error: "Envie uma imagem JPG, PNG ou WebP." });
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: "Imagem muito grande (máx. 1,5 MB)." });
    if (!TIPOS[m[1]].every((byte, i) => buf[i] === byte)) return res.status(400).json({ error: "Arquivo não é uma imagem válida." });
    if (!L.parseISODate(b.data)) return res.status(400).json({ error: "Data inválida." });
    const legenda = String(b.legenda || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").trim().slice(0, 80);
    await db().query("INSERT INTO galeria(data,legenda,mime,img,criado_em) VALUES(?,?,?,?,?)", [b.data, legenda, m[1], buf, Date.now()]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("galeria error:", err);
    res.status(500).json({ error: "Erro ao acessar o quadro de fotos." });
  }
};
