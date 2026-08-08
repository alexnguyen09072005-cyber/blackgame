import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-xl text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.08)]"
      >
        ◇
      </div>
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-300/80">
          Hồ sơ tuyệt mật
        </p>
        <p className={cn("font-black tracking-[0.08em] text-stone-50", compact ? "text-lg" : "text-xl")}>
          BLACK STORIES
        </p>
      </div>
    </div>
  );
}

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "min-h-dvh bg-[#090b0f] text-stone-100 [background-image:radial-gradient(circle_at_15%_0%,rgba(180,83,9,0.12),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(51,65,85,0.18),transparent_24%)]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-[#12151b]/95 shadow-[0_20px_60px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function buttonClass(variant: ButtonProps["variant"] = "primary") {
  return cn(
    "inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-bold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b0f]",
    variant === "primary" &&
      "bg-amber-300 text-stone-950 shadow-[0_10px_30px_rgba(251,191,36,0.12)] hover:bg-amber-200",
    variant === "secondary" && "border border-white/15 bg-white/[0.06] text-stone-50 hover:bg-white/10",
    variant === "danger" && "border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20",
    variant === "ghost" && "text-stone-300 hover:bg-white/[0.06] hover:text-white",
  );
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn(buttonClass(variant), className)} {...props} />;
}

export function StatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "border-white/10 bg-white/[0.05] text-stone-300",
        tone === "success" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
        tone === "warning" && "border-amber-300/25 bg-amber-300/10 text-amber-200",
        tone === "danger" && "border-red-400/25 bg-red-400/10 text-red-200",
        tone === "info" && "border-sky-400/25 bg-sky-400/10 text-sky-200",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-stone-200">
      {children}
    </label>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-xl border border-white/15 bg-black/25 px-3.5 py-3 text-base text-stone-50 outline-none placeholder:text-stone-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50";

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      {message}
    </div>
  );
}

export function InfoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.08] px-4 py-3 text-sm leading-6 text-sky-100">
      {children}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
      <div aria-hidden="true" className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-white/[0.05] text-stone-400">
        ◌
      </div>
      <p className="font-bold text-stone-100">{title}</p>
      <p className="mt-1 text-sm leading-6 text-stone-400">{detail}</p>
    </div>
  );
}

export function LoadingBlock({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025]">
      <div className="text-center text-sm text-stone-400">
        <span className="mx-auto mb-3 block size-7 animate-spin rounded-full border-2 border-white/15 border-t-amber-300" />
        {label}
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/75">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h1>
        {detail ? <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}
