import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-pine-700 bg-pine-900/60 p-4 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary:
      "bg-kelly-600 border-kelly-800 active:bg-kelly-700 sm:hover:bg-kelly-500 text-cream-100",
    secondary:
      "bg-pine-800 border-pine-700 active:bg-pine-700 sm:hover:bg-pine-700 text-cream-100",
    danger: "bg-red-900/60 border-red-800 active:bg-red-800 sm:hover:bg-red-800 text-red-100",
  }[variant];
  return (
    <button
      // min-h-11 ≈ 44px, Apple's minimum touch target. Pill shape + bold
      // uppercase reads as merch-tag branding on labels, and as a chunky
      // round tap target on the single-glyph +/− and ←/→ steppers.
      className={`px-4 min-h-11 rounded-full border-2 text-sm font-bold uppercase tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${styles} ${className}`}
      {...props}
    />
  );
}

// text-base (16px) is required on iOS — Safari zooms the page when a focused
// input's font-size is smaller.
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`bg-pine-900 border-2 border-pine-700 rounded-xl px-3 min-h-11 text-base focus:outline-none focus:ring-2 focus:ring-kelly-500 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`bg-pine-900 border-2 border-pine-700 rounded-xl px-3 min-h-11 text-base focus:outline-none focus:ring-2 focus:ring-kelly-500 ${props.className ?? ""}`}
    />
  );
}

/** Big +/− tap counter — used for live scorecard entry and putting-mat tallies. */
export function Stepper({
  label,
  value,
  onSet,
  onBump,
}: {
  label: string;
  value: number | null;
  onSet: (v: number | null) => void;
  onBump: (delta: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-cream-300">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="w-12"
          onClick={() => onBump(-1)}
          aria-label={`Decrease ${label}`}
        >
          −
        </Button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value ?? ""}
          onChange={(e) =>
            onSet(e.target.value === "" ? null : parseInt(e.target.value, 10))
          }
          className="w-16 text-center bg-pine-900 border-2 border-pine-700 rounded-xl min-h-11 text-base focus:outline-none focus:ring-2 focus:ring-kelly-500"
          aria-label={label}
        />
        <Button
          variant="secondary"
          className="w-12"
          onClick={() => onBump(1)}
          aria-label={`Increase ${label}`}
        >
          +
        </Button>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-pine-700 bg-pine-900/60 px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-kelly-400">
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-extrabold mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-cream-500 mt-0.5">{sub}</div>}
    </div>
  );
}
