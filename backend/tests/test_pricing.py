from app.core.pricing import calculate_cost, get_supported_models

def test_pricing_calculation():
    # gpt-4o: $2.50 / 1M in, $10.00 / 1M out
    # 1,000 in, 500 out -> (1000/1M * 2.50) + (500/1M * 10.00) = 0.0025 + 0.0050 = 0.0075
    cost = calculate_cost("gpt-4o", 1000, 500)
    assert cost == 0.0075

def test_mock_pricing():
    cost = calculate_cost("mock-gpt-4o", 2000, 1000)
    assert cost > 0.0

def test_free_model():
    cost = calculate_cost("mock-llama-3-8b", 5000, 2500)
    assert cost == 0.0

def test_supported_models():
    models = get_supported_models()
    assert len(models) >= 4
    assert any(m["id"] == "mock-gpt-4o" for m in models)
