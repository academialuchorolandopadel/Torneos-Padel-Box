// Instalar la app en el teléfono (PWA).
// - Android/Chrome avisa que la app se puede instalar con el evento
//   "beforeinstallprompt". Hay que guardarlo apenas llega (por eso este archivo
//   se importa primero en main.jsx) y usarlo cuando la persona toca el botón.
// - iPhone no tiene ese aviso: la única forma es Compartir -> "Agregar a inicio".
//   La página muestra esos pasos.
let aviso = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach(f => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); aviso = e; avisar(); });
  window.addEventListener("appinstalled", () => { aviso = null; avisar(); });
}

export function plataforma() {
  const ua = navigator.userAgent || "";
  const ipadNuevo = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || ipadNuevo) return "ios";
  if (/Android/.test(ua)) return "android";
  return "otra";
}

// Abierta como app instalada (no en el navegador)
export const yaInstalada = () =>
  (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

export const puedeInstalarDirecto = () => !!aviso;

// Muestra el cartel de instalación de Chrome. Devuelve true si aceptaron.
export async function pedirInstalacion() {
  if (!aviso) return false;
  const e = aviso;
  aviso = null;
  e.prompt();
  const r = await e.userChoice;
  avisar();
  return r && r.outcome === "accepted";
}

// Para que la pantalla se entere cuando cambia (llegó el aviso, se instaló)
export function alCambiarInstalacion(f) { oyentes.add(f); return () => oyentes.delete(f); }
