"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { haySesion, leerEmpresaActiva, guardarEmpresaActiva, EMPRESA_GLOBAL } from "@/lib/auth";
import { PlaybookEditor } from "@/components/panel/PlaybookEditor";
import { RitmoSeguimiento } from "@/components/panel/RitmoSeguimiento";
import { PanelCanales } from "@/components/panel/PanelCanales";
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

const TABS: { id: Tab; label: string }[] = [
  { id: "negocio", label: "Tu negocio" },
  { id: "canales", label: "Canales" },
  { id: "plan", label: "Plan y consumo" },
  { id: "perfil", label: "Mi perfil" },
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
        </div>
        <button
          onClick={() => router.push("/bienvenida?agregar=1")}
          className="rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
        >
          ＋ Agregar otro negocio
        </button>
      </header>

      {/* Pestañas */}
      <div className="flex gap-1 overflow-x-auto border-b border-linea [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const activa = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 px-4 py-2.5 text-[0.92rem] font-semibold transition-colors ${
                activa ? "text-brasa" : "text-frio hover:text-tinta-2"
              }`}
              aria-current={activa ? "page" : undefined}
            >
              {t.label}
              {activa && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brasa" />
              )}
            </button>
          );
        })}
      </div>

      {/* Chips de negocio — solo en pestañas de negocio y con 2+ negocios */}
      {tabDeNegocio && (
        <BarraNegociosGlobal negocios={negocios} enfocado={tenantCfg} onElegir={elegirNegocio} />
      )}

      {/* Contenido. Las pestañas de negocio esperan a que el negocio esté
          resuelto y se remontan (key) al cambiarlo. */}
      {tabDeNegocio && !tenantCfg && null}
      {tabDeNegocio && tenantCfg && (
        <section
          key={tenantCfg}
          className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6"
        >
          {tab === "negocio" && (
            <>
              <h2 className="text-[1.05rem] font-bold text-tinta">Tu negocio</h2>
              <p className="mb-4 text-[0.82rem] text-frio">
                El playbook que usa la IA para responder por vos: tono, catálogo, preguntas clave y objeciones.
              </p>
              <PlaybookEditor />
              <RitmoSeguimiento />
            </>
          )}

          {tab === "canales" && (
            <>
              <h2 className="text-[1.05rem] font-bold text-tinta">Tus redes</h2>
              <p className="mb-4 text-[0.82rem] text-frio">
                Conectá tus redes para que LeadAI atienda por vos en cada una.
              </p>
              <PanelCanales />
            </>
          )}

          {tab === "plan" && (
            <>
              <h2 className="text-[1.05rem] font-bold text-tinta">Tu plan y consumo</h2>
              <p className="mb-4 text-[0.82rem] text-frio">
                Cuánto te queda, cómo comprar más respuestas y cómo poner límites a tu gasto.
              </p>
              <PlanConsumo />
              <ConfigComision />
            </>
          )}
        </section>
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
