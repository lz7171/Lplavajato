// Testes das funções de /api com um KV falso em memória.
// Rodar: npm test   (Node 18+; não precisa instalar nada)
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

function createFakeKv() {
  const sets = new Map();
  const values = new Map();
  const counters = new Map();
  const ttls = new Map();
  const kv = {
    fail: null, // nome do método que deve falhar (para testar rollback)
    _guard(name) { if (kv.fail === name) throw new Error(`falha simulada em ${name}`); },
    async sadd(key, member) { kv._guard("sadd"); const s = sets.get(key) || new Set(); sets.set(key, s); if (s.has(member)) return 0; s.add(member); return 1; },
    async smembers(key) { return [...(sets.get(key) || [])]; },
    async srem(key, member) { const s = sets.get(key); return s && s.delete(member) ? 1 : 0; },
    async set(key, value) { kv._guard("set"); values.set(key, JSON.parse(JSON.stringify(value))); return "OK"; },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async mget(...keys) { return keys.map((k) => (values.has(k) ? values.get(k) : null)); },
    async del(key) { return values.delete(key) ? 1 : 0; },
    async expire(key, s) { ttls.set(key, s); return 1; },
    async ttl(key) { return ttls.has(key) ? ttls.get(key) : -1; },
    async incr(key) { const n = (counters.get(key) || 0) + 1; counters.set(key, n); return n; },
    reset() { sets.clear(); values.clear(); counters.clear(); ttls.clear(); kv.fail = null; },
    _values: values, _ttls: ttls,
  };
  return kv;
}

const fakeKv = createFakeKv();
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "@vercel/kv") return { kv: fakeKv };
  return originalLoad.call(this, request, ...rest);
};

const L = require("../api/_lib");
const slots = require("../api/slots");
const book = require("../api/book");
const admin = require("../api/admin");

function call(handler, { method = "GET", query = {}, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200, headers: {}, body: undefined,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(c) { this.statusCode = c; return this; },
      json(o) { this.body = o; resolve(this); },
      send(t) { this.body = t; resolve(this); },
    };
    Promise.resolve(handler({ method, query, body, headers: { "x-forwarded-for": "1.2.3.4", ...headers } }, res)).catch(reject);
  });
}

// dia de funcionamento da semana ativa (o último, para sobrar horário livre)
function futureOpenDate() {
  const dates = L.bookableDates();
  return dates[dates.length - 1];
}

const valid = (date, extra = {}) => ({ date, time: "10:00", name: "João Silva", phone: "(22) 99864-1962", vehicle: "Moto", extras: ["Pretinho"], ...extra });

test.beforeEach(() => fakeKv.reset());

test("horários: de 2 em 2 horas, de 08:00 às 16:00", () => {
  assert.equal(L.SLOTS[0], "08:00");
  assert.deepEqual(L.SLOTS, ["08:00", "10:00", "12:00", "14:00", "16:00"]);
});

test("slots: data válida retorna horários e reservados", async () => {
  const date = futureOpenDate();
  await fakeKv.sadd(`booked:${date}`, "10:00");
  const r = await call(slots, { query: { date } });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body.bookedSlots, ["10:00"]);
  assert.equal(r.body.allSlots.length, 5);
});

test("slots: sem data devolve os dias da semana ativa", async () => {
  const r = await call(slots, { query: {} });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body.dates, L.bookableDates());
});

test("slots: rejeita data inválida, dia fechado, passada, distante e método errado", async () => {
  let d = L.addDays(L.nowInSaoPaulo().date, 1);
  while (L.isOpenDay(d)) d = L.addDays(d, 1); // dia fechado
  for (const date of ["abc", "2026-02-30", d, L.addDays(L.activeWeekStart(), 7 + 3), "2020-01-02", L.addDays(L.nowInSaoPaulo().date, 90)]) {
    const r = await call(slots, { query: { date } });
    assert.equal(r.statusCode, 400, `deveria rejeitar "${date}"`);
  }
  assert.equal((await call(slots, { method: "POST", query: {} })).statusCode, 405);
});

test("book: reserva com sucesso, calcula total no servidor e grava detalhes", async () => {
  const date = futureOpenDate();
  const r = await call(book, { method: "POST", body: valid(date, { extras: ["Pretinho", "Vidros"] }) });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.total, 30 + 5 + 15);
  const saved = await fakeKv.get(`detail:${date}:10:00`);
  assert.equal(saved.phone, "22998641962");
  assert.equal(saved.name, "João Silva");
  assert.ok(fakeKv._ttls.get(`booked:${date}`) >= 86400);
  assert.deepEqual(await fakeKv.smembers(`booked:${date}`), ["10:00"]);
});

test("book: segundo cliente no mesmo horário recebe 409", async () => {
  const date = futureOpenDate();
  assert.equal((await call(book, { method: "POST", body: valid(date) })).statusCode, 200);
  const r = await call(book, { method: "POST", body: valid(date, { phone: "22988887777" }) });
  assert.equal(r.statusCode, 409);
});

test("book: reservas simultâneas no mesmo horário -> só uma passa", async () => {
  const date = futureOpenDate();
  const results = await Promise.all(
    [0, 1, 2, 3].map((i) => call(book, { method: "POST", headers: { "x-forwarded-for": `9.9.9.${i}` }, body: valid(date, { phone: `2299000000${i}` }) }))
  );
  assert.equal(results.filter((r) => r.statusCode === 200).length, 1);
  assert.equal(results.filter((r) => r.statusCode === 409).length, 3);
});

