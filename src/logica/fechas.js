// Fechas: cómo se guardan y cómo se muestran.
// En la base se guardan como las guarda el formulario del torneo ("2026-09-25").
// En pantalla se muestran como "25/9/2026". Las entradas viejas del historial,
// que ya están guardadas como "25/9/2026", se muestran tal cual.

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatearFecha(fecha){
  const m = ISO.exec(fecha || "");
  if (!m) return fecha || "";
  return `${Number(m[3])}/${Number(m[2])}/${m[1]}`;
}

// Fecha de hoy en formato "2026-09-25", según la hora local (no UTC:
// a la noche en Paraguay, UTC ya es el día siguiente).
export function fechaHoyISO(){
  const d = new Date();
  const dos = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
