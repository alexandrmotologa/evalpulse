"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dataset, ModelInfo, createRun, fetchDatasets, fetchModels } from "@/lib/api";
import { Play, Sparkles, Layers, Sliders, AlertCircle } from "lucide-react";

export default function MatrixRunConfig() {
  const router = useRouter();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a precise AI engine. Output only strictly formatted JSON adhering to the target schema."
  );
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "mock-gpt-4o",
    "mock-claude-3-5-sonnet",
  ]);
  const [temperature, setTemperature] = useState(0.0);
  const [maxConcurrency, setMaxConcurrency] = useState(5);

  useEffect(() => {
    async function load() {
      try {
        const [dsList, modelList] = await Promise.all([fetchDatasets(), fetchModels()]);
        setDatasets(dsList);
        setModels(modelList);
        if (dsList.length > 0) {
          setSelectedDatasetId(dsList[0].id);
          applyDefaultTemplate(dsList[0]);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load initial configuration");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const applyDefaultTemplate = (ds: Dataset) => {
    if (ds.id.includes("triage")) {
      setPromptTemplate(
        "Categorize customer support inquiry:\nCustomer: {{customer_name}} (Tier: {{account_tier}})\nSubject: {{ticket_subject}}\nBody: {{ticket_body}}\n\nRespond with valid JSON: intent, urgency, sentiment, routing_team, requires_escalation."
      );
      setName("Support Triage Matrix Benchmark");
    } else if (ds.id.includes("extraction")) {
      setPromptTemplate(
        "Extract financial invoice fields from raw document text:\n\n{{raw_invoice_text}}\n\nOutput JSON strictly conforming to the invoice schema."
      );
      setName("Financial Extraction Regression Run");
    } else {
      setPromptTemplate("Process input: {{input}}\nOutput result conforming to specification.");
      setName(`Eval - ${ds.name}`);
    }
  };

  const handleDatasetChange = (dsId: string) => {
    setSelectedDatasetId(dsId);
    const found = datasets.find((d) => d.id === dsId);
    if (found) applyDefaultTemplate(found);
  };

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
    );
  };

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const totalTestCount = (selectedDataset?.test_cases.length || 0) * selectedModels.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDatasetId || selectedModels.length === 0 || !promptTemplate) {
      setError("Please select a dataset, at least one model, and provide a prompt template.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const run = await createRun({
        name: name || `Eval Run - ${selectedDataset?.name}`,
        dataset_id: selectedDatasetId,
        prompt_template: promptTemplate,
        system_prompt: systemPrompt || undefined,
        models: selectedModels,
        temperature,
        max_concurrency: maxConcurrency,
      });
      router.push(`/runs/${run.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to start evaluation run");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
        Loading evaluation matrix configurations...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950/20 p-4 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Prompts and Dataset */}
        <div className="lg:col-span-2 space-y-5">
          {/* Run Name & Dataset */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Evaluation Run Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Prompt v2.1 Temperature Optimization"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Target Dataset</label>
              <select
                value={selectedDatasetId}
                onChange={(e) => handleDatasetChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none transition"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.test_cases.length} samples)
                  </option>
                ))}
              </select>
              {selectedDataset && (
                <p className="mt-1.5 text-xs text-zinc-500">{selectedDataset.description}</p>
              )}
            </div>
          </div>

          {/* Prompt Template */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-300">Prompt Template</label>
                <span className="text-[11px] text-zinc-500">
                  Use double braces like <code className="font-mono text-indigo-400">{"{{variable}}"}</code>
                </span>
              </div>
              <textarea
                rows={7}
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">System Prompt</label>
              <textarea
                rows={2}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Models & Runtime Params */}
        <div className="space-y-5">
          {/* Models Selector */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Target Models
            </h3>
            <div className="space-y-2">
              {models.map((m) => {
                const checked = selectedModels.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleModel(m.id)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition ${
                      checked
                        ? "border-indigo-500/40 bg-indigo-950/20 text-white"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        className="rounded border-zinc-700 text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <div className="font-medium text-zinc-200">{m.name}</div>
                        <div className="text-[10px] text-zinc-500">{m.provider}</div>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-500">
                      ${m.inputPricePerM} / ${m.outputPricePerM}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hyperparameters */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-400" />
              Execution Parameters
            </h3>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">Temperature</span>
                <span className="font-mono text-zinc-200">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={1.0}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">Concurrency Limit</span>
                <span className="font-mono text-zinc-200">{maxConcurrency} workers</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          {/* Launch Action Card */}
          <div className="rounded-xl border border-indigo-900/40 bg-gradient-to-b from-indigo-950/30 to-zinc-900/60 p-5">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-zinc-400">Total Matrix Cells:</span>
              <span className="font-mono font-bold text-white text-sm">{totalTestCount} executions</span>
            </div>

            <button
              type="submit"
              disabled={submitting || totalTestCount === 0}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none disabled:opacity-50 transition shadow-lg shadow-indigo-600/20"
            >
              <Play className="h-4 w-4 fill-current" />
              {submitting ? "Launching Engine..." : "Run Evaluation Matrix"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
