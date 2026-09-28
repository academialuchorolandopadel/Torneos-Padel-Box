// Datos del club y ficha de cada torneo.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// Dos niveles:
//   - Club: se carga una vez y vale para todos los torneos (identidad, contacto, pago).
//   - Ficha: cambia en cada torneo (descripción, precio, cupo, premios).
// La imagen semanal y la página pública del torneo leen de acá.

// Colores sacados del logo de Padel Box
export const CLUB_POR_DEFECTO = {
  nombre: "Padel Box",
  colorPrincipal: "#8DC73F", // verde de la pelota
  colorOscuro: "#231F20",    // negro de las letras
  colorClaro: "#FFFFFF",
  tema: "oscuro",            // fondo de las piezas: "oscuro" (logo blanco) o "claro" (logo color)
  whatsapp: "",
  instagram: "",
  direccion: "",
  mapsUrl: "",
  pagoAlias: "",
  pagoTitular: "",
  pagoBanco: "",
  pagoNota: "",
  textoApoyo: "",            // vacío = no aparece
  logoColor: "",             // imágenes guardadas como data URL (PNG)
  logoBlanco: "",
};

export const FICHA_POR_DEFECTO = {
  descripcion: "",
  fechaFin: "",
  fechaLimite: "",           // fecha límite de inscripción
  precio: "",
  precioPor: "pareja",       // "pareja" o "jugador"
  cupo: "",                  // parejas por categoría
  premios: "",
  notas: "",
};

// Completa lo que falte con los valores por defecto
export const conDefectoClub = (club) => ({ ...CLUB_POR_DEFECTO, ...(club || {}) });
export const conDefectoFicha = (ficha) => ({ ...FICHA_POR_DEFECTO, ...(ficha || {}) });

// "#8dc73f" o "8DC73F" -> "#8DC73F"; si no es un color válido, null
export function normalizarColor(texto) {
  const t = (texto || "").trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(t) ? "#" + t.toUpperCase() : null;
}

// Colores y logo según el tema elegido, para dibujar piezas y páginas
export function paletaDelClub(club) {
  const c = conDefectoClub(club);
  const oscuro = c.tema !== "claro";
  return {
    fondo: oscuro ? c.colorOscuro : c.colorClaro,
    texto: oscuro ? c.colorClaro : c.colorOscuro,
    acento: c.colorPrincipal,
    logo: oscuro ? (c.logoBlanco || c.logoColor) : (c.logoColor || c.logoBlanco),
  };
}

// Tamaño máximo de un logo guardado (Firestore admite hasta 1 MB por documento)
export const LOGO_MAX_BYTES = 700 * 1024;
