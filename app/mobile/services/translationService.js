// services/translationService.js
// Auto-translation service using FREE LibreTranslate API

/**
 * Translates text using LibreTranslate (FREE and open source)
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language ('en' or 'es')
 * @param {string} targetLang - Target language ('en' or 'es')
 * @returns {Promise<string>} - Translated text
 */
export async function translateText(text, sourceLang = 'es', targetLang = 'en') {
  // If text is empty or same language, return original
  if (!text || !text.trim()) return text;
  if (sourceLang === targetLang) return text;

  try {
    // Using public LibreTranslate instance (FREE)
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text'
      })
    });

    if (!response.ok) {
      console.error('Translation API error:', response.status);
      // Fallback: return original text if translation fails
      return text;
    }

    const data = await response.json();
    return data.translatedText || text;

  } catch (error) {
    console.error('Translation error:', error);
    // Fallback: return original text if translation fails
    return text;
  }
}

/**
 * Detects the language of the text
 * @param {string} text - Text to detect language
 * @returns {Promise<string>} - Detected language code ('en', 'es', etc.)
 */
export async function detectLanguage(text) {
  if (!text || !text.trim()) return 'en';

  try {
    const response = await fetch('https://libretranslate.com/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text
      })
    });

    if (!response.ok) {
      return 'en'; // Default to English
    }

    const data = await response.json();
    // Returns array of detections, get the most confident one
    if (data && data.length > 0) {
      return data[0].language;
    }
    
    return 'en'; // Default to English

  } catch (error) {
    console.error('Language detection error:', error);
    return 'en'; // Default to English
  }
}

/**
 * Translates a comment automatically based on detected language
 * @param {string} comment - Comment text
 * @returns {Promise<object>} - Object with original and translated text
 */
export async function translateComment(comment) {
  if (!comment || !comment.trim()) {
    return {
      original: comment,
      translated: comment,
      originalLanguage: 'en'
    };
  }

  try {
    // Detect the language of the comment
    const detectedLang = await detectLanguage(comment);
    
    // If it's Spanish, translate to English
    if (detectedLang === 'es') {
      const translated = await translateText(comment, 'es', 'en');
      return {
        original: comment,
        translated: translated,
        originalLanguage: 'es'
      };
    }
    
    // If it's English or other language, no translation needed
    return {
      original: comment,
      translated: comment,
      originalLanguage: detectedLang
    };

  } catch (error) {
    console.error('Comment translation error:', error);
    return {
      original: comment,
      translated: comment,
      originalLanguage: 'en'
    };
  }
}

/**
 * Batch translate multiple texts (useful for loading multiple comments)
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} sourceLang - Source language
 * @param {string} targetLang - Target language
 * @returns {Promise<Array<string>>} - Array of translated texts
 */
export async function batchTranslate(texts, sourceLang = 'es', targetLang = 'en') {
  if (!texts || texts.length === 0) return [];

  try {
    const translations = await Promise.all(
      texts.map(text => translateText(text, sourceLang, targetLang))
    );
    return translations;
  } catch (error) {
    console.error('Batch translation error:', error);
    return texts; // Return originals if batch fails
  }
}
