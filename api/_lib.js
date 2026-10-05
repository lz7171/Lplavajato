// Configuração e utilitários compartilhados pelas funções em /api.
// Arquivos que começam com "_" NÃO viram rota no Vercel.
// Para mudar expediente, preços ou adicionais, edite apenas este arquivo
// (e mantenha os preços do index.html iguais aos daqui).

const TIME_ZONE = "America/Sao_Paulo";

const OPEN_DAYS = [0, 4, 5, 6]; // Dom, Qui, Sex, Sáb
const OPEN_TIME = "08:00";
const CLOSE_TIME = "18:00"; // fim do último atendimento (16:00 + 2h)
const SLOT_MINUTES = 120;
const LEAD_MIN = 90; // antecedência mínima para agendar (minutos) // um atendimento a cada 2 horas: 08, 10, 12, 14, 16

const VEHICLES = { Moto: 30, Carro: 60 };
const EXTRAS = { Pretinho: 5, RestauraX: 10, Blend: 15, "Descontaminação": 20, Vidros: 15 };

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function buildSlots() {
  const start = timeToMinutes(OPEN_TIME);
  const end = timeToMinutes(CLOSE_TIME);
  const slots = [];
  for (let m = start; m < end; m += SLOT_MINUTES) {
    slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return slots;
}

const SLOTS = buildSlots();

function isValidSlot(time) {
  return typeof time === "string" && SLOTS.includes(time);
}

// Data/hora atual no fuso de Brasília (independe do fuso do servidor).
function nowInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function parseISODate(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

function toISO(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(isoDate, days) {
  const d = parseISODate(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

// Data real, em dia de funcionamento.
function isOpenDay(str) {
  const d = parseISODate(str);
  return !!d && OPEN_DAYS.includes(d.getUTCDay());
}

// Semana ativa (segunda a domingo, em Brasília). No domingo, depois do último
// horário, a agenda passa para a semana seguinte.
function activeWeekStart(now = nowInSaoPaulo()) {
  const dow = (parseISODate(now.date).getUTCDay() + 6) % 7; // segunda = 0
  let monday = addDays(now.date, -dow);
  if (dow === 6 && now.minutes >= timeToMinutes(SLOTS[SLOTS.length - 1])) monday = addDays(monday, 7);
  return monday;
}

// Os 4 dias de funcionamento (qui a dom) da semana ativa.
function weekDates(now = nowInSaoPaulo()) {
  const start = activeWeekStart(now);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    if (isOpenDay(day)) out.push(day);
  }
  return out;
}

// Desses, os que ainda não passaram.
function bookableDates(now = nowInSaoPaulo()) {
  return weekDates(now).filter((day) => day >= now.date);
}

function isBookableDate(str, now = nowInSaoPaulo()) {
  return bookableDates(now).includes(str);
}

function isPastSlot(date, time, now = nowInSaoPaulo()) {
  return date === now.date && timeToMinutes(time) <= now.minutes + LEAD_MIN;
}

function pastSlotsFor(date, now = nowInSaoPaulo()) {
  return SLOTS.filter((t) => isPastSlot(date, t, now));
}

// ---- validação de campos do cliente ----

function cleanName(value) {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  return name.length >= 2 && name.length <= 60 ? name : null;
}

// Aceita (22) 99864-1962, 22998641962, +55 22 99864-1962... Devolve só os dígitos (DDD + número).
function cleanPhone(value) {
  if (typeof value !== "string") return null;
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (!/^[1-9][1-9]/.test(digits)) return null; // DDD válido
  if (digits.length === 11 && digits[2] !== "9") return null; // celular começa com 9
  return digits;
}

function cleanVehicle(value) {
  return typeof value === "string" && has(VEHICLES, value) ? value : null;
}

function cleanExtras(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > Object.keys(EXTRAS).length) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== "string" || !has(EXTRAS, item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function computeTotal(vehicle, extras) {
  return VEHICLES[vehicle] + extras.reduce((sum, name) => sum + EXTRAS[name], 0);
}

// ---- infraestrutura ----

function clientIp(req) {
  const fwd = req.headers && req.headers["x-forwarded-for"];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd || (req.headers && req.headers["x-real-ip"]) || "").split(",")[0].trim();
  return raw.replace(/[^0-9a-fA-F:.]/g, "").slice(0, 45) || "unknown";
}

// Contador com janela fixa. Retorna true se ainda está dentro do limite.
async function withinLimit(kv, key, limit, windowSeconds) {
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, windowSeconds);
  } else if (count > limit) {
    // garante que a chave nunca fique sem expiração (ex.: falha entre incr e expire)
    const ttl = await kv.ttl(key);
    if (ttl < 0) await kv.expire(key, windowSeconds);
  }
  return count <= limit;
}

// Segundos até 3 dias depois da data do agendamento (limpeza automática no KV).
function ttlForDate(date) {
  const day = parseISODate(date);
  const seconds = Math.floor((day.getTime() - Date.now()) / 1000) + 3 * 24 * 60 * 60;
  return Math.max(24 * 60 * 60, seconds);
}

function readBody(req) {
  const body = req.body;
  if (body && typeof body === "object") return body;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  return {};
}

module.exports = {
  OPEN_DAYS, OPEN_TIME, CLOSE_TIME, SLOT_MINUTES, bookableDates, weekDates, activeWeekStart, VEHICLES, EXTRAS, SLOTS,
  isValidSlot, nowInSaoPaulo, parseISODate, toISO, addDays, isOpenDay, isBookableDate,
  isPastSlot, pastSlotsFor, cleanName, cleanPhone, cleanVehicle, cleanExtras, computeTotal,
  clientIp, withinLimit, ttlForDate, readBody, timeToMinutes,
};