test("book: validações de entrada", async () => {
  const date = futureOpenDate();
  const bad = [
    valid(date, { time: "18:30" }),
    valid(date, { time: "18:00" }),
    valid(date, { time: "08:30" }),
    valid(date, { time: "07:30" }),
    valid(date, { time: "9:00" }),
    valid(date, { name: "A" }),
    valid(date, { name: "x".repeat(61) }),
    valid(date, { name: 123 }),
    valid(date, { phone: "123" }),
    valid(date, { phone: "(22) 89864-1962" }),
    valid(date, { vehicle: "Caminhão" }),
    valid(date, { vehicle: "__proto__" }),
    valid(date, { extras: ["Nada"] }),
    valid(date, { extras: "Pretinho" }),
    valid(date, { extras: ["constructor"] }),
    valid("2020-01-02"),
    valid(L.addDays(date, 365)),
  ];
  for (const body of bad) {
    const r = await call(book, { method: "POST", body, headers: { "x-forwarded-for": String(Math.random()) } });
    assert.equal(r.statusCode, 400, JSON.stringify(body));
  }
  assert.equal((await call(book, { method: "GET" })).statusCode, 405);
  assert.equal((await call(book, { method: "POST", body: "lixo" })).statusCode, 400);
  assert.equal((await call(book, { method: "POST", body: JSON.stringify(valid(date)) })).statusCode, 200); // corpo em string JSON
});

test("book: horário que já passou hoje é rejeitado", async () => {
  const now = L.nowInSaoPaulo();
  if (!L.isOpenDay(now.date)) return; // hoje fechado: nada a testar
  const past = L.SLOTS.filter((t) => L.timeToMinutes(t) <= now.minutes);
  if (!past.length) return;
  const r = await call(book, { method: "POST", body: valid(now.date, { time: past[0] }) });
  assert.equal(r.statusCode, 400);
});

test("book: limite por IP devolve 429", async () => {
  const date = futureOpenDate();
  const statuses = [];
  for (let i = 0; i < 8; i++) {
    const r = await call(book, { method: "POST", body: valid(date, { phone: `229980000${String(i).padStart(2, "0")}` }) });
    statuses.push(r.statusCode);
  }
  assert.deepEqual(statuses, [200, 409, 409, 409, 409, 409, 429, 429]);
});

test("book: limite por telefone devolve 429", async () => {
  const date = futureOpenDate();
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const r = await call(book, { method: "POST", headers: { "x-forwarded-for": `8.8.8.${i}` }, body: valid(date) });
    statuses.push(r.statusCode);
  }
  assert.deepEqual(statuses, [200, 409, 409, 409, 429, 429]);
});

test("semana: só qui-dom da semana ativa; domingo à noite abre a próxima", () => {
  const w = (date, minutes) => L.bookableDates({ date, minutes });
  assert.deepEqual(w("2026-10-05", 600), ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]); // segunda
  assert.deepEqual(w("2026-10-10", 600), ["2026-10-10", "2026-10-11"]); // sábado
  assert.deepEqual(w("2026-10-11", 600), ["2026-10-11"]); // domingo cedo
  assert.deepEqual(w("2026-10-11", 17 * 60), ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]); // domingo depois do último horário
});

test("book: se gravar os detalhes falhar, o horário é liberado (rollback)", async () => {
  const date = futureOpenDate();
  fakeKv.fail = "set";
  const r = await call(book, { method: "POST", body: valid(date) });
  assert.equal(r.statusCode, 500);
  assert.deepEqual(await fakeKv.smembers(`booked:${date}`), []);
});

test("admin: sem ADMIN_TOKEN fica desativado (503)", async () => {
  delete process.env.ADMIN_TOKEN;
  assert.equal((await call(admin)).statusCode, 503);
});

test("admin: exige token correto, lista, formata texto e cancela", async () => {
  process.env.ADMIN_TOKEN = "token-de-teste-com-16+";
  const date = futureOpenDate();
  await call(book, { method: "POST", body: valid(date, { extras: ["Blend"] }) });

  assert.equal((await call(admin, { query: { date } })).statusCode, 401);
  assert.equal((await call(admin, { query: { date }, headers: { authorization: "Bearer errado" } })).statusCode, 401);

  const auth = { authorization: "Bearer token-de-teste-com-16+" };
  const list = await call(admin, { query: { date }, headers: auth });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.count, 1);
  assert.equal(list.body.bookings[0].name, "João Silva");
  assert.equal(list.body.bookings[0].total, 45);

  const text = await call(admin, { query: { date, format: "text" }, headers: auth });
  assert.match(text.body, /10:00 \| João Silva \| 22998641962 \| Moto \+ Blend \| R\$ 45/);

  const upcoming = await call(admin, { query: { days: "31" }, headers: auth });
  assert.equal(upcoming.statusCode, 200);
  assert.ok(upcoming.body.count >= 1);

  assert.equal((await call(admin, { method: "DELETE", query: { date, time: "99:99" }, headers: auth })).statusCode, 400);
  const del = await call(admin, { method: "DELETE", query: { date, time: "10:00" }, headers: auth });
  assert.equal(del.body.removed, true);
  assert.equal((await call(admin, { query: { date }, headers: auth })).body.count, 0);
  assert.deepEqual((await call(slots, { query: { date } })).body.bookedSlots, []);
  delete process.env.ADMIN_TOKEN;
});

test("admin: tentativas com token errado são limitadas", async () => {
  process.env.ADMIN_TOKEN = "token-de-teste-com-16+";
  const codes = [];
  for (let i = 0; i < 24; i++) codes.push((await call(admin, { query: { days: "1" }, headers: { authorization: "Bearer x" } })).statusCode);
  assert.equal(codes.filter((c) => c === 429).length, 4);
  delete process.env.ADMIN_TOKEN;
});
