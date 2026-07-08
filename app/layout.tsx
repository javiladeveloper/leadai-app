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
      <body>
        {/* La app vive en un ancho de teléfono; en desktop se centra sobre
            un fondo más hondo para que se lea como "una app". */}
        <div className="min-h-dvh w-full bg-tinta/95 flex justify-center">
          <div className="w-full max-w-[460px] min-h-dvh bg-arena relative shadow-2xl">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
