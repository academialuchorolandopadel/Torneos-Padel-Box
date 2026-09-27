// Armado del torneo largo: ubica cada partido en el calendario del club.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// Reglas de un horario válido (las mismas para el armado automático y para
// avisarte cuando movés un partido a mano):
//   1. la cancha está libre en el calendario del club y no hay otro partido
//   2. las dos parejas pueden jugar en ese horario (su disponibilidad semanal)
//   3. ninguna de las dos parejas juega otro partido ese día
//   4. ninguna pasa el máximo de partidos por semana (lunes a domingo)
//   5. ningún jugador está en otro partido a la misma hora (por ejemplo, si juega dos categorías)
//   6. en zonas de 4, los partidos C y D van después de A y B
//   7. al menos 24 horas de anticipación (para que las parejas se organicen)
//   8. en la llave, cada cruce va después de los partidos anteriores de sus dos parejas
//
// Encastre: un partido nunca va en el medio de un rango libre, siempre pegado
// a un borde (al principio o al final). Entre las opciones válidas se prefiere
// la que no deja restos que el club no pueda alquilar (menos de 60 minutos).
// Encastrar no atrasa: primero se busca en la semana 1 del torneo; recién si
// no hay lugar, en la siguiente.
import { COURTS } from "./constantes.js";
import { aMin, aHora, normalizarRangos, parejaPuede, diaDeSemana, sumarDias, lunesDeSemana, NOMBRES_DIA,
  DURACION_PARTIDO, MAX_PARTIDOS_SEMANA, ANTICIPACION_MIN_HORAS } from "./calendario.js";

export const MIN_ALQUILABLE = 60;     // turno más corto que alquila el club
export const SEMANAS_HORIZONTE = 8;   // hasta dónde busca lugar el armado automático

// ---- Presentación y orden ----
// "Mar 14/10": la usan las pantallas que ya muestran día y hora de un partido
export function etiquetaFecha(iso) {
  const [, m, d] = iso.split("-");
  return `${NOMBRES_DIA[diaDeSemana(iso)].slice(0, 3)} ${Number(d)}/${Number(m)}`;
}
// Minutos desde 1970 hasta ese día y hora: sirve para ordenar partidos en el tiempo
export function minutosAbsolutos(iso, hora) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) * 1440 + aMin(hora);
}
export const tieneHorario = (m) => !!(m && m.fecha && m.hora && m.cancha);

// Datos de horario de un partido ubicado
export function conHorario(partido, fecha, hora, cancha, duracion = DURACION_PARTIDO) {
  return { ...partido, fecha, hora, horaFin: aHora(aMin(hora) + duracion), cancha,
    dia: etiquetaFecha(fecha), mins: minutosAbsolutos(fecha, hora) };
}
export function sinHorario(partido) {
  return { ...partido, fecha: null, hora: null, horaFin: null, cancha: null, dia: null, mins: null };
}

// ---- Rangos libres ----
// Resta un intervalo [a, b) a una lista de rangos en minutos
function restar(rangos, a, b) {
  const out = [];
  for (const [x, y] of rangos) {
    if (b <= x || a >= y) { out.push([x, y]); continue; }
    if (a > x) out.push([x, a]);
    if (b < y) out.push([b, y]);
  }
  return out;
}

// Rangos libres (en minutos) de una cancha en una fecha: lo cargado en el
// calendario del club menos los partidos que ya ocupan esa cancha.
export function libresDeCancha(calendarioClub, fecha, cancha, ocupados, excluirId = null) {
  let libres = normalizarRangos(calendarioClub?.[fecha]?.canchas?.[cancha] || []).map(r => [aMin(r.desde), aMin(r.hasta)]);
  for (const o of ocupados) {
    if (o.id === excluirId || o.fecha !== fecha || o.cancha !== cancha) continue;
    libres = restar(libres, aMin(o.hora), aMin(o.horaFin));
  }
  return libres;
}

// ---- Reglas ----
// Contexto: { calendarioClub, ocupados, parejas (id -> pareja), duracion, maxSemana }
// ocupados: partidos con horario, cada uno con { id, fecha, hora, horaFin, cancha, p1id, p2id, ... }
const cedulasDe = (pareja) => [pareja?.j1cedula, pareja?.j2cedula].filter(Boolean);
const nombreDe = (parejas, id) => parejas[id]?.nombre || "Una pareja";

