// Perfil del jugador para "partidos por nivel": filtro de nivel, franjas
// horarias, vigencia, WhatsApp y reglas para armar un partido de 4.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// Categorías como números, igual que CAT_LABELS: 8 = 8va (principiante) ... 2 = 2da.
// Número más chico = mejor nivel. Una "banda" es {min, max}: {min:5, max:6} = "6ta-5ta".
//
// EN LA BASE (colección "perfiles", un documento por id de jugador):
//   { respuestas: { p1: "c", ..., p9: "b" },   // solo si hizo el filtro
//     lado: "drive" | "reves" | "ambos",
//     genero: "M" | "F",
//     disponibilidad: { modo: "inicio", dias: { "1": [{desde, hasta}], ... } },  // formato de calendario.js
//     venceEl: "2026-11-02" }
// El nivel NO se guarda: se calcula de las respuestas cada vez que se lee
// (calcularNivel). Así nadie puede guardar un nivel inventado, y si cambia la
// tabla de lectura, todos los perfiles se recalculan solos.
// El WhatsApp va aparte, en "contactos" ({ whatsapp: "595981123456" }), que solo lee el admin.

import { normalizarRangos, aMin, sumarDias } from "./calendario.js";

// ================= Filtro de nivel =================

const B = (min, max) => ({ min, max });

// tipo "hecho": se puede comprobar · "control": no suma nivel, solo detecta
// respuestas que no cierran · "situacion": rasgos del Método Sistemático de Categorización.
// EQUIVALENCIA CON EL MANUAL: el manual está una categoría corrido respecto de
// la escala del club (su 7ma, el principiante, es nuestra 8va; su 2da es nuestra
// 3ra). Las bandas de P5 a P9 ya están traducidas a la escala del club; P1 y P4
// se definieron directamente en la escala del club. Las bandas "o más" llegan a 2da.
export const PREGUNTAS = [
  { id: "p1", tipo: "hecho", texto: "¿Jugaste torneos?", opciones: [
    { id: "a", texto: "Nunca", banda: null },
    { id: "b", texto: "Sí, de 8va o 7ma", banda: B(7, 8) },
    { id: "c", texto: "Sí, de 6ta o 5ta", banda: B(5, 6) },
    { id: "d", texto: "Sí, de 4ta o 3ra", banda: B(3, 4) },
    { id: "e", texto: "Sí, de 2da", banda: B(2, 2) },
  ] },
  { id: "p2", tipo: "control", texto: "¿Hace cuánto jugás?", opciones: [
    { id: "a", texto: "Menos de 1 año" },
    { id: "b", texto: "Entre 1 y 3 años" },
    { id: "c", texto: "Entre 3 y 6 años" },
    { id: "d", texto: "Más de 6 años" },
  ] },
  { id: "p3", tipo: "control", texto: "¿Tomás o tomaste clases con profe?", opciones: [
    { id: "a", texto: "Nunca" },
    { id: "b", texto: "Alguna vez" },
    { id: "c", texto: "Sí, de forma regular" },
  ] },
  { id: "p4", tipo: "situacion", texto: "Peloteando con alguien de tu nivel, ¿cuántos golpes seguidos sostenés más o menos?", opciones: [
    { id: "a", texto: "1 a 3", banda: B(8, 8) },
    { id: "b", texto: "4 a 5", banda: B(7, 8) },
    { id: "c", texto: "6 a 10", banda: B(5, 7) },
    { id: "d", texto: "Más de 10", banda: B(2, 5) },
  ] },
  { id: "p5", tipo: "situacion", texto: "En tus smashes y voleas, ¿cada cuántos golpes errás?", opciones: [
    { id: "a", texto: "1 de cada 3 o 4", banda: B(7, 8) },
    { id: "b", texto: "1 de cada 5 o 6", banda: B(5, 7) },
    { id: "c", texto: "1 de cada 7 a 9", banda: B(3, 4) },
    { id: "d", texto: "Casi nunca", banda: B(2, 3) },
  ] },
  { id: "p6", tipo: "situacion", texto: "Te tiran una pelota fuerte para que salga de pared. ¿Qué hacés?", opciones: [
    { id: "a", texto: "La dejo pasar", banda: B(7, 8) },
    { id: "b", texto: "Intento pararla antes", banda: B(6, 6) },
    { id: "c", texto: "La bajo después de la pared", banda: B(5, 7) },
    { id: "d", texto: "Voy a volearla", banda: B(2, 5) },
  ] },
  { id: "p7", tipo: "situacion", texto: "Después de un smash o una volea:", opciones: [
    { id: "a", texto: "Me quedo donde estoy", banda: B(8, 8) },
    { id: "b", texto: "Retrocedo si no me sentí seguro", banda: B(7, 8) },
    { id: "c", texto: "Voy a la red pero llego justo", banda: B(5, 7) },
    { id: "d", texto: "Cierro la red enseguida", banda: B(2, 4) },
  ] },
  { id: "p8", tipo: "situacion", texto: "¿Cuándo empezás a moverte para una pelota?", opciones: [
    { id: "a", texto: "Cuando el rival ya pegó", banda: B(7, 8) },
    { id: "b", texto: "Justo cuando pega", banda: B(6, 7) },
    { id: "c", texto: "Antes, leyendo su postura", banda: B(2, 6) },
  ] },
  { id: "p9", tipo: "situacion", texto: "Te llega una pelota que no controlás del todo:", opciones: [
    { id: "a", texto: "La juego igual para definir", banda: B(6, 7) },
    { id: "b", texto: "La pongo floja y segura", banda: B(5, 5) },
    { id: "c", texto: "Depende del marcador", banda: B(2, 4) },
  ] },
];

