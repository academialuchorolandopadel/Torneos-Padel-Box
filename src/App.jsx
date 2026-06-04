// ===== PARTE 1 =====
import React, { useState, useEffect } from "react";

const uid = () => Math.random().toString(36).slice(2, 9);
const COURTS = ["BOX 3", "BOX 2", "BOX 1"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const n = (x) => parseInt(x) || 0;
const MIN_GAP = 300;
const MIN_GAP_KO_SAME_DAY = 120;
const MIN_GAP_KO_DIFF_DAY = 180;
const MIN_GAP_KO_EXTRA = 240;
const ADMIN_PIN = "2858";

const SLOT_DEFS = [
  { dia: "JUEVES", hora: "19:00", mins: 1140, bloque: "jue_noche" },
  { dia: "JUEVES", hora: "20:15", mins: 1215, bloque: "jue_noche" },
  { dia: "JUEVES", hora: "21:30", mins: 1290, bloque: "jue_noche" },
  { dia: "VIERNES", hora: "19:00", mins: 2580, bloque: "vie_noche" },
  { dia: "VIERNES", hora: "20:15", mins: 2655, bloque: "vie_noche" },
  { dia: "VIERNES", hora: "21:30", mins: 2730, bloque: "vie_noche" },
  { dia: "SÁBADO", hora: "9:00", mins: 3420, bloque: "sab_man" },
  { dia: "SÁBADO", hora: "10:15", mins: 3495, bloque: "sab_man" },
  { dia: "SÁBADO", hora: "11:30", mins: 3570, bloque: "sab_man" },
  { dia: "SÁBADO", hora: "13:00", mins: 3660, bloque: "sab_tarde" },
  { dia: "SÁBADO", hora: "14:15", mins: 3735, bloque: "sab_tarde" },
  { dia: "SÁBADO", hora: "15:30", mins: 3810, bloque: "sab_tarde" },
  { dia: "SÁBADO", hora: "17:00", mins: 3900, bloque: "sab_noche" },
  { dia: "SÁBADO", hora: "18:15", mins: 3975, bloque: "sab_noche" },
  { dia: "SÁBADO", hora: "19:30", mins: 4050, bloque: "sab_noche" },
  { dia: "SÁBADO", hora: "20:45", mins: 4125, bloque: "sab_noche" },
  { dia: "SÁBADO", hora: "22:00", mins: 4200, bloque: "sab_noche" },
  { dia: "DOMINGO", hora: "9:00", mins: 4860, bloque: "dom_man" },
  { dia: "DOMINGO", hora: "10:15", mins: 4935, bloque: "dom_man" },
  { dia: "DOMINGO", hora: "11:30", mins: 5010, bloque: "dom_man" },
  { dia: "DOMINGO", hora: "13:00", mins: 5100, bloque: "dom_tarde" },
  { dia: "DOMINGO", hora: "14:15", mins: 5175, bloque: "dom_tarde" },
  { dia: "DOMINGO", hora: "15:30", mins: 5250, bloque: "dom_tarde" },
  { dia: "DOMINGO", hora: "17:00", mins: 5340, bloque: "dom_noche" },
  { dia: "DOMINGO", hora: "18:15", mins: 5415, bloque: "dom_noche" },
  { dia: "DOMINGO", hora: "19:30", mins: 5490, bloque: "dom_noche" },
  { dia: "DOMINGO", hora: "20:45", mins: 5565, bloque: "dom_noche" },
  { dia: "DOMINGO", hora: "22:00", mins: 5640, bloque: "dom_noche" },
];
const ALL_SLOTS = SLOT_DEFS.flatMap((s) =>
  COURTS.map((c) => ({ ...s, cancha: c }))
);

const BLOQUE_TO_SLOTS = {};
SLOT_DEFS.forEach(s => {
  if (!BLOQUE_TO_SLOTS[s.bloque]) BLOQUE_TO_SLOTS[s.bloque] = [];
  BLOQUE_TO_SLOTS[s.bloque].push(`${s.dia}|${s.hora}`);
});

const STAGE_PTS = {
  campeon: 100,
  finalista: 75,
  semifinal: 50,
  cuartos: 25,
  octavos: 15,
  zona: 10,
};
const STAGE_LABEL = {
  campeon: "🥇 Campeón",
  finalista: "🥈 Finalista",
  semifinal: "🥉 Semifinal",
  cuartos: "⚡ Cuartos",
  octavos: "📋 Octavos",
  zona: "📍 Zona",
};

function calcZoneDistribution(numPairs) {
  if (numPairs < 6) {
    return { zonasDe3: Math.ceil(numPairs / 3), zonasDe4: 0 };
  }
  const mod = numPairs % 3;
  if (mod === 0) return { zonasDe3: numPairs / 3, zonasDe4: 0 };
  if (mod === 1) return { zonasDe3: (numPairs - 4) / 3, zonasDe4: 1 };
  return { zonasDe3: (numPairs - 8) / 3, zonasDe4: 2 };
}

function getAvailableSlots(pair) {
  const restricted = new Set(pair.restriccionesSlots || []);
  const allKeys = ALL_SLOTS.map(s => `${s.dia}|${s.hora}`);
  const uniqueKeys = [...new Set(allKeys)];
  return uniqueKeys.filter(k => !restricted.has(k));
}

function calcCompatibilityScore(pairA, pairB) {
  const slotsA = getAvailableSlots(pairA);
  const slotsB = getAvailableSlots(pairB);
  const setB = new Set(slotsB);
  return slotsA.filter(s => setB.has(s)).length;
}

function scheduleMatches(newMatches, alreadyPlaced = [], pairMap = {}, isKnockout = false) {
  const occupied = new Set(
    alreadyPlaced.map((m) => `${m.dia}|${m.hora}|${m.cancha}`)
  );
  const pairMins = {};
  alreadyPlaced.forEach((m) => {
    if (m.mins == null) return;
    [m.p1id, m.p2id].forEach((pid) => {
      if (pid) {
        pairMins[pid] = pairMins[pid] || [];
        pairMins[pid].push(m.mins);
      }
    });
  });

  const pairRestrictionSets = {};
  for (const pid of Object.keys(pairMap)) {
    pairRestrictionSets[pid] = new Set(pairMap[pid]?.restriccionesSlots || []);
  }

  const isBlocked = (slot, p1id, p2id) => {
    const key = `${slot.dia}|${slot.hora}`;
    const r1 = p1id ? (pairRestrictionSets[p1id] || new Set()) : new Set();
    const r2 = p2id ? (pairRestrictionSets[p2id] || new Set()) : new Set();
    return r1.has(key) || r2.has(key);
  };

  const slotsToTry = isKnockout
    ? [...ALL_SLOTS].sort((a, b) => b.mins - a.mins)
    : ALL_SLOTS;

  return newMatches.map((m) => {
    for (const slot of slotsToTry) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (occupied.has(key) || isBlocked(slot, m.p1id, m.p2id)) continue;
      const allTimes = [
        ...(m.p1id ? pairMins[m.p1id] || [] : []),
        ...(m.p2id ? pairMins[m.p2id] || [] : []),
      ];
      if (allTimes.every((t) => Math.abs(t - slot.mins) >= MIN_GAP)) {
        occupied.add(key);
        [m.p1id, m.p2id].forEach((pid) => {
          if (pid) {
            pairMins[pid] = pairMins[pid] || [];
            pairMins[pid].push(slot.mins);
          }
        });
        return { ...m, ...slot };
      }
    }
    for (const slot of slotsToTry) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (occupied.has(key) || isBlocked(slot, m.p1id, m.p2id)) continue;
      occupied.add(key);
      [m.p1id, m.p2id].forEach((pid) => {
        if (pid) {
          pairMins[pid] = pairMins[pid] || [];
          pairMins[pid].push(slot.mins);
        }
      });
      return { ...m, ...slot, conflict: true };
    }
    for (const slot of slotsToTry) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (!occupied.has(key)) {
        occupied.add(key);
        return { ...m, ...slot, conflict: true, restrictionConflict: true };
      }
    }
    return {
      ...m,
      dia: "?",
      hora: "?",
      cancha: COURTS[0],
      conflict: true,
      restrictionConflict: true,
    };
  });
}

function roundRobin(ids) {
  const m = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) m.push([ids[i], ids[j]]);
  return m;
}

function calcMatchResult(m) {
  let sa = 0,
    sb = 0;
  if (n(m.s1p1) > n(m.s1p2)) sa++;
  else sb++;
  if (n(m.s2p1) > n(m.s2p2)) sa++;
  else sb++;
  if (sa === sb) {
    if (n(m.tbp1) > n(m.tbp2)) sa++;
    else sb++;
  }
  return sa > sb ? m.p1id : m.p2id;
}

function calcStandings(pairIds, pairs, matches) {
  const byId = Object.fromEntries(pairs.map((p) => [p.id, p]));
  const s = {};
  pairIds.forEach(
    (id) =>
      (s[id] = { id, pts: 0, pj: 0, g: 0, per: 0, sg: 0, sp: 0, gg: 0, gp: 0 })
  );

  const anyZona4 = matches.some(m => m.zona4 && pairIds.includes(m.p1id) && pairIds.includes(m.p2id));

  if (anyZona4) {
    matches
      .filter(
        (m) =>
          m.done && pairIds.includes(m.p1id) && pairIds.includes(m.p2id)
      )
      .forEach((m) => {
        const a = s[m.p1id],
          b = s[m.p2id];
        if (!a || !b) return;
        let sa = 0,
          sb = 0;
        if (n(m.s1p1) > n(m.s1p2)) sa++;
        else sb++;
        if (n(m.s2p1) > n(m.s2p2)) sa++;
        else sb++;
        if (sa === sb) {
          if (n(m.tbp1) > n(m.tbp2)) sa++;
          else sb++;
        }
        const ga = n(m.s1p1) + n(m.s2p1),
          gb = n(m.s1p2) + n(m.s2p2);
        a.pj++;
        b.pj++;
        a.sg += sa;
        a.sp += sb;
        b.sg += sb;
        b.sp += sa;
        a.gg += ga;
        a.gp += gb;
        b.gg += gb;
        b.gp += ga;
        if (sa > sb) {
          a.g++;
          a.pts += 2;
          b.per++;
        } else {
          b.g++;
          b.pts += 2;
          a.per++;
        }
      });

    const matchC = matches.find(m => m.zona4Tipo === "C" && m.done);
    const matchD = matches.find(m => m.zona4Tipo === "D" && m.done);
    const order = [];
    if (matchC) {
      const winnerC = calcMatchResult(matchC);
      const loserC = winnerC === matchC.p1id ? matchC.p2id : matchC.p1id;
      order[0] = winnerC;
      order[1] = loserC;
    }
    if (matchD) {
      const winnerD = calcMatchResult(matchD);
      const loserD = winnerD === matchD.p1id ? matchD.p2id : matchD.p1id;
      order[2] = winnerD;
      order[3] = loserD;
    }
    const remaining = pairIds.filter(id => !order.includes(id));
    for (let i = 0; i < 4; i++) {
      if (!order[i] && remaining.length) order[i] = remaining.shift();
    }
    return order
      .filter(id => id !== undefined)
      .map(id => ({ ...s[id], pair: byId[id] }));
  } else {
    matches
      .filter(
        (m) =>
          m.done && pairIds.includes(m.p1id) && pairIds.includes(m.p2id)
      )
      .forEach((m) => {
        const a = s[m.p1id],
          b = s[m.p2id];
        if (!a || !b) return;
        let sa = 0,
          sb = 0;
        if (n(m.s1p1) > n(m.s1p2)) sa++;
        else sb++;
        if (n(m.s2p1) > n(m.s2p2)) sa++;
        else sb++;
        if (sa === sb) {
          if (n(m.tbp1) > n(m.tbp2)) sa++;
          else sb++;
        }
        const ga = n(m.s1p1) + n(m.s2p1),
          gb = n(m.s1p2) + n(m.s2p2);
        a.pj++;
        b.pj++;
        a.sg += sa;
        a.sp += sb;
        b.sg += sb;
        b.sp += sa;
        a.gg += ga;
        a.gp += gb;
        b.gg += gb;
        b.gp += ga;
        if (sa > sb) {
          a.g++;
          a.pts += 2;
          b.per++;
        } else {
          b.g++;
          b.pts += 2;
          a.per++;
        }
      });
    return pairIds
      .map((id) => ({ ...s[id], pair: byId[id] }))
      .sort(
        (a, b) =>
          b.pts - a.pts ||
          (b.sg - b.sp) - (a.sg - a.sp) ||
          (b.gg - b.gp) - (a.gg - a.gp)
      );
  }
}

