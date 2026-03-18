def generate_text(prompt: str) -> str:
    return prompt

def classify_text(text: str, labels: list[str] | None = None) -> tuple[str, float]:
    label = labels[0] if labels else "UNKNOWN"
    return label, 0.5