const PREGUNTA = Object.fromEntries(PREGUNTAS.map(p => [p.id, p]));
const CAT_MEJOR = 2, CAT_PEOR = 8;

const bandaDe = (pid, oid) => PREGUNTA[pid]?.opciones.find(o => o.id === oid)?.banda || null;

// Distancia en categorías entre dos bandas (0 si se tocan o se pisan)
export const distancia = (a, b) => Math.max(0, a.min - b.max, b.min - a.max);

// La banda donde coinciden más respuestas. Devuelve {min, max}, o
// {dispersas: true} si las más votadas no forman un rango de hasta 2 categorías
// seguidas, o null si no hay ninguna banda.
export function bandaMasVotada(bandas) {
  const lista = bandas.filter(Boolean);
  if (!lista.length) return null;
  const votos = {};
  for (let c = CAT_MEJOR; c <= CAT_PEOR; c++) votos[c] = lista.filter(b => b.min <= c && c <= b.max).length;
  const max = Math.max(...Object.values(votos));
  const ganadoras = Object.keys(votos).map(Number).filter(c => votos[c] === max);
  const min = Math.min(...ganadoras), tope = Math.max(...ganadoras);
  if (tope - min > 1) return { dispersas: true };
  return { min, max: tope };
}

// ¿Están todas las respuestas y son opciones válidas?
export function respuestasCompletas(respuestas) {
  return PREGUNTAS.every(p => p.opciones.some(o => o.id === respuestas?.[p.id]));
}

