"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { miPerfilVendedor, guardarPerfilVendedor, type PerfilVendedor } from "@/lib/api";
import { RUBROS } from "@/lib/rubros";

const inputCls =
  "w-full rounded-tarjeta border border-linea bg-carta px-3.5 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa";

export default function MiPerfilPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [perfil, setPerfil] = useState<PerfilVendedor | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  useEffect(() => {
    if (!listo) return;
    miPerfilVendedor().then((p) => { setPerfil(p); setCargando(false); });
  }, [listo]);

  function set<K extends keyof PerfilVendedor>(campo: K, valor: PerfilVendedor[K]) {
    setPerfil((p) => (p ? { ...p, [campo]: valor } : p));
  }

  function toggleRubro(id: string) {
    if (!perfil) return;
    const tiene = perfil.rubros.includes(id);
    set("rubros", tiene ? perfil.rubros.filter((r) => r !== id) : [...perfil.rubros, id]);
  }

  async function guardar() {
    if (!perfil) return;
    setGuardando(true);
    const r = await guardarPerfilVendedor({
      bio: perfil.bio, aniosExp: perfil.aniosExp, rubros: perfil.rubros,
      instagram: perfil.instagram, linkedin: perfil.linkedin, whatsapp: perfil.whatsapp,
      publico: perfil.publico,
    });
    setGuardando(false);
    if (r.ok) { setOk(true); setTimeout(() => setOk(false), 1800); }
  }

  if (!listo) return null;
  if (cargando || !perfil) return <div className="p-8 text-frio">Cargando…</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Marketplace</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Mi perfil de vendedor</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Así te ven los negocios que buscan vendedores. Un buen perfil te consigue más oportunidades.
        </p>
      </header>

      {/* Métricas reales */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-tarjeta bg-carta p-4 text-center ring-1 ring-linea">
          <p className="text-2xl font-bold text-ok">{perfil.ventasCerradas}</p>
          <p className="text-[0.78rem] text-frio">Ventas cerradas</p>
        </div>
        <div className="flex-1 rounded-tarjeta bg-carta p-4 text-center ring-1 ring-linea">
          <p className="text-2xl font-bold text-tinta">{perfil.aniosExp}</p>
          <p className="text-[0.78rem] text-frio">Años de experiencia</p>
        </div>
      </div>

      {/* Visible en el marketplace */}
      <label className="flex items-center gap-3 rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
        <input
          type="checkbox"
          checked={perfil.publico}
          onChange={(e) => set("publico", e.target.checked)}
          className="h-5 w-5 accent-brasa"
        />
        <span>
          <span className="block font-semibold text-tinta">Aparecer en el marketplace</span>
          <span className="block text-[0.8rem] text-frio">Si lo activás, los negocios pueden encontrarte y darte oportunidades.</span>
        </span>
      </label>

      <div className="space-y-4 rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-tinta">Sobre vos</span>
          <textarea value={perfil.bio} onChange={(e) => set("bio", e.target.value)} rows={3}
            placeholder="Ej: Vendedora con experiencia promocionando servicios contables. Consigo clientes por WhatsApp e Instagram."
            className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-tinta">Años de experiencia</span>
          <input type="number" min={0} max={80} value={perfil.aniosExp}
            onChange={(e) => set("aniosExp", Number(e.target.value) || 0)} className={inputCls} />
        </label>

        <div>
          <span className="mb-2 block text-sm font-medium text-tinta">Rubros en los que sos bueno/a</span>
          <div className="flex flex-wrap gap-2">
            {RUBROS.filter((r) => r.id !== "otro").map((r) => {
              const activo = perfil.rubros.includes(r.id);
              return (
                <button key={r.id} type="button" onClick={() => toggleRubro(r.id)}
                  className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold transition ${
                    activo ? "bg-brasa text-carta" : "bg-arena text-tinta-2 ring-1 ring-linea"
                  }`}>
                  {r.emoji} {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">Instagram</span>
            <input value={perfil.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@usuario" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">LinkedIn</span>
            <input value={perfil.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="link o usuario" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">WhatsApp</span>
            <input value={perfil.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+51 9xx…" className={inputCls} />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={guardar} disabled={guardando}
          className="rounded-tarjeta bg-brasa px-6 py-3 font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar mi perfil"}
        </button>
        {ok && <span className="text-sm font-semibold text-ok">Guardado ✓</span>}
      </div>
    </div>
  );
}
