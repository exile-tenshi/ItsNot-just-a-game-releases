import { useEffect, useState } from "react";
import type { TabId } from "../types";
import { apiFetch } from "../types";

interface CreationType {
  id: string;
  category: string;
  name: string;
  description: string;
  models?: string[];
  endpoint?: string;
  tab?: string;
  requires_api_key?: boolean;
  zai_endpoint?: string;
  tools?: string[];
}

interface CategoryMeta {
  id: string;
  label: string;
  icon: string;
}

interface CatalogData {
  version: string;
  description: string;
  categories: CategoryMeta[];
  creation_types: CreationType[];
  by_category: Record<string, CreationType[]>;
}

interface CreationPanelProps {
  onNavigate?: (tab: TabId) => void;
}

export function CreationPanel({ onNavigate }: CreationPanelProps) {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    apiFetch<CatalogData>("/api/ai/creation/catalog")
      .then(setCatalog)
      .catch((e) => setError(String(e)));
  }, []);

  const runWorkspaceVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const report = await apiFetch<{ formatted: string; zero_errors: boolean }>(
        "/api/verify/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: [], languages: [] }),
        },
      );
      setVerifyResult(report.formatted);
    } catch (e) {
      setVerifyResult(`Error: ${e}`);
    } finally {
      setVerifying(false);
    }
  };

  const categoryIcon = (id: string) =>
    catalog?.categories.find((c) => c.id === id)?.icon ?? "✨";

  const categoryLabel = (id: string) =>
    catalog?.categories.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <section className="rounded-2xl border border-glm-border bg-glm-card p-6">
        <h2 className="text-xl font-semibold mb-2">AI Creation Catalog</h2>
        <p className="text-glm-muted text-sm mb-4">
          All supported AI creation types — chat, coding agent, code verification, image, video,
          audio, OCR, agents, PC builder, and more.
        </p>
        {catalog && (
          <p className="text-xs text-glm-muted font-mono">
            {catalog.creation_types.length} modalities · v{catalog.version}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-glm-border bg-glm-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold">Zero-Errors Code Check</h3>
            <p className="text-sm text-glm-muted">
              Ruff, mypy, ESLint, tsc, Bandit, pytest, ShellCheck — same pipeline the agent uses
            </p>
          </div>
          <button
            type="button"
            onClick={runWorkspaceVerify}
            disabled={verifying}
            className="px-4 py-2 rounded-lg bg-glm-accent text-white text-sm font-medium disabled:opacity-50"
          >
            {verifying ? "Running checkers…" : "Verify workspace now"}
          </button>
        </div>
        {verifyResult && (
          <pre className="text-xs font-mono bg-glm-bg border border-glm-border rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
            {verifyResult}
          </pre>
        )}
      </section>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {!catalog && !error && (
        <p className="text-glm-muted text-sm">Loading catalog…</p>
      )}

      {catalog &&
        Object.entries(catalog.by_category).map(([catId, items]) => (
          <section key={catId} className="rounded-2xl border border-glm-border bg-glm-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span>{categoryIcon(catId)}</span>
              {categoryLabel(catId)}
              <span className="text-xs text-glm-muted font-normal">({items.length})</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-glm-border bg-glm-bg/50 p-4 flex flex-col gap-2"
                >
                  <h4 className="font-medium text-sm">{item.name}</h4>
                  <p className="text-xs text-glm-muted flex-1">{item.description}</p>
                  {item.models && item.models.length > 0 && (
                    <p className="text-xs font-mono text-glm-muted truncate">
                      {item.models.join(", ")}
                    </p>
                  )}
                  {item.endpoint && (
                    <p className="text-xs font-mono text-glm-accent">{item.endpoint}</p>
                  )}
                  {item.tools && (
                    <p className="text-xs text-glm-muted">
                      Tools: {item.tools.join(", ")}
                    </p>
                  )}
                  {item.requires_api_key && (
                    <span className="text-xs text-amber-400/90">Requires API key</span>
                  )}
                  {item.tab && onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate(item.tab as TabId)}
                      className="text-xs text-left text-glm-accent hover:underline mt-1"
                    >
                      Open {item.tab} tab →
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
