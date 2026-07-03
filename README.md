# 💰 Nova Budget — Salud financiera para todos

App **web + móvil (PWA instalable)** para llevar tus finanzas personales: gastos fijos y variables,
programación de pagos, **alertas al móvil**, **ahorro obligatorio** cada mes, proyección de ahorro
y **estadísticas** de en qué se te va la plata.

Pensada para ser simple, en español y útil sobre todo para personas de recursos medios y bajos.

---

## ✨ Qué hace

- **Ingresos**: registra tu sueldo y otras fuentes, con día de cobro.
- **Gastos fijos** (tarjetillas por tipo):
  - 🏠 **Arriendo** (valor fijo + día de pago).
  - 🔌 **Servicios**: agua (**cada 2 meses**), luz + aseo, gas… cada uno con su frecuencia y fecha.
  - 📄 Otros fijos (internet, cuotas).
- **Mercado** por tipo de producto: 🥦 verduras, 🍎 frutas, 🥛 lácteos, 🌾 granos, 🥩 carnes, 🧼 aseo, otros.
- **Gastos variables**: transporte, salud, ocio, imprevistos…
- **Ahorro obligatorio**: define un mínimo (% o monto). La app lo aparta **antes** de mostrarte lo disponible
  y **proyecta tu ahorro** a 6 y 12 meses.
- **Alertas y notificaciones** al móvil: "mañana vence la luz", "te falta apartar tu ahorro", "gastas más de lo que ganas".
- **Estadísticas**: % por categoría (dona), ingresos vs gastos por mes (barras), tasa de ahorro y salud financiera (0–100).
- **100% local y privado**: tus datos se guardan solo en tu dispositivo. Exporta/importa copia de seguridad en JSON.
- **Funciona sin internet** (offline) y **se instala como app** en Android.

## 🧱 Tecnología

- HTML + CSS + JavaScript **puro**, **sin dependencias** ni paso de compilación.
- Gráficas en **SVG hechas a mano** (dona, barras, línea, anillos).
- **PWA**: `manifest.webmanifest` + `sw.js` (service worker con caché offline y notificaciones).
- Persistencia con `localStorage`.

## ▶️ Cómo probarla

**Opción rápida (solo ver la interfaz):** abre `index.html` con doble clic en tu navegador.
La app funciona; solo la instalación como app y las notificaciones necesitan un servidor (ver abajo).

**Opción completa (PWA con offline + notificaciones):** sírvela por http. Con Node instalado:

```bash
npx serve .
# o con Python:
python -m http.server 8080
```

Luego abre `http://localhost:8080` (o el puerto que indique) en Chrome/Edge.

## 📱 Instalar en el celular (Android)

1. Publica la carpeta (ver "Publicar gratis").
2. Abre la URL en **Chrome** en el celular.
3. Menú (⋮) → **Agregar a pantalla de inicio / Instalar app**.
4. Ábrela desde el ícono: se ve y funciona como una app nativa (APK-like).
5. En la campana 🔔 → **Activar** notificaciones para recibir avisos de pagos.

## 🌐 Publicar gratis

Cualquiera de estas sirve (son estáticos, sin backend):

- **GitHub Pages**: sube el repo → Settings → Pages → Deploy from branch → `main` / root.
- **Netlify / Vercel / Cloudflare Pages**: arrastra la carpeta o conecta el repo.

## 🗺️ Roadmap (Fase 2)

- Cuentas de usuario + sincronización en la nube (multi-dispositivo).
- **Push reales** aunque la app esté cerrada (servidor + FCM).
- Presupuestos por categoría con tope y bloqueo.
- Metas de ahorro específicas (viaje, emergencia) y recordatorios inteligentes.
- Compartir presupuesto del hogar entre varias personas.

## 📂 Estructura

```
Nova-Budget/
├─ index.html
├─ manifest.webmanifest
├─ sw.js
├─ css/styles.css
├─ js/
│  ├─ store.js         # persistencia + lógica financiera (cálculos, proyección, alertas)
│  ├─ charts.js        # gráficas SVG (dona, barras, línea, anillo)
│  ├─ notifications.js # notificaciones locales
│  ├─ ui.js            # vistas y formularios
│  └─ app.js           # enrutador + eventos + PWA
└─ icons/icon.svg
```

---

Hecho con cariño para ayudar a la gente a organizar su plata y **ahorrar sí o sí** cada mes.
