import { useState, useEffect } from "react";

const uid = () => Math.random().toString(36).slice(2, 9);
const COURTS = ["BOX 3", "BOX 2", "BOX 1"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const n = (x) => parseInt(x) || 0;
const MIN_GAP = 300;

const SLOT_DEFS = [
  { dia: "JUEVES", hora: "19:00", mins: 1140 },
  { dia: "JUEVES", hora: "20:15", mins: 1215 },
  { dia: "JUEVES", hora: "21:30", mins: 1290 },
  { dia: "VIERNES", hora: "19:00", mins: 2580 },
  { dia: "VIERNES", hora: "20:15", mins: 2655 },
  { dia: "VIERNES", hora: "21:30", mins: 2730 },
  { dia: "SÁBADO", hora: "9:00", mins: 3420 },
  { dia: "SÁBADO", hora: "10:15", mins: 3495 },
  { dia: "SÁBADO", hora: "11:30", mins: 3570 },
  { dia: "SÁBADO", hora: "13:00", mins: 3660 },
  { dia: "SÁBADO", hora: "14:15", mins: 3735 },
  { dia: "SÁBADO", hora: "15:30", mins: 3810 },
  { dia: "SÁBADO", hora: "17:00", mins: 3900 },
  { dia: "SÁBADO", hora: "18:15", mins: 3975 },
  { dia: "SÁBADO", hora: "19:30", mins: 4050 },
  { dia: "DOMINGO", hora: "9:00", mins: 4860 },
  { dia: "DOMINGO", hora: "10:15", mins: 4935 },
  { dia: "DOMINGO", hora: "11:30", mins: 5010 },
  { dia: "DOMINGO", hora: "13:00", mins: 5100 },
  { dia: "DOMINGO", hora: "14:15", mins: 5175 },
  { dia: "DOMINGO", hora: "15:30", mins: 5250 },
];
const ALL_SLOTS = SLOT_DEFS.flatMap((s) =>
  COURTS.map((c) => ({ ...s, cancha: c }))
);

const STAGE_PTS = { campeon: 100, finalista: 75, semifinal: 50, cuartos: 25, octavos: 15, zona: 10 };
const STAGE_LABEL = {
  campeon: "🥇 Campeón",
  finalista: "🥈 Finalista",
  semifinal: "🥉 Semifinal",
  cuartos: "⚡ Cuartos",
  octavos: "📋 Octavos",
  zona: "📍 Zona",
};

function buildRestrMap(pairs) {
  const map = {};
  pairs.forEach((p) => {
    if (!p.sinProblemas && p.restricciones?.length)
      map[p.id] = new Set(p.restricciones);
  });
  return map;
}

function scheduleMatches(newMatches, alreadyPlaced = [], pairRestrictions = {}, startAfterMins = 0) {
  const occupied = new Set(alreadyPlaced.map((m) => `${m.dia}|${m.hora}|${m.cancha}`));
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
  const isBlocked = (slot, p1id, p2id) => {
    const r1 = pairRestrictions[p1id] || new Set();
    const r2 = pairRestrictions[p2id] || new Set();
    const slotKey = `${slot.dia}|${slot.hora}|${slot.cancha}`;
    return r1.has(slotKey) || r2.has(slotKey);
  };
  let availableSlots = ALL_SLOTS;
  if (startAfterMins > 0) {
    availableSlots = ALL_SLOTS.filter(slot => slot.mins >= startAfterMins);
  }
  return newMatches.map((m) => {
    for (const slot of availableSlots) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (occupied.has(key) || isBlocked(slot, m.p1id, m.p2id)) continue;
      const allTimes = [...(pairMins[m.p1id] || []), ...(pairMins[m.p2id] || [])];
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
    for (const slot of availableSlots) {
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
    for (const slot of availableSlots) {
      const key = `${slot.dia}|${slot.hora}|${slot.cancha}`;
      if (!occupied.has(key)) {
        occupied.add(key);
        return { ...m, ...slot, conflict: true, restrictionConflict: true };
      }
    }
    return { ...m, dia: "?", hora: "?", cancha: COURTS[0], conflict: true, restrictionConflict: true };
  });
}

function roundRobin(ids) {
  const matches = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      matches.push([ids[i], ids[j]]);
  return matches;
}

function calcMatchResult(m) {
  let sa = 0, sb = 0;
  if (n(m.s1p1) > n(m.s1p2)) sa++; else sb++;
  if (n(m.s2p1) > n(m.s2p2)) sa++; else sb++;
  if (sa === sb) { if (n(m.tbp1) > n(m.tbp2)) sa++; else sb++; }
  return sa > sb ? m.p1id : m.p2id;
}

function calcStandings(pairIds, pairs, matches) {
  const byId = Object.fromEntries(pairs.map((p) => [p.id, p]));
  const s = {};
  pairIds.forEach((id) => (s[id] = { id, pts: 0, pj: 0, g: 0, per: 0, sg: 0, sp: 0, gg: 0, gp: 0 }));
  matches.filter((m) => m.done && pairIds.includes(m.p1id) && pairIds.includes(m.p2id)).forEach((m) => {
    const a = s[m.p1id], b = s[m.p2id];
    if (!a || !b) return;
    let sa = 0, sb = 0;
    if (n(m.s1p1) > n(m.s1p2)) sa++; else sb++;
    if (n(m.s2p1) > n(m.s2p2)) sa++; else sb++;
    if (sa === sb) { if (n(m.tbp1) > n(m.tbp2)) sa++; else sb++; }
    const ga = n(m.s1p1) + n(m.s2p1), gb = n(m.s1p2) + n(m.s2p2);
    a.pj++; b.pj++;
    a.sg += sa; a.sp += sb; b.sg += sb; b.sp += sa;
    a.gg += ga; a.gp += gb; b.gg += gb; b.gp += ga;
    if (sa > sb) { a.g++; a.pts += 2; b.per++; } else { b.g++; b.pts += 2; a.per++; }
  });
  return pairIds.map((id) => ({ ...s[id], pair: byId[id] })).sort((a, b) => b.pts - a.pts || (b.sg - b.sp) - (a.sg - a.sp) || (b.gg - b.gp) - (a.gg - a.gp));
}

function buildBracket(classified) {
  let size = 1;
  while (size < classified.length) size *= 2;
  const seeded = [...classified];
  while (seeded.length < size) seeded.push(null);
  const rounds = [], r1 = [];
  for (let i = 0; i < size; i += 2) {
    const a = seeded[i], b = seeded[i + 1];
    r1.push({
      id: uid(), round: 0, slot: r1.length,
      p1id: a?.pairId || null, p1label: a ? `1° ${a.grupo}` : "BYE",
      p2id: b?.pairId || null, p2label: b ? `2° ${b.grupo}` : "BYE",
      done: false, winner: (!b ? a?.pairId : !a ? b?.pairId : null), auto: !a || !b,
      s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "", prevIds: [],
    });
  }
  rounds.push(r1);
  let prev = r1;
  while (prev.length > 1) {
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      const mA = prev[i], mB = prev[i + 1];
      next.push({
        id: uid(), round: rounds.length, slot: next.length,
        p1id: mA.auto ? mA.winner : null, p1label: `G ${mA.id.slice(0, 4)}`,
        p2id: mB?.auto ? mB.winner : null, p2label: mB ? `G ${mB.id.slice(0, 4)}` : "BYE",
        done: false, winner: null, auto: false,
        s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "", prevIds: [mA.id, mB?.id],
      });
    }
    rounds.push(next);
    prev = next;
  }
  return rounds;
}

function calcPairStages(cat) {
  const stages = {};
  if (!cat.knockoutGenerated || !cat.knockoutRounds?.length) {
    cat.parejas.forEach((p) => { stages[p.id] = "zona"; });
    return stages;
  }
  const classified = new Set();
  cat.knockoutRounds[0].forEach((m) => { if (m.p1id) classified.add(m.p1id); if (m.p2id) classified.add(m.p2id); });
  cat.parejas.forEach((p) => { if (!classified.has(p.id)) stages[p.id] = "zona"; });
  const total = cat.knockoutRounds.length;
  cat.knockoutRounds.forEach((round, ri) => {
    round.forEach((m) => {
      if (!m.done || !m.winner) return;
      const loser = m.winner === m.p1id ? m.p2id : m.p1id;
      const rem = total - 1 - ri;
      if (rem === 0) { stages[m.winner] = "campeon"; if (loser) stages[loser] = "finalista"; }
      else if (rem === 1 && loser) stages[loser] = "semifinal";
      else if (rem === 2 && loser) stages[loser] = "cuartos";
      else if (loser) stages[loser] = "octavos";
    });
  });
  return stages;
}

function getKnockoutWithSchedules(knockoutRounds, existingMatches, parejas, startAfterMins = 0) {
  if (!knockoutRounds || !knockoutRounds.length) return knockoutRounds;
  const allMatches = knockoutRounds.flat().filter(m => !m.auto && m.p1id && m.p2id);
  if (allMatches.length === 0) return knockoutRounds;
  const pairRestrictions = buildRestrMap(parejas);
  const scheduled = scheduleMatches(allMatches, existingMatches, pairRestrictions, startAfterMins);
  const scheduledMap = new Map(scheduled.map(m => [m.id, m]));
  return knockoutRounds.map(round =>
    round.map(m => {
      if (m.auto) return m;
      const scheduledMatch = scheduledMap.get(m.id);
      return scheduledMatch ? { ...m, ...scheduledMatch } : m;
    })
  );
}

function groupPairsByRestrictions(pairs, groupSize) {
  const pairsWithProfile = pairs.map(p => ({
    ...p,
    profile: (p.restricciones || []).slice().sort().join('|'),
  }));
  pairsWithProfile.sort((a, b) => a.profile.localeCompare(b.profile));
  const groups = [];
  for (let i = 0; i < pairsWithProfile.length; i += groupSize) {
    groups.push(pairsWithProfile.slice(i, i + groupSize));
  }
  return groups;
}

function generateZoneMatches(pairIds, grupoId, startCode) {
  const rawMatches = roundRobin(pairIds);
  return rawMatches.map(([p1id, p2id], idx) => ({
    id: uid(),
    type: "grupo",
    grupoId,
    p1id,
    p2id,
    code: `Z${startCode + idx}`,
    done: false,
    winner: null,
    s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "",
  }));
}

// ─── CSS completo ───
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
`;
// ─── Result Modal (igual que antes) ───
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
          <button className="btn btn-primary f1" onClick={() => winner && onSave(match.id, { ...form, done: true })} disabled={!winner}>Guardar</button>
          {match.done && (
            <button className="btn btn-danger btn-sm" onClick={() => onSave(match.id, { s1p1: "", s1p2: "", s2p1: "", s2p2: "", tbp1: "", tbp2: "", done: false })}>Borrar</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Pair Modal (con restricciones por slot exacto) ───
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
  const [restr, setRestr] = useState(new Set(pair.restricciones || []));
  const s = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  function toggleSlot(slotKey) {
    setRestr((prev) => {
      const n = new Set(prev);
      n.has(slotKey) ? n.delete(slotKey) : n.add(slotKey);
      return n;
    });
    if (form.sinProblemas) setForm((p) => ({ ...p, sinProblemas: false }));
  }
  function toggleSinProblemas() {
    if (!form.sinProblemas) setRestr(new Set());
    setForm((p) => ({ ...p, sinProblemas: !p.sinProblemas }));
  }
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-title">Editar Pareja</div>
        <div className="col mb12"><label className="lbl">Nombre de la pareja</label><input className="inp" value={form.nombre} onChange={s("nombre")} placeholder="González / Martínez" /></div>
        <div className="divider" />
        <div className="grid2 mb12">
          <div className="col"><label className="lbl">Jugador 1 — Nombre</label><input className="inp" value={form.j1nombre} onChange={s("j1nombre")} /></div>
          <div className="col"><label className="lbl">Jugador 1 — Cédula</label><input className="inp" value={form.j1cedula} onChange={s("j1cedula")} placeholder="Ej: 1234567" /></div>
        </div>
        <div className="grid2 mb12">
          <div className="col"><label className="lbl">Jugador 2 — Nombre</label><input className="inp" value={form.j2nombre} onChange={s("j2nombre")} /></div>
          <div className="col"><label className="lbl">Jugador 2 — Cédula</label><input className="inp" value={form.j2cedula} onChange={s("j2cedula")} placeholder="Ej: 7654321" /></div>
        </div>
        <div className="divider" />
        <div className="card-title" style={{ marginBottom: 12 }}>Restricciones de Horario (horas exactas que NO pueden jugar)</div>
        <button className={`restr-toggle${form.sinProblemas ? " active" : ""}`} onClick={toggleSinProblemas}>
          {form.sinProblemas ? "✅ Sin problemas de horario" : "☐ Sin problemas de horario"}
        </button>
        {!form.sinProblemas && (
          <>
            <div className="lbl" style={{ marginBottom: 8 }}>Seleccioná los horarios que NO pueden jugar</div>
            <div className="restr-grid">
              {ALL_SLOTS.map((slot) => {
                const slotKey = `${slot.dia}|${slot.hora}|${slot.cancha}`;
                return (
                  <button
                    key={slotKey}
                    className={`restr-bloque${restr.has(slotKey) ? " blocked" : ""}`}
                    onClick={() => toggleSlot(slotKey)}
                  >
                    <span>{restr.has(slotKey) ? "🚫" : "🕐"}</span>
                    {slot.dia} {slot.hora} · {slot.cancha}
                  </button>
                );
              })}
            </div>
            <div className="col mb12"><label className="lbl">Notas adicionales</label><input className="inp" value={form.notasLibres} onChange={s("notasLibres")} placeholder="ej: solo pueden después de las 16hs el sábado" /></div>
          </>
        )}
        <div className="row g8 mt8">
          <button className="btn btn-primary f1" onClick={() => onSave({ ...pair, ...form, j1: form.j1nombre, j2: form.j2nombre, restricciones: Array.from(restr), sinProblemas: form.sinProblemas })}>Guardar cambios</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inscripcion (con selector de tamaño de zona) ───
function Inscripcion({ cat, onAdd, onDelete, onEditPair, onTogglePago, onSetZonaSize, zonaSize }) {
  if (!cat || !cat.parejas || !cat.grupos) return <div className="empty">Cargando datos de la categoría...</div>;
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
      restricciones: [],
      notasLibres: "",
    });
    setForm(empty);
  }
  const s = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const totalPagos = cat.parejas.reduce((acc, p) => acc + (p.pagoJ1 ? 1 : 0) + (p.pagoJ2 ? 1 : 0), 0);
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
      {!cat.fixtureGenerado && (
        <div className="card mb16">
          <div className="card-title">Configuración del torneo</div>
          <div className="row g8">
            <span className="lbl">Tamaño de las zonas:</span>
            <button className={`btn ${zonaSize === 3 ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => onSetZonaSize(3)}>3 parejas</button>
            <button className={`btn ${zonaSize === 4 ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => onSetZonaSize(4)}>4 parejas</button>
          </div>
        </div>
      )}
      {cat.fixtureGenerado && <div className="alert alert-warn">⚠️ Fixture generado. Nuevas parejas se asignan a la zona con menos integrantes respetando restricciones y descanso de 5 horas.</div>}
      {showAdd ? (
        <div className="card mb16">
          <div className="row just-between mb12"><div className="card-title" style={{ margin: 0 }}>Agregar Pareja</div>{cat.fixtureGenerado && <button className="icon-btn" onClick={() => setShowAdd(false)}>✕</button>}</div>
          <div className="col f1 mb12"><label className="lbl">Nombre pareja</label><input className="inp" placeholder="González / Martínez" value={form.nombre} onChange={s("nombre")} /></div>
          <div className="grid2 mb12">
            <div className="col"><label className="lbl">J1 — Nombre</label><input className="inp" value={form.j1nombre} onChange={s("j1nombre")} /></div>
            <div className="col"><label className="lbl">J1 — Cédula</label><input className="inp" value={form.j1cedula} onChange={s("j1cedula")} placeholder="1234567" /></div>
            <div className="col"><label className="lbl">J2 — Nombre</label><input className="inp" value={form.j2nombre} onChange={s("j2nombre")} /></div>
            <div className="col"><label className="lbl">J2 — Cédula</label><input className="inp" value={form.j2cedula} onChange={s("j2cedula")} placeholder="7654321" onKeyDown={(e) => e.key === "Enter" && handleAdd()} /></div>
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>+ Agregar pareja</button>
        </div>
      ) : (
        <div className="row mb16"><button className="btn btn-secondary" onClick={() => setShowAdd(true)}>+ Agregar pareja al fixture</button></div>
      )}
      {cat.parejas.length === 0 ? (
        <div className="empty"><div className="empty-ico">👥</div><p>No hay parejas inscriptas aún</p></div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>#</th><th>Pareja</th><th>J1</th><th>CI</th><th>Pago J1</th><th>J2</th><th>CI</th><th>Pago J2</th><th>Restricciones</th><th>Zona</th><th></th></tr></thead>
            <tbody>
              {cat.parejas.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: "Oswald", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>{i+1}</td>
                  <td className="em">{p.nombre}</td>
                  <td>{p.j1nombre || p.j1}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{p.j1cedula || "—"}</td>
                  <td><button className={`pago-pill ${p.pagoJ1 ? "pago-ok" : "pago-no"}`} onClick={() => onTogglePago(p.id, "pagoJ1")}>{p.pagoJ1 ? "✓ Pagado" : "✗ Pendiente"}</button></td>
                  <td>{p.j2nombre || p.j2}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{p.j2cedula || "—"}</td>
                  <td><button className={`pago-pill ${p.pagoJ2 ? "pago-ok" : "pago-no"}`} onClick={() => onTogglePago(p.id, "pagoJ2")}>{p.pagoJ2 ? "✓ Pagado" : "✗ Pendiente"}</button></td>
                  <td>
                    {p.sinProblemas !== false && p.restricciones?.length === 0 ? (
                      <span className="restr-badge restr-ok">✓ Sin problemas</span>
                    ) : (
                      <div className="col" style={{ gap: 2 }}>
                        {(p.restricciones || []).slice(0, 2).map((r) => <span key={r} className="restr-badge">🚫 {r}</span>)}
                        {p.restricciones?.length > 2 && <span className="restr-badge">+{p.restricciones.length-2}</span>}
                        {p.notasLibres && <span style={{ fontSize: 10, color: "var(--muted)" }}>{p.notasLibres}</span>}
                      </div>
                    )}
                  </td>
                  <td>{p.grupoId ? <span className="badge bg">{gName[p.grupoId] || "?"}</span> : <span className="badge bx">—</span>}</td>
                  <td><div className="row g8"><button className="btn btn-secondary btn-xs" onClick={() => onEditPair(p)}>✏️</button>{!cat.fixtureGenerado && <button className="btn btn-danger btn-xs" onClick={() => onDelete(p.id)}>✕</button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Fixture (igual, pero ahora respetará el tamaño de zona) ───
function Fixture({ cat, onGenerate }) {
  const byId = Object.fromEntries(cat.parejas.map((p) => [p.id, p]));
  if (!cat.fixtureGenerado)
    return (
      <div>
        <div className="sec-hdr"><div className="sec-title">Fixture</div></div>
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div className="empty-ico">📅</div>
          <p className="mb16" style={{ color: "var(--muted)" }}>
            {cat.parejas.length < (cat.zonaSize || 3) ? `Necesitás al menos ${cat.zonaSize || 3} parejas (tenés ${cat.parejas.length})` : `${cat.parejas.length} parejas · ${Math.ceil(cat.parejas.length / (cat.zonaSize || 3))} zonas de ${cat.zonaSize || 3}`}
          </p>
          {cat.parejas.length >= (cat.zonaSize || 3) && (<button className="btn btn-primary" onClick={onGenerate}>⚡ Generar Fixture</button>)}
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
          <span className="badge bg">{cat.grupos.length} Zonas ({cat.zonaSize || 3} c/u)</span>
          <span className="badge bb">{cat.partidos.length} Partidos</span>
          <span className="badge by">{cat.partidos.filter((m) => m.done).length} Completados</span>
          {conflictos > 0 && <span className="badge by">⚠️ {conflictos} advertencias</span>}
        </div>
      </div>
      {conflictos > 0 && <div className="alert alert-warn">⚠️ Algunos partidos tienen conflictos de descanso (⚠️) o restricción (🚫). Se resolvieron lo mejor posible.</div>}
      <div className="grid3 mb16">
        {cat.grupos.map((g) => {
          const gp = cat.parejas.filter((p) => p.grupoId === g.id);
          return (
            <div key={g.id} className="card" style={{ margin: 0 }}>
              <div className="card-title">{g.nombre}</div>
              {gp.map((p, i) => (
                <div key={p.id} className="row g8" style={{ padding: "6px 0", borderBottom: i < gp.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontFamily: "Oswald", fontWeight: 700, color: "var(--muted)", fontSize: 12, minWidth: 16 }}>{i+1}</span>
                  <div><div style={{ fontSize: 13, color: "var(--text)" }}>{p.nombre}</div>{(p.restricciones || []).length > 0 && <span style={{ fontSize: 10, color: "var(--danger)" }}>🚫 {p.restricciones.length} restricción{}</span>}</div>
                </div>
              ))}
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
                    <div><div className="slot-day">{m.dia}</div><div className="slot-time">{m.hora}</div><div className="slot-match">{byId[m.p1id]?.nombre} vs {byId[m.p2id]?.nombre}</div></div>
                    <div className="col" style={{ alignItems: "flex-end", gap: 4 }}><span className="slot-code">{m.code}</span>{m.done && <span style={{ fontSize: 9, color: "var(--accent)" }}>✓</span>}{m.conflict && !m.restrictionConflict && <span className="ctag">⚠️ Descanso</span>}{m.restrictionConflict && <span className="ctag ctag-r">🚫 Restricción</span>}</div>
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

// ─── Resultados (igual) ───
function Resultados({ cat, onOpen }) {
  const byId = Object.fromEntries(cat.parejas.map((p) => [p.id, p]));
  if (!cat.fixtureGenerado) return <div className="empty"><div className="empty-ico">⚡</div><p>Generá el fixture primero</p></div>;
  if (!cat.partidos || cat.partidos.length === 0) return <div className="empty"><div className="empty-ico">📋</div><p>No hay partidos cargados en esta categoría.</p></div>;
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
              <thead><tr><th>Cód</th><th>Pareja 1</th><th>Resultado</th><th>Pareja 2</th><th>Horario</th><th></th></tr></thead>
              <tbody>
                {gm.map((m) => {
                  const p1 = byId[m.p1id], p2 = byId[m.p2id], w = m.done ? (m.winner === m.p1id ? 1 : 2) : null;
                  return (
                    <tr key={m.id}>
                      <td><span className="slot-code">{m.code}</span></td>
                      <td className={w === 1 ? "em" : ""} style={w === 1 ? { color: "var(--accent)", fontWeight: 700 } : {}}>{p1?.nombre}</td>
                      <td>{m.done ? (<span><span className="res-set">{m.s1p1}-{m.s1p2}</span><span className="res-set">{m.s2p1}-{m.s2p2}</span>{m.tbp1 !== "" && m.tbp2 !== "" && <span className="res-set" style={{ color: "var(--gold)" }}>TB:{m.tbp1}-{m.tbp2}</span>}</span>) : (<span style={{ color: "var(--muted)", fontSize: 12 }}>Pendiente</span>)}</td>
                      <td className={w === 2 ? "em" : ""} style={w === 2 ? { color: "var(--accent)", fontWeight: 700 } : {}}>{p2?.nombre}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{m.dia} {m.hora} · {m.cancha}</td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => onOpen(m)}>{m.done ? "✏️" : "+ Resultado"}</button></td>
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

// ─── Posiciones (igual) ───
function Posiciones({ cat }) {
  if (!cat.fixtureGenerado) return <div className="empty"><div className="empty-ico">📊</div><p>Generá el fixture para ver las posiciones</p></div>;
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Posiciones</div></div>
      <div className="grid2">
        {cat.grupos.map((g) => {
          const ids = cat.parejas.filter((p) => p.grupoId === g.id).map((p) => p.id);
          const st = calcStandings(ids, cat.parejas, cat.partidos.filter((m) => m.grupoId === g.id));
          return (
            <div key={g.id} className="card" style={{ margin: 0 }}>
              <div className="card-title">{g.nombre}</div>
              <table className="tbl">
                <thead><tr><th>Pos</th><th>Pareja</th><th>PJ</th><th>G</th><th>P</th><th>S+</th><th>S-</th><th>G+</th><th>G-</th><th>Pts</th></tr></thead>
                <tbody>
                  {st.map((s, i) => (
                    <tr key={s.id} style={i < 2 ? { background: "rgba(61,255,160,.03)" } : {}}>
                      <td><span className={i === 0 ? "pos-g" : i === 1 ? "pos-s" : "pos-b"} style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 15 }}>{i+1}</span>{i < 2 && <span className="classif">✓</span>}</td>
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

// ─── Llave Final (modificada: recibe startAfterMins y recalcula horarios) ───
const ROUND_NAMES = ["OCTAVOS", "CUARTOS", "SEMIS", "FINAL", "RONDA 5", "RONDA 6"];
function LlaveFinal({ cat, allMatches, onGenerate, onOpen, onAwardPoints, pointsAwarded, startAfterMins }) {
  const byId = Object.fromEntries(cat.parejas.map((p) => [p.id, p]));
  const knockoutRoundsWithSchedules = React.useMemo(() => {
    if (!cat.knockoutRounds) return [];
    return getKnockoutWithSchedules(cat.knockoutRounds, allMatches, cat.parejas, startAfterMins || 0);
  }, [cat.knockoutRounds, allMatches, cat.parejas, startAfterMins]);
  const koFlat = knockoutRoundsWithSchedules.flat();
  const koDone = koFlat.filter((m) => m.done && !m.auto).length;
  const koTotal = koFlat.filter((m) => !m.auto).length;
  if (!cat.knockoutGenerated)
    return (
      <div>
        <div className="sec-hdr"><div className="sec-title">Llave Final</div></div>
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div className="empty-ico">🏆</div>
          {!cat.fixtureGenerado ? (<p style={{ color: "var(--muted)" }}>Generá el fixture de zonas primero</p>) : (
            <><p className="mb12" style={{ color: "var(--muted)" }}>Zona: <strong style={{ color: "var(--accent)" }}>{cat.partidos.filter((m) => m.done).length}/{cat.partidos.length}</strong> partidos completados</p><button className="btn btn-primary" onClick={onGenerate}>🏆 Generar Llave Final</button></>
          )}
        </div>
      </div>
    );
  const stages = calcPairStages(cat);
  const campeon = cat.parejas.find((p) => stages[p.id] === "campeon");
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Llave Final</div>
        <div className="row g8 wrap"><span className="badge bb">{koDone}/{koTotal}</span>{!pointsAwarded && koDone === koTotal && koTotal > 0 && <button className="btn btn-cyan btn-sm" onClick={onAwardPoints}>🏅 Otorgar puntos</button>}{pointsAwarded && <span className="badge bg">✓ Puntos otorgados</span>}</div>
      </div>
      {campeon && (<div className="card mb16" style={{ background: "rgba(255,203,71,.06)", borderColor: "rgba(255,203,71,.3)", textAlign: "center", padding: 28 }}><div style={{ fontSize: 32 }}>🏆</div><div style={{ fontFamily: "Oswald", fontSize: 24, fontWeight: 700, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase" }}>CAMPEÓN</div><div style={{ fontSize: 18, color: "var(--text)", fontWeight: 600, marginTop: 6 }}>{campeon.nombre}</div><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{campeon.j1nombre || campeon.j1} · {campeon.j2nombre || campeon.j2}</div></div>)}
      <div className="card mb16"><div className="bracket-wrap"><div className="bracket">{knockoutRoundsWithSchedules.map((round, ri) => (
        <div key={ri} className="br-round"><div className="br-round-hdr">{ROUND_NAMES[ri] || `Ronda ${ri+1}`}</div><div className="br-matches">{round.map((m) => {
          const p1 = m.p1id ? byId[m.p1id] : null, p2 = m.p2id ? byId[m.p2id] : null, canPlay = m.p1id && m.p2id && !m.auto;
          return (<div key={m.id} className={`br-match${m.done ? " done" : ""}`} onClick={() => canPlay && onOpen(m)}><div className={`br-team${!p1 ? " tbd" : m.done && m.winner === m.p1id ? " win" : ""}`}><span>{p1 ? p1.nombre : m.p1label || "TBD"}</span>{m.done && <span className="br-score">{m.s1p1} {m.s2p1}</span>}</div><div className={`br-team${!p2 ? " tbd" : m.done && m.winner === m.p2id ? " win" : ""}`}><span>{p2 ? p2.nombre : m.p2label || "TBD"}</span>{m.done && <span className="br-score">{m.s1p2} {m.s2p2}</span>}</div>{m.dia && m.hora && m.cancha && (<div className="br-schedule">{m.dia} {m.hora} · {m.cancha}</div>)}</div>);
        })}</div></div>
      ))}</div></div></div>
      <div className="card"><div className="card-title">Posiciones Finales</div><table className="tbl"><thead><tr><th>Etapa</th><th>Pareja</th><th>Jugadores</th><th>Pts</th></tr></thead><tbody>{Object.entries(stages).sort((a,b)=>STAGE_PTS[b[1]]-STAGE_PTS[a[1]]).map(([pid,stage])=>{const p=byId[pid]; if(!p)return null; return(<tr key={pid}><td><span className="badge bg">{STAGE_LABEL[stage]}</span></td><td className="em">{p.nombre}</td><td style={{fontSize:11,color:"var(--muted)"}}>{p.j1nombre||p.j1} · {p.j2nombre||p.j2}</td><td style={{fontFamily:"Oswald",fontWeight:700,color:"var(--gold)",fontSize:16}}>{STAGE_PTS[stage]}</td></tr>);})}</tbody></table></div>
    </div>
  );
}

// ─── JugadoresView (con eliminación) ───
function JugadoresView({ jugadores, onDeleteJugador }) {
  const [sel, setSel] = useState(null);
  const list = Object.values(jugadores).sort((a, b) => b.totalPts - a.totalPts);
  const jug = sel ? jugadores[sel] : null;
  const handleDelete = (cedula, e) => { e.stopPropagation(); if (window.confirm(`¿Eliminar a ${jugadores[cedula]?.nombre} del ranking?`)) { onDeleteJugador(cedula); if (sel === cedula) setSel(null); } };
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Ranking de Jugadores</div><span className="badge bb">{list.length} registrados</span></div>
      {list.length === 0 ? (<div className="empty"><div className="empty-ico">🏅</div><p>Los jugadores aparecen aquí al finalizar un torneo y otorgar puntos</p><p style={{ fontSize: 12, marginTop: 8 }}>Ingresá la cédula de cada jugador en Inscripción</p></div>) : (
        <div className="grid2">
          <div>{list.map((j,i)=>(
            <div key={j.cedula} className="rank-row" style={{ borderColor: sel === j.cedula ? "var(--accent)" : "var(--border)" }} onClick={() => setSel(sel === j.cedula ? null : j.cedula)}>
              <div className={`rank-pos${i===0?" p1":i===1?" p2":i===2?" p3":""}`}>{i+1}</div>
              <div className="f1"><div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{j.nombre}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>CI: {j.cedula}</div></div>
              <div className="col" style={{ alignItems: "flex-end" }}><div className="rank-pts">{j.totalPts}</div><div className="rank-pts-lbl">puntos</div></div>
              <button className="btn btn-danger btn-xs" onClick={(e) => handleDelete(j.cedula, e)}>🗑️</button>
            </div>
          ))}</div>
          <div>{jug ? (<div className="card" style={{ position: "sticky", top: 90 }}><div className="card-title">Historial — {jug.nombre}</div><div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>CI: {jug.cedula}</div><div style={{ fontFamily: "Oswald", fontSize: 36, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>{jug.totalPts}</div><div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>puntos totales</div>{jug.historial.map((h,i)=>(<div key={i} className="hist-item"><div><div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: 2 }}>{h.torneoNombre}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{h.catNombre} · {h.fecha}</div></div><div className="col" style={{ alignItems: "flex-end", gap: 3 }}><span className="badge bg">{STAGE_LABEL[h.stage]}</span><span style={{ fontFamily: "Oswald", fontWeight: 700, color: "var(--gold)", fontSize: 15 }}>+{h.pts}</span></div></div>))}</div>) : (<div className="empty"><div className="empty-ico">👆</div><p>Seleccioná un jugador</p></div>)}</div>
        </div>
      )}
    </div>
  );
}
// ─── APP ───
const TABS = [
  { id: "inscripcion", label: "👥 Inscripción" },
  { id: "fixture", label: "📅 Fixture" },
  { id: "resultados", label: "⚡ Resultados" },
  { id: "posiciones", label: "📊 Posiciones" },
  { id: "llave", label: "🏆 Llave Final" },
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
  // Nuevo estado para tamaño de zona por categoría (se guardará en Firestore)
  const [zonaSizeMap, setZonaSizeMap] = useState({});

  const { db, firestore } = window;
  const { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, writeBatch } = firestore;

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
            cat.parejas = pairsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
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
        jugSnap.docs.forEach(doc => { jugs[doc.id] = { cedula: doc.id, ...doc.data() }; });
        setJugadores(jugs);
        setError(null);
      } catch (err) { console.error(err); setError(err.message); } finally { setLoading(false); }
    };
    loadData();
  }, []);

  const activeTorneo = torneos.find((t) => t.id === activeTId);
  const activeCat = activeTorneo?.categorias?.find((c) => c.id === activeCId);
  const allMatches = activeTorneo?.categorias?.flatMap(c => c.partidos) || [];
  // Calcular el último minuto de todos los partidos de zona (para retrasar la llave)
  const lastZoneMins = Math.max(
    0,
    ...allMatches.filter(m => m.type === "grupo" && m.mins != null).map(m => m.mins),
    ...(activeCat?.partidos?.filter(m => m.type === "grupo" && m.mins != null).map(m => m.mins) || [])
  );
  const startAfterMins = lastZoneMins + MIN_GAP; // las llaves empezarán después del último partido de zona + gap

  function updateCat(catId, fn) {
    setTorneos(prev => prev.map(t => t.id === activeTId ? { ...t, categorias: t.categorias.map(c => c.id === catId ? fn(c) : c) } : t));
  }

  async function guardarCategoria(categoria) { await setDoc(doc(db, "categorias", categoria.id), { ...categoria, torneoId: activeTId }); }
  async function guardarPareja(pareja) { await setDoc(doc(db, "parejas", pareja.id), { ...pareja, categoriaId: activeCId }); }
  async function guardarPartido(partido) { await setDoc(doc(db, "partidos", partido.id), { ...partido, categoriaId: activeCId }); }
  async function guardarKnockout(rounds) { await updateDoc(doc(db, "categorias", activeCId), { knockoutRounds: rounds }); }

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
    await setDoc(doc(db, "torneos", newId), { id: newId, nombre: nuevo.nombre, fecha: nuevo.fecha });
  }

  async function guardarNombreTorneo() {
    if (!editingNameVal.trim()) return;
    await updateDoc(doc(db, "torneos", activeTId), { nombre: editingNameVal.trim() });
    setTorneos(prev => prev.map(t => t.id === activeTId ? { ...t, nombre: editingNameVal.trim() } : t));
    setEditingName(false);
  }

  async function crearCategoria() {
    if (!cForm.nombre.trim()) return;
    const newId = uid();
    const nueva = {
      id: newId, nombre: cForm.nombre.trim(), parejas: [], grupos: [], partidos: [],
      fixtureGenerado: false, knockoutGenerated: false, knockoutRounds: [], pointsAwarded: false,
      torneoId: activeTId, zonaSize: 3, // valor por defecto
    };
    setTorneos(prev => prev.map(t => t.id === activeTId ? { ...t, categorias: [...t.categorias, nueva] } : t));
    setCForm({ nombre: "" });
    setModal(null);
    setActiveCId(newId);
    await guardarCategoria(nueva);
  }

  async function setZonaSize(size) {
    if (!activeCat || activeCat.fixtureGenerado) return;
    updateCat(activeCId, (c) => ({ ...c, zonaSize: size }));
    await guardarCategoria({ ...activeCat, zonaSize: size });
  }

  async function agregarPareja(pair) {
    if (!activeCat.fixtureGenerado) {
      updateCat(activeCId, (c) => ({ ...c, parejas: [...c.parejas, pair] }));
      await guardarPareja(pair);
    } else {
      const c = activeCat;
      const sizes = c.grupos.map((g) => ({ g, cnt: c.parejas.filter((p) => p.grupoId === g.id).length }));
      const available = sizes.filter((x) => x.cnt < (c.zonaSize || 3)).sort((a, b) => a.cnt - b.cnt);
      let tg, newGrupos = c.grupos;
      if (available.length > 0) tg = available[0].g;
      else { tg = { id: uid(), nombre: `ZONA ${LETTERS[c.grupos.length]}` }; newGrupos = [...c.grupos, tg]; }
      const pw = { ...pair, grupoId: tg.id };
      const existing = c.parejas.filter((p) => p.grupoId === tg.id);
      const baseCode = c.partidos.length + 1;
      const newRaw = generateZoneMatches([pw.id, ...existing.map(e => e.id)], tg.id, baseCode);
      const otherMatches = getAllOtherMatches(activeCId);
      const sched = scheduleMatches(newRaw, [...c.partidos, ...otherMatches], buildRestrMap([...c.parejas, pw]));
      const newPartidos = [...c.partidos, ...sched];
      updateCat(activeCId, () => ({ ...c, grupos: newGrupos, parejas: [...c.parejas, pw], partidos: newPartidos }));
      await guardarPareja(pw);
      await guardarCategoria({ ...c, grupos: newGrupos });
      await Promise.all(newPartidos.map(p => guardarPartido(p)));
    }
  }

  function eliminarPareja(id) { updateCat(activeCId, (c) => ({ ...c, parejas: c.parejas.filter((p) => p.id !== id) })); }
  async function editarPareja(updated) {
    updateCat(activeCId, (c) => ({ ...c, parejas: c.parejas.map((p) => (p.id === updated.id ? updated : p)) }));
    setJugadores((prev) => {
      const nxt = { ...prev };
      [{ cedula: updated.j1cedula, nombre: updated.j1nombre || updated.j1 }, { cedula: updated.j2cedula, nombre: updated.j2nombre || updated.j2 }].filter(j => j.cedula && nxt[j.cedula]).forEach(j => { nxt[j.cedula] = { ...nxt[j.cedula], nombre: j.nombre }; });
      return nxt;
    });
    setModal(null);
    await guardarPareja(updated);
  }
  async function togglePago(pairId, field) {
    const pair = activeCat.parejas.find((p) => p.id === pairId);
    if (!pair) return;
    const updated = { ...pair, [field]: !pair[field] };
    updateCat(activeCId, (c) => ({ ...c, parejas: c.parejas.map((p) => (p.id === pairId ? updated : p)) }));
    await guardarPareja(updated);
  }
  function getAllOtherMatches(catId) {
    const t = torneos.find((t) => t.id === activeTId);
    if (!t) return [];
    return t.categorias.filter((c) => c.id !== catId).flatMap((c) => c.partidos.filter((m) => m.dia && m.hora && m.cancha && m.mins != null));
  }

  async function generarFixture() {
    if (!activeCat || activeCat.parejas.length < (activeCat.zonaSize || 3)) return;
    const groupSize = activeCat.zonaSize || 3;
    // Agrupar por restricciones similares
    const grouped = groupPairsByRestrictions(activeCat.parejas, groupSize);
    const grupos = [];
    const assignedPairs = [];
    let codeCounter = 1;
    for (let gIdx = 0; gIdx < grouped.length; gIdx++) {
      const groupPairs = grouped[gIdx];
      const grupoId = uid();
      const grupoNombre = `ZONA ${LETTERS[gIdx]}`;
      grupos.push({ id: grupoId, nombre: grupoNombre });
      for (let p of groupPairs) {
        assignedPairs.push({ ...p, grupoId });
      }
    }
    // Ajustar si sobra o falta, pero por simplicidad asumimos que es múltiplo exacto
    const allPartidos = [];
    for (let g of grupos) {
      const ids = assignedPairs.filter(p => p.grupoId === g.id).map(p => p.id);
      const matches = generateZoneMatches(ids, g.id, codeCounter);
      allPartidos.push(...matches);
      codeCounter += matches.length;
    }
    const otherMatches = getAllOtherMatches(activeCId);
    const scheduled = scheduleMatches(allPartidos, otherMatches, buildRestrMap(assignedPairs));
    const updatedCat = { ...activeCat, parejas: assignedPairs, grupos, partidos: scheduled, fixtureGenerado: true };
    updateCat(activeCId, () => updatedCat);
    await guardarCategoria({ ...updatedCat, id: activeCId });
    await Promise.all(assignedPairs.map(p => guardarPareja(p)));
    await Promise.all(scheduled.map(m => guardarPartido(m)));
  }

  async function guardarResultado(matchId, result) {
    updateCat(activeCId, (c) => {
      const m = c.partidos.find((p) => p.id === matchId); if (!m) return c;
      const winner = result.done ? calcMatchResult({ ...m, ...result }) : null;
      return { ...c, partidos: c.partidos.map((p) => (p.id === matchId ? { ...p, ...result, winner } : p)) };
    });
    setModal(null);
    await updateDoc(doc(db, "partidos", matchId), result);
  }

  async function guardarResultadoKnockout(matchId, result) {
    const fm = activeCat.knockoutRounds.flat().find((m) => m.id === matchId);
    if (!fm) return;
    const winner = result.done ? calcMatchResult({ ...fm, ...result }) : null;
    let nr = activeCat.knockoutRounds.map((round) => round.map((m) => (m.id === matchId ? { ...m, ...result, winner, done: !!result.done } : m)));
    if (winner) {
      nr.forEach((round, ri) => {
        round.forEach((m) => {
          if (!m.prevIds?.length) return;
          if (m.prevIds[0] === matchId) nr[ri] = nr[ri].map((nm) => (nm.id === m.id ? { ...nm, p1id: winner } : nm));
          if (m.prevIds[1] === matchId) nr[ri] = nr[ri].map((nm) => (nm.id === m.id ? { ...nm, p2id: winner } : nm));
        });
      });
    }
    updateCat(activeCId, (c) => ({ ...c, knockoutRounds: nr }));
    setModal(null);
    await guardarKnockout(nr);
  }

  async function generarKnockout() {
    if (!activeCat) return;
    const classified = [];
    for (let g of activeCat.grupos) {
      const ids = activeCat.parejas.filter(p => p.grupoId === g.id).map(p => p.id);
      const st = calcStandings(ids, activeCat.parejas, activeCat.partidos.filter(m => m.grupoId === g.id));
      if (st[0]) classified.push({ pos: 1, grupo: g.nombre, pairId: st[0].id });
      if (st[1]) classified.push({ pos: 2, grupo: g.nombre, pairId: st[1].id });
    }
    const firsts = classified.filter(c => c.pos === 1), seconds = classified.filter(c => c.pos === 2).reverse();
    const seeded = firsts.map((f, i) => [f, seconds[i] || null]).flat().filter(Boolean);
    const rawRounds = buildBracket(seeded);
    const t = torneos.find(t => t.id === activeTId);
    const alreadyScheduled = t ? t.categorias.flatMap(c => c.partidos.filter(m => m.dia && m.hora && m.cancha && m.mins != null)) : [];
    // Usamos startAfterMins para que la llave se programe después de todas las zonas
    const allKoMatches = rawRounds.flat().filter(m => !m.auto && m.p1id && m.p2id);
    const pairRestrictions = buildRestrMap(activeCat.parejas);
    const scheduledKo = scheduleMatches(allKoMatches, alreadyScheduled, pairRestrictions, startAfterMins);
    const newRounds = rawRounds.map(round => round.map(m => {
      if (m.auto) return m;
      const found = scheduledKo.find(sm => sm.id === m.id);
      return found ? { ...m, ...found } : m;
    }));
    updateCat(activeCId, c => ({ ...c, knockoutRounds: newRounds, knockoutGenerated: true }));
    await guardarCategoria({ ...activeCat, knockoutRounds: newRounds, knockoutGenerated: true });
  }

  async function otorgarPuntos() {
    if (!activeCat || !activeTorneo) return;
    const stages = calcPairStages(activeCat);
    let nuevosJugadores = [];
    setJugadores(prev => {
      const nxt = { ...prev };
      activeCat.parejas.forEach(pair => {
        const stage = stages[pair.id] || "zona";
        const pts = STAGE_PTS[stage] || 0;
        [pair.j1cedula, pair.j2cedula].forEach(cedula => {
          if (!cedula) return;
          const nombre = cedula === pair.j1cedula ? pair.j1nombre || pair.j1 : pair.j2nombre || pair.j2;
          if (!nxt[cedula]) nxt[cedula] = { cedula, nombre, totalPts: 0, historial: [] };
          const already = nxt[cedula].historial.some(h => h.torneoId === activeTId && h.catId === activeCId);
          if (!already) {
            nxt[cedula] = {
              ...nxt[cedula],
              nombre: nombre || nxt[cedula].nombre,
              totalPts: nxt[cedula].totalPts + pts,
              historial: [...nxt[cedula].historial, { torneoId: activeTId, catId: activeCId, torneoNombre: activeTorneo.nombre, catNombre: activeCat.nombre, stage, pts, fecha: new Date().toLocaleDateString("es-PY") }],
            };
          }
        });
      });
      nuevosJugadores = Object.values(nxt);
      return nxt;
    });
    updateCat(activeCId, c => ({ ...c, pointsAwarded: true }));
    const batch = writeBatch(db);
    nuevosJugadores.forEach(j => { const ref = doc(db, "jugadores", j.cedula); batch.set(ref, j); });
    batch.update(doc(db, "categorias", activeCId), { pointsAwarded: true });
    await batch.commit();
    alert("✅ Puntos guardados correctamente");
  }

  async function eliminarJugador(cedula) {
    await deleteDoc(doc(db, "jugadores", cedula));
    setJugadores(prev => { const newJug = { ...prev }; delete newJug[cedula]; return newJug; });
  }

  async function eliminarTorneo(torneoId) {
    setTorneos(p => p.filter(x => x.id !== torneoId));
    await deleteDoc(doc(db, "torneos", torneoId));
  }

  if (loading) return (<><style>{CSS}</style><div className="app"><header className="hdr"><div className="logo">PADEL<em>BOX</em></div></header><div className="main" style={{ textAlign: "center", paddingTop: 80 }}><div className="empty-ico" style={{ fontSize: 40 }}>⏳</div><p style={{ color: "var(--muted)" }}>Cargando torneos...</p></div></div></>);
  if (error) return (<><style>{CSS}</style><div className="app"><header className="hdr"><div className="logo">PADEL<em>BOX</em></div></header><div className="main" style={{ textAlign: "center", paddingTop: 80 }}><div className="empty-ico" style={{ fontSize: 40 }}>⚠️</div><p style={{ color: "var(--danger)" }}>Error al cargar los datos:</p><p style={{ color: "var(--muted)", marginTop: 8 }}>{error}</p><button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => window.location.reload()}>Reintentar</button></div></div></>);

  if (!activeTId) return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="hdr"><div className="logo">PADEL<em>BOX</em></div><div className="nav-tabs" style={{ marginLeft: "auto" }}><button className={`nav-tab${appView === "torneos" ? " on" : ""}`} onClick={() => setAppView("torneos")}>🎾 Torneos</button><button className={`nav-tab jug${appView === "jugadores" ? " on" : ""}`} onClick={() => setAppView("jugadores")}>🏅 Jugadores</button></div></header>
        <div className="main">
          {appView === "jugadores" ? (<JugadoresView jugadores={jugadores} onDeleteJugador={eliminarJugador} />) : (
            <><div className="hero"><div className="hero-title">GESTIÓN DE<br/><span>TORNEOS</span></div><div className="hero-sub">Creá, organizá y gestioná todos tus torneos de pádel</div><button className="btn btn-primary" onClick={() => setModal({ type: "newT" })}>+ Nuevo Torneo</button></div>
            {torneos.length === 0 ? (<div className="empty"><div className="empty-ico">🎾</div><p>No hay torneos creados aún</p></div>) : (<div className="grid2">{torneos.map(t => (<button key={t.id} className="t-card" onClick={() => { setActiveTId(t.id); setActiveCId(null); setSubview("inscripcion"); }}><div className="t-card-name">{t.nombre}</div><div className="t-card-meta">{t.fecha || "Sin fecha"} · {t.categorias.length} categoría{t.categorias.length !== 1 ? "s" : ""}</div><div className="row wrap g8">{t.categorias.map(c => <span key={c.id} className="badge bb">{c.nombre}</span>)}{!t.categorias.length && <span className="badge bx">Sin categorías</span>}</div><div className="t-card-del" onClick={(e) => { e.stopPropagation(); if (window.confirm("¿Eliminar este torneo?")) eliminarTorneo(t.id); }}><button className="btn btn-danger btn-xs">Eliminar</button></div></button>))}</div>)}</>
          )}
        </div>
        {modal?.type === "newT" && (<div className="overlay" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">Nuevo Torneo</div><div className="col mb12"><label className="lbl">Nombre</label><input className="inp" autoFocus placeholder="ej: Torneo Apertura 2026" value={tForm.nombre} onChange={e => setTForm(p => ({ ...p, nombre: e.target.value }))} onKeyDown={e => e.key === "Enter" && crearTorneo()} /></div><div className="col mb16"><label className="lbl">Fecha de inicio</label><input className="inp" type="date" value={tForm.fecha} onChange={e => setTForm(p => ({ ...p, fecha: e.target.value }))} /></div><div className="row g8"><button className="btn btn-primary f1" onClick={crearTorneo}>Crear</button><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button></div></div></div>)}
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="hdr">
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTId(null)}>← Torneos</button>
          <div className="hdr-name-wrap">{editingName ? (<><input className="edit-inline" autoFocus value={editingNameVal} onChange={e => setEditingNameVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") guardarNombreTorneo(); if (e.key === "Escape") setEditingName(false); }} /><button className="icon-btn" onClick={guardarNombreTorneo}>✓</button><button className="icon-btn" onClick={() => setEditingName(false)}>✕</button></>) : (<><div className="hdr-name">{activeTorneo?.nombre}</div><button className="icon-btn" onClick={() => { setEditingNameVal(activeTorneo?.nombre || ""); setEditingName(true); }}>✏️</button></>)}</div>
          <div className="nav-tabs" style={{ marginLeft: "auto" }}>{TABS.map(tab => <button key={tab.id} className={`nav-tab${subview === tab.id ? " on" : ""}`} onClick={() => setSubview(tab.id)}>{tab.label}</button>)}</div>
        </header>
        <div className="main">
          <div className="cat-tabs">{activeTorneo?.categorias?.map(c => <button key={c.id} className={`cat-tab${activeCId === c.id ? " on" : ""}`} onClick={() => setActiveCId(c.id)}>{c.nombre}</button>)}<button className="cat-tab add" onClick={() => setModal({ type: "newC" })}>+ Categoría</button></div>
          {!activeCat ? <div className="empty"><div className="empty-ico">📂</div><p>Creá o seleccioná una categoría</p></div> : (
            <>
              {subview === "inscripcion" && <Inscripcion cat={activeCat} onAdd={agregarPareja} onDelete={eliminarPareja} onEditPair={p => setModal({ type: "editPair", pair: p })} onTogglePago={togglePago} onSetZonaSize={setZonaSize} zonaSize={activeCat.zonaSize || 3} />}
              {subview === "fixture" && <Fixture cat={activeCat} onGenerate={generarFixture} />}
              {subview === "resultados" && <Resultados cat={activeCat} onOpen={m => setModal({ type: "res", match: m })} />}
              {subview === "posiciones" && <Posiciones cat={activeCat} />}
              {subview === "llave" && <LlaveFinal cat={activeCat} allMatches={allMatches} onGenerate={generarKnockout} onOpen={m => setModal({ type: "koRes", match: m })} onAwardPoints={otorgarPuntos} pointsAwarded={activeCat.pointsAwarded} startAfterMins={startAfterMins} />}
            </>
          )}
        </div>
        {modal?.type === "newC" && (<div className="overlay" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">Nueva Categoría</div><div className="col mb16"><label className="lbl">Nombre</label><input className="inp" autoFocus placeholder="ej: Primera, Damas, Mixtos..." value={cForm.nombre} onChange={e => setCForm({ nombre: e.target.value })} onKeyDown={e => e.key === "Enter" && crearCategoria()} /></div><div className="row g8"><button className="btn btn-primary f1" onClick={crearCategoria}>Crear</button><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button></div></div></div>)}
        {modal?.type === "editPair" && <EditPairModal pair={modal.pair} onSave={editarPareja} onClose={() => setModal(null)} />}
        {modal?.type === "res" && activeCat && <ResultModal match={modal.match} cat={activeCat} onSave={guardarResultado} onClose={() => setModal(null)} />}
        {modal?.type === "koRes" && activeCat && <ResultModal match={modal.match} cat={activeCat} onSave={guardarResultadoKnockout} onClose={() => setModal(null)} />}
      </div>
    </>
  );
}
