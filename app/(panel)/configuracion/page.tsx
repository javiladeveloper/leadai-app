"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { haySesion, leerEmpresaActiva, guardarEmpresaActiva, EMPRESA_GLOBAL } from "@/lib/auth";
import { EtapasEditor } from "@/components/panel/EtapasEditor";
import { PlaybookEditor } from "@/components/panel/PlaybookEditor";
import { RitmoSeguimiento } from "@/components/panel/RitmoSeguimiento";
import { PanelCanales } from "@/components/panel/PanelCanales";
import { Seccion } from "@/components/panel/Seccion";
import { PlanConsumo } from "@/components/panel/PlanConsumo";
import { ConfigComision } from "@/components/panel/ConfigComision";
import { MiPerfilVendedorPanel } from "@/components/panel/MiPerfilVendedor";
import { BarraNegociosGlobal } from "@/components/panel/GlobalNegocios";
import { leerSesion } from "@/lib/auth";
import type { NegocioBandeja } from "@/lib/api";

// Configuración del panel unificado (decisión 2026-07-22): TODO lo
// configurable vive acá. Las pestañas de NEGOCIO (Tu negocio / Canales /
// Plan) llevan chips para elegir cuál configurar — elegir un chip fija la
// empresa activa por debajo y REMONTA el contenido (key), así los
// componentes internos recargan con el X-Tenant-Id correcto sin threading.
// La pestaña "Mi perfil" es de la PERSONA (dueña de la cuenta): sin chips.
// El "＋ Agregar otro negocio" también vive acá (antes estaba en el selector
// del header, que ya no existe).
type Tab = "negocio" | "canales" | "plan" | "perfil";

// La BAJADA cambia con la pestaña (2026-08-18): una sola frase genérica no
// dice nada, y "Mi perfil" traía la suya en un segundo encabezado propio.
const TABS: { id: Tab; label: string; bajada: string }[] = [
  { id: "negocio", label: "Tu negocio", bajada: "Lo que el bot necesita saber para responder por vos." },
  { id: "canales", label: "Canales", bajada: "Conectá tus redes para que LeadAI atienda en cada una." },
  { id: "plan", label: "Plan y consumo", bajada: "Qué incluye tu plan, cuánto llevás usado y cómo atiende el bot." },
  { id: "perfil", label: "Mi perfil", bajada: "Así te ven los negocios que buscan vendedores." },
];

function ConfiguracionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listo, setListo] = useState(false);
  const [tab, setTab] = useState<Tab>("negocio");
  // TODOS los negocios del usuario (sesión), no solo captación: un
  // restaurante también configura sus canales/plan desde acá (decisión
  // 2026-07-22: el recorte a captación es solo para AGRUPAR bandejas).
  const [negocios, setNegocios] = useState<NegocioBandeja[]>([]);
  const [tenantCfg, setTenantCfg] = useState("");

  useEffect(() => {
    setNegocios(
      (leerSesion()?.empresas ?? []).map((e) => ({ tenantId: e.tenantId, nombre: e.nombre })),
    );
  }, []);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  // /configuracion?tab=perfil (redirección de la vieja /mi-perfil).
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "perfil" || t === "canales" || t === "plan" || t === "negocio") setTab(t);
  }, [searchParams]);

  useEffect(() => {
    if (negocios.length === 0 || tenantCfg) return;
    const activa = leerEmpresaActiva();
    const valida =
      activa && activa !== EMPRESA_GLOBAL && negocios.some((n) => n.tenantId === activa);
    const elegido = valida ? (activa as string) : negocios[0].tenantId;
    guardarEmpresaActiva(elegido);
    setTenantCfg(elegido);
  }, [negocios, tenantCfg]);

  function elegirNegocio(t: string) {
    guardarEmpresaActiva(t);
    setTenantCfg(t);
  }

  if (!listo) return null;

  const tabDeNegocio = tab !== "perfil";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Ajustes</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Configuración</h1>
          {/* Una bajada, como en Carta: el H1 solo no dice qué se hace acá. */}
          <p className="mt-1 text-[0.92rem] text-frio">
            {TABS.find((t) => t.id === tab)?.bajada}
          </p>
        </div>
        <button
          onClick={() => router.push("/bienvenida?agregar=1")}
          className="rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
        >
          ＋ Agregar otro negocio
        </button>
      </header>

      {/* Pestañas como SEGMENTOS, el mismo control que usa Carta (2026-08-18):
          el subrayado fino que había antes no se leía como algo tocable, y en
          celular obligaba a adivinar cuál estaba activa. */}
      {/* En celular las cuatro no entran: hacen scroll y un degradado al borde
          derecho avisa que hay más (si no, "Mi perfil" simplemente no existe
          para quien no se le ocurra deslizar). */}
      <nav className="relative flex gap-1 overflow-x-auto rounded-tarjeta bg-carta p-1 ring-1 ring-linea [scrollbar-width:none] after:pointer-events-none after:sticky after:right-0 after:-ml-8 after:h-9 after:w-8 after:shrink-0 after:bg-gradient-to-l after:from-carta after:to-transparent sm:after:hidden [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const activa = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-[0.9rem] font-semibold transition ${
                activa ? "bg-brasa text-sobre-brasa" : "text-tinta-2 hover:bg-arena"
              }`}
              aria-current={activa ? "page" : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Chips de negocio — solo en pestañas de negocio y con 2+ negocios */}
      {tabDeNegocio && (
        <BarraNegociosGlobal negocios={negocios} enfocado={tenantCfg} onElegir={elegirNegocio} />
      )}

      {/* Contenido. Las pestañas de negocio esperan a que el negocio esté
          resuelto y se remontan (key) al cambiarlo. */}
      {tabDeNegocio && !tenantCfg && null}
      {tabDeNegocio && tenantCfg && (
        /* SIN tarjeta contenedora (2026-08-18). Antes esto era una <section>
           blanca y adentro cada bloque era OTRA tarjeta blanca con borde: tres
           capas de la misma superficie, y nada con más peso que lo demás. Cada
           bloque es ahora su propia tarjeta sobre el fondo arena, como en Carta.

           Los <h2> "Tu negocio" / "Tus redes" / "Tu plan y consumo" también se
           fueron: repetían la pestaña activa, que está tres centímetros arriba. */
        <div key={tenantCfg} className="space-y-5">
          {tab === "negocio" && (
            <>
              <PlaybookEditor />
              <EtapasEditor />
              <RitmoSeguimiento />
            </>
          )}

          {tab === "canales" && (
            <Seccion
              titulo="Por dónde te escriben"
              bajada="Conectá tus redes para que LeadAI atienda por vos en cada una."
              acento
            >
              <PanelCanales />
            </Seccion>
          )}

          {tab === "plan" && (
            <>
              <PlanConsumo />
              <ConfigComision />
            </>
          )}
        </div>
      )}

      {tab === "perfil" && <MiPerfilVendedorPanel />}
    </div>
  );
}

// useSearchParams exige Suspense en el prerender de Next (App Router).
export default function ConfiguracionPanel() {
  return (
    <Suspense fallback={null}>
      <ConfiguracionInner />
    </Suspense>
  );
}
