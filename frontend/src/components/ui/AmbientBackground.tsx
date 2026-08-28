export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-glm-accent/20 blur-[120px] animate-ambient-drift" />
      <div className="absolute top-1/3 -right-24 h-[480px] w-[480px] rounded-full bg-glm-accent2/15 blur-[110px] animate-ambient-drift-reverse" />
      <div className="absolute -bottom-40 left-1/3 h-[560px] w-[560px] rounded-full bg-indigo-500/10 blur-[130px] animate-ambient-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,158,255,0.08),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(10,15,26,0.2),rgba(10,15,26,0.95))]" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
    </div>
  );
}
