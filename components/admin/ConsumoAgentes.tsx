"use client";

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  AGENTES_CONSUMO, filtrarNegocios, importePresupuesto, usdVisible,
  type AgenteConsumo, type NegocioConsumo, type InformeConsumo, type ConfiguracionPresupuesto,
} from '@/lib/consumo-agentes';

const campo = 'mt-1 w-full rounded-xl border border-linea bg-carta px-3 py-2 text-sm text-tinta disabled:opacity-50';
const boton = 'rounded-xl bg-brasa px-4 py-2 text-sm font-semibold text-carta disabled:opacity-50';
const ORIGENES = { bot_real: 'Bot real', prueba: 'Pruebas', panel: 'Panel', desconocido: 'Sin atribución' } as const;
const ESTADOS = { sin_presupuesto: 'Sin presupuesto', sin_datos: 'Sin datos', incompleto: 'Medición incompleta', normal: 'Dentro del presupuesto', advertencia: 'Umbral del 80% alcanzado', excedido: 'Presupuesto alcanzado o superado' };

export function ConsumoAgentes() {
  const [negocios, setNegocios] = useState<NegocioConsumo[]>([]);
  const [lista, setLista] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [intento, setIntento] = useState(0);
  const [agente, setAgente] = useState<AgenteConsumo>('sania');
  const [busqueda, setBusqueda] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    let vigente = true;
    api<NegocioConsumo[]>('/admin/negocios', { conEmpresa: false })
      .then(datos => { if (vigente) { setNegocios(datos); setLista('ok'); } })
      .catch(() => { if (vigente) setLista('error'); });
    return () => { vigente = false; };
  }, [intento]);
  const visibles = filtrarNegocios(negocios, agente, busqueda);
  const elegido = visibles.find(n => n.id === tenantId);
  const mesValido = /^[2-9]\d{3}-(0[1-9]|1[0-2])$/.test(mes) && !mes.startsWith('9999-');
  return (
    <section aria-labelledby="titulo-consumo" className="space-y-4 rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <header>
        <h2 id="titulo-consumo" className="text-xl font-bold text-tinta">Consumo y presupuesto por agente</h2>
        <p className="mt-1 text-sm text-frio">Economía interna de plataforma. No visible para clínicas ni pacientes.</p>
      </header>
      <fieldset disabled={guardando} className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Filtros del informe</legend>
        <label className="text-sm text-tinta-2">Agente
          <select className={campo} value={agente} onChange={e => { setAgente(e.target.value as AgenteConsumo); setTenantId(''); setBusqueda(''); }}>
            {AGENTES_CONSUMO.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm text-tinta-2">Mes (UTC)
          <input type="month" min="2000-01" max="9998-12" className={campo} value={mes} onChange={e => setMes(e.target.value)} />
        </label>
        <label className="text-sm text-tinta-2">Buscar clínica o negocio
          <input type="search" className={campo} value={busqueda} onChange={e => { setBusqueda(e.target.value); setTenantId(''); }} placeholder="Ej.: DALU" />
        </label>
        <label className="text-sm text-tinta-2">Clínica / negocio
          <select className={campo} disabled={lista !== 'ok'} value={elegido?.id ?? ''} onChange={e => setTenantId(e.target.value)}>
            <option value="">Selecciona una clínica o negocio</option>
            {visibles.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </label>
      </fieldset>
      {lista === 'cargando' ? <p role="status" className="text-sm text-frio">Cargando negocios…</p> : null}
      {lista === 'error' ? <div role="alert"><p>No pudimos cargar los negocios. Comprueba tu sesión.</p><button className={boton} onClick={() => { setLista('cargando'); setIntento(i => i + 1); }}>Reintentar lista</button></div> : null}
      {lista === 'ok' && visibles.length === 0 ? <p className="text-sm text-frio">No hay negocios que coincidan con estos filtros.</p> : null}
      {!mesValido ? <p role="alert">Selecciona un mes válido.</p> : null}
      {lista === 'ok' && elegido && mesValido ? (
        <DetalleConsumo key={`${elegido.id}:${mes}`} negocio={elegido} mes={mes} onGuardando={setGuardando} />
      ) : null}
    </section>
  );
}

function DetalleConsumo({ negocio, mes, onGuardando }: { negocio: NegocioConsumo; mes: string; onGuardando: (valor: boolean) => void }) {
  const [informe, setInforme] = useState<InformeConsumo | null>(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [importe, setImporte] = useState('');
  const [sinPresupuesto, setSinPresupuesto] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [requiereRecarga, setRequiereRecarga] = useState(false);
  const [mensaje, setMensaje] = useState('');
  useEffect(() => {
    let vigente = true;
    const q = new URLSearchParams({ tenantId: negocio.id, mes });
    api<InformeConsumo>(`/admin/consumo-llm?${q}`, { conEmpresa: false }).then(datos => {
      if (!vigente) return;
      if (datos.configuracion.tenantId !== negocio.id || datos.configuracion.mes !== mes || datos.resumen.tenantId !== negocio.id || datos.resumen.mes !== mes) throw new Error('Informe de otra selección');
      setInforme(datos); setSinPresupuesto(datos.configuracion.presupuestoUsd === null);
      setImporte(datos.configuracion.presupuestoUsd ?? '');
    }).catch(e => {
      if (vigente) setError(e instanceof ApiError ? e.message : 'Medición no disponible. No se mostrará un gasto cero por error.');
    });
    return () => { vigente = false; };
  }, [negocio.id, mes, recarga]);

  async function guardar() {
    if (!informe || guardando || requiereRecarga) return;
    let presupuestoUsd: string | null;
    try { presupuestoUsd = importePresupuesto(importe, sinPresupuesto); }
    catch (e) { setError((e as Error).message); return; }
    setGuardando(true); onGuardando(true); setError(''); setMensaje('');
    try {
      await api<ConfiguracionPresupuesto>('/admin/presupuesto-llm', {
        method: 'PUT', conEmpresa: false,
        body: { tenantId: negocio.id, mes, presupuestoUsd, revisionEsperada: informe.configuracion.revisionMes },
      });
      // Recargar explícitamente: el resumen anterior ya no corresponde al presupuesto nuevo.
      setRequiereRecarga(true); setMensaje('Presupuesto guardado. Recarga el informe para ver el estado actualizado.');
    } catch (e) {
      setRequiereRecarga(true);
      setError(e instanceof ApiError && e.status === 409
        ? 'Otra persona cambió el presupuesto. Tu edición sigue aquí; recarga para revisar el valor vigente antes de guardar otra vez.'
        : 'No se pudo confirmar el guardado. Tu edición se conserva; recarga para verificar el valor antes de reintentar.');
    } finally { setGuardando(false); onGuardando(false); }
  }
  const resumen = informe?.resumen;
  const cerrado = mes < new Date().toISOString().slice(0, 7);
  return (
    <div className="space-y-4 border-t border-linea pt-4">
      <h3 className="font-bold text-tinta">{negocio.nombre} · {mes} UTC</h3>
      {error ? <p role="alert" className="rounded-xl bg-arena p-3 text-sm text-tinta">{error}</p> : null}
      {mensaje ? <p role="status" className="text-sm text-tinta">{mensaje}</p> : null}
      {!informe && !error ? <p role="status">Consultando consumo…</p> : null}
      <button type="button" className="text-sm font-semibold text-brasa disabled:opacity-50" disabled={guardando} onClick={() => {
        setInforme(null); setError(''); setMensaje(''); setRequiereRecarga(false); setRecarga(i => i + 1);
      }}>Recargar informe (descarta edición)</button>
      {informe && resumen ? <>
        <p className="text-xs text-frio">Actualizado: {informe.generadoEn} · {requiereRecarga ? 'Informe anterior; pendiente de recarga' : 'Datos del backend'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-arena p-4"><p className="text-sm text-frio">Gasto LLM conocido</p><p className="break-all text-xl font-bold">{usdVisible(resumen.gastoConocidoUsd)}</p></div>
          <div className="rounded-xl bg-arena p-4"><p className="text-sm text-frio">Presupuesto vigente</p><p className="break-all text-xl font-bold">{informe.configuracion.presupuestoUsd === null ? 'Sin presupuesto' : usdVisible(informe.configuracion.presupuestoUsd)}</p></div>
        </div>
        <p className="text-sm">{ESTADOS[resumen.estado]}{resumen.porcentajeUsado !== null ? ` · ${resumen.porcentajeUsado}% usado` : ''}</p>
        <p className="text-sm text-frio">Cobertura: {resumen.cobertura === 'completa_eventos' ? 'eventos registrados calculables' : resumen.cobertura === 'parcial' ? 'parcial; el gasto real puede ser mayor' : 'sin datos suficientes'}. {resumen.eventosCalculables} de {resumen.eventosRegistrados} llamadas calculables; {resumen.llamadasHistoricasSinDetalle} llamadas históricas sin detalle.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Desglose por procedencia de las llamadas</caption>
            <thead><tr className="border-b border-linea"><th className="py-2">Origen</th><th>Llamadas</th><th>Gasto conocido</th></tr></thead>
            <tbody>{Object.entries(ORIGENES).map(([origen, etiqueta]) => {
              const d = resumen.porOrigen[origen as keyof typeof ORIGENES];
              return <tr key={origen} className="border-b border-linea"><th className="py-2 font-normal">{etiqueta}</th><td>{d.eventosRegistrados}</td><td>{usdVisible(d.gastoConocidoUsd)}</td></tr>;
            })}</tbody>
          </table>
        </div>
        <div className="space-y-2"><h4 className="font-semibold">Avisos internos</h4>
          {!informe.alertasImplementadas ? <p className="text-sm">Entrega de avisos no disponible.</p> : informe.avisos === null ? <p className="text-sm">No se pudieron consultar los avisos.</p> : informe.avisos.length === 0 ? <p className="text-sm text-frio">Sin avisos registrados. La comprobación es periódica.</p> : informe.avisos.map(a => <p key={a.umbral} className="text-sm">{a.umbral}% · {a.entregado ? 'Entrega registrada' : 'No entregado; sin reintento automático'} · {usdVisible(a.gastoUsd)} al emitir · {a.creadoEn}</p>)}
        </div>
        <form className="space-y-3 rounded-xl border border-linea p-4" onSubmit={e => { e.preventDefault(); void guardar(); }}>
          <h4 className="font-semibold">Presupuesto interno mensual</h4>
          <fieldset disabled={guardando || cerrado || requiereRecarga} className="space-y-2">
            <legend className="sr-only">Editar presupuesto</legend>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sinPresupuesto} onChange={e => setSinPresupuesto(e.target.checked)} />Sin presupuesto</label>
            <label className="block text-sm">Importe en USD<input className={campo} inputMode="decimal" disabled={sinPresupuesto} value={importe} onChange={e => setImporte(e.target.value)} placeholder="Ej.: 10.50" /></label>
            <button className={boton} type="submit">{guardando ? 'Guardando…' : 'Guardar presupuesto'}</button>
          </fieldset>
          <p className="text-xs text-frio">{cerrado ? 'Mes cerrado: solo consulta. ' : ''}Se aplica desde el mes seleccionado hasta el siguiente cambio. Cero es distinto de «Sin presupuesto». No detiene el bot ni cambia planes o cupos.</p>
        </form>
        <p className="text-xs text-frio">Estimación del gasto LLM, no factura ni ganancia neta. No incluye Meta, audio/transcripción o infraestructura. Las respuestas determinísticas no gastan LLM, pero pueden contar como atención.</p>
      </> : null}
    </div>
  );
}
