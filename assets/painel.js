(() => {
  const $ = (s) => document.querySelector(s), app = $("#app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR");
  const fone = (t) => (t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`);
  const dia = (d) => d.split("-").reverse().join("/");
  const hhmm = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const wa = (t) => `https://wa.me/55${t}`;
  let D = null, tab = "resumo", fSt = "", fQ = "";

  async function api(body) {
    const r = await fetch("/api/admin", { method: body ? "POST" : "GET", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    let d = {}; try { d = await r.json(); } catch (e) { /* */ }
    return { ok: r.ok, status: r.status, d };
  }
  function login(msg) {
    app.innerHTML = `<div class="login"><h1>Painel</h1><input type="password" id="pw" placeholder="Senha" autocomplete="current-password"><button class="p" id="go">Entrar</button><p class="err">${esc(msg || "")}</p></div>`;
    const go = async () => { const r = await api({ action: "login", password: $("#pw").value }); r.ok ? load() : login(r.d.error); };
    $("#go").onclick = go; $("#pw").onkeydown = (e) => e.key === "Enter" && go(); $("#pw").focus();
  }
  async function load() {
    const r = await api();
    if (r.status === 401) return login();
    if (!r.ok) { app.innerHTML = `<p class="err">${esc(r.d.error || "Erro")}</p>`; return; }
    D = r.d; draw();
  }
  const ranking = (title, map) => {
    const e = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6), max = (e[0] && e[0][1]) || 1;
    return `<div class="box"><h2>${title}</h2>${e.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${(v / max) * 60}%"></i>${v}</div>`).join("") || "<small>Sem dados</small>"}</div>`;
  };
  const acoes = (b) => {
    const B = (v, t, c) => `<button class="s ${c || ""}" data-a="st" data-id="${b.id}" data-v="${v}">${t}</button>`;
    if (b.status === "pendente") return B("confirmado", "Confirmar", "p") + B("cancelado", "Cancelar");
    if (b.status === "confirmado") return B("concluido", "Concluir", "p") + B("faltou", "Faltou") + B("cancelado", "Cancelar");
    if (["cancelado", "expirado", "faltou"].includes(b.status)) return B("confirmado", "Reativar");
    return "";
  };
  const linha = (b) => `<tr><td><b>${dia(b.data)}</b> ${b.hora}</td><td>${esc(b.nome)}<br><a href="${wa(b.telefone)}" target="_blank" rel="noopener">${fone(b.telefone)}</a></td><td>${esc(b.veiculo)}${b.extras.length ? "<br><small>+ " + esc(b.extras.join(", ")) + "</small>" : ""}</td><td>${R(b.total)}</td><td><span class="b ${b.status}">${b.status}</span>${b.status === "pendente" && b.expira_em ? `<br><small>expira ${hhmm(b.expira_em)}</small>` : ""}</td><td>${acoes(b)}</td></tr>`;

  function draw() {
    const hoje = D.hoje, mes = hoje.slice(0, 7), B = D.bookings;
    const ativos = B.filter((b) => ["pendente", "confirmado", "concluido"].includes(b.status));
    const soma = (l) => l.reduce((s, b) => s + b.total, 0);
    const d7 = new Date(hoje + "T12:00:00"); d7.setDate(d7.getDate() + 7); const lim7 = d7.toISOString().slice(0, 10);
    const d30 = new Date(hoje + "T12:00:00"); d30.setDate(d30.getDate() - 30); const lim30 = d30.toISOString().slice(0, 10);
    const pend = B.filter((b) => b.status === "pendente").reverse();
    const hojeL = ativos.filter((b) => b.data === hoje), prox = ativos.filter((b) => b.data >= hoje && b.data <= lim7 && b.status !== "concluido");
    const rec = ativos.filter((b) => b.data >= lim30);
    const veic = {}, ext = {}, hr = {};
    rec.forEach((b) => { veic[b.veiculo] = (veic[b.veiculo] || 0) + 1; hr[b.hora] = (hr[b.hora] || 0) + 1; b.extras.forEach((x) => { ext[x] = (ext[x] || 0) + 1; }); });
    const faltas30 = B.filter((b) => b.status === "faltou" && b.data >= lim30).length;
    const T = (id, t) => `<button class="${tab === id ? "on" : ""}" data-tab="${id}">${t}</button>`;
    let body = "";
    if (tab === "resumo") {
      body = `<div class="g"><div class="k"><b>${pend.length}</b><span>Aguardando confirmação</span></div><div class="k"><b>${hojeL.length}</b><span>Hoje · ${R(soma(hojeL))}</span></div><div class="k"><b>${R(soma(prox))}</b><span>Próximos 7 dias (${prox.length})</span></div><div class="k"><b>${R(soma(ativos.filter((b) => b.status === "concluido" && b.data.startsWith(mes))))}</b><span>Faturado no mês</span></div><div class="k"><b>${D.clientes.length}</b><span>Clientes · ${D.clientes.filter((c) => c.bloqueado).length} bloqueados</span></div><div class="k"><b>${faltas30}</b><span>Faltas (30 dias)</span></div></div>
        <div class="box"><h2>Pendentes — confira se a mensagem veio do mesmo WhatsApp</h2><table>${pend.map(linha).join("") || "<tr><td>Nada pendente 🎉</td></tr>"}</table></div>
        <div class="box"><h2>Hoje e próximos dias</h2><table>${B.filter((b) => b.data >= hoje && ["pendente", "confirmado"].includes(b.status)).reverse().map(linha).join("") || "<tr><td>Sem agendamentos</td></tr>"}</table></div>
        <div class="g">${ranking("Veículos (30 dias)", veic)}${ranking("Adicionais (30 dias)", ext)}${ranking("Horários mais pedidos", hr)}</div>`;
    } else if (tab === "agenda") {
      const l = B.filter((b) => (!fSt || b.status === fSt) && (!fQ || (b.nome + b.telefone).toLowerCase().includes(fQ.toLowerCase())));
      body = `<div class="tools"><select id="fs"><option value="">Todos os status</option>${["pendente", "confirmado", "concluido", "faltou", "cancelado", "expirado"].map((s) => `<option ${fSt === s ? "selected" : ""}>${s}</option>`).join("")}</select><input id="fq" placeholder="Buscar nome ou número" value="${esc(fQ)}"></div><div class="box"><table><tr><th>Quando</th><th>Cliente</th><th>Serviço</th><th>Total</th><th>Status</th><th></th></tr>${l.map(linha).join("") || "<tr><td>Nada encontrado</td></tr>"}</table></div>`;
    } else {
      const l = D.clientes.filter((c) => !fQ || (c.nome + c.telefone).toLowerCase().includes(fQ.toLowerCase()));
      body = `<div class="tools"><input id="fq" placeholder="Buscar nome ou número" value="${esc(fQ)}"></div><div class="box"><table><tr><th>Cliente</th><th>Agend.</th><th>Feitos</th><th>Faltas</th><th>Strikes</th><th>Gasto</th><th></th></tr>${l.map((c) => `<tr><td>${esc(c.nome)} ${c.bloqueado ? '<span class="bad">· bloqueado</span>' : ""}<br><a href="${wa(c.telefone)}" target="_blank" rel="noopener">${fone(c.telefone)}</a></td><td>${c.total}</td><td>${c.feitos}</td><td>${c.faltas}</td><td>${c.strikes}</td><td>${R(c.gasto)}</td><td><button class="s" data-a="cl" data-id="${c.id}" data-op="${c.bloqueado ? "unblock" : "block"}">${c.bloqueado ? "Desbloquear" : "Bloquear"}</button><button class="s" data-a="cl" data-id="${c.id}" data-op="pin">Nova senha</button></td></tr>`).join("")}</table></div>`;
    }
    app.innerHTML = `<header><h1>🔧 Painel LZ Lava-Jato</h1><span class="sp"></span>${T("resumo", "Resumo")}${T("agenda", "Agendamentos")}${T("clientes", "Clientes")}<button id="rf">↻</button><button id="out">Sair</button></header>${body}`;
    app.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; fQ = ""; fSt = ""; draw(); }));
    $("#rf").onclick = load; $("#out").onclick = async () => { await api({ action: "logout" }); login(); };
    const fs = $("#fs"), fq = $("#fq");
    if (fs) fs.onchange = () => { fSt = fs.value; draw(); };
    if (fq) fq.onchange = () => { fQ = fq.value; draw(); };
    app.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
      let body;
      if (b.dataset.a === "st") { if (b.dataset.v === "cancelado" && !confirm("Cancelar este agendamento?")) return; body = { action: "status", id: b.dataset.id, status: b.dataset.v }; }
      else { body = { action: "cliente", id: b.dataset.id, op: b.dataset.op }; if (body.op === "pin") { body.pin = prompt("Nova senha para o cliente (4 a 8 números):"); if (!body.pin) return; } }
      const r = await api(body); if (!r.ok) alert(r.d.error || "Erro"); load();
    }));
  }
  load();
})();
