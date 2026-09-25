// Armado de la llave final (cruces, byes) y etapa alcanzada por cada pareja.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
import { uid, ROUND_NAMES_BY_SIZE } from "./constantes.js";

export function getRoundNames(knockoutRounds) {
  if (!knockoutRounds || knockoutRounds.length === 0) return [];
  const size = knockoutRounds[0].length * 2;
  return ROUND_NAMES_BY_SIZE[size] || knockoutRounds.map((_, i) => `Ronda ${i + 1}`);
}

export function buildDynamicBracket(classified, bracketSize) {
  const primeros = classified.filter(c=>c.pos===1);
  const segundos = classified.filter(c=>c.pos===2);
  const terceros = classified.filter(c=>c.pos===3);
  const slots = Array(bracketSize).fill(null);
  const halfSize = bracketSize/2;
  const firstHalfHeads=[], secondHalfHeads=[];
  for (let i=0;i<halfSize;i+=2) { firstHalfHeads.push(i); secondHalfHeads.push(halfSize+i); }
  // Primeros: alternar mitades
  primeros.forEach((p,i) => {
    const heads = i%2===0 ? firstHalfHeads : secondHalfHeads;
    const slot = heads[Math.floor(i/2)];
    if (slot!==undefined && slots[slot]===null) slots[slot]=p;
  });
  // Segundos: mitad opuesta a su primero de zona
  segundos.forEach(s => {
    const primeroDeMiZona = primeros.find(p=>p.grupo===s.grupo);
    const primerIdx = primeroDeMiZona ? slots.indexOf(primeroDeMiZona) : -1;
    const enPrimera = primerIdx>=0 && primerIdx<halfSize;
    const targetHeads = enPrimera ? secondHalfHeads : firstHalfHeads;
    let placed=false;
    for (const h of targetHeads) {
      if (slots[h+1]===null) { slots[h+1]=s; placed=true; break; }
    }
    if (!placed) {
      const allTarget = enPrimera ? Array.from({length:halfSize},(_,i)=>halfSize+i) : Array.from({length:halfSize},(_,i)=>i);
      for (const slot of allTarget) { if (slots[slot]===null) { slots[slot]=s; break; } }
    }
  });
  // Terceros: no repetir rival de zona en primer cruce
  terceros.forEach(t => {
    let placed=false;
    for (let i=0;i<bracketSize;i++) {
      if (slots[i]!==null) continue;
      const companion = i%2===0 ? slots[i+1] : slots[i-1];
      if (companion && companion.grupo===t.grupo) continue;
      slots[i]=t; placed=true; break;
    }
    if (!placed) { for (let i=0;i<bracketSize;i++) { if (slots[i]===null) { slots[i]=t; break; } } }
  });
  // Post-proceso: corregir cruces de primera ronda entre parejas de la misma zona
  for (let i=0;i<bracketSize;i+=2) {
    if (!slots[i]||!slots[i+1]||slots[i].grupo!==slots[i+1].grupo) continue;
    // Hay conflicto de zona en este cruce — intentar swap con otro slot
    for (let j=0;j<bracketSize;j++) {
      if (j===i||j===i+1||!slots[j]) continue;
      if (slots[j].grupo===slots[i].grupo) continue; // El candidato no puede ser de la misma zona
      const jPair=j%2===0?j+1:j-1;
      const jPartner=slots[jPair];
      // Swap slots[i+1] con slots[j] si no crea un nuevo conflicto
      if (!jPartner||jPartner.grupo!==slots[i+1].grupo) {
        const tmp=slots[i+1]; slots[i+1]=slots[j]; slots[j]=tmp;
        break;
      }
    }
  }

  // Construir rondas
  const rounds=[];
  const r0=[];
  for (let i=0;i<bracketSize;i+=2) {
    const a=slots[i], b=slots[i+1];
    const p1id=a?.pairId||null, p2id=b?.pairId||null;
    const byeMatch=(a&&!b)||(!a&&b), emptyMatch=!a&&!b;
    r0.push({ id:uid(), round:0, slot:r0.length, p1id, p1label:a?`${a.pos}° ${a.grupo}`:"BYE", p1provisorio:a?.provisorio||false, p2id, p2label:b?`${b.pos}° ${b.grupo}`:"BYE", p2provisorio:b?.provisorio||false,
      done:byeMatch||emptyMatch, winner:byeMatch?(p1id||p2id):null, auto:byeMatch||emptyMatch,
      s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:"", prevIds:[] });
  }
  rounds.push(r0);
  let prev=r0;
  while (prev.length>1) {
    const next=[];
    for (let i=0;i<prev.length;i+=2) {
      const mA=prev[i], mB=prev[i+1];
      const p1=mA.auto?mA.winner:null, p2=mB?.auto?mB.winner:null;
      const isBye=mA.auto&&mB?.auto;
      next.push({ id:uid(), round:rounds.length, slot:next.length, p1id:p1, p1label:mA.auto&&p1?"W":`G ${mA.id.slice(0,4)}`,
        p2id:p2, p2label:mB?.auto&&p2?"W":`G ${mB?.id.slice(0,4)}`,
        done:isBye, winner:isBye?(p1||p2||null):null, auto:isBye,
        s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:"", prevIds:[mA.id,mB?.id].filter(Boolean) });
    }
    rounds.push(next); prev=next;
  }
  return rounds;
}

export function calcPairStages(cat) {
  const stages={};
  if (!cat.knockoutGenerated||!cat.knockoutRounds?.length) { cat.parejas.forEach(p=>{stages[p.id]="zona";}); return stages; }
  const classified=new Set();
  cat.knockoutRounds[0].forEach(m=>{ if(m.p1id) classified.add(m.p1id); if(m.p2id) classified.add(m.p2id); });
  cat.parejas.forEach(p=>{ if(!classified.has(p.id)) stages[p.id]="zona"; });
  const total=cat.knockoutRounds.length;
  cat.knockoutRounds.forEach((round,ri)=>{
    round.forEach(m=>{
      if (!m.done||!m.winner) return;
      const loser=m.winner===m.p1id?m.p2id:m.p1id;
      const rem=total-1-ri;
      if (rem===0) { stages[m.winner]="campeon"; if(loser) stages[loser]="finalista"; }
      else if (rem===1&&loser) stages[loser]="semifinal";
      else if (rem===2&&loser) stages[loser]="cuartos";
      else if (rem===3&&loser) stages[loser]="octavos";
      else if (loser) stages[loser]="dieciseisavos";
    });
  });
  return stages;
}
