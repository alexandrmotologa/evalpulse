# EvalPulse System Architecture

EvalPulse is an evaluation and regression studio built to benchmark Large Language Model outputs, measure token costs, detect schema regressions, and track latency distributions across prompt iterations.

## High Level Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │                   Next.js 15 Frontend                   │
 │   - Studio Dashboard (Overview, KPIs, Model Charts)    │
 │   - Matrix Run Configurator (Templates & Parameters)    │
 │   - Live Run Monitor (Server-Sent Events Streaming)    │
 │   - Regression Diff Studio (Side-by-Side Verification) │
 └────────────────────────────┬────────────────────────────┘
                              │ HTTP / SSE
 ┌────────────────────────────▼────────────────────────────┐
 │                     FastAPI Backend                     │
 │   - REST Endpoints (/api/runs, /api/datasets, /compare) │
 │   - SSE Progress Dispatcher                            │
 │   - Command-Line Interface (evalpulse cli)              │
 └──────┬─────────────────────┬─────────────────────┬──────┘
        │                     │                     │
 ┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
 │Matrix Runner│       │Scoring Engine│      │SQLite Engine│
 │Async Workers│       │Exact / Regex │      │WAL Journal  │
 │Concurrency  │       │JSON Schema   │      │Foreign Keys │
 │Providers    │       │Cosine Vector │      │Results DB   │
 └─────────────┘       └─────────────┘       └─────────────┘
```

## Backend Engine

The backend runs on Python 3.11+ using FastAPI and asyncio.

### Matrix Runner (`app/core/matrix_runner.py`)
- Evaluates test cases across an arbitrary Cartesian product of models and datasets.
- Manages concurrency using an `asyncio.Semaphore` instance.
- Formats prompt templates dynamically using double-brace variables such as `{{customer_name}}` and `{{ticket_body}}`.
- Emits real-time progress events to in-memory queues for Server-Sent Events (SSE) streaming.

### Scoring Subsystem (`app/core/scoring.py`)
- `ExactMatch`: Compares strings with optional case and whitespace normalization.
- `RegexMatch`: Validates expected syntax patterns or tokens.
- `LevenshteinRatio`: Measures edit distance similarity.
- `JSONSchemaValidator`: Uses `jsonschema.Draft7Validator` to verify required fields, data types, and enum values. It reports property paths when validation fails.
- `SemanticSimilarity`: Evaluates cosine vector similarity over token frequencies and word n-grams without requiring heavy neural network downloads.

### Pricing and Token Economics (`app/core/pricing.py`)
- Computes costs based on standardized rates per million input and output tokens.
- Tracks expenses for models including GPT-4o, Claude 3.5 Sonnet, Gemini 1.5, DeepSeek, and local Ollama runtimes.

### Embedded Storage (`app/storage/db.py`)
- Persists runs and datasets in a single SQLite database file.
- Enables Write-Ahead Logging (`PRAGMA journal_mode=WAL;`) and synchronous normal mode for high concurrent throughput.
- Indexes runs by `dataset_id` and test results by `run_id`.

## Frontend Studio

The frontend is built with Next.js 15 (App Router), React 19, TypeScript, and Tailwind CSS.

### Pages
- `/`: Studio Overview with summary metrics, run history, and quick launch links.
- `/runs/new`: Configurator for dataset selection, prompt template editing, and model choices.
- `/runs/[id]`: Live monitor showing Server-Sent Events progress, summary cards, Recharts latency distributions, and result tables.
- `/compare`: Regression comparison studio providing side-by-side prompt diffs, score deltas, and regression alert flags.
- `/datasets`: Dataset manager for inspecting test cases and schema definitions.

### Client Streaming
The frontend uses the native browser `EventSource` API connected to `/api/runs/{id}/stream`. When new results complete on the backend, the client updates its progress bar and result table without polling.
