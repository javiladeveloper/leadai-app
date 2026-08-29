"use client";

import { useEffect } from "react";

/**
 * LOS PÍXELES DEL DUEÑO EN SU CARTA WEB (2026-08-27, pedido de Jonathan).
 *
 * La carta es la página que el dueño promociona con sus anuncios de Facebook
 * e Instagram. Sin píxel, paga por clics y nunca sabe cuántos terminaron
 * comprando.
 *
 * TRES DECISIONES QUE IMPORTAN:
 *
 * 1. Se recibe el ID, no un script. El backend valida el formato y acá se
 *    arma la etiqueta: pegar el `<script>` que da la plataforma sería
 *    ejecutar JavaScript arbitrario en la página de todos sus clientes.
 *
 * 2. Sin ID configurado NO se carga nada. Quien no pauta no paga el costo de
 *    dos scripts de terceros que no le sirven — ni en velocidad ni en datos
 *    de sus clientes viajando a donde no hacen falta.
 *
 * 3. Se inyecta en un efecto y no con <Script>: el ID llega DESPUÉS, con la
 *    carta, así que en el primer render todavía no se sabe si hay que cargar
 *    algo.
 */
/**
 * HOOK y no componente: la carta tiene varios `return` tempranos (cargando,
 * error, pedido en mesa) y un componente montado dentro de uno solo mediría a
 * medias. Como hook se llama una vez, arriba de todo, y vale para todas las
 * vistas de la página.
 *
 * `use*` en inglés porque la regla de React lo exige para reconocerlo como
 * hook; el resto del código sigue en español.
 */
export function usePixelesCarta({
  metaPixelId,
  googleAnalyticsId,
}: {
  metaPixelId?: string;
  googleAnalyticsId?: string;
}) {
  const meta = (metaPixelId ?? "").trim();
  const ga = (googleAnalyticsId ?? "").trim();

  useEffect(() => {
    // Doble guarda de formato, además de la del backend: este valor termina
    // dentro de una etiqueta <script>, y es el último lugar donde se puede
    // frenar algo que no sea un id.
    if (!/^\d{10,20}$/.test(meta)) return;
    const w = window as unknown as { fbq?: { (...a: unknown[]): void; queue?: unknown[] } };
    if (w.fbq) return; // ya cargado (navegación entre vistas de la carta)

    // El snippet oficial de Meta, con el id inyectado por separado.
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);

    const init = document.createElement("script");
    init.textContent =
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?` +
      `n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;` +
      `n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window,document,'script');` +
      `fbq('init',${JSON.stringify(meta)});fbq('track','PageView');`;
    document.head.appendChild(init);
  }, [meta]);

  useEffect(() => {
    if (!/^G-[A-Z0-9]{4,15}$/i.test(ga)) return;
    const w = window as unknown as { dataLayer?: unknown[] };
    if (w.dataLayer) return;

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`;
    document.head.appendChild(s);

    const init = document.createElement("script");
    init.textContent =
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};` +
      `gtag('js',new Date());gtag('config',${JSON.stringify(ga)});`;
    document.head.appendChild(init);
  }, [ga]);

}

/**
 * Avisa a los píxeles que pasó algo que al dueño le importa medir.
 *
 * `AddToCart` y `Purchase` son los nombres ESTÁNDAR de Meta: usar otros haría
 * que su Business Manager no los reconozca como conversiones y no pueda
 * optimizar sus anuncios con ellos, que es justo para lo que sirve el píxel.
 *
 * Nunca lanza: un bloqueador de anuncios o un script que no cargó no puede
 * romper el carrito de nadie.
 */
export function medirEvento(
  evento: "AddToCart" | "Purchase" | "InitiateCheckout",
  datos?: { value?: number; currency?: string },
): void {
  try {
    const w = window as unknown as {
      fbq?: (...a: unknown[]) => void;
      gtag?: (...a: unknown[]) => void;
    };
    w.fbq?.("track", evento, datos);
    // GA4 usa sus propios nombres: se traducen para que el dueño los
    // reconozca en sus informes, en vez de un evento inventado.
    const nombreGa =
      evento === "AddToCart" ? "add_to_cart"
      : evento === "Purchase" ? "purchase"
      : "begin_checkout";
    w.gtag?.("event", nombreGa, datos);
  } catch {
    // Sin píxeles no pasa nada: medir es opcional, comprar no.
  }
}

