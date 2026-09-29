export interface BorradorAnuncioLocal {
  id?: string;
  paso: number;
  objetivo: string;
  campania: string;
  texto: string;
  mediaUrl: string;
  canal: string;
  zona: string;
  edadMin: string;
  edadMax: string;
  total: string;
  dias: string;
  incluir: string[];
  excluir: string[];
  intereses: string[];
}

const clave = (tenant: string) => `leadai:anuncio:v1:${tenant}`;

// Lista explícita: no serializamos imágenes, permisos, sesión ni respuestas API.
function normalizar(valor: unknown): BorradorAnuncioLocal | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as Record<string, unknown>;
  const cadena = (campo: string, defecto = "") => typeof v[campo] === "string" ? (v[campo] as string).slice(0, 5000) : defecto;
  const lista = (campo: string) => Array.isArray(v[campo]) ? v[campo].filter((x): x is string => typeof x === "string").slice(0, 100) : [];
  const media = cadena("mediaUrl");
  return {
    id: cadena("id") || undefined,
    paso: typeof v.paso === "number" && Number.isInteger(v.paso) ? Math.max(0, Math.min(4, v.paso)) : 0,
    objetivo: cadena("objetivo", "mensajes"), campania: cadena("campania"), texto: cadena("texto"),
    mediaUrl: /^https?:\/\//i.test(media) ? media : "",
    canal: cadena("canal", "todos"), zona: cadena("zona", "Todo Perú"),
    edadMin: cadena("edadMin", "18"), edadMax: cadena("edadMax", "55"),
    total: cadena("total", "100"), dias: cadena("dias", "7"),
    incluir: lista("incluir"), excluir: lista("excluir"), intereses: lista("intereses"),
  };
}

export function leerBorradorAnuncio(tenant: string): BorradorAnuncioLocal | null {
  try {
    const json = window.localStorage.getItem(clave(tenant));
    if (!json) return null;
    const dato = JSON.parse(json);
    if (dato.version !== 1 || dato.tenant !== tenant) return null;
    return normalizar(dato.borrador);
  } catch { return null; }
}

export function guardarBorradorAnuncio(tenant: string, borrador: BorradorAnuncioLocal): boolean {
  try {
    window.localStorage.setItem(clave(tenant), JSON.stringify({ version: 1, tenant, borrador: normalizar(borrador) }));
    return true;
  } catch { return false; }
}

export function borrarBorradorAnuncio(tenant: string): boolean {
  try { window.localStorage.removeItem(clave(tenant)); return true; } catch { return false; }
}
