/* ===== Nova Budget — store: persistencia local + lógica financiera ===== */
const Store = (() => {
  const KEY = 'bolsillo.v1';

  const DEFAULTS = {
    settings: {
      currency: 'COP',
      locale: 'es-CO',
      savingsMode: 'percent',   // 'percent' | 'fixed'
      savingsValue: 20,         // % o monto
      alertDays: 3,             // avisar N días antes
      notif: false,
      onboarded: false,
    },
    incomes: [],   // {id,name,amount,type:'fijo'|'variable',day,active}  (amount<0 = deducción)
    fixed: [],     // {id,name,category,amount,dueDay,everyMonths,anchor:'YYYY-MM',emoji}
    market: [],    // {id,date:'YYYY-MM-DD',category,item,qty,unit,amount}
    variable: [],  // {id,date:'YYYY-MM-DD',category,description,amount}
    envelopes: [], // {id,name,emoji,total,items:[{id,desc,amount}]}  (sobres tipo AGUINALDO)
    paidLog: [],   // {id,refId,period:'YYYY-MM',date}
    savingsLog: [],// {id,period:'YYYY-MM',amount,date}
  };

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return deepMerge(structuredClone(DEFAULTS), parsed);
    } catch (e) {
      console.warn('Store load falló, usando defaults', e);
      return structuredClone(DEFAULTS);
    }
  }
  function deepMerge(base, over) {
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        deepMerge(base[k], over[k]);
      } else { base[k] = over[k]; }
    }
    return base;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error('No se pudo guardar', e); }
    window.dispatchEvent(new CustomEvent('store:changed'));
  }

  /* ---------- helpers de fecha ---------- */
  const now = () => new Date();
  const pad = n => String(n).padStart(2, '0');
  const monthKey = (d = now()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const dayKey = (d = now()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthIndexAbs = (period) => { const [y, m] = period.split('-').map(Number); return y * 12 + (m - 1); };
  const monthName = (period) => {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(state.settings.locale, { month: 'long', year: 'numeric' });
  };

  /* ---------- formato de dinero ---------- */
  function money(v) {
    const n = Math.round(Number(v) || 0);
    try {
      return new Intl.NumberFormat(state.settings.locale, {
        style: 'currency', currency: state.settings.currency, maximumFractionDigits: 0,
      }).format(n);
    } catch { return '$' + n.toLocaleString('es-CO'); }
  }
  const uid = () => 'x' + Math.random().toString(36).slice(2, 9) + (state._c = (state._c || 0) + 1);

  /* ---------- CRUD genérico ---------- */
  function add(coll, obj) { obj.id = obj.id || uid(); state[coll].unshift(obj); save(); return obj; }
  function update(coll, id, patch) {
    const it = state[coll].find(x => x.id === id);
    if (it) Object.assign(it, patch), save();
    return it;
  }
  function remove(coll, id) { state[coll] = state[coll].filter(x => x.id !== id); save(); }

  /* ---------- ¿un gasto fijo aplica en un periodo? ---------- */
  function fixedDueInPeriod(f, period = monthKey()) {
    const every = f.everyMonths || 1;
    if (every === 1) return true;
    const anchor = f.anchor || period;
    return (monthIndexAbs(period) - monthIndexAbs(anchor)) % every === 0;
  }
  function nextDueDate(f, from = now()) {
    // busca el próximo mes (incluido el actual) donde aplica y arma la fecha de pago
    for (let i = 0; i < 24; i++) {
      const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
      const period = monthKey(d);
      if (!fixedDueInPeriod(f, period)) continue;
      const day = Math.min(f.dueDay || 1, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
      const due = new Date(d.getFullYear(), d.getMonth(), day);
      if (i === 0 && due < startOfDay(from) && isPaid(f.id, period)) continue; // ya pasó y pagado -> siguiente ciclo
      if (i === 0 && due < startOfDay(from) && !isPaid(f.id, period)) return { date: due, period, overdue: true };
      return { date: due, period, overdue: false };
    }
    return null;
  }
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysBetween = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);

  /* ---------- pagos marcados ---------- */
  function isPaid(refId, period) { return state.paidLog.some(p => p.refId === refId && p.period === period); }
  function togglePaid(refId, period) {
    if (isPaid(refId, period)) state.paidLog = state.paidLog.filter(p => !(p.refId === refId && p.period === period));
    else state.paidLog.push({ id: uid(), refId, period, date: dayKey() });
    save();
  }

  /* ---------- filtros por mes ---------- */
  const inMonth = (dateStr, period = monthKey()) => (dateStr || '').slice(0, 7) === period;
  const marketOf = (period = monthKey()) => state.market.filter(m => inMonth(m.date, period));
  const variableOf = (period = monthKey()) => state.variable.filter(v => inMonth(v.date, period));

  /* ---------- resumen del mes ---------- */
  function summary(period = monthKey()) {
    const income = state.incomes.filter(i => i.active !== false).reduce((s, i) => s + Number(i.amount || 0), 0);
    const fixedList = state.fixed.filter(f => fixedDueInPeriod(f, period));
    const fixedTotal = fixedList.reduce((s, f) => s + Number(f.amount || 0), 0);
    const marketTotal = marketOf(period).reduce((s, m) => s + Number(m.amount || 0), 0);
    const variableTotal = variableOf(period).reduce((s, v) => s + Number(v.amount || 0), 0);
    const spent = fixedTotal + marketTotal + variableTotal;

    const savingsTarget = state.settings.savingsMode === 'percent'
      ? Math.round(income * (Number(state.settings.savingsValue) || 0) / 100)
      : Number(state.settings.savingsValue || 0);
    const saved = state.savingsLog.filter(s => s.period === period).reduce((s, x) => s + Number(x.amount || 0), 0);

    const available = income - spent - savingsTarget;   // disponible tras apartar ahorro
    const freeNoSave = income - spent;                  // libre sin contar ahorro
    const savingsRate = income > 0 ? saved / income : 0;
    const spendRate = income > 0 ? spent / income : 0;

    return {
      period, income, fixedTotal, marketTotal, variableTotal, spent,
      savingsTarget, saved, savingsGap: Math.max(0, savingsTarget - saved),
      available, freeNoSave, savingsRate, spendRate,
      fixedCount: fixedList.length,
    };
  }

  /* ---------- salud financiera (0-100) ---------- */
  function health(period = monthKey()) {
    const s = summary(period);
    let score = 50;
    if (s.income > 0) {
      score = 0;
      const sr = s.savingsRate;                 // ahorro real / ingreso
      score += Math.min(40, sr * 200);          // 20% ahorro => 40 pts
      const ratio = s.spent / s.income;         // gasto / ingreso
      score += ratio <= 0.7 ? 35 : ratio <= 0.9 ? 22 : ratio <= 1 ? 10 : 0;
      score += s.freeNoSave >= 0 ? 15 : 0;      // no estás en rojo
      const overdue = upcoming(period).filter(u => u.overdue).length;
      score += overdue === 0 ? 10 : Math.max(0, 10 - overdue * 5);
    }
    score = Math.max(0, Math.min(100, Math.round(score)));
    let label = 'Crítica', color = 'var(--red)';
    if (score >= 75) { label = 'Excelente'; color = 'var(--green)'; }
    else if (score >= 55) { label = 'Buena'; color = '#22a06b'; }
    else if (score >= 35) { label = 'Regular'; color = 'var(--amber)'; }
    return { score, label, color };
  }

  /* ---------- gastos por categoría (para gráficas) ---------- */
  const MARKET_CATS = [
    { key: 'verduras', name: 'Verduras', emoji: '🥦', color: '#34d399' },
    { key: 'frutas', name: 'Frutas', emoji: '🍎', color: '#f87171' },
    { key: 'carnes', name: 'Carnes', emoji: '🥩', color: '#e08a6a' },
    { key: 'granos', name: 'Granos y otros', emoji: '🌾', color: '#fbbf24' },
    { key: 'lacteos', name: 'Lácteos', emoji: '🥛', color: '#60a5fa' },
    { key: 'snacks', name: 'Snacks', emoji: '🍪', color: '#c084fc' },
    { key: 'aseo', name: 'Aseo', emoji: '🧼', color: '#22d3ee' },
    { key: 'otros', name: 'Otros', emoji: '🛍️', color: '#94a3b8' },
  ];
  // Categorías de gastos fijos
  const FIXED_CATS = [
    { key: 'arriendo', name: 'Arriendo', emoji: '🏠' },
    { key: 'servicios', name: 'Servicios', emoji: '💡' },
    { key: 'mercado', name: 'Mercado fijo', emoji: '🛒' },
    { key: 'mascotas', name: 'Mascotas', emoji: '🐾' },
    { key: 'transporte', name: 'Transporte', emoji: '🚌' },
    { key: 'salud', name: 'Salud y gym', emoji: '🏋️' },
    { key: 'suscripciones', name: 'Planes y suscripciones', emoji: '📺' },
    { key: 'otros', name: 'Otros fijos', emoji: '📄' },
  ];
  const fixedCat = key => FIXED_CATS.find(c => c.key === key) || FIXED_CATS[FIXED_CATS.length - 1];
  const VAR_CATS = [
    { key: 'transporte', name: 'Transporte', emoji: '🚌', color: '#3b82f6' },
    { key: 'salud', name: 'Salud', emoji: '💊', color: '#e5484d' },
    { key: 'ocio', name: 'Ocio', emoji: '🎉', color: '#ff8a3d' },
    { key: 'ropa', name: 'Ropa', emoji: '👕', color: '#8b5cf6' },
    { key: 'educacion', name: 'Educación', emoji: '📚', color: '#22a06b' },
    { key: 'imprevisto', name: 'Imprevisto', emoji: '⚠️', color: '#f5a524' },
    { key: 'otros', name: 'Otros', emoji: '💳', color: '#6b7c76' },
  ];
  function marketByCategory(period = monthKey()) {
    const map = {};
    marketOf(period).forEach(m => { map[m.category] = (map[m.category] || 0) + Number(m.amount || 0); });
    return MARKET_CATS.filter(c => map[c.key]).map(c => ({ ...c, value: map[c.key] }));
  }
  function spendBreakdown(period = monthKey()) {
    const s = summary(period);
    const parts = [
      { key: 'fijos', name: 'Fijos', color: '#0f9d76', value: s.fixedTotal },
      { key: 'mercado', name: 'Mercado', color: '#ff8a3d', value: s.marketTotal },
      { key: 'variable', name: 'Variables', color: '#3b82f6', value: s.variableTotal },
    ].filter(p => p.value > 0);
    return parts;
  }

  /* ---------- próximos pagos / alertas ---------- */
  function upcoming(period = monthKey()) {
    const today = now();
    return state.fixed.map(f => {
      const nd = nextDueDate(f, today);
      if (!nd) return null;
      const days = daysBetween(nd.date, today);
      const paid = isPaid(f.id, nd.period);
      const overdue = nd.overdue && !paid;
      let status = 'ok';
      if (paid) status = 'paid';
      else if (overdue) status = 'due';
      else if (days <= (state.settings.alertDays || 3)) status = 'soon';
      return { ref: f, date: nd.date, period: nd.period, days, paid, overdue, status };
    }).filter(Boolean).sort((a, b) => a.date - b.date);
  }
  function alerts() {
    const list = [];
    upcoming().forEach(u => {
      if (u.paid) return;
      if (u.overdue) list.push({ type: 'overdue', title: `Vencido: ${u.ref.name}`, msg: `${money(u.ref.amount)} — venció el ${u.date.toLocaleDateString(state.settings.locale)}`, ref: u });
      else if (u.days <= (state.settings.alertDays || 3)) list.push({ type: 'soon', title: `Pronto: ${u.ref.name}`, msg: `${money(u.ref.amount)} — ${u.days === 0 ? 'vence hoy' : u.days === 1 ? 'vence mañana' : 'en ' + u.days + ' días'}`, ref: u });
    });
    const s = summary();
    if (s.income > 0 && s.savingsGap > 0 && now().getDate() >= 20) {
      list.push({ type: 'savings', title: 'Meta de ahorro', msg: `Te falta apartar ${money(s.savingsGap)} este mes` });
    }
    if (s.freeNoSave < 0) list.push({ type: 'over', title: '¡Cuidado! Gastos > ingresos', msg: `Vas ${money(-s.freeNoSave)} por encima de lo que ganas` });
    return list;
  }

  /* ---------- proyección de ahorro ---------- */
  function projection(months = 12) {
    const s = summary();
    const monthly = Math.max(0, s.savingsTarget);
    const startAccum = state.savingsLog.reduce((a, x) => a + Number(x.amount || 0), 0);
    const pts = [];
    for (let i = 0; i <= months; i++) pts.push({ month: i, value: startAccum + monthly * i });
    return { monthly, startAccum, points: pts, end: startAccum + monthly * months };
  }

  /* ---------- tendencia últimos N meses ---------- */
  function trend(n = 6) {
    const out = [];
    const d = now();
    for (let i = n - 1; i >= 0; i--) {
      const p = monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1));
      const s = summary(p);
      out.push({ period: p, label: new Date(p + '-01').toLocaleDateString(state.settings.locale, { month: 'short' }), spent: s.spent, income: s.income });
    }
    return out;
  }

  /* ---------- ingresos: bruto / deducciones / neto ---------- */
  function incomeBreakdown() {
    const act = state.incomes.filter(i => i.active !== false);
    const bruto = act.filter(i => Number(i.amount) > 0).reduce((s, i) => s + Number(i.amount || 0), 0);
    const deducciones = act.filter(i => Number(i.amount) < 0).reduce((s, i) => s + Number(i.amount || 0), 0); // negativo
    return { bruto, deducciones, neto: bruto + deducciones };
  }

  /* ---------- sobres / metas (tipo AGUINALDO) ---------- */
  function envSummary(env) {
    const gastado = (env.items || []).reduce((s, x) => s + Number(x.amount || 0), 0);
    const total = Number(env.total || 0);
    const libre = total - gastado;
    const pct = total > 0 ? Math.min(100, Math.round(gastado / total * 100)) : 0;
    return { gastado, total, libre, pct };
  }
  function addEnvelope(obj) { obj.id = obj.id || uid(); obj.items = obj.items || []; state.envelopes.unshift(obj); save(); return obj; }
  function updateEnvelope(id, patch) { const e = state.envelopes.find(x => x.id === id); if (e) Object.assign(e, patch), save(); return e; }
  function removeEnvelope(id) { state.envelopes = state.envelopes.filter(x => x.id !== id); save(); }
  function addEnvItem(envId, item) { const e = state.envelopes.find(x => x.id === envId); if (e) { item.id = uid(); (e.items = e.items || []).unshift(item); save(); } }
  function removeEnvItem(envId, itemId) { const e = state.envelopes.find(x => x.id === envId); if (e) { e.items = (e.items || []).filter(i => i.id !== itemId); save(); } }

  /* ---------- export / import ---------- */
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    const data = JSON.parse(text);
    state = deepMerge(structuredClone(DEFAULTS), data);
    save(); return true;
  }
  function reset() { state = structuredClone(DEFAULTS); save(); }

  /* ---------- semillas de ejemplo (onboarding demo) ---------- */
  function seedDemo() {
    // Datos de EJEMPLO genéricos (ficticios) — solo para explorar la app.
    const p = monthKey();
    state.incomes = [
      { id: uid(), name: 'Salario', amount: 1500000, type: 'fijo', day: 30, active: true },
      { id: uid(), name: 'Ingreso extra', amount: 300000, type: 'variable', day: 15, active: true },
      { id: uid(), name: 'Descuento seguridad social', amount: -120000, type: 'fijo', day: 30, active: true },
    ];
    state.fixed = [
      { id: uid(), name: 'Arriendo', category: 'arriendo', amount: 600000, dueDay: 1, everyMonths: 1, emoji: '🏠' },
      { id: uid(), name: 'Agua', category: 'servicios', amount: 90000, dueDay: 18, everyMonths: 2, anchor: p, emoji: '💧' },
      { id: uid(), name: 'Luz + aseo', category: 'servicios', amount: 80000, dueDay: 12, everyMonths: 1, emoji: '💡' },
      { id: uid(), name: 'Gas', category: 'servicios', amount: 40000, dueDay: 15, everyMonths: 1, emoji: '🔥' },
      { id: uid(), name: 'Internet', category: 'suscripciones', amount: 70000, dueDay: 5, everyMonths: 1, emoji: '🌐' },
      { id: uid(), name: 'Comida mascota', category: 'mascotas', amount: 60000, dueDay: 5, everyMonths: 1, emoji: '🐾' },
      { id: uid(), name: 'Transporte', category: 'transporte', amount: 90000, dueDay: 1, everyMonths: 1, emoji: '🚌' },
      { id: uid(), name: 'Gimnasio', category: 'salud', amount: 80000, dueDay: 1, everyMonths: 1, emoji: '🏋️' },
    ];
    state.market = [
      { id: uid(), date: dayKey(), category: 'carnes', item: 'Pollo', qty: 1, unit: 'und', amount: 25000 },
      { id: uid(), date: dayKey(), category: 'verduras', item: 'Verduras semana', qty: 1, unit: '', amount: 15000 },
      { id: uid(), date: dayKey(), category: 'granos', item: 'Arroz + huevos', qty: 1, unit: '', amount: 20000 },
      { id: uid(), date: dayKey(), category: 'frutas', item: 'Frutas', qty: 1, unit: '', amount: 10000 },
      { id: uid(), date: dayKey(), category: 'snacks', item: 'Café + galletas', qty: 1, unit: '', amount: 12000 },
    ];
    state.variable = [
      { id: uid(), date: dayKey(), category: 'ocio', description: 'Streaming', amount: 20000 },
    ];
    state.envelopes = [
      { id: uid(), name: 'Prima / Aguinaldo', emoji: '🎁', total: 800000, items: [
        { id: uid(), desc: 'Regalo', amount: 200000 },
        { id: uid(), desc: 'Cena', amount: 150000 },
        { id: uid(), desc: 'Ropa', amount: 150000 },
      ] },
    ];
    state.savingsLog = [{ id: uid(), period: p, amount: 150000, date: dayKey() }];
    state.settings.savingsValue = 15;
    state.settings.onboarded = true;
    save();
  }

  return {
    get state() { return state; },
    get settings() { return state.settings; },
    save, add, update, remove,
    money, uid, monthKey, dayKey, monthName, monthIndexAbs,
    summary, health, upcoming, alerts, projection, trend,
    marketByCategory, spendBreakdown, fixedDueInPeriod, nextDueDate,
    isPaid, togglePaid, marketOf, variableOf, daysBetween,
    incomeBreakdown,
    envSummary, addEnvelope, updateEnvelope, removeEnvelope, addEnvItem, removeEnvItem,
    exportJSON, importJSON, reset, seedDemo,
    MARKET_CATS, VAR_CATS, FIXED_CATS, fixedCat,
  };
})();
