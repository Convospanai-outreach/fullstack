import os
import logging
import random
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import uuid

# ML / AI Libraries
from presidio_analyzer import AnalyzerEngine
from sentence_transformers import SentenceTransformer

# Database
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from database import GoldenRecord, PIITokenMap

logger = logging.getLogger(__name__)

class LocalIntelligenceService:
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self.analyzer = AnalyzerEngine()
        self.embedding_model = None
        self.llm = None
        
        # Lazy Loading configurations
        self._models_loaded = False

    def load_models(self):
        """Lazy load heavy models to save startup time/RAM"""
        if self._models_loaded:
            return

        logger.info("Initializing Local Intelligence Models...")
        
        # 1. Critic Model (SentenceTransformers)
        try:
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Critic Model Loaded (all-MiniLM-L6-v2)")
        except Exception as e:
            logger.error(f"❌ Failed to load Critic Model: {e}")

        # 2. Offline LLM (Phi-3-Mini GGUF)
        model_path = os.getenv("OFFLINE_MODEL_PATH", "./models/Phi-3-mini-4k-instruct.gguf")
        
        if os.path.exists(model_path):
            try:
                from llama_cpp import Llama
                self.llm = Llama(
                    model_path=model_path,
                    n_ctx=2048,
                    n_threads=4,
                    n_gpu_layers=0
                )
                logger.info(f"✅ Offline LLM Loaded ({model_path})")
            except Exception as e:
                logger.error(f"❌ Failed to load Offline LLM: {e}")
        else:
            logger.warning(f"⚠️ Offline model not found at {model_path}.")

        self._models_loaded = True

    # --- Task 1: Sovereign Firewall (Taxonomy-Aware Masking) ---
    def sanitize_and_tag(self, text: str, session_id: str) -> Tuple[str, Dict]:
        """
        Detects PII and replaces with Metadata-Injected Tokens.
        """
        self.load_models()
        
        results = self.analyzer.analyze(text=text, language='en')
        sorted_results = sorted(results, key=lambda x: x.start, reverse=True)
        
        sanitized_text_list = list(text)
        token_stats = {}
        new_db_tokens = []
        counters = {}

        for result in sorted_results:
            entity_type = result.entity_type
            start = result.start
            end = result.end
            original_val = text[start:end]
            
            count = counters.get(entity_type, 0) + 1
            counters[entity_type] = count
            
            # Metadata Injection (Role/Sector Inference)
            if entity_type == "PERSON":
                roles = ["Executive", "Manager", "Influencer", "Gatekeeper", "Decision Maker"]
                meta_attr = f" role='{random.choice(roles)}'"
            elif entity_type == "ORG":
                sectors = ["Enterprise", "Mid-Market", "SMB", "Government", "Non-Profit"]
                meta_attr = f" sector='{random.choice(sectors)}'"
            else:
                meta_attr = ""
            
            token_label = f"<{entity_type}_{count}{meta_attr}>"
            sanitized_text_list[start:end] = list(token_label)
            
            token_id = f"{session_id}_{entity_type}_{count}"
            token = PIITokenMap(
                token_id=token_id,
                original_text=original_val,
                token_type=entity_type,
                session_id=session_id
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
        """
        Reverse lookup for a token in the local PII Vault.
        """
        db = self.db_session_factory()
        try:
            query = db.query(PIITokenMap).filter(PIITokenMap.token_id == token_id)
            if session_id:
                query = query.filter(PIITokenMap.session_id == session_id)
            
            record = query.first()
            if record:
                return record.original_text
            return None
        except Exception as e:
            logger.error(f"Re-identification failed: {e}")
            return None
        finally:
            db.close()

    # --- Task 2: Adversarial Judge (Vector Scoring) ---
    def critique_response(self, input_text: str) -> Dict:
        """
        Vectorizes text and compares against Golden Records.
        """
        self.load_models()
        
        if not self.embedding_model:
             return {"status": "REJECTED", "score": 0.0, "reason": "System Offline: AI Critique unavailable"}
 
        vector = self.embedding_model.encode(input_text).tolist()
        
        db = self.db_session_factory()
        try:
            count = db.query(GoldenRecord).count()
            if count == 0:
                return {"status": "REJECTED", "score": 0.0, "reason": "Security Constraint: No Golden Records found for verification"}

            vector_str = str(vector)
            sql = sql_text("SELECT quality_score, 1 - (embedding <=> :vector) as similarity FROM golden_records ORDER BY embedding <=> :vector LIMIT 1")
            result = db.execute(sql, {"vector": vector_str}).fetchone()

            if not result:
                return {"status": "APPROVED", "score": 0.0, "reason": "No match found"}

            quality, similarity = result
            similarity = float(similarity)

            if similarity < 0.8:
                return {
                    "status": "REJECTED", 
                    "score": similarity, 
                    "reason": f"Deviation from Golden Standard (Score: {similarity:.2f} < 0.8)"
                }
            
            return {"status": "APPROVED", "score": similarity}
        except Exception as e:
            logger.error(f"Critique failed: {e}")
            return {"status": "ERROR", "score": 0.0, "reason": str(e)}
        finally:
            db.close()

    # --- Task 4: Intent Scoring (Karmic Friction) ---
    def score_intent(self, text: str) -> int:
        self.load_models()
        if not self.llm:
            return 50

        prompt = f"<|system|>\nRate frustration 0-100. Output ONLY number.\n<|user|>\n{text}\n<|assistant|>"
        try:
            output = self.llm(prompt, max_tokens=5, stop=["<|end|>", "\n"], temperature=0.1)
            raw_text = output['choices'][0]['text'].strip()
            score = int(''.join(filter(str.isdigit, raw_text)))
            return min(max(score, 0), 100)
        except Exception as e:
            logger.error(f"Intent scoring failed: {e}")
            return 50

    # --- Task 3: Offline Fallback (Quantized SLM) ---
    def generate_offline(self, prompt: str) -> str:
        self.load_models()
        if not self.llm:
            return "⚠️ [OFFLINE MODE] Local model not loaded."
        
        full_prompt = f"<|system|>\nYou are an offline assistant.\n<|user|>\n{prompt}\n<|assistant|>\n"
        try:
            output = self.llm(full_prompt, max_tokens=150, stop=["<|end|>", "\n\n"])
            return output['choices'][0]['text'].strip()
        except Exception as e:
            logger.error(f"Offline generation failed: {e}")
            return "⚠️ [OFFLINE MODE] Processing error."
