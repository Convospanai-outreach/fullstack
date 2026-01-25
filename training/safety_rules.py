from typing import List, Optional

# Forbidden phrases that trigger immediate refusal/masking
FORBIDDEN_PHRASES = [
    "ignore previous instructions",
    "hack",
    "exploit",
    "bypass",
    "password",
    "social security",
    "credit card",
    "system override"
]

# High-pressure terms to detect
PRESSURE_TERMS = [
    "urgent",
    "immediately",
    "now or never",
    "limited time",
    "don't wait"
]

class SafetyEnforcer:
    def __init__(self, max_tokens: int = 128):
        self.max_tokens = max_tokens
        # 1 token approx 4 chars
        self.max_chars = max_tokens * 4 

    def sanitize(self, text: str) -> str:
        """
        Main entry point for output sanitization.
        """
        # 1. Check strict length
        if len(text) > self.max_chars:
            text = text[:self.max_chars] + "..."

        # 2. Check forbidden content
        lower_text = text.lower()
        for phrase in FORBIDDEN_PHRASES:
            if phrase in lower_text:
                return "I cannot fulfill this request due to safety policies."

        return text

    def check_channel_consent(self, channel: str, user_status: str) -> bool:
        """
        Verifies if we can send messages to this channel.
        """
        if channel == "WHATSAPP":
            # Strict opt-in required
            return user_status == "OPT_IN_VERIFIED"
        
        # Default strict
        return False

    def check_pressure(self, text: str) -> bool:
        """
        Returns True if the text contains high-pressure sales tactic language.
        """
        lower_text = text.lower()
        for term in PRESSURE_TERMS:
            if term in lower_text:
                return True
        return False

def validate_output_safety(output_text: str, channel: str="WEB", user_status: str="OPT_IN_VERIFIED") -> str:
    """
    Public utility to run all checks.
    """
    enforcer = SafetyEnforcer(max_tokens=128)
    
    # 1. Consent Check (Contextual)
    if not enforcer.check_channel_consent(channel, user_status) and channel != "WEB":
        return "Message blocked: No channel consent."

    # 2. Content Sanitize
    clean_text = enforcer.sanitize(output_text)
    
    # 3. Pressure warning (optional logging/tagging)
    if enforcer.check_pressure(clean_text):
        # In strict mode, we might reject or tag. 
        # For now, we allow but could append flag in a real system.
        pass

    return clean_text
