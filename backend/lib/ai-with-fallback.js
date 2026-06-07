import claude from './claude.js';

/**
 * Calls Claude with the given parameters and returns the text response.
 * @param {Object} params - full params for claude.messages.create()
 * @returns {Promise<{ text: string, provider: 'claude' }>}
 */
export async function callWithFallback(params) {
  const message = await claude.messages.create(params);
  const text = message.content[0].text.trim();
  return { text, provider: 'claude' };
}
