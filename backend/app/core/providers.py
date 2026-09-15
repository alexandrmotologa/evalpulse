import asyncio
import json
import os
import random
import time
from typing import Optional, Dict, Any
from pydantic import BaseModel
import httpx

class ProviderResponse(BaseModel):
    output_text: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: float
    error: Optional[str] = None

class MockProvider:
    """Deterministic local simulator for instant demonstration without API keys."""
    
    @staticmethod
    async def generate(
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.0,
        expected_output: Optional[str] = None,
    ) -> ProviderResponse:
        t0 = time.perf_counter()
        
        # Model specific latency ranges
        if "flash" in model or "mini" in model or "8b" in model:
            base_delay = random.uniform(0.12, 0.28)
        else:
            base_delay = random.uniform(0.35, 0.75)
            
        await asyncio.sleep(base_delay)
        
        # Estimate input tokens (~4 chars per token)
        full_input = (system_prompt or "") + prompt
        prompt_tokens = max(10, int(len(full_input) / 4))
        
        # Determine output style
        # If expected output is provided, mock produces high-fidelity output with occasional variation
        if expected_output:
            if "triage" in prompt.lower() or "intent" in prompt.lower() or "support" in prompt.lower():
                try:
                    data = json.loads(expected_output)
                    # Introduce subtle model variation if temperature > 0.3
                    if temperature > 0.4 and random.random() < 0.2:
                        data["confidence"] = round(random.uniform(0.70, 0.89), 2)
                    output_text = json.dumps(data, indent=2)
                except Exception:
                    output_text = expected_output
            elif "invoice" in prompt.lower() or "extraction" in prompt.lower() or "amount" in prompt.lower():
                try:
                    data = json.loads(expected_output)
                    if temperature > 0.5 and random.random() < 0.15:
                        # intentional subtle variation
                        data["currency"] = data.get("currency", "USD").lower()
                    output_text = json.dumps(data, indent=2)
                except Exception:
                    output_text = expected_output
            else:
                output_text = expected_output
        else:
            # Generic structured answer
            output_text = f"Analyzed query using {model}. System prompt: {system_prompt or 'None'}."
            
        completion_tokens = max(15, int(len(output_text) / 4))
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        
        return ProviderResponse(
            output_text=output_text,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=latency_ms,
        )

async def call_openai(
    model: str,
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.0,
) -> ProviderResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return ProviderResponse(
            output_text="",
            prompt_tokens=0,
            completion_tokens=0,
            latency_ms=0,
            error="OPENAI_API_KEY environment variable is not configured",
        )
    
    t0 = time.perf_counter()
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": messages, "temperature": temperature},
            )
            resp.raise_for_status()
            data = resp.json()
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            usage = data.get("usage", {})
            return ProviderResponse(
                output_text=data["choices"][0]["message"]["content"],
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                latency_ms=latency_ms,
            )
    except Exception as e:
        return ProviderResponse(
            output_text="",
            prompt_tokens=0,
            completion_tokens=0,
            latency_ms=round((time.perf_counter() - t0) * 1000.0, 2),
            error=str(e),
        )

async def execute_prompt(
    model: str,
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.0,
    expected_output: Optional[str] = None,
) -> ProviderResponse:
    """Unified entry point routing to mock or real LLM provider."""
    normalized = model.lower().strip()
    
    # Check for mock models or missing API keys
    if normalized.startswith("mock-") or not os.getenv("OPENAI_API_KEY"):
        return await MockProvider.generate(
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            expected_output=expected_output,
        )
        
    if "gpt-" in normalized:
        return await call_openai(model, prompt, system_prompt, temperature)

    # Fallback to mock provider
    return await MockProvider.generate(
        model=model,
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=temperature,
        expected_output=expected_output,
    )
