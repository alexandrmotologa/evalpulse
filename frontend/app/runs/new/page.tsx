import MatrixRunConfig from "@/components/MatrixRunConfig";
import { Layers } from "lucide-react";

export const metadata = {
  title: "New Matrix Run — EvalPulse",
  description: "Configure and launch a concurrent LLM prompt evaluation matrix.",
};

export default function NewRunPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
          <Layers className="h-3.5 w-3.5" />
          Matrix Evaluator
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Configure New Evaluation Run</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Define prompt templates, select candidate models, and specify concurrency limits for benchmarking.
        </p>
      </div>

      <MatrixRunConfig />
    </div>
  );
}
