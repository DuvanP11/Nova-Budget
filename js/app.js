/* ===== Nova Budget — app: enrutador + eventos ===== */
(() => {
  const $ = s => document.querySelector(s);
  let route = 'inicio';

  const VIEWS = {
    inicio: UI.inicio, ingresos: UI.ingresos, gastos: UI.gastos, mercado: UI.mercado, sobres: UI.sobres, stats: UI.stats,
  };

  function render() {
    const gate = !(Store.settings.entered || Store.settings.onboarded);
    document.body.classList.toggle('gate', gate);
    if (gate) { $('#view').innerHTML = UI.welcome(); UI.hookWelcome(); window.scrollTo(0, 0); return; }
    $('#view').innerHTML = VIEWS[route]();
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === route));
    $('#view').scrollTo?.(0, 0); window.scrollTo(0, 0);
    updateChrome();
  }

  function go(r) { route = r; render(); }

  function updateChrome() {
    $('#brandMonth').textContent = Store.monthName(UI.period);
    const nav = $('#monthNav');
    if (nav) nav.classList.toggle('off-month', !UI.isCurrentPeriod());
    const n = Store.alerts().length;
    const badge = $('#bellBadge');
    badge.hidden = n === 0; badge.textContent = n;
  }

  /* ---------- FAB contextual ---------- */
  function fab() {
    switch (route) {
      case 'ingresos': return UI.incomeForm();
      case 'gastos': return UI.gastosTab === 'variables' ? UI.variableForm() : UI.fixedForm();
      case 'mercado': return UI.marketForm();
      case 'sobres': return UI.envelopeForm();
      case 'stats': return UI.settingsSheet();
      default: return UI.fixedForm();
    }
  }

  /* ---------- acciones (delegación global) ---------- */
  const ACTIONS = {
    'add-income': () => UI.incomeForm(),
    'add-fixed': () => UI.fixedForm(),
    'add-market': () => UI.marketForm(),
    'add-variable': () => UI.variableForm(),
    'add-saving': () => UI.savingForm(),
    'edit-income': el => UI.incomeForm(Store.state.incomes.find(x => x.id === el.dataset.id)),
    'edit-fixed': el => UI.fixedForm(Store.state.fixed.find(x => x.id === el.dataset.id)),
    'edit-variable': el => UI.variableForm(Store.state.variable.find(x => x.id === el.dataset.id)),
    'edit-market': el => UI.marketForm(Store.state.market.find(x => x.id === el.dataset.id)),
    'add-fixed-market': () => UI.mercadoFijoForm(),
    'edit-fixed-market': () => UI.mercadoFijoForm(),
    'month-today': () => { UI.period = Store.monthKey(); render(); },
    'del-recurring': el => UI.deleteRecurringSheet(el.dataset.coll, el.dataset.id),
    'del-from-month': el => { Store.endRecurring(el.dataset.coll, el.dataset.id, UI.period); UI.closeSheet(); render(); UI.toast('Quitado desde ' + Store.monthName(UI.period)); },
    'del-forever': el => { Store.remove(el.dataset.coll, el.dataset.id); UI.closeSheet(); render(); UI.toast('Eliminado'); },
    'add-envelope': () => UI.envelopeForm(),
    'open-envelope': el => UI.envelopeDetail(el.dataset.id),
    'edit-envelope': el => UI.envelopeForm(Store.state.envelopes.find(x => x.id === el.dataset.id)),
    'del-envelope': el => { if (confirm('¿Eliminar este sobre?')) { Store.removeEnvelope(el.dataset.id); UI.closeSheet(); render(); UI.toast('Sobre eliminado'); } },
    'add-env-item': el => UI.envItemForm(el.dataset.env),
    'del-env-item': el => { Store.removeEnvItem(el.dataset.env, el.dataset.id); UI.envelopeDetail(el.dataset.env); },
    'enter-local': () => { Store.settings.entered = true; Store.save(); render(); if (!Store.state.incomes.length && !Store.settings.onboarded) UI.onboarding(); },
    'enter-google': async () => {
      UI.toast('Abriendo Google…');
      const enter = () => { Store.settings.entered = true; Store.save(); render(); if (!Store.state.incomes.length && !Store.settings.onboarded) UI.onboarding(); };
      try { await Cloud.connect(true); enter(); UI.toast('Conectado ✓'); }
      catch (e) { console.warn(e); if (Cloud.connected()) { enter(); UI.toast('Entraste, pero el guardado falló: ' + (e.message || '')); } else UI.toast('Google: ' + (e && e.message || 'error')); }
    },
    'cloud-login': async () => { UI.toast('Abriendo Google…'); try { await Cloud.connect(true); render(); UI.settingsSheet(); UI.toast('Conectado ✓'); } catch (e) { console.warn(e); render(); UI.settingsSheet(); UI.toast((Cloud.connected() ? 'Conectado, sync falló: ' : 'Error: ') + (e.message || 'error')); } },
    'cloud-logout': () => { Cloud.disconnect(); UI.settingsSheet(); UI.toast('Sesión cerrada'); },
    'cloud-sync': async () => { UI.toast('Sincronizando…'); try { await Cloud.syncNow(); render(); UI.settingsSheet(); UI.toast('Sincronizado ✓'); } catch (e) { console.warn(e); UI.toast('Error: ' + (e.message || 'sync')); } },
    'add-budget': () => UI.budgetForm(),
    'edit-budget': el => UI.budgetForm(el.dataset.key),
    'del-budget': el => { Store.removeBudget(el.dataset.key); UI.closeSheet(); render(); UI.toast('Presupuesto eliminado'); },
    'open-alerts': () => UI.alertsSheet(),
    'close': () => UI.closeSheet(),
    'paid': el => { Store.togglePaid(el.dataset.id, el.dataset.period); render(); },
    'del': el => { Store.remove(el.dataset.coll, el.dataset.id); render(); UI.toast('Eliminado'); },
    'del-close': el => { Store.remove(el.dataset.coll, el.dataset.id); UI.closeSheet(); render(); UI.toast('Eliminado'); },
    'toggle-notif': async () => {
      if (!(Store.settings.notif && Notif.granted())) {
        const ok = await Notif.request();
        Store.settings.notif = ok; Store.save();
        if (ok) { Notif.schedule(); UI.toast('Notificaciones activadas'); }
        else UI.toast('Permiso denegado por el navegador');
      } else { Store.settings.notif = false; Store.save(); UI.toast('Notificaciones desactivadas'); }
      UI.alertsSheet();
    },
    'export': () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'nova-budget-backup.json'; a.click();
      UI.toast('Copia descargada');
    },
    'import': () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader();
        r.onload = () => { try { Store.importJSON(r.result); UI.closeSheet(); render(); UI.toast('Datos importados'); } catch { UI.toast('Archivo inválido'); } };
        r.readAsText(f); };
      inp.click();
    },
    'seed': () => { Store.seedDemo(); UI.closeSheet(); go('inicio'); UI.toast('Datos de ejemplo cargados'); },
    'reset': () => { if (confirm('¿Borrar TODOS tus datos? Esto no se puede deshacer.')) { Store.reset(); UI.closeSheet(); go('inicio'); UI.toast('Todo borrado'); } },
    'onboard-demo': () => { Store.seedDemo(); UI.closeSheet(); go('inicio'); },
  };

  /* ---------- formularios ---------- */
  const FORMS = {
    income: (d, id) => {
      const mag = Math.abs(+d.amount || 0);
      const amount = d.sign === 'deduccion' ? -mag : mag;
      const obj = { name: d.name || 'Movimiento', amount, type: d.type, day: +d.day || null, active: true };
      if (!id) obj.since = UI.period;                 // vigente desde el mes en que se crea
      id ? Store.update('incomes', id, obj) : Store.add('incomes', obj);
    },
    fixed: (d, id) => {
      const obj = { name: d.name || 'Gasto', amount: +d.amount || 0, category: d.category,
        dueDay: Math.max(1, Math.min(31, +d.dueDay || 1)), everyMonths: +d.everyMonths || 1 };
      if (!id) { obj.since = UI.period; if (obj.everyMonths > 1) obj.anchor = UI.period; }
      id ? Store.update('fixed', id, obj) : Store.add('fixed', obj);
    },
    market: (d, id) => { const obj = { category: d.category, item: d.item, qty: +d.qty || null, unit: d.unit || '', amount: +d.amount || 0, date: d.date || Store.dayKey() };
      id ? Store.update('market', id, obj) : Store.add('market', obj); },
    variable: (d, id) => { const obj = { category: d.category, description: d.description, amount: +d.amount || 0, date: d.date || Store.dayKey() };
      id ? Store.update('variable', id, obj) : Store.add('variable', obj); },
    envelope: (d, id) => { const obj = { name: d.name || 'Sobre', total: +d.total || 0, emoji: d.emoji || '🎯' }; const e = id ? Store.updateEnvelope(id, obj) : Store.addEnvelope(obj); return e ? e.id : null; },
    'env-item': d => { if ((+d.amount || 0) !== 0) Store.addEnvItem(d.env, { desc: d.desc, amount: +d.amount || 0 }); },
    budget: d => { if (d.key) Store.setBudget(d.key, +d.amount || 0); },
    saving: d => { const amt = +d.amount || 0; if (amt > 0) Store.state.savingsLog.push({ id: Store.uid(), period: UI.period, amount: amt, date: Store.dayKey() }), Store.save(); },
    settings: d => {
      Object.assign(Store.settings, { currency: d.currency, savingsMode: d.savingsMode,
        savingsValue: +d.savingsValue || 0, alertDays: Math.max(0, +d.alertDays || 0),
        budgetAlertPct: Math.min(100, Math.max(1, +d.budgetAlertPct || 80)) });
      Store.save();
    },
    onboard: d => {
      if (+d.income > 0) Store.add('incomes', { name: 'Ingreso principal', amount: +d.income, type: 'fijo', active: true });
      Object.assign(Store.settings, { currency: d.currency, savingsValue: +d.savingsValue || 20, savingsMode: 'percent', onboarded: true });
      Store.save();
    },
  };

  /* ---------- listeners ---------- */
  document.addEventListener('click', e => {
    const mn = e.target.closest('[data-month]');
    if (mn) { UI.period = Store.shiftPeriod(UI.period, Number(mn.dataset.month)); render(); return; }
    const nav = e.target.closest('[data-route]');
    if (nav) { go(nav.dataset.route); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { UI.gastosTab = tab.dataset.tab; render(); return; }
    const mf = e.target.closest('[data-mfilter]');
    if (mf) { UI.marketFilter = mf.dataset.mfilter; render(); return; }
    const act = e.target.closest('[data-action]');
    if (act) { e.preventDefault(); const fn = ACTIONS[act.dataset.action]; if (fn) fn(act); return; }
  });

  document.addEventListener('submit', e => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    const id = d.id || null;
    const kind = form.dataset.form;
    const handler = FORMS[kind];
    const result = handler ? handler(d, id) : null;
    UI.closeSheet(); render();
    // volver al detalle del sobre tras editar/agregar
    if (kind === 'env-item' && d.env) UI.envelopeDetail(d.env);
    else if (kind === 'envelope' && result) UI.envelopeDetail(result);
    UI.toast(kind === 'env-item' ? 'Descontado' : 'Guardado');
  });

  $('#fab').addEventListener('click', fab);
  $('#btnBell').addEventListener('click', () => UI.alertsSheet());
  $('#btnSettings').addEventListener('click', () => UI.settingsSheet());
  window.addEventListener('store:changed', updateChrome);

  /* ---------- PWA + arranque ---------- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', ev => {
      if (ev.data && ev.data.type === 'check-alerts') Notif.checkAndNotify();
    });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { updateChrome(); if (Store.settings.notif) Notif.checkAndNotify(); } });
  /* ---------- splash animado (nombre + logo) ---------- */
  (function splash() {
    const el = document.getElementById('splash');
    if (!el) return;
    const done = () => { if (el.classList.contains('hide')) return; el.classList.add('hide'); setTimeout(() => el.remove(), 650); };
    el.addEventListener('click', done);
    setTimeout(done, 2100);
  })();

  render();
  if (!document.body.classList.contains('gate') && !Store.settings.onboarded && Store.state.incomes.length === 0) UI.onboarding();
  if (Store.settings.notif) Notif.schedule();
  if (typeof Cloud !== 'undefined') Cloud.init();
  window.addEventListener('cloud:changed', () => render());
})();
