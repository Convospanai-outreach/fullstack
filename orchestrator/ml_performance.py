import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import HDBSCAN
from sentence_transformers import SentenceTransformer
from scipy.spatial.distance import cosine

# ==============================================================================
# 1. CONVERSION PROBABILITY MODEL (Predictive Scoring)
# Logistic Regression to predict meeting booking likelihood based on behavior
# ==============================================================================

class ConversionPredictor:
    def __init__(self):
        self.model = LogisticRegression(class_weight='balanced', random_state=42)
        self.scaler = StandardScaler()
        # Define features explicitly based on the schema and behavioral data
        self.features = [
            'engagement_score',     # 0.0 to 1.0 (email opens, link clicks)
            'sentiment_trend',      # -1.0 to 1.0 (from Lead Intelligence)
            'days_since_first_touch', # Time decay context
            'total_touchpoints',    # Volume metric
            'industry_match_score'  # How well the playbook fits the lead's industry (0-1)
        ]
        self.is_trained = False

    def train(self, historical_data: pd.DataFrame):
        """Train the model on historical lead conversion data."""
        if not all(f in historical_data.columns for f in self.features):
            raise ValueError(f"Training data must contain features: {self.features}")
            
        if 'converted' not in historical_data.columns:
            raise ValueError("Training data must contain target variable 'converted' (1/0)")

        X = historical_data[self.features]
        y = historical_data['converted']
        
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self.is_trained = True

    def predict_conversion_probability(self, lead_features: Dict[str, float]) -> float:
        """Predict the likelihood (0.0 to 1.0) of a lead booking a meeting."""
        if not self.is_trained:
            raise RuntimeError("Model must be trained before inference.")
            
        feature_vector = pd.DataFrame([lead_features], columns=self.features)
        scaled_vector = self.scaler.transform(feature_vector)
        
        # Get the probability of the positive class (class 1)
        probability = self.model.predict_proba(scaled_vector)[0][1]
        return float(probability)

# ==============================================================================
# 2. OBJECTION CLUSTERING MODEL (Emerging Theme Detection)
# Embeds semantic objections and groups them to surface gaps in playbooks
# ==============================================================================

class ObjectionAnalyzer:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        # Using a fast, local embedding model suitable for edge deployments
        self.embedder = SentenceTransformer(model_name)
        # HDBSCAN is robust to noise and doesn't require pre-defining K
        self.clusterer = HDBSCAN(min_cluster_size=3, min_samples=2, metric='euclidean')

    def analyze_objections(self, objections: List[str]) -> Dict[str, Any]:
        """Embed objections, cluster them, and return emerging themes."""
        if len(objections) < 3:
            return {"status": "insufficient_data"}

        # 1. Generate embeddings (shape: [num_objections, 384])
        embeddings = self.embedder.encode(objections)
        
        # 2. Perform clustering
        cluster_labels = self.clusterer.fit_predict(embeddings)
        
        # 3. Aggregate results
        results = {}
        for idx, label in enumerate(cluster_labels):
            if label == -1: # Noise / Outlier bucket in HDBSCAN
                cluster_id = "unclassified_noise"
            else:
                cluster_id = f"cluster_{label}"
                
            if cluster_id not in results:
                results[cluster_id] = {
                    "objection_texts": [],
                    "size": 0,
                    # Store center vector to represent the semantic core of the theme
                    "centroid": np.zeros(embeddings.shape[1]) 
                }
                
            results[cluster_id]["objection_texts"].append(objections[idx]) # type: ignore
            results[cluster_id]["centroid"] += embeddings[idx]
            results[cluster_id]["size"] = int(results[cluster_id]["size"]) + 1  # type: ignore

        # 4. Finalize centroids and find emerging themes
        emerging_themes = []
        for c_id, data in results.items():
            if c_id == "unclassified_noise": continue
            
            # Average the vectors
            data["centroid"] = data["centroid"] / float(data["size"]) # type: ignore
            
            # If a cluster hits a certain size, flag it as an emerging theme
            # This triggers the Self-Critic agent to generate a new handling script
            if int(data["size"]) >= 5: # type: ignore 
                emerging_themes.append({
                    "cluster_id": c_id,
                    "volume": data["size"],
                    "representative_sample": data["objection_texts"][0] # type: ignore
                })

        return {
            "status": "success",
            "total_analyzed": len(objections),
            "clusters_found": len(results) - (1 if "unclassified_noise" in results else 0),
            "emerging_themes_detected": emerging_themes,
            "detailed_clusters": results
        }

# ==============================================================================
# 3. UPLIFT MODEL (A/B Test Verification & Promotion)
# Ensures new generated playbooks mathematically outperform the baseline
# ==============================================================================

class PlaybookUpliftEvaluator:
    def __init__(self, significance_threshold: float = 0.05, min_uplift_req: float = 0.10):
        self.alpha_threshold = significance_threshold # p-value limit
        self.min_uplift = min_uplift_req # Require at least 10% relative improvement

    def evaluate_ab_test(self, 
                       playbook_a_name: str, a_conversions: int, a_total: int,
                       playbook_b_name: str, b_conversions: int, b_total: int) -> Dict[str, Any]:
        """
        Evaluate logic for A (Baseline) vs B (Challenger) playbook performance.
        Includes basic statistical significance check (Z-test for proportions).
        """
        from scipy.stats import norm
        
        if a_total == 0 or b_total == 0:
            return {"status": "insufficient_data", "message": "Zero volume in test group"}

        # Conversion Rates
        cr_a = a_conversions / a_total
        cr_b = b_conversions / b_total
        
        # Relative Uplift
        if cr_a == 0:
            relative_uplift = float('inf') if cr_b > 0 else 0.0
        else:
            relative_uplift = (cr_b - cr_a) / cr_a

        # Two-proportion Z-test for statistical significance
        pooled_prob = (a_conversions + b_conversions) / (a_total + b_total)
        standard_error = np.sqrt(pooled_prob * (1 - pooled_prob) * (1/a_total + 1/b_total))
        
        z_score = (cr_b - cr_a) / standard_error if standard_error > 0 else 0
        p_value = norm.sf(abs(float(z_score))) * 2 # Two-tailed test

        is_significant = p_value < self.alpha_threshold
        is_meaningful_uplift = relative_uplift >= self.min_uplift
        should_promote = is_significant and is_meaningful_uplift

        return {
            "baseline": playbook_a_name,
            "baseline_cr": float(f"{cr_a:.4f}"),
            "challenger": playbook_b_name,
            "challenger_cr": float(f"{cr_b:.4f}"),
            "relative_uplift": float(f"{relative_uplift:.4f}"),
            "p_value": float(f"{p_value:.5f}"),
            "is_statistically_significant": is_significant,
            "should_promote_challenger": should_promote,
            "decision_reasoning": (
                f"Challenger CR ({cr_b:.2%}) vs Baseline CR ({cr_a:.2%}). "
                f"Uplift is {relative_uplift:.2%}. "
                f"P-Value {p_value:.4f} {'<=' if is_significant else '>'} threshold {self.alpha_threshold}."
            )
        }