// Calcula el nivel a partir de las respuestas.
// Devuelve { estado, min, max, motivos }:
//   "asignado"   rango de hasta 2 categorías, listo para armar partidos
//   "pendiente"  el rango toca 3ra o más: lo valida el organizador
//   "revisar"    las respuestas se contradicen: no se asigna nada (min/max null)
//   "incompleto" faltan respuestas
// Reglas, en orden:
//   1. Si P4 es "a" o "b" (sostiene 5 golpes o menos), el rango es el de P4:
//      quien no sostiene un peloteo no puede quedar en 6ta por lo que responda
//      del resto. Si el resto apunta 2 categorías o más arriba, se revisa.
//   2. Si no, P1 (torneos) contra el resto: 2 categorías o más de diferencia, se revisa.
//   3. El rango es la banda más votada. Si las más votadas están desparramadas, se revisa.
//   4. Control: menos de 1 año jugando con un rango de 4ta o mejor, se revisa.
//   5. Rango que toca 3ra o más: pendiente de validación.
export function calcularNivel(respuestas) {
  if (!respuestasCompletas(respuestas)) return { estado: "incompleto", min: null, max: null, motivos: [] };
  const r = respuestas;
  const revisar = (motivo) => ({ estado: "revisar", min: null, max: null, motivos: [motivo] });
  const p1 = bandaDe("p1", r.p1), p4 = bandaDe("p4", r.p4);
  const situaciones = ["p5", "p6", "p7", "p8", "p9"].map(p => bandaDe(p, r[p]));
  let rango;

  if (r.p4 === "a" || r.p4 === "b") {
    const resto = bandaMasVotada([p1, ...situaciones]);
    if (resto && !resto.dispersas && distancia(p4, resto) >= 2)
      return revisar("Dice que sostiene pocos golpes seguidos, pero el resto de sus respuestas es de un nivel más alto.");
    rango = p4;
  } else {
    const resto = bandaMasVotada([p4, ...situaciones]);
    if (p1 && resto && !resto.dispersas && distancia(p1, resto) >= 2)
      return revisar("La categoría de torneos que jugó no coincide con lo que responde de su juego.");
    rango = bandaMasVotada([p1, p4, ...situaciones]);
    if (!rango || rango.dispersas) return revisar("Las respuestas apuntan a niveles muy distintos.");
  }

  if (r.p2 === "a" && rango.min <= 4)
    return revisar("Juega hace menos de 1 año y sus respuestas son de 4ta o mejor.");
  if (rango.min <= 3) return { estado: "pendiente", min: rango.min, max: rango.max, motivos: ["El rango toca 3ra o más: lo valida el organizador."] };
  return { estado: "asignado", min: rango.min, max: rango.max, motivos: [] };
}

// Las categorías con las que el jugador entra al armado de partidos, o null si
// todavía no puede entrar. La categoría oficial (torneos, organizador) manda;
// sin ella, el rango del filtro, solo si quedó "asignado".
export function categoriasParaArmar(categoriaOficial, respuestas) {
  if (categoriaOficial) return { min: categoriaOficial, max: categoriaOficial };
  const nivel = calcularNivel(respuestas);
  return nivel.estado === "asignado" ? { min: nivel.min, max: nivel.max } : null;
}

// Aviso para el organizador cuando alguien con categoría oficial repite el
// filtro y le da otra cosa (por ejemplo, un 5ta que puede estar listo para subir).
// Devuelve null si coincide, si no hay nivel o si no hay categoría oficial.
export function difiereDeOficial(categoriaOficial, respuestas) {
  if (!categoriaOficial) return null;
  const nivel = calcularNivel(respuestas);
  if (nivel.min == null) return null;
  if (categoriaOficial >= nivel.min && categoriaOficial <= nivel.max) return null;
  return nivel.max < categoriaOficial ? "arriba" : "abajo";
}

// ================= Disponibilidad por franjas =================
// El jugador toca franjas por día. Una franja dice a qué hora puede EMPEZAR el
// partido, aunque termine después: "tarde" (13 a 18) = puede arrancar desde las
// 13:00 hasta las 17:30, y el partido termina cuando termine. Se guardan como
// rangos en el formato de calendario.js con modo "inicio", así el armado usa
// parejaPuedeEnDia y compatibilidadSemanal sin traducir nada. Las franjas se
// tocan entre sí, así que dos seguidas quedan unidas en un solo rango.

export const FRANJAS = [
  { id: "manana", texto: "Mañana", desde: "07:00", hasta: "13:00" },
  { id: "tarde", texto: "Tarde", desde: "13:00", hasta: "18:00" },
  { id: "noche", texto: "Noche", desde: "18:00", hasta: "24:00" },
];
const FRANJA = Object.fromEntries(FRANJAS.map(f => [f.id, f]));
const DIAS_VALIDOS = ["0", "1", "2", "3", "4", "5", "6"];

// seleccion = { "1": ["manana", "noche"], "6": ["tarde"], ... } (días como en JavaScript: "0" domingo)
export function franjasADisponibilidad(seleccion) {
  const dias = {};
  Object.entries(seleccion || {}).forEach(([d, ids]) => {
    if (!DIAS_VALIDOS.includes(d)) return;
    const rangos = normalizarRangos((ids || []).filter(id => FRANJA[id]).map(id => ({ desde: FRANJA[id].desde, hasta: FRANJA[id].hasta })));
    if (rangos.length) dias[d] = rangos;
  });
  return { modo: "inicio", dias };
}

