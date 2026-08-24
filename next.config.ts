import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // ANUNCIOS Y CAMPANIAS SE UNIFICARON EN /marketing (2026-08-24), cada una
    // como una pestana. Las rutas viejas siguen respondiendo: un link
    // guardado, un historial del navegador o una pestana abierta desde ayer no
    // pueden terminar en 404.
    //
    // El redirect es de NAVEGACION, no de modulo: /marketing importa los dos
    // componentes de pagina directamente, y eso no pasa por el router.
    //
    // `permanent: false` a proposito: un 308 se cachea en el navegador para
    // siempre, y si alguna de las dos vuelve a tener pantalla propia habria
    // que pedirle a cada usuario que limpie el cache.
    return [
      { source: "/anuncios", destination: "/marketing?t=anuncios", permanent: false },
      { source: "/campanias", destination: "/marketing?t=campanias", permanent: false },
    ];
  },
};

export default nextConfig;
