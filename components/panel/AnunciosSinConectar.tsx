"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  conectarAdsMeta, opcionesAdsMeta, urlConexionAdsMeta,
  type CuentaAdsMeta, type PaginaAdsMeta,
} from "@/lib/api";

/**
 * LO QUE VE QUIEN TODAVÍA NO CONECTÓ META (2026-09-18).
 *
 * Verificado en la base: 34 de 36 negocios NO tienen cuenta de anuncios
 * conectada. Todos ellos abrían Marketing → Anuncios y se encontraban con
 * cinco pestañas vacías, sin que nada explicara por qué ni qué hacer.
 *
 * CONECTAR DE VERDAD (2026-09-29). El botón llevaba a Canales, donde no había
 * nada para Meta Ads. Ahora abre el login de Meta y, al volver, el dueño elige
 * su cuenta publicitaria y la página que firma los anuncios. El gasto va a SU
 * medio de pago en Meta.
 */

type Paso = "inicio" | "esperando" | "elegir";

export function AnunciosSinConectar({ tenant, onConectada }: { tenant?: string; onConectada?: () => void }) {
  const [paso, setPaso] = useState<Paso>("inicio");
  const [cuentas, setCuentas] = useState<CuentaAdsMeta[]>([]);
  const [paginas, setPaginas] = useState<PaginaAdsMeta[]>([]);
  const [cuenta, setCuenta] = useState("");
  const [pagina, setPagina] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sondeo = useRef<number | null>(null);

  const mostrarOpciones = useCallback((o: { cuentas: CuentaAdsMeta[]; paginas: PaginaAdsMeta[] }) => {
    setCuentas(o.cuentas);
    setPaginas(o.paginas);
    setCuenta((o.cuentas.find((c) => c.activa) ?? o.cuentas[0])?.id ?? "");
    setPagina(o.paginas[0]?.id ?? "");
    setPaso("elegir");
  }, []);

  const pararSondeo = () => {
    if (sondeo.current !== null) window.clearInterval(sondeo.current);
    sondeo.current = null;
  };

  // Si ya autorizó (volvió de Meta en otra pestaña o recargó), directo a elegir.
  useEffect(() => {
    let vivo = true;
    void opcionesAdsMeta(tenant).then((o) => { if (vivo && o) mostrarOpciones(o); });
    return () => { vivo = false; pararSondeo(); };
  }, [tenant, mostrarOpciones]);

  async function conectar() {
    setError(null);
    const url = await urlConexionAdsMeta(tenant);
    if (!url) { setError("No pudimos abrir Meta. Vuelve a intentarlo."); return; }
    const popup = window.open(url, "meta-ads", "width=620,height=760");
    if (!popup) { window.location.href = url; return; }
    setPaso("esperando");
    // Meta devuelve al servidor, no al panel: se pregunta cada 2 s si ya hay
    // algo para elegir. 5 minutos alcanzan de sobra; después se deja de esperar.
    const inicio = Date.now();
    pararSondeo();
    sondeo.current = window.setInterval(async () => {
      if (Date.now() - inicio > 5 * 60_000) { pararSondeo(); setPaso("inicio"); return; }
      const o = await opcionesAdsMeta(tenant);
      if (o) { pararSondeo(); mostrarOpciones(o); }
    }, 2000);
  }

  async function guardar() {
    if (!cuenta || !pagina || guardando) return;
    setGuardando(true);
    setError(null);
    const r = await conectarAdsMeta(cuenta, pagina, tenant);
    setGuardando(false);
    if (r.ok) onConectada?.();
    else setError(r.error);
  }

  if (paso === "elegir") {
    return (
      <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
        <h3 className="text-[1.15rem] font-bold text-tinta">Elige dónde se crean tus anuncios</h3>
        <p className="mt-1.5 text-[0.9rem] text-frio">
          Estas son las cuentas y páginas que autorizaste en Meta.
        </p>

        <fieldset className="mt-5">
          <legend className="text-[0.86rem] font-bold text-tinta">Cuenta publicitaria</legend>
          <p className="text-[0.78rem] text-frio">Meta le cobra los anuncios al medio de pago de esta cuenta.</p>
          <div className="mt-2 space-y-1.5">
            {cuentas.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-3 rounded-chip px-3 py-2.5 ring-1 transition ${
                  cuenta === c.id ? "bg-brasa-suave/40 ring-brasa/40" : "bg-arena/40 ring-linea hover:bg-arena/70"
                }`}
              >
                <input type="radio" name="cuenta" checked={cuenta === c.id} onChange={() => setCuenta(c.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.88rem] font-semibold text-tinta">{c.nombre}</span>
                  <span className="text-[0.74rem] text-frio">act_{c.id}{c.moneda ? ` · ${c.moneda}` : ""}</span>
                </span>
                {!c.activa && (
                  <span className="shrink-0 rounded-full bg-calor-suave px-2 py-0.5 text-[0.68rem] font-bold text-calor-hondo">
                    No activa en Meta
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-[0.86rem] font-bold text-tinta">Página que firma los anuncios</legend>
          <p className="text-[0.78rem] text-frio">
            Los anuncios salen a su nombre. Para los que llevan a WhatsApp, la página debe tener tu WhatsApp vinculado.
          </p>
          <div className="mt-2 space-y-1.5">
            {paginas.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-chip px-3 py-2.5 ring-1 transition ${
                  pagina === p.id ? "bg-brasa-suave/40 ring-brasa/40" : "bg-arena/40 ring-linea hover:bg-arena/70"
                }`}
              >
                <input type="radio" name="pagina" checked={pagina === p.id} onChange={() => setPagina(p.id)} />
                <span className="text-[0.88rem] font-semibold text-tinta">{p.nombre}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="mt-3 text-[0.84rem] font-semibold text-calor-hondo">{error}</p>}

        <button
          onClick={guardar}
          disabled={!cuenta || !pagina || guardando}
          className="mt-5 inline-flex rounded-chip bg-brasa px-4 py-2.5 text-[0.88rem] font-bold text-sobre-brasa transition hover:opacity-90 disabled:opacity-50"
        >
          {guardando ? "Conectando…" : "Conectar esta cuenta"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
      <h3 className="text-[1.15rem] font-bold text-tinta">
        Trae gente nueva con publicidad
      </h3>
      <p className="mt-1.5 text-[0.9rem] text-frio">
        Conecta tu cuenta de Meta y vas a poder crear anuncios y ver, desde aquí,
        cuáles te traen clientes de verdad — no solo clics.
      </p>

      <ul className="mt-4 space-y-2.5">
        {[
          ["📊", "Cuánto te cuesta cada persona que te escribe", "No el clic: la conversación."],
          ["🔍", "En qué paso se te pierde la gente", "Muchos tocan el anuncio y nunca llegan al WhatsApp."],
          ["🏆", "Qué anuncio conviene escalar", "Y cuál está gastando sin traer a nadie."],
          ["🎯", "A quién le llega", "Puedes subir tu propia lista de contactos."],
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

      <button
        onClick={conectar}
        disabled={paso === "esperando"}
        className="mt-5 inline-flex rounded-chip bg-brasa px-4 py-2.5 text-[0.88rem] font-bold text-sobre-brasa transition hover:opacity-90 disabled:opacity-60"
      >
        {paso === "esperando" ? "Esperando a Meta…" : "Conectar mi cuenta de Meta"}
      </button>
      {paso === "esperando" && (
        <p className="mt-2 text-[0.8rem] text-frio">
          Termina la autorización en la ventana de Meta. Cuando vuelvas, aquí eliges la cuenta.
        </p>
      )}
      {error && <p className="mt-2 text-[0.84rem] font-semibold text-calor-hondo">{error}</p>}

      {/* Que no crea que el requisito es gastar: conectar es gratis y sirve
          igual para MIRAR lo que ya se está gastando desde Meta. */}
      <p className="mt-3 text-[0.8rem] text-frio">
        Conectarla es gratis. Si ya haces publicidad desde Meta, vas a ver aquí
        esos mismos anuncios sin cambiar nada de cómo trabajas.
      </p>
    </div>
  );
}
