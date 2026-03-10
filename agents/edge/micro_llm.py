from typing import Dict, Any, List, Optional
import json
import re

# ==============================================================================
# 1. LOCAL MICRO-LLM WRAPPER (Sovereign Edge Node)
# Processes PII, local routing, and intent classification entirely on-premise
# using tiny, quantization-friendly models (e.g. Phi-3-mini, Llama-3.2-1B)
# ==============================================================================

class MicroLLMEdgeNode:
    """
    Simulated implementation of the Local Micro-LLM inference engine.
    In a true production deployment, this would utilize `llama-cpp-python` or 
    `onnxruntime-genai` to run inference firmly within the enterprise firewall.
    """
    def __init__(self, model_path: str = "models/phi-3-mini-4k-instruct.gguf"):
        self.model_path = model_path
        self.is_loaded = False
        # self.llm = Llama(model_path=model_path, n_ctx=4096, n_gpu_layers=-1) # (Production)
        
    def load(self):
        """Loads the quantized model weights into Edge Node memory."""
        # Simulated loading
        self.is_loaded = True
        print(f"[EDGE NODE] Micro-LLM {self.model_path.split('/')[-1]} loaded into memory.")

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.1) -> str:
        """Generic inference wrapper."""
        if not self.is_loaded:
            raise RuntimeError("Model must be loaded before inference.")
            
        print(f"[EDGE NODE] Running local inference. Temperature: {temperature}")
        # Simulated generation logic for the dummy implementation
        return '{"example": "Generated text without touching the cloud!"}'

    # --- SOVEREIGN AGENT ZERO-SHOT INFERENCE TEMPLATES ---

    def extract_and_anonymize_pii(self, raw_text: str) -> Dict[str, Any]:
        """
        Agent: PIIExtractorAgent
        Capability: pii_detection, pii_tokenization
        Runs entirely on-prem to ensure compliance.
        """
        system_prompt = (
            "You are a strict PII extraction engine. Your ONLY job is to identify sensitive "
            "data (Names, Emails, Phone Numbers, Social Security Numbers) in the provided text "
            "and replace them with generic tokens like [NAME_1], [EMAIL_1], etc.\n\n"
            "You must output valid JSON STRICTLY matching this schema:\n"
            "{\n"
            "  \"anonymized_text\": \"string\",\n"
            "  \"extracted_entities\": [{\"type\": \"NAME|EMAIL|PHONE\", \"value\": \"string\", \"token\": \"string\"}]\n"
            "}"
        )
        
        user_prompt = f"Scrub this text:\n\n{raw_text}"
        
        # In production this calls `self.generate(f"{system_prompt}\n\n{user_prompt}")`
        # We mock the deterministic logic here for the spec verification
        
        print("[EDGE NODE] Executing `extract_and_anonymize_pii` inference...")
        
        # 1. Simple Regex fallback (a common hybrid approach for PII on-prem)
        email_regex = r'[\w\.-]+@[\w\.-]+\.\w+'
        phone_regex = r'\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}'
        
        anonymized = raw_text
        entities = []
        
        emails = re.findall(email_regex, raw_text)
        for idx, email in enumerate(emails, 1):
            token = f"[EMAIL_{idx}]"
            anonymized = anonymized.replace(email, token)
            entities.append({"type": "EMAIL", "value": email, "token": token})
            
        # 2. Simulate the LLM catching names (which Regex struggles with)
        if "John Doe" in raw_text:
            token = "[NAME_1]"
            anonymized = anonymized.replace("John Doe", token)
            entities.append({"type": "NAME", "value": "John Doe", "token": token})

        return {
            "status": "success",
            "anonymized_text": anonymized,
            "extracted_entities": entities,
            "llm_metric": {"model": "edge_micro", "tokens_used": 142}
        }

    def classify_intent(self, conversation_history: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Agent: IntentClassifierAgent
        Capability: intent_classification
        Determines what the lead is trying to do (e.g., meeting_request, soft_objection, hard_bounce)
        """
        system_prompt = (
            "You are an intent classification engine. Analyze the lead's latest message "
            "and classify their intent into exactly one of these categories: "
            "[meeting_request, soft_objection, hard_bounce, asking_for_info, unclassified].\n\n"
            "Output valid JSON ONLY: {\"intent\": \"category\", \"confidence\": 0.0-1.0}"
        )
        
        # Extract the last message from the lead
        last_message = next((msg["content"] for msg in reversed(conversation_history) if msg["role"] == "user"), "")
        
        print(f"[EDGE NODE] Classifying intent for: '{last_message}...'")
        
        # Mocking the inference result
        intent = "unclassified"
        confidence = 0.5
        
        msg_lower = last_message.lower()
        if "not interested" in msg_lower or "unsubscribe" in msg_lower:
            intent = "hard_bounce"
            confidence = 0.98
        elif "time on tuesday" in msg_lower or "send a calendar invite" in msg_lower or "let's chat" in msg_lower:
            intent = "meeting_request"
            confidence = 0.92
        elif "too expensive" in msg_lower or "we use a competitor" in msg_lower:
            intent = "soft_objection"
            confidence = 0.85
        elif "send more info" in msg_lower or "pdf" in msg_lower:
            intent = "asking_for_info"
            confidence = 0.88

        return {
            "status": "success",
            "intent": intent,
            "confidence": confidence,
            "llm_metric": {"model": "edge_micro", "tokens_used": 65}
        }

# ==============================================================================
# 2. PII VAULT INTEGRATION (Cryptography Layer)
# ==============================================================================

class PIIVault:
    """
    Encrypts sensitive data caught by the Edge Node before it hits PostgreSQL.
    AES-256-GCM encryption is used for data at rest.
    """
    def __init__(self, master_key: bytes):
        if len(master_key) != 32:
            raise ValueError("Master key must be exactly 32 bytes for AES-256")
        self.master_key = master_key
        # from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # (Production)

    def secure_store(self, extracted_entities: List[Dict[str, str]], tenant_id: str) -> Dict[str, str]:
        """
        Takes raw PII from the Micro-LLM, encrypts it, generates deterministic hashes
        for the Intelligence Domain, and returns the Vault tokens.
        """
        token_map = {}
        for entity in extracted_entities:
            # 1. Deterministic Hash (For Intelligence Domain joining without decryption)
            import hashlib
            raw_value = entity["value"].encode('utf-8')
            hashed_val = hashlib.sha256(raw_value + tenant_id.encode('utf-8')).hexdigest()
            
            # 2. Encrypt the raw value (AES-GCM omitted for mock)
            # aesgcm = AESGCM(self.master_key)
            # nonce = os.urandom(12)
            # encrypted_value = aesgcm.encrypt(nonce, raw_value, None)
            
            # 3. Store in Vault DB here (simulated)
            print(f"[VAULT] Securing {entity['type']} -> Hash: {hashed_val}...")
            
            # 4. Return token mapping for the safe outbound payload
            token_map[entity["token"]] = hashed_val
            
        return token_map


# -----------------------------------------------------------------------------
# Test runner for Sovereign Inference
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import secrets
    
    # 1. Initialize our Sovereign Edge
    edge_node = MicroLLMEdgeNode()
    edge_node.load()
    vault = PIIVault(master_key=secrets.token_bytes(32))
    
    # 2. Process an inbound PII-heavy email
    raw_email = "Hi, this is John Doe. Please send the healthcare contract to my email johndoe@enterprise.com by Tuesday. Let's chat."
    print(f"\n[INBOUND] Raw Text: {raw_email}")
    
    # 3. Micro-LLM extracts and anonymizes entirely on-prem
    extraction_result = edge_node.extract_and_anonymize_pii(raw_email)
    
    print(f"\n[EDGE] Anonymized Payload safe for Cloud: {extraction_result['anonymized_text']}")
    print(f"[EDGE] Entities to secure: {extraction_result['extracted_entities']}")
    
    # 4. Vault secures the PII
    tokens = vault.secure_store(extraction_result['extracted_entities'], tenant_id="tenant-123")
    
    # 5. Micro-LLM classifies intent (using anonymized text to be safe)
    intent_result = edge_node.classify_intent([{"role": "user", "content": extraction_result['anonymized_text']}])
    print(f"\n[EDGE] Intent Match: {intent_result['intent']} (Confidence: {intent_result['confidence']})")
