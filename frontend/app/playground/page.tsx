"use client";

import { useEffect, useState } from "react";
import {
  Dataset,
  ModelInfo,
  PlaygroundResponse,
  fetchDatasets,
  fetchModels,
  runPlayground,
} from "@/lib/api";
import { formatCost, formatLatency } from "@/lib/utils";
import {
  Terminal,
  Play,
  Layers,
  Sparkles,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
} from "lucide-react";

export default function PlaygroundPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form states
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string>("");
  const [promptTemplate, setPromptTemplate] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>(
    "You are an accurate, structured AI engine. Produce valid JSON strictly complying with requirements."
  );
  const [inputVariablesJson, setInputVariablesJson] = useState<string>("{}");
  const [expectedOutput, setExpectedOutput] = useState<string>("");
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "mock-gpt-4o",
    "mock-claude-3-5-sonnet",
  ]);
  const [temperature, setTemperature] = useState<number>(0.0);

  // Execution result
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [dsList, modelList] = await Promise.all([fetchDatasets(), fetchModels()]);
        setDatasets(dsList);
        setModels(modelList);
        if (dsList.length > 0) {
          setSelectedDatasetId(dsList[0].id);
          applySample(dsList[0], 0);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load playground configurations");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const applySample = (ds: Dataset, testCaseIndex: number = 0) => {
    const tc = ds.test_cases[testCaseIndex];
    if (tc) {
      setSelectedTestCaseId(tc.id);
      setInputVariablesJson(JSON.stringify(tc.input_data, null, 2));
      setExpectedOutput(tc.expected_output || "");
    }

    if (ds.id.includes("triage")) {
      setPromptTemplate(
        "Categorize customer support inquiry:\nCustomer: {{customer_name}} (Tier: {{account_tier}})\nSubject: {{ticket_subject}}\nBody: {{ticket_body}}\n\nRespond with valid JSON: intent, urgency, sentiment, routing_team, requires_escalation."
      );
    } else if (ds.id.includes("extraction")) {
      setPromptTemplate(
        "Extract financial invoice fields from raw document text:\n\n{{raw_invoice_text}}\n\nOutput JSON strictly conforming to the invoice schema."
      );
    } else {
      setPromptTemplate("Process input:\n{{input}}\nReturn JSON result.");
    }
  };

  const handleDatasetChange = (dsId: string) => {
    setSelectedDatasetId(dsId);
    const found = datasets.find((d) => d.id === dsId);
    if (found) applySample(found, 0);
  };

  const handleTestCaseChange = (tcId: string) => {
    setSelectedTestCaseId(tcId);
    const ds = datasets.find((d) => d.id === selectedDatasetId);
    const foundTc = ds?.test_cases.find((t) => t.id === tcId);
    if (foundTc) {
      setInputVariablesJson(JSON.stringify(foundTc.input_data, null, 2));
      setExpectedOutput(foundTc.expected_output || "");
    }
  };

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
    );
  };

  const handleRun = async () => {
    let parsedInputs = {};
    try {
      parsedInputs = JSON.parse(inputVariablesJson);
    } catch {
      setError("Input variables must be valid JSON.");
      return;
    }

    if (selectedModels.length === 0) {
      setError("Please select at least one model to test.");
      return;
    }

    setRunning(true);
    setError(null);

    const ds = datasets.find((d) => d.id === selectedDatasetId);

    try {
      const res = await runPlayground({
        prompt_template: promptTemplate,
        input_data: parsedInputs,
        models: selectedModels,
        system_prompt: systemPrompt || undefined,
        temperature,
        expected_output: expectedOutput || undefined,
        schema_definition: ds?.schema_definition,
      });
      setResponse(res);
    } catch (err: any) {
      setError(err.message || "Failed to execute prompt in sandbox.");
    } finally {
      setRunning(false);
    }
  };

  const currentDataset = datasets.find((d) => d.id === selectedDatasetId);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Loading Prompt Sandbox...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
          <Terminal className="h-3.5 w-3.5" />
          Interactive Sandbox
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Prompt Sandbox & Playground</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Iterate on prompt templates with live variable substitution and test outputs side-by-side in real time before launching full evaluation runs.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template, Variables & Models (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Preset Picker */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Quick Load Test Sample
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Dataset</label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => handleDatasetChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Sample Case</label>
                <select
                  value={selectedTestCaseId}
                  onChange={(e) => handleTestCaseChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {(currentDataset?.test_cases || []).map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.id} {tc.metadata?.category ? `(${tc.metadata.category})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Prompt Template */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Prompt Template</span>
              <span className="text-[11px] text-zinc-500">{"{{variable}}"}</span>
            </div>
            <textarea
              rows={6}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          {/* Input Variables (JSON) */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Input Variables (JSON)</span>
              <span className="text-[11px] text-zinc-500">Passed to template</span>
            </div>
            <textarea
              rows={4}
              value={inputVariablesJson}
              onChange={(e) => setInputVariablesJson(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          {/* Models Selector & Run CTA */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Models to Test</h3>
            <div className="grid grid-cols-2 gap-2">
              {models.map((m) => {
                const checked = selectedModels.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModel(m.id)}
                    className={`rounded-lg border p-2 text-left text-xs transition ${
                      checked
                        ? "border-indigo-500/40 bg-indigo-950/30 text-white"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-[10px] text-zinc-500">{m.provider}</div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRun}
              disabled={running || selectedModels.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-indigo-500 focus:outline-none disabled:opacity-50 transition shadow-lg shadow-indigo-600/20"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {running ? "Testing Prompt..." : "Run Test Prompt"}
            </button>
          </div>
        </div>

        {/* Right Column: Output & Model Results (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {!response ? (
            <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
              <Sparkles className="h-8 w-8 text-zinc-600 mb-2" />
              <h3 className="text-sm font-medium text-zinc-300">Sandbox Ready</h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                Configure your prompt template on the left, pick target models, and click &quot;Run Test Prompt&quot; to inspect real-time outputs and scores.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Rendered Prompt Preview */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                  <span className="font-semibold text-white">Rendered Prompt (Dispatched to Models)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(response.rendered_prompt);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-300 border border-zinc-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {response.rendered_prompt}
                </pre>
              </div>

              {/* Model Output Cards */}
              <div className="grid grid-cols-1 gap-4">
                {response.results.map((r, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">
                          {r.model.replace("mock-", "")}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            r.passed
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {r.passed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {r.passed ? "Pass" : "Fail"}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          {formatLatency(r.latency_ms)}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-zinc-500" />
                          {formatCost(r.estimated_cost)}
                        </span>
                        <span className="font-mono text-indigo-400 font-bold">
                          {(r.composite_score * 100).toFixed(0)}% score
                        </span>
                      </div>
                    </div>

                    {/* Output Text */}
                    <div>
                      <div className="text-[11px] font-medium text-zinc-400 mb-1">Generated Output:</div>
                      <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-200 border border-zinc-800 overflow-x-auto max-h-60 whitespace-pre-wrap">
                        {r.actual_output || "<No response>"}
                      </pre>
                    </div>

                    {/* Score Breakdown Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] text-zinc-500">Scores:</span>
                      {Object.entries(r.scores).map(([metric, score]) => (
                        <span
                          key={metric}
                          className="rounded bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-300 border border-zinc-800"
                        >
                          {metric}: {(score * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
