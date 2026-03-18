import uuid

def tokenize(text: str) -> tuple[str, str]:
    token_map_id = f"tokenmap_{uuid.uuid4()}"
    sanitized = text
    return sanitized, token_map_id
