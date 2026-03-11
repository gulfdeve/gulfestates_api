/**
 * Translation utility for translating text between languages
 * Uses Google Translate's free API endpoint
 */

interface TranslationResponse {
  success: boolean;
  translatedText?: string;
  error?: string;
}

/**
 * Generic translation function
 * @param text - The text to translate
 * @param targetLang - Target language code (fr, es, etc.)
 * @returns Translated text
 */
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return text;
  }

  try {
    // Use Google Translate's free API endpoint
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      console.warn(`⚠️  Translation API returned status ${response.status} for ${targetLang}: ${text.substring(0, 50)}...`);
      return text; // Return original text if translation fails
    }

    const data = await response.json();
    
    // Google Translate API returns: [[["translated_text", ...], ...], ...]
    if (Array.isArray(data) && data[0] && Array.isArray(data[0]) && data[0][0] && Array.isArray(data[0][0])) {
      const translatedText = data[0][0][0];
      if (!translatedText || translatedText.trim() === '') {
        console.warn(`⚠️  Translation to ${targetLang} returned empty result for: ${text.substring(0, 50)}...`);
        return text; // Return original if translation is empty
      }
      return translatedText;
    }

    console.warn(`⚠️  Translation to ${targetLang} returned unexpected format for: ${text.substring(0, 50)}...`);
    return text;
  } catch (error: any) {
    console.error(`❌ Error translating text to ${targetLang}:`, error.message);
    // Return original text if translation fails
    return text;
  }
}

/**
 * Translate text from English to French
 * @param text - The text to translate
 * @returns Translated text in French
 */
export async function translateToFrench(text: string): Promise<string> {
  return translateText(text, 'fr');
}

/**
 * Translate text from English to Spanish
 * @param text - The text to translate
 * @returns Translated text in Spanish
 */
export async function translateToSpanish(text: string): Promise<string> {
  return translateText(text, 'es');
}

/**
 * Translate HTML content from English to target language
 * Preserves HTML tags while translating text content
 * @param html - The HTML content to translate
 * @param targetLang - Target language code (fr, es, etc.)
 * @returns Translated HTML content
 */
async function translateHtml(html: string, targetLang: string): Promise<string> {
  if (!html || typeof html !== 'string' || html.trim() === '') {
    return html;
  }

  try {
    // Extract text content from HTML (simple approach)
    // For better results, you might want to use a proper HTML parser
    let translatedHtml = html;

    // Translate text content while preserving HTML tags
    // This is a simplified approach - for production, consider using a proper HTML parser
    const textMatches = html.match(/[^<>]+(?=<|$)/g);
    
    if (textMatches) {
      for (const match of textMatches) {
        const trimmedMatch = match.trim();
        if (trimmedMatch && !trimmedMatch.startsWith('&') && trimmedMatch.length > 0) {
          // Skip HTML entities and very short text
          if (trimmedMatch.length > 2) {
            const translated = await translateText(trimmedMatch, targetLang);
            translatedHtml = translatedHtml.replace(match, translated);
          }
        }
      }
    }

    return translatedHtml;
  } catch (error: any) {
    console.error(`Error translating HTML to ${targetLang}:`, error.message);
    return html;
  }
}

/**
 * Translate HTML content from English to French
 * Preserves HTML tags while translating text content
 * @param html - The HTML content to translate
 * @returns Translated HTML content in French
 */
export async function translateHtmlToFrench(html: string): Promise<string> {
  return translateHtml(html, 'fr');
}

/**
 * Translate HTML content from English to Spanish
 * Preserves HTML tags while translating text content
 * @param html - The HTML content to translate
 * @returns Translated HTML content in Spanish
 */
export async function translateHtmlToSpanish(html: string): Promise<string> {
  return translateHtml(html, 'es');
}

/**
 * Translate an object with English text fields to French
 * @param obj - Object with English text fields
 * @param fields - Array of field names to translate
 * @returns Object with both English and French translations
 */
export async function translateObjectToFrench(
  obj: Record<string, any>,
  fields: string[] = ['title', 'description', 'location']
): Promise<Record<string, any>> {
  const translated: Record<string, any> = { ...obj };

  for (const field of fields) {
    if (obj[field] && typeof obj[field] === 'string' && obj[field].trim() !== '') {
      try {
        const frenchText = await translateToFrench(obj[field]);
        translated[field] = {
          en: obj[field],
          fr: frenchText
        };
      } catch (error: any) {
        console.error(`Error translating field ${field}:`, error.message);
        translated[field] = {
          en: obj[field],
          fr: obj[field] // Fallback to English if translation fails
        };
      }
    }
  }

  return translated;
}

/**
 * Add a small delay to avoid rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

