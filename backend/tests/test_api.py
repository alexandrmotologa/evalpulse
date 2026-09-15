import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_get_models(client):
    response = client.get("/api/models")
    assert response.status_code == 200
    models = response.json().get("models", [])
    assert len(models) > 0

def test_datasets_endpoints(client):
    response = client.get("/api/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert len(datasets) >= 2  # Seeded triage and extraction datasets

    ds_id = datasets[0]["id"]
    detail = client.get(f"/api/datasets/{ds_id}")
    assert detail.status_code == 200
    assert detail.json()["id"] == ds_id

def test_create_and_get_run(client):
    datasets_resp = client.get("/api/datasets")
    assert datasets_resp.status_code == 200
    dataset_id = datasets_resp.json()[0]["id"]

    run_payload = {
        "name": "Integration Test Run",
        "dataset_id": dataset_id,
        "prompt_template": "Classify: {{ticket_subject}}",
        "models": ["mock-gpt-4o"],
        "metrics": [{"metric": "semantic_similarity", "weight": 1.0, "threshold": 0.5}],
    }
    create_resp = client.post("/api/runs", json=run_payload)
    assert create_resp.status_code == 200
    run_data = create_resp.json()
    assert run_data["name"] == "Integration Test Run"

    run_id = run_data["id"]
    get_resp = client.get(f"/api/runs/{run_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == run_id
