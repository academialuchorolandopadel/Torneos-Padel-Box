// Capa de datos: el ÚNICO archivo de la app que habla con Firestore.
// App.jsx pide acciones ("guardar pareja", "cargar todo") y no sabe cómo ni
// dónde se guardan. Si mañana cambia la base de datos, o cada club necesita
// sus propios torneos, el cambio se hace acá.
//
// Firebase se inicializa en index.html y deja window.db y window.firestore.
// Se leen DENTRO de cada función (no al importar este archivo) porque este
// módulo puede cargarse antes de que index.html termine de inicializarlo.
import { BLOQUE_TO_SLOTS } from "../logica/constantes.js";
import { calcMatchResult } from "../logica/resultados.js";

const fs = () => window.firestore;
const db = () => window.db;
const ref = (coleccion, id) => fs().doc(db(), coleccion, id);

// Convierte parejas guardadas con el formato viejo de restricciones
// (bloques como "sab_man") al formato actual (slots "SÁBADO|9:00").
export function migratePairRestrictions(p){
  if (!p.restriccionesSlots&&p.restricciones){const ns=new Set();p.restricciones.forEach(b=>{(BLOQUE_TO_SLOTS[b]||[]).forEach(s=>ns.add(s));});return {...p,restriccionesSlots:Array.from(ns),restricciones:undefined};}
  return p;
}

// ===== Lectura =====

// Trae todo lo necesario para la app y lo devuelve ya armado:
// torneos -> categorías -> parejas, partidos y llave en rondas.
export async function cargarTodo(){
  const {collection,getDocs,query,where}=fs();
  const ts=await getDocs(collection(db(),"torneos"));
  const td=ts.docs.map(d=>({id:d.id,...d.data()}));
  const torneos=await Promise.all(td.map(async t=>{
    const cs=await getDocs(query(collection(db(),"categorias"),where("torneoId","==",t.id)));
    const cats=await Promise.all(cs.docs.map(async dc=>{
      const cat={id:dc.id,...dc.data()};
      const ps=await getDocs(query(collection(db(),"parejas"),where("categoriaId","==",cat.id)));
      cat.parejas=ps.docs.map(d=>migratePairRestrictions({id:d.id,...d.data()}));
      const ms=await getDocs(query(collection(db(),"partidos"),where("categoriaId","==",cat.id)));
      cat.partidos=ms.docs.map(d=>{const p={id:d.id,...d.data()};if(p.done&&p.winner==null&&p.p1id&&p.p2id)p.winner=calcMatchResult(p);return p;});
      // La llave se guarda como lista plana; acá se rearma en rondas
      if(cat.knockoutMatchesFlat&&cat.knockoutMatchesFlat.length>0){
        const rounds=[];
        cat.knockoutMatchesFlat.forEach(m=>{
          if(!rounds[m.round])rounds[m.round]=[];
          rounds[m.round][m.slot]=m;
        });
        cat.knockoutRounds=rounds.map(r=>(r||[]).filter(Boolean));
      }else{cat.knockoutRounds=cat.knockoutRounds||[];}
      return cat;
    }));
    return {...t,categorias:cats};
  }));
  const js=await getDocs(collection(db(),"jugadores"));
  const jugadores={};js.docs.forEach(d=>{jugadores[d.id]={cedula:d.id,...d.data()};});
  return {torneos,jugadores};
}

// ===== Torneos =====

export async function crearTorneo(torneo){
  await fs().setDoc(ref("torneos",torneo.id),torneo);
}

export async function actualizarTorneo(torneoId,cambios){
  await fs().updateDoc(ref("torneos",torneoId),cambios);
}

// Atómico: borra el torneo y guarda los jugadores con los puntos ya descontados.
// Ojo: no borra las categorías, parejas ni partidos de ese torneo (quedan en la base).
export async function eliminarTorneoYAjustarPuntos(torneoId,jugadoresActualizados){
  const batch=fs().writeBatch(db());
  batch.delete(ref("torneos",torneoId));
  jugadoresActualizados.forEach(jug=>batch.set(ref("jugadores",jug.cedula),jug));
  await batch.commit();
}

// ===== Categorías =====

// Guarda la categoría sin sus listas grandes (parejas y partidos van en su
// propia colección) y con la llave aplanada.
export async function guardarCategoria(cat,torneoId){
  const{parejas,partidos,knockoutRounds:kr,...rest}=cat;
  await fs().setDoc(ref("categorias",cat.id),{...rest,knockoutMatchesFlat:(kr||[]).flat(),torneoId});
}

export async function actualizarCategoria(catId,cambios){
  await fs().updateDoc(ref("categorias",catId),cambios);
}

// La llave se guarda aplanada dentro del documento de la categoría.
export async function guardarLlave(catId,rondas,marcarGenerada=false){
  const cambios=marcarGenerada?{knockoutMatchesFlat:rondas.flat(),knockoutGenerated:true}:{knockoutMatchesFlat:rondas.flat()};
  await fs().updateDoc(ref("categorias",catId),cambios);
}

// ===== Parejas =====

export async function guardarPareja(pareja,catId){
  // Firestore rechaza campos undefined: se limpian antes de guardar
  const ts={...pareja,categoriaId:catId};delete ts.restricciones;if(ts.j1===undefined)delete ts.j1;if(ts.j2===undefined)delete ts.j2;
  await fs().setDoc(ref("parejas",pareja.id),ts);
}

export async function eliminarPareja(parejaId){
  await fs().deleteDoc(ref("parejas",parejaId));
}

// ===== Partidos de zona =====

export async function guardarPartido(partido,catId){
  await fs().setDoc(ref("partidos",partido.id),{...partido,categoriaId:catId});
}

export async function actualizarPartido(partidoId,cambios){
  await fs().updateDoc(ref("partidos",partidoId),cambios);
}

// Atómico: el resultado del partido y los partidos que dependen de él
// (en zonas de 4, los partidos C y D reciben ganador y perdedor).
export async function guardarResultadoZona(partidoId,cambios,partidosDependientes=[]){
  const batch=fs().writeBatch(db());
  batch.update(ref("partidos",partidoId),cambios);
  partidosDependientes.forEach(p=>batch.update(ref("partidos",p.id),p));
  await batch.commit();
}

// ===== Jugadores y ranking =====

export async function guardarJugador(cedula,jugador){
  await fs().setDoc(ref("jugadores",cedula),jugador);
}

export async function actualizarJugador(cedula,cambios){
  await fs().updateDoc(ref("jugadores",cedula),cambios);
}

export async function eliminarJugador(cedula){
  await fs().deleteDoc(ref("jugadores",cedula));
}

// Atómico: guarda los jugadores cuyos puntos cambiaron y marca la categoría
// como "puntos otorgados". entradas = [[cedula, jugador], ...]
export async function guardarPuntos(catId,entradas){
  const batch=fs().writeBatch(db());
  entradas.forEach(([cedula,jugador])=>batch.set(ref("jugadores",cedula),jugador));
  batch.update(ref("categorias",catId),{pointsAwarded:true});
  await batch.commit();
}
