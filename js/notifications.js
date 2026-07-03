/* ===== Nova Budget — notificaciones locales ===== */
const Notif = (() => {
  const LASTKEY = 'bolsillo.notif.last';

  const supported = () => 'Notification' in window;
  const granted = () => supported() && Notification.permission === 'granted';

  async function request() {
    if (!supported()) return false;
    if (Notification.permission === 'granted') return true;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }

  function show(title, body, tag) {
    if (!granted()) return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, {
          body, tag, icon: 'icons/icon.svg', badge: 'icons/icon.svg', renotify: false,
        })).catch(() => new Notification(title, { body, tag }));
      } else {
        new Notification(title, { body, tag });
      }
    } catch (e) { /* silencioso */ }
  }

  const WEEKKEY = 'bolsillo.notif.week';
  // Resumen semanal: una vez por semana (al abrir la app en una semana nueva)
  function maybeWeeklySummary() {
    if (!granted() || !Store.settings.notif) return;
    const wk = Store.weekKey();
    if (localStorage.getItem(WEEKKEY) === wk) return;
    show('Nova Budget · Resumen de la semana', Store.weeklySummaryText(), 'weekly');
    localStorage.setItem(WEEKKEY, wk);
  }

  // Revisa alertas y dispara notificaciones no repetidas hoy
  function checkAndNotify() {
    if (!granted() || !Store.settings.notif) return;
    maybeWeeklySummary();
    const today = Store.dayKey();
    let last = {};
    try { last = JSON.parse(localStorage.getItem(LASTKEY) || '{}'); } catch {}
    const alerts = Store.alerts();
    let fired = 0;
    alerts.forEach(a => {
      const key = a.type + ':' + (a.ref ? a.ref.ref.id + a.ref.period : a.title);
      if (last[key] === today) return;         // ya avisado hoy
      show('Nova Budget · ' + a.title, a.msg, key);
      last[key] = today; fired++;
    });
    localStorage.setItem(LASTKEY, JSON.stringify(last));
    return fired;
  }

  // Programa un chequeo periódico mientras la app está abierta,
  // y registra periodic-sync si el navegador lo soporta.
  function schedule() {
    checkAndNotify();
    setInterval(checkAndNotify, 60 * 60 * 1000); // cada hora si sigue abierta
    if ('serviceWorker' in navigator && 'periodicSync' in (navigator.serviceWorker.controller || {})) { /* noop */ }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async reg => {
        if ('periodicSync' in reg) {
          try {
            const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
            if (status.state === 'granted') {
              await reg.periodicSync.register('bolsillo-check', { minInterval: 12 * 60 * 60 * 1000 });
            }
          } catch { /* no soportado */ }
        }
      }).catch(() => {});
    }
  }

  return { supported, granted, request, show, checkAndNotify, schedule };
})();
