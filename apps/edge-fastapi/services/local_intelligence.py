import os
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import uuid

# ML / AI Libraries
# Note: In a real Jetson deployment, we'd use onnxruntime-gpu
from presidio_analyzer import AnalyzerEngine
from sentence_transformers import SentenceTransformer
# import llama_cpp # conditional import to avoid crash if not installed

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
        
        # Linkage Check: If custom path is set but file missing, warn and try default
        if not os.path.exists(model_path) and "Custom" in model_path:
            logger.warning(f"⚠️ Custom Model {model_path} not found. Falling back to default.")
            model_path = "./models/Phi-3-mini-4k-instruct.gguf"

        if os.path.exists(model_path):
            try:
                from llama_cpp import Llama
                self.llm = Llama(
                    model_path=model_path,
                    n_ctx=2048,
                    n_threads=4, # Adjust for RPi/Jetson
                    n_gpu_layers=0 # Set to -1 for full GPU on Jetson
                )
                logger.info(f"✅ Offline LLM Loaded ({model_path})")
            except Exception as e:
                logger.error(f"❌ Failed to load Offline LLM: {e}")
        else:
            logger.warning(f"⚠️ Offline model not found at {model_path} or default location.")

        self._models_loaded = True

    # --- Task 1: Sovereign Firewall (Taxonomy-Aware Masking) ---
    def sanitize_and_tag(self, text: str, session_id: str) -> Tuple[str, Dict]:
        """
        Detects PII and replaces with Metadata-Injected Tokens.
        Input: "Draft NDA for Rajesh at Wipro"
        Output: "Draft NDA for <PERSON_1 role='Unknown'> at <ORG_1 type='Unknown'>"
        """
        self.load_models() # Ensure loaded
        
        results = self.analyzer.analyze(text=text, language='en')
        sorted_results = sorted(results, key=lambda x: x.start, reverse=True)
        
        sanitized_text_list = list(text)
        token_stats = {}
        new_db_tokens = []
        
        # Context counters
        counters = {} # { "PERSON": 1, "ORG": 1 }

        for result in sorted_results:
            entity_type = result.entity_type
            start = result.start
            end = result.end
            original_val = text[start:end]
            
            # Update counter
            count = counters.get(entity_type, 0) + 1
            counters[entity_type] = count
            
            # Metadata Injection (Mocking 'role'/'sector' for now, GLiNER would infer this)
            # In a real GLiNER implementation, we'd extract these attributes.
            # For now, we use a placeholder attribute.
            meta_attr = ""
            if entity_type == "PERSON":
                meta_attr = " role='Executive'" # Simulation
            elif entity_type == "ORG":
                meta_attr = " sector='Enterprise'" # Simulation
            
            # Construct Token
            token_label = f"<{entity_type}_{count}{meta_attr}>"
            
            # Replace
            sanitized_text_list[start:end] = list(token_label)
            
            # DB Record
            token = PIITokenMap(
                token_id=f"{session_id}_{entity_type}_{count}",
                original_text=original_val,
                token_type=entity_type,
                session_id=session_id
            )
            new_db_tokens.append(token)
            
            token_stats[entity_type] = token_stats.get(entity_type, 0) + 1

        # Persist mappings
        db = self.db_session_factory()
        try:
            if new_db_tokens:
                db.add_all(new_db_tokens)
                db.commit()
        finally:
            db.close()

        return "".join(sanitized_text_list), token_stats

    def reidentify_token(self, token: str, session_id: Optional[str] = None) -> Optional[str]:
        """
        Reverse lookup for a token in the local PII Vault.
        """
        db = self.db_session_factory()
        try:
            query = db.query(PIITokenMap).filter(PIITokenMap.token_id == token)
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
        Returns { status, score, reason }
        """
        self.load_models()
        if not self.embedding_model:
             return {"status": "APPROVED", "score": 1.0, "reason": "System Offline (Fail Open)"}

        # 1. Vectorize
        vector = self.embedding_model.encode(input_text).tolist()
        
        db = self.db_session_factory()
        try:
            # 2. Check for "Cold Start"
            count = db.query(GoldenRecord).count()
            if count == 0:
                return {"status": "APPROVED", "score": 1.0, "reason": "Cold Start (No Golden Records)"}

            # 3. Similarity Search (pgvector)
            # 1 - (embedding <=> :vector) is Cosine Similarity
            vector_str = str(vector)
            sql = sql_text("SELECT quality_score, 1 - (embedding <=> :vector) as similarity FROM golden_records ORDER BY embedding <=> :vector LIMIT 1")
            result = db.execute(sql, {"vector": vector_str}).fetchone()

            if not result:
                return {"status": "APPROVED", "score": 0.0, "reason": "No match found"}

            quality, similarity = result
            similarity = float(similarity)

            # Threshold Check
            if similarity < 0.8: # Stricter threshold as per user prompt
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
        """
        Analyzes the text for 'Karmic Friction' (Anger/Frustration) using the offline model.
        Returns a score 0-100 (0 = Happy, 100 = Furious).
        """
        self.load_models()
        if not self.llm:
            logger.warning("Offline model not loaded, returning neutral score.")
            return 50 # Neutral fallback

        prompt = f"""<|system|>
You are an expert sentiment analyst. Rate the anger/frustration level of the following text on a scale of 0 to 100.
0 = Very Happy / Positive
50 = Neutral
100 = Extremely Angry / Threatening
Output ONLY the number.
<|user|>
Text: "{text}"
Score:
<|assistant|>"""
        
        try:
            output = self.llm(
                prompt,
                max_tokens=5, # We only need a number
                stop=["<|end|>", "\n"],
                echo=False,
                temperature=0.1 # Deterministic
            )
            raw_text = output['choices'][0]['text'].strip()
            # Extract digits
            score = int(''.join(filter(str.isdigit, raw_text)))
            return min(max(score, 0), 100) # Clamp 0-100
        except Exception as e:
            logger.error(f"Intent scoring failed: {e}")
            return 50

    # --- Task 3: Offline Fallback (Quantized SLM) ---
    def generate_offline(self, prompt: str) -> str:
        """
        Generates response using local GGUF model (Phi-3 / TinyLlama).
        """
        self.load_models()
        
        if not self.llm:
            return "⚠️ [OFFLINE MODE] Internet unavailable. Local model not loaded. Please restore connectivity."

        # System Prompt for Emergency Mode
        system_prompt = "You are an offline emergency assistant. Keep answers brief and professional."
        
        full_prompt = f"<|system|>\n{system_prompt}\n<|user|>\n{prompt}\n<|assistant|>\n"
        
        try:
            output = self.llm(
                full_prompt, 
                max_tokens=150, 
                stop=["<|end|>", "\n\n"], 
                echo=False
            )
            return output['choices'][0]['text'].strip()
        except Exception as e:
            logger.error(f"Offline generation failed: {e}")
            return "⚠️ [OFFLINE MODE] Processing error on local device."
