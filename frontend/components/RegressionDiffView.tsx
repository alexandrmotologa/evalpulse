"use client";

import { useState } from "react";
import { DiffItem, RunComparison } from "@/lib/api";
import { AlertCircle, CheckCircle2, MinusCircle, ArrowRight, Clock, DollarSign } from "lucide-react";
import { formatCost, formatLatency } from "@/lib/utils";

interface RegressionDiffViewProps {
  comparison: RunComparison;
}

export default function RegressionDiffView({ comparison }: RegressionDiffViewProps) {
  const [filter, setFilter] = useState<"all" | "regression" | "improved" | "unchanged">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredItems = comparison.diff_items.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* KPI Comparison Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Pass Rate Delta</div>
          <div
            className={`mt-1 text-2xl font-bold ${
              comparison.pass_rate_delta >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {comparison.pass_rate_delta >= 0 ? "+" : ""}
            {(comparison.pass_rate_delta * 100).toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">Candidate vs Base</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">p95 Latency Shift</div>
          <div
            className={`mt-1 text-2xl font-bold ${
              comparison.latency_p95_delta_ms <= 0 ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {comparison.latency_p95_delta_ms >= 0 ? "+" : ""}
            {comparison.latency_p95_delta_ms.toFixed(1)} ms
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">Lower latency is better</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Cost Variance</div>
          <div className="mt-1 text-2xl font-bold text-cyan-400">
            {comparison.cost_delta >= 0 ? "+" : ""}
            {formatCost(comparison.cost_delta)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">Net cost difference</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Regression Status</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
              {comparison.regressions_count} Regressions
            </span>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              {comparison.improvements_count} Improvements
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          {(["all", "regression", "improved", "unchanged"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                filter === tab
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {tab} (
              {tab === "all"
                ? comparison.diff_items.length
                : tab === "regression"
                ? comparison.regressions_count
                : tab === "improved"
                ? comparison.improvements_count
                : comparison.unchanged_count}
              )
            </button>
          ))}
        </div>
        <div className="text-xs text-zinc-500">
          Showing {filteredItems.length} of {comparison.diff_items.length} comparisons
        </div>
      </div>

      {/* Diff Table List */}
      <div className="space-y-3">
        {filteredItems.map((item, idx) => {
          const isExpanded = expandedId === `${item.test_case_id}-${item.model}`;
          const toggleId = `${item.test_case_id}-${item.model}`;

          return (
            <div
              key={idx}
              className={`rounded-xl border transition ${
                item.status === "regression"
                  ? "border-rose-900/40 bg-rose-950/10"
                  : item.status === "improved"
                  ? "border-emerald-900/40 bg-emerald-950/10"
                  : "border-zinc-800 bg-zinc-900/30"
              }`}
            >
              {/* Header Row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : toggleId)}
                className="flex cursor-pointer items-center justify-between p-4 hover:bg-zinc-800/30 transition rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {item.status === "regression" && (
                    <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                  )}
                  {item.status === "improved" && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  )}
                  {item.status === "unchanged" && (
                    <MinusCircle className="h-5 w-5 text-zinc-500 shrink-0" />
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-300">{item.test_case_id}</span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {item.model}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">Score:</span>
                    <span className="font-mono text-zinc-400">{(item.base_score * 100).toFixed(0)}%</span>
                    <ArrowRight className="h-3 w-3 text-zinc-600" />
                    <span
                      className={`font-mono font-semibold ${
                        item.score_delta < 0
                          ? "text-rose-400"
                          : item.score_delta > 0
                          ? "text-emerald-400"
                          : "text-zinc-300"
                      }`}
                    >
                      {(item.candidate_score * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="hidden sm:flex items-center gap-1 text-zinc-400">
                    <Clock className="h-3 w-3 text-zinc-500" />
                    <span>{formatLatency(item.candidate_latency_ms)}</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-1 text-zinc-400">
                    <DollarSign className="h-3 w-3 text-zinc-500" />
                    <span>{formatCost(item.candidate_cost)}</span>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      item.status === "regression"
                        ? "bg-rose-500/20 text-rose-300"
                        : item.status === "improved"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>

              {/* Side-by-Side Outputs */}
              {isExpanded && (
                <div className="border-t border-zinc-800/80 p-4 space-y-4">
                  {item.expected_output && (
                    <div>
                      <div className="text-[11px] font-medium text-zinc-400 mb-1">Expected Reference Output:</div>
                      <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-300 overflow-x-auto border border-zinc-800">
                        {item.expected_output}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                        <span>Base Output ({comparison.base_run_name}):</span>
                        <span className="font-mono">{(item.base_score * 100).toFixed(0)}% score</span>
                      </div>
                      <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-300 overflow-x-auto border border-zinc-800 max-h-60">
                        {item.base_output || "<Empty output>"}
                      </pre>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                        <span>Candidate Output ({comparison.candidate_run_name}):</span>
                        <span className="font-mono">{(item.candidate_score * 100).toFixed(0)}% score</span>
                      </div>
                      <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-300 overflow-x-auto border border-zinc-800 max-h-60">
                        {item.candidate_output || "<Empty output>"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
