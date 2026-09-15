import json
import sqlite3
from typing import List, Optional, Dict, Any
from app.config import DB_PATH
from app.models.dataset import Dataset, TestCase
from app.models.evaluation import EvaluationRun, TestCaseResult, RunComparison, DiffItem

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    conn = get_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                schema_definition TEXT,
                test_cases TEXT NOT NULL,
                created_at TEXT NOT NULL,
                version INTEGER DEFAULT 1
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS evaluation_runs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                dataset_id TEXT NOT NULL,
                prompt_template TEXT NOT NULL,
                system_prompt TEXT,
                models TEXT NOT NULL,
                status TEXT NOT NULL,
                total_tests INTEGER DEFAULT 0,
                completed_tests INTEGER DEFAULT 0,
                pass_rate REAL DEFAULT 0.0,
                avg_latency_ms REAL DEFAULT 0.0,
                p50_latency_ms REAL DEFAULT 0.0,
                p95_latency_ms REAL DEFAULT 0.0,
                total_cost REAL DEFAULT 0.0,
                total_tokens INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (dataset_id) REFERENCES datasets (id)
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS run_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                test_case_id TEXT NOT NULL,
                model TEXT NOT NULL,
                actual_output TEXT,
                expected_output TEXT,
                scores TEXT NOT NULL,
                composite_score REAL DEFAULT 0.0,
                passed BOOLEAN DEFAULT 0,
                latency_ms REAL DEFAULT 0.0,
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                estimated_cost REAL DEFAULT 0.0,
                error TEXT,
                FOREIGN KEY (run_id) REFERENCES evaluation_runs (id)
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_run_results_run_id ON run_results(run_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_evaluation_runs_dataset ON evaluation_runs(dataset_id);")
    conn.close()

def save_dataset(dataset: Dataset):
    conn = get_connection()
    with conn:
        conn.execute(
            """
            INSERT INTO datasets (id, name, description, schema_definition, test_cases, created_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                description=excluded.description,
                schema_definition=excluded.schema_definition,
                test_cases=excluded.test_cases,
                version=excluded.version;
            """,
            (
                dataset.id,
                dataset.name,
                dataset.description,
                json.dumps(dataset.schema_definition) if dataset.schema_definition else None,
                json.dumps([tc.model_dump() for tc in dataset.test_cases]),
                dataset.created_at,
                dataset.version,
            ),
        )
    conn.close()

def get_dataset(dataset_id: str) -> Optional[Dataset]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM datasets WHERE id = ?", (dataset_id,)).fetchone()
    conn.close()
    if not row:
        return None
    raw_tc = json.loads(row["test_cases"])
    return Dataset(
        id=row["id"],
        name=row["name"],
        description=row["description"] or "",
        schema_definition=json.loads(row["schema_definition"]) if row["schema_definition"] else None,
        test_cases=[TestCase(**tc) for tc in raw_tc],
        created_at=row["created_at"],
        version=row["version"],
    )

def list_datasets() -> List[Dataset]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM datasets ORDER BY created_at DESC").fetchall()
    conn.close()
    result = []
    for row in rows:
        raw_tc = json.loads(row["test_cases"])
        result.append(
            Dataset(
                id=row["id"],
                name=row["name"],
                description=row["description"] or "",
                schema_definition=json.loads(row["schema_definition"]) if row["schema_definition"] else None,
                test_cases=[TestCase(**tc) for tc in raw_tc],
                created_at=row["created_at"],
                version=row["version"],
            )
        )
    return result

def save_run(run: EvaluationRun):
    conn = get_connection()
    with conn:
        conn.execute(
            """
            INSERT INTO evaluation_runs (
                id, name, dataset_id, prompt_template, system_prompt, models,
                status, total_tests, completed_tests, pass_rate, avg_latency_ms,
                p50_latency_ms, p95_latency_ms, total_cost, total_tokens,
                created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status=excluded.status,
                total_tests=excluded.total_tests,
                completed_tests=excluded.completed_tests,
                pass_rate=excluded.pass_rate,
                avg_latency_ms=excluded.avg_latency_ms,
                p50_latency_ms=excluded.p50_latency_ms,
                p95_latency_ms=excluded.p95_latency_ms,
                total_cost=excluded.total_cost,
                total_tokens=excluded.total_tokens,
                completed_at=excluded.completed_at;
            """,
            (
                run.id,
                run.name,
                run.dataset_id,
                run.prompt_template,
                run.system_prompt,
                json.dumps(run.models),
                run.status,
                run.total_tests,
                run.completed_tests,
                run.pass_rate,
                run.avg_latency_ms,
                run.p50_latency_ms,
                run.p95_latency_ms,
                run.total_cost,
                run.total_tokens,
                run.created_at,
                run.completed_at,
            ),
        )
        if run.results:
            conn.execute("DELETE FROM run_results WHERE run_id = ?", (run.id,))
            for r in run.results:
                conn.execute(
                    """
                    INSERT INTO run_results (
                        run_id, test_case_id, model, actual_output, expected_output,
                        scores, composite_score, passed, latency_ms, prompt_tokens,
                        completion_tokens, total_tokens, estimated_cost, error
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run.id,
                        r.test_case_id,
                        r.model,
                        r.actual_output,
                        r.expected_output,
                        json.dumps(r.scores),
                        r.composite_score,
                        1 if r.passed else 0,
                        r.latency_ms,
                        r.prompt_tokens,
                        r.completion_tokens,
                        r.total_tokens,
                        r.estimated_cost,
                        r.error,
                    ),
                )
    conn.close()

def get_run(run_id: str) -> Optional[EvaluationRun]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM evaluation_runs WHERE id = ?", (run_id,)).fetchone()
    if not row:
        conn.close()
        return None
    
    res_rows = conn.execute("SELECT * FROM run_results WHERE run_id = ?", (run_id,)).fetchall()
    conn.close()

    results = []
    for r in res_rows:
        results.append(
            TestCaseResult(
                test_case_id=r["test_case_id"],
                model=r["model"],
                actual_output=r["actual_output"] or "",
                expected_output=r["expected_output"],
                scores=json.loads(r["scores"]) if r["scores"] else {},
                composite_score=r["composite_score"],
                passed=bool(r["passed"]),
                latency_ms=r["latency_ms"],
                prompt_tokens=r["prompt_tokens"],
                completion_tokens=r["completion_tokens"],
                total_tokens=r["total_tokens"],
                estimated_cost=r["estimated_cost"],
                error=r["error"],
            )
        )

    return EvaluationRun(
        id=row["id"],
        name=row["name"],
        dataset_id=row["dataset_id"],
        prompt_template=row["prompt_template"],
        system_prompt=row["system_prompt"],
        models=json.loads(row["models"]),
        status=row["status"],
        total_tests=row["total_tests"],
        completed_tests=row["completed_tests"],
        pass_rate=row["pass_rate"],
        avg_latency_ms=row["avg_latency_ms"],
        p50_latency_ms=row["p50_latency_ms"],
        p95_latency_ms=row["p95_latency_ms"],
        total_cost=row["total_cost"],
        total_tokens=row["total_tokens"],
        created_at=row["created_at"],
        completed_at=row["completed_at"],
        results=results,
    )

def list_runs(limit: int = 50) -> List[EvaluationRun]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM evaluation_runs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    runs = []
    for row in rows:
        runs.append(
            EvaluationRun(
                id=row["id"],
                name=row["name"],
                dataset_id=row["dataset_id"],
                prompt_template=row["prompt_template"],
                system_prompt=row["system_prompt"],
                models=json.loads(row["models"]),
                status=row["status"],
                total_tests=row["total_tests"],
                completed_tests=row["completed_tests"],
                pass_rate=row["pass_rate"],
                avg_latency_ms=row["avg_latency_ms"],
                p50_latency_ms=row["p50_latency_ms"],
                p95_latency_ms=row["p95_latency_ms"],
                total_cost=row["total_cost"],
                total_tokens=row["total_tokens"],
                created_at=row["created_at"],
                completed_at=row["completed_at"],
                results=[],
            )
        )
    return runs

def compare_runs(base_run_id: str, candidate_run_id: str) -> Optional[RunComparison]:
    base_run = get_run(base_run_id)
    candidate_run = get_run(candidate_run_id)
    if not base_run or not candidate_run:
        return None

    # Map candidate results by (test_case_id, model)
    cand_map: Dict[tuple, TestCaseResult] = {
        (r.test_case_id, r.model): r for r in candidate_run.results
    }

    diff_items: List[DiffItem] = []
    regressions = 0
    improvements = 0
    unchanged = 0

    for base_res in base_run.results:
        key = (base_res.test_case_id, base_res.model)
        cand_res = cand_map.get(key)
        if not cand_res:
            continue

        score_delta = round(cand_res.composite_score - base_res.composite_score, 4)
        if score_delta < -0.05 or (base_res.passed and not cand_res.passed):
            status = "regression"
            regressions += 1
        elif score_delta > 0.05 or (not base_res.passed and cand_res.passed):
            status = "improved"
            improvements += 1
        else:
            status = "unchanged"
            unchanged += 1

        diff_items.append(
            DiffItem(
                test_case_id=base_res.test_case_id,
                model=base_res.model,
                base_output=base_res.actual_output,
                candidate_output=cand_res.actual_output,
                expected_output=base_res.expected_output,
                base_score=base_res.composite_score,
                candidate_score=cand_res.composite_score,
                score_delta=score_delta,
                base_latency_ms=base_res.latency_ms,
                candidate_latency_ms=cand_res.latency_ms,
                base_cost=base_res.estimated_cost,
                candidate_cost=cand_res.estimated_cost,
                status=status,
            )
        )

    return RunComparison(
        base_run_id=base_run.id,
        candidate_run_id=candidate_run.id,
        base_run_name=base_run.name,
        candidate_run_name=candidate_run.name,
        pass_rate_delta=round(candidate_run.pass_rate - base_run.pass_rate, 4),
        latency_p95_delta_ms=round(candidate_run.p95_latency_ms - base_run.p95_latency_ms, 2),
        cost_delta=round(candidate_run.total_cost - base_run.total_cost, 6),
        regressions_count=regressions,
        improvements_count=improvements,
        unchanged_count=unchanged,
        diff_items=diff_items,
    )
