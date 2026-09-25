// Componente principal: estado de la app, reglas de cada acción y navegación.
// No habla con Firebase: todo lo que se lee o guarda pasa por datos/.
import React, { useState, useEffect } from "react";
import { uid, LETTERS, SLOT_DEFS, STAGE_PTS, AMERICANO_STAGE_PTS, CAT_NUM } from "./logica/constantes.js";
import { calcZoneDistribution, getAvailableSlots, calcCompatibilityScore, roundRobin, scheduleMatches, scheduleKnockoutMatches } from "./logica/programacion.js";
import { calcMatchResult, calcClassified, calcAmericanoIndStandings, calcAmericanoParejasStandings } from "./logica/resultados.js";
import { buildDynamicBracket, calcPairStages } from "./logica/llave.js";
import { CSS } from "./estilos.js";
import { PinModal, PlayerLoginModal, ResultModal, EditPairModal, EditMatchModal, EditKOPairModal } from "./vistas/modales.jsx";
import { Inscripcion, Fixture, Resultados, Posiciones, LlaveFinal, AgendaView } from "./vistas/torneo.jsx";
import { JugadoresView, MiTorneo, ReglamentoView } from "./vistas/jugadores.jsx";
import { InscripcionAmericanoIndividual, AmericanoIndividualView, AmericanoParejasView } from "./vistas/americano.jsx";
import * as datos from "./datos/firestore.js";
import { escucharSesionAdmin, cerrarSesionAdmin, leerSesionJugador, guardarSesionJugador, borrarSesionJugador } from "./datos/sesion.js";

const TABS=[
  {id:"mitorneo",label:"🎾 Mi Torneo",playerOnly:true,hideRR:true},
  {id:"inscripcion",label:"👥 Inscripción",adminOnly:true},
  {id:"fixture",label:"📅 Fixture",hideRR:true},
  {id:"resultados",label:"⚡ Resultados",hideRR:true},
  {id:"posiciones",label:"📊 Posiciones",hideRR:true},
  {id:"llave",label:"🏆 Llave Final",hideRR:true},
  {id:"americano",label:"🎯 Americano",showRR:true},
  {id:"agenda",label:"📋 Agenda",adminOnly:true},
];

