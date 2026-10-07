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
import { COLECCIONES_COPIA } from "../logica/copia.js";
import { VERSION_ESQUEMA, esIdJugador, nuevoIdJugador, parejaAMemoria, parejaABase, categoriaAMemoria, cambiosCategoriaABase, jugadorAMemoria, jugadorABase, clavesDePareja, clavesDeCambiosCategoria } from "../logica/identidad.js";

const fs = () => window.firestore;
const db = () => window.db;
const ref = (coleccion, id) => fs().doc(db(), coleccion, id);

// Convierte parejas guardadas con el formato viejo de restricciones
// (bloques como "sab_man") al formato actual (slots "SÁBADO|9:00").
export function migratePairRestrictions(p){
  if (!p.restriccionesSlots&&p.restricciones){const ns=new Set();p.restricciones.forEach(b=>{(BLOQUE_TO_SLOTS[b]||[]).forEach(s=>ns.add(s));});return {...p,restriccionesSlots:Array.from(ns),restricciones:undefined};}
  return p;
}

// ===== Identidad de jugadores (ver logica/identidad.js) =====
// La base guarda ids; la app trabaja con "la clave del jugador": la cédula
// real si entró el admin, el id si no. Estos dos mapas los arma cargarTodo()
// cuando entra el admin (leyendo "accesos", que solo él puede listar).
let modoAdmin=false;
const cedulaAId=new Map(), idACedula=new Map();

// id de la base -> clave de memoria
const aMemoria=(id)=>!id?"":(modoAdmin?(idACedula.get(id)||id):id);
// clave de memoria -> id de la base (la cédula tiene que tener id: ver asegurarIds)
const aBase=(clave)=>{
  if(!clave)return "";
  if(esIdJugador(clave))return clave;
  const id=cedulaAId.get(clave);
  if(!id)throw new Error(`La cédula ${clave} no tiene jugador asignado`);
  return id;
};

// Antes de guardar algo con cédulas: a cada cédula nueva le crea su id y su
// documento en "accesos". Primero pregunta a la base, por si otro dispositivo
// ya la creó mientras tanto (así una cédula nunca termina con dos ids).
async function asegurarIds(claves){
  const {getDoc,setDoc}=fs();
  for(const c of new Set(claves.filter(Boolean))){
    if(esIdJugador(c)||cedulaAId.has(c))continue;
    const snap=await getDoc(ref("accesos",c));
    let id=snap.exists()?snap.data().jugadorId:null;
    if(!id){id=nuevoIdJugador();await setDoc(ref("accesos",c),{jugadorId:id});}
    cedulaAId.set(c,id);idACedula.set(id,c);
  }
}

// Login del jugador: consulta UNA cédula. Devuelve su id o null.
export async function buscarJugadorPorCedula(cedula){
  const c=(cedula||"").trim();
  if(!c)return null;
  const snap=await fs().getDoc(ref("accesos",c));
  return snap.exists()?(snap.data().jugadorId||null):null;
}

// ===== Lectura =====