// Al revés, para mostrar lo guardado: una franja está marcada si entra entera
// en alguno de los rangos de ese día.
export function disponibilidadAFranjas(disp) {
  const out = {};
  Object.entries(disp?.dias || {}).forEach(([d, rangos]) => {
    const ids = FRANJAS.filter(f => (rangos || []).some(r => aMin(r.desde) <= aMin(f.desde) && aMin(r.hasta) >= aMin(f.hasta))).map(f => f.id);
    if (ids.length) out[d] = ids;
  });
  return out;
}

export const tieneDisponibilidad = (disp) => Object.keys(disp?.dias || {}).length > 0;

// ================= Vigencia =================
// La disponibilidad vence: si el jugador no la reconfirma, no se le sugieren partidos.

export const VIGENCIA_DIAS = 28;
export const nuevaVigencia = (hoyISO) => sumarDias(hoyISO, VIGENCIA_DIAS);
export const estaVigente = (perfil, hoyISO) => !!perfil?.venceEl && perfil.venceEl >= hoyISO;

// ================= WhatsApp =================
// Se guarda solo con números y código de país. Un número paraguayo escrito
// como "0981 123 456" o "981123456" queda "595981123456".
export function normalizarWhatsapp(texto) {
  let d = String(texto || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "595" + d.slice(1);
  else if (d.length === 9 && d.startsWith("9")) d = "595" + d;
  return /^[0-9]{8,15}$/.test(d) ? d : null;
}

// ================= Validación antes de guardar =================
// Repite lo que exigen las reglas de Firestore, para avisar en pantalla en vez
// de que la base rechace el guardado. Devuelve la lista de problemas (vacía = ok).
export const LADOS = ["drive", "reves", "ambos"];
export const GENEROS = ["M", "F"];

export function validarPerfil(perfil) {
  const errores = [];
  if (!LADOS.includes(perfil?.lado)) errores.push("Elegí de qué lado jugás.");
  if (!GENEROS.includes(perfil?.genero)) errores.push("Elegí Caballeros o Damas.");
  const disp = perfil?.disponibilidad;
  if (!disp || disp.modo !== "inicio" || !tieneDisponibilidad(disp)) errores.push("Marcá al menos un día y una franja.");
  else if (Object.keys(disp.dias).some(d => !DIAS_VALIDOS.includes(d))) errores.push("La disponibilidad tiene un día inválido.");
  if (perfil?.respuestas !== undefined && !respuestasCompletas(perfil.respuestas)) errores.push("Faltan respuestas del filtro.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(perfil?.venceEl || "")) errores.push("Falta la fecha de vigencia.");
  return errores;
}

// ================= Reglas de armado de un partido =================
// jugadores = 4 objetos { min, max, genero, lado } (min/max de categoriasParaArmar).
// Devuelve { ok: true } o { ok: false, motivo }.
export function grupoValido(jugadores) {
  if (!Array.isArray(jugadores) || jugadores.length !== 4) return { ok: false, motivo: "Un partido necesita 4 jugadores." };
  if (jugadores.some(j => j.min == null || j.max == null)) return { ok: false, motivo: "Hay un jugador sin nivel asignado." };
  if (jugadores.some(j => !LADOS.includes(j.lado))) return { ok: false, motivo: "Hay un jugador sin lado de cancha." };
  const generos = new Set(jugadores.map(j => j.genero));
  if (generos.size !== 1 || !GENEROS.includes([...generos][0])) return { ok: false, motivo: "Los 4 tienen que ser del mismo género." };
  const mejor = Math.min(...jugadores.map(j => j.min)), peor = Math.max(...jugadores.map(j => j.max));
  if (peor - mejor > 1) return { ok: false, motivo: "Hay más de dos categorías seguidas entre los 4." };
  const soloDrive = jugadores.filter(j => j.lado === "drive").length;
  const soloReves = jugadores.filter(j => j.lado === "reves").length;
  if (soloDrive > 2 || soloReves > 2) return { ok: false, motivo: "No se pueden armar dos parejas con un drive y un revés cada una." };
  return { ok: true };
}
