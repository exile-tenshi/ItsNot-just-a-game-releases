import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "../types";

interface Category {
  id: string;
  label: string;
  description: string;
  examples?: string[];
  severity?: string;
  terms_section?: string;
  guard_keywords?: string[];
}

interface LoopholeItem {
  id: string;
  name: string;
  description: string;
  used: boolean;
  files?: string[];
  category?: string;
  category_label?: string;
}

interface LoopholesData {
  summary: { total_loopholes?: number; used_true?: number; used_false?: number; total?: number };
  categories: Record<string, { label: string; loopholes: LoopholeItem[] }>;
  highest_impact_bypass_paths?: string[];
  legend?: Record<string, string>;
}

export function RestrictionsPanel() {
  const [allowed, setAllowed] = useState<Category[]>([]);
  const [notAllowed, setNotAllowed] = useState<Category[]>([]);
  const [markdown, setMarkdown] = useState("");
  const [guardMode, setGuardMode] = useState("enforce");
  const [loopholes, setLoopholes] = useState<LoopholesData | null>(null);
  const [view, setView] = useState<"review" | "allowed" | "blocked" | "loopholes">("review");
  const [loading, setLoading] = useState(true);
  const [loopholeFilter, setLoopholeFilter] = useState<"all" | "used" | "unused">("all");

  useEffect(() => {
    Promise.all([
      apiFetch<{
        allowed: Category[];
        not_allowed: Category[];
        markdown: string;
        guard_mode: string;
      }>("/api/restrictions"),
      apiFetch<LoopholesData>("/api/loopholes"),
    ])
      .then(([data, loopholeData]) => {
        setAllowed(data.allowed);
        setNotAllowed(data.not_allowed);
        setMarkdown(data.markdown);
        setGuardMode(data.guard_mode);
        setLoopholes(loopholeData);
      })
      .finally(() => setLoading(false));
  }, []);

  const changeMode = async (mode: string) => {
    await apiFetch("/api/guard/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    setGuardMode(mode);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-glm-muted">
        Loading restrictions…
      </div>
    );
  }

  const flatLoopholes: LoopholeItem[] = loopholes
    ? Object.entries(loopholes.categories).flatMap(([catId, cat]) =>
        cat.loopholes.map((l) => ({ ...l, category: catId, category_label: cat.label })),
      )
    : [];

  const filteredLoopholes = flatLoopholes.filter((l) => {
    if (loopholeFilter === "used") return l.used;
    if (loopholeFilter === "unused") return !l.used;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Restrictions Review</h2>
          <p className="text-glm-muted text-sm mt-1">
            Policy source: <code className="text-glm-accent2">restrictions/RESTRICTIONS.md</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-glm-muted">Guard mode:</span>
          {(["enforce", "log_only", "disabled"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                guardMode === mode
                  ? "bg-glm-accent border-glm-accent text-white"
                  : "border-glm-border text-glm-muted hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-glm-border pb-2">
        {(
          [
            { id: "review" as const, label: "Full Review Document" },
            { id: "allowed" as const, label: `Allowed (${allowed.length})` },
            { id: "blocked" as const, label: `Not Allowed (${notAllowed.length})` },
            {
              id: "loopholes" as const,
              label: `Loopholes (${loopholes?.summary?.used_true ?? 0} active)`,
            },
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === tab.id
                ? "bg-glm-card text-white border border-glm-border"
                : "text-glm-muted hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "review" && (
        <div className="bg-glm-card border border-glm-border rounded-2xl p-6 md:p-8 markdown-body max-h-[calc(100vh-14rem)] overflow-y-auto">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      )}

      {view === "allowed" && (
        <div className="grid gap-4 md:grid-cols-2">
          {allowed.map((cat) => (
            <CategoryCard key={cat.id} category={cat} variant="allowed" />
          ))}
        </div>
      )}

      {view === "blocked" && (
        <div className="grid gap-4 md:grid-cols-2">
          {notAllowed.map((cat) => (
            <CategoryCard key={cat.id} category={cat} variant="blocked" />
          ))}
        </div>
      )}

      {view === "loopholes" && loopholes && (
        <div className="space-y-6">
          <div className="bg-glm-card border border-glm-border rounded-xl p-5">
            <h3 className="font-semibold mb-2">Loophole registry</h3>
            <p className="text-sm text-glm-muted mb-3">
              Source: <code className="text-glm-accent2">config/loopholes.json</code> —{" "}
              {loopholes.legend?.used ?? "used=true means active in default deployment"}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1 rounded-lg bg-glm-bg border border-glm-border">
                Total: {loopholes.summary.total ?? flatLoopholes.length}
              </span>
              <span className="px-3 py-1 rounded-lg bg-glm-danger/20 text-glm-danger border border-glm-danger/30">
                used: true → {loopholes.summary.used_true ?? 0} active
              </span>
              <span className="px-3 py-1 rounded-lg bg-glm-success/20 text-glm-success border border-glm-success/30">
                used: false → {loopholes.summary.used_false ?? 0} inactive
              </span>
            </div>
            <div className="flex gap-2 mt-4">
              {(["all", "used", "unused"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLoopholeFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    loopholeFilter === f
                      ? "bg-glm-accent border-glm-accent text-white"
                      : "border-glm-border text-glm-muted"
                  }`}
                >
                  {f === "all" ? "All" : f === "used" ? "used: true" : "used: false"}
                </button>
              ))}
            </div>
          </div>

          {loopholes.highest_impact_bypass_paths && (
            <div className="bg-glm-card border border-amber-500/30 rounded-xl p-5">
              <h4 className="font-semibold text-amber-400 mb-2">Highest-impact bypass paths</h4>
              <ul className="text-sm text-glm-muted space-y-1 list-disc list-inside">
                {loopholes.highest_impact_bypass_paths.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3">
            {filteredLoopholes.map((item) => (
              <div
                key={item.id}
                className={`bg-glm-card border rounded-xl p-4 ${
                  item.used ? "border-glm-danger/40" : "border-glm-success/30"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-xs text-glm-muted font-mono">{item.id}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-mono shrink-0 ${
                      item.used
                        ? "bg-glm-danger/20 text-glm-danger"
                        : "bg-glm-success/20 text-glm-success"
                    }`}
                  >
                    used: {String(item.used)}
                  </span>
                </div>
                <p className="text-sm text-glm-muted mb-2">{item.description}</p>
                {item.category_label && (
                  <p className="text-xs text-glm-muted mb-1">Category: {item.category_label}</p>
                )}
                {item.files && item.files.length > 0 && (
                  <p className="text-[10px] font-mono text-glm-muted truncate">
                    {item.files.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  variant,
}: {
  category: Category;
  variant: "allowed" | "blocked";
}) {
  const border =
    variant === "allowed" ? "border-glm-success/30" : "border-glm-danger/30";
  const badge =
    variant === "allowed"
      ? "bg-glm-success/20 text-glm-success"
      : "bg-glm-danger/20 text-glm-danger";

  return (
    <div className={`bg-glm-card border ${border} rounded-xl p-5`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-white">{category.label}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badge}`}>
          {variant === "allowed" ? "allowed" : category.severity || "blocked"}
        </span>
      </div>
      <p className="text-sm text-glm-muted mb-3">{category.description}</p>
      {category.terms_section && (
        <p className="text-xs text-glm-muted mb-2 font-mono">{category.terms_section}</p>
      )}
      {category.examples && category.examples.length > 0 && (
        <ul className="text-xs text-glm-muted space-y-1">
          {category.examples.slice(0, 3).map((ex) => (
            <li key={ex} className="truncate">• {ex}</li>
          ))}
        </ul>
      )}
      {category.guard_keywords && category.guard_keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {category.guard_keywords.slice(0, 4).map((kw) => (
            <span
              key={kw}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-glm-bg border border-glm-border text-glm-muted"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
