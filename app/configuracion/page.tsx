"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cerrarSesion, haySesion, leerSesion } from "@/lib/auth";
import { listarEmpresas } from "@/lib/leads";
import { NavInferior } from "@/components/NavInferior";
import { IconoWhatsApp, IconoChevron } from "@/components/Iconos";
import ConectarWhatsApp from "@/components/ConectarWhatsApp";

// Bloque plegable de configuración.
function Bloque({
  titulo,
  descripcion,
  children,
  defecto = false,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
  defecto?: boolean;
}) {
  const [abierto, setAbierto] = useState(defecto);
  return (
    <section className="overflow-hidden rounded-tarjeta bg-carta shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div>
          <h2 className="text-[1.05rem] font-bold text-tinta">{titulo}</h2>
          <p className="text-[0.82rem] text-frio">{descripcion}</p>
        </div>
        <IconoChevron className={`h-5 w-5 shrink-0 text-frio transition-transform ${abierto ? "" : "-rotate-90"}`} />
      </button>
      {abierto && <div className="border-t border-linea px-4 py-4">{children}</div>}
    </section>
  );
}

function Interruptor({ label, activo = false }: { label: string; activo?: boolean }) {
  const [on, setOn] = useState(activo);
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="flex w-full items-center justify-between py-2.5"
      role="switch"
      aria-checked={on}
    >
      <span className="text-[0.95rem] text-tinta-2">{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? "bg-brasa" : "bg-arena-2"}`}>
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-carta shadow transition-all ${on ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}

const TONOS = ["Cercano y amigable", "Formal y profesional", "Directo y breve"];

export default function Configuracion() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [tono, setTono] = useState(TONOS[0]);

  useEffect(() => {
    if (!haySesion()) router.replace("/");
    else setListo(true);
  }, [router]);

  if (!listo) return null;
  const sesion = leerSesion();
  const empresas = listarEmpresas();

  function salir() {
    cerrarSesion();
    router.replace("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <p className="eyebrow">Ajustes</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Configuración</h1>
      </header>

      <main className="flex-1 space-y-3 px-5 pb-6 pt-4">
        <Bloque titulo="Tus marcas y productos" descripcion={`${empresas.length} empresas · comisión y catálogo`} defecto>
          <div className="space-y-4">
            {empresas.map((e) => (
              <div key={e.id} className="rounded-xl bg-arena/60 p-3.5 ring-1 ring-linea">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-tinta">{e.nombre}</h3>
                  <span className="rounded-chip bg-tibio-suave px-2.5 py-1 text-[0.78rem] font-bold text-tibio">
                    {e.comision}% comisión
                  </span>
                </div>
                <a
                  href={`https://wa.me/${e.whatsapp.replace(/\D/g, "")}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-[#128C7E]"
                >
                  <IconoWhatsApp className="h-4 w-4" /> {e.whatsapp}
                </a>
                <ul className="mt-2 space-y-1">
                  {e.productos.map((p) => (
                    <li key={p.nombre} className="flex justify-between text-[0.88rem] text-tinta-2">
                      <span>{p.nombre}</span>
                      <span className="font-bold text-tinta">{p.precio}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <button className="w-full rounded-chip border-2 border-dashed border-linea py-2.5 text-[0.9rem] font-bold text-frio">
              + Agregar marca
            </button>
          </div>
        </Bloque>

        <Bloque titulo="Tus canales" descripcion="Conectá WhatsApp para que LeadAI atienda por vos" defecto>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-arena/60 p-3.5 ring-1 ring-linea">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#128C7E]/10">
                <IconoWhatsApp className="h-5 w-5 text-[#128C7E]" />
              </span>
              <div>
                <h3 className="font-bold text-tinta">WhatsApp</h3>
                <p className="text-[0.82rem] text-frio">Recibí y respondé leads por WhatsApp Business</p>
              </div>
            </div>
            <ConectarWhatsApp />
          </div>
        </Bloque>

        <Bloque titulo="Preguntas de calificación" descripcion="Qué averigua la IA antes de avisarte">
          <ul className="space-y-2 text-[0.92rem] text-tinta-2">
            <li className="rounded-lg bg-arena/60 px-3 py-2 ring-1 ring-linea">¿Qué producto le interesa?</li>
            <li className="rounded-lg bg-arena/60 px-3 py-2 ring-1 ring-linea">¿Para cuándo lo necesita?</li>
            <li className="rounded-lg bg-arena/60 px-3 py-2 ring-1 ring-linea">¿Tiene un presupuesto en mente?</li>
          </ul>
          <button className="mt-3 w-full rounded-chip border-2 border-dashed border-linea py-2 text-[0.88rem] font-bold text-frio">
            + Agregar pregunta
          </button>
        </Bloque>

        <Bloque titulo="Tono del bot" descripcion={tono}>
          <div className="space-y-2">
            {TONOS.map((t) => (
              <button
                key={t}
                onClick={() => setTono(t)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-[0.95rem] transition ${
                  tono === t ? "bg-brasa-suave font-bold text-brasa-hondo ring-1 ring-brasa/40" : "bg-arena/60 text-tinta-2 ring-1 ring-linea"
                }`}
              >
                {t}
                {tono === t && <span>✓</span>}
              </button>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Cuándo avisarte" descripcion="Solo lo importante, en el momento justo">
          <Interruptor label="Cuando un lead se pone caliente" activo />
          <Interruptor label="Cuando alguien pregunta por precio" activo />
          <Interruptor label="Resumen diario a las 8 pm" />
        </Bloque>

        <Bloque titulo="Seguimientos automáticos" descripcion="La IA reactiva leads tibios por vos">
          <Interruptor label="Reactivar leads sin respuesta a las 24 h" activo />
          <Interruptor label="Recordatorio final antes de darlo por perdido" activo />
        </Bloque>

        <Bloque titulo="Tu equipo" descripcion="Invitá a quien venda con vos">
          <p className="text-[0.9rem] text-tinta-2">Solo vos por ahora.</p>
          <button className="mt-3 w-full rounded-chip bg-tinta py-2.5 text-[0.9rem] font-bold text-carta">
            Invitar a alguien
          </button>
        </Bloque>

        <div className="pt-2 text-center">
          <p className="text-[0.82rem] text-frio">Sesión de {sesion?.usuario.email}</p>
          <button onClick={salir} className="mt-2 text-[0.95rem] font-bold text-brasa">
            Cerrar sesión
          </button>
        </div>
      </main>

      <NavInferior />
    </div>
  );
}
