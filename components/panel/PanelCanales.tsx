"use client";

import { useEffect, useState } from "react";
import {
  listarCanales, obtenerUrlOAuth, actualizarCanal,
  type Canal, type TipoCanal,
} from "@/lib/api";
import { IconoWhatsApp, IconoInstagram, IconoMessenger, IconoTikTok } from "@/components/Iconos";
import ConectarWhatsApp from "@/components/ConectarWhatsApp";

// Metadatos de cada red: ícono, nombre, color de marca y cómo se conecta.
const REDES: {
  tipo: TipoCanal;
  nombre: string;
  Icono: (p: { className?: string }) => React.ReactNode;
  color: string;
  descripcion: string;
  // WhatsApp usa su propio flujo (Embedded Signup); el resto va por OAuth.
  metodo: "whatsapp" | "oauth";
}[] = [
  { tipo: "whatsapp", nombre: "WhatsApp", Icono: IconoWhatsApp, color: "#25D366", descripcion: "Tu número de WhatsApp Business", metodo: "whatsapp" },
  { tipo: "instagram", nombre: "Instagram", Icono: IconoInstagram, color: "#C13584", descripcion: "Mensajes directos de tu cuenta de Instagram", metodo: "oauth" },
  { tipo: "messenger", nombre: "Messenger", Icono: IconoMessenger, color: "#0084FF", descripcion: "Mensajes de tu página de Facebook", metodo: "oauth" },
  { tipo: "tiktok", nombre: "TikTok", Icono: IconoTikTok, color: "#010101", descripcion: "Mensajes de tu cuenta de TikTok", metodo: "oauth" },
];

export function PanelCanales() {
  const [canales, setCanales] = useState<Canal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<TipoCanal>("whatsapp");
  const [conectando, setConectando] = useState(false);

  async function cargar() {
    setCargando(true);
    setCanales(await listarCanales());
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  // Cuántas cuentas hay conectadas de cada red.
  const cuenta = (tipo: TipoCanal) => canales.filter((c) => c.tipo === tipo).length;

  const red = REDES.find((r) => r.tipo === seleccion)!;
  const conexiones = canales.filter((c) => c.tipo === seleccion);

  async function conectarOAuth(tipo: TipoCanal) {
    setConectando(true);
    const url = await obtenerUrlOAuth(tipo);
    setConectando(false);
    if (url) {
      // Abre la autorización de la red en una pestaña nueva.
      window.open(url, "_blank", "noopener");
    }
  }

  async function alternar(c: Canal) {
    await actualizarCanal(c.id, { activo: !c.activo });
    cargar();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Izquierda: lista de redes */}
      <div className="space-y-2">
        {REDES.map((r) => {
          const n = cuenta(r.tipo);
          const activa = seleccion === r.tipo;
          return (
            <button
              key={r.tipo}
              onClick={() => setSeleccion(r.tipo)}
              className={`flex w-full items-center gap-3 rounded-tarjeta px-3.5 py-3 text-left transition ${
                activa ? "bg-carta ring-2 ring-brasa" : "bg-carta ring-1 ring-linea hover:ring-brasa/50"
              }`}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{ backgroundColor: `${r.color}1a`, color: r.color }}
              >
                <r.Icono className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.92rem] font-semibold text-tinta">{r.nombre}</span>
                <span className="block text-[0.75rem] text-frio">
                  {n > 0 ? `${n} conectada${n > 1 ? "s" : ""}` : "Sin conectar"}
                </span>
              </span>
              {n > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-ok" />}
            </button>
          );
        })}
      </div>

      {/* Derecha: detalle de la red seleccionada */}
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 place-items-center rounded-full"
            style={{ backgroundColor: `${red.color}1a`, color: red.color }}
          >
            <red.Icono className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-[1.05rem] font-bold text-tinta">{red.nombre}</h3>
            <p className="text-[0.82rem] text-frio">{red.descripcion}</p>
          </div>
        </div>

        <div className="mt-5">
          {/* WhatsApp: su propio componente de conexión */}
          {red.tipo === "whatsapp" ? (
            <ConectarWhatsApp />
          ) : (
            <>
              {/* Conexiones existentes de esta red */}
              {cargando ? (
                <p className="text-[0.85rem] text-frio">Cargando…</p>
              ) : conexiones.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">Cuentas conectadas</p>
                  {conexiones.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-arena/40 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[0.9rem] font-semibold text-tinta">{c.nombre || c.cuentaExterna}</p>
                        <p className="truncate text-[0.75rem] text-frio">
                          {c.cuentaExterna} · conectada el {new Date(c.creadoEn).toLocaleDateString("es-PE")}
                        </p>
                      </div>
                      <button
                        onClick={() => alternar(c)}
                        className={`shrink-0 rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${
                          c.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"
                        }`}
                      >
                        {c.activo ? "Activo" : "Apagado"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[0.85rem] text-frio">Todavía no conectaste ninguna cuenta de {red.nombre}.</p>
              )}

              {/* Botón para conectar una cuenta nueva */}
              <button
                onClick={() => conectarOAuth(red.tipo)}
                disabled={conectando}
                className="mt-4 inline-flex items-center gap-2 rounded-tarjeta bg-brasa px-5 py-2.5 text-[0.92rem] font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-60"
              >
                {conectando ? "Abriendo…" : `Conectar ${red.nombre}`}
              </button>
              <p className="mt-2 text-[0.75rem] text-frio">
                Se abre una ventana para que autorices con {red.nombre}.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
