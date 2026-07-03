/* ===== Nova Budget — sincronización con Google Drive (appDataFolder) =====
   Inicia sesión con Google y guarda los datos en el PROPIO Drive del usuario.
   Sin backend, sin base de datos. Requiere un OAuth Client ID (ver README).
*/
const Cloud = (() => {
  // OAuth Client ID de Google (público, no es secreto)
  const CLIENT_ID = '105955007977-5iivvngbjp0jb7gvf69ts42advseef9l.apps.googleusercontent.com';
  const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email';
  const FILENAME = 'nova-budget-data.json';
  const LS = 'bolsillo.cloud';

  let tokenClient = null;
  let accessToken = null;
  let tokenExp = 0;
  let fileId = null;
  let email = null;
  let pushTimer = null;
  let ready = false;

  const enabled = () => !!CLIENT_ID;
  const connected = () => !!email;

  function loadPref() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } }
  function savePref(p) { localStorage.setItem(LS, JSON.stringify(p)); }
  function emit() { window.dispatchEvent(new CustomEvent('cloud:changed')); }

  // Espera a que cargue Google Identity Services (script externo)
  function waitGIS(ms = 8000) {
    return new Promise((res, rej) => {
      const t0 = Date.now();
      (function check() {
        if (window.google && google.accounts && google.accounts.oauth2) return res();
        if (Date.now() - t0 > ms) return rej(new Error('GIS no cargó'));
        setTimeout(check, 150);
      })();
    });
  }

  async function init() {
    if (!enabled()) return;
    try { await waitGIS(); } catch { return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPES,
      callback: () => {}, // se reemplaza por promesa en getToken()
    });
    ready = true;
    // Reintento silencioso si el usuario ya estaba conectado
    if (loadPref().connected) { connect(false).catch(() => {}); }
  }

  function getToken(interactive) {
    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject(new Error('sin tokenClient'));
      if (accessToken && Date.now() < tokenExp - 60000) return resolve(accessToken);
      tokenClient.callback = resp => {
        if (resp.error) return reject(resp);
        accessToken = resp.access_token;
        tokenExp = Date.now() + (Number(resp.expires_in || 3600) * 1000);
        resolve(accessToken);
      };
      try { tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' }); }
      catch (e) { reject(e); }
    });
  }

  async function api(url, opts = {}) {
    const token = await getToken(false);
    opts.headers = Object.assign({ Authorization: 'Bearer ' + token }, opts.headers || {});
    let r = await fetch(url, opts);
    if (r.status === 401) { // token vencido -> re-auth silencioso y reintenta
      accessToken = null;
      const t2 = await getToken(false);
      opts.headers.Authorization = 'Bearer ' + t2;
      r = await fetch(url, opts);
    }
    return r;
  }

  async function fetchEmail() {
    try {
      const r = await api('https://www.googleapis.com/oauth2/v3/userinfo');
      if (r.ok) { const j = await r.json(); return j.email || null; }
    } catch {}
    return null;
  }

  async function findFile() {
    const q = encodeURIComponent(`name='${FILENAME}'`);
    const r = await api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=${q}`);
    if (!r.ok) throw new Error('list ' + r.status);
    const j = await r.json();
    return (j.files && j.files[0]) || null;
  }
  async function downloadFile(id) {
    const r = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    if (!r.ok) throw new Error('download ' + r.status);
    return await r.json();
  }
  async function uploadFile(obj) {
    const body = JSON.stringify(obj);
    if (fileId) {
      const r = await api(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      if (!r.ok) throw new Error('update ' + r.status);
      return fileId;
    }
    // crear en appDataFolder (multipart: metadata + contenido)
    const boundary = 'nbudget' + Math.random().toString(36).slice(2);
    const meta = { name: FILENAME, parents: ['appDataFolder'] };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
    if (!r.ok) throw new Error('create ' + r.status);
    const j = await r.json(); fileId = j.id; return fileId;
  }

  // Conecta: obtiene token, email y sincroniza (pull/push según fecha)
  async function connect(interactive = true) {
    if (!enabled()) throw new Error('Google no configurado');
    if (!ready) await init();
    await getToken(interactive);
    email = await fetchEmail();
    savePref({ connected: true, email });
    await syncNow();
    subscribe();
    emit();
    return email;
  }

  function disconnect() {
    if (accessToken && window.google) { try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch {} }
    accessToken = null; email = null; fileId = null; tokenExp = 0;
    savePref({ connected: false });
    emit();
  }

  // Sincroniza: última escritura gana (por _updatedAt)
  async function syncNow() {
    if (!connected() && !loadPref().connected) return;
    const f = await findFile();
    fileId = f ? f.id : null;
    const localStamp = Number(Store.state._updatedAt || 0);
    if (!f) { await uploadFile(Store.state); savePref(Object.assign(loadPref(), { lastSync: Date.now() })); emit(); return; }
    const remote = await downloadFile(f.id);
    const remoteStamp = Number(remote._updatedAt || 0);
    if (remoteStamp > localStamp) {
      Store.importJSON(JSON.stringify(remote)); // la nube es más nueva -> baja
    } else if (localStamp > remoteStamp) {
      await uploadFile(Store.state);             // lo local es más nuevo -> sube
    }
    savePref(Object.assign(loadPref(), { lastSync: Date.now(), email }));
    emit();
  }

  // Empuja cambios locales (con debounce) mientras esté conectado
  let subscribed = false;
  function subscribe() {
    if (subscribed) return; subscribed = true;
    window.addEventListener('store:changed', () => {
      if (!connected()) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => { uploadFile(Store.state).then(() => { savePref(Object.assign(loadPref(), { lastSync: Date.now() })); emit(); }).catch(() => {}); }, 2500);
    });
  }

  return {
    enabled, connected, init, connect, disconnect, syncNow,
    get email() { return email || loadPref().email || null; },
    get lastSync() { return loadPref().lastSync || null; },
  };
})();
