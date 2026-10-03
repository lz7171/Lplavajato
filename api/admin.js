const crypto = require("crypto");
const { kv } = require("@vercel/kv");
const L = require("./_lib");

// Uso (Termux):
//   curl -H "Authorization: Bearer $TOKEN" "https://SEU-SITE/api/admin?date=2026-10-10"
//   curl -H "Authorization: Bearer $TOKEN" "https://SEU-SITE/api/admin?days=14&format=text"
//   curl -X DELETE -H "Authorization: Bearer $TOKEN" "https://SEU-SITE/api/admin?date=2026-10-10&time=09:00"
// Requer a variável de ambiente ADMIN_TOKEN no Vercel.

function digest(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

function tokenMatches(received, expected) {
  return crypto.timingSafeEqual(digest(received), digest(expected));
}

function parseDetail(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch (e) { return null; }
  }
  return typeof value === "object" ? value : null;
}

async function listDate(date) {
  const times = ((await kv.smembers(`booked:${date}`)) || []).filter(L.isValidSlot).sort();
  if (!times.length) return [];
  const details = await kv.mget(...times.map((t) => `detail:${date}:${t}`));
  return times.map((time, i) => {
    const d = parseDetail(details && details[i]);
    return d
      ? { date, time, name: d.name, phone: d.phone, vehicle: d.vehicle, extras: d.extras || [], total: d.total, createdAt: d.createdAt }
      : { date, time, name: null, phone: null, vehicle: null, extras: [], total: null, note: "sem detalhes" };
  });
}

function asText(items) {
  if (!items.length) return "Nenhum agendamento.\n";
  return items
    .map((b) => {
      const [y, m, d] = b.date.split("-");
      const extras = b.extras.length ? ` + ${b.extras.join(", ")}` : "";
      const total = b.total == null ? "" : ` | R$ ${b.total}`;
      return `${d}/${m}/${y} ${b.time} | ${b.name || "(sem nome)"} | ${b.phone || "-"} | ${b.vehicle || "-"}${extras}${total}`;
    })
    .join("\n") + "\n";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 16) {
    res.status(503).json({ error: "Painel desativado: defina ADMIN_TOKEN (mín. 16 caracteres) no Vercel." });
    return;
  }

  try {
    const ip = L.clientIp(req);
    if (!(await L.withinLimit(kv, `rl:admin:${ip}`, 20, 10 * 60))) {
      res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
      return;
    }

    const auth = String(req.headers.authorization || "");
    const received = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!received || !tokenMatches(received, expected)) {
      res.status(401).json({ error: "Não autorizado." });
      return;
    }

    const query = req.query || {};
    const date = query.date;

    if (req.method === "GET") {
      let items = [];
      if (date !== undefined) {
        if (!L.parseISODate(date)) {
          res.status(400).json({ error: "Use date=AAAA-MM-DD." });
          return;
        }
        items = await listDate(date);
      } else {
        const days = Math.min(Math.max(parseInt(query.days, 10) || 7, 1), 31);
        const today = L.nowInSaoPaulo().date;
        const dates = [];
        for (let i = 0; i < days; i++) {
          const d = L.addDays(today, i);
          if (L.isOpenDay(d)) dates.push(d);
        }
        items = (await Promise.all(dates.map(listDate))).flat();
      }
      if (query.format === "text") {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.status(200).send(asText(items));
      } else {
        res.status(200).json({ count: items.length, bookings: items });
      }
      return;
    }

    if (req.method === "DELETE") {
      const time = query.time;
      if (!L.parseISODate(date) || !L.isValidSlot(time)) {
        res.status(400).json({ error: "Use date=AAAA-MM-DD&time=HH:MM." });
        return;
      }
      const removed = await kv.srem(`booked:${date}`, time);
      await kv.del(`detail:${date}:${time}`);
      res.status(200).json({ ok: true, date, time, removed: removed > 0 });
      return;
    }

    res.setHeader("Allow", "GET, DELETE");
    res.status(405).json({ error: "Método não permitido." });
  } catch (err) {
    console.error("admin error:", err);
    res.status(500).json({ error: "Erro ao acessar o banco de dados." });
  }
};
