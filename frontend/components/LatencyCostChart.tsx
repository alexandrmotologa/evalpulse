"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TestCaseResult } from "@/lib/api";

interface LatencyCostChartProps {
  results: TestCaseResult[];
}

export default function LatencyCostChart({ results }: LatencyCostChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !results || results.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-500">
        No evaluation data available to chart
      </div>
    );
  }

  // Aggregate stats per model
  const modelStats: Record<
    string,
    { model: string; avgLatency: number; p95Latency: number; totalCost: number; passCount: number; totalCount: number }
  > = {};

  results.forEach((r) => {
    if (!modelStats[r.model]) {
      modelStats[r.model] = {
        model: r.model.replace("mock-", ""),
        avgLatency: 0,
        p95Latency: 0,
        totalCost: 0,
        passCount: 0,
        totalCount: 0,
      };
    }
    modelStats[r.model].totalCount += 1;
    if (r.passed) modelStats[r.model].passCount += 1;
    modelStats[r.model].totalCost += r.estimated_cost;
  });

  // Calculate latencies per model
  Object.keys(modelStats).forEach((modelKey) => {
    const modelRuns = results.filter((r) => r.model === modelKey && r.latency_ms > 0);
    const sorted = modelRuns.map((r) => r.latency_ms).sort((a, b) => a - b);
    if (sorted.length > 0) {
      const sum = sorted.reduce((a, b) => a + b, 0);
      modelStats[modelKey].avgLatency = Math.round(sum / sorted.length);
      const p95Idx = Math.floor(sorted.length * 0.95);
      modelStats[modelKey].p95Latency = Math.round(sorted[p95Idx] || sorted[sorted.length - 1]);
    }
  });

  const chartData = Object.values(modelStats).map((s) => ({
    ...s,
    passRate: Math.round((s.passCount / s.totalCount) * 100),
    totalCost: Number((s.totalCost * 1000).toFixed(4)), // Cost in milli-dollars (m$) for readable scale
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Latency Comparison */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">Latency Performance (ms)</h3>
          <p className="text-xs text-zinc-400">Average response time vs p95 percentile latency</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="model" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Bar dataKey="avgLatency" name="Avg Latency (ms)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="p95Latency" name="p95 Latency (ms)" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Comparison */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">Cost & Quality Matrix</h3>
          <p className="text-xs text-zinc-400">Total run cost in milli-dollars ($m) vs pass rate</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="model" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Bar dataKey="totalCost" name="Cost ($m / 1000 runs)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="passRate" name="Pass Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
