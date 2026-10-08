// Programación de partidos: armado de zonas y asignación de horarios/canchas.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
import { uid, COURTS, LETTERS, MIN_GAP, MIN_GAP_KO_SAME_DAY, MIN_GAP_KO_DIFF_DAY, SLOT_DEFS, ALL_SLOTS } from "./constantes.js";

export function calcZoneDistribution(numPairs) {
  if (numPairs < 6) return { zonasDe3: Math.ceil(numPairs / 3), zonasDe4: 0 };
  const mod = numPairs % 3;
  if (mod === 0) return { zonasDe3: numPairs / 3, zonasDe4: 0 };
  if (mod === 1) return { zonasDe3: (numPairs - 4) / 3, zonasDe4: 1 };
  return { zonasDe3: (numPairs - 8) / 3, zonasDe4: 2 };
}

export function getAvailableSlots(pair) {
  const restricted = new Set(pair.restriccionesSlots || []);
  return [...new Set(ALL_SLOTS.map(s => `${s.dia}|${s.hora}`))].filter(k => !restricted.has(k));
}

export function calcCompatibilityScore(pairA, pairB) {
  const setB = new Set(getAvailableSlots(pairB));
  return getAvailableSlots(pairA).filter(s => setB.has(s)).length;
}

export function scheduleMatches(newMatches, alreadyPlaced = [], pairMap = {}, isKnockout = false) {
  const occupied = new Set(alreadyPlaced.map((m) => `${m.dia}|${m.hora}|${m.cancha}`));
  const pairMins = {};
  alreadyPlaced.forEach((m) => {
    if (m.mins == null) return;
    [m.p1id, m.p2id].forEach((pid) => { if (pid) { pairMins[pid] = pairMins[pid] || []; pairMins[pid].push(m.mins); } });
  });
  const pairRestrictionSets = {};
  for (const pid of Object.keys(pairMap)) pairRestrictionSets[pid] = new Set(pairMap[pid]?.restriccionesSlots || []);
  const isBlocked = (slot, p1id, p2id) => {
    const key = `${slot.dia}|${slot.hora}`;
    return (p1id ? (pairRestrictionSets[p1id]||new Set()) : new Set()).has(key) ||
           (p2id ? (pairRestrictionSets[p2id]||new Set()) : new Set()).has(key);
  };
  const slotsToTry = isKnockout ? [...ALL_SLOTS].sort((a,b) => b.mins-a.mins) : ALL_SLOTS;
  return newMatches.map((m) => {
    for (const slot of slotsToTry) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (occupied.has(key) || isBlocked(slot, m.p1id, m.p2id)) continue;
      const allTimes = [...(m.p1id?pairMins[m.p1id]||[]:[]),...(m.p2id?pairMins[m.p2id]||[]:[])];
      if (allTimes.every((t) => Math.abs(t - slot.mins) >= MIN_GAP)) {
        occupied.add(key);
        [m.p1id, m.p2id].forEach((pid) => { if (pid) { pairMins[pid]=pairMins[pid]||[]; pairMins[pid].push(slot.mins); } });
        return { ...m, ...slot };
      }
    }
    for (const slot of slotsToTry) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (occupied.has(key) || isBlocked(slot, m.p1id, m.p2id)) continue;
      occupied.add(key);
      [m.p1id, m.p2id].forEach((pid) => { if (pid) { pairMins[pid]=pairMins[pid]||[]; pairMins[pid].push(slot.mins); } });
      return { ...m, ...slot, conflict: true };
    }
    for (const slot of slotsToTry) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (!occupied.has(key)) { occupied.add(key); [m.p1id, m.p2id].forEach((pid) => { if (pid) { pairMins[pid]=pairMins[pid]||[]; pairMins[pid].push(slot.mins); } }); return { ...m, ...slot, conflict:true, restrictionConflict:true }; }
    }
    return { ...m, dia:"?", hora:"?", cancha:COURTS[0], conflict:true, restrictionConflict:true };
  });
}

export function roundRobin(ids) {
  const m = [];
  for (let i=0;i<ids.length;i++) for (let j=i+1;j<ids.length;j++) m.push([ids[i],ids[j]]);
  return m;
}

