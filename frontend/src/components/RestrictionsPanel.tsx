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

export function RestrictionsPanel() {
  const [allowed, setAllowed] = useState<Category[]>([]);
  const [notAllowed, setNotAllowed] = useState<Category[]>([]);
  const [markdown, setMarkdown] = useState("");
  const [guardMode, setGuardMode] = useState("enforce");
  const [view, setView] = useState<"review" | "allowed" | "blocked">("review");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{
      allowed: Category[];
      not_allowed: Category[];
      markdown: string;
      guard_mode: string;
    }>("/api/restrictions")
      .then((data) => {
        setAllowed(data.allowed);
        setNotAllowed(data.not_allowed);
        setMarkdown(data.markdown);
        setGuardMode(data.guard_mode);
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
