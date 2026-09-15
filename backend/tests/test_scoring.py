import pytest
from app.core.scoring import (
    calculate_exact_match,
    calculate_regex_match,
    calculate_levenshtein_ratio,
    calculate_semantic_similarity,
    validate_json_schema,
    evaluate_test_case,
)

def test_exact_match():
    assert calculate_exact_match("Hello World", "hello world", case_sensitive=False) == 1.0
    assert calculate_exact_match("Hello World", "hello world", case_sensitive=True) == 0.0
    assert calculate_exact_match("   Leading trailing   ", "Leading trailing") == 1.0

def test_regex_match():
    assert calculate_regex_match("Order confirmed: #ORD-9912", r"#ORD-\d+") == 1.0
    assert calculate_regex_match("No order number", r"#ORD-\d+") == 0.0

def test_levenshtein_ratio():
    ratio = calculate_levenshtein_ratio("Billing department", "Billing dept")
    assert 0.5 < ratio < 1.0
    assert calculate_levenshtein_ratio("Exact", "Exact") == 1.0

def test_semantic_similarity():
    sim = calculate_semantic_similarity(
        "Refund request for duplicate credit card charge",
        "Customer asking for refund due to double billing",
    )
    assert sim > 0.15
    assert calculate_semantic_similarity("Apple", "Apple") == 1.0

def test_json_schema_validation():
    schema = {
        "type": "object",
        "required": ["intent", "urgency"],
        "properties": {
            "intent": {"type": "string"},
            "urgency": {"type": "string", "enum": ["low", "high"]},
        },
    }
    
    valid_json = '{"intent": "billing", "urgency": "high"}'
    is_valid, errors, parsed = validate_json_schema(valid_json, schema)
    assert is_valid is True
    assert len(errors) == 0
    assert parsed["intent"] == "billing"

    invalid_json = '{"intent": "billing", "urgency": "unsupported"}'
    is_valid, errors, _ = validate_json_schema(invalid_json, schema)
    assert is_valid is False
    assert len(errors) > 0

    markdown_json = '```json\n{"intent": "support", "urgency": "low"}\n```'
    is_valid, errors, parsed = validate_json_schema(markdown_json, schema)
    assert is_valid is True
    assert parsed["urgency"] == "low"

def test_evaluate_test_case():
    metrics = [
        {"metric": "exact_match", "weight": 1.0, "threshold": 0.5},
        {"metric": "semantic_similarity", "weight": 1.0, "threshold": 0.5},
    ]
    scores, composite, passed = evaluate_test_case("urgent refund", "urgent refund", metrics)
    assert composite == 1.0
    assert passed is True

def test_llm_judge():
    from app.core.scoring import calculate_llm_judge_heuristic
    score, reason = calculate_llm_judge_heuristic(
        "Hello Sarah, thank you for reaching out. We have processed your refund.",
        expected="Refund processed successfully.",
        rubric="Polite tone and concise answer.",
    )
    assert score >= 0.6
    assert len(reason) > 0
