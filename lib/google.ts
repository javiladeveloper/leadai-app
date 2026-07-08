// Integración con Google Identity Services (GIS) del lado del navegador.
// Carga el script de Google, muestra el botón oficial y, cuando el usuario
// elige su cuenta, obtiene un ID token que se manda a POST /auth/google.
//
// Requiere NEXT_PUBLIC_GOOGLE_CLIENT_ID. Sin él, `hayGoogle()` es false y la
// pantalla de login ofrece el modo demo.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function hayGoogle(): boolean {
  return CLIENT_ID.length > 0;
}

interface GoogleGlobal {
  accounts: {
    id: {
      initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

let cargando: Promise<void> | null = null;

// Carga el script de GIS una sola vez.
function cargarScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google) return Promise.resolve();
  if (cargando) return cargando;
  cargando = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar Google"));
    document.head.appendChild(s);
  });
  return cargando;
}

// Renderiza el botón oficial de Google dentro de `contenedor`. Cuando el usuario
// se autentica, llama a `alTener(idToken)` con el ID token para mandarlo al backend.
export async function renderBotonGoogle(
  contenedor: HTMLElement,
  alTener: (idToken: string) => void,
): Promise<void> {
  if (!hayGoogle()) return;
  await cargarScript();
  const g = window.google;
  if (!g) return;
  g.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (r) => alTener(r.credential),
  });
  g.accounts.id.renderButton(contenedor, {
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    locale: "es",
    width: 320,
  });
}
