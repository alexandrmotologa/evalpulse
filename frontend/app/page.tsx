"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EvaluationRun, fetchRuns } from "@/lib/api";
import { formatCost, formatLatency, formatPercent } from "@/lib/utils";
import {
  Activity,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  ArrowRight,
  GitCompare,
  Layers,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchRuns();
        setRuns(data);
      } catch (err) {
        console.error("Failed to load runs", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute summary stats
  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === "completed");
  const avgPassRate =
    completedRuns.length > 0
      ? completedRuns.reduce((acc, r) => acc + r.pass_rate, 0) / completedRuns.length
      : 0;
  const avgLatency =
    completedRuns.length > 0
      ? completedRuns.reduce((acc, r) => acc + r.avg_latency_ms, 0) / completedRuns.length
      : 0;
  const totalCost = runs.reduce((acc, r) => acc + r.total_cost, 0);

  return (
    <div className="space-y-8">
      {/* Hero / Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            LLM Evaluation & Regression Studio
          </h1>
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
            Continuously evaluate prompt updates, compare model latencies, detect schema regressions,
            and monitor token economics across production test sets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/runs/new"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            New Matrix Run
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Total Evaluations</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalRuns}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Completed test matrices</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Average Pass Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatPercent(avgPassRate)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">Across all evaluated models</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Mean Response Time</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatLatency(avgLatency)}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Model round-trip latency</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Recorded Token Cost</span>
            <DollarSign className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400">{formatCost(totalCost)}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Evaluated token spend</div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 to-zinc-950 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              Golden Benchmark
            </div>
            <h3 className="text-base font-medium text-white">Customer Support Triage</h3>
            <p className="text-xs text-zinc-400">
              Evaluate intent classification, escalation routing, and schema validity across models.
            </p>
          </div>
          <Link
            href="/runs/new"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700 transition shrink-0"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 to-zinc-950 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5" />
              Extraction Benchmark
            </div>
            <h3 className="text-base font-medium text-white">Financial Invoice Extraction</h3>
            <p className="text-xs text-zinc-400">
              Benchmark extraction accuracy on invoice numbers, line items, and VAT calculations.
            </p>
          </div>
          <Link
            href="/runs/new"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700 transition shrink-0"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Recent Evaluation Runs Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Evaluation Runs</h2>
            <p className="text-xs text-zinc-400">History of executed matrix tests and benchmarks</p>
          </div>
          <Link href="/compare" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:underline">
            <GitCompare className="h-3.5 w-3.5" />
            Compare Runs
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading evaluation history...</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No evaluation runs found. Click &quot;New Matrix Run&quot; to execute your first benchmark.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Evaluation Name</th>
                  <th className="px-6 py-3 font-medium">Models Tested</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Pass Rate</th>
                  <th className="px-6 py-3 font-medium">p95 Latency</th>
                  <th className="px-6 py-3 font-medium">Cost</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30 transition">
                    <td className="px-6 py-4 font-medium text-white">
                      <Link href={`/runs/${r.id}`} className="hover:underline flex items-center gap-2">
                        <span>{r.name}</span>
                        <span className="font-mono text-[10px] text-zinc-500">({r.id})</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {r.models.map((m) => (
                          <span
                            key={m}
                            className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono"
                          >
                            {m.replace("mock-", "")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          r.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : r.status === "running"
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">
                      {formatPercent(r.pass_rate)}
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-300">
                      {formatLatency(r.p95_latency_ms)}
                    </td>
                    <td className="px-6 py-4 font-mono text-cyan-400">
                      {formatCost(r.total_cost)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/runs/${r.id}`}
                        className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition"
                      >
                        View Results
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