function buildFixedBracket(classified) {
  // Crea 4 rondas fijas: Octavos(8), Cuartos(4), Semis(2), Final(1)
  const rounds = [];
  const totalSlots = 16;
  const seeded = Array(totalSlots).fill(null);

  // Intercalar primeros y segundos como antes, pero con array fijo
  const firsts = classified.filter(c => c.pos === 1);
  const seconds = classified.filter(c => c.pos === 2).reverse();
  const ordered = [];
  for (let i = 0; i < 8; i++) {
    if (firsts[i]) ordered.push(firsts[i]);
    else ordered.push(null);
    if (seconds[i]) ordered.push(seconds[i]);
    else ordered.push(null);
  }
  // Llenar hasta 16 con BYE
  while (ordered.length < 16) ordered.push(null);

  // Ronda 0 (Octavos): 8 partidos
  const r0 = [];
  for (let i = 0; i < 8; i++) {
    const a = ordered[i * 2];
    const b = ordered[i * 2 + 1];
    const p1id = a?.pairId || null;
    const p2id = b?.pairId || null;
    const auto = !a || !b; // BYE si falta alguno
    const winner = !b ? p1id : (!a ? p2id : null);
    r0.push({
      id: uid(),
      round: 0,
      slot: i,
      p1id,
      p1label: a ? `1° ${a.grupo}` : "BYE",
      p2id,
      p2label: b ? `2° ${b.grupo}` : "BYE",
      done: auto,
      winner,
      auto,
      s1p1: "",
      s1p2: "",
      s2p1: "",
      s2p2: "",
      tbp1: "",
      tbp2: "",
      prevIds: [],
    });
  }
  rounds.push(r0);

  // Ronda 1 (Cuartos): 4 partidos
  const r1 = [];
  for (let i = 0; i < 4; i++) {
    const left = r0[i * 2];
    const right = r0[i * 2 + 1];
    r1.push({
      id: uid(),
      round: 1,
      slot: i,
      p1id: left.auto ? left.winner : null,
      p1label: left.auto ? `G ${left.id.slice(0, 4)}` : `G Oct ${i * 2 + 1}`,
      p2id: right.auto ? right.winner : null,
      p2label: right.auto ? `G ${right.id.slice(0, 4)}` : `G Oct ${i * 2 + 2}`,
      done: false,
      winner: null,
      auto: false,
      s1p1: "",
      s1p2: "",
      s2p1: "",
      s2p2: "",
      tbp1: "",
      tbp2: "",
      prevIds: [left.id, right.id],
    });
  }
  rounds.push(r1);

  // Ronda 2 (Semis): 2 partidos
  const r2 = [];
  for (let i = 0; i < 2; i++) {
    const left = r1[i * 2];
    const right = r1[i * 2 + 1];
    r2.push({
      id: uid(),
      round: 2,
      slot: i,
      p1id: null,
      p1label: `G ${left.id.slice(0, 4)}`,
      p2id: null,
      p2label: `G ${right.id.slice(0, 4)}`,
      done: false,
      winner: null,
      auto: false,
      s1p1: "",
      s1p2: "",
      s2p1: "",
      s2p2: "",
      tbp1: "",
      tbp2: "",
      prevIds: [left.id, right.id],
    });
  }
  rounds.push(r2);

  // Ronda 3 (Final): 1 partido
  const left = r2[0];
  const right = r2[1];
  rounds.push([
    {
      id: uid(),
      round: 3,
      slot: 0,
      p1id: null,
      p1label: `G ${left.id.slice(0, 4)}`,
      p2id: null,
      p2label: `G ${right.id.slice(0, 4)}`,
      done: false,
      winner: null,
      auto: false,
      s1p1: "",
      s1p2: "",
      s2p1: "",
      s2p2: "",
      tbp1: "",
      tbp2: "",
      prevIds: [left.id, right.id],
    },
  ]);

  return rounds;
}

function scheduleKnockoutMatches(knockoutRounds, existingMatches, parejas) {
  // Solo programa partidos de la ronda que no sean auto y tengan ambos jugadores
  const allKnockoutMatches = knockoutRounds.flat().filter(m => !m.auto && m.p1id && m.p2id && !m.dia);
  if (allKnockoutMatches.length === 0) return knockoutRounds;

  const pairMap = Object.fromEntries(parejas.map(p => [p.id, p]));

  const occupied = new Set(
    existingMatches.map((m) => `${m.dia}|${m.hora}|${m.cancha}`)
  );

  const pairMins = {};
  existingMatches.forEach((m) => {
    if (m.mins == null) return;
    [m.p1id, m.p2id].forEach((pid) => {
      if (pid) {
        pairMins[pid] = pairMins[pid] || [];
        pairMins[pid].push(m.mins);
      }
    });
  });

  // Para cada partido a programar, buscar slot que cumpla gaps de KO
  const programarPartido = (m) => {
    const slotsTarde = [...ALL_SLOTS].sort((a, b) => b.mins - a.mins);
    for (const slot of slotsTarde) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (occupied.has(key)) continue;

      // Verificar gaps KO para los jugadores
      const timesP1 = pairMins[m.p1id] || [];
      const timesP2 = pairMins[m.p2id] || [];
      const allTimes = [...timesP1, ...timesP2];
      let gapOk = true;
      for (const t of allTimes) {
        const diff = Math.abs(t - slot.mins);
        // Mismo día: MIN_GAP_KO_SAME_DAY, distinto día: MIN_GAP_KO_DIFF_DAY, extra: MIN_GAP_KO_EXTRA
        // Simplificamos: si mismo día, al menos 120 min; si distinto día, al menos 180 min; sino 240 min.
        const sameDay = SLOT_DEFS.find(s => s.mins === t)?.dia === slot.dia;
        const minGap = sameDay ? MIN_GAP_KO_SAME_DAY : MIN_GAP_KO_DIFF_DAY;
        if (diff < minGap) { gapOk = false; break; }
      }
      if (gapOk) {
        occupied.add(key);
        [m.p1id, m.p2id].forEach((pid) => {
          pairMins[pid] = pairMins[pid] || [];
          pairMins[pid].push(slot.mins);
        });
        return { ...m, ...slot };
      }
    }
    // Si no se encontró slot ideal, asignar el primero disponible sin restricción de gap KO, solo ocupación
    for (const slot of slotsTarde) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (!occupied.has(key)) {
        occupied.add(key);
        [m.p1id, m.p2id].forEach((pid) => {
          pairMins[pid] = pairMins[pid] || [];
          pairMins[pid].push(slot.mins);
        });
        return { ...m, ...slot, conflict: true };
      }
    }
    return m;
  };

  const scheduledMap = new Map();
  allKnockoutMatches.forEach(m => {
    const sched = programarPartido(m);
    scheduledMap.set(m.id, sched);
  });

  return knockoutRounds.map(round =>
    round.map(m => {
      const sched = scheduledMap.get(m.id);
      return sched ? sched : m;
    })
  );
}

function calcPairStages(cat) {
  const stages = {};
  if (!cat.knockoutGenerated || !cat.knockoutRounds?.length) {
    cat.parejas.forEach((p) => {
      stages[p.id] = "zona";
    });
    return stages;
  }
  const classified = new Set();
  cat.knockoutRounds[0].forEach((m) => {
    if (m.p1id) classified.add(m.p1id);
    if (m.p2id) classified.add(m.p2id);
  });
  cat.parejas.forEach((p) => {
    if (!classified.has(p.id)) stages[p.id] = "zona";
  });
  const total = cat.knockoutRounds.length;
  cat.knockoutRounds.forEach((round, ri) => {
    round.forEach((m) => {
      if (!m.done || !m.winner) return;
      const loser = m.winner === m.p1id ? m.p2id : m.p1id;
      const rem = total - 1 - ri;
      if (rem === 0) {
        stages[m.winner] = "campeon";
        if (loser) stages[loser] = "finalista";
      } else if (rem === 1 && loser) stages[loser] = "semifinal";
      else if (rem === 2 && loser) stages[loser] = "cuartos";
      else if (loser) stages[loser] = "octavos";
    });
  });
  return stages;
}

