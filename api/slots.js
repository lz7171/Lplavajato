const { kv } = require("@vercel/kv");
const { buildSlots, isValidDate } = require("./_shared");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query && req.query.date) || "";

  if (!isValidDate(date)) {
    res.status(400).json({ error: "Data inválida ou fora dos dias de funcionamento." });
    return;
  }

  try {
    const booked = await kv.smembers(`booked:${date}`);
    res.status(200).json({
      date,
      allSlots: buildSlots(),
      bookedSlots: booked || [],
    });
  } catch (err) {
    res.status(500).json({
      error:
        "Não foi possível consultar os horários. Verifique se o Vercel KV foi conectado a este projeto.",
    });
  }
};
