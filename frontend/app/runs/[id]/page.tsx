"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EvaluationRun, TestCaseResult, API_BASE, fetchRun } from "@/lib/api";
import { formatCost, formatLatency, formatPercent } from "@/lib/utils";
import LatencyCostChart from "@/components/LatencyCostChart";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Layers,
  ArrowLeft,
  Search,
  FileCode,
} from "lucide-react";

export default function RunDetailsPage() {
  const params = useParams();
  const runId = params?.id as string;

  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");
  const [selectedResult, setSelectedResult] = useState<TestCaseResult | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!runId) return;

    async function loadInitial() {
      try {
        const data = await fetchRun(runId);
        setRun(data);
      } catch (err) {
        console.error("Failed to load run", err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, [runId]);

  // Server-Sent Events (SSE) for live streaming progress
  useEffect(() => {
    if (!runId) return;

    const eventSource = new EventSource(`${API_BASE}/api/runs/${runId}/stream`);

    eventSource.addEventListener("state", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRun(data);
      } catch (err) {
        console.error("SSE state error", err);
      }
    });

    eventSource.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRun((prev) => {
          if (!prev) return prev;
          const updatedResults = [...(prev.results || [])];
          if (data.latest_result) {
            updatedResults.push(data.latest_result);
          }
          return {
            ...prev,
            completed_tests: data.completed,
            results: updatedResults,
          };
        });
      } catch (err) {
        console.error("SSE progress parse error", err);
      }
    });

    eventSource.addEventListener("complete", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.run) setRun(data.run);
      } catch (err) {
        console.error("SSE complete parse error", err);
      }
      eventSource.close();
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Loading evaluation run results...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-8 text-center space-y-3">
        <h2 className="text-base font-semibold text-white">Evaluation run not found</h2>
        <Link href="/" className="text-xs text-indigo-400 hover:underline">
          Return to Overview
        </Link>
      </div>
    );
  }

  const results = run.results || [];
  const progressPercent =
    run.total_tests > 0 ? Math.round((run.completed_tests / run.total_tests) * 100) : 0;

  const filteredResults = results.filter((r) => {
    if (modelFilter !== "all" && r.model !== modelFilter) return false;
    if (statusFilter === "passed" && !r.passed) return false;
    if (statusFilter === "failed" && r.passed) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Overview
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">{run.name}</h1>
            <span
              className={`rounded px-2.5 py-0.5 text-xs font-semibold uppercase ${
                run.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : run.status === "running"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}
            >
              {run.status}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
            <span>Run ID: <code className="font-mono text-zinc-300">{run.id}</code></span>
            <span>•</span>
            <span>Dataset: <code className="font-mono text-zinc-300">{run.dataset_id}</code></span>
            <span>•</span>
            <span>{new Date(run.created_at).toLocaleString()}</span>
          </div>
        </div>

        <Link
          href={`/compare?base_run_id=${run.id}`}
          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition"
        >
          Compare With Another Run
        </Link>
      </div>

      {/* Progress Bar for In-Flight Runs */}
      {run.status === "running" && (
        <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-indigo-300 flex items-center gap-2 font-medium">
              <Activity className="h-4 w-4 animate-spin text-indigo-400" />
              Executing Matrix Matrix...
            </span>
            <span className="font-mono text-zinc-300">
              {run.completed_tests} / {run.total_tests} cells ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Pass Rate</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">
            {formatPercent(run.pass_rate)}
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">Threshold adherence</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">p95 Latency</div>
          <div className="mt-1 text-2xl font-bold text-amber-400">
            {formatLatency(run.p95_latency_ms)}
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">Mean: {formatLatency(run.avg_latency_ms)}</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Total Run Cost</div>
          <div className="mt-1 text-2xl font-bold text-cyan-400">
            {formatCost(run.total_cost)}
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">Token usage spend</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Total Tokens</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {run.total_tokens.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">Prompt + completion</div>
        </div>
      </div>

      {/* Latency & Cost Distribution Charts */}
      <LatencyCostChart results={results} />

      {/* Filter and Results Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        {/* Table Filter Controls */}
        <div className="border-b border-zinc-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Model:</span>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">All Models</option>
              {run.models.map((m) => (
                <option key={m} value={m}>
                  {m.replace("mock-", "")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === "all"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setStatusFilter("passed")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === "passed"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Passed ({results.filter((r) => r.passed).length})
            </button>
            <button
              onClick={() => setStatusFilter("failed")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === "failed"
                  ? "bg-rose-950 text-rose-300 border border-rose-800"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Failed ({results.filter((r) => !r.passed).length})
            </button>
          </div>
        </div>

        {/* Results Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3 font-medium">Test Case</th>
                <th className="px-5 py-3 font-medium">Model</th>
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Latency</th>
                <th className="px-5 py-3 font-medium">Tokens</th>
                <th className="px-5 py-3 font-medium">Cost</th>
                <th className="px-5 py-3 font-medium text-right">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filteredResults.map((r, idx) => (
                <tr key={idx} className="hover:bg-zinc-800/20 transition">
                  <td className="px-5 py-3 font-mono text-zinc-300">{r.test_case_id}</td>
                  <td className="px-5 py-3 font-mono text-indigo-300">{r.model.replace("mock-", "")}</td>
                  <td className="px-5 py-3 font-mono font-medium text-zinc-200">
                    {(r.composite_score * 100).toFixed(0)}%
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        r.passed
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {r.passed ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {r.passed ? "Pass" : "Fail"}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-zinc-400">{formatLatency(r.latency_ms)}</td>
                  <td className="px-5 py-3 font-mono text-zinc-400">{r.total_tokens}</td>
                  <td className="px-5 py-3 font-mono text-cyan-400">{formatCost(r.estimated_cost)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setSelectedResult(r)}
                      className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:text-white hover:border-zinc-700 transition"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Output Inspection Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Test Case: {selectedResult.test_case_id} ({selectedResult.model})
                </h3>
                <p className="text-xs text-zinc-400">
                  Score: {(selectedResult.composite_score * 100).toFixed(0)}% • Latency:{" "}
                  {formatLatency(selectedResult.latency_ms)} • Cost:{" "}
                  {formatCost(selectedResult.estimated_cost)}
                </p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="rounded-md border border-zinc-800 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {selectedResult.expected_output && (
              <div>
                <div className="text-xs font-medium text-zinc-400 mb-1">Expected Output:</div>
                <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-emerald-400 border border-zinc-800 overflow-x-auto">
                  {selectedResult.expected_output}
                </pre>
              </div>
            )}

            <div>
              <div className="text-xs font-medium text-zinc-400 mb-1">Actual Generated Output:</div>
              <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-200 border border-zinc-800 overflow-x-auto max-h-72">
                {selectedResult.actual_output || "<No output generated>"}
              </pre>
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-400 mb-1">Individual Metric Scores:</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedResult.scores).map(([metric, score]) => (
                  <span
                    key={metric}
                    className="rounded bg-zinc-950 border border-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300"
                  >
                    {metric}: {(score * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
