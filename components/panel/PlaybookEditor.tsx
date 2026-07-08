"use client";

import { useEffect, useState } from "react";
import { obtenerPerfil, guardarPerfil, type PerfilNegocio } from "@/lib/api";

const PERFIL_VACIO: PerfilNegocio = {
  rubro: "",
  nombreNegocio: "",
  idioma: "es",
  tono: "",
  propuestaValor: "",
  catalogo: [],
  preguntasClave: [],
  senalesCaliente: [],
  senalesFrio: [],
  objeciones: [],
  politicas: "",
  llamadaAccion: "",
};

type Estado = "cargando" | "idle" | "guardando" | "ok" | "error";

// Editor real del Playbook: carga y guarda contra el backend (`/perfil`). Es
// el "cerebro" que usa la IA para responder — nombre, tono, catálogo,
// preguntas clave y objeciones que el negocio quiere que maneje.
export function PlaybookEditor() {
  const [perfil, setPerfil] = useState<PerfilNegocio>(PERFIL_VACIO);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    obtenerPerfil().then((p) => {
      if (cancelado) return;
      if (p) setPerfil({ ...PERFIL_VACIO, ...p });
      setEstado("idle");
    });
    return () => {
      cancelado = true;
    };
  }, []);

  async function guardar() {
    setEstado("guardando");
    setError("");
    const r = await guardarPerfil(perfil.rubro || "general", perfil);
    if (r.ok) setEstado("ok");
    else {
      setEstado("error");
      setError(r.error ?? "No se pudo guardar");
    }
  }

  if (estado === "cargando") return <p className="text-frio">Cargando…</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Campo
          label="Nombre del negocio"
          value={perfil.nombreNegocio}
          onChange={(v) => setPerfil({ ...perfil, nombreNegocio: v })}
        />
        <Campo
          label="Rubro"
          value={perfil.rubro}
          onChange={(v) => setPerfil({ ...perfil, rubro: v })}
        />
      </div>

      <CampoArea
        label="Tono de la IA"
        value={perfil.tono}
        onChange={(v) => setPerfil({ ...perfil, tono: v })}
        placeholder="Ej: cercano, directo, con humor peruano, sin tecnicismos…"
      />
      <CampoArea
        label="Propuesta de valor"
        value={perfil.propuestaValor}
        onChange={(v) => setPerfil({ ...perfil, propuestaValor: v })}
        placeholder="¿Qué te hace distinto? ¿Por qué te eligen a vos?"
      />

      <ListaCatalogo
        catalogo={perfil.catalogo}
        onChange={(catalogo) => setPerfil({ ...perfil, catalogo })}
      />
      <ListaSimple
        titulo="Preguntas clave"
        descripcion="Lo que la IA pregunta antes de avisarte de un lead caliente"
        placeholder="¿Para cuándo lo necesitás?"
        valores={perfil.preguntasClave}
        onChange={(preguntasClave) => setPerfil({ ...perfil, preguntasClave })}
      />
      <ListaObjeciones
        objeciones={perfil.objeciones}
        onChange={(objeciones) => setPerfil({ ...perfil, objeciones })}
      />

      <CampoArea
        label="Políticas (envíos, horarios, pagos)"
        value={perfil.politicas}
        onChange={(v) => setPerfil({ ...perfil, politicas: v })}
      />
      <CampoArea
        label="Llamada a la acción"
        value={perfil.llamadaAccion}
        onChange={(v) => setPerfil({ ...perfil, llamadaAccion: v })}
        placeholder="Ej: invitá a agendar una llamada o a visitar la tienda"
      />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={guardar}
          disabled={estado === "guardando"}
          className="rounded-full bg-brasa px-6 py-2.5 text-sm font-semibold text-carta hover:bg-brasa-hondo disabled:opacity-60"
        >
          {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
        {estado === "ok" && <p className="text-sm font-medium text-ok">Guardado ✓</p>}
        {estado === "error" && <p className="text-sm text-brasa">{error}</p>}
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-sm text-tinta outline-none focus:border-brasa"
      />
    </label>
  );
}

function CampoArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-sm text-tinta outline-none focus:border-brasa"
      />
    </label>
  );
}

// Lista editable de strings simples (preguntas clave), con agregar/quitar fila.
function ListaSimple({
  titulo,
  descripcion,
  placeholder,
  valores,
  onChange,
}: {
  titulo: string;
  descripcion?: string;
  placeholder?: string;
  valores: string[];
  onChange: (v: string[]) => void;
}) {
  function actualizar(i: number, v: string) {
    const copia = [...valores];
    copia[i] = v;
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(valores.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...valores, ""]);
  }

  return (
    <div className="rounded-xl border border-linea bg-arena/40 p-4">
      <p className="text-sm font-medium text-tinta">{titulo}</p>
      {descripcion && <p className="mb-2 text-xs text-frio">{descripcion}</p>}
      <div className="space-y-2">
        {valores.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={v}
              onChange={(e) => actualizar(i, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa"
      >
        + Agregar
      </button>
    </div>
  );
}

// Catálogo: nombre, descripción y precio por fila.
function ListaCatalogo({
  catalogo,
  onChange,
}: {
  catalogo: PerfilNegocio["catalogo"];
  onChange: (v: PerfilNegocio["catalogo"]) => void;
}) {
  function actualizar(i: number, campo: "nombre" | "descripcion" | "precio", v: string) {
    const copia = catalogo.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it));
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(catalogo.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...catalogo, { nombre: "", descripcion: "", precio: "" }]);
  }

  return (
    <div className="rounded-xl border border-linea bg-arena/40 p-4">
      <p className="text-sm font-medium text-tinta">Catálogo</p>
      <p className="mb-2 text-xs text-frio">Productos o servicios que ofrece el negocio</p>
      <div className="space-y-3">
        {catalogo.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-carta p-3 ring-1 ring-linea sm:grid-cols-[1fr_1fr_auto_auto]">
            <input
              value={item.nombre}
              onChange={(e) => actualizar(i, "nombre", e.target.value)}
              placeholder="Nombre"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.descripcion ?? ""}
              onChange={(e) => actualizar(i, "descripcion", e.target.value)}
              placeholder="Descripción"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.precio ?? ""}
              onChange={(e) => actualizar(i, "precio", e.target.value)}
              placeholder="Precio"
              className="w-full rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa sm:w-28"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa"
      >
        + Agregar producto
      </button>
    </div>
  );
}

// Objeciones: objeción + respuesta sugerida por fila.
function ListaObjeciones({
  objeciones,
  onChange,
}: {
  objeciones: PerfilNegocio["objeciones"];
  onChange: (v: PerfilNegocio["objeciones"]) => void;
}) {
  function actualizar(i: number, campo: "objecion" | "respuesta", v: string) {
    const copia = objeciones.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it));
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(objeciones.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...objeciones, { objecion: "", respuesta: "" }]);
  }

  return (
    <div className="rounded-xl border border-linea bg-arena/40 p-4">
      <p className="text-sm font-medium text-tinta">Objeciones frecuentes</p>
      <p className="mb-2 text-xs text-frio">Qué suele frenar la venta y cómo responderlo</p>
      <div className="space-y-3">
        {objeciones.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-carta p-3 ring-1 ring-linea sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={item.objecion}
              onChange={(e) => actualizar(i, "objecion", e.target.value)}
              placeholder="Ej: Está caro"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.respuesta}
              onChange={(e) => actualizar(i, "respuesta", e.target.value)}
              placeholder="Cómo responder"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa"
      >
        + Agregar objeción
      </button>
    </div>
  );
}
