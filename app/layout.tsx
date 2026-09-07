import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";

const neueHaas = localFont({
  src: "../public/fonts/NeueHaasDisplay-Roman.woff2",
  variable: "--font-neue",
  display: "swap",
});

const ppEditorial = localFont({
  src: "../public/fonts/PPEditorialNew-Ultralight.woff2",
  variable: "--font-ppeditorial",
  display: "swap",
});

const martianMono = localFont({
  src: "../public/fonts/MartianMono-Light.woff2",
  variable: "--font-martian",
  display: "swap",
});

const familjenGrotesk = localFont({
  src: "../public/fonts/FamiljenGrotesk-Regular.woff2",
  variable: "--font-familjen",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Punk Records — Personal Second Brain",
  description: "Capture, spaced review, and random recall to replace doomscrolling.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#08090a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${neueHaas.variable} ${ppEditorial.variable} ${martianMono.variable} ${familjenGrotesk.variable} h-full antialiased dark scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-[#08090a] text-[#f2f2f0] font-sans selection:bg-zinc-800 selection:text-white">
        <QueryProvider>{children}</QueryProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

