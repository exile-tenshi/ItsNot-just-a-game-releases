import { useEffect, useState } from "react";
import { apiFetch } from "../types";

interface TestResult {
  id: string;
  description: string;
  prompt: string;
  expect: string;
  actual: string;
  passed: boolean;
  violations: string[];
  expected_violation_id?: string;
  category?: string;
}

interface TestRunResponse {
  summary: {
    total: number;
    passed: number;
    failed: number;
    guard_mode: string;
    config_path: string;
  };
  results: TestResult[];
}

interface TestConfig {
  description: string;
  guard_mode: string;
  allowed_tests: { id: string; description: string }[];
  not_allowed_tests: { id: string; description: string }[];
  edge_case_tests: { id: string; description: string }[];
}

export function TestSuitePanel() {
  const [config, setConfig] = useState<TestConfig | null>(null);
  const [results, setResults] = useState<TestRunResponse | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    apiFetch<TestConfig>("/api/tests/config").then(setConfig).catch(() => {});
  }, []);

  const runTests = async () => {
    setRunning(true);
    try {
      const data = await apiFetch<TestRunResponse>("/api/tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setResults(data);
    } finally {
      setRunning(false);
    }
  };

  const totalTests =
    (config?.allowed_tests?.length || 0) +
    (config?.not_allowed_tests?.length || 0) +
    (config?.edge_case_tests?.length || 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Restriction Test Suite</h2>
          <p className="text-glm-muted text-sm mt-1">
            Config: <code className="text-glm-accent2">config/restrictions-test.json</code>
            {config && ` · ${totalTests} scenarios`}
          </p>
        </div>
        <button
          type="button"
          onClick={runTests}
          disabled={running}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-glm-accent to-glm-accent2 font-semibold text-sm disabled:opacity-50 hover:shadow-lg hover:shadow-glm-accent/25 transition-all"
        >
          {running ? "Running…" : "Run All Tests"}
        </button>
      </div>

      {config && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Allowed tests"
            value={config.allowed_tests.length}
            color="text-glm-success"
          />
          <StatCard
            label="Not allowed tests"
            value={config.not_allowed_tests.length}
            color="text-glm-danger"
          />
          <StatCard
            label="Edge cases"
            value={config.edge_case_tests.length}
            color="text-glm-warn"
          />
        </div>
      )}

      {results && (
        <div className="mb-6 p-4 rounded-xl border border-glm-border bg-glm-card">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-3xl font-bold text-glm-success">{results.summary.passed}</span>
              <span className="text-glm-muted text-sm ml-2">passed</span>
            </div>
            <div>
              <span className="text-3xl font-bold text-glm-danger">{results.summary.failed}</span>
              <span className="text-glm-muted text-sm ml-2">failed</span>
            </div>
            <div className="text-sm text-glm-muted">
              Guard: {results.summary.guard_mode} · {results.summary.total} total
            </div>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-2">
          {results.results.map((r) => (
            <div
              key={r.id}
              className={`p-4 rounded-xl border ${
                r.passed
                  ? "border-glm-success/30 bg-glm-success/5"
                  : "border-glm-danger/30 bg-glm-danger/5"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    r.passed ? "bg-glm-success text-glm-bg" : "bg-glm-danger text-white"
                  }`}
                >
                  {r.passed ? "✓" : "✗"}
                </span>
                <span className="font-mono text-xs text-glm-muted">{r.id}</span>
                <span className="text-sm font-medium">{r.description}</span>
                <span className="text-xs text-glm-muted ml-auto">
                  expect {r.expect} → {r.actual}
                </span>
              </div>
              <p className="text-sm text-glm-muted font-mono truncate">{r.prompt}</p>
              {r.violations.length > 0 && (
                <p className="text-xs text-glm-warn mt-1">
                  Violations: {r.violations.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!results && !running && (
        <div className="text-center py-16 text-glm-muted">
          <p>Run the test suite to validate allowed and not-allowed scenarios.</p>
          <p className="text-sm mt-2">
            Tests use the local restriction guard — no API key required.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-glm-card border border-glm-border rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-glm-muted mt-1">{label}</div>
    </div>
  );
}