export default function App() {
  const [torneos,setTorneos]=useState([]);
  const [jugadores,setJugadores]=useState({});
  const [activeTId,setActiveTId]=useState(null);
  const [activeCId,setActiveCId]=useState(null);
  const [subview,setSubview]=useState("inscripcion");
  const [appView,setAppView]=useState("torneos");
  const [modal,setModal]=useState(null);
  const [tForm,setTForm]=useState({nombre:"",edicion:"",fecha:"",horaInicio:"",catTipo:"libre",catNum:""});
  const [cForm,setCForm]=useState({nombre:"",modalidad:"estandar"});
  const [editingName,setEditingName]=useState(false);
  const [editingNameVal,setEditingNameVal]=useState("");
  const [editingEdicion,setEditingEdicion]=useState(false);
  const [editingEdicionVal,setEditingEdicionVal]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [refreshing,setRefreshing]=useState(false);
  const [isAdmin,setIsAdmin]=useState(false);
  const [isPlayer,setIsPlayer]=useState(false);
  const [showPinModal,setShowPinModal]=useState(false);
  const [showPlayerLogin,setShowPlayerLogin]=useState(false);
  const [playerLoginError,setPlayerLoginError]=useState("");
  const [playerCedula,setPlayerCedula]=useState(null);
  const [publicRanking,setPublicRanking]=useState(false);

  useEffect(()=>{
    // Sesion admin: Firebase Auth (persiste entre recargas y dispositivos)
    const unsub=escucharSesionAdmin(setIsAdmin);
    // Sesion jugador: cedula guardada en el navegador
    const sj=leerSesionJugador();if(sj.activa){setIsPlayer(true);setPlayerCedula(sj.cedula);}
    return unsub;
  },[]);


  const loadData=async(isRefresh=false)=>{
    try {
      if(isRefresh)setRefreshing(true);else setLoading(true);
      const {torneos:tc,jugadores:jugs}=await datos.cargarTodo();
      setTorneos(tc);
      setJugadores(jugs);setError(null);
      } catch(err){console.error(err);setError(err.message);}
      finally{if(isRefresh)setRefreshing(false);else setLoading(false);}
  };
  useEffect(()=>{loadData();},[]);

  const activeTorneo=torneos.find(t=>t.id===activeTId);
  const activeCat=activeTorneo?.categorias?.find(c=>c.id===activeCId);
  const allMatches=activeTorneo?.categorias?.flatMap(c=>[...(c.partidos||[]),...(c.knockoutRounds?.flat()||[])])||[];

  const getAllCedulas=()=>{const s=new Set();torneos.forEach(t=>t.categorias?.forEach(c=>c.parejas?.forEach(p=>{if(p.j1cedula)s.add(p.j1cedula);if(p.j2cedula)s.add(p.j2cedula);})));return s;};
  const handlePlayerLogin=(cedula)=>{if(getAllCedulas().has(cedula)){guardarSesionJugador(cedula);setIsPlayer(true);setPlayerCedula(cedula);setShowPlayerLogin(false);setPlayerLoginError("");}else setPlayerLoginError("Cédula no encontrada en el torneo");};
  const handleLogoutAdmin=async()=>{try{await cerrarSesionAdmin();}catch(err){console.error(err);}setIsAdmin(false);};
  const handleLogoutPlayer=()=>{borrarSesionJugador();setIsPlayer(false);setPlayerCedula(null);};

  function updateCat(catId,fn){setTorneos(prev=>prev.map(t=>t.id===activeTId?{...t,categorias:t.categorias.map(c=>c.id===catId?fn(c):c)}:t));}

  // Atajos que completan el torneo/categoría activos
  async function guardarCategoria(cat){await datos.guardarCategoria(cat,activeTId);}
  async function guardarPareja(p){await datos.guardarPareja(p,activeCId);}
  async function guardarPartido(p){await datos.guardarPartido(p,activeCId);}
  async function guardarKnockout(rounds){
    try{await datos.guardarLlave(activeCId,rounds,true);}
    catch(err){console.error("Error guardando resultado KO:",err);alert("Error al guardar: "+err.message);}
  }

  async function editarPartido(matchId,changes){
    let targetCat=activeCat,targetCatId=activeCId;
    if(!targetCat?.partidos?.some(p=>p.id===matchId)&&!targetCat?.knockoutRounds?.flat()?.some(p=>p.id===matchId)){
      for(const c of activeTorneo?.categorias||[]){
        if(c.partidos?.some(p=>p.id===matchId)||c.knockoutRounds?.flat()?.some(p=>p.id===matchId)){targetCat=c;targetCatId=c.id;break;}
      }
    }
    if(!targetCat)return;
    let updated=false;
    const pi=targetCat.partidos.findIndex(p=>p.id===matchId);
    if(pi!==-1){
      const np=[...targetCat.partidos];np[pi]={...np[pi],...changes};
      updateCat(targetCatId,c=>({...c,partidos:np}));
      await datos.actualizarPartido(matchId,changes);updated=true;
    } else {
      let nk=targetCat.knockoutRounds?[...targetCat.knockoutRounds]:[];let found=false;
      for(let i=0;i<nk.length;i++){const mi=nk[i].findIndex(m=>m.id===matchId);if(mi!==-1){nk[i]=nk[i].map((m,k)=>k===mi?{...m,...changes}:m);found=true;break;}}
      if(found){updateCat(targetCatId,c=>({...c,knockoutRounds:nk}));await datos.guardarLlave(targetCatId,nk);updated=true;}
    }
    if(!updated)console.warn("Partido no encontrado:",matchId);
    setModal(null);
  }

  async function recalcularLlaveProvisoria(catData){
    if(!catData?.knockoutGenerated||!catData?.knockoutRounds?.length)return;
    const result=calcClassified(catData,true);
    if(!result.classified?.length)return;
    const{classified,bracketSize}=result;
    // IDs de todos los clasificados actuales — para validar resultados preservados
    const classifiedIds=new Set(classified.map(c=>c.pairId));
    const newRounds=buildDynamicBracket(classified,bracketSize);
    const existingRounds=catData.knockoutRounds||[];
    const existingSize=existingRounds[0]?existingRounds[0].length*2:0;
    let finalRounds;
    if(existingSize!==bracketSize||existingRounds.length===0){
      finalRounds=newRounds;
    }else{
      // Merge: preservar resultados jugados, ids y enlaces (prevIds).
      // Solo se preserva si AMBOS equipos siguen entre los clasificados actuales;
      // si alguno ya no clasifica, el resultado se descarta (evita resultados fantasma).
      finalRounds=newRounds.map((round,ri)=>round.map((match,mi)=>{
        const old=existingRounds[ri]?.[mi];
        if(!old)return match;
        if(old.done&&!old.auto){
          const p1ok=!old.p1id||classifiedIds.has(old.p1id);
          const p2ok=!old.p2id||classifiedIds.has(old.p2id);
          if(p1ok&&p2ok)return{...old,p1label:match.p1label,p2label:match.p2label,p1provisorio:match.p1provisorio,p2provisorio:match.p2provisorio};
        }
        return{...match,id:old.id,prevIds:old.prevIds||match.prevIds};
      }));
      // Repropagar ganadores de partidos jugados hacia las rondas siguientes
      // (rellena los cruces TBD que se vaciaron al reconstruir la llave).
      for(let ri=0;ri<finalRounds.length-1;ri++){
        finalRounds[ri].forEach(m=>{
          if(!m.done||!m.winner)return;
          finalRounds[ri+1]=finalRounds[ri+1].map(nm=>{
            if(!nm.prevIds?.length||nm.done)return nm;
            if(nm.prevIds[0]===m.id)return{...nm,p1id:m.winner};
            if(nm.prevIds[1]===m.id)return{...nm,p2id:m.winner};
            return nm;
          });
        });
      }
      // Restaurar horario asignado (manual o automático) si las parejas del cruce no cambiaron.
      const oldById={};existingRounds.flat().forEach(m=>{oldById[m.id]=m;});
      finalRounds=finalRounds.map(round=>round.map(m=>{
        const old=oldById[m.id];
        if(old&&old.dia&&old.p1id===m.p1id&&old.p2id===m.p2id)return{...m,dia:old.dia,hora:old.hora,cancha:old.cancha,mins:old.mins};
        return m;
      }));
    }
    // Todo cruce con horario fijado (jugado, manual o preservado) ocupa su slot
    const fixedKO=finalRounds.flat().filter(m=>!m.auto&&m.dia&&m.dia!=="?");
    const allExisting=[...getSlotsOcupados(activeCId),...fixedKO];
    const esAmericanoLlave=catData.modalidad&&catData.modalidad!=="estandar";
    const rescheduled=esAmericanoLlave?finalRounds:scheduleKnockoutMatches(finalRounds,allExisting,catData.parejas);
    updateCat(activeCId,c=>({...c,knockoutRounds:rescheduled}));
    await datos.guardarLlave(activeCId,rescheduled);
  }

  async function crearTorneo(){
    if(!tForm.nombre.trim())return;
    const newId=uid();
    const nuevo={id:newId,nombre:tForm.nombre.trim(),edicion:tForm.edicion.trim(),fecha:tForm.fecha,horaInicio:tForm.horaInicio||"",catTipo:tForm.catTipo,catNum:tForm.catNum,categorias:[]};
    setTorneos(prev=>[...prev,nuevo]);setTForm({nombre:"",edicion:"",edicionSel:"",fecha:"",horaInicio:"",catTipo:"libre",catNum:""});setModal(null);setActiveTId(newId);setActiveCId(null);setSubview("inscripcion");
    try{await datos.crearTorneo({id:newId,nombre:nuevo.nombre,edicion:nuevo.edicion,fecha:nuevo.fecha,horaInicio:nuevo.horaInicio,catTipo:nuevo.catTipo,catNum:nuevo.catNum});}catch(err){console.error(err);}
  }

  async function guardarNombreTorneo(){
    if(!editingNameVal.trim())return;
    await datos.actualizarTorneo(activeTId,{nombre:editingNameVal.trim()});
    setTorneos(prev=>prev.map(t=>t.id===activeTId?{...t,nombre:editingNameVal.trim()}:t));setEditingName(false);
  }

  async function guardarEdicionTorneo(){
    const val=editingEdicionVal.trim();
    await datos.actualizarTorneo(activeTId,{edicion:val});
    setTorneos(prev=>prev.map(t=>t.id===activeTId?{...t,edicion:val}:t));
    setEditingEdicion(false);
  }

  async function crearCategoria(){
    if(!cForm.nombre.trim())return;
    const newId=uid();
    const nueva={id:newId,nombre:cForm.nombre.trim(),modalidad:cForm.modalidad||"estandar",parejas:[],grupos:[],partidos:[],fixtureGenerado:false,knockoutGenerated:false,knockoutRounds:[],pointsAwarded:false,jugadoresAmericano:[],americanoPartidos:[],americanoFixtureGenerado:false,torneoId:activeTId};
    setTorneos(prev=>prev.map(t=>t.id===activeTId?{...t,categorias:[...t.categorias,nueva]}:t));setCForm({nombre:"",modalidad:"estandar"});setModal(null);setActiveCId(newId);
    await guardarCategoria(nueva);
  }

  async function agregarPareja(pair){
    if(!activeCat.fixtureGenerado){updateCat(activeCId,c=>({...c,parejas:[...c.parejas,pair]}));await guardarPareja(pair);}
    else{
      const c=activeCat;
      const sizes=c.grupos.map(g=>({g,cnt:c.parejas.filter(p=>p.grupoId===g.id).length}));
      const available=sizes.filter(x=>x.cnt<4).sort((a,b)=>a.cnt-b.cnt);
      let tg,newGrupos=c.grupos;
      if(available.length>0)tg=available[0].g;else{tg={id:uid(),nombre:`ZONA ${LETTERS[c.grupos.length]}`};newGrupos=[...c.grupos,tg];}
      const pw={...pair,grupoId:tg.id};const existing=c.parejas.filter(p=>p.grupoId===tg.id);const baseCode=c.partidos.length+1;
      const newRaw=existing.map((ep,i)=>({id:uid(),type:"grupo",grupoId:tg.id,p1id:pw.id,p2id:ep.id,code:`Z${baseCode+i}`,done:false,winner:null,s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:""}));
      const otherMatches=getAllOtherMatches(activeCId);const pairMap=Object.fromEntries([...c.parejas,pw].map(p=>[p.id,p]));
      const sched=scheduleMatches(newRaw,[...c.partidos,...otherMatches],pairMap);const newPartidos=[...c.partidos,...sched];
      updateCat(activeCId,()=>({...c,grupos:newGrupos,parejas:[...c.parejas,pw],partidos:newPartidos}));
      await guardarPareja(pw);await guardarCategoria({...c,grupos:newGrupos});await Promise.all(newPartidos.map(p=>guardarPartido(p)));
    }
  }

  async function eliminarPareja(id){
    updateCat(activeCId,c=>({...c,parejas:c.parejas.filter(p=>p.id!==id)}));
    try{await datos.eliminarPareja(id);}
    catch(err){console.error("Error eliminando pareja:",err);alert("Error al eliminar la pareja: "+err.message);}
  }

  async function editarPareja(updated){
    const uc=datos.migratePairRestrictions(updated);
    updateCat(activeCId,c=>({...c,parejas:c.parejas.map(p=>p.id===uc.id?uc:p)}));
    setJugadores(prev=>{const nxt={...prev};[{cedula:uc.j1cedula,nombre:uc.j1nombre||uc.j1},{cedula:uc.j2cedula,nombre:uc.j2nombre||uc.j2}].filter(j=>j.cedula&&nxt[j.cedula]).forEach(j=>{nxt[j.cedula]={...nxt[j.cedula],nombre:j.nombre};});return nxt;});
    setModal(null);await guardarPareja(uc);
  }

  async function togglePago(pairId,field){
    const pair=activeCat.parejas.find(p=>p.id===pairId);if(!pair)return;
    const updated={...pair,[field]:!pair[field]};
    updateCat(activeCId,c=>({...c,parejas:c.parejas.map(p=>p.id===pairId?updated:p)}));await guardarPareja(updated);
  }

  function getAllOtherMatches(catId){
    const t=torneos.find(t=>t.id===activeTId);if(!t)return[];
    return t.categorias.filter(c=>c.id!==catId).flatMap(c=>c.partidos.filter(m=>m.dia&&m.hora&&m.cancha&&m.mins!=null));
  }

  async function generarFixture(){
    if(!activeCat||activeCat.parejas.length<3)return;
    const pairs=activeCat.parejas;const dist=calcZoneDistribution(pairs.length);
    const grupos=[];let li=0;
    for(let i=0;i<dist.zonasDe3;i++)grupos.push({id:uid(),nombre:`ZONA ${LETTERS[li++]}`});
    for(let i=0;i<dist.zonasDe4;i++)grupos.push({id:uid(),nombre:`ZONA ${LETTERS[li++]}`});
    const ap=pairs.map(p=>({...p,grupoId:null}));
    const pairMap=Object.fromEntries(ap.map(p=>[p.id,p]));
    const sorted=[...ap].sort((a,b)=>getAvailableSlots(a).length-getAvailableSlots(b).length);
    const z3=grupos.filter((_,i)=>i<dist.zonasDe3),z4=grupos.filter((_,i)=>i>=dist.zonasDe3);
    const assignToZones=(pl,zones,size)=>{
      const rem=pl.filter(p=>p.grupoId===null);
      for(const zone of zones){if(!rem.length)break;const seed=rem.shift();seed.grupoId=zone.id;
        const ws=rem.filter(p=>p.grupoId===null).map(p=>({p,score:calcCompatibilityScore(seed,p)}));ws.sort((a,b)=>b.score-a.score);
        for(let i=0;i<size-1&&i<ws.length;i++){ws[i].p.grupoId=zone.id;const idx=rem.findIndex(x=>x.id===ws[i].p.id);if(idx!==-1)rem.splice(idx,1);}
      }
    };
    assignToZones(sorted,z3,3);assignToZones(sorted,z4,4);
    const assignedPairs=pairs.map(p=>{const f=ap.find(a=>a.id===p.id);return f?{...p,grupoId:f.grupoId}:p;});
    let code=1;const raw=[];
    grupos.forEach(g=>{
      const gIds=assignedPairs.filter(p=>p.grupoId===g.id).map(p=>p.id);
      if(gIds.length===4){const gid=g.id;
        raw.push({id:uid(),type:"grupo",grupoId:gid,code:`Z${code++}`,p1id:gIds[0],p2id:gIds[1],done:false,winner:null,s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:"",zona4:true,zona4Tipo:"A",zona4GrupoId:gid});
        raw.push({id:uid(),type:"grupo",grupoId:gid,code:`Z${code++}`,p1id:gIds[2],p2id:gIds[3],done:false,winner:null,s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:"",zona4:true,zona4Tipo:"B",zona4GrupoId:gid});
        raw.push({id:uid(),type:"grupo",grupoId:gid,code:`Z${code++}`,p1id:null,p2id:null,done:false,winner:null,s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:"",zona4:true,zona4Tipo:"C",zona4GrupoId:gid});
        raw.push({id:uid(),type:"grupo",grupoId:gid,code:`Z${code++}`,p1id:null,p2id:null,done:false,winner:null,s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:"",zona4:true,zona4Tipo:"D",zona4GrupoId:gid});
      }else{
        roundRobin(gIds).forEach(([p1id,p2id])=>raw.push({id:uid(),type:"grupo",grupoId:g.id,p1id,p2id,code:`Z${code++}`,done:false,winner:null,s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:""}));
      }
    });
    const esAmericano=activeCat.modalidad&&activeCat.modalidad!=="estandar";
    const bloqueados=(activeTorneo?.slotsBoqueados||[]).map(k=>{const[dia,hora,cancha]=k.split("|");const s=SLOT_DEFS.find(x=>x.dia===dia&&x.hora===hora);return s?{dia,hora,cancha,mins:s.mins,p1id:"__bloq__",p2id:"__bloq__"}:null;}).filter(Boolean);
    const om=[...getAllOtherMatches(activeCId),...bloqueados];
    const sched=esAmericano?raw.filter(m=>m.p1id&&m.p2id):scheduleMatches(raw.filter(m=>m.p1id&&m.p2id),om,pairMap);
    const partidos=[...sched,...raw.filter(m=>!m.p1id||!m.p2id)];
    const updatedCat={...activeCat,parejas:assignedPairs,grupos,partidos,fixtureGenerado:true,knockoutGenerated:false,knockoutRounds:[]};
    updateCat(activeCId,()=>updatedCat);
    await guardarCategoria({...updatedCat,id:activeCId});
    await Promise.all(assignedPairs.map(p=>guardarPareja(p)));
    await Promise.all(partidos.map(m=>guardarPartido(m)));
  }

  // Helper unificado: todos los partidos que ocupan slots, EXCLUYENDO la llave
  // de la categoría que se está reprogramando, e INCLUYENDO los slots bloqueados.
  function getSlotsOcupados(excludeCatId){
    const t=torneos.find(t=>t.id===activeTId);
    const matches=t?.categorias?.flatMap(c=>[
      ...(c.partidos||[]),
      ...(c.id===excludeCatId?[]:(c.knockoutRounds?.flat()||[]))
    ])||[];
    const bloqueados=(t?.slotsBoqueados||[]).map(k=>{
      const[dia,hora,cancha]=k.split("|");const s=SLOT_DEFS.find(x=>x.dia===dia&&x.hora===hora);
      return s?{dia,hora,cancha,mins:s.mins,p1id:"__bloq__",p2id:"__bloq__"}:null;
    }).filter(Boolean);
    return [...matches,...bloqueados];
  }

  async function generarLlave(){
    if(!activeCat||!activeCat.fixtureGenerado)return;
    const result=calcClassified(activeCat,true);
    if(!result.classified?.length){alert("No hay suficientes datos para generar la llave");return;}
    const{classified,bracketSize}=result;
    const newRounds=buildDynamicBracket(classified,bracketSize);
    const allExisting=getSlotsOcupados(activeCId);
    const esAmericanoLlave=activeCat.modalidad&&activeCat.modalidad!=="estandar";
    const scheduled=esAmericanoLlave?newRounds:scheduleKnockoutMatches(newRounds,allExisting,activeCat.parejas);
    updateCat(activeCId,c=>({...c,knockoutRounds:scheduled,knockoutGenerated:true}));
    try{
      await datos.guardarLlave(activeCId,scheduled,true);
    }catch(err){
      console.error("Error guardando llave:",err);
      alert("Error al guardar la llave: "+err.message);
    }
  }

  async function guardarResultado(matchId,result){
    const cat=torneos.find(t=>t.id===activeTId)?.categorias?.find(c=>c.id===activeCId);if(!cat)return;
    const m=cat.partidos.find(p=>p.id===matchId);if(!m)return;
    const winner=result.done?calcMatchResult({...m,...result},false,cat?.modalidad==="americano_zonas"):null;
    let updatedC=null,updatedD=null;
    if(m.zona4&&(m.zona4Tipo==="A"||m.zona4Tipo==="B")&&result.done){
      const lo=winner===m.p1id?m.p2id:m.p1id;
      const mC=cat.partidos.find(p=>p.zona4&&p.zona4GrupoId===m.zona4GrupoId&&p.zona4Tipo==="C");
      const mD=cat.partidos.find(p=>p.zona4&&p.zona4GrupoId===m.zona4GrupoId&&p.zona4Tipo==="D");
      if(m.zona4Tipo==="A"){if(mC)updatedC={...mC,p1id:winner};if(mD)updatedD={...mD,p1id:lo};}
      else{if(mC)updatedC={...mC,p2id:winner};if(mD)updatedD={...mD,p2id:lo};}
    }
    // Pre-calcular partidos actualizados una sola vez: sirve para el update
    // optimista, para el rollback (usando cat.partidos original) y para
    // recalcularLlaveProvisoria, evitando recalcularlos dos veces.
    const newPartidos=cat.partidos.map(p=>{
      if(p.id===matchId)return{...p,...result,winner};
      if(updatedC&&p.id===updatedC.id)return updatedC;
      if(updatedD&&p.id===updatedD.id)return updatedD;
      return p;
    });
    // Actualización optimista: la UI responde de inmediato
    updateCat(activeCId,c=>({...c,partidos:newPartidos}));
    setModal(null);
    // Persistir en Firestore (atómico para el partido + C/D de zona4)
    try{
      await datos.guardarResultadoZona(matchId,{...result,winner},[updatedC,updatedD].filter(Boolean));
    }catch(err){
      console.error("Error guardando resultado:",err);
      // Revertir el optimismo: el estado local vuelve a lo que tenía Firestore
      updateCat(activeCId,c=>({...c,partidos:cat.partidos}));
      alert("Error al guardar el resultado: "+err.message);
      return;
    }
    // Recalcular llave provisional — fallo no-fatal: el resultado ya está
    // guardado en Firestore; la llave se actualizará al próximo 🔄.
    if(cat.knockoutGenerated){
      try{
        await recalcularLlaveProvisoria({...cat,partidos:newPartidos});
      }catch(err){
        console.error("Error actualizando llave provisional:",err);
      }
    }
  }

  async function guardarResultadoKnockout(matchId,result){
    const fm=activeCat.knockoutRounds.flat().find(m=>m.id===matchId);if(!fm)return;
    const totalRounds=activeCat.knockoutRounds.length;
    const isBestOf3=totalRounds>0&&fm.round>=totalRounds-2;
    const winner=result.done?calcMatchResult({...fm,...result},isBestOf3&&!(activeCat?.modalidad==="americano_zonas"),activeCat?.modalidad==="americano_zonas"):null;
    const prevWinner=fm.winner;
    let nr=activeCat.knockoutRounds.map(round=>round.map(m=>m.id===matchId?{...m,...result,winner,done:!!result.done}:m));
    if(winner){
      nr.forEach((round,ri)=>{round.forEach(m=>{if(!m.prevIds?.length)return;if(m.prevIds[0]===matchId)nr[ri]=nr[ri].map(nm=>nm.id===m.id?{...nm,p1id:winner}:nm);if(m.prevIds[1]===matchId)nr[ri]=nr[ri].map(nm=>nm.id===m.id?{...nm,p2id:winner}:nm);});});
      const allEx=getSlotsOcupados(activeCId);
      nr=scheduleKnockoutMatches(nr,allEx,activeCat.parejas);
    }else if(prevWinner){
      // Despropagar en cascada: borrar el resultado invalida los cruces siguientes
      const queue=[{mid:matchId,wid:prevWinner}];
      while(queue.length){
        const{mid,wid}=queue.shift();
        nr=nr.map(round=>round.map(m=>{
          if(!m.prevIds?.length)return m;
          const hit1=m.prevIds[0]===mid&&m.p1id===wid;
          const hit2=m.prevIds[1]===mid&&m.p2id===wid;
          if(!hit1&&!hit2)return m;
          const nm={...m,...(hit1?{p1id:null}:{}),...(hit2?{p2id:null}:{})};
          if(m.done&&!m.auto){
            if(m.winner)queue.push({mid:m.id,wid:m.winner});
            return{...nm,done:false,winner:null,s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:"",s3p1:"",s3p2:""};
          }
          return nm;
        }));
      }
    }
    updateCat(activeCId,c=>({...c,knockoutRounds:nr}));setModal(null);await guardarKnockout(nr);
  }

  async function otorgarPuntos(){
    if(!activeCat||!activeTorneo)return;
    const stages=calcPairStages(activeCat);
    // Calcular fuera del setter de React: garantiza que los datos estén listos
    // antes del batch.commit (el setter puede ser diferido por React).
    const nxt={...jugadores};
    const cedulasModificadas=new Set();
    // Derivar género y categoría automáticamente del nombre de la categoría
    const catNombreLow=activeCat.nombre.toLowerCase();
    const derivedGenero=catNombreLow.includes("damas")?"F":catNombreLow.includes("caballeros")?"M":null;
    const catLabelMatch=activeCat.nombre.match(/^(\w+)/);
    const derivedCat=catLabelMatch?CAT_NUM[catLabelMatch[1].toLowerCase()]:null;
    activeCat.parejas.forEach(pair=>{
      const stage=stages[pair.id]||"zona";const stgMap=activeCat.modalidad==="americano_zonas"?AMERICANO_STAGE_PTS:STAGE_PTS;const pts=stgMap[stage]||(activeCat.modalidad==="americano_zonas"?5:0);
      [pair.j1cedula,pair.j2cedula].forEach(cedula=>{
        if(!cedula)return;
        const nombre=cedula===pair.j1cedula?pair.j1nombre||pair.j1:pair.j2nombre||pair.j2;
        if(!nxt[cedula])nxt[cedula]={cedula,nombre,totalPts:0,historial:[]};
        // Busca entrada previa: mismo torneo/categoría, O misma edición FIP en año anterior
        const prevEntry=nxt[cedula].historial.find(h=>
          (h.torneoId===activeTId&&h.catId===activeCId)||
          (activeTorneo.edicion&&h.torneoEdicion===activeTorneo.edicion&&h.catNombre===activeCat.nombre&&h.torneoId!==activeTId)
        );
        const nuevaEntry={torneoId:activeTId,catId:activeCId,torneoNombre:activeTorneo.nombre,torneoEdicion:activeTorneo.edicion||"",catNombre:activeCat.nombre,stage,pts,fecha:prevEntry?.fecha||new Date().toLocaleDateString("es-PY")};
        if(prevEntry){
          const delta=pts-(prevEntry.pts||0);
          nxt[cedula]={...nxt[cedula],nombre:nombre||nxt[cedula].nombre,totalPts:nxt[cedula].totalPts+delta,
            historial:nxt[cedula].historial.map(h=>h===prevEntry?nuevaEntry:h)};
        }else{
          nxt[cedula]={...nxt[cedula],nombre:nombre||nxt[cedula].nombre,totalPts:nxt[cedula].totalPts+pts,
            historial:[...nxt[cedula].historial,nuevaEntry]};
        }
        cedulasModificadas.add(cedula);
        if(derivedGenero&&!nxt[cedula].genero)nxt[cedula]={...nxt[cedula],genero:derivedGenero};
        if(derivedCat&&!nxt[cedula].categoria)nxt[cedula]={...nxt[cedula],categoria:derivedCat};
      });
    });
    // Puntos caen: jugadores con historial de esta edición que no compitieron esta vez
    let ptsFallen=0;
    if(activeTorneo.edicion){
      Object.values(nxt).forEach(jug=>{
        if(cedulasModificadas.has(jug.cedula))return;
        const prevIdx=(jug.historial||[]).findIndex(h=>
          h.torneoEdicion===activeTorneo.edicion&&
          h.catNombre===activeCat.nombre&&
          h.torneoId!==activeTId
        );
        if(prevIdx===-1)return;
        const prevPts=jug.historial[prevIdx].pts||0;
        nxt[jug.cedula]={...jug,totalPts:Math.max(0,jug.totalPts-prevPts),
          historial:jug.historial.filter((_,i)=>i!==prevIdx)};
        cedulasModificadas.add(jug.cedula);
        ptsFallen++;
      });
    }
    setJugadores(nxt);
    updateCat(activeCId,c=>({...c,pointsAwarded:true}));
    // Solo persiste las cédulas que este torneo/categoría modificó
    try{
      await datos.guardarPuntos(activeCId,[...cedulasModificadas].map(c=>[c,nxt[c]]));
      alert(ptsFallen>0?"✅ Puntos guardados. "+ptsFallen+" jugador(es) perdieron puntos de la edición anterior.":"✅ Puntos guardados correctamente");
    }catch(err){
      console.error("Error guardando puntos:",err);
      alert("❌ Error al guardar los puntos: "+err.message);
    }
  }

  async function agregarJugadorAmericanoIndividual(jugador){
    const list=activeCat.jugadoresAmericano||[];
    if(list.some(j=>j.cedula===jugador.cedula))return;
    const newList=[...list,{...jugador,pago:false}];
    updateCat(activeCId,c=>({...c,jugadoresAmericano:newList}));
    await datos.actualizarCategoria(activeCId,{jugadoresAmericano:newList});
  }

  async function eliminarJugadorAmericanoIndividual(cedula){
    const newList=(activeCat.jugadoresAmericano||[]).filter(j=>j.cedula!==cedula);
    updateCat(activeCId,c=>({...c,jugadoresAmericano:newList}));
    await datos.actualizarCategoria(activeCId,{jugadoresAmericano:newList});
  }

  async function generarFixtureAmericanoIndividual(){
    const jugList=activeCat.jugadoresAmericano||[];
    const N=jugList.length;
    if(N<4||N%4!==0){alert("Se necesita un numero de jugadores multiplo de 4");return;}
    const sorted=[...jugList].sort((a,b)=>(jugadores[b.cedula]?.totalPts||0)-(jugadores[a.cedula]?.totalPts||0));
    const idxs=Array.from({length:N},(_,i)=>i);
    const partidos=[];
    for(let r=0;r<N-1;r++){
      const pairs=[[idxs[0],idxs[N-1]]];
      for(let i=1;i<N/2;i++)pairs.push([idxs[i],idxs[N-1-i]]);
      for(let i=0;i<pairs.length;i+=2){
        const[i1a,i2a]=pairs[i],[i1b,i2b]=pairs[i+1];
        partidos.push({id:uid(),ronda:r,j1a:sorted[i1a].cedula,j2a:sorted[i2a].cedula,j1b:sorted[i1b].cedula,j2b:sorted[i2b].cedula,juegosA:null,juegosB:null,done:false});
      }
      const last=idxs[N-1];for(let i=N-1;i>1;i--)idxs[i]=idxs[i-1];idxs[1]=last;
    }
    updateCat(activeCId,c=>({...c,americanoPartidos:partidos,americanoFixtureGenerado:true}));
    await datos.actualizarCategoria(activeCId,{americanoPartidos:partidos,americanoFixtureGenerado:true});
  }

  async function togglePagoAmericanoIndividual(cedula){
    const newList=(activeCat.jugadoresAmericano||[]).map(j=>j.cedula===cedula?{...j,pago:!j.pago}:j);
    updateCat(activeCId,c=>({...c,jugadoresAmericano:newList}));
    await datos.actualizarCategoria(activeCId,{jugadoresAmericano:newList});
  }

  async function guardarResultadoAmericanoIndividual(matchId,juegosA,juegosB){
    const newPartidos=(activeCat.americanoPartidos||[]).map(m=>m.id===matchId?{...m,juegosA,juegosB,done:true}:m);
    updateCat(activeCId,c=>({...c,americanoPartidos:newPartidos}));
    await datos.actualizarCategoria(activeCId,{americanoPartidos:newPartidos});
  }

  async function otorgarPuntosAmericanoIndividual(){
    if(!activeCat||!activeTorneo)return;
    const standings=calcAmericanoIndStandings(activeCat);
    const POSPTS=[0,30,20,15,15,10,10,5,5];
    const stageByPos=["","campeon","finalista","semifinal","semifinal","cuartos","cuartos","zona","zona"];
    const nxt={...jugadores};const cedulasModificadas=new Set();
    standings.forEach((s,idx)=>{
      const pos=idx+1,pts=POSPTS[pos]||5,stage=stageByPos[pos]||"zona",cedula=s.cedula;
      if(!nxt[cedula])nxt[cedula]={cedula,nombre:s.nombre,totalPts:0,historial:[]};
      const prevEntry=nxt[cedula].historial.find(h=>(h.torneoId===activeTId&&h.catId===activeCId)||(activeTorneo.edicion&&h.torneoEdicion===activeTorneo.edicion&&h.catNombre===activeCat.nombre&&h.torneoId!==activeTId));
      const nuevaEntry={torneoId:activeTId,torneoNombre:activeTorneo.nombre,torneoEdicion:activeTorneo.edicion,catId:activeCId,catNombre:activeCat.nombre,stage,pts,fecha:activeTorneo.fecha||""};
      if(prevEntry){const diff=pts-(prevEntry.pts||0);nxt[cedula]={...nxt[cedula],totalPts:nxt[cedula].totalPts+diff,historial:nxt[cedula].historial.map(h=>h===prevEntry?nuevaEntry:h)};}
      else{nxt[cedula]={...nxt[cedula],totalPts:nxt[cedula].totalPts+pts,historial:[...nxt[cedula].historial,nuevaEntry]};}
      cedulasModificadas.add(cedula);
    });
    let ptsFallen=0;
    if(activeTorneo.edicion){
      Object.values(nxt).forEach(jug=>{
        if(cedulasModificadas.has(jug.cedula))return;
        const prevIdx=(jug.historial||[]).findIndex(h=>h.torneoEdicion===activeTorneo.edicion&&h.catNombre===activeCat.nombre&&h.torneoId!==activeTId);
        if(prevIdx===-1)return;
        const prevPts=jug.historial[prevIdx].pts||0;
        nxt[jug.cedula]={...jug,totalPts:Math.max(0,jug.totalPts-prevPts),historial:jug.historial.filter((_,i)=>i!==prevIdx)};
        cedulasModificadas.add(jug.cedula);ptsFallen++;
      });
    }
    setJugadores(nxt);updateCat(activeCId,c=>({...c,pointsAwarded:true}));
    try{await datos.guardarPuntos(activeCId,[...cedulasModificadas].map(c=>[c,nxt[c]]));alert(ptsFallen>0?"Puntos guardados. "+ptsFallen+" jugador(es) perdieron pts de edicion anterior.":"Puntos guardados correctamente");}
    catch(err){console.error(err);alert("Error al guardar puntos: "+err.message);}
  }

  async function generarFixtureAmericanoPareja(){
    const pairs=activeCat.parejas;const N=pairs.length;if(N<2)return;
    const sorted=[...pairs].sort((a,b)=>{
      const pA=(jugadores[a.j1cedula]?.totalPts||0)+(jugadores[a.j2cedula]?.totalPts||0);
      const pB=(jugadores[b.j1cedula]?.totalPts||0)+(jugadores[b.j2cedula]?.totalPts||0);
      return pB-pA;
    });
    const M=N%2===0?N:N+1;
    const ids=sorted.map(p=>p.id);if(M>N)ids.push("__bye__");
    const idxs=Array.from({length:M},(_,i)=>i);
    const partidos=[];
    for(let r=0;r<M-1;r++){
      for(let i=0;i<M/2;i++){
        const i1=idxs[i],i2=idxs[M-1-i];
        if(ids[i1]!=="__bye__"&&ids[i2]!=="__bye__")
          partidos.push({id:uid(),ronda:r,p1id:ids[i1],p2id:ids[i2],juegosA:null,juegosB:null,done:false});
      }
      const last=idxs[M-1];for(let i=M-1;i>1;i--)idxs[i]=idxs[i-1];idxs[1]=last;
    }
    updateCat(activeCId,c=>({...c,americanoPartidos:partidos,americanoFixtureGenerado:true}));
    await datos.actualizarCategoria(activeCId,{americanoPartidos:partidos,americanoFixtureGenerado:true});
  }

  async function otorgarPuntosAmericanoPareja(){
    if(!activeCat||!activeTorneo)return;
    const standings=calcAmericanoParejasStandings(activeCat);
    const POSPTS=[0,30,20,15,15,10,10,5,5];
    const stageByPos=["","campeon","finalista","semifinal","semifinal","cuartos","cuartos","zona","zona"];
    const nxt={...jugadores};const cedulasModificadas=new Set();
    standings.forEach((s,idx)=>{
      const pos=idx+1,pts=POSPTS[pos]||5,stage=stageByPos[pos]||"zona";
      const pair=activeCat.parejas.find(p=>p.id===s.id);if(!pair)return;
      [pair.j1cedula,pair.j2cedula].forEach(cedula=>{
        if(!cedula)return;
        const nombre=cedula===pair.j1cedula?(pair.j1nombre||pair.j1):(pair.j2nombre||pair.j2);
        if(!nxt[cedula])nxt[cedula]={cedula,nombre,totalPts:0,historial:[]};
        const prevEntry=nxt[cedula].historial.find(h=>(h.torneoId===activeTId&&h.catId===activeCId)||(activeTorneo.edicion&&h.torneoEdicion===activeTorneo.edicion&&h.catNombre===activeCat.nombre&&h.torneoId!==activeTId));
        const nuevaEntry={torneoId:activeTId,torneoNombre:activeTorneo.nombre,torneoEdicion:activeTorneo.edicion,catId:activeCId,catNombre:activeCat.nombre,stage,pts,fecha:activeTorneo.fecha||""};
        if(prevEntry){const diff=pts-(prevEntry.pts||0);nxt[cedula]={...nxt[cedula],totalPts:nxt[cedula].totalPts+diff,historial:nxt[cedula].historial.map(h=>h===prevEntry?nuevaEntry:h)};}
        else{nxt[cedula]={...nxt[cedula],totalPts:nxt[cedula].totalPts+pts,historial:[...nxt[cedula].historial,nuevaEntry]};}
        cedulasModificadas.add(cedula);
      });
    });
    let ptsFallen=0;
    if(activeTorneo.edicion){
      Object.values(nxt).forEach(jug=>{
        if(cedulasModificadas.has(jug.cedula))return;
        const prevIdx=(jug.historial||[]).findIndex(h=>h.torneoEdicion===activeTorneo.edicion&&h.catNombre===activeCat.nombre&&h.torneoId!==activeTId);
        if(prevIdx===-1)return;
        const prevPts=jug.historial[prevIdx].pts||0;
        nxt[jug.cedula]={...jug,totalPts:Math.max(0,jug.totalPts-prevPts),historial:jug.historial.filter((_,i)=>i!==prevIdx)};
        cedulasModificadas.add(jug.cedula);ptsFallen++;
      });
    }
    setJugadores(nxt);updateCat(activeCId,c=>({...c,pointsAwarded:true}));
    try{await datos.guardarPuntos(activeCId,[...cedulasModificadas].map(c=>[c,nxt[c]]));alert(ptsFallen>0?"Puntos guardados. "+ptsFallen+" jugador(es) perdieron pts de edicion anterior.":"Puntos guardados correctamente");}
    catch(err){console.error(err);alert("Error al guardar puntos: "+err.message);}
  }

  async function actualizarCategoriaJugador(cedula,categoria){
    try{
      const updated={...jugadores[cedula],categoria};
      setJugadores(prev=>({...prev,[cedula]:updated}));
      await datos.actualizarJugador(cedula,{categoria:categoria||null});
    }catch(err){alert("Error al guardar categoria: "+err.message);}
  }

  async function actualizarGeneroJugador(cedula,genero){
    try{
      const updated={...jugadores[cedula],genero:genero||null};
      setJugadores(prev=>({...prev,[cedula]:updated}));
      await datos.actualizarJugador(cedula,{genero:genero||null});
    }catch(err){alert("Error al guardar género: "+err.message);}
  }

  async function toggleBloqueoSlot(slotKey){
    const current=activeTorneo?.slotsBoqueados||[];
    const updated=current.includes(slotKey)?current.filter(s=>s!==slotKey):[...current,slotKey];
    setTorneos(prev=>prev.map(t=>t.id===activeTId?{...t,slotsBoqueados:updated}:t));
    await datos.actualizarTorneo(activeTId,{slotsBoqueados:updated});
  }

  async function editarParejaCruce(matchId,{p1id:newP1id,p2id:newP2id}){
    let nk=activeCat.knockoutRounds.map(r=>r.map(m=>({...m})));
    const target=nk.flat().find(m=>m.id===matchId);
    if(!target)return;
    const findPair=(pid)=>{for(const round of nk){for(const m of round){if(m.p1id===pid)return{m,pos:'p1'};if(m.p2id===pid)return{m,pos:'p2'};}}return null;};
    if(newP1id!==target.p1id){
      const oldP1id=target.p1id,oldP1label=target.p1label;
      const loc=findPair(newP1id);
      const newLabel=loc?(loc.pos==='p1'?loc.m.p1label:loc.m.p2label):target.p1label;
      target.p1id=newP1id;target.p1label=newLabel;
      if(loc&&oldP1id){if(loc.pos==='p1'){loc.m.p1id=oldP1id;loc.m.p1label=oldP1label;}else{loc.m.p2id=oldP1id;loc.m.p2label=oldP1label;}}
    }
    if(newP2id!==target.p2id){
      const oldP2id=target.p2id,oldP2label=target.p2label;
      const loc=findPair(newP2id);
      const newLabel=loc?(loc.pos==='p1'?loc.m.p1label:loc.m.p2label):target.p2label;
      target.p2id=newP2id;target.p2label=newLabel;
      if(loc&&oldP2id){if(loc.pos==='p1'){loc.m.p1id=oldP2id;loc.m.p1label=oldP2label;}else{loc.m.p2id=oldP2id;loc.m.p2label=oldP2label;}}
    }
    updateCat(activeCId,c=>({...c,knockoutRounds:nk}));
    try{
      await datos.guardarLlave(activeCId,nk);
    }catch(err){
      console.error("Error guardando cruce:",err);
      alert("Error al guardar: "+err.message);
    }
    setModal(null);
  }

  async function crearJugadorManual(cedula,nombre){
    const nuevo={cedula,nombre,totalPts:0,historial:[]};
    setJugadores(prev=>({...prev,[cedula]:nuevo}));
    try{await datos.guardarJugador(cedula,nuevo);}
    catch(err){alert("Error al crear jugador: "+err.message);}
  }

  async function eliminarJugador(cedula){try{await datos.eliminarJugador(cedula);setJugadores(prev=>{const n={...prev};delete n[cedula];return n;});}catch(err){alert("Error: "+err.message);}}
  async function eliminarEntradaHistorial(cedula,idx){
    try{
      const jug=jugadores[cedula];
      if(!jug){alert("Error: jugador no encontrado ("+cedula+")");return;}
      const hist=jug.historial||[];
      if(idx<0||idx>=hist.length){alert("Error: entrada fuera de rango");return;}
      const entry=hist[idx];
      const updated={...jug,
        totalPts:Math.max(0,jug.totalPts-(entry.pts||0)),
        historial:hist.filter((_,i)=>i!==idx)
      };
      setJugadores(prev=>({...prev,[cedula]:updated}));
      await datos.guardarJugador(cedula,updated);
    }catch(err){
      console.error("Error eliminando entrada historial:",err);
      alert("Error al eliminar: "+err.message);
    }
  }

  async function ajustarPuntosJugador(cedula,delta,descripcion){
    try{
      const jug=jugadores[cedula];
      if(!jug){alert("Error: jugador no encontrado ("+cedula+")");return;}
      const nuevaEntry={
        torneoId:null,catId:null,
        torneoNombre:descripcion||"Ajuste manual",
        torneoEdicion:"",catNombre:"—",stage:"zona",
        pts:delta,fecha:new Date().toLocaleDateString("es-PY"),manual:true
      };
      const updated={...jug,
        totalPts:Math.max(0,jug.totalPts+delta),
        historial:[...(jug.historial||[]),nuevaEntry]
      };
      setJugadores(prev=>({...prev,[cedula]:updated}));
      await datos.guardarJugador(cedula,updated);
    }catch(err){
      console.error("Error ajustando puntos:",err);
      alert("Error al ajustar puntos: "+err.message);
    }
  }

  async function eliminarTorneo(tid){
    // Calcular jugadores afectados ANTES de actualizar el estado
    const jugAfectados={};
    Object.values(jugadores).forEach(jug=>{
      const entries=(jug.historial||[]).filter(h=>h.torneoId===tid);
      if(!entries.length)return;
      const ptsBajar=entries.reduce((s,h)=>s+(h.pts||0),0);
      jugAfectados[jug.cedula]={...jug,
        totalPts:Math.max(0,jug.totalPts-ptsBajar),
        historial:jug.historial.filter(h=>h.torneoId!==tid)
      };
    });
    // Actualización optimista
    if(Object.keys(jugAfectados).length>0)setJugadores(prev=>({...prev,...jugAfectados}));
    setTorneos(p=>p.filter(x=>x.id!==tid));
    // Batch atómico: borra el torneo + actualiza todos los jugadores afectados
    try{
      await datos.eliminarTorneoYAjustarPuntos(tid,Object.values(jugAfectados));
      const n=Object.keys(jugAfectados).length;
      if(n>0)alert("Torneo eliminado. Puntos ajustados para "+n+" jugador(es).");
    }catch(err){
      console.error("Error eliminando torneo:",err);
      alert("Error al eliminar: "+err.message);
    }
  }

  if(loading)return(<><style>{CSS}</style><div className="app"><header className="hdr"><div className="logo">PADEL<em>BOX</em></div></header><div className="main" style={{textAlign:"center",paddingTop:80}}><div className="empty-ico" style={{fontSize:40}}>⏳</div><p style={{color:"var(--muted)"}}>Cargando torneos...</p></div></div></>);
  if(error)return(<><style>{CSS}</style><div className="app"><header className="hdr"><div className="logo">PADEL<em>BOX</em></div></header><div className="main" style={{textAlign:"center",paddingTop:80}}><div className="empty-ico" style={{fontSize:40}}>⚠️</div><p style={{color:"var(--danger)"}}>Error: {error}</p><button className="btn btn-primary" style={{marginTop:20}} onClick={()=>window.location.reload()}>Reintentar</button></div></div></>);

  if(!isAdmin&&!isPlayer){
    if(publicRanking)return(<><style>{CSS}</style><div className="app">
      <header className="hdr">
        <button className="btn btn-ghost btn-sm" onClick={()=>setPublicRanking(false)}>← Volver</button>
        <div className="logo">PADEL<em>BOX</em></div>
      </header>
      <div className="main">
        <JugadoresView jugadores={jugadores} torneos={torneos} onDeleteJugador={()=>{}} onUpdateCategoria={()=>{}} onUpdateGenero={()=>{}} onCreateJugador={()=>{}} isAdmin={false}/>
      </div>
    </div></>);
    return(<><style>{CSS}</style><div className="app">
    <header className="hdr"><div className="logo">PADEL<em>BOX</em></div>
      <div style={{marginLeft:"auto",display:"flex",gap:8}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowPlayerLogin(true)}>👤 Jugador</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowPinModal(true)}>🔑 Admin</button>
      </div>
    </header>
    <div className="main" style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div className="hero-title" style={{marginBottom:16}}>PADEL<em style={{fontStyle:"normal",color:"var(--accent)"}}>BOX</em></div>
        <p style={{color:"var(--muted)",marginBottom:24}}>Seleccioná tu forma de acceso</p>
        <div className="row g12 wrap" style={{justifyContent:"center"}}>
          <button className="btn btn-primary" onClick={()=>setShowPlayerLogin(true)}>👤 Ingresar como Jugador</button>
          <button className="btn btn-ghost" onClick={()=>setShowPinModal(true)}>🔑 Ingresar como Admin</button>
        </div>
        <button className="btn btn-cyan" style={{marginTop:16}} onClick={()=>setPublicRanking(true)}>🏅 Ver Ranking del Club</button>
      </div>
    </div>
    {showPlayerLogin&&<PlayerLoginModal error={playerLoginError} onClearError={()=>setPlayerLoginError("")} onSubmit={handlePlayerLogin} onClose={()=>{setShowPlayerLogin(false);setPlayerLoginError("");}}/>}
    {showPinModal&&<PinModal onSuccess={()=>setShowPinModal(false)} onClose={()=>setShowPinModal(false)}/>}
  </div></>);
  }

  if(!activeTId)return(<><style>{CSS}</style><div className="app">
    <header className="hdr"><div className="logo">PADEL<em>BOX</em></div>
      <div className="nav-tabs" style={{marginLeft:"auto"}}>
        <button className={`nav-tab${appView==="torneos"?" on":""}`} onClick={()=>setAppView("torneos")}>🎾 Torneos</button>
        <button className={`nav-tab jug${appView==="jugadores"?" on":""}`} onClick={()=>setAppView("jugadores")}>🏅 Jugadores</button>
        <button className={`nav-tab${appView==="reglamento"?" on":""}`} onClick={()=>setAppView("reglamento")}>📖 Reglamento</button>
      </div>
      {isAdmin?<button className="btn btn-ghost btn-xs" onClick={handleLogoutAdmin} style={{marginLeft:8}}>🔓 Admin</button>:<button className="btn btn-ghost btn-xs" onClick={handleLogoutPlayer} style={{marginLeft:8}}>👤 Salir</button>}
    </header>
    <div className="main">
      {appView==="jugadores"?<JugadoresView jugadores={jugadores} torneos={torneos} onDeleteJugador={eliminarJugador} onUpdateCategoria={actualizarCategoriaJugador} onUpdateGenero={actualizarGeneroJugador} onCreateJugador={crearJugadorManual} isAdmin={isAdmin} onDeleteHistorialEntry={eliminarEntradaHistorial} onAjustarPuntos={ajustarPuntosJugador}/>:appView==="reglamento"?<ReglamentoView/>:(
        <>
          <div className="hero">
            {isAdmin?(<>
              <div className="hero-title">GESTIÓN DE<br/><span>TORNEOS</span></div>
              <div className="hero-sub">Creá, organizá y gestioná todos tus torneos de pádel</div>
              <button className="btn btn-primary" onClick={()=>setModal({type:"newT"})}>+ Nuevo Torneo</button>
            </>):(<>
              <div className="hero-title" style={{fontSize:"clamp(20px,5vw,30px)"}}>TORNEOS<br/><span>DISPONIBLES</span></div>
              <div className="hero-sub">Seleccioná tu torneo para ver el fixture y los resultados</div>
            </>)}
          </div>
          {torneos.length===0?<div className="empty"><div className="empty-ico">🎾</div><p>No hay torneos creados aún</p></div>:(
            <div className="grid2">{torneos.map(t=>(
              <button key={t.id} className="t-card" onClick={()=>{setActiveTId(t.id);
                const autocat=(!isAdmin&&isPlayer&&playerCedula)?t.categorias?.find(c=>c.parejas?.some(p=>p.j1cedula===playerCedula||p.j2cedula===playerCedula)):null;
                setActiveCId(autocat?.id||null);
                setSubview(isAdmin?"inscripcion":["americano_individual","americano_pareja"].includes(autocat?.modalidad)?"americano":"mitorneo");}}>
                <div className="t-card-name">{t.nombre}</div>
                <div className="t-card-meta">{t.fecha||"Sin fecha"}{t.edicion&&` · ${t.edicion}`}</div>
                <div className="row wrap g8" style={{marginBottom:6}}>
                  {t.catTipo==="fijo"&&t.catNum&&<span className="badge by">{t.catNum}° Categoría</span>}
                  {t.catTipo==="suma"&&t.catNum&&<span className="badge bb">Suma {t.catNum}</span>}
                </div>
                <div className="row wrap g8">{t.categorias.map(c=><span key={c.id} className="badge bb">{c.nombre}</span>)}{!t.categorias.length&&<span className="badge bx">Sin categorias</span>}</div>
                {isAdmin&&<div className="t-card-del" onClick={e=>{e.stopPropagation();if(window.confirm("¿Eliminar este torneo?"))eliminarTorneo(t.id);}}><button className="btn btn-danger btn-xs">Eliminar</button></div>}
              </button>
            ))}</div>
          )}
        </>
      )}
    </div>
    {modal?.type==="newT"&&<div className="overlay" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Nuevo Torneo</div>
      <div className="col mb12"><label className="lbl">Nombre completo</label><input className="inp" autoFocus placeholder="ej: Torneo Aniversario Box 2026" value={tForm.nombre} onChange={e=>setTForm(p=>({...p,nombre:e.target.value}))}/></div>
      <div className="col mb12"><label className="lbl">Edición (vincula torneos repetidos para defensa de puntos)</label>
        <select className="inp" value={tForm.edicionSel||""} onChange={e=>{const v=e.target.value;setTForm(p=>({...p,edicionSel:v,edicion:v==="__nueva__"?"":v}));}}>
          <option value="">Sin edición (torneo único)</option>
          {[...new Set(torneos.map(t=>t.edicion).filter(Boolean))].map(ed=><option key={ed} value={ed}>{ed}</option>)}
          <option value="__nueva__">➕ Nueva edición…</option>
        </select>
        {tForm.edicionSel==="__nueva__"&&<input className="inp mt8" autoFocus placeholder="Nombre de la nueva edición, ej: Torneo Aniversario" value={tForm.edicion} onChange={e=>setTForm(p=>({...p,edicion:e.target.value}))}/>}
      </div>
      <div className="col mb12"><label className="lbl">Fecha de inicio</label><input className="inp" type="date" value={tForm.fecha} onChange={e=>setTForm(p=>({...p,fecha:e.target.value}))}/></div>
      <div className="col mb12"><label className="lbl">Hora de inicio</label><input className="inp" type="time" value={tForm.horaInicio||""} onChange={e=>setTForm(p=>({...p,horaInicio:e.target.value}))}/></div>
      <div className="col mb12"><label className="lbl">Tipo de categoria</label>
        <select className="inp" value={tForm.catTipo} onChange={e=>setTForm(p=>({...p,catTipo:e.target.value,catNum:""}))}>
          <option value="libre">Libre (sin restricción)</option>
          <option value="fijo">Categoría fija</option>
          <option value="suma">Suma</option>
        </select>
      </div>
      {tForm.catTipo!=="libre"&&<div className="col mb16"><label className="lbl">{tForm.catTipo==="fijo"?"Categoría (1-8)":"Número de suma"}</label>
        <select className="inp" value={tForm.catNum} onChange={e=>setTForm(p=>({...p,catNum:e.target.value}))}>
          <option value="">Seleccioná...</option>
          {[8,7,6,5,4,3,2,1].map(num=><option key={num} value={num}>{tForm.catTipo==="fijo"?`${num}° Categoría`:`Suma ${num}`}</option>)}
        </select>
      </div>}
      <div className="row g8"><button className="btn btn-primary f1" onClick={crearTorneo}>Crear</button><button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancelar</button></div>
    </div></div>}
    {showPinModal&&<PinModal onSuccess={()=>setShowPinModal(false)} onClose={()=>setShowPinModal(false)}/>}
  </div></>);

  const isRoundRobin=["americano_individual","americano_pareja"].includes(activeCat?.modalidad);
  const tabsVisibles=TABS.filter(tab=>{if(tab.adminOnly)return isAdmin;if(tab.playerOnly)return !isAdmin&&isPlayer;if(tab.showRR)return isRoundRobin;if(tab.hideRR)return !isRoundRobin;return true;});
  return(<><style>{CSS}</style><div className="app">
    <header className="hdr">
      <button className="btn btn-ghost btn-sm" onClick={()=>setActiveTId(null)}>← Torneos</button>
      <div className="hdr-name-wrap" style={{flexDirection:"column",alignItems:"flex-start",gap:2}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {editingName?(
            <><input className="edit-inline" autoFocus value={editingNameVal} onChange={e=>setEditingNameVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")guardarNombreTorneo();if(e.key==="Escape")setEditingName(false);}}/><button className="icon-btn" onClick={guardarNombreTorneo}>✓</button><button className="icon-btn" onClick={()=>setEditingName(false)}>✕</button></>
          ):(
            <><div className="hdr-name">{activeTorneo?.nombre}</div>{isAdmin&&!editingEdicion&&<button className="icon-btn" onClick={()=>{setEditingNameVal(activeTorneo?.nombre||"");setEditingName(true);}}>✏️</button>}</>
          )}
        </div>
        {!editingName&&<div style={{display:"flex",alignItems:"center",gap:4}}>
          {editingEdicion?(
            <><input style={{background:"transparent",border:"1px solid var(--border)",borderRadius:4,color:"var(--text)",fontSize:11,padding:"2px 6px",outline:"none",width:160}} autoFocus value={editingEdicionVal} list="editions-hdr-dl" onChange={e=>setEditingEdicionVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")guardarEdicionTorneo();if(e.key==="Escape")setEditingEdicion(false);}}/><datalist id="editions-hdr-dl">{[...new Set(torneos.filter(t=>t.id!==activeTId).map(t=>t.edicion).filter(Boolean))].map(e=><option key={e} value={e}/>)}</datalist><button className="icon-btn" onClick={guardarEdicionTorneo}>✓</button><button className="icon-btn" onClick={()=>setEditingEdicion(false)}>✕</button></>
          ):(
            <><span style={{fontSize:10,color:"var(--muted)"}}>{activeTorneo?.edicion||<em style={{opacity:.5,fontStyle:"italic"}}>sin edición</em>}</span>{isAdmin&&<button className="icon-btn" style={{fontSize:10}} onClick={()=>{setEditingEdicionVal(activeTorneo?.edicion||"");setEditingEdicion(true);}}>✏️</button>}</>
          )}
        </div>}
      </div>
      <div className="nav-tabs" style={{marginLeft:"auto"}}>{tabsVisibles.map(tab=><button key={tab.id} className={`nav-tab${subview===tab.id?" on":""}`} onClick={()=>setSubview(tab.id)}>{tab.label}</button>)}</div>
      <button className="btn btn-ghost btn-xs" onClick={()=>loadData(true)} disabled={refreshing} style={{marginLeft:4}}>{refreshing?"⏳":"🔄"}</button>
      {isAdmin?<button className="btn btn-ghost btn-xs" onClick={handleLogoutAdmin} style={{marginLeft:4}}>🔓 Admin</button>:<button className="btn btn-ghost btn-xs" onClick={handleLogoutPlayer} style={{marginLeft:4}}>👤 Salir</button>}
    </header>
    <div className="main">
      <div className="cat-tabs">
        {activeTorneo?.categorias?.map(c=><button key={c.id} className={`cat-tab${activeCId===c.id?" on":""}`} onClick={()=>setActiveCId(c.id)}>{c.nombre}</button>)}
        {isAdmin&&<button className="cat-tab add" onClick={()=>setModal({type:"newC"})}>+ Categoría</button>}
      </div>
      {!activeCat?<div className="empty"><div className="empty-ico">📂</div><p>Creá o seleccioná una categoria</p></div>:(
        <>
          {subview==="inscripcion"&&activeCat?.modalidad!=="americano_individual"&&<Inscripcion cat={activeCat} onAdd={agregarPareja} onDelete={eliminarPareja} onEditPair={p=>setModal({type:"editPair",pair:p})} onTogglePago={togglePago} isAdmin={isAdmin} jugadoresGlobal={jugadores}/>}
          {subview==="inscripcion"&&activeCat?.modalidad==="americano_individual"&&<InscripcionAmericanoIndividual cat={activeCat} isAdmin={isAdmin} jugadoresGlobal={jugadores} onAgregar={agregarJugadorAmericanoIndividual} onEliminar={eliminarJugadorAmericanoIndividual} onTogglePago={togglePagoAmericanoIndividual} onGenerarFixture={generarFixtureAmericanoIndividual}/>}
          {subview==="americano"&&activeCat?.modalidad==="americano_individual"&&<AmericanoIndividualView cat={activeCat} isAdmin={isAdmin} jugadoresGlobal={jugadores} onGuardarResultado={guardarResultadoAmericanoIndividual} onOtorgarPuntos={otorgarPuntosAmericanoIndividual} onGenerarFixture={generarFixtureAmericanoIndividual} pointsAwarded={activeCat?.pointsAwarded}/>}
          {subview==="americano"&&activeCat?.modalidad==="americano_pareja"&&<AmericanoParejasView cat={activeCat} isAdmin={isAdmin} onGuardarResultado={guardarResultadoAmericanoIndividual} onGenerarFixture={generarFixtureAmericanoPareja} onOtorgarPuntos={otorgarPuntosAmericanoPareja} pointsAwarded={activeCat?.pointsAwarded}/>}
          {subview==="mitorneo"&&!isAdmin&&<MiTorneo torneo={activeTorneo} playerCedula={playerCedula}/>}
          {subview==="fixture"&&<Fixture cat={activeCat} onGenerate={generarFixture} isAdmin={isAdmin} onEditMatch={m=>isAdmin&&setModal({type:"editMatch",match:m})}/>}
          {subview==="resultados"&&<Resultados cat={activeCat} onOpen={m=>isAdmin&&setModal({type:"res",match:m})} isAdmin={isAdmin} onEditMatch={m=>isAdmin&&setModal({type:"editMatch",match:m})}/>}
          {subview==="posiciones"&&<Posiciones cat={activeCat}/>}
          {subview==="llave"&&<LlaveFinal cat={activeCat} allMatches={allMatches} onGenerarLlave={generarLlave} onOpen={m=>isAdmin&&setModal({type:"koRes",match:m})} onAwardPoints={otorgarPuntos} pointsAwarded={activeCat.pointsAwarded} isAdmin={isAdmin} onEditMatch={m=>isAdmin&&setModal({type:"editMatch",match:m})} onEditKOPair={m=>isAdmin&&setModal({type:"editKOPair",match:m})}/>}
          {subview==="agenda"&&isAdmin&&<AgendaView torneo={activeTorneo} allPartidos={[...allMatches,...(activeTorneo?.categorias?.flatMap(c=>c.knockoutRounds?.flat()||[])||[])]} isAdmin={isAdmin} onEditMatch={m=>setModal({type:"editMatch",match:m})} onToggleBloqueo={toggleBloqueoSlot}/>}
        </>
      )}
    </div>
    {modal?.type==="newC"&&<div className="overlay" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Nueva Categoría</div>
      <div className="col mb12"><label className="lbl">Nombre</label><input className="inp" autoFocus placeholder="ej: Primera, Damas, Mixtos..." value={cForm.nombre} onChange={e=>setCForm(p=>({...p,nombre:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&crearCategoria()}/></div>
      <div className="col mb16"><label className="lbl">Modalidad</label><select className="inp" value={cForm.modalidad} onChange={e=>setCForm(p=>({...p,modalidad:e.target.value}))}><option value="estandar">Estándar (Zonas + Llave)</option><option value="americano_zonas">🎯 Americano (Zonas + Llave, 1 set)</option><option value="americano_individual">🏓 Americano Individual (todos con todos)</option><option value="americano_pareja">🎾 Americano Parejas (todos contra todos, 1 set)</option></select></div>
      <div className="row g8"><button className="btn btn-primary f1" onClick={crearCategoria}>Crear</button><button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancelar</button></div>
    </div></div>}
    {modal?.type==="editPair"&&<EditPairModal pair={modal.pair} onSave={editarPareja} onClose={()=>setModal(null)}/>}
    {modal?.type==="res"&&activeCat&&<ResultModal match={modal.match} cat={activeCat} onSave={guardarResultado} onClose={()=>setModal(null)} isAmericano={activeCat?.modalidad==="americano_zonas"}/>}
    {modal?.type==="koRes"&&activeCat&&(()=>{
      const esAmKO=activeCat?.modalidad==="americano_zonas";
      const totalKO=activeCat.knockoutRounds?.length||0;
      const km=(activeCat.knockoutRounds||[]).flat().find(m=>m.id===modal.match.id);
      const isB3=!esAmKO&&totalKO>0&&!!km&&km.round>=totalKO-2;
      return <ResultModal match={modal.match} cat={activeCat} onSave={guardarResultadoKnockout} onClose={()=>setModal(null)} bestOf3={isB3} isAmericano={esAmKO}/>;
    })()}
    {modal?.type==="editKOPair"&&activeCat&&<EditKOPairModal match={modal.match} cat={activeCat} onSave={editarParejaCruce} onClose={()=>setModal(null)}/>}
    {modal?.type==="editMatch"&&(()=>{
      const matchCat=activeTorneo?.categorias?.find(c=>c.partidos?.some(p=>p.id===modal.match.id)||c.knockoutRounds?.flat()?.some(p=>p.id===modal.match.id))||activeCat;
      if(!matchCat)return null;
      const allCatPartidos=(activeTorneo?.categorias||[]).flatMap(c=>[...(c.partidos||[]),...(c.knockoutRounds?.flat()||[])]);
      return <EditMatchModal match={modal.match} cat={matchCat} allPartidos={allCatPartidos} onSave={editarPartido} onClose={()=>setModal(null)}/>;
    })()}
    {showPinModal&&<PinModal onSuccess={()=>setShowPinModal(false)} onClose={()=>setShowPinModal(false)}/>}
  </div></>);
}
