// Partidos posibles: junta grupos de 4 jugadores que cumplen las reglas de
// armado (logica/perfil.js: grupoValido) y que pueden EMPEZAR a la misma hora.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// Todavía no mira las canchas: propone día y hora, y el organizador chequea en
// Reva si hay cancha libre antes de confirmar.
//
// Cómo elige (para que cada jugador aparezca en un solo partido sugerido):
//   1. Empieza por el jugador con MENOS horarios posibles: si no lo ubica
//      primero, después es más difícil encontrarle compañeros.
//   2. Para ese jugador prueba todos los grupos de 4 con los que quedan libres
//      y se queda con el mejor: primero los de una sola categoría, después los
//      que tienen más horarios en común (más fácil de coordinar).
//   3. Saca a esos 4 de la lista y sigue con el próximo.

import { parejaPuedeEnDia, aHora, aMin, sumarDias, diaDeSemana, HORA_APERTURA, HORA_CIERRE, PASO_MIN, DURACION_PARTIDO, NOMBRES_DIA } from "./calendario.js";
import { categoriasParaArmar, estaVigente, grupoValido, calcularNivel } from "./perfil.js";

// ---- Horarios ----

// Horarios de una semana tipo en los que puede EMPEZAR un partido: "dia|minutos"
export function iniciosPosibles(disp, duracion = DURACION_PARTIDO) {
  const out = [];
  for (let d = 0; d < 7; d++)
    for (let m = aMin(HORA_APERTURA); m + duracion <= aMin(HORA_CIERRE); m += PASO_MIN)
      if (parejaPuedeEnDia(disp, d, aHora(m), aHora(m + duracion))) out.push(d + "|" + m);
  return out;
}

// Próxima fecha de ese día de la semana, desde mañana (nunca para hoy: hace
// falta tiempo para confirmar y reservar)
export function proximaFecha(diaSemana, hoyISO) {
  for (let i = 1; i <= 7; i++) { const f = sumarDias(hoyISO, i); if (diaDeSemana(f) === diaSemana) return f; }
  return null;
}

// "3|1080" -> { dia: 3, nombreDia: "Miércoles", fecha: "2026-10-14", hora: "18:00" }
export function horarioDe(clave, hoyISO) {
  const [d, m] = clave.split("|").map(Number);
  return { dia: d, nombreDia: NOMBRES_DIA[d], fecha: proximaFecha(d, hoyISO), hora: aHora(m) };
}

// Ordena horarios por cuándo caen (fecha y hora), empezando por el más cercano
const ordenarHorarios = (claves, hoyISO) => claves
  .map(c => ({ c, h: horarioDe(c, hoyISO) }))
  .sort((a, b) => (a.h.fecha + a.h.hora).localeCompare(b.h.fecha + b.h.hora))
  .map(x => x.h);

// ---- Quién entra al armado ----

// filas = lo que devuelve cargarPerfilesAdmin: [{ id, clave, perfil, whatsapp }]
// jugadores = ranking en memoria; nombreDe(clave) = nombre para mostrar.
// Devuelve { aptos, fuera }: aptos con lo que necesita el armado; fuera con el motivo.
export function separarAptos(filas, jugadores, hoyISO, nombreDe = () => "") {
  const aptos = [], fuera = [];
  (filas || []).forEach(f => {
    const nombre = nombreDe(f.clave) || "Sin nombre";
    const oficial = jugadores?.[f.clave]?.categoria || null;
    if (!f.perfil) return fuera.push({ id: f.id, nombre, motivo: "No terminó el perfil" });
    if (!estaVigente(f.perfil, hoyISO)) return fuera.push({ id: f.id, nombre, motivo: "Disponibilidad vencida" });
    const nivel = categoriasParaArmar(oficial, f.perfil.respuestas);
    if (!nivel) {
      const estado = f.perfil.respuestas ? calcularNivel(f.perfil.respuestas).estado : "incompleto";
      const motivo = estado === "pendiente" ? "Nivel pendiente de tu validación" : estado === "revisar" ? "Nivel para revisar" : "Sin nivel (falta el cuestionario)";
      return fuera.push({ id: f.id, nombre, motivo });
    }
    aptos.push({ id: f.id, clave: f.clave, nombre, whatsapp: f.whatsapp || null, oficial,
      min: nivel.min, max: nivel.max, genero: f.perfil.genero, lado: f.perfil.lado, disponibilidad: f.perfil.disponibilidad });
  });
  return { aptos, fuera };
}

// ---- Armado ----

const interseccion = (a, b) => { const out = new Set(); a.forEach(x => { if (b.has(x)) out.add(x); }); return out; };

