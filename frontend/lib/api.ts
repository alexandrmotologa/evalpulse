export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface TestCase {
  id: string;
  input_data: Record<string, any>;
  expected_output?: string | null;
  metadata?: Record<string, any>;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  schema_definition?: Record<string, any> | null;
  test_cases: TestCase[];
  created_at: string;
  version: number;
}

export interface TestCaseResult {
  test_case_id: string;
  model: string;
  actual_output: string;
  expected_output?: string | null;
  scores: Record<string, number>;
  composite_score: number;
  passed: boolean;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  error?: string | null;
}

export interface EvaluationRun {
  id: string;
  name: string;
  dataset_id: string;
  prompt_template: string;
  system_prompt?: string | null;
  models: string[];
  status: "pending" | "running" | "completed" | "failed";
  total_tests: number;
  completed_tests: number;
  pass_rate: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  total_cost: number;
  total_tokens: number;
  created_at: string;
  completed_at?: string | null;
  results?: TestCaseResult[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  inputPricePerM: number;
  outputPricePerM: number;
  isMock: boolean;
}

export interface DiffItem {
  test_case_id: string;
  model: string;
  base_output: string;
  candidate_output: string;
  expected_output?: string | null;
  base_score: number;
  candidate_score: number;
  score_delta: number;
  base_latency_ms: number;
  candidate_latency_ms: number;
  base_cost: number;
  candidate_cost: number;
  status: "regression" | "improved" | "unchanged";
}

export interface RunComparison {
  base_run_id: string;
  candidate_run_id: string;
  base_run_name: string;
  candidate_run_name: string;
  pass_rate_delta: number;
  latency_p95_delta_ms: number;
  cost_delta: number;
  regressions_count: number;
  improvements_count: number;
  unchanged_count: number;
  diff_items: DiffItem[];
}

export async function fetchDatasets(): Promise<Dataset[]> {
  const res = await fetch(`${API_BASE}/api/datasets`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch datasets");
  return res.json();
}

export async function fetchDataset(id: string): Promise<Dataset> {
  const res = await fetch(`${API_BASE}/api/datasets/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch dataset");
  return res.json();
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${API_BASE}/api/models`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch models");
  const data = await res.json();
  return data.models;
}

export async function fetchRuns(): Promise<EvaluationRun[]> {
  const res = await fetch(`${API_BASE}/api/runs`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch evaluation runs");
  return res.json();
}

export async function fetchRun(id: string): Promise<EvaluationRun> {
  const res = await fetch(`${API_BASE}/api/runs/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch evaluation run");
  return res.json();
}

export async function createRun(payload: {
  name?: string;
  dataset_id: string;
  prompt_template: string;
  system_prompt?: string;
  models: string[];
  temperature?: number;
  max_concurrency?: number;
}): Promise<EvaluationRun> {
  const res = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to trigger evaluation run");
  return res.json();
}

export async function compareRuns(baseId: string, candidateId: string): Promise<RunComparison> {
  const res = await fetch(
    `${API_BASE}/api/runs/compare?base_run_id=${encodeURIComponent(baseId)}&candidate_run_id=${encodeURIComponent(candidateId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to compare runs");
  return res.json();
}
