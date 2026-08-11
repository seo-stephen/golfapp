"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

// Starting a round lives on the home page dashboard, not its own tab — a
// separate "Play" destination was redundant with it.
const LINKS = [
  { href: "/", label: "Home", icon: "⛳" },
  { href: "/rounds", label: "Rounds", icon: "📋" },
  { href: "/putting", label: "Putting", icon: "🎯" },
  { href: "/stats", label: "Stats", icon: "📈" },
  { href: "/swing", label: "Swing", icon: "🏌" },
];

// Practice tools + settings — full labels on desktop, icon-only on the
// mobile header (four of these plus the wordmark would overflow a 375px
// screen as text; the bottom tab bar above already handles primary nav).
const SECONDARY = [
  { href: "/courses", label: "Courses", icon: "📍" },
  { href: "/yardages", label: "Yardages", icon: "📏" },
  { href: "/weather", label: "Weather", icon: "⛅" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    if (href === "/") return pathname === "/";
    // A single round lives at /round?id=… , so highlight the Rounds tab for it.
    if (href === "/rounds") return pathname === "/rounds" || pathname === "/round";
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

export function NavBar() {
  const isActive = useIsActive();

  return (
    <>
      {/* Compact header: brand only on phones, full nav from sm up. */}
      <header className="sticky top-0 z-10 border-b-2 border-kelly-800 bg-pine-950/85 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto py-3 flex items-center gap-2 sm:gap-6 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(0.5rem+env(safe-area-inset-right))] sm:pr-[calc(1rem+env(safe-area-inset-right))]">
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold text-lg tracking-tight text-cream-100"
          >
            <Image
              src="/brand/logo.png"
              alt="BogeyBoys"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg border-2 border-kelly-700"
            />
            {/* Four icon-only tool links plus this wordmark don't fit a real
                375-402px phone width — the logo alone still reads as the brand. */}
            <span className="hidden sm:inline">
              Bogey<span className="text-kelly-400">Boys</span>
            </span>
          </Link>
          <nav className="hidden sm:flex gap-1 flex-wrap text-sm">
            {[...LINKS, ...SECONDARY].map((link) => (
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
          {/* overflow-x-auto is a safety net, not the primary fix — sized to
              fit inline on a 375px phone, but never lets a link go
              unreachable if a device or dynamic type setting is narrower. */}
          <div className="sm:hidden ml-auto flex items-center gap-0.5 overflow-x-auto">
            {SECONDARY.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.label}
                className={`text-base shrink-0 px-1.5 min-h-11 min-w-11 flex items-center justify-center rounded-full ${
                  isActive(link.href)
                    ? "bg-kelly-500/20 text-kelly-300"
                    : "text-cream-400"
                }`}
              >
                {link.icon}
              </Link>
            ))}
          </div>
        </div>
      </header>
    </>
  );
}

/**
 * Rendered as the LAST child of body, after <main> — not fixed. A fixed
 * bottom bar is notoriously flaky on iOS Safari: it's positioned against the
 * layout viewport, which doesn't track the dynamic toolbar, so the bar can
 * visibly jump when the toolbar/URL-bar changes height. Sticky, placed at the
 * end of a min-h-dvh flex column, holds its place using normal flow instead.
 */
export function BottomTabBar() {
  const isActive = useIsActive();

  return (
    <nav className="sm:hidden sticky bottom-0 z-20 border-t border-pine-800 bg-pine-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
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
  );
}
