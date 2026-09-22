/**
 * SMOKE TEST CONTRA PRODUCCIÓN (2026-09-22).
 *
 * Tres llamadas reales al día y un aviso si alguna falla. El bug del cuerpo
 * doblemente serializado (los públicos de Meta nunca funcionaron desde el
 * panel) llevaba cinco días sin que nadie lo viera: no había nada que probara
 * el circuito panel → backend con una sesión real.
 *
 * Sin credenciales solo se revisa la salud pública. Con SMOKE_EMAIL y
 * SMOKE_PASSWORD (un usuario de prueba con UN negocio) se recorre el camino
 * que usa el panel: login, mi plan, leads y la revisión de un público —la
 * llamada que estaba rota. No crea nada: `revisar` cuenta y no sube.
 *
 * Uso local:  SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke-prod.mjs
 */
const API = (process.env.SMOKE_API_URL ?? "https://api.leadai-pe.com").replace(/\/$/, "");
const ORIGEN = process.env.SMOKE_ORIGIN ?? "https://app.leadai-pe.com";

const fallos = [];
const ok = (nombre, detalle = "") => console.log(`✔ ${nombre}${detalle ? ` · ${detalle}` : ""}`);
const falla = (nombre, detalle) => { fallos.push(`${nombre}: ${detalle}`); console.log(`✖ ${nombre} · ${detalle}`); };

async function llamar(ruta, { method = "GET", body, token, tenant } = {}) {
  const headers = { "content-type": "application/json", origin: ORIGEN };
  if (token) headers.authorization = `Bearer ${token}`;
  if (tenant) headers["x-tenant-id"] = tenant;
  const r = await fetch(`${API}${ruta}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

// 1) Salud pública: base y Redis vivos.
try {
  const { status, json } = await llamar("/health");
  if (status === 200 && json.status === "ok" && json.db && json.redis) ok("/health", `dlq ${json.dlq}`);
  else falla("/health", `status ${status} ${JSON.stringify(json)}`);
} catch (e) { falla("/health", e.message); }

// 2) El cron de ads sigue llamando a Meta (si se apaga, Meta baja el tier).
try {
  const { status, json } = await llamar("/health/ads");
  if (status !== 200) falla("/health/ads", `status ${status}`);
  else if (json.cuentaPropiaConfigurada && !json.cronVivo) falla("/health/ads", `cron sin lectura hace ${json.haceMinutos} min`);
  else ok("/health/ads", json.cuentaPropiaConfigurada ? `última lectura hace ${json.haceMinutos} min` : "sin cuenta propia");
} catch (e) { falla("/health/ads", e.message); }

// 3) El camino del panel, con una sesión real.
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) {
  console.log("· sin SMOKE_EMAIL/SMOKE_PASSWORD: se omite el recorrido con sesión");
} else {
  let token = "";
  let tenant = "";
  try {
    const { status, json } = await llamar("/auth/login", { method: "POST", body: { email, password } });
    if (status === 200 && json.token) {
      token = json.token;
      tenant = json.empresas?.[0]?.tenantId ?? "";
      ok("/auth/login", `${json.empresas?.length ?? 0} empresas`);
    } else falla("/auth/login", `status ${status} ${json.error ?? ""}`);
  } catch (e) { falla("/auth/login", e.message); }

  if (token && tenant) {
    for (const ruta of ["/mi-plan", "/leads?limit=1", "/uso"]) {
      try {
        const { status, json } = await llamar(ruta, { token, tenant });
        if (status === 200) ok(ruta);
        else falla(ruta, `status ${status} ${json.error ?? ""}`);
      } catch (e) { falla(ruta, e.message); }
    }

    // LA LLAMADA QUE ESTABA ROTA. 200 = bien; 402/403 = sin plan o bloqueado,
    // que es una respuesta válida del candado; 400 = el cuerpo llegó mal.
    try {
      const { status, json } = await llamar("/anuncios/publicos/revisar", {
        method: "POST", token, tenant, body: { telefonos: ["987654321", "987654322"] },
      });
      if (status === 200 && typeof json.contactos === "number") ok("/anuncios/publicos/revisar", `${json.contactos} contactos`);
      else if (status === 402 || status === 403) ok("/anuncios/publicos/revisar", `candado ${status}`);
      else falla("/anuncios/publicos/revisar", `status ${status} ${json.error ?? ""}`);
    } catch (e) { falla("/anuncios/publicos/revisar", e.message); }
  }
}

if (fallos.length) {
  console.log(`\n${fallos.length} fallo(s):\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log("\nTodo en orden.");
