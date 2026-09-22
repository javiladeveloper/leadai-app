"use client";
import { useEffect, useState } from "react";
import { leerSesion, type EmpresaResumen } from "../../lib/auth";
const DESTINO = "https://leadai-inmobiliaria-demo.vercel.app";
export default function AccesoInmobiliaria() {
  const [empresas, setEmpresas] = useState<EmpresaResumen[]>([]);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);
  useEffect(() => { setEmpresas(leerSesion()?.empresas.filter(e => ["owner", "admin"].includes(e.rol)) ?? []); }, []);
  async function conectar(tenantId: string) {
    setOcupado(true); setError("");
    try {
      const q = new URLSearchParams(location.search);
      const challenge = q.get("challenge"), state = q.get("state");
      if (!window.opener || !challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge) || !state || !/^[a-f0-9]{64}$/.test(state)) throw new Error("Abre este acceso desde la web de la demo.");
      const sesion = leerSesion();
      if (!sesion) throw new Error("Inicia sesión en LeadAI y vuelve a abrir el acceso desde la demo.");
      const respuesta = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "https://api.leadai-pe.com"}/demo/inmobiliaria/ticket`, {
        method: "POST", headers: { Authorization: `Bearer ${sesion.token}`, "X-Tenant-Id": tenantId, "Content-Type": "application/json" }, body: JSON.stringify({ challenge }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.mensaje ?? "Este negocio no tiene habilitada la demo.");
      window.opener.postMessage({ tipo: "inmobiliaria-ticket", ticket: datos.ticket, state }, DESTINO);
      setListo(true);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo conectar."); }
    finally { setOcupado(false); }
  }
  return <main className="mx-auto max-w-lg p-8 space-y-6">
    <h1 className="text-2xl font-bold">Conectar con Habita</h1>
    <p>Autoriza acceso únicamente al espacio inmobiliario demo. No se comparte tu sesión general ni se activan mensajes automáticamente.</p>
    {listo ? <p role="status">Acceso autorizado. Puedes volver a la pestaña de la demo.</p> : empresas.length ? empresas.map(e =>
      <button key={e.tenantId} disabled={ocupado} onClick={() => void conectar(e.tenantId)} className="block w-full rounded-xl border p-4 text-left disabled:opacity-50">Continuar con {e.nombre}</button>) : <p>Primero <a className="underline" href="/" target="_blank" rel="noreferrer">inicia sesión en LeadAI</a>. Después vuelve a abrir el acceso desde Habita.</p>}
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
  </main>;
}
