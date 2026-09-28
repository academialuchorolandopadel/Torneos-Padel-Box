// Imagen de los partidos de la semana: qué partidos entran y cómo se reparten.
// Funciones puras: reciben datos y devuelven datos. El dibujo está en vistas/imagen.jsx.
import { SLOT_DEFS } from "./constantes.js";
import { getRoundNames } from "./llave.js";
import { NOMBRES_DIA, diaDeSemana, sumarDias } from "./calendario.js";
import { formatearFecha } from "./fechas.js";

// Formatos de salida (en píxeles) y cuántas "filas" entran en el cuerpo.
// Un partido ocupa 1 fila y un encabezado de día 0.6.
export const FORMATOS = {
  historia: { nombre: "Historia", ancho: 1080, alto: 1920, capacidad: 11 },
  post: { nombre: "Post", ancho: 1080, alto: 1350, capacidad: 6.5 },
};
const ALTO_ENCABEZADO_DIA = 0.6;

const ORDEN_DIA_FINDE = [...new Set(SLOT_DEFS.map(s => s.dia))]; // JUEVES, VIERNES, SÁBADO, DOMINGO

// Resultado corto: "6-3 6-4", con tie-break o tercer set si hubo
function marcador(m, esAmericano) {
  if (!m.done) return "";
  if (m.wo) return "W.O.";
  const sets = [[m.s1p1, m.s1p2]];
  if (!esAmericano) { sets.push([m.s2p1, m.s2p2]); if (m.s3p1 !== undefined && m.s3p1 !== "") sets.push([m.s3p1, m.s3p2]); }
  let txt = sets.filter(([a, b]) => a !== "" && a != null).map(([a, b]) => `${a}-${b}`).join(" ");
  if (!esAmericano && m.tbp1 !== undefined && m.tbp1 !== "" && m.tbp1 != null) txt += ` (${m.tbp1}-${m.tbp2})`;
  return txt;
}

// Todos los partidos con horario de un torneo, como filas listas para dibujar.
// En torneo largo: solo los de la semana que empieza en "lunes".
// En fin de semana: todos (la grilla jueves-domingo ya es "la semana").
// categoriaId: una categoría o null para todas.
export function partidosParaImagen(torneo, { lunes = null, categoriaId = null } = {}) {
  const largo = torneo?.calendario === "largo";
  const filas = [];
  for (const cat of torneo?.categorias || []) {
    if (categoriaId && cat.id !== categoriaId) continue;
    const byId = Object.fromEntries((cat.parejas || []).map(p => [p.id, p]));
    const esAmericano = cat.modalidad === "americano_zonas";
    const rondas = cat.knockoutRounds || [];
    const nombresRonda = getRoundNames(rondas);
    const llave = rondas.flatMap((r, ri) => r.filter(m => !m.auto).map(m => ({ ...m, etiqueta: nombresRonda[ri] || `Ronda ${ri + 1}` })));
    const todos = [...(cat.partidos || []).map(m => ({ ...m, etiqueta: m.code })), ...llave];
    for (const m of todos) {
      if (!m.p1id || !m.p2id || !m.hora || !m.cancha || m.dia === "?") continue;
      if (largo) {
        if (!m.fecha || !lunes || m.fecha < lunes || m.fecha > sumarDias(lunes, 6)) continue;
      } else if (!m.dia) continue;
      filas.push({
        id: m.id,
        clave: largo ? m.fecha : m.dia,          // agrupa por día
        orden: largo ? (m.mins || 0) : ORDEN_DIA_FINDE.indexOf(m.dia) * 10000 + (m.mins || 0),
        hora: m.hora, cancha: m.cancha,
        categoria: cat.nombre,
        etiqueta: m.etiqueta || "",
        pareja1: byId[m.p1id]?.nombre || "?", pareja2: byId[m.p2id]?.nombre || "?",
        resultado: marcador(m, esAmericano),
      });
    }
  }
  filas.sort((a, b) => a.orden - b.orden || (a.cancha < b.cancha ? -1 : 1));
  // La categoría se muestra solo si en la imagen aparece más de una
  if (new Set(filas.map(f => f.categoria)).size <= 1) filas.forEach(f => { f.categoria = ""; });
  return filas;
}

// Título de un día: "LUNES 28/9" (largo) o "SÁBADO" (fin de semana)
export const tituloDia = (clave, largo) => largo ? `${NOMBRES_DIA[diaDeSemana(clave)]} ${formatearFecha(clave).replace(/\/\d{4}$/, "")}`.toUpperCase() : clave;

// Reparte las filas en páginas según la capacidad del formato. Cada página
// arranca con el encabezado del día; si un día se corta, se repite en la siguiente.
export function paginar(filas, formato = "historia") {
  const cap = FORMATOS[formato]?.capacidad || FORMATOS.historia.capacidad;
  const paginas = [];
  let actual = null, usado = 0;
  const nueva = () => { actual = { grupos: [] }; paginas.push(actual); usado = 0; };
  for (const f of filas) {
    let grupo = actual?.grupos[actual.grupos.length - 1];
    const necesita = 1 + (grupo && grupo.clave === f.clave ? 0 : ALTO_ENCABEZADO_DIA);
    if (!actual || usado + necesita > cap + 1e-9) { nueva(); grupo = null; }
    if (!grupo || grupo.clave !== f.clave) {
      grupo = { clave: f.clave, filas: [] }; actual.grupos.push(grupo); usado += ALTO_ENCABEZADO_DIA;
    }
    grupo.filas.push(f); usado += 1;
  }
  return paginas;
}

// Subtítulo con el rango: "DEL 28/9 AL 4/10"
export function rangoSemana(lunes) {
  const corto = (iso) => formatearFecha(iso).replace(/\/\d{4}$/, "");
  return `DEL ${corto(lunes)} AL ${corto(sumarDias(lunes, 6))}`;
}
