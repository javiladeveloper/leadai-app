/**
 * LOS ERRORES DE META, EN CASTELLANO Y CON LA SALIDA (2026-08-30).
 *
 * Reporte de Jonathan, en vivo con una clienta: "este problema puede pasar a
 * muchas personas que intenten entrar a nuestra herramienta... necesito que la
 * conexión de dispositivos sea lo más sencillo posible, recuerda que no son
 * personas técnicas".
 *
 * El diálogo de Meta habla en su idioma: "El número de teléfono que ingresaste
 * no está asociado con la empresa que seleccionaste (#3441062)". Un dueño de
 * restaurante lee eso y concluye que LeadAI está roto — y abandona. La verdad
 * es que su número ya está reclamado por otro portfolio suyo y se destraba en
 * dos toques desde su celular.
 *
 * Lo que se traduce NO es el texto crudo (ese aparece dentro del popup de
 * Meta, donde no llegamos): es el error que vuelve al backend cuando la
 * conexión falla. Acá se convierte en qué le pasó y qué hacer ahora.
 */

export interface ErrorTraducido {
  /** Qué pasó, en una línea, sin jerga. */
  titulo: string;
  /** Qué hacer ahora. Pasos concretos, no "contacta soporte". */
  pasos: string[];
  /** Si el problema se resuelve reintentando, se ofrece el botón. */
  reintentable: boolean;
}

/**
 * Cada entrada: los fragmentos que delatan el error (en minúsculas, tal como
 * llegan de Meta o del backend) y qué mostrar.
 *
 * El orden importa: gana la primera que matchea, así que van de lo más
 * específico a lo más general.
 */
const CONOCIDOS: { pistas: string[]; error: ErrorTraducido }[] = [
  {
    // El caso de la clienta: su número ya vive en otro portfolio de Meta,
    // normalmente uno que se creó solo al configurar WhatsApp Business.
    pistas: ['no está asociado', 'not associated', '3441062', 'already', 'ya está registrado', 'desvincular'],
    error: {
      // EL CONSEJO SE REESCRIBIÓ DOS VECES (2026-08-31), y esta versión sale
      // de investigar un caso real de punta a punta.
      //
      // Primero decía "desvincula el número desde tu app". Comprobado en vivo:
      // NO aplica. Revisamos el celular de la clienta y su app ni siquiera lo
      // veía conectado — no había nada que desvincular. También revisamos los
      // dos portfolios de Meta (el de ella y el nuestro): los dos vacíos.
      //
      // La causa está en la doc de Meta: un número con "credit line
      // arrangements from previous partners" queda atado a ese proveedor
      // aunque no aparezca en ningún portfolio visible. Y no hay forma de
      // averiguar CUÁL — la API no deja consultar el dueño de un número ajeno.
      //
      // Por eso los pasos apuntan al proveedor anterior, y el último somos
      // nosotros: es lo único que el dueño no puede resolver solo.
      titulo: 'Ese número ya está tomado por otro servicio',
      pasos: [
        '¿Usaste este número con otro chatbot, CRM o agencia? Pídeles que lo liberen',
        'Si no recuerdas ninguno, escríbenos: abrimos el caso con Meta por ti',
        'Mientras tanto puedes seguir configurando tu negocio con normalidad',
      ],
      reintentable: true,
    },
  },
  {
    // Pasa seguido: el dueño cierra el popup a mitad, o se pierde en un paso.
    pistas: ['no llegó a completarse', 'wabaid', 'waba_id', 'no se pudo resolver la cuenta'],
    error: {
      titulo: 'La conexión quedó a medias',
      pasos: [
        'Vuelve a intentar sin cerrar la ventana de Meta',
        'Completa todos sus pasos hasta el final',
        'Si te pide un código, revisa los SMS de ese número',
      ],
      reintentable: true,
    },
  },
  {
    // El diálogo lleva mucho abierto: Meta vence la sesión y todo falla raro.
    pistas: ['session', 'sesión', 'expired', 'vencid', 'code was already used', 'invalid code'],
    error: {
      titulo: 'La ventana de Meta se venció',
      pasos: [
        'Cierra la ventana de Meta si sigue abierta',
        'Vuelve a tocar Conectar y hazlo de corrido',
      ],
      reintentable: true,
    },
  },
  {
    // Cuenta sin permisos sobre ese número: lo maneja otra persona.
    pistas: ['permission', 'permiso', 'not authorized', 'no autorizado', 'admin'],
    error: {
      titulo: 'Tu cuenta de Facebook no administra ese número',
      pasos: [
        'Entra con la cuenta de Facebook que creó ese WhatsApp Business',
        'O pide a quien lo administra que te dé acceso en Meta Business',
      ],
      reintentable: true,
    },
  },
  {
    /**
     * EL BACKEND YA PREGUNTÓ QUÉ FALTA (2026-08-31).
     *
     * Cuando la conexión muere sin resolver la WABA, el backend le consulta a
     * Meta el portfolio del dueño con su propio token —el único momento en que
     * lo tenemos— y devuelve la causa concreta en vez de un genérico.
     *
     * Este mensaje NO se reescribe: ya viene con el nombre del portfolio del
     * dueño adentro ("tu portfolio X no tiene página"), que es más útil que
     * cualquier texto fijo que pudiéramos poner acá.
     */
    pistas: ['página de facebook', 'pagina de facebook'],
    error: {
      titulo: 'Falta una página de Facebook en tu portfolio',
      pasos: [
        'Créala en facebook.com/pages/create — es gratis y no necesitas publicar nada',
        'Ponle el nombre de tu negocio y elige la categoría que más se parezca',
        'Vuelve acá y toca "Intentar de nuevo"',
      ],
      reintentable: true,
    },
  },
  {
    pistas: ['url', 'sitio web', 'website'],
    error: {
      titulo: 'Meta pide un sitio web válido',
      pasos: [
        'Puedes usar tu página de Facebook o tu Instagram',
        'Tiene que empezar con https://',
        'Si no tienes ninguno, usa https://leadai-pe.com',
      ],
      reintentable: true,
    },
  },
];

