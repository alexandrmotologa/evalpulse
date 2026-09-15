"use client";

import { useState } from "react";
import { Dataset, TestCase, importDataset, getExportUrl } from "@/lib/api";
import {
  Database,
  Search,
  FileCode,
  Check,
  ChevronRight,
  Upload,
  Download,
  Plus,
  AlertCircle,
  FileText,
} from "lucide-react";

interface DatasetTableProps {
  datasets: Dataset[];
  onRefresh?: () => void;
}

export default function DatasetTable({ datasets, onRefresh }: DatasetTableProps) {
  const [datasetList, setDatasetList] = useState<Dataset[]>(datasets);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(datasets[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTestCase, setActiveTestCase] = useState<TestCase | null>(null);

  // Import Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importName, setImportName] = useState("");
  const [importDesc, setImportDesc] = useState("");
  const [importFormat, setImportFormat] = useState<"json" | "jsonl" | "csv">("jsonl");
  const [importContent, setImportContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const currentDataset = datasetList.find((d) => d.id === selectedDatasetId) || datasetList[0];

  const filteredCases = (currentDataset?.test_cases || []).filter((tc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const inputStr = JSON.stringify(tc.input_data).toLowerCase();
    const expectedStr = (tc.expected_output || "").toLowerCase();
    return tc.id.toLowerCase().includes(query) || inputStr.includes(query) || expectedStr.includes(query);
  });

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importName || !importContent) {
      setImportError("Please provide both a dataset name and content.");
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const created = await importDataset({
        name: importName,
        description: importDesc || undefined,
        format: importFormat,
        content: importContent,
      });

      setDatasetList((prev) => [created, ...prev]);
      setSelectedDatasetId(created.id);
      setShowImportModal(false);
      setImportName("");
      setImportDesc("");
      setImportContent("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setImportError(err.message || "Failed to import dataset");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Datasets List */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              Available Datasets
            </h3>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition"
            >
              <Upload className="h-3 w-3" />
              Import
            </button>
          </div>

          <div className="space-y-1.5">
            {datasetList.map((d) => {
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

          {currentDataset && (
            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Export Dataset</span>
                <div className="flex items-center gap-1.5">
                  <a
                    href={getExportUrl(currentDataset.id, "json")}
                    download
                    className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white transition"
                  >
                    JSON
                  </a>
                  <a
                    href={getExportUrl(currentDataset.id, "jsonl")}
                    download
                    className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white transition"
                  >
                    JSONL
                  </a>
                  <a
                    href={getExportUrl(currentDataset.id, "csv")}
                    download
                    className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white transition"
                  >
                    CSV
                  </a>
                </div>
              </div>

              {currentDataset.schema_definition && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5">
                    <FileCode className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Target JSON Schema</span>
                  </div>
                  <pre className="max-h-40 overflow-y-auto rounded-lg bg-zinc-950 p-2.5 font-mono text-[10px] text-zinc-400 border border-zinc-800">
                    {JSON.stringify(currentDataset.schema_definition, null, 2)}
                  </pre>
                </div>
              )}
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
                          <pre className="rounded bg-zinc-950 p-2 font-mono text-[11px] text-zinc-300 border border-zinc-800 mt-1 whitespace-pre-wrap">
                            {JSON.stringify(tc.input_data, null, 2)}
                          </pre>
                        </div>

                        {tc.expected_output && (
                          <div>
                            <div className="text-[11px] text-zinc-400 font-medium">Expected Output:</div>
                            <pre className="rounded bg-zinc-950 p-2 font-mono text-[11px] text-emerald-400 border border-zinc-800 mt-1 whitespace-pre-wrap">
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleImportSubmit}
            className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-indigo-400" />
                Import Evaluation Dataset
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            {importError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {importError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Dataset Name</label>
              <input
                type="text"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="e.g. Chatbot Groundedness Test Set"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Format</label>
                <select
                  value={importFormat}
                  onChange={(e) => setImportFormat(e.target.value as any)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="jsonl">JSONL (1 sample per line)</option>
                  <option value="csv">CSV (Headers: inputs, expected_output)</option>
                  <option value="json">JSON Array</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={importDesc}
                  onChange={(e) => setImportDesc(e.target.value)}
                  placeholder="Purpose of test set"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Data Content (Paste CSV, JSONL or JSON)
              </label>
              <textarea
                rows={7}
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder={`{"input_data": {"query": "How to reset password?"}, "expected_output": "Visit settings..."}`}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={importing}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                {importing ? "Importing..." : "Save Dataset"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
