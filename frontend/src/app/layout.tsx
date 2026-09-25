import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ExoWatch — Mission Control & Surveillance NEO",
  description:
    "Console opérationnelle de surveillance des astéroïdes géocroiseurs, modélisation physique, analyse d'anomalies ML et agent Text-to-SQL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark h-full bg-[#0A0E14] text-[#E6E9EF]">
      <body className="min-h-screen flex flex-col font-sans bg-[#0A0E14] text-[#E6E9EF] antialiased selection:bg-[#00D9FF]/20 selection:text-[#00D9FF]">
        <Providers>
          {/* Mission Control Top Navigation Bar */}
          <Navbar />

          {/* Main Application Container */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