/**
 * El que se muestra cuando no reconocemos el error.
 *
 * EL PRIMER PASO ES LA CAUSA MÁS COMÚN, NO UN "reintenta" (2026-08-31).
 *
 * Diagnosticado con dos casos en vivo y el MISMO número: desde un portfolio
 * comercial con página de Facebook llegó hasta el último paso; desde uno sin
 * página, Meta cortó con este genérico apenas puso el número. El portfolio que
 * fallaba tenía 0 páginas. (Y no era la verificación: el que funcionó tampoco
 * está verificado.)
 *
 * Meta no dice nada de la página en su error, así que el dueño busca el
 * problema en su número —donde no está— y abandona. Nombrarlo acá es lo que
 * convierte una pantalla muerta en algo que puede resolver solo.
 */
const GENERICO: ErrorTraducido = {
  titulo: 'No pudimos completar la conexión',
  pasos: [
    '¿Tu negocio tiene página de Facebook? Meta la exige, y sin ella corta con este mismo mensaje. Créala en facebook.com/pages/create — es gratis y no necesitas publicar nada',
    'Si ya tienes página, vuelve a intentar en un momento',
    'Si puedes, hazlo desde una computadora: el asistente de Meta funciona mejor ahí',
    'Si sigue fallando, escríbenos y lo resolvemos contigo',
  ],
  reintentable: true,
};

/**
 * Traduce el error a algo accionable.
 *
 * NUNCA devuelve null: quedarse sin mensaje es peor que un consejo genérico,
 * porque el dueño se queda mirando una pantalla que no le dice qué hacer.
 */
export function traducirErrorMeta(crudo: string | null | undefined): ErrorTraducido {
  const t = (crudo ?? '').toLowerCase();
  if (!t.trim()) return GENERICO;
  for (const { pistas, error } of CONOCIDOS) {
    if (pistas.some((p) => t.includes(p))) return error;
  }
  return GENERICO;
}
