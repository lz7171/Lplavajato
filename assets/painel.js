(() => {
  const $ = (s) => document.querySelector(s), app = $("#app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR");
  const fone = (t) => { t = String(t || ""); return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t; };
  const dia = (d) => d.split("-").reverse().join("/");
  const hhmm = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const wa = (t) => `https://wa.me/55${t}`;
  let D = null, tab = "hoje", fSt = "", fQ = "";

  // Nunca lança exceção: sem internet ou resposta estranha vira { ok:false, d:{ error } }
  async function api(body, url, method) {
    let r;
    try {
      r = await fetch(url || "/api/admin", { method: method || (body ? "POST" : "GET"), credentials: "same-origin", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      return { ok: false, status: 0, d: { error: "Sem conexão com a internet. Confira o sinal e tente de novo." } };
    }
    let d = {}; try { d = await r.json(); } catch (e) { /* sem JSON */ }
    if (!r.ok && !d.error) d.error = r.status === 413 ? "Arquivo grande demais." : r.status >= 500 ? `O servidor falhou (HTTP ${r.status}). Tente de novo.` : `Erro HTTP ${r.status}.`;
    return { ok: r.ok, status: r.status, d };
  }
  // executa uma ação do painel: trava os botões enquanto espera, mostra o erro e recarrega
  let ocupado = false;
  async function acao(body, url, method) {
    if (ocupado) return null;
    ocupado = true; app.classList.add("busy");
    try {
      const r = await api(body, url, method);
      if (r.status === 401 && !(body && body.action === "login")) { login("Sua sessão expirou. Entre de novo."); return r; }
      if (!r.ok) alert(r.d.error);
      await load();
      return r;
    } finally { ocupado = false; app.classList.remove("busy"); }
  }
  function login(msg) {
    D = null;
    app.innerHTML = `<div class="login"><h1>Painel</h1><input type="password" id="pw" placeholder="Senha" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="p" id="go">Entrar</button><p class="err">${esc(msg || "")}</p></div>`;
    const go = async () => {
      const bt = $("#go"); if (bt.disabled) return;
      bt.disabled = true; bt.textContent = "Entrando…";
      const r = await api({ action: "login", password: $("#pw").value });
      if (r.ok) return load();
      login(r.d.error);
    };
    $("#go").onclick = go; $("#pw").onkeydown = (e) => { if (e.key === "Enter") go(); }; $("#pw").focus();
  }
  function falha(r) {
    const code = r.d.code ? ` <small>(${esc(r.d.code)})</small>` : "";
    app.innerHTML = `<div class="login"><h1>Painel</h1><p class="err">${esc(r.d.error || "Erro")}${code}</p>${r.d.dica ? `<p>${esc(r.d.dica)}</p>` : ""}<button class="p" id="again">Tentar de novo</button> <button id="out">Sair</button></div>`;
    $("#again").onclick = () => { $("#again").disabled = true; load(); };
    $("#out").onclick = async () => { await api({ action: "logout" }); login(); };
  }
  async function load() {
    const r = await api();
    if (r.status === 401) return login(D ? "Sua sessão expirou. Entre de novo." : "");
    if (!r.ok) return falha(r);
    const fotos = await api(null, "/api/galeria?t=" + Date.now());
    D = r.d;
    D.fotos = (fotos.ok && fotos.d.fotos) || [];
    D.fotosErro = fotos.ok ? "" : fotos.d.error;
    draw();
  }
  const ranking = (title, map) => {
    const e = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6), max = (e[0] && e[0][1]) || 1;
    return `<div class="box"><h2>${title}</h2>${e.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${(v / max) * 60}%"></i>${v}</div>`).join("") || "<small>Sem dados</small>"}</div>`;
  };
  const acoes = (b) => {
    const B = (v, t, c) => `<button class="s ${c || ""}" data-a="st" data-id="${b.id}" data-v="${v}">${t}</button>`;
    if (b.status === "pendente") return B("confirmado", "Confirmar", "p") + B("cancelado", "Cancelar");
    const W = `<button class="s" data-a="wa" data-id="${b.id}">WhatsApp</button>`;
    if (b.status === "confirmado") return B("concluido", "Concluir", "p") + B("faltou", "Faltou") + B("cancelado", "Cancelar") + W;
    if (b.status === "concluido") return W;
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
      body = `<div class="tools"><select id="fs"><option value="">Todos os status</option>${["pendente", "confirmado", "concluido", "faltou", "cancelado", "expirado"].map((s) => `<option ${fSt === s ? "selected" : ""}>${s}</option>`).join("")}</select><input id="fq" placeholder="Buscar nome ou número" value="${esc(fQ)}"><button id="csv">Exportar CSV</button></div><div class="box"><table><tr><th>Quando</th><th>Cliente</th><th>Serviço</th><th>Total</th><th>Status</th><th></th></tr>${l.map(linha).join("") || "<tr><td>Nada encontrado</td></tr>"}</table></div>`;
    } else if (tab === "hoje") {
      const doDia = B.filter((b) => b.data === hoje && ["pendente", "confirmado", "concluido"].includes(b.status)), blq = D.bloqueios.filter((x) => x.data === hoje);
      const linhas = D.slots.map((h) => { const b = doDia.find((x) => x.hora === h), k = blq.find((x) => x.hora === h);
        return `<tr><td><b>${h}</b></td><td>${b ? `${esc(b.nome)}<br><small>${esc(b.veiculo)}${b.extras.length ? " + " + esc(b.extras.join(", ")) : ""}</small>` : k ? "🔒 Bloqueado" : "<small>Livre</small>"}</td><td>${b ? R(b.total) : ""}</td><td>${b ? `<span class="b ${b.status}">${b.status}</span>` : ""}</td><td>${b ? acoes(b) : k ? `<button class="s" data-lib="${k.id}">Liberar</button>` : `<button class="s" data-novo="${h}">+ Agendar</button>`}</td></tr>`; }).join("");
      const dias = [...Array(14).keys()].map((i) => { const d = new Date(hoje + "T12:00:00"); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); }).reverse();
      const fat = dias.map((d) => [d, B.filter((b) => b.data === d && b.status === "concluido").reduce((s, b) => s + b.total, 0)]), mx = Math.max(1, ...fat.map((x) => x[1]));
      const sv = D.servicos;
      body = `<div class="g"><div class="k"><b>${doDia.length}/${D.slots.length}</b><span>Horários ocupados hoje</span></div><div class="k"><b>${R(soma(doDia.filter((b) => b.status === "concluido")))}</b><span>Faturado hoje</span></div><div class="k"><b>${pend.length}</b><span>Aguardando confirmação</span></div></div>
        <div class="box"><h2>Agenda de hoje · ${dia(hoje)}</h2><table>${linhas}</table></div>
        <div class="box"><h2>Novo agendamento manual (telefone / balcão)</h2><div class="tools"><input id="mn" placeholder="Nome" maxlength="60"><input id="mt" placeholder="WhatsApp com DDD" inputmode="tel"><input type="date" id="md" value="${hoje}"><select id="mh">${D.slots.map((x) => `<option>${x}</option>`).join("")}</select><select id="mv">${sv.veiculos.map((x) => `<option>${x}</option>`).join("")}</select></div><div class="tools">${sv.extras.map((x) => `<label><input type="checkbox" class="mx" value="${esc(x)}"> ${esc(x)}</label>`).join("")}</div><button class="p" id="mb">Agendar (já confirmado)</button> <small>Se o cliente ainda não tem conta, ela é criada; use "Nova senha" em Clientes para ele entrar no site.</small></div>
        <div class="box"><h2>Faturamento — últimos 14 dias (concluídos)</h2>${fat.map(([d, v]) => `<div class="bar"><span>${dia(d).slice(0, 5)}</span><i style="width:${(v / mx) * 60}%"></i>${v ? R(v) : ""}</div>`).join("")}</div>`;
    } else if (tab === "quadro") {
      const F = D.fotos || [];
      body = `<div class="box"><h2>Novo serviço no quadro</h2><div class="tools"><input type="file" id="ff" accept="image/*" multiple><input type="date" id="fd" value="${hoje}"><input id="fl" maxlength="80" placeholder="Legenda (ex.: Moto + Pretinho)"><button class="p" id="up">Enviar fotos</button></div><small>As fotos são reduzidas automaticamente e aparecem no site, em "Quadro de serviços", agrupadas por dia.</small></div>${D.fotosErro ? `<p class="err">Não consegui carregar as fotos: ${esc(D.fotosErro)}</p>` : ""}<div class="box"><h2>No ar (${F.length})</h2><div class="thumbs">${F.map((f) => `<figure><img src="/api/galeria?img=${f.id}" alt=""><figcaption>${dia(f.data)}${f.legenda ? " · " + esc(f.legenda) : ""}</figcaption><button class="s" data-del="${f.id}">Apagar</button></figure>`).join("") || "<small>Nenhuma foto ainda</small>"}</div></div>`;
    } else if (tab === "folgas") {
      body = `<div class="box"><h2>Bloquear horários (folga, chuva, compromisso)</h2><div class="tools"><input type="date" id="bd" value="${hoje}"><select id="bh"><option value="todos">Dia todo</option>${D.slots.map((x) => `<option>${x}</option>`).join("")}</select><button class="p" id="bk">Bloquear</button></div><small>Horários já reservados por clientes não são alterados.</small></div><div class="box"><h2>Bloqueios ativos</h2><table>${D.bloqueios.map((x) => `<tr><td>${dia(x.data)} ${x.hora}</td><td><button class="s" data-lib="${x.id}">Liberar</button></td></tr>`).join("") || "<tr><td>Nenhum</td></tr>"}</table></div>`;
    } else {
      const l = D.clientes.filter((c) => !fQ || (c.nome + c.telefone).toLowerCase().includes(fQ.toLowerCase()));
      body = `<div class="tools"><input id="fq" placeholder="Buscar nome ou número" value="${esc(fQ)}"></div><div class="box"><table><tr><th>Cliente</th><th>Agend.</th><th>Feitos</th><th>Faltas</th><th>Strikes</th><th>Gasto</th><th></th></tr>${l.map((c) => `<tr><td>${esc(c.nome)} ${c.bloqueado ? '<span class="bad">· bloqueado</span>' : ""}<br><a href="${wa(c.telefone)}" target="_blank" rel="noopener">${fone(c.telefone)}</a></td><td>${c.total}</td><td>${c.feitos}</td><td>${c.faltas}</td><td>${c.strikes}</td><td>${R(c.gasto)}</td><td><button class="s" data-a="cl" data-id="${c.id}" data-op="${c.bloqueado ? "unblock" : "block"}">${c.bloqueado ? "Desbloquear" : "Bloquear"}</button><button class="s" data-a="cl" data-id="${c.id}" data-op="pin">Nova senha</button></td></tr>`).join("") || "<tr><td>Nenhum cliente encontrado</td></tr>"}</table></div>`;
    }
    app.innerHTML = `<header><h1>🔧 Painel LZ Lava-Jato</h1><span class="sp"></span>${T("hoje", "Hoje")}${T("resumo", "Resumo")}${T("agenda", "Agendamentos")}${T("clientes", "Clientes")}${T("quadro", "Quadro")}${T("folgas", "Folgas")}<button id="rf">↻</button><button id="out">Sair</button></header>${body}`;
    app.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; fQ = ""; fSt = ""; draw(); }));
    $("#rf").onclick = async () => { const bt = $("#rf"); bt.disabled = true; await load(); };
    $("#out").onclick = async () => { await api({ action: "logout" }); login(); };
    const fs = $("#fs"), fq = $("#fq");
    if (fs) fs.onchange = () => { fSt = fs.value; draw(); };
    if (fq) fq.onchange = () => { fQ = fq.value; draw(); };
    app.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
      let body;
      if (b.dataset.a === "wa") return avisar(b.dataset.id);
      if (b.dataset.a === "st") {
        if (b.dataset.v === "cancelado" && !confirm("Cancelar este agendamento?")) return;
        if (b.dataset.v === "faltou" && !confirm("Marcar falta? O cliente ganha 1 strike.")) return;
        body = { action: "status", id: b.dataset.id, status: b.dataset.v };
      }
      else {
        body = { action: "cliente", id: b.dataset.id, op: b.dataset.op };
        if (body.op === "block" && !confirm("Bloquear este cliente de agendar pelo site?")) return;
        if (body.op === "pin") { body.pin = (prompt("Nova senha para o cliente (4 a 8 números):") || "").trim(); if (!body.pin) return; if (!/^\d{4,8}$/.test(body.pin)) return alert("A senha precisa ter de 4 a 8 números."); }
      }
      const r = await acao(body);
      if (r && r.ok && body.op === "pin") alert(`Senha alterada. Envie ao cliente: ${body.pin}`);
    }));
    extras();
  }
  function avisar(id) {
    const b = D.bookings.find((x) => String(x.id) === String(id)); if (!b) return;
    const msg = b.status === "concluido" ? `Olá, ${b.nome}! Obrigado por escolher a LZ Lava-Jato 🚗✨ Qualquer coisa é só chamar!` : `Olá, ${b.nome}! Lembrete do seu horário na LZ Lava-Jato: ${dia(b.data)} às ${b.hora}. Te esperamos!`;
    window.open(`${wa(b.telefone)}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }
  // reduz a foto no navegador (máx. 1280 px, JPEG) antes de enviar
  const comprimir = (file) => new Promise((ok, no) => {
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.8));
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });
  function extras() {
    const up = $("#up");
    if (up) up.onclick = async () => {
      const files = [...$("#ff").files]; if (!files.length) return alert("Escolha ao menos uma foto.");
      if (!$("#fd").value) return alert("Escolha a data das fotos.");
      up.disabled = true;
      for (let i = 0; i < files.length; i++) {
        up.textContent = `Enviando ${i + 1}/${files.length}…`;
        let img;
        try { img = await comprimir(files[i]); } catch (e) { alert(`A foto ${i + 1} não pôde ser lida (formato não suportado). Tente outra.`); continue; }
        const r = await api({ img, data: $("#fd").value, legenda: $("#fl").value }, "/api/galeria");
        if (r.status === 401) return login("Sua sessão expirou. Entre de novo.");
        if (!r.ok) { alert(`Falha na foto ${i + 1}: ${r.d.error}`); break; }
      }
      load();
    };
    app.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (!confirm("Apagar esta foto do quadro?")) return; await acao(null, `/api/galeria?id=${encodeURIComponent(b.dataset.del)}`, "DELETE"); }));
    app.querySelectorAll("[data-novo]").forEach((b) => (b.onclick = () => { $("#mh").value = b.dataset.novo; $("#md").value = D.hoje; $("#mn").focus(); }));
    const mb = $("#mb");
    if (mb) mb.onclick = async () => {
      // guarda o que foi digitado: se der erro, o formulário volta preenchido
      const f = { nome: $("#mn").value, telefone: $("#mt").value, data: $("#md").value, hora: $("#mh").value, veiculo: $("#mv").value, extras: [...document.querySelectorAll(".mx:checked")].map((x) => x.value) };
      if (!f.nome.trim() || !f.telefone.trim()) return alert("Preencha nome e WhatsApp.");
      const r = await acao({ action: "manual", ...f });
      if (r && !r.ok && $("#mn")) { $("#mn").value = f.nome; $("#mt").value = f.telefone; $("#md").value = f.data; $("#mh").value = f.hora; $("#mv").value = f.veiculo; document.querySelectorAll(".mx").forEach((x) => { x.checked = f.extras.includes(x.value); }); }
    };
    const bk = $("#bk");
    if (bk) bk.onclick = async () => {
      if (!$("#bd").value) return alert("Escolha a data.");
      const r = await acao({ action: "bloquear", data: $("#bd").value, hora: $("#bh").value });
      if (r && r.ok && r.d.bloqueados === 0) alert("Nada foi bloqueado: esses horários já estão ocupados ou bloqueados.");
    };
    app.querySelectorAll("[data-lib]").forEach((b) => (b.onclick = () => acao({ action: "liberar", id: b.dataset.lib })));
    const csv = $("#csv");
    if (csv) csv.onclick = () => {
      const f = (v) => { v = String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return `"${v.replace(/"/g, '""')}"`; };
      const rows = [["Data", "Hora", "Cliente", "WhatsApp", "Veículo", "Adicionais", "Total", "Status"], ...D.bookings.map((b) => [b.data, b.hora, b.nome, b.telefone, b.veiculo, b.extras.join("+"), b.total, b.status])];
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map((r) => r.map(f).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
      a.download = `agendamentos-${D.hoje}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    };
  }
  (async () => {
    const r = await api(null, "/api/admin?sessao=1");
    if (r.ok && r.d.logado) return load();
    if (r.ok) return login();
    falha(r);
  })();
})();
