// Calendario por fechas (torneo largo): turnos libres del club y
// disponibilidad semanal de las parejas y de los jugadores.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// Formato de los datos (pensado para Firestore, que NO acepta listas dentro
// de listas: por eso los rangos son objetos y no pares [desde, hasta]):
//   rango:            { desde: "18:00", hasta: "23:00" }
//   día del club:     { fecha: "2026-10-14", canchas: { "BOX 1": [rango, ...], ... } }
//   disponibilidad:   { modo: "libre" | "solo" | "no" | "inicio", dias: { "1": [rango, ...], ... }, }
//                     días de la semana como en JavaScript: "0" domingo ... "6" sábado
//
// Por dentro las horas se manejan en minutos desde las 00:00 ("18:30" = 1110).

export const PASO_MIN = 30;          // Reva permite reservar de a media hora
export const HORA_APERTURA = "07:00";
export const HORA_CIERRE = "24:00";
export const DURACION_PARTIDO = 90;  // minutos, valor por defecto del torneo largo
export const MAX_PARTIDOS_SEMANA = 2; // por pareja, valor por defecto del torneo largo
export const ANTICIPACION_MIN_HORAS = 24; // aviso mínimo para programar un partido

export const NOMBRES_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // la semana arranca el lunes

// ---- Horas ----
export const aMin = (hora) => { const [h, m] = hora.split(":").map(Number); return h * 60 + m; };
export const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Todas las horas elegibles del día, de media hora en media hora
export function horasDelDia() {
  const out = [];
  for (let m = aMin(HORA_APERTURA); m <= aMin(HORA_CIERRE); m += PASO_MIN) out.push(aHora(m));
  return out;
}

// ---- Fechas ("2026-10-14") ----
// Se arma la fecha al mediodía para que el huso horario no la corra de día.
const aDate = (iso) => new Date(iso + "T12:00:00");
const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const diaDeSemana = (iso) => aDate(iso).getDay();
export function sumarDias(iso, n) { const d = aDate(iso); d.setDate(d.getDate() + n); return aISO(d); }
export function lunesDeSemana(iso) { const dia = diaDeSemana(iso); return sumarDias(iso, dia === 0 ? -6 : 1 - dia); }
export const diasDeLaSemana = (lunesISO) => Array.from({ length: 7 }, (_, i) => sumarDias(lunesISO, i));

// ---- Rangos ----
// Ordena y une rangos que se pisan o se tocan. Descarta los inválidos.
export function normalizarRangos(rangos) {
  const validos = (rangos || [])
    .map(r => [aMin(r.desde), aMin(r.hasta)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of validos) {
    const ult = out[out.length - 1];
    if (ult && a <= ult[1]) ult[1] = Math.max(ult[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => ({ desde: aHora(a), hasta: aHora(b) }));
}

// Cuántos partidos completos entran en una lista de rangos (sin superponerse)
export function capacidadPartidos(rangos, duracion = DURACION_PARTIDO) {
  return normalizarRangos(rangos).reduce((n, r) => n + Math.floor((aMin(r.hasta) - aMin(r.desde)) / duracion), 0);
}

// Capacidad total de un día del club, sumando todas las canchas
export function capacidadDia(diaClub, duracion = DURACION_PARTIDO) {
  if (!diaClub) return 0;
  return Object.values(diaClub.canchas || {}).reduce((n, rangos) => n + capacidadPartidos(rangos, duracion), 0);
}

// ---- Disponibilidad de parejas y jugadores ----
export const DISPONIBILIDAD_LIBRE = { modo: "libre", dias: {} };

// ¿Puede jugar un partido entre "desde" y "hasta" de esa fecha?
//  - "libre":  puede siempre
//  - "solo":   el partido tiene que caer ENTERO dentro de alguno de sus rangos de ese día
//  - "no":     el partido no puede tocar ninguno de sus rangos de ese día
//  - "inicio": el partido tiene que EMPEZAR dentro de alguno de sus rangos de ese
//              día, aunque termine después (franjas del perfil de jugador: con
//              "13:00 a 18:00" puede arrancar hasta las 17:30)
export function parejaPuede(disp, fechaISO, desde, hasta) {
  return parejaPuedeEnDia(disp, diaDeSemana(fechaISO), desde, hasta);
}

// Igual que parejaPuede, pero con el día de la semana (0 domingo ... 6 sábado)
export function parejaPuedeEnDia(disp, diaSemana, desde, hasta) {
  if (!disp || !disp.modo || disp.modo === "libre") return true;
  const rangos = normalizarRangos(disp.dias?.[String(diaSemana)] || []);
  const a = aMin(desde), b = aMin(hasta);
  if (disp.modo === "inicio") return rangos.some(r => aMin(r.desde) <= a && a < aMin(r.hasta));
  if (disp.modo === "solo") return rangos.some(r => aMin(r.desde) <= a && aMin(r.hasta) >= b);
  return !rangos.some(r => aMin(r.desde) < b && aMin(r.hasta) > a);
}

// Texto corto para mostrar en tablas: "Solo: Lun 19:00-23:00 · Mié 20:00-23:00"
const PREFIJO_MODO = { solo: "Solo: ", no: "No puede: ", inicio: "Empieza: " };
export function resumenDisponibilidad(disp) {
  if (!disp || !disp.modo || disp.modo === "libre") return "Sin restricciones";
  const partes = ORDEN_SEMANA
    .map(d => [d, normalizarRangos(disp.dias?.[String(d)] || [])])
    .filter(([, rs]) => rs.length)
    .map(([d, rs]) => `${NOMBRES_DIA[d].slice(0, 3)} ${rs.map(r => `${r.desde}-${r.hasta}`).join(", ")}`);
  if (!partes.length) return disp.modo === "no" ? "Sin restricciones" : (PREFIJO_MODO[disp.modo] || "") + "sin días cargados";
  return (PREFIJO_MODO[disp.modo] || "") + partes.join(" · ");
}

// ---- Compatibilidad entre parejas (para armar zonas) ----
// Horarios de una semana tipo en los que la pareja podría jugar un partido
// completo: "día|inicio", con inicios cada media hora dentro del horario del club.
export function ventanasSemanales(disp, duracion = DURACION_PARTIDO) {
  const out = new Set();
  for (let d = 0; d < 7; d++) {
    for (let m = aMin(HORA_APERTURA); m + duracion <= aMin(HORA_CIERRE); m += PASO_MIN) {
      if (parejaPuedeEnDia(disp, d, aHora(m), aHora(m + duracion))) out.add(d + "|" + m);
    }
  }
  return out;
}

// Cuántos horarios de partido tienen en común dos parejas en una semana tipo
export function compatibilidadSemanal(dispA, dispB, duracion = DURACION_PARTIDO) {
  const a = ventanasSemanales(dispA, duracion), b = ventanasSemanales(dispB, duracion);
  let n = 0; a.forEach(x => { if (b.has(x)) n++; });
  return n;
}
