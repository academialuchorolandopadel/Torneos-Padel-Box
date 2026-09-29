// Identidad de los jugadores: cédula privada, id público.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// EN LA BASE (desde la v52):
//   - Cada jugador tiene un id al azar ("j_k3f9x2m1qa"). Ese id es lo único que
//     aparece en jugadores, parejas (j1id, j2id) y americanos.
//   - La cédula vive solo en la colección "accesos": un documento por cédula
//     con { jugadorId }. Las reglas dejan consultar UNA cédula que ya conocés
//     (así entra el jugador) pero no listarlas: solo el admin las ve todas.
//
// EN LA MEMORIA DE LA APP no cambió nada: el resto del código sigue usando el
// campo "cedula" (jugadores[cedula], pareja.j1cedula, ...). Lo que cambia es
// qué hay adentro:
//   - admin:      la cédula real (la capa de datos la traduce con "accesos").
//   - los demás:  el id del jugador. Es una clave que funciona igual para
//                 unir parejas, ranking y "Mi torneo", pero no revela nada.
// La traducción se hace solo en la frontera (datos/firestore.js), con las
// funciones de abajo. Así la migración no tocó los ~130 lugares que usan
// "cedula": sigue siendo "la clave del jugador".

export const VERSION_ESQUEMA = 2; // 1 = cédulas a la vista (hasta v51), 2 = ids + accesos

// Id nuevo al azar: "j_" + 10 letras/números. No se deriva de la cédula a
// propósito: cualquier "disfraz" de una cédula (por ejemplo, encriptarla) se
// puede revertir probando los ~10 millones de cédulas posibles.
export function nuevoIdJugador() {
  const letras = "abcdefghijklmnopqrstuvwxyz0123456789";
  return "j_" + Array.from(crypto.getRandomValues(new Uint8Array(10)), b => letras[b % 36]).join("");
}

export const esIdJugador = (x) => typeof x === "string" && /^j_[a-z0-9]{6,}$/.test(x);

// Campos de un partido de americano individual que nombran jugadores
const CAMPOS_AMERICANO = ["j1a", "j2a", "j1b", "j2b"];

const sinCampo = (obj, campo) => { const { [campo]: _, ...resto } = obj; return resto; };

// ---- Base -> memoria. "traducir" convierte un id en la clave de memoria.

export function parejaAMemoria(p, traducir) {
  const r = sinCampo(sinCampo(p, "j1id"), "j2id");
  return { ...r, j1cedula: traducir(p.j1id), j2cedula: traducir(p.j2id) };
}

export function categoriaAMemoria(c, traducir) {
  const r = { ...c };
  if (Array.isArray(c.jugadoresAmericano)) r.jugadoresAmericano = c.jugadoresAmericano.map(j => ({ ...sinCampo(j, "id"), cedula: traducir(j.id) }));
  if (Array.isArray(c.americanoPartidos)) r.americanoPartidos = c.americanoPartidos.map(m => partidoAmericano(m, traducir));
  return r;
}

export function jugadorAMemoria(id, datos, traducir) {
  return { ...datos, cedula: traducir(id) };
}

// ---- Memoria -> base. "traducir" convierte una clave de memoria en id.

export function parejaABase(p, traducir) {
  const r = sinCampo(sinCampo(p, "j1cedula"), "j2cedula");
  return { ...r, j1id: traducir(p.j1cedula), j2id: traducir(p.j2cedula) };
}

// Solo se traducen las claves que vienen en los cambios
export function cambiosCategoriaABase(cambios, traducir) {
  const r = { ...cambios };
  if (Array.isArray(cambios.jugadoresAmericano)) r.jugadoresAmericano = cambios.jugadoresAmericano.map(j => ({ ...sinCampo(j, "cedula"), id: traducir(j.cedula) }));
  if (Array.isArray(cambios.americanoPartidos)) r.americanoPartidos = cambios.americanoPartidos.map(m => partidoAmericano(m, traducir));
  return r;
}

export const jugadorABase = (jug) => sinCampo(jug, "cedula");

function partidoAmericano(m, traducir) {
  const r = { ...m };
  CAMPOS_AMERICANO.forEach(k => { if (k in m) r[k] = traducir(m[k]); });
  return r;
}

// ---- Qué claves de jugador aparecen en algo que se va a guardar
// (para crear antes los ids de las cédulas nuevas)

export const clavesDePareja = (p) => [p.j1cedula, p.j2cedula].filter(Boolean);

export function clavesDeCambiosCategoria(c) {
  const out = [];
  (c.jugadoresAmericano || []).forEach(j => j.cedula && out.push(j.cedula));
  (c.americanoPartidos || []).forEach(m => CAMPOS_AMERICANO.forEach(k => m[k] && out.push(m[k])));
  return out;
}

// ---- Migración (una sola vez): de cédulas a la vista a ids + accesos.
// colecciones: { torneos: [{id, datos}], ... } tal como las lee exportarTodo().
// nuevoId: función que devuelve un id nuevo (se inyecta para poder probarla).
// Devuelve las colecciones como tienen que quedar. No escribe nada.
export function planMigracion(colecciones, nuevoId) {
  const mapa = new Map(); // cédula -> id
  const idDe = (ced) => {
    const c = (ced == null ? "" : String(ced)).trim();
    if (!c) return "";
    if (!mapa.has(c)) mapa.set(c, nuevoId());
    return mapa.get(c);
  };
  const col = (n) => colecciones[n] || [];
  const out = { ...colecciones };

  out.jugadores = col("jugadores").map(d => ({ id: idDe(d.id), datos: jugadorABase(d.datos) }));
  out.parejas = col("parejas").map(d => ({ id: d.id, datos: parejaABase(d.datos, idDe) }));
  out.categorias = col("categorias").map(d => ({ id: d.id, datos: cambiosCategoriaABase(d.datos, idDe) }));
  out.accesos = [...mapa].map(([cedula, id]) => ({ id: cedula, datos: { jugadorId: id } }));
  out.club = [...col("club").filter(d => d.id !== "esquema"), { id: "esquema", datos: { version: VERSION_ESQUEMA } }];
  return out;
}

// Controles después de migrar: si algo de esto aparece, la migración no quedó bien.
// cedulasOriginales: las cédulas que había antes (claves del mapa de la migración).
export function revisarMigracion(colecciones, cedulasOriginales) {
  const problemas = [];
  const publicas = ["torneos", "categorias", "parejas", "partidos", "jugadores", "calendarioClub", "club"];
  const textos = publicas.map(c => JSON.stringify(colecciones[c] || [])).join("\n");
  const filtradas = cedulasOriginales.filter(c => c.length >= 5 && textos.includes(`"${c}"`));
  if (filtradas.length) problemas.push(`Quedaron ${filtradas.length} cédulas en datos públicos.`);
  const malos = (colecciones.jugadores || []).filter(d => !esIdJugador(d.id));
  if (malos.length) problemas.push(`${malos.length} jugadores no tienen id nuevo.`);
  const conCampoViejo = (colecciones.parejas || []).filter(d => "j1cedula" in d.datos || "j2cedula" in d.datos);
  if (conCampoViejo.length) problemas.push(`${conCampoViejo.length} parejas siguen con el campo de cédula.`);
  const esquema = (colecciones.club || []).find(d => d.id === "esquema");
  if (!esquema || esquema.datos.version !== VERSION_ESQUEMA) problemas.push("Falta la marca de esquema nuevo.");
  return problemas;
}