// aptos: los de separarAptos. Devuelve { sugerencias, sinPartido }.
// Cada sugerencia: { jugadores (4), min, max, genero, propuesta, alternativas, totalHorarios }
// sinPartido: aptos que no entraron en ningún grupo, con el motivo.
export function sugerirPartidos(aptos, hoyISO, duracion = DURACION_PARTIDO) {
  const lista = (aptos || []).map(j => ({ ...j, inicios: new Set(iniciosPosibles(j.disponibilidad, duracion)) }));
  const sinHorario = lista.filter(j => !j.inicios.size);
  const conHorario = lista.filter(j => j.inicios.size);
  const libres = new Set(conHorario.map(j => j.id));
  const sugerencias = [];
  const orden = [...conHorario].sort((a, b) => a.inicios.size - b.inicios.size || a.nombre.localeCompare(b.nombre));

  for (const p of orden) {
    if (!libres.has(p.id)) continue;
    // Compañeros posibles: libres, mismo género, a una categoría como mucho y con algún horario en común
    const cand = conHorario.filter(q => q.id !== p.id && libres.has(q.id) && q.genero === p.genero
      && Math.max(p.max, q.max) - Math.min(p.min, q.min) <= 1 && interseccion(p.inicios, q.inicios).size > 0);
    let mejor = null;
    for (let i = 0; i < cand.length; i++) {
      const ci = interseccion(p.inicios, cand[i].inicios);
      for (let j = i + 1; j < cand.length; j++) {
        const cj = interseccion(ci, cand[j].inicios);
        if (!cj.size) continue;
        for (let k = j + 1; k < cand.length; k++) {
          const comunes = interseccion(cj, cand[k].inicios);
          if (!comunes.size) continue;
          const grupo = [p, cand[i], cand[j], cand[k]];
          if (!grupoValido(grupo).ok) continue;
          const span = Math.max(...grupo.map(g => g.max)) - Math.min(...grupo.map(g => g.min));
          const puntaje = [span, -comunes.size];
          if (!mejor || puntaje[0] < mejor.puntaje[0] || (puntaje[0] === mejor.puntaje[0] && puntaje[1] < mejor.puntaje[1]))
            mejor = { grupo, comunes, puntaje };
        }
      }
    }
    if (!mejor) continue;
    mejor.grupo.forEach(g => libres.delete(g.id));
    const horarios = ordenarHorarios([...mejor.comunes], hoyISO);
    // Alternativas: el primer horario de cada uno de los otros días en común (hasta 3)
    const otrosDias = [];
    horarios.slice(1).forEach(h => { if (h.dia !== horarios[0].dia && !otrosDias.some(x => x.dia === h.dia)) otrosDias.push(h); });
    sugerencias.push({
      jugadores: mejor.grupo.map(({ inicios, ...resto }) => resto),
      min: Math.min(...mejor.grupo.map(g => g.min)), max: Math.max(...mejor.grupo.map(g => g.max)),
      genero: p.genero, propuesta: horarios[0], alternativas: otrosDias.slice(0, 3), totalHorarios: horarios.length,
    });
  }

  const sinPartido = [
    ...sinHorario.map(j => ({ id: j.id, nombre: j.nombre, motivo: "Sus franjas no dejan empezar ningún partido" })),
    ...conHorario.filter(j => libres.has(j.id)).map(j => ({ id: j.id, nombre: j.nombre, motivo: "No coincide con 3 más de su nivel en algún horario" })),
  ];
  sugerencias.sort((a, b) => (a.propuesta.fecha + a.propuesta.hora).localeCompare(b.propuesta.fecha + b.propuesta.hora));
  return { sugerencias, sinPartido };
}

// ---- Mensaje de invitación ----

const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const ddmm = (iso) => { const [, m, d] = String(iso).split("-"); return `${d}/${m}`; };

// Texto para mandarle a cada jugador por WhatsApp
export function mensajeInvitacion(sugerencia, jugador) {
  const otros = sugerencia.jugadores.filter(j => j.id !== jugador.id).map(j => primerNombre(j.nombre));
  const p = sugerencia.propuesta;
  return `Hola ${primerNombre(jugador.nombre)}! Te armé un partido con gente de tu nivel 🎾\n`
    + `📅 ${p.nombreDia} ${ddmm(p.fecha)} a las ${p.hora}\n`
    + `👥 Con ${otros.slice(0, -1).join(", ")} y ${otros[otros.length - 1]}\n`
    + `¿Te sumás? Confirmame por acá así reservo la cancha.`;
}

// Enlace que abre WhatsApp con el mensaje ya escrito
export const enlaceWhatsapp = (numero, texto) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