export function scheduleKnockoutMatches(knockoutRounds, existingMatches, parejas) {
  const allKO = knockoutRounds.flat().filter(m=>!m.auto&&m.p1id&&m.p2id&&!m.dia);
  if (allKO.length===0) return knockoutRounds;
  const occupied = new Set(existingMatches.map(m=>`${m.dia}|${m.hora}|${m.cancha}`));
  const pairMins = {};
  existingMatches.forEach(m => {
    if (m.mins==null) return;
    [m.p1id,m.p2id].forEach(pid=>{ if(pid){pairMins[pid]=pairMins[pid]||[];pairMins[pid].push(m.mins);} });
  });
  // Restricciones por pareja (igual que en scheduleMatches)
  const pairMap=Object.fromEntries(parejas.map(p=>[p.id,p]));
  const pairRestrSets={};
  for (const pid of Object.keys(pairMap)) pairRestrSets[pid]=new Set(pairMap[pid]?.restriccionesSlots||[]);
  const isRestricted=(slot,p1id,p2id)=>{
    const key=`${slot.dia}|${slot.hora}`;
    return !!(p1id&&pairRestrSets[p1id]?.has(key))||(p2id&&pairRestrSets[p2id]?.has(key));
  };
  // Último partido de zona: KO debe comenzar después
  const maxZoneMins=existingMatches.filter(m=>m.mins!=null&&m.p1id!=="__bloq__").reduce((mx,m)=>Math.max(mx,m.mins),0);
  const programar = (m) => {
    // Primero slots DESPUÉS del último partido de zona (ascendente), luego el resto como fallback
    const slotsOrdered=[
      ...[...ALL_SLOTS].filter(s=>s.mins>maxZoneMins).sort((a,b)=>a.mins-b.mins),
      ...[...ALL_SLOTS].filter(s=>s.mins<=maxZoneMins).sort((a,b)=>a.mins-b.mins)
    ];
    // Paso 1: respeta gap Y restricciones (ideal)
    for (const slot of slotsOrdered) {
      const key=`${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (occupied.has(key)||isRestricted(slot,m.p1id,m.p2id)) continue;
      const allTimes=[...(pairMins[m.p1id]||[]),...(pairMins[m.p2id]||[])];
      let ok=true;
      for (const t of allTimes) {
        const sameDay=SLOT_DEFS.find(s=>s.mins===t)?.dia===slot.dia;
        if (Math.abs(t-slot.mins)<(sameDay?MIN_GAP_KO_SAME_DAY:MIN_GAP_KO_DIFF_DAY)) { ok=false; break; }
      }
      if (ok) { occupied.add(key); [m.p1id,m.p2id].forEach(pid=>{pairMins[pid]=pairMins[pid]||[];pairMins[pid].push(slot.mins);}); return {...m,...slot}; }
    }
    // Paso 2: ignora gap pero respeta restricciones
    for (const slot of slotsOrdered) {
      const key=`${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (occupied.has(key)||isRestricted(slot,m.p1id,m.p2id)) continue;
      occupied.add(key); [m.p1id,m.p2id].forEach(pid=>{pairMins[pid]=pairMins[pid]||[];pairMins[pid].push(slot.mins);}); return {...m,...slot,conflict:true};
    }
    // Paso 3: cualquier slot libre (último recurso, marca conflicto de restricción)
    for (const slot of slotsOrdered) {
      const key=`${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (!occupied.has(key)) { occupied.add(key); [m.p1id,m.p2id].forEach(pid=>{pairMins[pid]=pairMins[pid]||[];pairMins[pid].push(slot.mins);}); return {...m,...slot,conflict:true,restrictionConflict:true}; }
    }
    return m;
  };
  const scheduledMap=new Map();
  allKO.forEach(m=>scheduledMap.set(m.id,programar(m)));
  return knockoutRounds.map(round=>round.map(m=>scheduledMap.get(m.id)||m));
}

// ---- Armado de zonas anterior (EN DESUSO desde v57) ----
// Se deja solo para que la app compile mientras se suben los archivos de la
// v57 (el App.jsx viejo todavía la importa). Borrarla en una versión futura.
// Reparte las parejas en zonas de 3 (y de 4 si hace falta), juntando las de
// horarios más compatibles. Primero ubica a las parejas con menos horarios
// disponibles, que son las más difíciles de acomodar.
// criterios.disponibilidad(p): cuántos horarios tiene libres la pareja
// criterios.compatibilidad(a, b): cuántos horarios comparten dos parejas
// Por defecto usa la grilla de fin de semana (restricciones por slot).
export function armarZonas(parejas, criterios = {}) {
  const disponibilidad = criterios.disponibilidad || (p => getAvailableSlots(p).length);
  const compatibilidad = criterios.compatibilidad || calcCompatibilityScore;
  const dist = calcZoneDistribution(parejas.length);
  const grupos = []; let li = 0;
  for (let i = 0; i < dist.zonasDe3; i++) grupos.push({ id: uid(), nombre: `ZONA ${LETTERS[li++]}` });
  for (let i = 0; i < dist.zonasDe4; i++) grupos.push({ id: uid(), nombre: `ZONA ${LETTERS[li++]}` });
  const ap = parejas.map(p => ({ ...p, grupoId: null }));
  const sorted = [...ap].sort((a, b) => disponibilidad(a) - disponibilidad(b));
  const z3 = grupos.filter((_, i) => i < dist.zonasDe3), z4 = grupos.filter((_, i) => i >= dist.zonasDe3);
  const assignToZones = (pl, zones, size) => {
    const rem = pl.filter(p => p.grupoId === null);
    for (const zone of zones) {
      if (!rem.length) break; const seed = rem.shift(); seed.grupoId = zone.id;
      const ws = rem.filter(p => p.grupoId === null).map(p => ({ p, score: compatibilidad(seed, p) })); ws.sort((a, b) => b.score - a.score);
      for (let i = 0; i < size - 1 && i < ws.length; i++) { ws[i].p.grupoId = zone.id; const idx = rem.findIndex(x => x.id === ws[i].p.id); if (idx !== -1) rem.splice(idx, 1); }
    }
  };
  assignToZones(sorted, z3, 3); assignToZones(sorted, z4, 4);
  const asignadas = parejas.map(p => { const f = ap.find(a => a.id === p.id); return f ? { ...p, grupoId: f.grupoId } : p; });
  return { grupos, parejas: asignadas };
}

// ---- Armado de zonas por ranking (desde v57, todos los formatos) ----
// 1. Orden: puntos de la pareja (suma de sus dos jugadores) de mayor a menor;
//    empate -> orden de inscripción (las parejas anteriores a la v57 no tienen
//    fecha: cuentan como las primeras, en un orden fijo).
// 2. Bombos del tamaño de la cantidad de zonas, repartidos en serpentina:
//    fila 1 A->C, fila 2 C->A, fila 3 A->C. Las que sobran (zonas de 4) van a
//    las primeras zonas, la más débil a la A: la zona del 1 recibe a la más débil.
// 3. Horarios: si dos parejas de una zona que se tienen que enfrentar no
//    comparten ningún horario, la de menor ranking se cambia por otra de su
//    MISMO bombo (primero las de abajo, después las de arriba), solo si el
//    cambio no le agrega conflictos a la otra zona. Si nada funciona, la zona
//    queda como está y se avisa.
// En zonas de 4 solo se controlan los dos primeros cruces (1° vs 4° y 2° vs 3°):
// los segundos dependen de quién gane.
//
// parejas: [{id, inscriptaEn?, ...}]
// opciones.puntos(p): puntos de la pareja
// opciones.compatibles(a, b): true si comparten algún horario
// Devuelve { grupos, parejas (con grupoId), ordenPorGrupo, bombos, avisos }
export function armarZonasPorRanking(parejas, { puntos = () => 0, compatibles = () => true } = {}) {
  const n = parejas.length;
  const dist = calcZoneDistribution(n);
  const nz = dist.zonasDe3 + dist.zonasDe4;
  const grupos = Array.from({ length: nz }, (_, i) => ({ id: uid(), nombre: `ZONA ${LETTERS[i]}` }));
  const pos = new Map(parejas.map((p, i) => [p.id, i]));
  const orden = [...parejas].sort((a, b) =>
    (puntos(b) - puntos(a)) ||
    ((a.inscriptaEn ?? 0) - (b.inscriptaEn ?? 0)) ||
    (pos.get(a.id) - pos.get(b.id)));
  const ranking = new Map(orden.map((p, i) => [p.id, i])); // 0 = mejor
  // Serpentina
  const zonas = Array.from({ length: nz }, () => []);
  const bombo = new Map();
  const base = n >= 6 ? 3 * nz : n;
  orden.forEach((p, i) => {
    let z, fila;
    if (i < base) { fila = Math.floor(i / nz); const col = i % nz; z = fila % 2 === 0 ? col : nz - 1 - col; }
    else { fila = 3; z = (n - base - 1) - (i - base); } // sobrantes: la más débil a la A
    zonas[z].push(p.id); bombo.set(p.id, fila);
  });
  const byId = Object.fromEntries(parejas.map(p => [p.id, p]));
  const porRanking = (ids) => [...ids].sort((a, b) => ranking.get(a) - ranking.get(b));
  // Cruces que se controlan: todos contra todos, o 1v4 y 2v3 en zonas de 4
  const cruces = (ids) => {
    const r = porRanking(ids);
    if (r.length === 4) return [[r[0], r[3]], [r[1], r[2]]];
    const out = [];
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) out.push([r[i], r[j]]);
    return out;
  };
  const conflictos = (ids) => cruces(ids).filter(([a, b]) => !compatibles(byId[a], byId[b]));
  // Resolver conflictos con cambios dentro del bombo
  for (let vuelta = 0; vuelta < 3 * n; vuelta++) {
    let cambio = false;
    for (let z = 0; z < nz && !cambio; z++) {
      for (const [a, b] of conflictos(zonas[z])) {
        const peor = ranking.get(a) > ranking.get(b) ? a : b;
        const mismoBombo = orden.map(p => p.id).filter(id => id !== peor && bombo.get(id) === bombo.get(peor));
        const abajo = mismoBombo.filter(id => ranking.get(id) > ranking.get(peor));
        const arriba = mismoBombo.filter(id => ranking.get(id) < ranking.get(peor)).reverse();
        for (const cand of [...abajo, ...arriba]) {
          const zc = zonas.findIndex(ids => ids.includes(cand));
          if (zc === z) continue;
          const antesZ = conflictos(zonas[z]).length, antesC = conflictos(zonas[zc]).length;
          const nuevaZ = zonas[z].map(id => id === peor ? cand : id);
          const nuevaC = zonas[zc].map(id => id === cand ? peor : id);
          const despZ = conflictos(nuevaZ).length, despC = conflictos(nuevaC).length;
          if (despC <= antesC && despZ + despC < antesZ + antesC) {
            zonas[z] = nuevaZ; zonas[zc] = nuevaC; cambio = true; break;
          }
        }
        if (cambio) break;
      }
    }
    if (!cambio) break;
  }
  // Resultado: orden dentro de cada zona por ranking; en zonas de 4, [1°, 4°, 2°, 3°]
  // para que el partido A sea 1° vs 4° y el B 2° vs 3°.
  const ordenPorGrupo = {};
  const avisos = [];
  const grupoDe = {};
  zonas.forEach((ids, z) => {
    const r = porRanking(ids);
    ordenPorGrupo[grupos[z].id] = r.length === 4 ? [r[0], r[3], r[1], r[2]] : r;
    r.forEach(id => { grupoDe[id] = grupos[z].id; });
    conflictos(ids).forEach(([a, b]) => avisos.push(`${grupos[z].nombre}: ${byId[a].nombre || "?"} y ${byId[b].nombre || "?"} no comparten horarios.`));
  });
  return {
    grupos,
    parejas: parejas.map(p => ({ ...p, grupoId: grupoDe[p.id] ?? null })),
    ordenPorGrupo,
    bombos: Object.fromEntries(orden.map(p => [p.id, bombo.get(p.id)])),
    avisos,
  };
}

// Partidos de zona: todos contra todos en zonas de 3; en zonas de 4, el
// mini-playoff A y B (1ra ronda) y C y D (se completan con ganadores y perdedores).
// ordenPorGrupo (opcional): el orden de las parejas dentro de cada zona.
// En zonas de 4, los dos primeros son el partido A y los dos siguientes el B.
export function crearPartidosDeZona(grupos, parejas, ordenPorGrupo = {}) {
  const vacio = { done: false, winner: null, s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "" };
  let code = 1; const raw = [];
  grupos.forEach(g => {
    const gIds = ordenPorGrupo[g.id] || parejas.filter(p => p.grupoId === g.id).map(p => p.id);
    if (gIds.length === 4) {
      const gid = g.id;
      raw.push({ id: uid(), type: "grupo", grupoId: gid, code: `Z${code++}`, p1id: gIds[0], p2id: gIds[1], ...vacio, zona4: true, zona4Tipo: "A", zona4GrupoId: gid });
      raw.push({ id: uid(), type: "grupo", grupoId: gid, code: `Z${code++}`, p1id: gIds[2], p2id: gIds[3], ...vacio, zona4: true, zona4Tipo: "B", zona4GrupoId: gid });
      raw.push({ id: uid(), type: "grupo", grupoId: gid, code: `Z${code++}`, p1id: null, p2id: null, ...vacio, zona4: true, zona4Tipo: "C", zona4GrupoId: gid });
      raw.push({ id: uid(), type: "grupo", grupoId: gid, code: `Z${code++}`, p1id: null, p2id: null, ...vacio, zona4: true, zona4Tipo: "D", zona4GrupoId: gid });
    } else {
      roundRobin(gIds).forEach(([p1id, p2id]) => raw.push({ id: uid(), type: "grupo", grupoId: g.id, p1id, p2id, code: `Z${code++}`, ...vacio }));
    }
  });
  return raw;
}
