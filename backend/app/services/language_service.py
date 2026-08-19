from langdetect import detect, detect_langs
import logging

logger = logging.getLogger(__name__)

def detect_language(text: str) -> str:
    """
    Detects if the text is Tamil (ta) or English (en).
    Default to 'en' if detection fails.
    """
    try:
        if not text or len(text.strip()) == 0:
            return 'en'
        lang = detect(text)
        if lang == 'ta':
            return 'ta'
        # Default fallback to English for anything else
        return 'en'
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        return 'en'
