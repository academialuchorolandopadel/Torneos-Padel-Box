// Página pública del torneo: reglas y textos.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.

import { conDefectoFicha } from "./club.js";

// Link que se comparte: la misma app con ?t=<id del torneo>.
// Se usa ?t= y no /torneo/<id> porque GitHub Pages no sabe redirigir
// rutas inventadas: daría error 404.
export function linkPublico(base, torneoId) {
  const b = (base || "").split("?")[0].split("#")[0];
  return `${b}?t=${encodeURIComponent(torneoId)}`;
}

// Número de WhatsApp en el formato que pide wa.me: solo dígitos, con código
// de país. Si no tiene código, se asume Paraguay (595).
//   "0981 123 456" -> "595981123456"   "+595 981..." -> "595981..."
//   "981123456"    -> "595981123456"   "" o basura  -> ""
export function numeroWhatsApp(texto) {
  let d = String(texto || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("595")) return d.length >= 11 ? d : "";
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 9 && d.startsWith("9")) return "595" + d;
  return d.length >= 11 ? d : ""; // otro país con su código completo
}

export const linkWhatsApp = (numero, texto) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

// Estado de inscripción de una categoría para mostrar en la página
// cat: { nombre, modalidad, fixtureGenerado, parejas: [{j1nombre, j2nombre, nombre}], jugadoresAmericano: [{nombre}] }
export function estadoCategoria(cat, ficha, hoyISO) {
  const f = conDefectoFicha(ficha);
  const individual = cat.modalidad === "americano_individual";
  const nombres = individual
    ? (cat.jugadoresAmericano || []).map(j => j.nombre).filter(Boolean)
    : (cat.parejas || []).map(p => (p.j1nombre && p.j2nombre) ? `${p.j1nombre} / ${p.j2nombre}` : (p.nombre || "")).filter(Boolean);
  const inscriptos = nombres.length;
  // El cupo de la ficha es en parejas: en el americano individual no aplica
  const cupo = !individual && Number(f.cupo) > 0 ? Number(f.cupo) : null;
  const quedan = cupo === null ? null : Math.max(0, cupo - inscriptos);
  let cerrada = null;
  if (cat.fixtureGenerado) cerrada = "Inscripción cerrada: el fixture ya está armado.";
  else if (f.fechaLimite && hoyISO > f.fechaLimite) cerrada = "Inscripción cerrada.";
  return { individual, nombres, inscriptos, cupo, quedan, completo: quedan === 0, cerrada };
}

// Mensaje de WhatsApp que manda el jugador. Los datos los completa en la página,
// así llegan siempre los mismos campos y en el mismo orden.
export function mensajeInscripcion({ torneo, categoria, jugador1, jugador2, telefono, individual, espera }) {
  const lineas = [
    espera
      ? `¡Hola! Quiero anotarme en lista de espera del torneo *${torneo}*, categoría *${categoria}* (el cupo está completo).`
      : `¡Hola! Quiero inscribirme en el torneo *${torneo}*.`,
  ];
  if (!espera) lineas.push(`Categoría: ${categoria}`);
  if (individual) lineas.push(`Jugador/a: ${jugador1.trim()}`);
  else { lineas.push(`Jugador/a 1: ${jugador1.trim()}`); lineas.push(`Jugador/a 2: ${jugador2.trim()}`); }
  lineas.push(`Teléfono de contacto: ${telefono.trim()}`);
  return lineas.join("\n");
}

// Qué falta completar en el formulario (lista vacía = listo para enviar)
export function faltantesInscripcion({ jugador1, jugador2, telefono, individual }) {
  const f = [];
  const nombreOk = (n) => (n || "").trim().split(/\s+/).filter(Boolean).length >= 2;
  if (!nombreOk(jugador1)) f.push(individual ? "tu nombre y apellido" : "nombre y apellido del jugador/a 1");
  if (!individual && !nombreOk(jugador2)) f.push("nombre y apellido del jugador/a 2");
  if ((telefono || "").replace(/\D/g, "").length < 6) f.push("un teléfono de contacto");
  return f;
}

// "2026-10-02" -> "viernes 2 de octubre"; con fin: "viernes 2 al domingo 4 de octubre"
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return { dia: DIAS[d.getDay()], num: d.getDate(), mes: MESES[d.getMonth()], anio: d.getFullYear() };
}
export function rangoFechas(inicio, fin) {
  const a = partes(inicio);
  if (!a) return "";
  const b = partes(fin);
  if (!b || fin === inicio) return `${a.dia} ${a.num} de ${a.mes}`;
  if (a.mes === b.mes && a.anio === b.anio) return `${a.dia} ${a.num} al ${b.dia} ${b.num} de ${b.mes}`;
  return `${a.dia} ${a.num} de ${a.mes} al ${b.dia} ${b.num} de ${b.mes}`;
}
export function fechaCorta(iso) {
  const a = partes(iso);
  return a ? `${a.dia} ${a.num} de ${a.mes}` : "";
}
