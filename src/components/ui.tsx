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
      className={`rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 sm:p-5 ${className}`}
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
    primary: "bg-green-600 active:bg-green-700 sm:hover:bg-green-500 text-white",
    secondary:
      "bg-neutral-800 active:bg-neutral-700 sm:hover:bg-neutral-700 text-neutral-100",
    danger: "bg-red-900/60 active:bg-red-800 sm:hover:bg-red-800 text-red-100",
  }[variant];
  return (
    <button
      // min-h-11 ≈ 44px, Apple's minimum touch target.
      className={`px-4 min-h-11 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${styles} ${className}`}
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
      className={`bg-neutral-900 border border-neutral-700 rounded-lg px-3 min-h-11 text-base focus:outline-none focus:ring-2 focus:ring-green-500 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`bg-neutral-900 border border-neutral-700 rounded-lg px-3 min-h-11 text-base focus:outline-none focus:ring-2 focus:ring-green-500 ${props.className ?? ""}`}
    />
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
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
