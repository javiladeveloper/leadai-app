/**
 * LA CAMPANA DE LA COCINA (2026-08-22).
 *
 * El celular puede estar en el bolsillo del dueño mientras la compu del
 * mostrador tiene la Cocina abierta. Sin sonido acá, un pedido que entra a las
 * ocho de la noche espera hasta que alguien mire la pantalla.
 *
 * SIN ARCHIVO DE AUDIO, a propósito: se sintetiza con Web Audio. Un mp3 sería
 * un pedido más al servidor —que puede fallar justo cuando entra el pedido— y
 * un archivo que mantener. Dos ondas senoidales con una caída exponencial
 * suenan como una campana de mostrador, que es exactamente el gesto.
 *
 * LOS NAVEGADORES NO DEJAN SONAR SIN INTERACCIÓN. Hasta que alguien toque algo
 * en la página, `AudioContext` nace suspendido y no suena nada. Por eso
 * `prepararCampana` se engancha al primer toque: no pide permiso ni molesta,
 * simplemente aprovecha el primer clic que el dueño da de todos modos.
 */

let contexto: AudioContext | null = null;

/** El AudioContext, creado tarde: antes del primer toque nace suspendido. */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    contexto ??= new Ctor();
    return contexto;
  } catch {
    // Un navegador sin Web Audio no puede sonar, y eso NO es un error que
    // deba romper la Cocina: la pantalla sigue funcionando muda.
    return null;
  }
}

/**
 * Un "din" de campana: dos armónicos que se apagan juntos.
 *
 * Las frecuencias (988 y 1319 Hz) son un si y un mi: un intervalo que suena
 * a timbre de mostrador y no a alarma de reloj.
 */
function golpe(ctx: AudioContext, retraso: number, volumen: number) {
  for (const [frecuencia, peso] of [[988, 1], [1319, 0.5]] as const) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frecuencia;
    const t0 = ctx.currentTime + retraso;
    vol.gain.setValueAtTime(0, t0);
    // Ataque muy corto y caída larga: así se percibe como un golpe de campana
    // y no como un pitido que se enciende.
    vol.gain.linearRampToValueAtTime(volumen * peso, t0 + 0.008);
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    osc.connect(vol).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 1.2);
  }
}

/**
 * Suena la campana. Dos golpes: uno solo se confunde con cualquier "pin" del
 * sistema; dos seguidos se reconocen como "entró un pedido".
 *
 * Nunca lanza: que el audio falle no puede tumbar la pantalla que lo llama.
 */
export function sonarCampana(): void {
  const ctx = audio();
  if (!ctx) return;
  try {
    // Si el navegador lo suspendió (pestaña en segundo plano), se reanuda.
    if (ctx.state === "suspended") void ctx.resume();
    golpe(ctx, 0, 0.28);
    golpe(ctx, 0.22, 0.22);
  } catch {
    /* mudo, pero vivo */
  }
}

/**
 * Deja el audio listo para sonar sin pedirle nada al dueño.
 *
 * Los navegadores bloquean el audio hasta que hay una interacción real. Esto
 * se cuelga del PRIMER clic o toque de la página —uno que el dueño va a dar
 * igual— y se desengancha solo. Sin esto, el primer pedido de la noche entra
 * en silencio.
 */
export function prepararCampana(): () => void {
  if (typeof window === "undefined") return () => {};
  const despertar = () => {
    const ctx = audio();
    if (ctx?.state === "suspended") void ctx.resume();
  };
  window.addEventListener("pointerdown", despertar, { once: true });
  window.addEventListener("keydown", despertar, { once: true });
  return () => {
    window.removeEventListener("pointerdown", despertar);
    window.removeEventListener("keydown", despertar);
  };
}
