"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EvaluationRun, RunComparison, compareRuns, fetchRuns } from "@/lib/api";
import RegressionDiffView from "@/components/RegressionDiffView";
import { GitCompare, ArrowRight, Layers, AlertCircle } from "lucide-react";

function CompareContent() {
  const searchParams = useSearchParams();
  const initialBaseId = searchParams.get("base_run_id") || "";
  const initialCandId = searchParams.get("candidate_run_id") || "";

  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [baseRunId, setBaseRunId] = useState<string>(initialBaseId);
  const [candidateRunId, setCandidateRunId] = useState<string>(initialCandId);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRuns() {
      try {
        const data = await fetchRuns();
        setRuns(data);
        if (!baseRunId && data.length > 0) setBaseRunId(data[0].id);
        if (!candidateRunId && data.length > 1) setCandidateRunId(data[1].id);
      } catch (err) {
        console.error("Failed to fetch runs for comparison", err);
      }
    }
    loadRuns();
  }, [baseRunId, candidateRunId]);

  const handleCompare = async () => {
    if (!baseRunId || !candidateRunId) {
      setError("Please select both a base run and a candidate run.");
      return;
    }
    if (baseRunId === candidateRunId) {
      setError("Base run and candidate run must be different evaluations.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await compareRuns(baseRunId, candidateRunId);
      setComparison(data);
    } catch (err: any) {
      setError(err.message || "Failed to compare evaluation runs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
          <GitCompare className="h-3.5 w-3.5" />
          Regression Studio
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Compare Prompt & Model Iterations</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Side-by-side regression analysis detecting accuracy drops, latency regressions, and schema failures between runs.
        </p>
      </div>

      {/* Run Selector Bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Base Reference Run (Baseline)
            </label>
            <select
              value={baseRunId}
              onChange={(e) => setBaseRunId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Select baseline run...</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id}) — {(r.pass_rate * 100).toFixed(0)}% pass
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center md:pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Candidate Run (New Iteration)
            </label>
            <select
              value={candidateRunId}
              onChange={(e) => setCandidateRunId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Select candidate run...</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id}) — {(r.pass_rate * 100).toFixed(0)}% pass
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCompare}
            disabled={loading || !baseRunId || !candidateRunId}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 focus:outline-none disabled:opacity-50 transition"
          >
            <GitCompare className="h-3.5 w-3.5" />
            {loading ? "Comparing Runs..." : "Compute Regression Diff"}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparison && <RegressionDiffView comparison={comparison} />}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500">Loading comparison studio...</div>}>
      <CompareContent />
    </Suspense>
  );
}
