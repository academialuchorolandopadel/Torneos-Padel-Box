// Sesiones: el admin entra con Firebase Auth (email y contraseña) y el
// jugador con su cédula. Desde la v52 el navegador no guarda la cédula sino
// el id del jugador (lo que devuelve la consulta a "accesos"), mientras la
// pestaña esté abierta. Ninguna otra parte de la app toca estos mecanismos.
//
// Igual que en firestore.js, los objetos de Firebase se leen dentro de cada
// función porque index.html los inicializa.

const KEY_ACTIVO = "padelbox_player";
const KEY_ID = "padelbox_player_id";
const KEY_VIEJA = "padelbox_player_cedula"; // hasta v51 se guardaba la cédula

// Avisa cada vez que cambia la sesión de admin. Devuelve la función para dejar de escuchar.
export function escucharSesionAdmin(alCambiar){
  return window.firebaseAuth.onAuthStateChanged(window.auth,(user)=>{alCambiar(!!user);});
}

export async function iniciarSesionAdmin(email,pass){
  await window.firebaseAuth.signInWithEmailAndPassword(window.auth,email,pass);
}

export async function cerrarSesionAdmin(){
  await window.firebaseAuth.signOut(window.auth);
}

// Una sesión vieja (con cédula guardada) se descarta: el jugador vuelve a entrar.
export function leerSesionJugador(){
  if(sessionStorage.getItem(KEY_VIEJA)!==null){sessionStorage.removeItem(KEY_VIEJA);sessionStorage.removeItem(KEY_ACTIVO);}
  const id=sessionStorage.getItem(KEY_ID);
  const activa=sessionStorage.getItem(KEY_ACTIVO)==="true"&&!!id;
  return {activa,jugadorId:activa?id:null};
}

export function guardarSesionJugador(jugadorId){
  sessionStorage.setItem(KEY_ACTIVO,"true");
  sessionStorage.setItem(KEY_ID,jugadorId);
}

export function borrarSesionJugador(){
  sessionStorage.removeItem(KEY_ACTIVO);
  sessionStorage.removeItem(KEY_ID);
}
