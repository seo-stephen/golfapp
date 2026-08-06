"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home", icon: "⛳" },
  { href: "/rounds", label: "Rounds", icon: "📋" },
  { href: "/round/new", label: "Play", icon: "＋" },
  { href: "/stats", label: "Stats", icon: "📈" },
  { href: "/swing", label: "Swing", icon: "🏌" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    if (href === "/") return pathname === "/";
    // A single round lives at /round?id=… , so highlight the Rounds tab for it.
    if (href === "/rounds") return pathname === "/rounds" || pathname === "/round";
    if (href === "/round/new") return pathname === "/round/new";
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

export function NavBar() {
  const isActive = useIsActive();

  return (
    <>
      {/* Compact header: brand only on phones, full nav from sm up. */}
      <header className="sticky top-0 z-10 border-b-2 border-kelly-800 bg-pine-950/85 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto py-3 flex items-center gap-6 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold text-lg tracking-tight text-cream-100"
          >
            <Image
              src="/brand/logo.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg border-2 border-kelly-700"
            />
            <span>
              Bogey<span className="text-kelly-400">Boys</span>
            </span>
          </Link>
          <nav className="hidden sm:flex gap-1 flex-wrap text-sm">
            {[
              ...LINKS,
              { href: "/courses", label: "Courses", icon: "" },
              { href: "/settings", label: "Settings", icon: "" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-kelly-500/20 text-kelly-300"
                    : "text-cream-400 hover:text-cream-100 hover:bg-pine-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="sm:hidden ml-auto flex items-center gap-1">
            <Link
              href="/courses"
              className={`text-sm px-3 min-h-11 flex items-center rounded-full ${
                isActive("/courses")
                  ? "bg-kelly-500/20 text-kelly-300"
                  : "text-cream-400"
              }`}
            >
              Courses
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className={`text-lg px-3 min-h-11 flex items-center rounded-full ${
                isActive("/settings")
                  ? "bg-kelly-500/20 text-kelly-300"
                  : "text-cream-400"
              }`}
            >
              ⚙
            </Link>
          </div>
        </div>
      </header>

      {/* iOS-style bottom tab bar on phones. */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-pine-800 bg-pine-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-14 py-2 text-[11px] active:opacity-60 ${
                  active ? "text-kelly-400" : "text-cream-500"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {link.icon}
                </span>
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
