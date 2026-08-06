"use client";

import Link from "next/link";
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
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/85 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto py-3 flex items-center gap-6 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-lg text-green-400"
          >
            <span aria-hidden>⛳</span>
            TripleBogey
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
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  isActive(link.href)
                    ? "bg-green-500/20 text-green-300"
                    : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="sm:hidden ml-auto flex items-center gap-1">
            <Link
              href="/courses"
              className={`text-sm px-3 min-h-11 flex items-center rounded-md ${
                isActive("/courses")
                  ? "bg-green-500/20 text-green-300"
                  : "text-neutral-400"
              }`}
            >
              Courses
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className={`text-lg px-3 min-h-11 flex items-center rounded-md ${
                isActive("/settings")
                  ? "bg-green-500/20 text-green-300"
                  : "text-neutral-400"
              }`}
            >
              ⚙
            </Link>
          </div>
        </div>
      </header>

      {/* iOS-style bottom tab bar on phones. */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-14 py-2 text-[11px] active:opacity-60 ${
                  active ? "text-green-400" : "text-neutral-500"
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
