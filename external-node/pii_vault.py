import re
import uuid
import logging
from typing import Dict, Optional, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pii_vault")

class PIIVault:
    """
    In-memory vault for Sovereign PII Redaction.
    In a real production environment, this should be backed by Encrypted SQLite or Redis.
    """
    def __init__(self):
        # Maps masked ID -> original PII
        self._vault: Dict[string, Dict[string, str]] = {}
        
        self.PATTERNS = {
            'EMAIL': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'PHONE': r'\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b',
        }

    def sanitize(self, text: str) -> Tuple[str, str, Dict]:
        """Scans for PII, masks it, and stores the mapping."""
        token_map_id = str(uuid.uuid4())
        self._vault[token_map_id] = {}
        
        sanitized_text = text
        stats = {'EMAIL': 0, 'PHONE': 0}

        # Mask Emails
        for match in re.finditer(self.PATTERNS['EMAIL'], text):
            original = match.group()
            masked = f"[REDACTED-EMAIL-{uuid.uuid4().hex[:8]}]"
            sanitized_text = sanitized_text.replace(original, masked)
            self._vault[token_map_id][masked] = original
            stats['EMAIL'] += 1

        # Mask Phones
        for match in re.finditer(self.PATTERNS['PHONE'], text):
            original = match.group()
            masked = f"[REDACTED-PHONE-{uuid.uuid4().hex[:8]}]"
            sanitized_text = sanitized_text.replace(original, masked)
            self._vault[token_map_id][masked] = original
            stats['PHONE'] += 1
            
        logger.info(f"Sanitized text. Captured {sum(stats.values())} PII entities. Vault ID: {token_map_id}")

        return sanitized_text, token_map_id, stats

    def re_identify(self, masked_id: str, purpose: str) -> str:
        """Looks up a specific masked ID across all token maps."""
        logger.info(f"Re-identification requested for {masked_id} (Purpose: {purpose})")
        
        for token_map in self._vault.values():
            if masked_id in token_map:
                logger.info(f"Resolved Masked ID: {masked_id}")
                return token_map[masked_id]
                
        logger.warning(f"Masked ID not found in vault: {masked_id}")
        return None

pii_vault = PIIVault()
