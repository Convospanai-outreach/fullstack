import os
import logging
from llama_cpp import Llama

logger = logging.getLogger("llm_engine")

class Phi3Engine:
    """
    Ultra-fast wrapper for Phi-3 using Llama.cpp targeting Raspberry Pi / Edge hardware.
    Requirements:
    - No conversational history (stateless)
    - Very strict token limits to maximize speed.
    """
    def __init__(self):
        self.model_path = os.getenv("MODEL_PATH", "./models/phi-3-mini-4k-instruct-q4_k_m.gguf")
        self.n_threads = int(os.getenv("N_THREADS", "4"))
        self.llm = None
        
        try:
            if os.path.exists(self.model_path):
                logger.info(f"Loading model from {self.model_path} with {self.n_threads} threads...")
                self.llm = Llama(
                    model_path=self.model_path,
                    n_ctx=2048,           # Small context for speed
                    n_threads=self.n_threads,
                    verbose=False
                )
                logger.info("Phi-3 Model loaded successfully.")
            else:
                logger.warning(f"Model file not found at {self.model_path}. Inference will run in MOCK mode.")
                
        except Exception as e:
            logger.error(f"Failed to load model: {e}. Running in MOCK mode.")

    def infer(self, prompt: str, task_type: str = "GENERAL") -> dict:
        """
        Infers intent, evaluates text, or generates a short response.
        """
        # --- FAST MOCK MODE (If no model is downloaded yet on the Pi) ---
        if self.llm is None:
            logger.info(f"[MOCK] Inferring for task: {task_type}")
            return {
                "result": "MOCK_MODE_RESPONSE",
                "response": "This is a mock response because the GGUF model was not found.",
                "confidence": 0.99
            }
            
        # --- ACTUAL INFERENCE ---
        try:
            # Instruct format for Phi-3
            formatted_prompt = f"<|user|>\n{prompt}<|end|>\n<|assistant|>\n"
            
            output = self.llm(
                prompt=formatted_prompt,
                max_tokens=256,
                stop=["<|end|>", "<|user|>"],
                temperature=0.1 # Low temperature for analytical tasks
            )
            
            generated_text = output['choices'][0]['text'].strip()
            
            # Extract basic metric for the strict MicroLLMClient payload requirements
            # We estimate 0.90 for standard success
            return {
                "result": generated_text,
                "response": generated_text,
                "confidence": 0.90 
            }
            
        except Exception as e:
            logger.error(f"Inference failed: {e}")
            raise

phi3_engine = Phi3Engine()
