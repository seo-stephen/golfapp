import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BogeyBoys — Golf Trainer",
  description:
    "Track rounds, stats, handicap, and swing analysis for your golf game.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "BogeyBoys" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Content runs under the Dynamic Island and home indicator; the safe-area
  // padding below keeps it clear of both.
  viewportFit: "cover",
  themeColor: "#0d2318",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-pine-950 text-cream-100">
        <ServiceWorkerRegistrar />
        <NavBar />
        <OfflineBanner />
        {/* Horizontal insets matter in landscape: with viewportFit "cover" the
            sensor housing overlaps the leading edge. */}
        <main className="flex-1 w-full max-w-5xl mx-auto py-5 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-8">
          {children}
        </main>
      </body>
    </html>
  );
}
