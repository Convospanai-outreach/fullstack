import logging
import os
from typing import Dict, Optional, Tuple

from cryptography.fernet import Fernet, InvalidToken
from presidio_analyzer import AnalyzerEngine
from sqlalchemy import text as sql_text

from database import GoldenRecord, PIITokenMap

logger = logging.getLogger(__name__)

DEFAULT_ENTITY_TYPES = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "LOCATION",
    "URL",
    "IP_ADDRESS",
    "CREDIT_CARD",
    "CRYPTO",
    "IBAN_CODE",
    "US_SSN",
    "IN_PAN",
    "IN_AADHAAR",
]

ENCRYPTED_PREFIX = "enc:v1:"


class LocalIntelligenceService:
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self.analyzer = None
        self.embedding_model = None
        self.llm = None
        self.fernet = self._build_fernet()
        self._analyzer_loaded = False
        self._embedding_loaded = False
        self._llm_loaded = False

    def _build_fernet(self) -> Optional[Fernet]:
        key = os.getenv("EDGE_VAULT_KEY")
        if not key:
            return None
        try:
            return Fernet(key.encode("utf-8"))
        except Exception as exc:
            raise RuntimeError("EDGE_VAULT_KEY must be a valid Fernet key") from exc

    def _encrypt_pii(self, value: str) -> str:
        if not self.fernet:
            raise RuntimeError("EDGE_VAULT_KEY is required before storing PII tokens")
        encrypted = self.fernet.encrypt(value.encode("utf-8")).decode("utf-8")
        return f"{ENCRYPTED_PREFIX}{encrypted}"

    def _decrypt_pii(self, value: str) -> Optional[str]:
        if not value.startswith(ENCRYPTED_PREFIX):
            return value
        if not self.fernet:
            logger.warning("PII token cannot be decrypted because EDGE_VAULT_KEY is not configured")
            return None
        try:
            encrypted = value.removeprefix(ENCRYPTED_PREFIX)
            return self.fernet.decrypt(encrypted.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            logger.warning("PII token decrypt failed")
            return None

    def load_analyzer(self):
        if self._analyzer_loaded:
            return
        logger.info("Initializing PII analyzer")
        preferred_model = os.getenv("EDGE_SPACY_MODEL")
        candidate_models = [preferred_model] if preferred_model else ["en_core_web_sm", "en_core_web_lg"]
        last_error = None

        for model_name in candidate_models:
            try:
                from presidio_analyzer.nlp_engine import NlpEngineProvider

                provider = NlpEngineProvider(
                    nlp_configuration={
                        "nlp_engine_name": "spacy",
                        "models": [{"lang_code": "en", "model_name": model_name}],
                    }
                )
                self.analyzer = AnalyzerEngine(nlp_engine=provider.create_engine())
                logger.info("PII analyzer loaded with %s", model_name)
                self._analyzer_loaded = True
                return
            except Exception as exc:
                last_error = exc

        raise RuntimeError(f"Failed to initialize PII analyzer: {last_error}")

    def load_embedding_model(self):
        if self._embedding_loaded:
            return
        logger.info("Initializing critic embedding model")
        try:
            from sentence_transformers import SentenceTransformer

            self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Critic model loaded")
        except Exception as exc:
            logger.error("Failed to load critic model: %s", exc)
        self._embedding_loaded = True

    def load_llm(self):
        if self._llm_loaded:
            return

        model_path = os.getenv("OFFLINE_MODEL_PATH", "./models/Phi-3-mini-4k-instruct.gguf")
        if not os.path.exists(model_path):
            logger.warning("Offline model not found at %s", model_path)
            self._llm_loaded = True
            return

        try:
            from llama_cpp import Llama

            self.llm = Llama(
                model_path=model_path,
                n_ctx=int(os.getenv("LLM_CONTEXT_TOKENS", "1536")),
                n_threads=int(os.getenv("LLM_THREADS", str(min(os.cpu_count() or 4, 4)))),
                n_batch=int(os.getenv("LLM_BATCH_SIZE", "128")),
                n_gpu_layers=int(os.getenv("LLM_GPU_LAYERS", "0")),
                verbose=os.getenv("LLM_VERBOSE", "false").lower() == "true",
            )
            logger.info("Offline LLM loaded from %s", model_path)
        except Exception as exc:
            logger.error("Failed to load offline LLM: %s", exc)
        self._llm_loaded = True

    def warmup(self, mode: str):
        if mode in {"pii", "all"}:
            self.load_analyzer()
        if mode in {"critic", "all"}:
            self.load_embedding_model()
        if mode in {"llm", "all"}:
            self.load_llm()

    def sanitize_and_tag(self, text: str, session_id: str) -> Tuple[str, Dict[str, int]]:
        self.load_analyzer()

        entities = os.getenv("PII_ENTITY_TYPES")
        entity_types = [item.strip() for item in entities.split(",")] if entities else DEFAULT_ENTITY_TYPES
        results = self.analyzer.analyze(text=text, language="en", entities=entity_types)
        sorted_results = sorted(results, key=lambda result: result.start, reverse=True)

        sanitized_text_list = list(text)
        token_stats: Dict[str, int] = {}
        new_db_tokens = []
        counters: Dict[str, int] = {}

        for result in sorted_results:
            entity_type = result.entity_type
            start = result.start
            end = result.end
            original_val = text[start:end]

            count = counters.get(entity_type, 0) + 1
            counters[entity_type] = count

            token_label = f"<{entity_type}_{count} confidence='{result.score:.2f}'>"
            sanitized_text_list[start:end] = list(token_label)

            token_id = f"{session_id}_{entity_type}_{count}"
            token = PIITokenMap(
                token_id=token_id,
                original_text=self._encrypt_pii(original_val),
                token_type=entity_type,
                session_id=session_id,
            )
            new_db_tokens.append(token)
            token_stats[entity_type] = count

        db = self.db_session_factory()
        try:
            if new_db_tokens:
                db.add_all(new_db_tokens)
                db.commit()
        finally:
            db.close()

        return "".join(sanitized_text_list), token_stats

    def reidentify_token(self, token_id: str, session_id: Optional[str] = None) -> Optional[str]:
        db = self.db_session_factory()
        try:
            query = db.query(PIITokenMap).filter(PIITokenMap.token_id == token_id)
            if session_id:
                query = query.filter(PIITokenMap.session_id == session_id)

            record = query.first()
            if record:
                return self._decrypt_pii(record.original_text)
            return None
        except Exception as exc:
            logger.error("Re-identification failed: %s", exc)
            return None
        finally:
            db.close()

    def critique_response(self, input_text: str) -> Dict:
        self.load_embedding_model()

        if not self.embedding_model:
            return {"status": "REJECTED", "score": 0.0, "reason": "System Offline: AI critique unavailable"}

        vector = self.embedding_model.encode(input_text).tolist()

        db = self.db_session_factory()
        try:
            count = db.query(GoldenRecord).count()
            if count == 0:
                return {"status": "REJECTED", "score": 0.0, "reason": "No Golden Records found for verification"}

            vector_str = str(vector)
            sql = sql_text(
                "SELECT quality_score, 1 - (embedding <=> :vector) as similarity "
                "FROM golden_records ORDER BY embedding <=> :vector LIMIT 1"
            )
            result = db.execute(sql, {"vector": vector_str}).fetchone()

            if not result:
                return {"status": "APPROVED", "score": 0.0, "reason": "No match found"}

            _quality, similarity = result
            similarity = float(similarity)

            if similarity < 0.8:
                return {
                    "status": "REJECTED",
                    "score": similarity,
                    "reason": f"Deviation from Golden Standard (Score: {similarity:.2f} < 0.8)",
                }

            return {"status": "APPROVED", "score": similarity}
        except Exception as exc:
            logger.error("Critique failed: %s", exc)
            return {"status": "ERROR", "score": 0.0, "reason": str(exc)}
        finally:
            db.close()

    def score_intent(self, text: str) -> int:
        self.load_llm()
        if not self.llm:
            return 50

        prompt = f"<|system|>\nRate frustration 0-100. Output ONLY number.\n<|user|>\n{text}\n<|assistant|>"
        try:
            output = self.llm(prompt, max_tokens=5, stop=["<|end|>", "\n"], temperature=0.1)
            raw_text = output["choices"][0]["text"].strip()
            score = int("".join(filter(str.isdigit, raw_text)))
            return min(max(score, 0), 100)
        except Exception as exc:
            logger.error("Intent scoring failed: %s", exc)
            return 50

    def generate_offline(self, prompt: str) -> str:
        self.load_llm()
        if not self.llm:
            return "[OFFLINE MODE] Local model not loaded."

        full_prompt = f"<|system|>\nYou are an offline assistant.\n<|user|>\n{prompt}\n<|assistant|>\n"
        try:
            output = self.llm(full_prompt, max_tokens=150, stop=["<|end|>", "\n\n"])
            return output["choices"][0]["text"].strip()
        except Exception as exc:
            logger.error("Offline generation failed: %s", exc)
            return "[OFFLINE MODE] Processing error."
