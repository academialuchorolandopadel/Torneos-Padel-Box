// Directorio de jugadores: todas las personas que la app conoce, para buscarlas
// al inscribir sin tener que escribir nombre y cédula de nuevo.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// Fuentes, en orden de prioridad para el nombre:
//   1. el ranking (colección jugadores)
//   2. las parejas de todos los torneos
//   3. los inscriptos de los americanos individuales
// El ranking solo tiene a quienes sumaron puntos o se crearon a mano; por eso
// se completan con las otras fuentes.

// Minúsculas y sin tildes: "Martínez" y "martinez" se encuentran igual
export const normalizarTexto = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function armarDirectorio(jugadores, torneos) {
  const porClave = new Map();
  const agregar = (cedula, nombre) => {
    const ced = (cedula || "").trim(), nom = (nombre || "").trim();
    if (!nom) return;
    const clave = ced ? "c:" + ced : "n:" + normalizarTexto(nom);
    if (!porClave.has(clave)) porClave.set(clave, { cedula: ced, nombre: nom });
  };
  Object.values(jugadores || {}).forEach(j => agregar(j.cedula, j.nombre));
  (torneos || []).forEach(t => (t.categorias || []).forEach(c => {
    (c.parejas || []).forEach(p => { agregar(p.j1cedula, p.j1nombre || p.j1); agregar(p.j2cedula, p.j2nombre || p.j2); });
    (c.jugadoresAmericano || []).forEach(j => agregar(j.cedula, j.nombre));
  }));
  return [...porClave.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Busca por parte del nombre (sin importar tildes ni mayúsculas) o por el
// comienzo de la cédula. Primero los que empiezan con lo escrito.
export function buscarJugadores(directorio, texto, limite = 6) {
  const q = normalizarTexto(texto);
  if (q.length < 2) return [];
  const empieza = [], contiene = [];
  for (const j of directorio) {
    const nom = normalizarTexto(j.nombre);
    const palabras = nom.split(/\s+/);
    if (nom.startsWith(q) || palabras.some(w => w.startsWith(q)) || (j.cedula && j.cedula.startsWith(q))) empieza.push(j);
    else if (nom.includes(q)) contiene.push(j);
  }
  return [...empieza, ...contiene].slice(0, limite);
}

// Nombre de pareja sugerido: apellidos (última palabra de cada nombre)
export function nombreParejaAuto(nombre1, nombre2) {
  const apellido = (n) => (n || "").trim().split(/\s+/).pop() || "";
  const a = apellido(nombre1), b = apellido(nombre2);
  return a && b ? `${a} / ${b}` : "";
}
