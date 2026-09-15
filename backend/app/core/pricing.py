from typing import Dict, Any

MODEL_PRICING: Dict[str, Dict[str, float]] = {
    # Rates per 1,000,000 tokens (USD)
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "deepseek-chat": {"input": 0.14, "output": 0.28},
    "llama-3-8b": {"input": 0.0, "output": 0.0},
    "llama-3-70b": {"input": 0.59, "output": 0.79},
    # Mock models for offline evaluation and instant demonstration
    "mock-gpt-4o": {"input": 2.50, "output": 10.00},
    "mock-claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "mock-gemini-1-5-pro": {"input": 1.25, "output": 5.00},
    "mock-llama-3-8b": {"input": 0.0, "output": 0.0},
}

DEFAULT_RATE = {"input": 1.00, "output": 3.00}

def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate token cost in USD given model and token counts."""
    normalized = model.lower().strip()
    rate = MODEL_PRICING.get(normalized, DEFAULT_RATE)
    
    input_cost = (prompt_tokens / 1_000_000.0) * rate["input"]
    output_cost = (completion_tokens / 1_000_000.0) * rate["output"]
    return round(input_cost + output_cost, 6)

def get_pricing_table() -> Dict[str, Dict[str, float]]:
    """Return all configured model pricing."""
    return MODEL_PRICING

def get_supported_models() -> list[Dict[str, Any]]:
    """Return list of models with metadata for UI selectors."""
    return [
        {
            "id": name,
            "name": name.replace("mock-", "").replace("-", " ").title(),
            "provider": "Mock / Local" if name.startswith("mock-") or name.startswith("llama") else name.split("-")[0].capitalize(),
            "inputPricePerM": rate["input"],
            "outputPricePerM": rate["output"],
            "isMock": name.startswith("mock-"),
        }
        for name, rate in MODEL_PRICING.items()
    ]