// Devuelve la lista de problemas del horario (vacía = el horario cumple todas las reglas)
export function problemasDelHorario(partido, fecha, hora, cancha, ctx) {
  const dur = ctx.duracion || DURACION_PARTIDO, maxSemana = ctx.maxSemana || MAX_PARTIDOS_SEMANA;
  const a = aMin(hora), b = a + dur, horaFin = aHora(b);
  const otros = ctx.ocupados.filter(o => o.id !== partido.id);
  const problemas = [];
  // 1. Cancha
  const enCalendario = normalizarRangos(ctx.calendarioClub?.[fecha]?.canchas?.[cancha] || [])
    .some(r => aMin(r.desde) <= a && aMin(r.hasta) >= b);
  if (!enCalendario) problemas.push(`${cancha} no está libre en el calendario del club en ese horario`);
  otros.filter(o => o.fecha === fecha && o.cancha === cancha && aMin(o.hora) < b && aMin(o.horaFin) > a)
    .forEach(o => problemas.push(`Se superpone con el partido ${o.code || ""} en ${cancha}`.replace("  ", " ")));
  for (const pid of [partido.p1id, partido.p2id]) {
    if (!pid) continue;
    const pareja = ctx.parejas[pid], nombre = nombreDe(ctx.parejas, pid);
    // 2. Disponibilidad
    if (!parejaPuede(pareja?.disponibilidad, fecha, hora, horaFin)) problemas.push(`${nombre} no puede en ese horario`);
    // 3. Mismo día
    if (otros.some(o => o.fecha === fecha && (o.p1id === pid || o.p2id === pid))) problemas.push(`${nombre} ya juega otro partido ese día`);
    // 4. Máximo semanal
    const lunes = lunesDeSemana(fecha);
    const enSemana = otros.filter(o => (o.p1id === pid || o.p2id === pid) && lunesDeSemana(o.fecha) === lunes).length;
    if (enSemana >= maxSemana) problemas.push(`${nombre} ya tiene ${enSemana} partido${enSemana === 1 ? "" : "s"} esa semana (máximo ${maxSemana})`);
  }
  // 5. Jugadores en dos partidos a la vez
  const mias = new Set([partido.p1id, partido.p2id].flatMap(pid => cedulasDe(ctx.parejas[pid])));
  const mismasParejas = (o) => [o.p1id, o.p2id].some(x => x && (x === partido.p1id || x === partido.p2id));
  otros.filter(o => o.fecha === fecha && aMin(o.hora) < b && aMin(o.horaFin) > a && !mismasParejas(o))
    .forEach(o => {
      const suyas = [o.p1id, o.p2id].flatMap(pid => cedulasDe(ctx.parejas[pid]));
      if (suyas.some(c => mias.has(c))) problemas.push(`Un jugador tiene otro partido a esa hora (${o.code || "otra categoría"})`);
    });
  // 6. Zona de 4: C y D después de A y B
  if (partido.zona4 && (partido.zona4Tipo === "C" || partido.zona4Tipo === "D")) {
    const previos = otros.filter(o => o.zona4GrupoId === partido.zona4GrupoId && (o.zona4Tipo === "A" || o.zona4Tipo === "B"));
    const ultima = previos.map(o => o.fecha).sort().pop();
    if (ultima && fecha <= ultima) problemas.push("Tiene que jugarse después de los partidos A y B de la zona");
  }
  // 7. Anticipación mínima (solo si el contexto trae la hora actual)
  if (ctx.ahoraMins != null && minutosAbsolutos(fecha, hora) < ctx.ahoraMins + ANTICIPACION_MIN_HORAS * 60)
    problemas.push(`Faltan menos de ${ANTICIPACION_MIN_HORAS} horas para ese horario`);
  // 8. Llave: después de los partidos anteriores de sus parejas
  const limite = ctx.limites?.[partido.id];
  if (limite && fecha < limite) problemas.push(`Tiene que jugarse después de los partidos anteriores de sus parejas (desde el ${etiquetaFecha(limite)})`);
  return problemas;
}

// Minutos que quedarían sueltos (menos de lo que alquila el club) al poner
// un partido en [s, s+dur) dentro del rango libre [a, b)
function minutosMuertos(a, b, s, dur) {
  return [s - a, b - (s + dur)].filter(x => x > 0 && x < MIN_ALQUILABLE).reduce((n, x) => n + x, 0);
}

// Opciones válidas para un partido en un conjunto de fechas, solo en los bordes de los rangos libres
function opciones(partido, fechas, ctx) {
  const dur = ctx.duracion || DURACION_PARTIDO;
  const out = [];
  for (const fecha of fechas) {
    if (!ctx.calendarioClub?.[fecha]) continue;
    COURTS.forEach((cancha, iCancha) => {
      for (const [a, b] of libresDeCancha(ctx.calendarioClub, fecha, cancha, ctx.ocupados, partido.id)) {
        if (b - a < dur) continue;
        for (const s of [...new Set([a, b - dur])]) {
          const hora = aHora(s);
          if (problemasDelHorario(partido, fecha, hora, cancha, ctx).length) continue;
          out.push({ fecha, hora, cancha, muertos: minutosMuertos(a, b, s, dur), iCancha, s });
        }
      }
    });
  }
  return out;
}
// Mejor opción: menos minutos sueltos; a igualdad, la más temprana
const mejor = (ops) => ops.slice().sort((x, y) =>
  x.muertos - y.muertos || (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0) || x.s - y.s || x.iCancha - y.iCancha)[0];

