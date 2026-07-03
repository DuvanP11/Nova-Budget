/* ===== Nova Budget — UI: vistas, formularios, hojas ===== */
const UI = (() => {
  const $ = s => document.querySelector(s);
  const money = v => Store.money(v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let editing = null;

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 5000);
  }

  /* ---------- sheets / modales ---------- */
  function openSheet(html) {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
    root.hidden = false;
    root.onclick = e => { if (e.target === root) closeSheet(); };
  }
  function closeSheet() { const r = $('#modalRoot'); r.hidden = true; r.innerHTML = ''; editing = null; }

  /* ---------- icono de un gasto fijo ---------- */
  const fEmoji = f => f.emoji || Store.fixedCat(f.category).emoji;

  /* =========================================================
     VISTA: INICIO (dashboard)
     ========================================================= */
  function inicio() {
    const s = Store.summary();
    const h = Store.health();
    const up = Store.upcoming().filter(u => !u.paid).slice(0, 4);
    const breakdown = Store.spendBreakdown();
    const alerts = Store.alerts();

    const availClass = s.available >= 0 ? '' : 'neg';
    const savePct = s.savingsTarget > 0 ? Math.min(100, Math.round(s.saved / s.savingsTarget * 100)) : 0;

    return `
    ${alerts.length ? `<div class="card" style="border-color:var(--accent);background:var(--accent-t);margin-bottom:14px" data-action="open-alerts">
        <div class="spread"><div class="card-title">🔔 Tienes ${alerts.length} alerta${alerts.length > 1 ? 's' : ''}</div><span class="linkbtn">Ver</span></div>
      </div>` : ''}

    <div class="hero">
      <div class="label">Disponible este mes (tras ahorro)</div>
      <div class="amount">${money(s.available)}</div>
      <div class="sub">Ganas ${money(s.income)} · Gastas ${money(s.spent)} · Ahorro meta ${money(s.savingsTarget)}</div>
      <div class="barwrap"><div class="barfill" style="width:${s.income > 0 ? Math.min(100, s.spent / s.income * 100) : 0}%"></div></div>
    </div>

    <div class="grid2 mt16">
      <div class="tile"><div class="k">Ingresos</div><div class="v pos">${money(s.income)}</div></div>
      <div class="tile"><div class="k">Gastos</div><div class="v neg">${money(s.spent)}</div></div>
      <div class="tile"><div class="k">Ahorro apartado</div><div class="v">${money(s.saved)}</div></div>
      <div class="tile"><div class="k">Libre real</div><div class="v ${availClass}">${money(s.freeNoSave)}</div></div>
    </div>

    ${(() => { const ins = Store.insights(); return ins.length ? `<div class="section-title">Resumen inteligente</div>
      <div class="list">${ins.map(i => `<div class="li"><div class="ic">${i.e}</div>
        <div class="mid"><div class="s" style="white-space:normal;color:var(--ink-dim);font-size:13.5px;line-height:1.45">${esc(i.t)}</div></div></div>`).join('')}</div>` : ''; })()}

    <div class="section-title">Salud financiera</div>
    <div class="card health">
      <div class="ring">${Charts.ring(h.score, { color: h.color, size: 92 })}</div>
      <div class="desc">
        <h3 style="color:${h.color}">${h.label}</h3>
        <p>${healthTip(h.score, s)}</p>
      </div>
    </div>

    <div class="section-title">Meta de ahorro del mes</div>
    <div class="card">
      <div class="spread"><div><div class="small muted">Apartado</div><div class="bignum">${money(s.saved)}</div></div>
        <div class="center"><div class="small muted">Meta</div><div style="font-weight:800">${money(s.savingsTarget)}</div></div></div>
      <div class="progresswrap"><div class="progressfill" style="width:${savePct}%;background:${savePct >= 100 ? 'var(--green)' : 'var(--accent)'}"></div></div>
      <div class="spread mt8">
        <span class="small muted">${savePct}% de tu meta</span>
        <button class="btn soft sm" data-action="add-saving">＋ Apartar ahorro</button>
      </div>
    </div>

    <div class="section-title">Próximos pagos</div>
    ${up.length ? `<div class="list">${up.map(pagoLI).join('')}</div>
      <button class="btn ghost block mt16" data-route="gastos">Ver todos los gastos fijos</button>`
      : emptyState('🗓️', 'Sin pagos próximos', 'Agrega tus gastos fijos (arriendo, servicios) para programar tus pagos.', 'Agregar gasto fijo', 'add-fixed')}

    ${breakdown.length ? `<div class="section-title">¿En qué se va la plata?</div>
      <div class="card" data-route="stats" style="cursor:pointer">
        <div class="row" style="align-items:center">
          <div style="flex:none">${Charts.donut(breakdown, { size: 130 })}</div>
          <div class="legend" style="flex:1">${breakdown.map(b => `
            <div class="lg"><span class="dot" style="background:${b.color}"></span>${b.name}
              <span class="v">${pct(b.value, s.spent)}%</span></div>`).join('')}</div>
        </div></div>` : ''}
    <div style="height:12px"></div>`;
  }

  function healthTip(score, s) {
    if (s.income <= 0) return 'Agrega tus ingresos para calcular tu salud financiera.';
    if (s.freeNoSave < 0) return 'Estás gastando más de lo que ganas. Revisa tus gastos variables.';
    if (score >= 75) return '¡Vas excelente! Mantén tu ritmo de ahorro.';
    if (score >= 55) return 'Buen manejo. Intenta subir un poco tu ahorro mensual.';
    if (score >= 35) return 'Vas regular. Reduce gastos no esenciales y aparta tu ahorro.';
    return 'Situación ajustada. Prioriza gastos fijos y evita deudas nuevas.';
  }

  function pagoLI(u) {
    const pill = u.overdue ? `<span class="pill due">Vencido</span>`
      : u.status === 'soon' ? `<span class="pill soon">${u.days === 0 ? 'Hoy' : u.days === 1 ? 'Mañana' : u.days + ' días'}</span>`
        : `<span class="pill ok">${u.date.toLocaleDateString(Store.settings.locale, { day: 'numeric', month: 'short' })}</span>`;
    return `<div class="li">
      <div class="ic">${fEmoji(u.ref)}</div>
      <div class="mid"><div class="t">${esc(u.ref.name)}</div><div class="s">${pill}</div></div>
      <div class="amt">${money(u.ref.amount)}</div>
      <button class="mini" data-action="paid" data-id="${u.ref.id}" data-period="${u.period}" title="Marcar pagado">✓</button>
    </div>`;
  }

  /* =========================================================
     VISTA: INGRESOS
     ========================================================= */
  function ingresos() {
    const list = Store.state.incomes;
    const b = Store.incomeBreakdown();
    return `
    <div class="hero">
      <div class="label">Ingreso neto mensual</div>
      <div class="amount">${money(b.neto)}</div>
      <div class="sub">Bruto ${money(b.bruto)}${b.deducciones < 0 ? ' · Deducciones ' + money(b.deducciones) : ''}</div>
    </div>
    ${b.deducciones < 0 ? `<div class="grid2 mt16">
      <div class="tile"><div class="k">Ingresos brutos</div><div class="v pos">${money(b.bruto)}</div></div>
      <div class="tile"><div class="k">Deducciones</div><div class="v neg">${money(b.deducciones)}</div></div>
    </div>` : ''}
    <div class="section-title">Tus movimientos</div>
    ${list.length ? `<div class="list">${list.map(i => {
      const neg = Number(i.amount) < 0;
      return `<div class="li" data-action="edit-income" data-id="${i.id}">
        <div class="ic" style="background:${neg ? 'var(--red-t)' : 'var(--green-t)'}">${neg ? '➖' : i.type === 'fijo' ? '💵' : '📈'}</div>
        <div class="mid"><div class="t">${esc(i.name)}</div>
          <div class="s">${neg ? 'Deducción' : (i.type === 'fijo' ? 'Fijo' : 'Variable')}${i.day ? ' · día ' + i.day : ''}${i.active === false ? ' · inactivo' : ''}</div></div>
        <div class="amt" style="${neg ? 'color:var(--red)' : ''}">${money(i.amount)}</div>
      </div>`;
    }).join('')}</div>`
      : emptyState('💵', 'Sin ingresos aún', 'Agrega tu sueldo u otras fuentes para saber cuánto puedes gastar y ahorrar.', 'Agregar ingreso', 'add-income')}
    <button class="btn primary block mt16" data-action="add-income">＋ Agregar ingreso o deducción</button>`;
  }

  /* =========================================================
     VISTA: GASTOS FIJOS + VARIABLES (tabs)
     ========================================================= */
  let gastosTab = 'fijos';
  function gastos() {
    return `
    <div class="tabs">
      <button class="${gastosTab === 'fijos' ? 'on' : ''}" data-tab="fijos">🏠 Fijos</button>
      <button class="${gastosTab === 'variables' ? 'on' : ''}" data-tab="variables">💳 Variables</button>
    </div>
    <div id="tabbody">${gastosTab === 'fijos' ? gastosFijos() : gastosVariables()}</div>`;
  }

  function gastosFijos() {
    const s = Store.summary();
    const upMap = {}; Store.upcoming().forEach(u => upMap[u.ref.id] = u);
    const known = Store.FIXED_CATS.map(c => c.key);
    let body = '';
    Store.FIXED_CATS.forEach(g => {
      let items = Store.state.fixed.filter(f => f.category === g.key);
      if (g.key === 'otros') items = items.concat(Store.state.fixed.filter(f => !known.includes(f.category)));
      if (!items.length) return;
      const sub = items.reduce((a, f) => a + (Store.fixedDueInPeriod(f) ? Number(f.amount || 0) : 0), 0);
      body += `<div class="section-title">${g.emoji} ${g.name} · <span class="muted">${money(sub)}/mes</span></div>`;
      body += `<div class="list">${items.map(f => fixedCard(f, upMap[f.id])).join('')}</div>`;
    });
    if (!body) body = emptyState('🏠', 'Sin gastos fijos', 'Agrega arriendo, servicios (agua, luz+aseo, gas), mascotas, planes… con su día de pago.', 'Agregar gasto fijo', 'add-fixed');
    return `
    <div class="card" style="margin-bottom:6px">
      <div class="spread"><div class="card-title">Total fijos este mes</div><div class="bignum">${money(s.fixedTotal)}</div></div>
    </div>
    ${body}
    <button class="btn primary block mt16" data-action="add-fixed">＋ Agregar gasto fijo</button>`;
  }

  function fixedCard(f, u) {
    const due = Store.fixedDueInPeriod(f);
    const paid = u && u.paid;
    const freq = f.everyMonths === 2 ? 'cada 2 meses' : f.everyMonths === 3 ? 'cada 3 meses' : 'mensual';
    let pill = '';
    if (!due) pill = `<span class="pill ok">este mes no aplica</span>`;
    else if (paid) pill = `<span class="pill paid">✓ pagado</span>`;
    else if (u && u.overdue) pill = `<span class="pill due">vencido</span>`;
    else if (u && u.days <= (Store.settings.alertDays || 3)) pill = `<span class="pill soon">${u.days === 0 ? 'hoy' : u.days === 1 ? 'mañana' : u.days + ' días'}</span>`;
    return `<div class="li">
      <div class="ic" data-action="edit-fixed" data-id="${f.id}">${fEmoji(f)}</div>
      <div class="mid" data-action="edit-fixed" data-id="${f.id}">
        <div class="t">${esc(f.name)}</div>
        <div class="s">día ${f.dueDay} · ${freq} ${pill}</div>
      </div>
      <div class="amt">${money(f.amount)}</div>
      ${due ? `<button class="mini" data-action="paid" data-id="${f.id}" data-period="${u ? u.period : Store.monthKey()}" title="Pagado">${paid ? '↩' : '✓'}</button>` : ''}
    </div>`;
  }

  function gastosVariables() {
    const list = Store.variableOf();
    const total = list.reduce((a, v) => a + Number(v.amount || 0), 0);
    const cats = {};
    list.forEach(v => cats[v.category] = (cats[v.category] || 0) + Number(v.amount || 0));
    const catList = Store.VAR_CATS.filter(c => cats[c.key]).map(c => ({ ...c, value: cats[c.key] }));
    return `
    <div class="card" style="margin-bottom:6px">
      <div class="spread"><div class="card-title">Gastos variables · este mes</div><div class="bignum">${money(total)}</div></div>
      ${catList.length ? `<div class="row mt8" style="align-items:center">
        <div style="flex:none">${Charts.donut(catList, { size: 110 })}</div>
        <div class="legend" style="flex:1">${catList.map(c => `<div class="lg"><span class="dot" style="background:${c.color}"></span>${c.emoji} ${c.name}<span class="v">${money(c.value)}</span></div>`).join('')}</div>
      </div>` : ''}
    </div>
    <div class="section-title">Movimientos</div>
    ${list.length ? `<div class="list">${list.map(v => {
      const c = Store.VAR_CATS.find(x => x.key === v.category) || { emoji: '💳', name: v.category, color: 'var(--muted)' };
      return `<div class="li">
        <div class="ic" style="background:${c.color}22">${c.emoji}</div>
        <div class="mid"><div class="t">${esc(v.description || c.name)}</div><div class="s">${c.name} · ${fdate(v.date)}</div></div>
        <div class="amt">${money(v.amount)}</div>
        <button class="mini" data-action="del" data-coll="variable" data-id="${v.id}">🗑</button>
      </div>`;
    }).join('')}</div>`
      : emptyState('💳', 'Sin gastos variables', 'Registra ocio, transporte, salud, imprevistos… y ve en qué se te va la plata.', 'Agregar gasto', 'add-variable')}
    <button class="btn primary block mt16" data-action="add-variable">＋ Agregar gasto variable</button>`;
  }

  /* =========================================================
     VISTA: MERCADO
     ========================================================= */
  let marketFilter = 'all';
  function mercado() {
    const list = Store.marketOf().filter(m => marketFilter === 'all' || m.category === marketFilter);
    const all = Store.marketOf();
    const total = all.reduce((a, m) => a + Number(m.amount || 0), 0);
    const byCat = Store.marketByCategory();
    return `
    <div class="hero" style="background:linear-gradient(135deg,#ff8a3d,#e5622a)">
      <div class="label">Mercado · este mes</div>
      <div class="amount">${money(total)}</div>
      <div class="sub">${all.length} compra${all.length !== 1 ? 's' : ''} registrada${all.length !== 1 ? 's' : ''}</div>
    </div>

    ${(() => { const mb = Store.budgetsList().filter(b => b.key.startsWith('market:')); return mb.length ? `<div class="section-title">Presupuesto de mercado</div><div class="list">${mb.map(budgetMeter).join('')}</div>` : ''; })()}

    ${byCat.length ? `<div class="section-title">Por tipo de producto</div>
    <div class="card"><div class="row" style="align-items:center">
      <div style="flex:none">${Charts.donut(byCat, { size: 130 })}</div>
      <div class="legend" style="flex:1">${byCat.map(c => `<div class="lg"><span class="dot" style="background:${c.color}"></span>${c.emoji} ${c.name}<span class="v">${money(c.value)}</span></div>`).join('')}</div>
    </div></div>` : ''}

    <div class="section-title">Registro</div>
    <div class="chips">
      <button class="chip ${marketFilter === 'all' ? 'on' : ''}" data-mfilter="all">Todo</button>
      ${Store.MARKET_CATS.map(c => `<button class="chip ${marketFilter === c.key ? 'on' : ''}" data-mfilter="${c.key}">${c.emoji} ${c.name}</button>`).join('')}
    </div>
    ${list.length ? `<div class="list">${list.map(m => {
      const c = Store.MARKET_CATS.find(x => x.key === m.category) || { emoji: '🛒', name: m.category, color: 'var(--muted)' };
      const qty = m.qty ? `${(+m.qty % 1 ? +m.qty : Math.round(m.qty))}${m.unit ? ' ' + esc(m.unit) : ''} · ` : '';
      return `<div class="li">
        <div class="ic" style="background:${c.color}22">${c.emoji}</div>
        <div class="mid"><div class="t">${esc(m.item || c.name)}</div><div class="s">${qty}${c.name} · ${fdate(m.date)}</div></div>
        <div class="amt">${money(m.amount)}</div>
        <button class="mini" data-action="del" data-coll="market" data-id="${m.id}">🗑</button>
      </div>`;
    }).join('')}</div>`
      : emptyState('🛒', 'Sin compras registradas', 'Agrega tus compras del mercado por tipo: verduras, frutas, lácteos, granos, carnes…', 'Agregar compra', 'add-market')}
    <button class="btn primary block mt16" data-action="add-market">＋ Agregar compra</button>`;
  }

  /* =========================================================
     VISTA: STATS + PROYECCIÓN
     ========================================================= */
  function stats() {
    const s = Store.summary();
    const bd = Store.spendBreakdown();
    const tr = Store.trend(6);
    const proj = Store.projection(12);
    const market = Store.marketByCategory();
    return `
    ${budgetsBlock()}
    <div class="section-title">Gasto por área · ${Store.monthName(s.period)}</div>
    ${bd.length ? `<div class="card"><div class="row" style="align-items:center">
      <div style="flex:none">${Charts.donut(bd, { size: 140 })}</div>
      <div class="legend" style="flex:1">${bd.map(b => `<div class="lg"><span class="dot" style="background:${b.color}"></span>${b.name}
        <span class="v">${money(b.value)} · ${pct(b.value, s.spent)}%</span></div>`).join('')}</div>
    </div></div>` : `<div class="card muted center small">Aún no hay gastos este mes.</div>`}

    <div class="section-title">Ingresos vs Gastos · últimos 6 meses</div>
    <div class="card">
      ${Charts.bars(tr)}
      <div class="legend" style="flex-direction:row;gap:16px;margin-top:6px">
        <div class="lg"><span class="dot" style="background:var(--green)"></span>Ingresos</div>
        <div class="lg"><span class="dot" style="background:var(--accent)"></span>Gastos</div>
      </div>
    </div>

    <div class="section-title">Proyección de ahorro</div>
    <div class="card">
      <div class="spread mb8">
        <div><div class="small muted">Si ahorras ${money(proj.monthly)}/mes</div>
          <div class="bignum">${money(proj.end)}</div><div class="small muted">en 12 meses</div></div>
        <div class="center"><div class="small muted">6 meses</div><div style="font-weight:800">${money(proj.points[6].value)}</div></div>
      </div>
      ${Charts.line(proj.points)}
      ${proj.monthly === 0 ? `<p class="small muted mt8">Define tu meta de ahorro en Ajustes ⚙️ para ver la proyección.</p>` : ''}
    </div>

    ${market.length ? `<div class="section-title">Detalle del mercado</div>
    <div class="card"><div class="legend">${market.map(c => `
      <div class="lg"><span class="dot" style="background:${c.color}"></span>${c.emoji} ${c.name}
        <span class="v">${money(c.value)} · ${pct(c.value, market.reduce((a, x) => a + x.value, 0))}%</span></div>`).join('')}</div></div>` : ''}

    <div class="section-title">Resumen</div>
    <div class="grid2">
      <div class="tile"><div class="k">Tasa de ahorro</div><div class="v ${s.savingsRate >= 0.1 ? 'pos' : 'neg'}">${Math.round(s.savingsRate * 100)}%</div></div>
      <div class="tile"><div class="k">Gasto / ingreso</div><div class="v">${s.income > 0 ? Math.round(s.spendRate * 100) : 0}%</div></div>
    </div>
    <div style="height:10px"></div>`;
  }

  /* =========================================================
     VISTA: SOBRES / METAS (tipo AGUINALDO)
     ========================================================= */
  const ENV_EMOJIS = ['🎁', '🎄', '🎂', '🏖️', '✈️', '🚗', '🏠', '💍', '🎓', '👶', '🩺', '🛠️', '💻', '🎉', '🐷', '🎯'];
  function sobres() {
    const list = Store.state.envelopes;
    const totTotal = list.reduce((a, e) => a + Number(e.total || 0), 0);
    const totGast = list.reduce((a, e) => a + Store.envSummary(e).gastado, 0);
    return `
    <div class="hero">
      <div class="label">Sobres y metas</div>
      <div class="amount">${money(totTotal - totGast)}</div>
      <div class="sub">Libre en ${list.length} sobre${list.length !== 1 ? 's' : ''} · de ${money(totTotal)}</div>
    </div>
    <p class="small muted" style="margin:14px 4px">Un "sobre" es un fondo para algo puntual (prima, aguinaldo, viaje, regalo). Le pones un total y vas descontando gastos: ves cuánto llevas y cuánto te queda libre.</p>
    ${list.length ? `<div class="list">${list.map(e => {
      const s = Store.envSummary(e);
      const over = s.libre < 0;
      return `<div class="card tap" data-action="open-envelope" data-id="${e.id}" style="padding:16px">
        <div class="spread mb8">
          <div class="card-title">${e.emoji || '🎯'} ${esc(e.name)}</div>
          <div class="bignum" style="font-size:19px;color:${over ? 'var(--red)' : 'var(--lime)'}">${money(s.libre)}</div>
        </div>
        <div class="progresswrap"><div class="progressfill" style="width:${s.pct}%;background:${over ? 'var(--red)' : s.pct >= 90 ? 'var(--accent)' : 'var(--lime)'}"></div></div>
        <div class="spread mt8"><span class="small muted">Gastado ${money(s.gastado)} · ${s.pct}%</span><span class="small muted">Total ${money(s.total)}</span></div>
      </div>`;
    }).join('')}</div>`
      : emptyState('🎯', 'Sin sobres aún', 'Crea un sobre para tu prima, aguinaldo, un viaje o un regalo y controla cuánto te queda libre.', 'Crear sobre', 'add-envelope')}
    <button class="btn primary block mt16" data-action="add-envelope">＋ Crear sobre</button>`;
  }

  function envelopeDetail(id) {
    const e = Store.state.envelopes.find(x => x.id === id);
    if (!e) return;
    const s = Store.envSummary(e);
    const over = s.libre < 0;
    openSheet(`<h2>${e.emoji || '🎯'} ${esc(e.name)}</h2>
    <div class="grid3 mt8" style="margin-bottom:6px">
      <div class="tile center"><div class="k">Total</div><div class="v">${Charts.shorten(s.total)}</div></div>
      <div class="tile center"><div class="k">Gastado</div><div class="v" style="color:var(--accent)">${Charts.shorten(s.gastado)}</div></div>
      <div class="tile center"><div class="k">Libre</div><div class="v" style="color:${over ? 'var(--red)' : 'var(--lime)'}">${Charts.shorten(s.libre)}</div></div>
    </div>
    <div class="progresswrap"><div class="progressfill" style="width:${s.pct}%;background:${over ? 'var(--red)' : 'var(--lime)'}"></div></div>
    <div class="section-title" style="margin-top:18px">Gastos del sobre</div>
    ${(e.items && e.items.length) ? `<div class="list">${e.items.map(it => `
      <div class="li"><div class="ic" style="background:var(--accent-t)">🧾</div>
        <div class="mid"><div class="t">${esc(it.desc || 'Gasto')}</div></div>
        <div class="amt">${money(it.amount)}</div>
        <button class="mini" data-action="del-env-item" data-env="${e.id}" data-id="${it.id}">🗑</button>
      </div>`).join('')}</div>` : `<div class="card muted small center">Aún no has descontado gastos.</div>`}
    <button class="btn primary block mt16" data-action="add-env-item" data-env="${e.id}">＋ Agregar gasto</button>
    <div class="form-actions">
      <button class="btn ghost block" data-action="edit-envelope" data-id="${e.id}">Editar sobre</button>
      <button class="btn danger block" data-action="del-envelope" data-id="${e.id}">Eliminar</button>
    </div>`);
  }

  function envelopeForm(env) {
    openSheet(`<h2>${env ? 'Editar' : 'Nuevo'} sobre</h2><p class="muted">Un fondo para algo puntual (prima, viaje, regalo…).</p>
    <form data-form="envelope">
      <input type="hidden" name="id" value="${env ? env.id : ''}">
      ${txt('name', 'Nombre', env ? env.name : '', 'Aguinaldo, Viaje, Regalo…')}
      ${num('total', 'Monto total del fondo', env ? env.total : '')}
      <div class="field"><label>Ícono</label>
        <div class="chips" style="flex-wrap:wrap">${ENV_EMOJIS.map((em, i) => `<label class="chip" style="cursor:pointer">
          <input type="radio" name="emoji" value="${em}" ${(env ? env.emoji === em : i === 0) ? 'checked' : ''} style="display:none">${em}</label>`).join('')}</div>
        <div class="hint">Toca un ícono para elegirlo.</div></div>
      <div class="form-actions">
        <button type="button" class="btn ghost block" data-action="close">Cancelar</button>
        <button type="submit" class="btn primary block">Guardar</button>
      </div>
    </form>`);
    // marcar visualmente el emoji elegido
    hookEmojiChips();
  }
  function envItemForm(envId) {
    openSheet(`<h2>Gasto del sobre</h2>
    <form data-form="env-item">
      <input type="hidden" name="env" value="${envId}">
      ${txt('desc', 'Descripción', '', 'Cena, regalo, ropa…')}
      ${num('amount', 'Valor', '')}
      <div class="form-actions">
        <button type="button" class="btn ghost block" data-action="close">Cancelar</button>
        <button type="submit" class="btn primary block">Descontar</button>
      </div>
    </form>`);
  }
  function hookEmojiChips() {
    const root = $('#modalRoot');
    root.querySelectorAll('.chip input[name="emoji"]').forEach(inp => {
      const set = () => root.querySelectorAll('.chip').forEach(l => l.classList.toggle('on', l.querySelector('input')?.checked));
      inp.closest('.chip').addEventListener('click', () => { inp.checked = true; set(); });
      set();
    });
  }

  /* =========================================================
     PRESUPUESTOS (medidores + formulario)
     ========================================================= */
  function budgetMeter(b) {
    const col = b.status === 'over' ? 'var(--red)' : b.status === 'warn' ? 'var(--accent)' : 'var(--lime)';
    return `<div class="li" data-action="edit-budget" data-key="${b.key}" style="flex-direction:column;align-items:stretch;gap:9px">
      <div class="spread">
        <div class="card-title" style="font-size:14px">${b.emoji} ${esc(b.label)}</div>
        <div style="color:${col};font-weight:800;font-family:var(--font-head)">${b.pct}%</div>
      </div>
      <div class="progresswrap"><div class="progressfill" style="width:${Math.min(100, b.pct)}%;background:${col}"></div></div>
      <div class="spread small muted"><span>${money(b.spent)} de ${money(b.limit)}</span>
        <span style="color:${b.left < 0 ? 'var(--red)' : 'inherit'}">${b.left >= 0 ? 'quedan ' + money(b.left) : 'excedido ' + money(-b.left)}</span></div>
    </div>`;
  }
  function budgetsBlock() {
    const list = Store.budgetsList();
    return `<div class="section-title">Presupuestos del mes</div>
    ${list.length ? `<div class="list">${list.map(budgetMeter).join('')}</div>`
      : `<div class="card muted small center">Sin topes aún. Ponle un límite a una categoría (ej. mercado) y te aviso al ${Store.settings.budgetAlertPct}%.</div>`}
    <button class="btn ghost block mt16" data-action="add-budget">＋ Nuevo presupuesto</button>`;
  }
  function budgetCatOptions(selected) {
    const groups = [
      { label: 'General', items: [{ v: 'total', t: '📅 Gasto total del mes' }] },
      { label: 'Mercado', items: [{ v: 'market:total', t: '🛒 Mercado (total)' }].concat(Store.MARKET_CATS.map(c => ({ v: 'market:' + c.key, t: c.emoji + ' Mercado · ' + c.name }))) },
      { label: 'Gastos variables', items: Store.VAR_CATS.map(c => ({ v: 'var:' + c.key, t: c.emoji + ' ' + c.name })) },
      { label: 'Gastos fijos', items: Store.FIXED_CATS.map(c => ({ v: 'fixed:' + c.key, t: c.emoji + ' ' + c.name })) },
    ];
    return groups.map(g => `<optgroup label="${g.label}">${g.items.map(o => `<option value="${o.v}" ${o.v === selected ? 'selected' : ''}>${o.t}</option>`).join('')}</optgroup>`).join('');
  }
  function budgetForm(key) {
    const editing = key && Store.state.budgets[key] != null;
    const cur = editing ? Store.state.budgets[key] : '';
    openSheet(`<h2>${editing ? 'Editar' : 'Nuevo'} presupuesto</h2><p class="muted">Ponle un tope mensual a una categoría y te aviso al acercarte.</p>
    <form data-form="budget">
      <div class="field"><label>Categoría</label>
        <select name="${editing ? 'keyx' : 'key'}" ${editing ? 'disabled' : ''}>${budgetCatOptions(key)}</select>
        ${editing ? `<input type="hidden" name="key" value="${key}">` : ''}
      </div>
      ${num('amount', 'Tope mensual', cur)}
      <div class="form-actions">
        <button type="button" class="btn ghost block" data-action="close">Cancelar</button>
        <button type="submit" class="btn primary block">Guardar</button>
      </div>
      ${editing ? `<button type="button" class="btn danger block mt8" data-action="del-budget" data-key="${esc(key)}">Eliminar presupuesto</button>` : ''}
    </form>`);
  }

  /* =========================================================
     FORMULARIOS (sheets)
     ========================================================= */
  function num(id, label, val = '', hint = '') {
    return `<div class="field"><label>${label}</label><input name="${id}" type="number" inputmode="numeric" step="1000" value="${val}" placeholder="0">${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  }
  function txt(id, label, val = '', ph = '') {
    return `<div class="field"><label>${label}</label><input name="${id}" type="text" value="${esc(val)}" placeholder="${esc(ph)}"></div>`;
  }
  function opts(arr, sel) { return arr.map(o => `<option value="${o.v}" ${o.v === sel ? 'selected' : ''}>${o.t}</option>`).join(''); }

  function incomeForm(it) {
    editing = it || null;
    const isNeg = it && Number(it.amount) < 0;
    openSheet(`<h2>${it ? 'Editar' : 'Nuevo'} movimiento</h2><p class="muted">Un ingreso suma; una deducción (seguridad social, deuda) resta.</p>
    <form data-form="income">
      <input type="hidden" name="id" value="${it ? it.id : ''}">
      <div class="field"><label>Tipo de movimiento</label><select name="sign">${opts([{ v: 'ingreso', t: '＋ Ingreso (suma)' }, { v: 'deduccion', t: '－ Deducción (resta)' }], isNeg ? 'deduccion' : 'ingreso')}</select></div>
      ${txt('name', 'Nombre', it ? it.name : '', 'Salario, aux. alimentación, seguridad social…')}
      ${num('amount', 'Monto mensual', it ? Math.abs(it.amount) : '', 'Escríbelo en positivo; el tipo define si suma o resta.')}
      <div class="field"><label>Frecuencia</label><select name="type">${opts([{ v: 'fijo', t: 'Fijo (siempre igual)' }, { v: 'variable', t: 'Variable' }], it ? it.type : 'fijo')}</select></div>
      ${num('day', 'Día (1-31)', it ? it.day : '')}
      <div class="form-actions">
        <button type="button" class="btn ghost block" data-action="close">Cancelar</button>
        <button type="submit" class="btn primary block">Guardar</button>
      </div>
      ${it ? `<button type="button" class="btn danger block mt8" data-action="del-close" data-coll="incomes" data-id="${it.id}">Eliminar</button>` : ''}
    </form>`);
  }

  function fixedForm(it) {
    editing = it || null;
    openSheet(`<h2>${it ? 'Editar' : 'Nuevo'} gasto fijo</h2><p class="muted">Arriendo, servicios o cualquier pago recurrente.</p>
    <form data-form="fixed">
      <input type="hidden" name="id" value="${it ? it.id : ''}">
      ${txt('name', 'Nombre', it ? it.name : '', 'Arriendo, Luz + aseo, Gas, Agua…')}
      ${num('amount', 'Valor', it ? it.amount : '')}
      <div class="field"><label>Categoría</label><select name="category">${Store.FIXED_CATS.map(c => `<option value="${c.key}" ${it && it.category === c.key ? 'selected' : ''}>${c.emoji} ${c.name}</option>`).join('')}</select></div>
      ${num('dueDay', 'Día de pago (1-31)', it ? it.dueDay : '')}
      <div class="field"><label>Frecuencia</label><select name="everyMonths">${opts([{ v: '1', t: 'Mensual' }, { v: '2', t: 'Cada 2 meses (ej. agua)' }, { v: '3', t: 'Cada 3 meses' }], String(it ? it.everyMonths || 1 : 1))}</select>
        <div class="hint">Para "cada 2 meses" se toma este mes como referencia del ciclo.</div></div>
      <div class="form-actions">
        <button type="button" class="btn ghost block" data-action="close">Cancelar</button>
        <button type="submit" class="btn primary block">Guardar</button>
      </div>
      ${it ? `<button type="button" class="btn danger block mt8" data-action="del-close" data-coll="fixed" data-id="${it.id}">Eliminar</button>` : ''}
    </form>`);
  }

  function marketForm() {
    openSheet(`<h2>Compra de mercado</h2><p class="muted">Registra por tipo de producto.</p>
    <form data-form="market">
      <div class="field"><label>Tipo de producto</label><select name="category">${Store.MARKET_CATS.map(c => `<option value="${c.key}">${c.emoji} ${c.name}</option>`).join('')}</select></div>
      ${txt('item', 'Insumo', '', 'Pollo entero, arroz, brócoli…')}
      <div class="row">
        <div style="flex:1">${num('qty', 'Cantidad', '')}</div>
        <div style="flex:1">${txt('unit', 'Unidad', '', 'g, kg, und, lb…')}</div>
      </div>
      ${num('amount', 'Valor', '')}
      <div class="field"><label>Fecha</label><input name="date" type="date" value="${Store.dayKey()}"></div>
      <div class="form-actions">
        <button type="button" class="btn ghost block" data-action="close">Cancelar</button>
        <button type="submit" class="btn primary block">Guardar</button>
      </div>
    </form>`);
  }

  function variableForm() {
    openSheet(`<h2>Gasto variable</h2><p class="muted">Ocio, transporte, salud, imprevistos…</p>
    <form data-form="variable">
      <div class="field"><label>Categoría</label><select name="category">${Store.VAR_CATS.map(c => `<option value="${c.key}">${c.emoji} ${c.name}</option>`).join('')}</select></div>
      ${txt('description', 'Descripción (opcional)', '', 'Bus, cine, medicina…')}
      ${num('amount', 'Valor', '')}
      <div class="field"><label>Fecha</label><input name="date" type="date" value="${Store.dayKey()}"></div>
      <div class="form-actions">
        <button type="button" class="btn ghost block" data-action="close">Cancelar</button>
        <button type="submit" class="btn primary block">Guardar</button>
      </div>
    </form>`);
  }

  function savingForm() {
    const s = Store.summary();
    openSheet(`<h2>Apartar ahorro</h2><p class="muted">Meta del mes: ${money(s.savingsTarget)} · llevas ${money(s.saved)}.</p>
    <form data-form="saving">
      ${num('amount', '¿Cuánto vas a apartar ahora?', s.savingsGap || '')}
      <div class="hint">Se suma a tu ahorro de ${Store.monthName(s.period)}.</div>
      <div class="form-actions">
        <button type="button" class="btn ghost block" data-action="close">Cancelar</button>
        <button type="submit" class="btn primary block">Apartar</button>
      </div>
    </form>`);
  }

  /* ---------- ALERTAS (sheet) ---------- */
  function alertsSheet() {
    const a = Store.alerts();
    openSheet(`<h2>🔔 Alertas</h2><p class="muted">${a.length ? 'Cosas que requieren tu atención.' : 'Todo en orden por ahora.'}</p>
    ${a.length ? `<div class="list">${a.map(x => {
      const ic = x.type === 'overdue' ? '⛔' : x.type === 'soon' ? '⏰' : x.type === 'savings' ? '🐷' : '⚠️';
      const col = x.type === 'overdue' || x.type === 'over' ? 'var(--red-t)' : x.type === 'savings' ? 'var(--green-t)' : 'var(--accent-t)';
      return `<div class="li" style="background:${col}"><div class="ic" style="background:transparent;font-size:22px">${ic}</div>
        <div class="mid"><div class="t">${esc(x.title)}</div><div class="s">${esc(x.msg)}</div></div></div>`;
    }).join('')}</div>` : `<div class="empty"><div class="em">✅</div><p>Sin alertas. ¡Bien ahí!</p></div>`}
    ${Notif.supported() ? `<div class="divider"></div>
      <div class="spread"><div><div style="font-weight:700">Notificaciones al móvil</div><div class="small muted">${Notif.granted() ? 'Permiso concedido' : 'Recibe avisos de tus pagos'}</div></div>
      <button class="btn ${Store.settings.notif && Notif.granted() ? 'soft' : 'primary'} sm" data-action="toggle-notif">${Store.settings.notif && Notif.granted() ? 'Activadas ✓' : 'Activar'}</button></div>` : ''}
    <button class="btn ghost block mt16" data-action="close">Cerrar</button>`);
  }

  /* ---------- AJUSTES (sheet) ---------- */
  function cloudSection() {
    if (typeof Cloud === 'undefined' || !Cloud.enabled()) return '';  // se muestra al configurar el Client ID
    if (Cloud.connected()) {
      const ls = Cloud.lastSync ? new Date(Cloud.lastSync).toLocaleString(Store.settings.locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'nunca';
      return `<div class="card" style="margin-bottom:14px">
        <div class="spread"><div style="min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">☁️ ${esc(Cloud.email || 'Conectado')}</div>
          <div class="small muted">Última sincronización: ${ls}</div></div><span class="pill paid">✓ Nube</span></div>
        <div class="form-actions" style="margin-top:12px"><button type="button" class="btn soft block" data-action="cloud-sync">🔄 Sincronizar</button>
          <button type="button" class="btn ghost block" data-action="cloud-logout">Cerrar sesión</button></div>
      </div>`;
    }
    return `<div class="card" style="margin-bottom:14px">
      <div style="font-weight:700;margin-bottom:4px">☁️ Guardar en tu cuenta de Google</div>
      <div class="small muted" style="margin-bottom:12px">Respalda y sincroniza tus datos entre tu celular y tu PC. Quedan en tu propio Google Drive, privados.</div>
      <button type="button" class="btn primary block" data-action="cloud-login">Iniciar sesión con Google</button>
    </div>`;
  }

  function settingsSheet() {
    const st = Store.settings;
    openSheet(`<h2>⚙️ Ajustes</h2>
    ${cloudSection()}
    <form data-form="settings">
      <div class="field"><label>Moneda</label><select name="currency">${opts([{ v: 'COP', t: 'Peso colombiano (COP)' }, { v: 'MXN', t: 'Peso mexicano (MXN)' }, { v: 'USD', t: 'Dólar (USD)' }, { v: 'EUR', t: 'Euro (EUR)' }, { v: 'PEN', t: 'Sol (PEN)' }, { v: 'CLP', t: 'Peso chileno (CLP)' }, { v: 'ARS', t: 'Peso argentino (ARS)' }], st.currency)}</select></div>
      <div class="field"><label>Regla de ahorro</label><select name="savingsMode">${opts([{ v: 'percent', t: 'Porcentaje del ingreso' }, { v: 'fixed', t: 'Monto fijo' }], st.savingsMode)}</select></div>
      ${num('savingsValue', 'Ahorro mínimo mensual', st.savingsValue, 'Si es porcentaje, escribe 10, 20, etc.')}
      ${num('alertDays', 'Avisarme X días antes de un pago', st.alertDays)}
      ${num('budgetAlertPct', 'Avisarme al llegar a este % del presupuesto', st.budgetAlertPct, 'Ej. 80 = te aviso al gastar el 80% del tope.')}
      <div class="form-actions"><button type="submit" class="btn primary block">Guardar ajustes</button></div>
    </form>
    <div class="divider"></div>
    <div class="section-title" style="margin-top:0">Datos</div>
    <button class="btn ghost block mb8" data-action="export">⬇️ Exportar copia de seguridad</button>
    <button class="btn ghost block mb8" data-action="import">⬆️ Importar copia</button>
    <button class="btn ghost block mb8" data-action="seed">✨ Cargar datos de ejemplo</button>
    <button class="btn danger block" data-action="reset">🗑 Borrar todo</button>
    <p class="small muted center mt16">Nova Budget · tus datos se guardan solo en este dispositivo.</p>
    <button class="btn ghost block mt8" data-action="close">Cerrar</button>`);
  }

  /* ---------- ONBOARDING ---------- */
  function onboarding() {
    openSheet(`<h2>👋 Bienvenido a Nova Budget</h2>
    <p class="muted">Tu app para organizar gastos, programar pagos y ahorrar sí o sí cada mes.</p>
    <form data-form="onboard">
      ${num('income', '¿Cuánto ganas al mes?', '', 'Suma de tus ingresos')}
      ${num('savingsValue', '¿Qué % quieres ahorrar mínimo?', 20, 'Recomendado: 10% a 20%')}
      <div class="field"><label>Moneda</label><select name="currency">${opts([{ v: 'COP', t: 'Peso colombiano (COP)' }, { v: 'MXN', t: 'Peso mexicano (MXN)' }, { v: 'USD', t: 'Dólar (USD)' }, { v: 'PEN', t: 'Sol (PEN)' }, { v: 'CLP', t: 'Peso chileno (CLP)' }, { v: 'ARS', t: 'Peso argentino (ARS)' }, { v: 'EUR', t: 'Euro (EUR)' }], 'COP')}</select></div>
      <button type="submit" class="btn primary block">Empezar</button>
      <button type="button" class="btn ghost block mt8" data-action="onboard-demo">Ver con datos de ejemplo</button>
    </form>`);
  }

  /* =========================================================
     PANTALLA DE BIENVENIDA / LOGIN
     ========================================================= */
  function welcome() {
    const hasGoogle = (typeof Cloud !== 'undefined' && Cloud.enabled());
    const G = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
    const feats = [
      ['📊', 'Estadísticas claras', 'Mira en qué se te va la plata, con porcentajes'],
      ['🔔', 'Alertas de pago', 'Te avisamos antes de cada vencimiento'],
      ['🐷', 'Ahorro obligatorio', 'Aparta un mínimo cada mes, automático'],
    ];
    const bars = [.45, .7, .52, .9, .62, .8];
    return `
    <div class="w-bg"><span class="w-orb a"></span><span class="w-orb b"></span><span class="w-orb c"></span></div>
    <div class="welcome"><div class="w-content">
      <div class="w-logo">N</div>
      <h1 class="w-title">Toma el control<br>de tu <b>plata</b>.</h1>
      <p class="w-tag">Organiza tus gastos, programa tus pagos y ahorra sí o sí cada mes. Simple, claro y en tu bolsillo.</p>
      <div class="w-chart">${bars.map((h, i) => `<i style="--h:${h};animation-delay:${(.15 + i * .08).toFixed(2)}s"></i>`).join('')}</div>
      <div class="w-feats">${feats.map((f, i) => `
        <div class="w-feat" style="animation-delay:${(.3 + i * .12).toFixed(2)}s"><div class="fi">${f[0]}</div>
          <div class="ft"><b>${f[1]}</b>${f[2]}</div></div>`).join('')}</div>
      <div class="w-actions">
        ${hasGoogle ? `<button class="gbtn" data-action="enter-google">${G} Continuar con Google</button>
          <button class="btn ghost block" data-action="enter-local">Empezar sin cuenta</button>
          <p class="w-note">Con Google <b>sincronizas</b> entre tu celular y PC.<br>Sin cuenta, tus datos quedan <b>solo en este dispositivo</b>.</p>`
        : `<button class="btn primary block" data-action="enter-local">Empezar ahora</button>
          <p class="w-note">Tus datos quedan <b>solo en este dispositivo</b>, privados.</p>`}
      </div>
    </div></div>`;
  }
  function hookWelcome() {
    if (window.__welcomeHooked) return; window.__welcomeHooked = true;
    if (window.matchMedia && matchMedia('(pointer:coarse)').matches) return;
    window.addEventListener('pointermove', e => {
      const bg = document.querySelector('.w-bg'); if (!bg) return;
      const x = (e.clientX / window.innerWidth - .5) * 22, y = (e.clientY / window.innerHeight - .5) * 22;
      bg.style.transform = `translate(${x}px,${y}px)`;
    });
  }

  /* ---------- utilidades ---------- */
  function emptyState(em, title, desc, btn, action) {
    return `<div class="empty"><div class="em">${em}</div><h3>${title}</h3><p>${desc}</p>
      ${btn ? `<button class="btn primary" data-action="${action}">${btn}</button>` : ''}</div>`;
  }
  const pct = (v, t) => t > 0 ? Math.round(v / t * 100) : 0;
  function fdate(d) { try { return new Date(d + 'T00:00').toLocaleDateString(Store.settings.locale, { day: 'numeric', month: 'short' }); } catch { return d; } }

  return {
    inicio, ingresos, gastos, mercado, stats, sobres,
    incomeForm, fixedForm, marketForm, variableForm, savingForm,
    envelopeForm, envelopeDetail, envItemForm, budgetForm,
    alertsSheet, settingsSheet, onboarding, welcome, hookWelcome,
    openSheet, closeSheet, toast,
    get gastosTab() { return gastosTab; }, set gastosTab(v) { gastosTab = v; },
    get marketFilter() { return marketFilter; }, set marketFilter(v) { marketFilter = v; },
    get editing() { return editing; },
  };
})();
