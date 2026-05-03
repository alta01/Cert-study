/**
 * referenceLinkAgent.js
 *
 * Reference Linker Agent – enriches question objects with authoritative
 * documentation links using the LLM.
 */

import { getVendorRefs } from './referenceMap.js';

const MODEL = import.meta.env.VITE_LLM_MODEL ?? 'claude-3-5-sonnet-20241022';
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';

/**
 * Enriches the `references` field of each question with real documentation URLs.
 * Questions that already have a non-null `url` in all references are skipped.
 *
 * @param {object[]} questions
 * @param {object}   context  – { examName, domain }
 * @returns {Promise<object[]>}
 */
export async function enrichReferences(questions, context) {
  if (!API_KEY) return questions;

  const needsEnrichment = questions.filter(
    (q) => !q.references?.length || q.references.some((r) => !r.url)
  );

  if (!needsEnrichment.length) return questions;

  const prompt = `Given these exam questions for "${context.examName}" – "${context.domain}",
add or fix the "references" field for each question so that every entry has a real,
working URL pointing to official vendor documentation or whitepapers.
Return ONLY the updated JSON array with no markdown fences.

Questions:
${JSON.stringify(needsEnrichment, null, 2)}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) return questions; // fall back silently

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? '[]';
  let enriched;
  try {
    enriched = JSON.parse(raw);
  } catch {
    return questions;
  }

  // Merge enriched back into the original array
  const enrichedById = Object.fromEntries(enriched.map((q) => [q.id, q]));
  return questions.map((q) => enrichedById[q.id] ?? q);
}
