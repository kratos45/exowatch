import type { Metadata } from "next";
import "./globals.css";
import CockpitNavbar from "./components/CockpitNavbar";
import UniversalSearchModal from "./components/UniversalSearchModal";
import ToastContainer from "./components/ToastContainer";

export const metadata: Metadata = {
  title: "ExoWatch v2.5 - Cockpit de Défense Planétaire & Minage Spatial",
  description: "Système de surveillance des géocroiseurs, modélisation 3D temps réel, analyse de graphe Neo4j et IA autonome",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-screen flex flex-col transition-colors selection:bg-cyan-200 selection:text-cyan-900">
        {/* Cockpit Spacecraft Top Navigation Console */}
        <CockpitNavbar />

        {/* Global Floating Toast Alert Container */}
        <ToastContainer />

        {/* Global Universal Search Modal (Cmd+K / Ctrl+K) */}
        <UniversalSearchModal />

        {/* Main Application Container */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 flex flex-col min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}