function getKnockoutWithSchedules(knockoutRounds, existingMatches, parejas) {
  if (!knockoutRounds || !knockoutRounds.length) return knockoutRounds;
  const allMatches = knockoutRounds.flat().filter(m => !m.auto && m.p1id && m.p2id);
  if (allMatches.length === 0) return knockoutRounds;
  const pairMap = Object.fromEntries(parejas.map(p => [p.id, p]));
  const scheduled = scheduleMatches(allMatches, existingMatches, pairMap, true);
  const scheduledMap = new Map(scheduled.map(m => [m.id, m]));
  return knockoutRounds.map(round =>
    round.map(m => {
      if (m.auto) return m;
      const scheduledMatch = scheduledMap.get(m.id);
      return scheduledMatch ? { ...m, ...scheduledMatch } : m;
    })
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--bg:#060d18;--bg2:#0c1a2e;--bg3:#071422;--border:#0e2540;--accent:#3dffa0;--accent2:#00d4ff;--text:#ddeeff;--muted:#3a6080;--danger:#ff3355;--gold:#ffcb47;--silver:#b8c8d8;--bronze:#cd8e5a}
  body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
  *{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
  .app{min-height:100vh;display:flex;flex-direction:column}
  .hdr{background:rgba(6,13,24,.95);border-bottom:1px solid var(--border);padding:10px 20px;position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .logo{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:var(--accent);letter-spacing:2px}
  .logo em{color:var(--text);font-style:normal}
  .hdr-name-wrap{display:flex;align-items:center;gap:6px;border-left:2px solid var(--border);padding-left:12px}
  .hdr-name{font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;color:var(--text);letter-spacing:1px;text-transform:uppercase}
  .edit-inline{background:transparent;border:1px solid var(--accent);border-radius:6px;color:var(--text);font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;padding:3px 8px;outline:none;width:200px}
  .icon-btn{background:transparent;border:none;color:var(--muted);cursor:pointer;padding:3px 5px;border-radius:5px;font-size:13px}
  .icon-btn:hover{color:var(--accent)}
  .nav-tabs{display:flex;gap:3px;background:var(--bg2);border-radius:10px;padding:3px;flex-wrap:wrap;margin-left:auto}
  .nav-tab{padding:7px 13px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
  .nav-tab:hover{color:var(--text)}
  .nav-tab.on{background:var(--accent);color:#060d18;font-weight:700}
  .nav-tab.jug.on{background:var(--accent2);color:#060d18}
  .main{flex:1;padding:24px 20px;max-width:1140px;margin:0 auto;width:100%}
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px}
  .card+.card{margin-top:16px}
  .card-title{font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;color:var(--accent);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}
  .inp{background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;padding:9px 12px;outline:none;width:100%;transition:border-color .15s}
  .inp:focus{border-color:var(--accent)}
  .inp::placeholder{color:var(--muted)}
  .inp[type=number]{-moz-appearance:textfield}
  .inp[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
  .btn{padding:9px 18px;border-radius:9px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
  .btn:disabled{opacity:.4;cursor:not-allowed}
  .btn-primary{background:var(--accent);color:#060d18}
  .btn-primary:hover:not(:disabled){filter:brightness(1.1)}
  .btn-secondary{background:var(--bg3);color:var(--text);border:1px solid var(--border)}
  .btn-secondary:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
  .btn-danger{background:rgba(255,51,85,.15);color:var(--danger);border:1px solid rgba(255,51,85,.3)}
  .btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}
  .btn-ghost:hover:not(:disabled){color:var(--text)}
  .btn-cyan{background:rgba(0,212,255,.1);color:var(--accent2);border:1px solid rgba(0,212,255,.3)}
  .btn-sm{padding:5px 11px;font-size:12px;border-radius:7px}
  .btn-xs{padding:3px 8px;font-size:11px;border-radius:5px}
  .tbl{width:100%;border-collapse:collapse;font-size:13px}
  .tbl th{text-align:left;padding:9px 10px;font-family:'Oswald',sans-serif;font-size:10px;font-weight:600;color:var(--accent);letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid var(--border)}
  .tbl td{padding:9px 10px;border-bottom:1px solid rgba(14,37,64,.5);color:#a0bcd0;vertical-align:middle}
  .tbl tr:last-child td{border-bottom:none}
  .tbl .em{color:var(--text);font-weight:500}
  .badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;font-family:'Oswald',sans-serif;letter-spacing:.5px}
  .bg{background:rgba(61,255,160,.12);color:var(--accent)}.bb{background:rgba(0,212,255,.12);color:var(--accent2)}
  .by{background:rgba(255,203,71,.12);color:var(--gold)}.bx{background:rgba(100,130,160,.1);color:var(--muted)}
  .row{display:flex;align-items:center;gap:10px}.col{display:flex;flex-direction:column;gap:5px}
  .wrap{flex-wrap:wrap}.f1{flex:1;min-width:0}
  .g8{gap:8px}.g12{gap:12px}
  .mb8{margin-bottom:8px}.mb12{margin-bottom:12px}.mb16{margin-bottom:16px}
  .mt8{margin-top:8px}.mt12{margin-top:12px}
  .just-between{justify-content:space-between}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
  .lbl{font-size:10px;font-weight:600;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;display:block}
  .sec-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
  .sec-title{font-family:'Oswald',sans-serif;font-size:22px;font-weight:600;color:var(--text);letter-spacing:1px;text-transform:uppercase}
  .empty{text-align:center;padding:48px 20px;color:var(--muted)}
  .empty-ico{font-size:40px;margin-bottom:12px}
  .stat-box{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 16px;text-align:center;min-width:70px}
  .stat-val{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:var(--accent);line-height:1}
  .stat-lbl{font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-top:3px}
  .hero{text-align:center;padding:56px 20px 36px}
  .hero-title{font-family:'Oswald',sans-serif;font-size:52px;font-weight:700;color:var(--text);letter-spacing:4px;text-transform:uppercase;line-height:1;margin-bottom:6px}
  .hero-title span{color:var(--accent)}
  .hero-sub{color:var(--muted);font-size:14px;margin-bottom:28px}
  .t-card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;transition:all .2s;text-align:left;display:block;width:100%;position:relative}
  .t-card:hover{border-color:var(--accent);transform:translateY(-2px)}
  .t-card-name{font-family:'Oswald',sans-serif;font-size:20px;font-weight:600;color:var(--text);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
  .t-card-meta{font-size:12px;color:var(--muted);margin-bottom:10px}
  .t-card-del{position:absolute;top:12px;right:12px;opacity:0;transition:opacity .15s}
  .t-card:hover .t-card-del{opacity:1}
  .cat-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
  .cat-tab{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:'Oswald',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
  .cat-tab.on{background:rgba(61,255,160,.08);border-color:var(--accent);color:var(--accent)}
  .cat-tab.add{border-style:dashed}
  .sched-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .court-hdr{font-family:'Oswald',sans-serif;font-size:13px;font-weight:600;color:var(--accent);letter-spacing:2px;text-align:center;padding:10px;background:rgba(61,255,160,.06);border:1px solid rgba(61,255,160,.2);border-radius:10px 10px 0 0}
  .court-body{border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;overflow:hidden}
  .court-slot{padding:9px 12px;border-bottom:1px solid rgba(14,37,64,.6);display:flex;align-items:center;justify-content:space-between}
  .court-slot:last-child{border-bottom:none}
  .slot-day{font-size:9px;color:var(--muted);font-weight:600;letter-spacing:1px;text-transform:uppercase}
  .slot-time{font-size:13px;color:var(--text);font-weight:600;margin-bottom:2px}
  .slot-match{font-size:11px;color:var(--muted);line-height:1.3;max-width:120px}
  .slot-code{background:rgba(61,255,160,.12);color:var(--accent);padding:2px 7px;border-radius:4px;font-family:'Oswald',sans-serif;font-size:12px;font-weight:700}
  .ctag{font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;background:rgba(255,203,71,.15);color:var(--gold)}
  .ctag-r{background:rgba(255,51,85,.12);color:var(--danger)}
  .pos-g{color:var(--gold)}.pos-s{color:var(--silver)}.pos-b{color:var(--bronze)}
  .classif{font-size:9px;color:var(--accent);margin-left:3px}
  .res-set{font-family:'Oswald',sans-serif;font-size:12px;color:var(--text);font-weight:600;background:var(--bg3);padding:2px 7px;border-radius:5px;display:inline-block;margin-right:4px}
  .bracket-wrap{overflow-x:auto;padding-bottom:8px}
  .bracket{display:flex;min-width:max-content}
  .br-round{display:flex;flex-direction:column;width:200px;flex-shrink:0}
  .br-round-hdr{font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;color:var(--accent);letter-spacing:2px;text-transform:uppercase;text-align:center;padding:8px 4px;border-bottom:1px solid var(--border)}
  .br-matches{display:flex;flex-direction:column;justify-content:space-around;flex:1;padding:12px 8px;gap:8px}
  .br-match{background:var(--bg3);border:1px solid var(--border);border-radius:9px;overflow:hidden;cursor:pointer;transition:border-color .15s}
  .br-match:hover{border-color:var(--accent)}.br-match.done{border-color:rgba(61,255,160,.3)}
  .br-team{padding:7px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:11px}
  .br-team:last-child{border-bottom:none}
  .br-team.win{color:var(--accent);font-weight:700}.br-team.tbd{color:var(--muted);font-style:italic}
  .br-score{font-family:'Oswald',sans-serif;font-size:11px;font-weight:600}
  .br-schedule{font-size:9px;color:var(--muted);padding:2px 8px;background:rgba(0,0,0,0.2);text-align:center}
  .overlay{position:fixed;inset:0;background:rgba(6,13,24,.9);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}
  .modal{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:480px;margin:auto}
  .modal-lg{max-width:600px}
  .modal-title{font-family:'Oswald',sans-serif;font-size:20px;font-weight:600;color:var(--text);margin-bottom:20px;letter-spacing:1px;text-transform:uppercase}
  .match-info{background:var(--bg3);border-radius:9px;padding:12px;margin-bottom:20px}
  .match-teams{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px}
  .match-meta{font-size:11px;color:var(--muted)}
  .score-row{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:10px}
  .score-inp{width:52px;text-align:center;font-family:'Oswald',sans-serif;font-size:20px;font-weight:700}
  .score-vs{color:var(--muted);font-size:14px}
  .score-lbl{font-family:'Oswald',sans-serif;font-size:11px;color:var(--muted);text-align:center;width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .winner-banner{text-align:center;padding:10px;background:rgba(61,255,160,.08);border:1px solid rgba(61,255,160,.2);border-radius:9px;margin-bottom:16px}
  .winner-text{font-family:'Oswald',sans-serif;font-size:15px;font-weight:700;color:var(--accent)}
  .set-section{margin-bottom:16px}
  .set-title{font-family:'Oswald',sans-serif;font-size:11px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:10px}
  .tb .set-title{color:var(--gold)}
  .pago-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:none;transition:all .15s;font-family:'DM Sans',sans-serif}
  .pago-ok{background:rgba(61,255,160,.1);color:var(--accent);border:1px solid rgba(61,255,160,.3)}
  .pago-no{background:rgba(255,51,85,.08);color:var(--danger);border:1px solid rgba(255,51,85,.2)}
  .rank-row{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg3);border-radius:10px;margin-bottom:8px;border:1px solid var(--border);cursor:pointer;transition:border-color .15s}
  .rank-row:hover{border-color:var(--accent)}
  .rank-pos{font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;color:var(--muted);min-width:32px;text-align:center}
  .rank-pos.p1{color:var(--gold)}.rank-pos.p2{color:var(--silver)}.rank-pos.p3{color:var(--bronze)}
  .rank-pts{font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;color:var(--accent)}
  .rank-pts-lbl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
  .hist-item{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg3);border-radius:8px;margin-bottom:6px;border:1px solid var(--border)}
  .alert{padding:10px 14px;border-radius:9px;font-size:12px;margin-bottom:16px}
  .alert-warn{background:rgba(255,203,71,.08);border:1px solid rgba(255,203,71,.25);color:var(--gold)}
  .divider{height:1px;background:var(--border);margin:16px 0}
  .restr-toggle{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:9px;border:1px dashed var(--border);background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;width:100%;text-align:left;margin-bottom:12px}
  .restr-toggle.active{background:rgba(61,255,160,.06);border-color:var(--accent);color:var(--accent);border-style:solid}
  .restr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px;margin-bottom:12px}
  .restr-bloque{display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg3);color:var(--muted);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;text-align:left}
  .restr-bloque:hover{border-color:var(--muted);color:var(--text)}
  .restr-bloque.blocked{background:rgba(255,51,85,.08);border-color:rgba(255,51,85,.4);color:var(--danger)}
  .restr-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:600;background:rgba(255,51,85,.08);color:var(--danger);border:1px solid rgba(255,51,85,.2);margin:1px 0}
  .restr-ok{background:rgba(61,255,160,.08);color:var(--accent);border-color:rgba(61,255,160,.2)}
  @media(max-width:700px){
    .grid2,.grid3,.sched-grid{grid-template-columns:1fr}
    .hero-title{font-size:38px}.nav-tabs{width:100%}
    .restr-grid{grid-template-columns:1fr 1fr}
  }
  .slot-grid { display: flex; gap: 12px; overflow-x: auto; }
  .slot-day-col { min-width: 140px; }
  .slot-day-title { font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 600; color: var(--accent); letter-spacing: 1px; margin-bottom: 8px; text-transform: uppercase; }
  .slot-btn { display: block; width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--muted); font-size: 11px; font-weight: 500; cursor: pointer; margin-bottom: 4px; transition: all .15s; text-align: center; }
  .slot-btn:hover { border-color: var(--muted); color: var(--text); }
  .slot-btn.blocked { background: rgba(255,51,85,.12); border-color: rgba(255,51,85,.4); color: var(--danger); }
  .mini-bracket { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
  .mini-match { background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 11px; }
  .mini-match-header { font-size: 10px; color: var(--accent); font-weight: 700; margin-bottom: 4px; }
  .mini-team { display: flex; justify-content: space-between; }
  .mini-team .tbd { color: var(--muted); font-style: italic; }
  .mini-result { margin-top: 4px; font-family: 'Oswald', sans-serif; font-size: 10px; }
`;

// ===== PARTE 2 =====
// ===== PARTE 2 =====
// ─── Pin Modal ───
function PinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem("padelbox_admin", "true");
      onSuccess();
    } else {
      setError("PIN incorrecto");
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Acceso Administrador</div>
        <div className="col mb12">
          <label className="lbl">Ingresá el PIN</label>
          <input
            className="inp"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
        </div>
        {error && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div className="row g8">
          <button className="btn btn-primary f1" onClick={handleSubmit}>Entrar como admin</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Player Login Modal ───
function PlayerLoginModal({ error, onClearError, onSubmit, onClose }) {
  const [cedula, setCedula] = useState("");

  const handleSubmit = () => {
    onClearError();
    onSubmit(cedula.trim());
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Acceso Jugador</div>
        <div className="col mb12">
          <label className="lbl">Ingresá tu cédula</label>
          <input
            className="inp"
            type="text"
            inputMode="numeric"
            value={cedula}
            onChange={(e) => { setCedula(e.target.value); onClearError(); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
        </div>
        {error && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div className="row g8">
          <button className="btn btn-primary f1" onClick={handleSubmit}>Entrar</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Result Modal ───
function ResultModal({ match, cat, onSave, onClose }) {
  const byId = Object.fromEntries(cat.parejas.map((p) => [p.id, p]));
  const [form, setForm] = useState({
    s1p1: match.s1p1 || "",
    s1p2: match.s1p2 || "",
    s2p1: match.s2p1 || "",
    s2p2: match.s2p2 || "",
    tbp1: match.tbp1 || "",
    tbp2: match.tbp2 || "",
  });
  const set1w = n(form.s1p1) !== n(form.s1p2) ? (n(form.s1p1) > n(form.s1p2) ? 1 : 2) : null;
  const set2w = n(form.s2p1) !== n(form.s2p2) ? (n(form.s2p1) > n(form.s2p2) ? 1 : 2) : null;
  const needTB = set1w && set2w && set1w !== set2w;
  const getWinner = () => {
    let sa = 0, sb = 0;
    if (set1w === 1) sa++; else if (set1w === 2) sb++;
    if (set2w === 1) sa++; else if (set2w === 2) sb++;
    if (sa === sb) { if (n(form.tbp1) > n(form.tbp2)) sa++; else if (n(form.tbp2) > n(form.tbp1)) sb++; }
    return sa > sb ? match.p1id : sb > sa ? match.p2id : null;
  };
  const winner = getWinner(), p1 = byId[match.p1id], p2 = byId[match.p2id];
  const f = (k) => ({
    className: "inp score-inp",
    type: "number",
    min: 0,
    max: 99,
    value: form[k],
    onChange: (e) => setForm((p) => ({ ...p, [k]: e.target.value })),
  });
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Resultado del Partido</div>
        <div className="match-info">
          <div className="match-teams">
            {p1?.nombre || "?"} <span style={{ color: "var(--muted)", fontWeight: 400 }}>vs</span> {p2?.nombre || "?"}
          </div>
          <div className="match-meta">
            {[match.code, match.dia, match.hora, match.cancha].filter(Boolean).join(" · ")}
          </div>
        </div>
        {[
          ["Set 1", "s1p1", "s1p2"],
          ["Set 2", "s2p1", "s2p2"],
        ].map(([lbl, k1, k2]) => (
          <div key={lbl} className="set-section">
            <div className="set-title">{lbl}</div>
            <div className="score-row">
              <span className="score-lbl" style={{ textAlign: "right" }}>{p1?.nombre}</span>
              <input {...f(k1)} />
              <span className="score-vs">-</span>
              <input {...f(k2)} />
              <span className="score-lbl">{p2?.nombre}</span>
            </div>
          </div>
        ))}
        {needTB && (
          <div className="set-section tb">
            <div className="set-title">🔥 Super Tie-Break</div>
            <div className="score-row">
              <span className="score-lbl" style={{ textAlign: "right" }}>{p1?.nombre}</span>
              <input {...f("tbp1")} />
              <span className="score-vs">-</span>
              <input {...f("tbp2")} />
              <span className="score-lbl">{p2?.nombre}</span>
            </div>
          </div>
        )}
        {winner && (
          <div className="winner-banner mb12">
            <div className="winner-text">🏆 {byId[winner]?.nombre}</div>
          </div>
        )}
        <div className="row g8">
          <button
            className="btn btn-primary f1"
            onClick={() => winner && onSave(match.id, { ...form, done: true })}
            disabled={!winner}
          >
            Guardar
          </button>
          {match.done && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() =>
                onSave(match.id, {
                  s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "", done: false,
                })
              }
            >
              Borrar
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Pair Modal ───
function EditPairModal({ pair, onSave, onClose }) {
  const [form, setForm] = useState({
    nombre: pair.nombre || "",
    j1nombre: pair.j1nombre || pair.j1 || "",
    j1cedula: pair.j1cedula || "",
    j2nombre: pair.j2nombre || pair.j2 || "",
    j2cedula: pair.j2cedula || "",
    sinProblemas: pair.sinProblemas !== false,
    notasLibres: pair.notasLibres || "",
  });
  const [slotsRestr, setSlotsRestr] = useState(new Set(pair.restriccionesSlots || []));
  const s = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  function toggleSlot(slotKey) {
    setSlotsRestr((prev) => {
      const n = new Set(prev);
      n.has(slotKey) ? n.delete(slotKey) : n.add(slotKey);
      return n;
    });
    if (form.sinProblemas) setForm((p) => ({ ...p, sinProblemas: false }));
  }

  function toggleSinProblemas() {
    if (!form.sinProblemas) setSlotsRestr(new Set());
    setForm((p) => ({ ...p, sinProblemas: !p.sinProblemas }));
  }

  const slotsByDay = SLOT_DEFS.reduce((acc, s) => {
    const key = s.dia;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-title">Editar Pareja</div>
        <div className="col mb12">
          <label className="lbl">Nombre de la pareja</label>
          <input className="inp" value={form.nombre} onChange={s("nombre")} placeholder="González / Martínez" />
        </div>
        <div className="divider" />
        <div className="grid2 mb12">
          <div className="col">
            <label className="lbl">Jugador 1 — Nombre</label>
            <input className="inp" value={form.j1nombre} onChange={s("j1nombre")} />
          </div>
          <div className="col">
            <label className="lbl">Jugador 1 — Cédula</label>
            <input className="inp" value={form.j1cedula} onChange={s("j1cedula")} placeholder="Ej: 1234567" />
          </div>
        </div>
        <div className="grid2 mb12">
          <div className="col">
            <label className="lbl">Jugador 2 — Nombre</label>
            <input className="inp" value={form.j2nombre} onChange={s("j2nombre")} />
          </div>
          <div className="col">
            <label className="lbl">Jugador 2 — Cédula</label>
            <input className="inp" value={form.j2cedula} onChange={s("j2cedula")} placeholder="Ej: 7654321" />
          </div>
        </div>
        <div className="divider" />
        <div className="card-title" style={{ marginBottom: 12 }}>Restricciones de Horario (Slots)</div>
        <button className={`restr-toggle${form.sinProblemas ? " active" : ""}`} onClick={toggleSinProblemas}>
          {form.sinProblemas ? "✅ Sin problemas de horario" : "☐ Sin problemas de horario"}
        </button>
        {!form.sinProblemas && (
          <>
            <div className="lbl" style={{ marginBottom: 8 }}>Marcá los slots donde NO pueden jugar</div>
            <div className="slot-grid">
              {Object.entries(slotsByDay).map(([day, slots]) => (
                <div key={day} className="slot-day-col">
                  <div className="slot-day-title">{day}</div>
                  {slots.map((slot) => {
                    const key = `${slot.dia}|${slot.hora}`;
                    const blocked = slotsRestr.has(key);
                    return (
                      <button
                        key={key}
                        className={`slot-btn${blocked ? " blocked" : ""}`}
                        onClick={() => toggleSlot(key)}
                      >
                        {blocked ? "🚫" : "🕐"} {slot.hora}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="col mb12 mt8">
              <label className="lbl">Notas adicionales</label>
              <input className="inp" value={form.notasLibres} onChange={s("notasLibres")} placeholder="ej: solo pueden después de las 16hs el sábado" />
            </div>
          </>
        )}
        <div className="row g8 mt8">
          <button className="btn btn-primary f1" onClick={() => onSave({
            ...pair,
            ...form,
            j1: form.j1nombre,
            j2: form.j2nombre,
            restriccionesSlots: Array.from(slotsRestr),
            sinProblemas: form.sinProblemas,
            restricciones: undefined
          })}>
            Guardar cambios
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Match Modal ───
function EditMatchModal({ match, cat, allPartidos, onSave, onClose }) {
  const days = [...new Set(SLOT_DEFS.map(s => s.dia))];
  const [selectedDay, setSelectedDay] = useState(match.dia && match.dia !== "?" ? match.dia : (days[0] || ""));
  const [selectedHour, setSelectedHour] = useState(match.hora && match.hora !== "?" ? match.hora : "");
  const [selectedCourt, setSelectedCourt] = useState(match.cancha || COURTS[0]);
  const [conflicts, setConflicts] = useState([]);

  const hoursForDay = SLOT_DEFS.filter(s => s.dia === selectedDay).map(s => s.hora);
  useEffect(() => {
    if (!selectedHour && hoursForDay.length) setSelectedHour(hoursForDay[0]);
  }, [selectedDay, hoursForDay, selectedHour]);

  const getMinutesForSlot = (dia, hora) => {
    const slot = SLOT_DEFS.find(s => s.dia === dia && s.hora === hora);
    return slot ? slot.mins : 0;
  };

  const checkConflicts = () => {
    const newConflicts = [];
    const currentMins = getMinutesForSlot(selectedDay, selectedHour);
    const sameSlot = allPartidos.find(p => p.id !== match.id && p.dia === selectedDay && p.hora === selectedHour && p.cancha === selectedCourt);
    if (sameSlot) {
      newConflicts.push({ type: 'slot', match: sameSlot });
    }
    const jugadores = [match.p1id, match.p2id].filter(Boolean);
    jugadores.forEach(jugadorId => {
      const partidosJugador = allPartidos.filter(p => p.id !== match.id && (p.p1id === jugadorId || p.p2id === jugadorId));
      partidosJugador.forEach(otroPartido => {
        const otroMins = getMinutesForSlot(otroPartido.dia, otroPartido.hora);
        if (Math.abs(currentMins - otroMins) < MIN_GAP) {
          newConflicts.push({ type: 'rest', match: otroPartido, jugador: jugadorId });
        }
      });
    });
    setConflicts(newConflicts);
    return newConflicts;
  };

  useEffect(() => {
    checkConflicts();
  }, [selectedDay, selectedHour, selectedCourt]);

  const handleSave = () => {
    const hasConflicts = conflicts.length > 0;
    onSave(match.id, {
      dia: selectedDay,
      hora: selectedHour,
      cancha: selectedCourt,
      conflict: hasConflicts,
      mins: getMinutesForSlot(selectedDay, selectedHour)
    });
  };

  const renderConflicts = () => {
    if (conflicts.length === 0) {
      return <div className="badge bg" style={{ marginBottom: 16 }}>✓ Sin conflictos</div>;
    }
    return (
      <div className="alert alert-warn" style={{ marginBottom: 16 }}>
        {conflicts.map((c, idx) => (
          <div key={idx}>
            {c.type === 'slot' ? `⚠️ Conflicto de horario: el partido ${c.match.code} ya ocupa ese slot.` : 
              `⚠️ Conflicto de descanso: uno de los jugadores juega otro partido (${c.match.code}) muy cerca.`}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Editar Partido</div>
        <div className="match-info">
          <div className="match-teams">
            {cat.parejas.find(p => p.id === match.p1id)?.nombre || "?"} vs {cat.parejas.find(p => p.id === match.p2id)?.nombre || "?"}
          </div>
          <div className="match-meta">{match.code}</div>
        </div>
        <div className="col mb12">
          <label className="lbl">Día</label>
          <select className="inp" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
            {days.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="col mb12">
          <label className="lbl">Hora</label>
          <select className="inp" value={selectedHour} onChange={(e) => setSelectedHour(e.target.value)}>
            {hoursForDay.map(h => <option key={h}>{h}</option>)}
          </select>
        </div>
        <div className="col mb12">
          <label className="lbl">Cancha</label>
          <select className="inp" value={selectedCourt} onChange={(e) => setSelectedCourt(e.target.value)}>
            {COURTS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {renderConflicts()}
        <div className="row g8">
          <button className="btn btn-primary f1" onClick={handleSave}>Guardar de todos modos</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inscripción ───
function Inscripcion({ cat, onAdd, onDelete, onEditPair, onTogglePago, isAdmin }) {
  if (!cat || !cat.parejas || !cat.grupos) {
    return <div className="empty">Cargando datos de la categoría...</div>;
  }
  const empty = { nombre: "", j1nombre: "", j1cedula: "", j2nombre: "", j2cedula: "" };
  const [form, setForm] = useState(empty);
  const [showAdd, setShowAdd] = useState(true);
  const gName = Object.fromEntries(cat.grupos.map((g) => [g.id, g.nombre]));
  function handleAdd() {
    if (!form.nombre.trim() || !form.j1nombre.trim() || !form.j2nombre.trim()) return;
    onAdd({
      id: uid(),
      nombre: form.nombre.trim(),
      j1nombre: form.j1nombre.trim(),
      j1cedula: form.j1cedula.trim(),
      j2nombre: form.j2nombre.trim(),
      j2cedula: form.j2cedula.trim(),
      j1: form.j1nombre.trim(),
      j2: form.j2nombre.trim(),
      grupoId: null,
      pagoJ1: false,
      pagoJ2: false,
      sinProblemas: true,
      restriccionesSlots: [],
      notasLibres: "",
    });
    setForm(empty);
  }
  const s = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const totalPagos = cat.parejas.reduce((acc, p) => acc + (p.pagoJ1 ? 1 : 0) + (p.pagoJ2 ? 1 : 0), 0);

  const formatSlots = (pair) => {
    if (pair.sinProblemas !== false && !pair.restriccionesSlots?.length) {
      return <span className="restr-badge restr-ok">✓ Sin problemas</span>;
    }
    const slots = pair.restriccionesSlots || [];
    if (slots.length === 0) return <span className="restr-badge restr-ok">✓ Sin problemas</span>;
    const byDay = {};
    slots.forEach(s => {
      const [dia, hora] = s.split("|");
      if (!byDay[dia]) byDay[dia] = [];
      byDay[dia].push(hora);
    });
    return (
      <div className="col" style={{ gap: 2 }}>
        {Object.entries(byDay).map(([dia, horas]) => (
          <div key={dia} style={{ fontSize: 9, lineHeight: 1.3 }}>
            🚫 {dia.slice(0,3)} {horas.join(", ")}
          </div>
        ))}
        {pair.notasLibres && <div style={{ fontSize: 10, color: "var(--muted)" }}>{pair.notasLibres}</div>}
      </div>
    );
  };

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Inscripción</div>
        <div className="row g8 wrap">
          <div className="stat-box"><div className="stat-val">{cat.parejas.length}</div><div className="stat-lbl">Parejas</div></div>
          <div className="stat-box"><div className="stat-val">{cat.parejas.length * 2}</div><div className="stat-lbl">Jugadores</div></div>
          <div className="stat-box"><div className="stat-val" style={{ color: "var(--gold)" }}>{totalPagos}/{cat.parejas.length * 2}</div><div className="stat-lbl">Pagos</div></div>
        </div>
      </div>
      {cat.fixtureGenerado && <div className="alert alert-warn">⚠️ Fixture generado. Nuevas parejas se asignan a la zona con menos integrantes respetando las restricciones y el descanso de 5 horas.</div>}
      {showAdd ? (
        <div className="card mb16">
          <div className="row just-between mb12">
            <div className="card-title" style={{ margin: 0 }}>Agregar Pareja</div>
            {cat.fixtureGenerado && <button className="icon-btn" onClick={() => setShowAdd(false)} disabled={!isAdmin}>✕</button>}
          </div>
          <div className="col f1 mb12"><label className="lbl">Nombre pareja</label><input className="inp" placeholder="González / Martínez" value={form.nombre} onChange={s("nombre")} /></div>
          <div className="grid2 mb12">
            <div className="col"><label className="lbl">J1 — Nombre</label><input className="inp" value={form.j1nombre} onChange={s("j1nombre")} /></div>
            <div className="col"><label className="lbl">J1 — Cédula</label><input className="inp" value={form.j1cedula} onChange={s("j1cedula")} placeholder="1234567" /></div>
            <div className="col"><label className="lbl">J2 — Nombre</label><input className="inp" value={form.j2nombre} onChange={s("j2nombre")} /></div>
            <div className="col"><label className="lbl">J2 — Cédula</label><input className="inp" value={form.j2cedula} onChange={s("j2cedula")} placeholder="7654321" onKeyDown={(e) => e.key === "Enter" && handleAdd()} /></div>
          </div>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>+ Agregar pareja</button>
        </div>
      ) : (
        <div className="row mb16"><button className="btn btn-secondary" onClick={() => setShowAdd(true)} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>+ Agregar pareja al fixture</button></div>
      )}
      {cat.parejas.length === 0 ? (
        <div className="empty"><div className="empty-ico">👥</div><p>No hay parejas inscriptas aún</p></div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>#</th><th>Pareja</th><th>J1</th><th>CI</th><th>Pago J1</th><th>J2</th><th>CI</th><th>Pago J2</th><th>Horarios</th><th>Zona</th><th></th></tr></thead>
            <tbody>
              {cat.parejas.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: "Oswald", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>{i + 1}</td>
                  <td className="em">{p.nombre}</td>
                  <td>{p.j1nombre || p.j1}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{p.j1cedula || "—"}</td>
                  <td><button className={`pago-pill ${p.pagoJ1 ? "pago-ok" : "pago-no"}`} onClick={() => onTogglePago(p.id, "pagoJ1")} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>{p.pagoJ1 ? "✓ Pagado" : "✗ Pendiente"}</button></td>
                  <td>{p.j2nombre || p.j2}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{p.j2cedula || "—"}</td>
                  <td><button className={`pago-pill ${p.pagoJ2 ? "pago-ok" : "pago-no"}`} onClick={() => onTogglePago(p.id, "pagoJ2")} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>{p.pagoJ2 ? "✓ Pagado" : "✗ Pendiente"}</button></td>
                  <td>{formatSlots(p)}</td>
                  <td>{p.grupoId ? <span className="badge bg">{gName[p.grupoId] || "?"}</span> : <span className="badge bx">—</span>}</td>
                  <td>
                    <div className="row g8">
                      <button className="btn btn-secondary btn-xs" onClick={() => onEditPair(p)} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>✏️</button>
                      {!cat.fixtureGenerado && <button className="btn btn-danger btn-xs" onClick={() => onDelete(p.id)} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>✕</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Fixture ───
function Fixture({ cat, onGenerate, isAdmin, onEditMatch }) {
  const byId = Object.fromEntries(cat.parejas.map((p) => [p.id, p]));
  if (!cat.fixtureGenerado)
    return (
      <div>
        <div className="sec-hdr"><div className="sec-title">Fixture</div></div>
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div className="empty-ico">📅</div>
          <p className="mb16" style={{ color: "var(--muted)" }}>
            {cat.parejas.length < 3
              ? `Necesitás al menos 3 parejas (tenés ${cat.parejas.length})`
              : `${cat.parejas.length} parejas · Zonas: ${calcZoneDistribution(cat.parejas.length).zonasDe3} de 3, ${calcZoneDistribution(cat.parejas.length).zonasDe4} de 4`}
          </p>
          {cat.parejas.length >= 3 && (
            <button className="btn btn-primary" onClick={onGenerate} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>⚡ Generar Fixture</button>
          )}
        </div>
      </div>
    );
  const byCourt = Object.fromEntries(COURTS.map((c) => [c, []]));
  cat.partidos.forEach((m) => { if (byCourt[m.cancha]) byCourt[m.cancha].push(m); });
  const conflictos = cat.partidos.filter((m) => m.conflict).length;
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Fixture</div>
        <div className="row g8 wrap">
          <span className="badge bg">{cat.grupos.length} Zonas</span>
          <span className="badge bb">{cat.partidos.length} Partidos</span>
          <span className="badge by">{cat.partidos.filter((m) => m.done).length} Completados</span>
          {conflictos > 0 && <span className="badge by">⚠️ {conflictos} advertencias</span>}
        </div>
      </div>
      {conflictos > 0 && <div className="alert alert-warn">⚠️ Algunos partidos tienen conflictos de descanso (⚠️) o restricción (🚫). Se resolvieron lo mejor posible.</div>}
      <div className="grid3 mb16">
        {cat.grupos.map((g) => {
          const gp = cat.parejas.filter((p) => p.grupoId === g.id);
          const gm = cat.partidos.filter((m) => m.grupoId === g.id);
          const isZona4 = gm.some(m => m.zona4);
          return (
            <div key={g.id} className="card" style={{ margin: 0 }}>
              <div className="card-title">{g.nombre}</div>
              {gp.map((p, i) => (
                <div key={p.id} className="row g8" style={{ padding: "6px 0", borderBottom: i < gp.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontFamily: "Oswald", fontWeight: 700, color: "var(--muted)", fontSize: 12, minWidth: 16 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text)" }}>{p.nombre}</div>
                    {p.restriccionesSlots?.length > 0 && <span style={{ fontSize: 10, color: "var(--danger)" }}>🚫 {p.restriccionesSlots.length} restricción{p.restriccionesSlots.length > 1 ? "es" : ""}</span>}
                  </div>
                </div>
              ))}
              {isZona4 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Partidos (mini‑playoff):</div>
                  {gm.map(m => {
                    const tipo = m.zona4Tipo;
                    const p1 = m.p1id ? byId[m.p1id]?.nombre : "Por definir";
                    const p2 = m.p2id ? byId[m.p2id]?.nombre : "Por definir";
                    const dep = (tipo === "C" || tipo === "D") ? " (depende de A y B)" : "";
                    return (
                      <div key={m.id} style={{ fontSize: 11, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: "var(--accent)" }}>{tipo}:</span> {p1} vs {p2}{dep}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="card">
        <div className="card-title">Cronograma por Cancha</div>
        <div className="sched-grid">
          {COURTS.map((court) => (
            <div key={court}>
              <div className="court-hdr">{court}</div>
              <div className="court-body">
                {byCourt[court].length === 0 && <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Sin partidos</div>}
                {byCourt[court].map((m) => (
                  <div key={m.id} className="court-slot">
                    <div>
                      <div className="slot-day">{m.dia}</div>
                      <div className="slot-time">{m.hora}</div>
                      <div className="slot-match">{byId[m.p1id]?.nombre || "?"} vs {byId[m.p2id]?.nombre || "?"}</div>
                    </div>
                    <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
                      <div className="row g8">
                        <span className="slot-code">{m.code}</span>
                        {isAdmin && <button className="btn btn-ghost btn-xs" onClick={() => onEditMatch(m)}>⚙️</button>}
                      </div>
                      {m.done && <span style={{ fontSize: 9, color: "var(--accent)" }}>✓</span>}
                      {m.conflict && !m.restrictionConflict && <span className="ctag">⚠️ Descanso</span>}
                      {m.restrictionConflict && <span className="ctag ctag-r">🚫 Restricción</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== PARTE 3 =====
// ===== PARTE 3 =====
// ─── Resultados (con botón editar) ───
function Resultados({ cat, onOpen, isAdmin, onEditMatch }) {
  const byId = Object.fromEntries(cat.parejas.map((p) => [p.id, p]));
  if (!cat.fixtureGenerado)
    return <div className="empty"><div className="empty-ico">⚡</div><p>Generá el fixture primero</p></div>;
  if (!cat.partidos || cat.partidos.length === 0)
    return <div className="empty"><div className="empty-ico">📋</div><p>No hay partidos cargados en esta categoría.</p></div>;

  const isZona4PartidoPendiente = (m) => {
    if (m.zona4 && (m.zona4Tipo === "C" || m.zona4Tipo === "D")) {
      return !m.p1id || !m.p2id;
    }
    return false;
  };

  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Resultados</div><span className="badge bg">{cat.partidos.filter((m) => m.done).length}/{cat.partidos.length} completados</span></div>
      {cat.grupos.map((g) => {
        const gm = cat.partidos.filter((m) => m.grupoId === g.id);
        if (gm.length === 0) return null;
        return (
          <div key={g.id} className="card">
            <div className="card-title">{g.nombre}</div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cód</th>
                  <th>Pareja 1</th>
                  <th>Resultado</th>
                  <th>Pareja 2</th>
                  <th>Horario</th>
                  {isAdmin && <th></th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gm.map((m) => {
                  const p1 = m.p1id ? byId[m.p1id] : null;
                  const p2 = m.p2id ? byId[m.p2id] : null;
                  const pendienteDef = isZona4PartidoPendiente(m);
                  const w = m.done ? (m.winner === m.p1id ? 1 : 2) : null;
                  return (
                    <tr key={m.id}>
                      <td><span className="slot-code">{m.code}</span></td>
                      <td className={w === 1 ? "em" : ""} style={w === 1 ? { color: "var(--accent)", fontWeight: 700 } : {}}>
                        {pendienteDef ? "Por definir" : (p1?.nombre || "?")}
                      </td>
                      <td>
                        {m.done ? (
                          <span>
                            <span className="res-set">{m.s1p1}-{m.s1p2}</span>
                            <span className="res-set">{m.s2p1}-{m.s2p2}</span>
                            {m.tbp1 !== "" && m.tbp2 !== "" && <span className="res-set" style={{ color: "var(--gold)" }}>TB:{m.tbp1}-{m.tbp2}</span>}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Pendiente</span>
                        )}
                      </td>
                      <td className={w === 2 ? "em" : ""} style={w === 2 ? { color: "var(--accent)", fontWeight: 700 } : {}}>
                        {pendienteDef ? "Por definir" : (p2?.nombre || "?")}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{m.dia} {m.hora} · {m.cancha}</td>
                      {isAdmin && (
                        <td>
                          <button className="btn btn-ghost btn-xs" onClick={() => onEditMatch(m)}>⚙️</button>
                        </td>
                      )}
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => isAdmin && onOpen(m)}
                          disabled={pendienteDef || !isAdmin}
                          style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                        >
                          {m.done ? "✏️" : (pendienteDef ? "⏳" : "+ Resultado")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ─── Posiciones ───
function Posiciones({ cat }) {
  if (!cat.fixtureGenerado)
    return <div className="empty"><div className="empty-ico">📊</div><p>Generá el fixture para ver las posiciones</p></div>;

  const byId = Object.fromEntries(cat.parejas.map((p) => [p.id, p]));

  const MiniBracket = ({ groupId }) => {
    const gm = cat.partidos.filter(m => m.grupoId === groupId && m.zona4);
    const matchA = gm.find(m => m.zona4Tipo === "A");
    const matchB = gm.find(m => m.zona4Tipo === "B");
    const matchC = gm.find(m => m.zona4Tipo === "C");
    const matchD = gm.find(m => m.zona4Tipo === "D");
    const renderTeam = (match, isP1) => {
      const pid = isP1 ? match?.p1id : match?.p2id;
      const name = pid ? byId[pid]?.nombre : "Por definir";
      const score = match?.done ? (isP1 ? `${match.s1p1} ${match.s2p1}` : `${match.s1p2} ${match.s2p2}`) : null;
      return (
        <div className={`mini-team ${!pid ? "tbd" : ""}`}>
          <span>{name}</span>
          {score && <span className="br-score">{score}</span>}
        </div>
      );
    };
    return (
      <div className="mini-bracket">
        <div className="mini-match">
          <div className="mini-match-header">A (Ronda 1)</div>
          {renderTeam(matchA, true)}
          {renderTeam(matchA, false)}
        </div>
        <div className="mini-match">
          <div className="mini-match-header">B (Ronda 1)</div>
          {renderTeam(matchB, true)}
          {renderTeam(matchB, false)}
        </div>
        <div className="mini-match">
          <div className="mini-match-header">C (1° y 2° puesto)</div>
          {matchC?.done ? (
            <>
              {renderTeam(matchC, true)}
              {renderTeam(matchC, false)}
            </>
          ) : (
            <div className="mini-team tbd">Pendiente de A y B</div>
          )}
        </div>
        <div className="mini-match">
          <div className="mini-match-header">D (3° y 4° puesto)</div>
          {matchD?.done ? (
            <>
              {renderTeam(matchD, true)}
              {renderTeam(matchD, false)}
            </>
          ) : (
            <div className="mini-team tbd">Pendiente de A y B</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Posiciones</div></div>
      <div className="grid2">
        {cat.grupos.map((g) => {
          const ids = cat.parejas.filter((p) => p.grupoId === g.id).map((p) => p.id);
          const st = calcStandings(ids, cat.parejas, cat.partidos.filter((m) => m.grupoId === g.id));
          const isZona4 = cat.partidos.some(m => m.grupoId === g.id && m.zona4);
          return (
            <div key={g.id} className="card" style={{ margin: 0 }}>
              <div className="card-title">{g.nombre}</div>
              {isZona4 && <MiniBracket groupId={g.id} />}
              <table className="tbl">
                <thead><tr><th>Pos</th><th>Pareja</th><th>PJ</th><th>G</th><th>P</th><th>S+</th><th>S-</th><th>G+</th><th>G-</th><th>Pts</th></tr></thead>
                <tbody>
                  {st.map((s, i) => (
                    <tr key={s.id} style={i < 2 ? { background: "rgba(61,255,160,.03)" } : {}}>
                      <td><span className={i === 0 ? "pos-g" : i === 1 ? "pos-s" : "pos-b"} style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 15 }}>{i + 1}</span>{i < 2 && <span className="classif">✓</span>}</td>
                      <td className="em" style={{ fontSize: 12 }}>{s.pair?.nombre}</td>
                      <td>{s.pj}</td><td style={{ color: "var(--accent)", fontWeight: 600 }}>{s.g}</td><td style={{ color: "var(--danger)" }}>{s.per}</td>
                      <td>{s.sg}</td><td>{s.sp}</td><td>{s.gg}</td><td>{s.gp}</td>
                      <td style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 16, color: "var(--gold)" }}>{s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Llave Final (modificada) ───
const ROUND_NAMES = ["OCTAVOS", "CUARTOS", "SEMIS", "FINAL"];
function LlaveFinal({ cat, allMatches, onActualizarClasificados, onOpen, onAwardPoints, pointsAwarded, isAdmin, onEditMatch }) {
  const byId = Object.fromEntries(cat.parejas.map((p) => [p.id, p]));
  const knockoutRoundsWithSchedules = React.useMemo(() => {
    if (!cat.knockoutRounds) return [];
    return getKnockoutWithSchedules(cat.knockoutRounds, allMatches, cat.parejas);
  }, [cat.knockoutRounds, allMatches, cat.parejas]);

  const koFlat = knockoutRoundsWithSchedules.flat();
  const koDone = koFlat.filter((m) => m.done && !m.auto).length;
  const koTotal = koFlat.filter((m) => !m.auto).length;

  const stages = calcPairStages(cat);
  const campeon = cat.parejas.find((p) => stages[p.id] === "campeon");
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Llave Final</div>
        <div className="row g8 wrap">
          <span className="badge bb">{koDone}/{koTotal}</span>
          {!pointsAwarded && koDone === koTotal && koTotal > 0 && <button className="btn btn-cyan btn-sm" onClick={onAwardPoints} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>🏅 Otorgar puntos</button>}
          {pointsAwarded && <span className="badge bg">✓ Puntos otorgados</span>}
          <button className="btn btn-secondary btn-sm" onClick={onActualizarClasificados} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>🔄 Actualizar Clasificados</button>
        </div>
      </div>
      {campeon && (
        <div className="card mb16" style={{ background: "rgba(255,203,71,.06)", borderColor: "rgba(255,203,71,.3)", textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 32 }}>🏆</div>
          <div style={{ fontFamily: "Oswald", fontSize: 24, fontWeight: 700, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase" }}>CAMPEÓN</div>
          <div style={{ fontSize: 18, color: "var(--text)", fontWeight: 600, marginTop: 6 }}>{campeon.nombre}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{campeon.j1nombre || campeon.j1} · {campeon.j2nombre || campeon.j2}</div>
        </div>
      )}
      <div className="card mb16">
        <div className="bracket-wrap">
          <div className="bracket">
            {knockoutRoundsWithSchedules.map((round, ri) => (
              <div key={ri} className="br-round">
                <div className="br-round-hdr">{ROUND_NAMES[ri] || `Ronda ${ri + 1}`}</div>
                <div className="br-matches">
                  {round.map((m) => {
                    const p1 = m.p1id ? byId[m.p1id] : null,
                      p2 = m.p2id ? byId[m.p2id] : null,
                      canPlay = m.p1id && m.p2id && !m.auto && isAdmin;
                    return (
                      <div key={m.id} className={`br-match${m.done ? " done" : ""}`} onClick={() => canPlay && onOpen(m)} style={{ cursor: canPlay ? 'pointer' : 'default' }}>
                        <div className={`br-team${!p1 ? " tbd" : m.done && m.winner === m.p1id ? " win" : ""}`}>
                          <span>{p1 ? p1.nombre : m.p1label || "TBD"}</span>
                          {m.done && <span className="br-score">{m.s1p1} {m.s2p1}</span>}
                        </div>
                        <div className={`br-team${!p2 ? " tbd" : m.done && m.winner === m.p2id ? " win" : ""}`}>
                          <span>{p2 ? p2.nombre : m.p2label || "TBD"}</span>
                          {m.done && <span className="br-score">{m.s1p2} {m.s2p2}</span>}
                        </div>
                        {m.dia && m.hora && m.cancha && (
                          <div className="br-schedule">
                            {m.dia} {m.hora} · {m.cancha}
                            {isAdmin && <button className="btn btn-ghost btn-xs" style={{ marginLeft: 8 }} onClick={(e) => { e.stopPropagation(); onEditMatch(m); }}>⚙️</button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Posiciones Finales</div>
        <table className="tbl">
          <thead><tr><th>Etapa</th><th>Pareja</th><th>Jugadores</th><th>Pts</th></tr></thead>
          <tbody>
            {Object.entries(stages)
              .sort((a, b) => STAGE_PTS[b[1]] - STAGE_PTS[a[1]])
              .map(([pid, stage]) => {
                const p = byId[pid];
                if (!p) return null;
                return (
                  <tr key={pid}>
                    <td><span className="badge bg">{STAGE_LABEL[stage]}</span></td>
                    <td className="em">{p.nombre}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{p.j1nombre || p.j1} · {p.j2nombre || p.j2}</td>
                    <td style={{ fontFamily: "Oswald", fontWeight: 700, color: "var(--gold)", fontSize: 16 }}>{STAGE_PTS[stage]}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── AgendaView (nuevo, solo admin) ───
function AgendaView({ torneo, allPartidos, isAdmin, onEditMatch }) {
  const byId = Object.fromEntries((torneo?.categorias || []).flatMap(c => c.parejas || []).map(p => [p.id, p]));
  const days = [...new Set(SLOT_DEFS.map(s => s.dia))];
  const partidosPorDia = {};
  days.forEach(dia => {
    partidosPorDia[dia] = {};
    COURTS.forEach(cancha => { partidosPorDia[dia][cancha] = []; });
  });
  allPartidos.forEach(m => {
    if (m.dia && m.dia !== "?" && partidosPorDia[m.dia] && partidosPorDia[m.dia][m.cancha]) {
      partidosPorDia[m.dia][m.cancha].push(m);
    }
  });
  days.forEach(dia => {
    COURTS.forEach(cancha => {
      partidosPorDia[dia][cancha].sort((a, b) => (a.mins || 0) - (b.mins || 0));
    });
  });
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Agenda</div>
        <span className="badge bb">Vista diaria</span>
      </div>
      {days.map(dia => {
        const slotsDia = SLOT_DEFS.filter(s => s.dia === dia).sort((a, b) => a.mins - b.mins);
        if (slotsDia.length === 0) return null;
        return (
          <div key={dia} className="card mb16">
            <div className="card-title">{dia}</div>
            <div className="sched-grid">
              {COURTS.map(cancha => (
                <div key={cancha}>
                  <div className="court-hdr">{cancha}</div>
                  <div className="court-body">
                    {slotsDia.map(slot => {
                      const partido = (partidosPorDia[dia][cancha] || []).find(m => m.hora === slot.hora);
                      return (
                        <div key={`${dia}|${slot.hora}|${cancha}`} className="court-slot"
                          style={{ cursor: partido && isAdmin ? "pointer" : "default" }}
                          onClick={() => partido && isAdmin && onEditMatch && onEditMatch(partido)}
                        >
                          {partido ? (
                            <>
                              <div>
                                <div className="slot-day">{partido.dia}</div>
                                <div className="slot-time">{partido.hora}</div>
                                <div className="slot-match">{byId[partido.p1id]?.nombre || "?"} vs {byId[partido.p2id]?.nombre || "?"}</div>
                              </div>
                              <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
                                <span className="slot-code">{partido.code}</span>
                                {partido.done && <span style={{ fontSize: 9, color: "var(--accent)" }}>✓</span>}
                              </div>
                            </>
                          ) : (
                            <div style={{ color: "var(--muted)", fontSize: 12, padding: "4px 0" }}>{slot.hora} — Libre</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// ─── JugadoresView ───
function JugadoresView({ jugadores, onDeleteJugador, isAdmin }) {
  const [sel, setSel] = useState(null);
  const list = Object.values(jugadores).sort((a, b) => b.totalPts - a.totalPts);
  const jug = sel ? jugadores[sel] : null;

  const handleDelete = (cedula, e) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (window.confirm(`¿Eliminar a ${jugadores[cedula]?.nombre} del ranking?`)) {
      onDeleteJugador(cedula);
      if (sel === cedula) setSel(null);
    }
  };

  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Ranking de Jugadores</div><span className="badge bb">{list.length} registrados</span></div>
      {list.length === 0 ? (
        <div className="empty"><div className="empty-ico">🏅</div><p>Los jugadores aparecen aquí al finalizar un torneo y otorgar puntos</p><p style={{ fontSize: 12, marginTop: 8 }}>Ingresá la cédula de cada jugador en Inscripción</p></div>
      ) : (
        <div className="grid2">
          <div>
            {list.map((j, i) => (
              <div key={j.cedula} className="rank-row" style={{ borderColor: sel === j.cedula ? "var(--accent)" : "var(--border)" }} onClick={() => setSel(sel === j.cedula ? null : j.cedula)}>
                <div className={`rank-pos${i === 0 ? " p1" : i === 1 ? " p2" : i === 2 ? " p3" : ""}`}>{i + 1}</div>
                <div className="f1"><div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{j.nombre}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>CI: {j.cedula}</div></div>
                <div className="col" style={{ alignItems: "flex-end" }}>
                  <div className="rank-pts">{j.totalPts}</div>
                  <div className="rank-pts-lbl">puntos</div>
                </div>
                <button className="btn btn-danger btn-xs" onClick={(e) => handleDelete(j.cedula, e)} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>🗑️</button>
              </div>
            ))}
          </div>
          <div>
            {jug ? (
              <div className="card" style={{ position: "sticky", top: 90 }}>
                <div className="card-title">Historial — {jug.nombre}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>CI: {jug.cedula}</div>
                <div style={{ fontFamily: "Oswald", fontSize: 36, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>{jug.totalPts}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>puntos totales</div>
                {jug.historial.map((h, i) => (
                  <div key={i} className="hist-item">
                    <div><div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: 2 }}>{h.torneoNombre}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{h.catNombre} · {h.fecha}</div></div>
                    <div className="col" style={{ alignItems: "flex-end", gap: 3 }}><span className="badge bg">{STAGE_LABEL[h.stage]}</span><span style={{ fontFamily: "Oswald", fontWeight: 700, color: "var(--gold)", fontSize: 15 }}>+{h.pts}</span></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty"><div className="empty-ico">👆</div><p>Seleccioná un jugador</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ───
const TABS = [
  { id: "inscripcion", label: "👥 Inscripción", adminOnly: true },
  { id: "fixture", label: "📅 Fixture" },
  { id: "resultados", label: "⚡ Resultados" },
  { id: "posiciones", label: "📊 Posiciones" },
  { id: "llave", label: "🏆 Llave Final" },
  { id: "agenda", label: "📋 Agenda", adminOnly: true },
];

export default function App() {
  const [torneos, setTorneos] = useState([]);
  const [jugadores, setJugadores] = useState({});
  const [activeTId, setActiveTId] = useState(null);
  const [activeCId, setActiveCId] = useState(null);
  const [subview, setSubview] = useState("inscripcion");
  const [appView, setAppView] = useState("torneos");
  const [modal, setModal] = useState(null);
  const [tForm, setTForm] = useState({ nombre: "", fecha: "" });
  const [cForm, setCForm] = useState({ nombre: "" });
  const [editingName, setEditingName] = useState(false);
  const [editingNameVal, setEditingNameVal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showPlayerLogin, setShowPlayerLogin] = useState(false);
  const [playerLoginError, setPlayerLoginError] = useState("");

  const { db, firestore } = window;
  const { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, writeBatch } = firestore;

  useEffect(() => {
    const adminSession = sessionStorage.getItem("padelbox_admin");
    if (adminSession === "true") {
      setIsAdmin(true);
      return;
    }
    const playerSession = sessionStorage.getItem("padelbox_player");
    if (playerSession === "true") {
      setIsPlayer(true);
    }
  }, []);

  const migratePairRestrictions = (p) => {
    if (!p.restriccionesSlots && p.restricciones) {
      const newSlots = new Set();
      p.restricciones.forEach(bloqueId => {
        (BLOQUE_TO_SLOTS[bloqueId] || []).forEach(slot => newSlots.add(slot));
      });
      return { ...p, restriccionesSlots: Array.from(newSlots), restricciones: undefined };
    }
    return p;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const torneosCol = collection(db, "torneos");
        const torneosSnap = await getDocs(torneosCol);
        const torneosData = torneosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const torneosCompletos = await Promise.all(torneosData.map(async (t) => {
          const catsCol = collection(db, "categorias");
          const q = query(catsCol, where("torneoId", "==", t.id));
          const catsSnap = await getDocs(q);
          const categorias = await Promise.all(catsSnap.docs.map(async (docCat) => {
            const cat = { id: docCat.id, ...docCat.data() };
            const pairsCol = collection(db, "parejas");
            const qPairs = query(pairsCol, where("categoriaId", "==", cat.id));
            const pairsSnap = await getDocs(qPairs);
            cat.parejas = pairsSnap.docs.map(d => migratePairRestrictions({ id: d.id, ...d.data() }));
            const matchesCol = collection(db, "partidos");
            const qMatches = query(matchesCol, where("categoriaId", "==", cat.id));
            const matchesSnap = await getDocs(qMatches);
            cat.partidos = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            return cat;
          }));
          return { ...t, categorias };
        }));
        setTorneos(torneosCompletos);
        const jugCol = collection(db, "jugadores");
        const jugSnap = await getDocs(jugCol);
        const jugs = {};
        jugSnap.docs.forEach(doc => {
          jugs[doc.id] = { cedula: doc.id, ...doc.data() };
        });
        setJugadores(jugs);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const activeTorneo = torneos.find((t) => t.id === activeTId);
  const activeCat = activeTorneo?.categorias?.find((c) => c.id === activeCId);
  const allMatches = activeTorneo?.categorias?.flatMap(c => c.partidos) || [];

  const getAllCedulas = () => {
    const cedulas = new Set();
    torneos.forEach(t => {
      t.categorias?.forEach(c => {
        c.parejas?.forEach(p => {
          if (p.j1cedula) cedulas.add(p.j1cedula);
          if (p.j2cedula) cedulas.add(p.j2cedula);
        });
      });
    });
    return cedulas;
  };

  const handlePlayerLogin = (cedula) => {
    const cedulasValidas = getAllCedulas();
    if (cedulasValidas.has(cedula)) {
      sessionStorage.setItem("padelbox_player", "true");
      setIsPlayer(true);
      setShowPlayerLogin(false);
      setPlayerLoginError("");
    } else {
      setPlayerLoginError("Cédula no encontrada en el torneo");
    }
  };

  const handleLogoutAdmin = () => {
    sessionStorage.removeItem("padelbox_admin");
    setIsAdmin(false);
  };

  const handleLogoutPlayer = () => {
    sessionStorage.removeItem("padelbox_player");
    setIsPlayer(false);
  };

  function updateCat(catId, fn) {
    setTorneos((prev) =>
      prev.map((t) =>
        t.id === activeTId
          ? { ...t, categorias: t.categorias.map((c) => (c.id === catId ? fn(c) : c)) }
          : t
      )
    );
  }

  async function guardarCategoria(categoria) {
    const catRef = doc(db, "categorias", categoria.id);
    const { parejas, partidos, ...rest } = categoria;
    await setDoc(catRef, { ...rest, torneoId: activeTId });
  }

  async function guardarPareja(pareja) {
    const pairRef = doc(db, "parejas", pareja.id);
    const toSave = { ...pareja, categoriaId: activeCId };
    delete toSave.restricciones;
    if (toSave.j1 === undefined) delete toSave.j1;
    if (toSave.j2 === undefined) delete toSave.j2;
    await setDoc(pairRef, toSave);
  }

  async function guardarPartido(partido) {
    const matchRef = doc(db, "partidos", partido.id);
    await setDoc(matchRef, { ...partido, categoriaId: activeCId });
  }

  async function guardarKnockout(rounds) {
    const catRef = doc(db, "categorias", activeCId);
    await updateDoc(catRef, { knockoutRounds: rounds });
  }

  async function editarPartido(matchId, changes) {
    if (!activeCat) return;
    const catRef = doc(db, "categorias", activeCId);
    let updated = false;
    const partidoIndex = activeCat.partidos.findIndex(p => p.id === matchId);
    if (partidoIndex !== -1) {
      const newPartidos = [...activeCat.partidos];
      newPartidos[partidoIndex] = { ...newPartidos[partidoIndex], ...changes };
      updateCat(activeCId, c => ({ ...c, partidos: newPartidos }));
      await guardarPartido(newPartidos[partidoIndex]);
      updated = true;
    } else {
      let newKnockout = activeCat.knockoutRounds ? [...activeCat.knockoutRounds] : [];
      let found = false;
      for (let i = 0; i < newKnockout.length; i++) {
        const matchIndex = newKnockout[i].findIndex(m => m.id === matchId);
        if (matchIndex !== -1) {
          newKnockout[i][matchIndex] = { ...newKnockout[i][matchIndex], ...changes };
          found = true;
          break;
        }
      }
      if (found) {
        updateCat(activeCId, c => ({ ...c, knockoutRounds: newKnockout }));
        await guardarKnockout(newKnockout);
        updated = true;
      }
    }
    if (!updated) console.warn("Partido no encontrado:", matchId);
  }

  async function crearTorneo() {
    if (!tForm.nombre.trim()) return;
    const newId = uid();
    const nuevo = { id: newId, nombre: tForm.nombre.trim(), fecha: tForm.fecha, categorias: [] };
    setTorneos(prev => [...prev, nuevo]);
    setTForm({ nombre: "", fecha: "" });
    setModal(null);
    setActiveTId(newId);
    setActiveCId(null);
    setSubview("inscripcion");
    try {
      await setDoc(doc(db, "torneos", newId), { id: newId, nombre: nuevo.nombre, fecha: nuevo.fecha });
    } catch (err) { console.error(err); }
  }

  async function guardarNombreTorneo() {
    if (!editingNameVal.trim()) return;
    const torneoRef = doc(db, "torneos", activeTId);
    await updateDoc(torneoRef, { nombre: editingNameVal.trim() });
    setTorneos(prev => prev.map(t => t.id === activeTId ? { ...t, nombre: editingNameVal.trim() } : t));
    setEditingName(false);
  }

  async function crearCategoria() {
    if (!cForm.nombre.trim()) return;
    const newId = uid();
    const nueva = {
      id: newId,
      nombre: cForm.nombre.trim(),
      parejas: [],
      grupos: [],
      partidos: [],
      fixtureGenerado: false,
      knockoutGenerated: false,
      knockoutRounds: [],
      pointsAwarded: false,
      torneoId: activeTId
    };
    setTorneos(prev => prev.map(t => t.id === activeTId ? { ...t, categorias: [...t.categorias, nueva] } : t));
    setCForm({ nombre: "" });
    setModal(null);
    setActiveCId(newId);
    await guardarCategoria(nueva);
  }

  async function agregarPareja(pair) {
    if (!activeCat.fixtureGenerado) {
      updateCat(activeCId, (c) => ({ ...c, parejas: [...c.parejas, pair] }));
      await guardarPareja(pair);
    } else {
      const c = activeCat;
      const sizes = c.grupos.map((g) => ({ g, cnt: c.parejas.filter((p) => p.grupoId === g.id).length }));
      const available = sizes.filter((x) => x.cnt < 3).sort((a, b) => a.cnt - b.cnt);
      let tg, newGrupos = c.grupos;
      if (available.length > 0) tg = available[0].g;
      else { tg = { id: uid(), nombre: `ZONA ${LETTERS[c.grupos.length]}` }; newGrupos = [...c.grupos, tg]; }
      const pw = { ...pair, grupoId: tg.id };
      const existing = c.parejas.filter((p) => p.grupoId === tg.id);
      const baseCode = c.partidos.length + 1;
      const newRaw = existing.map((ep, i) => ({
        id: uid(), type: "grupo", grupoId: tg.id, p1id: pw.id, p2id: ep.id,
        code: `Z${baseCode + i}`, done: false, winner: null,
        s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "",
      }));
      const otherMatches = getAllOtherMatches(activeCId);
      const pairMap = Object.fromEntries([...c.parejas, pw].map(p => [p.id, p]));
      const sched = scheduleMatches(newRaw, [...c.partidos, ...otherMatches], pairMap);
      const newPartidos = [...c.partidos, ...sched];
      updateCat(activeCId, () => ({ ...c, grupos: newGrupos, parejas: [...c.parejas, pw], partidos: newPartidos }));
      await guardarPareja(pw);
      await guardarCategoria({ ...c, grupos: newGrupos });
      await Promise.all(newPartidos.map(p => guardarPartido(p)));
    }
  }

  function eliminarPareja(id) {
    updateCat(activeCId, (c) => ({ ...c, parejas: c.parejas.filter((p) => p.id !== id) }));
  }

  async function editarPareja(updated) {
    const updatedClean = migratePairRestrictions(updated);
    updateCat(activeCId, (c) => ({
      ...c,
      parejas: c.parejas.map((p) => (p.id === updatedClean.id ? updatedClean : p))
    }));
    setJugadores((prev) => {
      const nxt = { ...prev };
      [{ cedula: updatedClean.j1cedula, nombre: updatedClean.j1nombre || updatedClean.j1 },
       { cedula: updatedClean.j2cedula, nombre: updatedClean.j2nombre || updatedClean.j2 }]
        .filter((j) => j.cedula && nxt[j.cedula])
        .forEach((j) => { nxt[j.cedula] = { ...nxt[j.cedula], nombre: j.nombre }; });
      return nxt;
    });
    setModal(null);
    await guardarPareja(updatedClean);
  }

  async function togglePago(pairId, field) {
    const pair = activeCat.parejas.find((p) => p.id === pairId);
    if (!pair) return;
    const updated = { ...pair, [field]: !pair[field] };
    updateCat(activeCId, (c) => ({
      ...c,
      parejas: c.parejas.map((p) => (p.id === pairId ? updated : p)),
    }));
    await guardarPareja(updated);
  }

  function getAllOtherMatches(catId) {
    const t = torneos.find((t) => t.id === activeTId);
    if (!t) return [];
    return t.categorias.filter((c) => c.id !== catId).flatMap((c) => c.partidos.filter((m) => m.dia && m.hora && m.cancha && m.mins != null));
  }

  async function generarFixture() {
    if (!activeCat || activeCat.parejas.length < 3) return;
    const pairs = activeCat.parejas;
    const dist = calcZoneDistribution(pairs.length);
    const grupos = [];
    let letterIdx = 0;
    for (let i = 0; i < dist.zonasDe3; i++) {
      grupos.push({ id: uid(), nombre: `ZONA ${LETTERS[letterIdx++]}` });
    }
    for (let i = 0; i < dist.zonasDe4; i++) {
      grupos.push({ id: uid(), nombre: `ZONA ${LETTERS[letterIdx++]}` });
    }

    const availablePairs = pairs.map(p => ({ ...p, grupoId: null }));
    const pairMap = Object.fromEntries(availablePairs.map(p => [p.id, p]));
    const sortedPairs = [...availablePairs].sort((a, b) => {
      const aSlots = getAvailableSlots(a).length;
      const bSlots = getAvailableSlots(b).length;
      return aSlots - bSlots;
    });

    const zonas3 = grupos.filter((_, i) => i < dist.zonasDe3);
    const zonas4 = grupos.filter((_, i) => i >= dist.zonasDe3);

    const assignToZones = (pairsList, zones, size) => {
      const remaining = pairsList.filter(p => p.grupoId === null);
      for (const zone of zones) {
        if (remaining.length === 0) break;
        const seed = remaining.shift();
        seed.grupoId = zone.id;
        const candidates = remaining.filter(p => p.grupoId === null);
        const withScores = candidates.map(p => ({
          p,
          score: calcCompatibilityScore(seed, p)
        }));
        withScores.sort((a, b) => b.score - a.score);
        const needed = size - 1;
        for (let i = 0; i < needed && i < withScores.length; i++) {
          withScores[i].p.grupoId = zone.id;
          const idx = remaining.findIndex(x => x.id === withScores[i].p.id);
          if (idx !== -1) remaining.splice(idx, 1);
        }
      }
    };

    assignToZones(sortedPairs, zonas3, 3);
    assignToZones(sortedPairs, zonas4, 4);

    const assignedPairs = pairs.map(p => {
      const found = availablePairs.find(ap => ap.id === p.id);
      return found ? { ...p, grupoId: found.grupoId } : p;
    });

    let code = 1;
    const raw = [];
    grupos.forEach((g) => {
      const gIds = assignedPairs.filter(p => p.grupoId === g.id).map(p => p.id);
      const isZona4 = gIds.length === 4;
      if (isZona4) {
        const grupoId = g.id;
        raw.push({
          id: uid(), type: "grupo", grupoId, code: `Z${code++}`,
          p1id: gIds[0], p2id: gIds[1],
          done: false, winner: null,
          s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "",
          zona4: true, zona4Tipo: "A", zona4GrupoId: grupoId
        });
        raw.push({
          id: uid(), type: "grupo", grupoId, code: `Z${code++}`,
          p1id: gIds[2], p2id: gIds[3],
          done: false, winner: null,
          s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "",
          zona4: true, zona4Tipo: "B", zona4GrupoId: grupoId
        });
        raw.push({
          id: uid(), type: "grupo", grupoId, code: `Z${code++}`,
          p1id: null, p2id: null,
          done: false, winner: null,
          s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "",
          zona4: true, zona4Tipo: "C", zona4GrupoId: grupoId
        });
        raw.push({
          id: uid(), type: "grupo", grupoId, code: `Z${code++}`,
          p1id: null, p2id: null,
          done: false, winner: null,
          s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "",
          zona4: true, zona4Tipo: "D", zona4GrupoId: grupoId
        });
      } else {
        roundRobin(gIds).forEach(([p1id, p2id]) =>
          raw.push({
            id: uid(), type: "grupo", grupoId: g.id, p1id, p2id,
            code: `Z${code++}`, done: false, winner: null,
            s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "",
          })
        );
      }
    });

    const otherMatches = getAllOtherMatches(activeCId);
    const rawWithoutNulls = raw.filter(m => m.p1id && m.p2id);
    const rawWithNulls = raw.filter(m => !m.p1id || !m.p2id);
    const sched = scheduleMatches(rawWithoutNulls, otherMatches, pairMap);
    const partidos = [...sched, ...rawWithNulls];

    // Crear bracket fijo
    const knockoutRounds = buildFixedBracket([]);

    const updatedCat = { ...activeCat, parejas: assignedPairs, grupos, partidos, fixtureGenerado: true, knockoutGenerated: true, knockoutRounds };
    updateCat(activeCId, () => updatedCat);
    await guardarCategoria({ ...updatedCat, id: activeCId });
    await Promise.all(assignedPairs.map(p => guardarPareja(p)));
    await Promise.all(partidos.map(m => guardarPartido(m)));
    await guardarKnockout(knockoutRounds);
  }

  async function actualizarClasificados() {
    if (!activeCat || !activeCat.fixtureGenerado) return;
    const newKnockout = JSON.parse(JSON.stringify(activeCat.knockoutRounds));
    const classified = [];
    activeCat.grupos.forEach((g) => {
      const gIds = activeCat.parejas.filter(p => p.grupoId === g.id).map(p => p.id);
      const st = calcStandings(gIds, activeCat.parejas, activeCat.partidos.filter(m => m.grupoId === g.id));
      if (st[0]) classified.push({ pos: 1, grupo: g.nombre, pairId: st[0].id });
      if (st[1]) classified.push({ pos: 2, grupo: g.nombre, pairId: st[1].id });
    });
    // Reconstruir los primeros 16 slots de la ronda 0 con los nuevos clasificados
    const firsts = classified.filter(c => c.pos === 1);
    const seconds = classified.filter(c => c.pos === 2).reverse();
    const ordered = [];
    for (let i = 0; i < 8; i++) {
      ordered.push(firsts[i] || null);
      ordered.push(seconds[i] || null);
    }
    while (ordered.length < 16) ordered.push(null);
    for (let i = 0; i < 8; i++) {
      const a = ordered[i * 2];
      const b = ordered[i * 2 + 1];
      const match = newKnockout[0][i];
      if (!match) continue;
      const newP1id = a?.pairId || null;
      const newP2id = b?.pairId || null;
      const auto = !a || !b;
      const winner = !b ? newP1id : (!a ? newP2id : null);
      if (!match.done || match.auto) {
        match.p1id = newP1id;
        match.p2id = newP2id;
        match.p1label = a ? `1° ${a.grupo}` : "BYE";
        match.p2label = b ? `2° ${b.grupo}` : "BYE";
        match.auto = auto;
        match.winner = auto ? winner : null;
        match.done = auto;
      }
    }
    // Programar horarios para partidos de octavos que ya tienen ambos equipos
    const t = torneos.find(t => t.id === activeTId);
    const allExisting = t ? t.categorias.flatMap(c => c.partidos) : [];
    const scheduled = scheduleKnockoutMatches(newKnockout, allExisting, activeCat.parejas);
    updateCat(activeCId, c => ({ ...c, knockoutRounds: scheduled }));
    await guardarKnockout(scheduled);
  }

  async function guardarResultado(matchId, result) {
    const cat = torneos.find(t => t.id === activeTId)?.categorias?.find(c => c.id === activeCId);
    if (!cat) return;

    const m = cat.partidos.find(p => p.id === matchId);
    if (!m) return;

    let updatedC = null;
    let updatedD = null;

    if (m.zona4 && (m.zona4Tipo === "A" || m.zona4Tipo === "B") && result.done) {
      const updatedMatch = { ...m, ...result, winner: calcMatchResult({ ...m, ...result }) };
      const winnerId = updatedMatch.winner;
      const loserId = winnerId === updatedMatch.p1id ? updatedMatch.p2id : updatedMatch.p1id;

      const matchC = cat.partidos.find(p => p.zona4 && p.zona4GrupoId === m.zona4GrupoId && p.zona4Tipo === "C");
      const matchD = cat.partidos.find(p => p.zona4 && p.zona4GrupoId === m.zona4GrupoId && p.zona4Tipo === "D");

      if (m.zona4Tipo === "A") {
        if (matchC) updatedC = { ...matchC, p1id: winnerId };
        if (matchD) updatedD = { ...matchD, p1id: loserId };
      } else if (m.zona4Tipo === "B") {
        if (matchC) updatedC = { ...matchC, p2id: winnerId };
        if (matchD) updatedD = { ...matchD, p2id: loserId };
      }
    }

    updateCat(activeCId, (c) => {
      let newPartidos = c.partidos.map((p) => {
        if (p.id === matchId) {
          const winner = result.done ? calcMatchResult({ ...p, ...result }) : null;
          return { ...p, ...result, winner };
        }
        return p;
      });
      if (updatedC) newPartidos = newPartidos.map(p => p.id === updatedC.id ? updatedC : p);
      if (updatedD) newPartidos = newPartidos.map(p => p.id === updatedD.id ? updatedD : p);
      return { ...c, partidos: newPartidos };
    });
    setModal(null);
    const matchRef = doc(db, "partidos", matchId);
    await updateDoc(matchRef, result);
    if (updatedC) await updateDoc(doc(db, "partidos", updatedC.id), updatedC);
    if (updatedD) await updateDoc(doc(db, "partidos", updatedD.id), updatedD);
  }

  async function guardarResultadoKnockout(matchId, result) {
    const fm = activeCat.knockoutRounds.flat().find((m) => m.id === matchId);
    if (!fm) return;
    const winner = result.done ? calcMatchResult({ ...fm, ...result }) : null;
    let nr = activeCat.knockoutRounds.map((round) =>
      round.map((m) => (m.id === matchId ? { ...m, ...result, winner, done: !!result.done } : m))
    );
    if (winner) {
      // Propagar ganador a la siguiente ronda
      nr.forEach((round, ri) => {
        round.forEach((m) => {
          if (!m.prevIds?.length) return;
          if (m.prevIds[0] === matchId) nr[ri] = nr[ri].map((nm) => (nm.id === m.id ? { ...nm, p1id: winner } : nm));
          if (m.prevIds[1] === matchId) nr[ri] = nr[ri].map((nm) => (nm.id === m.id ? { ...nm, p2id: winner } : nm));
        });
      });
      // Si el partido siguiente ahora tiene ambos equipos y no tiene horario, programarlo
      const t = torneos.find(t => t.id === activeTId);
      const allExisting = t ? t.categorias.flatMap(c => c.partidos) : [];
      nr = scheduleKnockoutMatches(nr, allExisting, activeCat.parejas);
    }
    updateCat(activeCId, (c) => ({ ...c, knockoutRounds: nr }));
    setModal(null);
    await guardarKnockout(nr);
  }

  async function otorgarPuntos() {
    if (!activeCat || !activeTorneo) return;
    const stages = calcPairStages(activeCat);
    let nuevosJugadores = [];
    setJugadores((prev) => {
      const nxt = { ...prev };
      activeCat.parejas.forEach((pair) => {
        const stage = stages[pair.id] || "zona";
        const pts = STAGE_PTS[stage] || 0;
        [pair.j1cedula, pair.j2cedula].forEach((cedula) => {
          if (!cedula) return;
          const nombre = cedula === pair.j1cedula ? pair.j1nombre || pair.j1 : pair.j2nombre || pair.j2;
          if (!nxt[cedula]) {
            nxt[cedula] = { cedula, nombre, totalPts: 0, historial: [] };
          }
          const already = nxt[cedula].historial.some(
            (h) => h.torneoId === activeTId && h.catId === activeCId
          );
          if (!already) {
            nxt[cedula] = {
              ...nxt[cedula],
              nombre: nombre || nxt[cedula].nombre,
              totalPts: nxt[cedula].totalPts + pts,
              historial: [
                ...nxt[cedula].historial,
                {
                  torneoId: activeTId,
                  catId: activeCId,
                  torneoNombre: activeTorneo.nombre,
                  catNombre: activeCat.nombre,
                  stage,
                  pts,
                  fecha: new Date().toLocaleDateString("es-PY"),
                },
              ],
            };
          }
        });
      });
      nuevosJugadores = Object.values(nxt);
      return nxt;
    });
    updateCat(activeCId, (c) => ({ ...c, pointsAwarded: true }));
    const batch = writeBatch(db);
    nuevosJugadores.forEach(j => {
      const ref = doc(db, "jugadores", j.cedula);
      batch.set(ref, j);
    });
    const catRef = doc(db, "categorias", activeCId);
    batch.update(catRef, { pointsAwarded: true });
    await batch.commit();
    alert("✅ Puntos guardados correctamente");
  }

  async function eliminarJugador(cedula) {
    try {
      await deleteDoc(doc(db, "jugadores", cedula));
      setJugadores(prev => {
        const newJug = { ...prev };
        delete newJug[cedula];
        return newJug;
      });
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  }

  async function eliminarTorneo(torneoId) {
    setTorneos((p) => p.filter((x) => x.id !== torneoId));
    try {
      await deleteDoc(doc(db, "torneos", torneoId));
    } catch (err) { console.error(err); }
  }

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <header className="hdr"><div className="logo">PADEL<em>BOX</em></div></header>
          <div className="main" style={{ textAlign: "center", paddingTop: 80 }}>
            <div className="empty-ico" style={{ fontSize: 40 }}>⏳</div>
            <p style={{ color: "var(--muted)" }}>Cargando torneos...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <header className="hdr"><div className="logo">PADEL<em>BOX</em></div></header>
          <div className="main" style={{ textAlign: "center", paddingTop: 80 }}>
            <div className="empty-ico" style={{ fontSize: 40 }}>⚠️</div>
            <p style={{ color: "var(--danger)" }}>Error al cargar los datos:</p>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>{error}</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => window.location.reload()}>Reintentar</button>
          </div>
        </div>
      </>
    );
  }

  /* PANTALLA DE LOGIN */
  if (!isAdmin && !isPlayer) {
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <header className="hdr">
            <div className="logo">PADEL<em>BOX</em></div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPlayerLogin(true)}>👤 Jugador</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPinModal(true)}>🔑 Admin</button>
            </div>
          </header>
          <div className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div className="hero-title" style={{ marginBottom: 16 }}>PADEL<em style={{ fontStyle: "normal", color: "var(--accent)" }}>BOX</em></div>
              <p style={{ color: "var(--muted)", marginBottom: 24 }}>Seleccioná tu forma de acceso</p>
              <div className="row g12" style={{ justifyContent: "center" }}>
                <button className="btn btn-primary" onClick={() => setShowPlayerLogin(true)}>👤 Ingresar como Jugador</button>
                <button className="btn btn-ghost" onClick={() => setShowPinModal(true)}>🔑 Ingresar como Admin</button>
              </div>
            </div>
          </div>
          {showPlayerLogin && (
            <PlayerLoginModal
              error={playerLoginError}
              onClearError={() => setPlayerLoginError("")}
              onSubmit={handlePlayerLogin}
              onClose={() => { setShowPlayerLogin(false); setPlayerLoginError(""); }}
            />
          )}
          {showPinModal && <PinModal onSuccess={() => { setShowPinModal(false); setIsAdmin(true); }} onClose={() => setShowPinModal(false)} />}
        </div>
      </>
    );
  }

  /* HOME */
  if (!activeTId)
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <header className="hdr">
            <div className="logo">PADEL<em>BOX</em></div>
            <div className="nav-tabs" style={{ marginLeft: "auto" }}>
              <button className={`nav-tab${appView === "torneos" ? " on" : ""}`} onClick={() => setAppView("torneos")}>🎾 Torneos</button>
              <button className={`nav-tab jug${appView === "jugadores" ? " on" : ""}`} onClick={() => setAppView("jugadores")}>🏅 Jugadores</button>
            </div>
            {isAdmin ? (
              <button className="btn btn-ghost btn-xs" onClick={handleLogoutAdmin} style={{ marginLeft: 8 }}>🔓 Admin</button>
            ) : (
              <button className="btn btn-ghost btn-xs" onClick={handleLogoutPlayer} style={{ marginLeft: 8 }}>👤 Salir</button>
            )}
          </header>
          <div className="main">
            {appView === "jugadores" ? (
              <JugadoresView jugadores={jugadores} onDeleteJugador={eliminarJugador} isAdmin={isAdmin} />
            ) : (
              <>
                <div className="hero">
                  <div className="hero-title">GESTIÓN DE<br/><span>TORNEOS</span></div>
                  <div className="hero-sub">Creá, organizá y gestioná todos tus torneos de pádel</div>
                  <button className="btn btn-primary" onClick={() => setModal({ type: "newT" })} disabled={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>+ Nuevo Torneo</button>
                </div>
                {torneos.length === 0 ? (
                  <div className="empty"><div className="empty-ico">🎾</div><p>No hay torneos creados aún</p></div>
                ) : (
                  <div className="grid2">
                    {torneos.map((t) => (
                      <button key={t.id} className="t-card" onClick={() => { setActiveTId(t.id); setActiveCId(null); setSubview(isAdmin ? "inscripcion" : "fixture"); }}>
                        <div className="t-card-name">{t.nombre}</div>
                        <div className="t-card-meta">{t.fecha || "Sin fecha"} · {t.categorias.length} categoría{t.categorias.length !== 1 ? "s" : ""}</div>
                        <div className="row wrap g8">
                          {t.categorias.map((c) => <span key={c.id} className="badge bb">{c.nombre}</span>)}
                          {!t.categorias.length && <span className="badge bx">Sin categorías</span>}
                        </div>
                        {isAdmin && (
                          <div className="t-card-del" onClick={(e) => { e.stopPropagation(); if (window.confirm("¿Eliminar este torneo?")) eliminarTorneo(t.id); }}>
                            <button className="btn btn-danger btn-xs">Eliminar</button>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {modal?.type === "newT" && (
            <div className="overlay" onClick={() => setModal(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">Nuevo Torneo</div>
                <div className="col mb12"><label className="lbl">Nombre</label><input className="inp" autoFocus placeholder="ej: Torneo Apertura 2026" value={tForm.nombre} onChange={(e) => setTForm((p) => ({ ...p, nombre: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && crearTorneo()} /></div>
                <div className="col mb16"><label className="lbl">Fecha de inicio</label><input className="inp" type="date" value={tForm.fecha} onChange={(e) => setTForm((p) => ({ ...p, fecha: e.target.value }))} /></div>
                <div className="row g8"><button className="btn btn-primary f1" onClick={crearTorneo}>Crear</button><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button></div>
              </div>
            </div>
          )}
          {showPinModal && <PinModal onSuccess={() => { setShowPinModal(false); setIsAdmin(true); }} onClose={() => setShowPinModal(false)} />}
        </div>
      </>
    );

  /* TORNEO ACTIVO */
  const tabsVisibles = TABS.filter(tab => !tab.adminOnly || (tab.adminOnly && isAdmin));
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="hdr">
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTId(null)}>← Torneos</button>
          <div className="hdr-name-wrap">
            {editingName ? (
              <>
                <input className="edit-inline" autoFocus value={editingNameVal} onChange={(e) => setEditingNameVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") guardarNombreTorneo(); if (e.key === "Escape") setEditingName(false); }} />
                <button className="icon-btn" onClick={guardarNombreTorneo}>✓</button>
                <button className="icon-btn" onClick={() => setEditingName(false)}>✕</button>
              </>
            ) : (
              <>
                <div className="hdr-name">{activeTorneo?.nombre}</div>
                {isAdmin && <button className="icon-btn" onClick={() => { setEditingNameVal(activeTorneo?.nombre || ""); setEditingName(true); }}>✏️</button>}
              </>
            )}
          </div>
          <div className="nav-tabs" style={{ marginLeft: "auto" }}>
            {tabsVisibles.map((tab) => <button key={tab.id} className={`nav-tab${subview === tab.id ? " on" : ""}`} onClick={() => setSubview(tab.id)}>{tab.label}</button>)}
          </div>
          {isAdmin ? (
            <button className="btn btn-ghost btn-xs" onClick={handleLogoutAdmin} style={{ marginLeft: 8 }}>🔓 Admin</button>
          ) : (
            <button className="btn btn-ghost btn-xs" onClick={handleLogoutPlayer} style={{ marginLeft: 8 }}>👤 Salir</button>
          )}
        </header>
        <div className="main">
          <div className="cat-tabs">
            {activeTorneo?.categorias?.map((c) => <button key={c.id} className={`cat-tab${activeCId === c.id ? " on" : ""}`} onClick={() => setActiveCId(c.id)}>{c.nombre}</button>)}
            {isAdmin && <button className="cat-tab add" onClick={() => setModal({ type: "newC" })}>+ Categoría</button>}
          </div>
          {!activeCat ? <div className="empty"><div className="empty-ico">📂</div><p>Creá o seleccioná una categoría</p></div> : (
            <>
              {subview === "inscripcion" && <Inscripcion cat={activeCat} onAdd={agregarPareja} onDelete={eliminarPareja} onEditPair={(p) => setModal({ type: "editPair", pair: p })} onTogglePago={togglePago} isAdmin={isAdmin} />}
              {subview === "fixture" && <Fixture cat={activeCat} onGenerate={generarFixture} isAdmin={isAdmin} onEditMatch={(m) => isAdmin && setModal({ type: "editMatch", match: m })} />}
              {subview === "resultados" && <Resultados cat={activeCat} onOpen={(m) => isAdmin && setModal({ type: "res", match: m })} isAdmin={isAdmin} onEditMatch={(m) => isAdmin && setModal({ type: "editMatch", match: m })} />}
              {subview === "posiciones" && <Posiciones cat={activeCat} />}
              {subview === "llave" && <LlaveFinal cat={activeCat} allMatches={allMatches} onActualizarClasificados={actualizarClasificados} onOpen={(m) => isAdmin && setModal({ type: "koRes", match: m })} onAwardPoints={otorgarPuntos} pointsAwarded={activeCat.pointsAwarded} isAdmin={isAdmin} onEditMatch={(m) => isAdmin && setModal({ type: "editMatch", match: m })} />}
              {subview === "agenda" && isAdmin && <AgendaView torneo={activeTorneo} allPartidos={[...allMatches, ...(activeTorneo?.categorias?.flatMap(c => c.knockoutRounds?.flat() || []) || [])]} isAdmin={isAdmin} onEditMatch={(m) => setModal({ type: "editMatch", match: m })} />}
            </>
          )}
        </div>
        {modal?.type === "newC" && (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Nueva Categoría</div>
              <div className="col mb16"><label className="lbl">Nombre</label><input className="inp" autoFocus placeholder="ej: Primera, Damas, Mixtos..." value={cForm.nombre} onChange={(e) => setCForm({ nombre: e.target.value })} onKeyDown={(e) => e.key === "Enter" && crearCategoria()} /></div>
              <div className="row g8"><button className="btn btn-primary f1" onClick={crearCategoria}>Crear</button><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button></div>
            </div>
          </div>
        )}
        {modal?.type === "editPair" && <EditPairModal pair={modal.pair} onSave={editarPareja} onClose={() => setModal(null)} />}
        {modal?.type === "res" && activeCat && <ResultModal match={modal.match} cat={activeCat} onSave={guardarResultado} onClose={() => setModal(null)} />}
        {modal?.type === "koRes" && activeCat && <ResultModal match={modal.match} cat={activeCat} onSave={guardarResultadoKnockout} onClose={() => setModal(null)} />}
        {modal?.type === "editMatch" && activeCat && (
          <EditMatchModal
            match={modal.match}
            cat={activeCat}
            allPartidos={[...activeCat.partidos, ...(activeCat.knockoutRounds?.flat() || [])]}
            onSave={editarPartido}
            onClose={() => setModal(null)}
          />
        )}
        {showPinModal && <PinModal onSuccess={() => { setShowPinModal(false); setIsAdmin(true); }} onClose={() => setShowPinModal(false)} />}
      </div>
    </>
  );
}
