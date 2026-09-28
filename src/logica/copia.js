// Copia de seguridad: arma el archivo a partir de las colecciones de Firestore.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// La copia guarda los documentos TAL CUAL están en la base (id + datos), sin
// las transformaciones que hace cargarTodo() para mostrarlos en pantalla. Así
// se puede restaurar exactamente lo que había, incluso datos que la app no
// muestra (por ejemplo, restos de un torneo borrado).

// Colecciones que forman la base de la app. Si se agrega una colección nueva,
// hay que sumarla acá o quedará fuera de la copia.
export const COLECCIONES_COPIA = ["torneos", "categorias", "parejas", "partidos", "jugadores", "calendarioClub", "club"];

// colecciones = { torneos: [{id, datos}], ... }
export function armarCopia(colecciones, version, fechaISO) {
  const resumen = {};
  COLECCIONES_COPIA.forEach(c => { resumen[c] = (colecciones[c] || []).length; });
  return { app: "PadelBox", version, fecha: fechaISO, resumen, colecciones };
}

// "2026-09-28T17:06:00.000Z" -> "padelbox-copia-2026-09-28-1706.json" (hora local)
export function nombreArchivoCopia(fecha) {
  const d = new Date(fecha);
  const dos = (n) => String(n).padStart(2, "0");
  return `padelbox-copia-${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}.json`;
}

// Texto corto para confirmar qué se guardó
export function textoResumen(resumen) {
  const r = resumen || {};
  return `${r.torneos || 0} torneos · ${r.categorias || 0} categorías · ${r.parejas || 0} parejas · ${r.partidos || 0} partidos · ${r.jugadores || 0} jugadores`;
}