// ---- Armado automático ----
// pendientes: partidos a ubicar (se devuelven en el mismo orden, con horario o marcados sin lugar)
// fijos: partidos que ya ocupan lugar (jugados, fijados a mano, de otras categorías o torneos largos)
// inicioTorneo: fecha de inicio (la semana 1 del torneo); hoy: nunca se programa antes de hoy
export function programarLargo({ pendientes, fijos, parejas, calendarioClub, inicioTorneo, hoy,
  duracion = DURACION_PARTIDO, maxSemana = MAX_PARTIDOS_SEMANA, ahoraMins = null, limites = {} }) {
  const inicio = inicioTorneo || hoy;
  const desde = inicio > hoy ? inicio : hoy;
  const finSemana1 = sumarDias(inicio, 6);
  const ctx = { calendarioClub, parejas, duracion, maxSemana, ahoraMins, limites, ocupados: fijos.filter(tieneHorario) };
  const bloques = Array.from({ length: SEMANAS_HORIZONTE }, (_, k) => Array.from({ length: 7 }, (_, i) => sumarDias(desde, 7 * k + i)));

  // Los que tienen rivales definidos se ubican; los C y D sin rivales esperan
  const listos = pendientes.filter(m => m.p1id && m.p2id);
  // Primero los más difíciles: los que tienen menos opciones en la primera semana
  const dificultad = new Map(listos.map(m => [m.id, opciones(m, bloques[0], ctx).length]));
  const orden = listos.map((m, i) => ({ m, i })).sort((x, y) => dificultad.get(x.m.id) - dificultad.get(y.m.id) || x.i - y.i).map(x => x.m);

  const resultado = new Map();
  for (const m of orden) {
    let elegido = null;
    for (const bloque of bloques) { const op = mejor(opciones(m, bloque, ctx)); if (op) { elegido = op; break; } }
    if (!elegido) { resultado.set(m.id, { ...sinHorario(m), sinLugar: true, fueraDeVentana: false }); continue; }
    const ubicado = { ...conHorario(m, elegido.fecha, elegido.hora, elegido.cancha, duracion), sinLugar: false, fueraDeVentana: elegido.fecha > finSemana1 };
    resultado.set(m.id, ubicado);
    ctx.ocupados.push(ubicado);
  }
  return pendientes.map(m => resultado.get(m.id) || { ...sinHorario(m), sinLugar: false, fueraDeVentana: false });
}

// ---- Qué partidos se programan ----
const esDeLlaveListo = (m) => !m.auto && m.p1id && m.p2id && !m.p1provisorio && !m.p2provisorio;
const conRivales = (m) => !!(m.p1id && m.p2id);
// Partidos de llave con sus dos parejas definidas (no provisorias)
export const llaveLista = (rondas) => (rondas || []).flat().filter(esDeLlaveListo);

// Fecha mínima de cada cruce de llave: el día siguiente al último partido
// (de zona o de llave) que jugó cualquiera de sus dos parejas.
export function limitesLlave(partidosZona, rondas) {
  const todos = [...(partidosZona || []), ...(rondas || []).flat()];
  const limites = {};
  for (const m of llaveLista(rondas)) {
    const previas = todos.filter(o => o.id !== m.id && o.fecha && (o.round == null || o.round < m.round) &&
      [o.p1id, o.p2id].some(x => x === m.p1id || x === m.p2id));
    const ultima = previas.map(o => o.fecha).sort().pop();
    if (ultima) limites[m.id] = sumarDias(ultima, 1);
  }
  return limites;
}

// Listos para programar automáticamente: con rivales, sin horario, sin jugar y no fijados
export function listosSinHorario(partidosZona, rondas) {
  const ok = (m) => !m.fecha && !m.done && !m.fijado;
  return [...(partidosZona || []).filter(m => conRivales(m) && ok(m)), ...llaveLista(rondas).filter(ok)];
}

// Para "Re-proponer": todo lo no jugado ni fijado, salvo lo que ya se juega
// dentro de las próximas 24 horas (a esas parejas ya se les avisó).
export function pendientesReproponer(partidosZona, rondas, ahoraMins) {
  const cerca = (m) => m.fecha && m.hora && ahoraMins != null && minutosAbsolutos(m.fecha, m.hora) < ahoraMins + ANTICIPACION_MIN_HORAS * 60;
  const ok = (m) => !m.done && !m.fijado && !cerca(m);
  return [...(partidosZona || []).filter(m => conRivales(m) && ok(m)), ...llaveLista(rondas).filter(ok)];
}
