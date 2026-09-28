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

// ===== Restauración =====
// Restaurar = dejar la base IGUAL a la copia: lo que está en la copia se
// escribe, y lo que está en la base pero no en la copia se borra.
// Solo se tocan los documentos que difieren, así que restaurar dos veces la
// misma copia es seguro (la segunda vez no hay nada que hacer). Eso también
// permite reintentar si una restauración se corta a la mitad.

// Texto estable de un objeto (claves ordenadas) para comparar contenidos
function estable(v) {
  if (Array.isArray(v)) return "[" + v.map(estable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + estable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

// Revisa que el archivo sea una copia de PadelBox bien formada.
// Devuelve { ok: true } o { ok: false, error: "texto para mostrar" }
export function validarCopia(copia) {
  if (!copia || typeof copia !== "object") return { ok: false, error: "El archivo no tiene el formato de una copia." };
  if (copia.app !== "PadelBox") return { ok: false, error: "El archivo no es una copia de PadelBox." };
  const cols = copia.colecciones;
  if (!cols || typeof cols !== "object") return { ok: false, error: "La copia no tiene colecciones." };
  for (const c of COLECCIONES_COPIA) {
    if (!Array.isArray(cols[c])) return { ok: false, error: `A la copia le falta la colección "${c}". No se restaura una copia incompleta.` };
    const ids = new Set();
    for (const d of cols[c]) {
      if (!d || typeof d.id !== "string" || !d.id || !d.datos || typeof d.datos !== "object" || Array.isArray(d.datos)) return { ok: false, error: `Hay un documento mal formado en "${c}".` };
      if (ids.has(d.id)) return { ok: false, error: `Hay un documento repetido en "${c}" (${d.id}).` };
      ids.add(d.id);
    }
  }
  return { ok: true };
}

// Qué operaciones hacen falta para que "actual" quede igual a "copia".
// actual y copia: { torneos: [{id, datos}], ... }
// Devuelve [{ tipo: "set" | "delete", col, id, datos? }]
export function planRestauracion(actual, copia) {
  const ops = [];
  COLECCIONES_COPIA.forEach(c => {
    const enBase = new Map((actual[c] || []).map(d => [d.id, estable(d.datos)]));
    const enCopia = new Map((copia[c] || []).map(d => [d.id, d]));
    enCopia.forEach((d, id) => { if (enBase.get(id) !== estable(d.datos)) ops.push({ tipo: "set", col: c, id, datos: d.datos }); });
    enBase.forEach((_, id) => { if (!enCopia.has(id)) ops.push({ tipo: "delete", col: c, id }); });
  });
  return ops;
}

// Resumen del plan para mostrar antes de confirmar.
// Por colección: cuántos documentos vuelven (no están en la base), cuántos
// cambian y cuántos desaparecen. Además, los nombres de los torneos afectados.
export function resumirPlan(ops, actual) {
  const porCol = {};
  const idsBase = {};
  COLECCIONES_COPIA.forEach(c => { porCol[c] = { vuelven: 0, cambian: 0, desaparecen: 0 }; idsBase[c] = new Set((actual[c] || []).map(d => d.id)); });
  const nombreBase = Object.fromEntries((actual.torneos || []).map(d => [d.id, d.datos.nombre || d.id]));
  const torneos = { vuelven: [], cambian: [], desaparecen: [] };
  ops.forEach(op => {
    const r = porCol[op.col];
    if (op.tipo === "delete") r.desaparecen++;
    else if (idsBase[op.col].has(op.id)) r.cambian++;
    else r.vuelven++;
    if (op.col === "torneos") {
      if (op.tipo === "delete") torneos.desaparecen.push(nombreBase[op.id] || op.id);
      else if (idsBase.torneos.has(op.id)) torneos.cambian.push(op.datos.nombre || op.id);
      else torneos.vuelven.push(op.datos.nombre || op.id);
    }
  });
  return { total: ops.length, porCol, torneos };
}

// Parte las operaciones en lotes que Firestore acepta de una vez
// (máximo 500 operaciones y ~10 MB por lote; se deja margen).
export function armarLotes(ops, maxOps = 400, maxBytes = 8 * 1024 * 1024) {
  const lotes = [];
  let actual = [], bytes = 0;
  ops.forEach(op => {
    const tam = op.tipo === "set" ? JSON.stringify(op.datos).length + 200 : 200;
    if (actual.length && (actual.length >= maxOps || bytes + tam > maxBytes)) { lotes.push(actual); actual = []; bytes = 0; }
    actual.push(op); bytes += tam;
  });
  if (actual.length) lotes.push(actual);
  return lotes;
}

// "padelbox-antes-de-restaurar-2026-09-28-1706.json"
export function nombreArchivoPrevio(fecha) {
  return nombreArchivoCopia(fecha).replace("padelbox-copia-", "padelbox-antes-de-restaurar-");
}
