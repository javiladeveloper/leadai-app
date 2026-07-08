import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible: diseñada para máxima legibilidad. Se auto-hostea
// (next/font), sin CDN — sin problemas de CSP.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LeadAI",
  description:
    "Ve tus leads, respondé al instante y cerrá más ventas. La IA atiende; vos cerrás.",
  applicationName: "LeadAI",
  appleWebApp: { capable: true, title: "LeadAI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#eae1d0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={atkinson.variable}>
      {/* El root queda sin restricción de ancho: el panel de escritorio ocupa
          todo el ancho (su propio layout maneja sidebar+contenido), y las
          pantallas tipo login se centran ellas mismas en un ancho de teléfono. */}
      <body className="min-h-dvh bg-arena">{children}</body>
    </html>
  );
}
