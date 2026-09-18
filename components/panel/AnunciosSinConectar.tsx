"use client";

/**
 * LO QUE VE QUIEN TODAVÍA NO CONECTÓ META (2026-09-18).
 *
 * Verificado en la base: 34 de 36 negocios NO tienen cuenta de anuncios
 * conectada. Todos ellos abrían Marketing → Anuncios y se encontraban con
 * cinco pestañas vacías —"Resumen", "Cada anuncio", "Qué funcionó"— cada una
 * diciendo que no hay datos, sin que nada explicara por qué ni qué hacer.
 *
 * Es la PRIMERA IMPRESIÓN de la sección para casi todos los clientes, y estaba
 * dando la señal contraria: parece que el producto no funciona, cuando lo que
 * falta es un paso de configuración.
 *
 * NO SE LISTAN LAS PESTAÑAS VACÍAS detrás de esto: mostrar navegación que no
 * lleva a ningún lado es lo que hace que alguien toque cinco veces antes de
 * entender. Cuando conecta, aparecen todas juntas y con datos.
 */

/** Adónde se conecta la cuenta. Vive en Configuración, no acá. */
const DONDE_CONECTAR = "/configuracion?tab=canales";

export function AnunciosSinConectar() {
  return (
    <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
      <h3 className="text-[1.15rem] font-bold text-tinta">
        Traé gente nueva con publicidad
      </h3>
      <p className="mt-1.5 text-[0.9rem] text-frio">
        Conectá tu cuenta de Meta y vas a poder ver, desde acá, qué anuncios te
        traen clientes de verdad — no solo clics.
      </p>

      <ul className="mt-4 space-y-2.5">
        {[
          ["📊", "Cuánto te cuesta cada persona que te escribe", "No el clic: la conversación."],
          ["🔍", "En qué paso se te pierde la gente", "Muchos tocan el anuncio y nunca llegan al WhatsApp."],
          ["🏆", "Qué anuncio conviene escalar", "Y cuál está gastando sin traer a nadie."],
          ["🎯", "A quién le llega", "Podés subir tu propia lista de contactos."],
        ].map(([icono, titulo, bajada]) => (
          <li key={titulo} className="flex gap-2.5">
            <span aria-hidden className="text-[1rem] leading-tight">{icono}</span>
            <span className="text-[0.86rem] text-tinta-2">
              <strong className="font-semibold text-tinta">{titulo}</strong>
              <span className="block text-frio">{bajada}</span>
            </span>
          </li>
        ))}
      </ul>

      <a
        href={DONDE_CONECTAR}
        className="mt-5 inline-flex rounded-chip bg-brasa px-4 py-2.5 text-[0.88rem] font-bold text-sobre-brasa transition hover:opacity-90"
      >
        Conectar mi cuenta de Meta
      </a>

      {/* Que no crea que el requisito es gastar: conectar es gratis y sirve
          igual para MIRAR lo que ya se está gastando desde Meta. */}
      <p className="mt-3 text-[0.8rem] text-frio">
        Conectarla es gratis. Si ya hacés publicidad desde Meta, vas a ver acá
        esos mismos anuncios sin cambiar nada de cómo trabajás.
      </p>
    </div>
  );
}
