import json
import re
import difflib
import math
from typing import Dict, Any, List, Tuple, Optional
import jsonschema
from jsonschema.exceptions import ValidationError

def extract_json_from_text(text: str) -> Optional[Any]:
    """Extract and parse JSON from text or markdown code blocks."""
    trimmed = text.strip()
    # Try direct parse
    try:
        return json.loads(trimmed)
    except Exception:
        pass
    
    # Try finding markdown code block ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", trimmed, re.IGNORECASE)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass
            
    # Try searching for outermost curly braces or brackets
    start_brace = trimmed.find("{")
    end_brace = trimmed.rfind("}")
    if start_brace != -1 and end_brace > start_brace:
        try:
            return json.loads(trimmed[start_brace : end_brace + 1])
        except Exception:
            pass

    return None

def calculate_exact_match(actual: str, expected: str, case_sensitive: bool = False, strip_whitespace: bool = True) -> float:
    """Calculate exact match ratio (1.0 or 0.0)."""
    if expected is None:
        return 1.0
    act = actual.strip() if strip_whitespace else actual
    exp = expected.strip() if strip_whitespace else expected
    if not case_sensitive:
        act = act.lower()
        exp = exp.lower()
    return 1.0 if act == exp else 0.0

def calculate_regex_match(actual: str, pattern: str) -> float:
    """Calculate whether the actual output satisfies a regular expression."""
    if not pattern:
        return 1.0
    try:
        match = re.search(pattern, actual, re.MULTILINE)
        return 1.0 if match else 0.0
    except re.error:
        return 0.0

def calculate_levenshtein_ratio(actual: str, expected: str) -> float:
    """Calculate string similarity ratio using sequence matching (0.0 to 1.0)."""
    if expected is None or actual is None:
        return 0.0
    matcher = difflib.SequenceMatcher(None, actual.strip().lower(), expected.strip().lower())
    return round(matcher.ratio(), 4)

def calculate_semantic_similarity(actual: str, expected: str) -> float:
    """
    Calculate semantic vector cosine similarity using term frequency and n-gram overlap.
    Provides fast, deterministic local scoring without heavy neural download delays.
    """
    if expected is None or actual is None:
        return 0.0
    
    s1 = actual.strip().lower()
    s2 = expected.strip().lower()
    if s1 == s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    # Build word unigrams and bigrams
    words1 = re.findall(r"\b\w+\b", s1)
    words2 = re.findall(r"\b\w+\b", s2)
    
    bigrams1 = [f"{words1[i]}_{words1[i+1]}" for i in range(len(words1) - 1)]
    bigrams2 = [f"{words2[i]}_{words2[i+1]}" for i in range(len(words2) - 1)]
    
    features1 = words1 * 2 + bigrams1
    features2 = words2 * 2 + bigrams2
    
    vocab = set(features1).union(set(features2))
    if not vocab:
        return 0.0

    v1: Dict[str, float] = {}
    v2: Dict[str, float] = {}
    for f in features1:
        v1[f] = v1.get(f, 0.0) + 1.0
    for f in features2:
        v2[f] = v2.get(f, 0.0) + 1.0

    dot_product = sum(v1.get(k, 0.0) * v2.get(k, 0.0) for k in vocab)
    mag1 = math.sqrt(sum(val ** 2 for val in v1.values()))
    mag2 = math.sqrt(sum(val ** 2 for val in v2.values()))
    if mag1 == 0.0 or mag2 == 0.0:
        return 0.0

    cos_sim = dot_product / (mag1 * mag2)
    return round(min(max(cos_sim, 0.0), 1.0), 4)

def validate_json_schema(output_text: str, schema: Dict[str, Any]) -> Tuple[bool, List[str], Optional[Any]]:
    """Validate output text against a JSON schema and return violations."""
    parsed = extract_json_from_text(output_text)
    if parsed is None:
        return False, ["Output could not be parsed as valid JSON"], None

    errors: List[str] = []
    try:
        validator = jsonschema.Draft7Validator(schema)
        for err in validator.iter_errors(parsed):
            path_str = " -> ".join(str(p) for p in err.absolute_path) or "root"
            errors.append(f"Field '{path_str}': {err.message}")
    except Exception as e:
        errors.append(f"Schema validator error: {str(e)}")

    return len(errors) == 0, errors, parsed

def evaluate_test_case(
    actual: str,
    expected: Optional[str],
    metrics: List[Dict[str, Any]],
    schema_definition: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, float], float, bool]:
    """
    Run all configured metrics on a test case output.
    Returns (scores_dict, composite_score, is_passed).
    """
    scores: Dict[str, float] = {}
    total_weight = 0.0
    weighted_sum = 0.0
    all_passed = True

    for m in metrics:
        metric_type = m.get("metric")
        weight = float(m.get("weight", 1.0))
        threshold = float(m.get("threshold", 0.8))
        params = m.get("params", {})
        score = 0.0

        if metric_type == "exact_match":
            score = calculate_exact_match(
                actual,
                expected or "",
                case_sensitive=params.get("case_sensitive", False),
            )
        elif metric_type == "regex":
            pattern = params.get("pattern", "")
            score = calculate_regex_match(actual, pattern)
        elif metric_type == "levenshtein":
            score = calculate_levenshtein_ratio(actual, expected or "")
        elif metric_type == "semantic_similarity":
            score = calculate_semantic_similarity(actual, expected or "")
        elif metric_type == "json_schema":
            target_schema = params.get("schema") or schema_definition
            if target_schema:
                is_valid, _, _ = validate_json_schema(actual, target_schema)
                score = 1.0 if is_valid else 0.0
            else:
                score = 1.0
        else:
            # Default fallback to similarity
            score = calculate_levenshtein_ratio(actual, expected or "")

        scores[metric_type] = score
        total_weight += weight
        weighted_sum += score * weight
        if score < threshold:
            all_passed = False

    composite = round(weighted_sum / total_weight, 4) if total_weight > 0 else 0.0
    return scores, composite, all_passed