// Trae todo lo necesario para la app y lo devuelve ya armado:
// torneos -> categorías -> parejas, partidos y llave en rondas.
// esAdmin: si es true, lee "accesos" y la app ve las cédulas reales.
// Devuelve también "esquema": si es menor a 2, los datos todavía tienen las
// cédulas a la vista y hay que migrarlos (la app no los muestra hasta entonces).
export async function cargarTodo(esAdmin=false){
  const {collection,getDocs,query,where}=fs();
  // Club primero: dice en qué formato están los datos
  let club={},esquema=1;
  try{
    const ks=await getDocs(collection(db(),"club"));
    ks.docs.forEach(d=>{
      if(d.id==="datos")club={...club,...d.data()};
      else if(d.id==="logo_color")club.logoColor=d.data().dataUrl||"";
      else if(d.id==="logo_blanco")club.logoBlanco=d.data().dataUrl||"";
      else if(d.id==="esquema")esquema=d.data().version||1;
    });
  }catch(err){console.error("No se pudieron leer los datos del club:",err);}
  if(esquema<VERSION_ESQUEMA)return {torneos:[],jugadores:{},calendarioClub:{},club,esquema};
  // Cédulas: solo para el admin. Si no se pueden leer, se corta con error:
  // seguir sin ellas haría que al guardar se creen jugadores duplicados.
  cedulaAId.clear();idACedula.clear();modoAdmin=false;
  if(esAdmin){
    const as=await getDocs(collection(db(),"accesos"));
    as.docs.forEach(d=>{const id=d.data().jugadorId;if(id){cedulaAId.set(d.id,id);idACedula.set(id,d.id);}});
    modoAdmin=true;
  }
  const ts=await getDocs(collection(db(),"torneos"));
  const td=ts.docs.map(d=>({id:d.id,...d.data()}));
  const torneos=await Promise.all(td.map(async t=>{
    const cs=await getDocs(query(collection(db(),"categorias"),where("torneoId","==",t.id)));
    const cats=await Promise.all(cs.docs.map(async dc=>{
      const cat=categoriaAMemoria({id:dc.id,...dc.data()},aMemoria);
      const ps=await getDocs(query(collection(db(),"parejas"),where("categoriaId","==",cat.id)));
      cat.parejas=ps.docs.map(d=>migratePairRestrictions(parejaAMemoria({id:d.id,...d.data()},aMemoria)));
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
  const jugadores={};js.docs.forEach(d=>{const j=jugadorAMemoria(d.id,d.data(),aMemoria);jugadores[j.cedula]=j;});
  // Calendario del club: un documento por fecha, con los rangos libres de cada cancha.
  // Si no se puede leer (por ejemplo, reglas de seguridad sin esta colección),
  // la app carga igual: solo el calendario queda vacío.
  const calendarioClub={};
  try{
    const cs=await getDocs(collection(db(),"calendarioClub"));
    cs.docs.forEach(d=>{calendarioClub[d.id]={fecha:d.id,...d.data()};});
  }catch(err){console.error("No se pudo leer el calendario del club:",err);}
  return {torneos,jugadores,calendarioClub,club,esquema};
}

// ===== Torneos =====

export async function crearTorneo(torneo){
  await fs().setDoc(ref("torneos",torneo.id),torneo);
}

export async function actualizarTorneo(torneoId,cambios){
  await fs().updateDoc(ref("torneos",torneoId),cambios);
}

// Paso 1, atómico: borra el torneo y guarda los jugadores con los puntos ya
// descontados. Si esto falla, no se borró nada.
// Paso 2, limpieza: borra las categorías, parejas y partidos del torneo, en
// tandas (Firestore acepta hasta 500 operaciones por tanda). Si la limpieza
// falla, el torneo ya no existe y lo que quedó no se ve en la app: no se avisa
// como error, solo queda registrado en la consola.
export async function eliminarTorneoYAjustarPuntos(torneoId,jugadoresActualizados,restos={}){
  await asegurarIds(jugadoresActualizados.map(j=>j.cedula));
  const batch=fs().writeBatch(db());
  batch.delete(ref("torneos",torneoId));
  jugadoresActualizados.forEach(jug=>batch.set(ref("jugadores",aBase(jug.cedula)),jugadorABase(jug)));
  await batch.commit();
  const aBorrar=[
    ...(restos.partidos||[]).map(id=>["partidos",id]),
    ...(restos.parejas||[]).map(id=>["parejas",id]),
    ...(restos.categorias||[]).map(id=>["categorias",id]),
  ];
  try{
    for(let i=0;i<aBorrar.length;i+=400){
      const tanda=fs().writeBatch(db());
      aBorrar.slice(i,i+400).forEach(([col,id])=>tanda.delete(ref(col,id)));
      await tanda.commit();
    }
  }catch(err){console.error("Torneo eliminado, pero quedaron datos sin limpiar:",err);}
}

// ===== Categorías =====

// Guarda la categoría sin sus listas grandes (parejas y partidos van en su
// propia colección) y con la llave aplanada.
export async function guardarCategoria(cat,torneoId){
  const{parejas,partidos,knockoutRounds:kr,...rest}=cat;
  await asegurarIds(clavesDeCambiosCategoria(rest));
  await fs().setDoc(ref("categorias",cat.id),{...cambiosCategoriaABase(rest,aBase),knockoutMatchesFlat:(kr||[]).flat(),torneoId});
}

export async function actualizarCategoria(catId,cambios){
  await asegurarIds(clavesDeCambiosCategoria(cambios));
  await fs().updateDoc(ref("categorias",catId),cambiosCategoriaABase(cambios,aBase));
}

// La llave se guarda aplanada dentro del documento de la categoría.
export async function guardarLlave(catId,rondas,marcarGenerada=false){
  const cambios=marcarGenerada?{knockoutMatchesFlat:rondas.flat(),knockoutGenerated:true}:{knockoutMatchesFlat:rondas.flat()};
  await fs().updateDoc(ref("categorias",catId),cambios);
}

// ===== Parejas =====

export async function guardarPareja(pareja,catId){
  // Firestore rechaza campos undefined: se limpian antes de guardar
  await asegurarIds(clavesDePareja(pareja));
  const ts=parejaABase({...pareja,categoriaId:catId},aBase);delete ts.restricciones;if(ts.j1===undefined)delete ts.j1;if(ts.j2===undefined)delete ts.j2;
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

// "cedula" acá es la clave de memoria del jugador (ver arriba)
export async function guardarJugador(cedula,jugador){
  await asegurarIds([cedula]);
  await fs().setDoc(ref("jugadores",aBase(cedula)),jugadorABase(jugador));
}

export async function actualizarJugador(cedula,cambios){
  await fs().updateDoc(ref("jugadores",aBase(cedula)),jugadorABase(cambios));
}

// Borra al jugador del ranking. Su acceso (cédula -> id) queda: si sigue en
// alguna pareja, tiene que poder seguir entrando.
export async function eliminarJugador(cedula){
  await fs().deleteDoc(ref("jugadores",aBase(cedula)));
}

// Atómico: guarda los jugadores cuyos puntos cambiaron y marca la categoría
// como "puntos otorgados". entradas = [[cedula, jugador], ...]
export async function guardarPuntos(catId,entradas){
  await asegurarIds(entradas.map(([cedula])=>cedula));
  const batch=fs().writeBatch(db());
  entradas.forEach(([cedula,jugador])=>batch.set(ref("jugadores",aBase(cedula)),jugadorABase(jugador)));
  batch.update(ref("categorias",catId),{pointsAwarded:true});
  await batch.commit();
}

// ===== Perfil del jugador (partidos por nivel, ver logica/perfil.js) =====
// "perfiles": uno por jugador, con su id como nombre del documento. Cualquiera
//   puede leer UNO si conoce el id; listarlos todos, solo el admin.
// "contactos": el WhatsApp. El jugador lo escribe, pero solo el admin lo lee.
// Los dos se guardan con el id del jugador, nunca con la cédula.

// Devuelve el perfil guardado o null si todavía no tiene
export async function cargarPerfil(clave){
  const snap=await fs().getDoc(ref("perfiles",aBase(clave)));
  return snap.exists()?snap.data():null;
}

// Guarda el perfil entero (respuestas, lado, género, disponibilidad, vigencia).
// Si "whatsapp" viene vacío, el contacto que ya estaba no se toca.
// Primero el WhatsApp: si falla, el perfil no queda guardado sin forma de contacto.
export async function guardarPerfil(clave,perfil,whatsapp){
  const id=aBase(clave);
  if(whatsapp)await fs().setDoc(ref("contactos",id),{whatsapp});
  await fs().setDoc(ref("perfiles",id),perfil);
}

// Solo admin: todos los perfiles con su WhatsApp, y la clave de memoria del
// jugador (la cédula real, porque entró el admin). También aparecen los
// jugadores que cargaron el WhatsApp pero no llegaron a guardar el perfil.
export async function cargarPerfilesAdmin(){
  const {collection,getDocs}=fs();
  const [ps,cs]=await Promise.all([getDocs(collection(db(),"perfiles")),getDocs(collection(db(),"contactos"))]);
  const perfiles=new Map(ps.docs.map(d=>[d.id,d.data()]));
  const contactos=new Map(cs.docs.map(d=>[d.id,d.data().whatsapp||null]));
  const ids=new Set([...perfiles.keys(),...contactos.keys()]);
  return [...ids].map(id=>({id,clave:aMemoria(id),perfil:perfiles.get(id)||null,whatsapp:contactos.get(id)||null}));
}

// Solo admin: borra el perfil y el WhatsApp de un jugador (por ejemplo, una ficha suelta)
export async function eliminarPerfil(id){
  const batch=fs().writeBatch(db());
  batch.delete(ref("perfiles",id));
  batch.delete(ref("contactos",id));
  await batch.commit();
}

// ===== Calendario del club (torneos largos) =====

// Guarda varios días de una vez (atómico). Un día sin rangos se borra.
// dias = [{fecha:"2026-10-14", canchas:{"BOX 1":[{desde,hasta}], ...}}, ...]
export async function guardarDiasClub(dias){
  const batch=fs().writeBatch(db());
  dias.forEach(({fecha,canchas})=>{
    const limpias=Object.fromEntries(Object.entries(canchas||{}).filter(([,rs])=>rs&&rs.length));
    if(Object.keys(limpias).length)batch.set(ref("calendarioClub",fecha),{fecha,canchas:limpias});
    else batch.delete(ref("calendarioClub",fecha));
  });
  await batch.commit();
}

// ===== Club =====

export async function guardarDatosClub(datos){
  await fs().setDoc(ref("club","datos"),datos);
}

// tipo: "logoColor" o "logoBlanco"; dataUrl vacío = quitar el logo
export async function guardarLogoClub(tipo,dataUrl){
  const id=tipo==="logoBlanco"?"logo_blanco":"logo_color";
  if(dataUrl)await fs().setDoc(ref("club",id),{dataUrl});
  else await fs().deleteDoc(ref("club",id));
}

// ===== Página pública del torneo =====

// Lee SOLO lo que muestra la página de un torneo: el torneo, sus categorías,
// los nombres de los inscriptos y los datos del club (con un solo logo).
// No usa cargarTodo(): la página se abre desde el celular de cualquiera y
// tiene que ser liviana. Devuelve null si el torneo no existe.
// Nota: Firestore igual entrega cada documento de pareja completo; acá se
// descarta todo menos los nombres, pero ocultar las cédulas de verdad es la
// migración pendiente (las reglas de lectura siguen abiertas).
export async function cargarTorneoPublico(torneoId){
  const {collection,getDocs,getDoc,query,where}=fs();
  const t=await getDoc(ref("torneos",torneoId));
  if(!t.exists())return null;
  const torneo={id:t.id,...t.data()};
  const cs=await getDocs(query(collection(db(),"categorias"),where("torneoId","==",torneoId)));
  const categorias=await Promise.all(cs.docs.map(async dc=>{
    const c=dc.data();
    const ps=await getDocs(query(collection(db(),"parejas"),where("categoriaId","==",dc.id)));
    const parejas=ps.docs.map(d=>{const p=d.data();return {j1nombre:p.j1nombre||p.j1||"",j2nombre:p.j2nombre||p.j2||"",nombre:p.nombre||""};});
    return {id:dc.id,nombre:c.nombre,modalidad:c.modalidad,
      fixtureGenerado:!!(c.fixtureGenerado||c.americanoFixtureGenerado),
      parejas,jugadoresAmericano:(c.jugadoresAmericano||[]).map(j=>({nombre:j.nombre}))};
  }));
  // Club: los datos y solo el logo que corresponde al tema (cada logo pesa hasta 700 KB)
  let club={};
  try{
    const d=await getDoc(ref("club","datos"));
    if(d.exists())club={...d.data()};
    const orden=club.tema==="claro"?["logo_color","logo_blanco"]:["logo_blanco","logo_color"];
    for(const id of orden){
      const l=await getDoc(ref("club",id));
      if(l.exists()&&l.data().dataUrl){club[id==="logo_blanco"?"logoBlanco":"logoColor"]=l.data().dataUrl;break;}
    }
  }catch(err){console.error("No se pudieron leer los datos del club:",err);}
  return {torneo,categorias,club};
}

// ===== Copia de seguridad =====

// Lee todas las colecciones tal cual están guardadas: { torneos: [{id, datos}], ... }
// Si una sola colección falla, falla todo: una copia a la que le falta una
// parte sin avisar es peor que no tener copia, porque da falsa tranquilidad.
export async function exportarTodo(){
  const {collection,getDocs}=fs();
  const partes=await Promise.all(COLECCIONES_COPIA.map(async nombre=>{
    const s=await getDocs(collection(db(),nombre));
    return [nombre,s.docs.map(d=>({id:d.id,datos:d.data()}))];
  }));
  return Object.fromEntries(partes);
}

// Escribe los lotes de una restauración, uno por uno.
// Cada lote es todo o nada; entre lotes no. Si se corta a la mitad, volver a
// restaurar la misma copia termina el trabajo (solo toca lo que difiere).
// alAvanzar(hechos, total) sirve para mostrar el progreso.
export async function aplicarRestauracion(lotes,alAvanzar){
  for(let i=0;i<lotes.length;i++){
    const batch=fs().writeBatch(db());
    lotes[i].forEach(op=>{
      if(op.tipo==="delete")batch.delete(ref(op.col,op.id));
      else batch.set(ref(op.col,op.id),op.datos);
    });
    await batch.commit();
    if(alAvanzar)alAvanzar(i+1,lotes.length);
  }
}
