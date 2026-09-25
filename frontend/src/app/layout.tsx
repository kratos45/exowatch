import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExoWatch - Console de Commandes",
  description: "Plateforme de surveillance des astéroïdes et d'exploration spatiale",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased min-h-screen flex flex-col bg-white text-gray-900 selection:bg-cyan-200 selection:text-cyan-900">
        {/* En-tête type Cockpit Light Neon */}
        <header className="border-b-2 border-cyan-400 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,255,255,0.3)]">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">🪐</span>
              <h1 className="text-xl font-extrabold tracking-widest text-cyan-600 uppercase drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]">
                ExoWatch <span className="text-cyan-400 text-sm ml-2 font-medium tracking-normal drop-shadow-none">v2.0-STABLE</span>
              </h1>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold font-mono text-cyan-600">
              <span className="flex items-center gap-2 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 shadow-[0_0_10px_rgba(0,255,255,0.2)]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,255,255,1)]"></span>
                SYS: ONLINE
              </span>
              <span className="bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 shadow-[0_0_10px_rgba(0,255,255,0.2)]">UPLINK: ACTIVE</span>
            </div>
          </div>
        </header>

        {/* Contenu principal */}
        <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
