import json
from app.models.evaluation import EvaluationRun

def generate_html_report(run: EvaluationRun) -> str:
    """Generate a clean, self-contained HTML evaluation report."""
    results_rows = ""
    for r in run.results:
        status_color = "#10b981" if r.passed else "#f43f5e"
        status_text = "PASS" if r.passed else "FAIL"
        scores_badges = " ".join(
            f'<span style="background:#27272a;padding:2px 6px;border-radius:4px;font-size:11px;">{k}: {int(v*100)}%</span>'
            for k, v in r.scores.items()
        )
        results_rows += f"""
        <tr style="border-bottom: 1px solid #27272a;">
            <td style="padding: 10px; font-family: monospace; font-size: 12px; color: #a1a1aa;">{r.test_case_id}</td>
            <td style="padding: 10px; font-family: monospace; font-size: 12px; color: #818cf8;">{r.model}</td>
            <td style="padding: 10px; font-weight: 600; color: #f4f4f5;">{int(r.composite_score * 100)}%</td>
            <td style="padding: 10px;"><span style="background:{status_color}22;color:{status_color};padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;">{status_text}</span></td>
            <td style="padding: 10px; font-size: 12px; color: #d4d4d8;">{round(r.latency_ms)} ms</td>
            <td style="padding: 10px; font-size: 12px; color: #38bdf8;">${r.estimated_cost:.5f}</td>
            <td style="padding: 10px;">{scores_badges}</td>
        </tr>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EvalPulse Report — {run.name}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #09090b;
            color: #f4f4f5;
            margin: 0;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 1000px;
            margin: 0 auto;
        }}
        .header {{
            border-bottom: 1px solid #27272a;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .badge {{
            background: #6366f122;
            color: #818cf8;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 30px;
        }}
        .card {{
            background: #18181b;
            border: 1px solid #27272a;
            border-radius: 8px;
            padding: 16px;
        }}
        .card-label {{
            font-size: 12px;
            color: #71717a;
            margin-bottom: 6px;
        }}
        .card-value {{
            font-size: 24px;
            font-weight: 700;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            background: #18181b;
            border: 1px solid #27272a;
            border-radius: 8px;
            overflow: hidden;
        }}
        th {{
            background: #121215;
            padding: 12px 10px;
            text-align: left;
            font-size: 12px;
            color: #a1a1aa;
            border-bottom: 1px solid #27272a;
        }}
        .footer {{
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #71717a;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span class="badge">EvalPulse Benchmark Report</span>
                    <h1 style="margin: 10px 0 4px 0; font-size: 24px;">{run.name}</h1>
                    <div style="font-size: 12px; color: #a1a1aa;">
                        Run ID: {run.id} • Dataset: {run.dataset_id} • Executed: {run.created_at}
                    </div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-label">Pass Rate</div>
                <div class="card-value" style="color: #10b981;">{int(run.pass_rate * 100)}%</div>
            </div>
            <div class="card">
                <div class="card-label">p95 Latency</div>
                <div class="card-value" style="color: #fbbf24;">{round(run.p95_latency_ms)} ms</div>
            </div>
            <div class="card">
                <div class="card-label">Total Cost</div>
                <div class="card-value" style="color: #38bdf8;">${run.total_cost:.5f}</div>
            </div>
            <div class="card">
                <div class="card-label">Total Cells</div>
                <div class="card-value">{run.completed_tests} / {run.total_tests}</div>
            </div>
        </div>

        <h2>Detailed Test Case Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test ID</th>
                    <th>Model</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Cost</th>
                    <th>Metric Breakdown</th>
                </tr>
            </thead>
            <tbody>
                {results_rows}
            </tbody>
        </table>

        <div class="footer">
            Generated autonomously by EvalPulse LLM Evaluation & Regression Studio
        </div>
    </div>
</body>
</html>"""
