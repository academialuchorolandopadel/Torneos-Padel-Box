// Sesiones: el admin entra con Firebase Auth (email y contraseña) y el
// jugador con su cédula, que queda guardada en el navegador mientras la
// pestaña esté abierta. Ninguna otra parte de la app toca estos mecanismos.
//
// Igual que en firestore.js, los objetos de Firebase se leen dentro de cada
// función porque index.html los inicializa.

const KEY_ACTIVO = "padelbox_player";
const KEY_CEDULA = "padelbox_player_cedula";

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

export function leerSesionJugador(){
  const activa=sessionStorage.getItem(KEY_ACTIVO)==="true";
  return {activa,cedula:activa?sessionStorage.getItem(KEY_CEDULA):null};
}

export function guardarSesionJugador(cedula){
  sessionStorage.setItem(KEY_ACTIVO,"true");
  sessionStorage.setItem(KEY_CEDULA,cedula);
}

export function borrarSesionJugador(){
  sessionStorage.removeItem(KEY_ACTIVO);
  sessionStorage.removeItem(KEY_CEDULA);
}
