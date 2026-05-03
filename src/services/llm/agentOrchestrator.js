/**
 * agentOrchestrator.js
 *
 * Coordinates multi-agent workflows:
 *   1. Question Generator Agent  → produces raw question objects
 *   2. Reference Linker Agent    → enriches references
 *   3. Exam Validator Agent      → validates schema compliance
 *
 * Each step is a pure async function that can be run independently or
 * chained together via orchestrateGeneration().
 */

import { generateQuestionsWithLLM } from './llmService.js';
import { enrichReferences } from './referenceLinkAgent.js';
import { validateQuestions } from './validatorAgent.js';

/**
 * Full generation pipeline: generate → enrich references → validate.
 *
 * @param {object} params – same as generateQuestionsWithLLM params
 * @param {object} options
 * @param {boolean} [options.enrichRefs=true]   – run the Reference Linker Agent
 * @param {boolean} [options.validate=true]     – run the Exam Validator Agent
 * @returns {Promise<{ questions: object[], report: object }>}
 */
export async function orchestrateGeneration(params, options = {}) {
  const { enrichRefs = true, validate = true } = options;

  // Step 1 – Generate
  let questions = await generateQuestionsWithLLM(params);

  // Step 2 – Enrich references (optional)
  if (enrichRefs) {
    questions = await enrichReferences(questions, params);
  }

  // Step 3 – Validate (optional)
  let report = null;
  if (validate) {
    report = validateQuestions(questions);
  }

  return { questions, report };
}
