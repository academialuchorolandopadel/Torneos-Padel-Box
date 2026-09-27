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

// ---- Armado de zonas ----
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

// Partidos de zona: todos contra todos en zonas de 3; en zonas de 4, el
// mini-playoff A y B (1ra ronda) y C y D (se completan con ganadores y perdedores).
export function crearPartidosDeZona(grupos, parejas) {
  const vacio = { done: false, winner: null, s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "" };
  let code = 1; const raw = [];
  grupos.forEach(g => {
    const gIds = parejas.filter(p => p.grupoId === g.id).map(p => p.id);
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
