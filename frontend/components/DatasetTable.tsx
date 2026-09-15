"use client";

import { useState } from "react";
import { Dataset, TestCase } from "@/lib/api";
import { Database, Search, FileCode, Check, ChevronRight } from "lucide-react";

interface DatasetTableProps {
  datasets: Dataset[];
}

export default function DatasetTable({ datasets }: DatasetTableProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(datasets[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTestCase, setActiveTestCase] = useState<TestCase | null>(null);

  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  const filteredCases = (currentDataset?.test_cases || []).filter((tc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const inputStr = JSON.stringify(tc.input_data).toLowerCase();
    const expectedStr = (tc.expected_output || "").toLowerCase();
    return tc.id.toLowerCase().includes(query) || inputStr.includes(query) || expectedStr.includes(query);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Datasets List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="h-4 w-4 text-indigo-400" />
          Available Datasets
        </h3>

        <div className="space-y-1.5">
          {datasets.map((d) => {
            const isSelected = d.id === currentDataset?.id;
            return (
              <div
                key={d.id}
                onClick={() => {
                  setSelectedDatasetId(d.id);
                  setActiveTestCase(null);
                }}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition ${
                  isSelected
                    ? "border-indigo-500/40 bg-indigo-950/30 text-white"
                    : "border-zinc-800/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <div>
                  <div className="font-medium text-xs text-zinc-200">{d.name}</div>
                  <div className="text-[11px] text-zinc-500">{d.test_cases.length} test samples</div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </div>
            );
          })}
        </div>

        {currentDataset?.schema_definition && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2">
              <FileCode className="h-3.5 w-3.5 text-indigo-400" />
              <span>Target JSON Schema</span>
            </div>
            <pre className="max-h-48 overflow-y-auto rounded-lg bg-zinc-950 p-2.5 font-mono text-[10px] text-zinc-400 border border-zinc-800">
              {JSON.stringify(currentDataset.schema_definition, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Right: Test Cases Table */}
      <div className="lg:col-span-2 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test case ID, input payload or expected output..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none transition"
          />
        </div>

        {/* Test Cases List */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="border-b border-zinc-800 px-4 py-3 text-xs font-semibold text-zinc-300 flex justify-between items-center">
            <span>{currentDataset?.name} Samples</span>
            <span className="text-zinc-500">{filteredCases.length} items</span>
          </div>

          <div className="divide-y divide-zinc-800/80 max-h-[520px] overflow-y-auto">
            {filteredCases.map((tc) => {
              const isSelected = activeTestCase?.id === tc.id;
              return (
                <div
                  key={tc.id}
                  onClick={() => setActiveTestCase(isSelected ? null : tc)}
                  className={`cursor-pointer p-4 transition hover:bg-zinc-800/20 ${
                    isSelected ? "bg-zinc-800/40" : ""
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono text-indigo-400 font-medium">{tc.id}</span>
                    {tc.metadata?.category && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {tc.metadata.category}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-zinc-300 line-clamp-2">
                    {JSON.stringify(tc.input_data)}
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2">
                      <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Input Variables:</div>
                        <pre className="rounded bg-zinc-950 p-2 font-mono text-[11px] text-zinc-300 border border-zinc-800 mt-1">
                          {JSON.stringify(tc.input_data, null, 2)}
                        </pre>
                      </div>

                      {tc.expected_output && (
                        <div>
                          <div className="text-[11px] text-zinc-400 font-medium">Expected Output:</div>
                          <pre className="rounded bg-zinc-950 p-2 font-mono text-[11px] text-emerald-400 border border-zinc-800 mt-1">
                            {tc.expected_output}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
