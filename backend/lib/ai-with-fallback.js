import claude from './claude.js';
import gemini from './gemini.js';

/**
 * Tries Claude first. On any failure, retries with Gemini Flash.
 * Returns the model's text response plus which provider produced it.
 *
 * @param {Object} claudeParams - full params for claude.messages.create()
 * @param {Function} buildGeminiPrompt - returns content array for gemini.generateContent()
 * @returns {Promise<{ text: string, provider: 'claude' | 'gemini' }>}
 */
export async function callWithFallback(claudeParams, buildGeminiPrompt) {
  try {
    const message = await claude.messages.create(claudeParams);
    const text = message.content[0].text.trim();
    return { text, provider: 'claude' };
  } catch (claudeErr) {
    console.warn('[ai-fallback] Claude failed:', claudeErr.message);
    console.warn('[ai-fallback] Falling back to Gemini Flash...');
  }

  try {
    const geminiContent = buildGeminiPrompt();
    const result = await gemini.generateContent(geminiContent);
    const text = result.response.text().trim();
    return { text, provider: 'gemini' };
  } catch (geminiErr) {
    console.error('[ai-fallback] Gemini also failed:', geminiErr.message);
    throw new Error(
      `Both AI providers failed. Last error: ${geminiErr.message}`
    );
  }
}
