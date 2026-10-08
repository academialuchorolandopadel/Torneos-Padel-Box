// Inscripción abierta a "partidos por nivel": cualquiera con el link completa
// sus datos y su perfil, y queda como SOLICITUD hasta que el organizador la apruebe.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// EN LA BASE (colección "solicitudes", un documento por envío, id al azar):
//   { nombre, cedula, whatsapp, genero, lado, disponibilidad, respuestas, venceEl, creada }
// Nadie más que el admin la puede leer (tiene cédula y WhatsApp). Al aprobar,
// se convierte en lo de siempre: accesos (cédula -> id), jugadores (nombre),
// perfiles y contactos. Después la solicitud se borra.

import { respuestasCompletas, validarPerfil, normalizarWhatsapp } from "./perfil.js";

// Link para compartir: la app con ?anotarse=1
export const linkAnotarse = (base) => `${String(base).split("?")[0].split("#")[0]}?anotarse=1`;

// Cédula paraguaya: solo números, sin puntos. "1.234.567" -> "1234567"
export function normalizarCedula(texto) {
  const d = String(texto || "").replace(/\D/g, "");
  return /^[0-9]{5,9}$/.test(d) ? d : null;
}

// Nombre prolijo: sin espacios de más
export const normalizarNombre = (texto) => String(texto || "").trim().replace(/\s+/g, " ");

// Arma el documento a guardar a partir de lo que cargó la persona.
// Devuelve { solicitud, errores }: si hay errores, solicitud es null.
export function armarSolicitud({ nombre, cedula, whatsapp, perfil }, ahoraISO) {
  const errores = [];
  const n = normalizarNombre(nombre);
  if (n.length < 3 || n.length > 60 || !/\s/.test(n)) errores.push("Escribí tu nombre y apellido.");
  const c = normalizarCedula(cedula);
  if (!c) errores.push("La cédula tiene que tener solo números (entre 5 y 9).");
  const w = normalizarWhatsapp(whatsapp);
  if (!w) errores.push("El WhatsApp no parece un número válido. Escribilo con característica, por ejemplo 0981 123 456.");
  // El cuestionario es obligatorio acá (validarPerfil solo lo revisa si viene)
  errores.push(...validarPerfil(perfil || {}).filter(e => e !== "Faltan respuestas del filtro."));
  if (!respuestasCompletas(perfil?.respuestas)) errores.push("Faltan respuestas del cuestionario.");
  if (errores.length) return { solicitud: null, errores };
  return { errores: [], solicitud: {
    nombre: n, cedula: c, whatsapp: w,
    genero: perfil.genero, lado: perfil.lado, disponibilidad: perfil.disponibilidad,
    respuestas: perfil.respuestas, venceEl: perfil.venceEl, creada: ahoraISO,
  } };
}

// Lo que se guarda al aprobar, separado por colección
export function partesDeSolicitud(s) {
  return {
    perfil: { respuestas: s.respuestas, lado: s.lado, genero: s.genero, disponibilidad: s.disponibilidad, venceEl: s.venceEl },
    contacto: { whatsapp: s.whatsapp },
    jugadorNuevo: { nombre: s.nombre, genero: s.genero, totalPts: 0, historial: [] },
  };
}

// Para la lista del admin: marca cédulas repetidas entre las solicitudes y
// las que ya existen en la app (alguien que jugó torneos o ya estaba cargado).
// nombreExistente(cedula) -> nombre que tiene en la app, o "".
// Devuelve las solicitudes ordenadas de la más vieja a la más nueva, con
// { repetida, nombreEnApp } agregados.
export function revisarSolicitudes(solicitudes, nombreExistente = () => "") {
  const lista = [...(solicitudes || [])].sort((a, b) => String(a.creada).localeCompare(String(b.creada)));
  const cuenta = {};
  lista.forEach(s => { cuenta[s.cedula] = (cuenta[s.cedula] || 0) + 1; });
  return lista.map(s => ({ ...s, repetida: cuenta[s.cedula] > 1, nombreEnApp: nombreExistente(s.cedula) || "" }));
}
