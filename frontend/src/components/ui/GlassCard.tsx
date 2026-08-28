import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className = "", glow = false }: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-glm-card/70 backdrop-blur-xl shadow-glm-card ${
        glow ? "shadow-glm-glow" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl bg-gradient-to-r from-glm-accent via-sky-400 to-glm-accent2 px-5 py-3 text-sm font-semibold text-white shadow-glm-glow transition-all hover:scale-[1.02] hover:shadow-glm-glow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}
