/**
 * EL PLATO VUELA AL CARRITO (2026-08-19).
 *
 * Cuando alguien toca un plato, una copia de su foto sale de la tarjeta y
 * aterriza en la barra del carrito.
 *
 * NO ES DECORACIÓN. Es la respuesta a la única pregunta que se hace un cliente
 * en ese instante: "¿se agregó?". La carta se abre en un teléfono, con una
 * mano, muchas veces caminando — y si el toque no responde, la gente toca de
 * nuevo y pide el doble. El vuelo dice qué se agregó y a dónde fue, en 500ms,
 * sin ocupar un centímetro de pantalla.
 *
 * Se hace con la Web Animations API, que es del navegador: cero dependencias
 * y corre en el compositor, así que no traba el scroll aunque el teléfono sea
 * viejo.
 */

/** Cuánto dura el vuelo. Más largo se siente lento; más corto no se ve. */
const MS_VUELO = 520;

/**
 * Manda una copia del elemento hacia el carrito.
 *
 * Silencioso a propósito: si algo falla —el navegador no soporta la API, el
 * carrito no está en pantalla— el pedido se agrega igual. Una animación nunca
 * puede impedir una venta.
 */
export function volarAlCarrito(origen: HTMLElement | null, destino: HTMLElement | null): void {
  if (typeof window === "undefined" || !origen) return;

  // SIN CARRITO TODAVÍA (2026-08-19): con el primer plato la barra aún no está
  // montada, así que no hay a dónde volar. Se apunta al borde inferior de la
  // pantalla, que es exactamente donde la barra va a aparecer — el cliente ve
  // el plato bajar y la barra subir a recibirlo.
  //
  // Sin esto el primer plato —el más importante, el que decide si sigue
  // pidiendo— era el único que se agregaba en silencio.
  if (!destino) {
    const fantasma = document.createElement("div");
    Object.assign(fantasma.style, {
      position: "fixed", left: "50%", bottom: "36px", width: "1px", height: "1px",
      pointerEvents: "none", opacity: "0",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(fantasma);
    volarAlCarrito(origen, fantasma);
    setTimeout(() => fantasma.remove(), 900);
    return;
  }
  if (typeof origen.animate !== "function") return;

  // Respeta a quien pidió menos movimiento: para alguien con vértigo o
  // sensibilidad vestibular, una cosa cruzando la pantalla es un problema real.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const desde = origen.getBoundingClientRect();
  const hasta = destino.getBoundingClientRect();
  if (desde.width === 0 || hasta.width === 0) return;

  // Vuela la FOTO si la hay; si no, un punto del color de la marca. Un plato
  // sin foto igual tiene que responder al toque.
  const foto = origen.querySelector("img");
  const bala = document.createElement("div");

  const lado = Math.min(desde.width, 72);
  Object.assign(bala.style, {
    position: "fixed",
    left: `${desde.left + desde.width / 2 - lado / 2}px`,
    top: `${desde.top + desde.height / 2 - lado / 2}px`,
    width: `${lado}px`,
    height: `${lado}px`,
    borderRadius: "14px",
    zIndex: "60",
    // No intercepta toques: el cliente puede seguir agregando mientras vuela.
    pointerEvents: "none",
    backgroundColor: "var(--color-brasa)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    willChange: "transform, opacity",
  } as Partial<CSSStyleDeclaration>);
  if (foto?.src) bala.style.backgroundImage = `url("${foto.src}")`;

  document.body.appendChild(bala);

  // LA BALA SE BORRA SÍ O SÍ (2026-08-21, bug real de Jonathan). Antes la
  // limpieza vivía solo en `onfinish` — y en el navegador embebido de
  // WhatsApp ese evento a veces NO dispara (animación descartada, pestaña en
  // pausa, soporte a medias). Cada plato tocado dejaba su copia pegada en la
  // pantalla, y a los cinco platos el cliente ya no veía la carta.
  //
  // Tres redes: onfinish (camino feliz), oncancel, y un setTimeout que barre
  // pase lo que pase. `remove()` es idempotente: llamarlo dos veces no duele.
  const retirar = () => bala.remove();
  const barrido = setTimeout(retirar, MS_VUELO + 500);

  const dx = hasta.left + hasta.width / 2 - (desde.left + desde.width / 2);
  const dy = hasta.top + hasta.height / 2 - (desde.top + desde.height / 2);

  // La curva es la clave: sube un poco antes de caer, como algo que se lanza.
  // Una recta se ve robótica; el arco se lee como un objeto con peso.
  let animacion: Animation;
  try {
    animacion = bala.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        {
          transform: `translate(${dx * 0.5}px, ${dy * 0.35 - 60}px) scale(0.7)`,
          opacity: 0.9,
          offset: 0.55,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.35 },
      ],
      { duration: MS_VUELO, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
    );
  } catch {
    // Si animate() revienta (WebView viejo), la copia no puede quedar viva.
    clearTimeout(barrido);
    retirar();
    return;
  }

  animacion.oncancel = retirar;
  animacion.onfinish = () => {
    retirar();
    // El carrito ACUSA RECIBO. El vuelo dice "algo salió"; este latido dice
    // "algo llegó". Sin el segundo, la animación queda a mitad de la frase.
    destino.classList.remove("late");
    // Forzar reflow: sin esto, quitar y poner la clase en el mismo frame no
    // reinicia la animación y el segundo plato no late.
    void destino.offsetWidth;
    destino.classList.add("late");
  };
}
