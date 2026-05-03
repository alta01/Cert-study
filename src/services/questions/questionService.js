/**
 * questionService.js
 *
 * Loads exam manifests and question data from the data/exams directory.
 * In a production app these would be API calls; here they use Vite's
 * dynamic import() to load JSON files at build time.
 */

/**
 * Loads the exam manifest and all domain questions for the given exam slug.
 *
 * @param {string} examSlug
 * @returns {Promise<{ exam: object, questions: object[] }>}
 */
export async function loadExamQuestions(examSlug) {
  let examManifest;
  try {
    const mod = await import(`../../../data/exams/${examSlug}/exam.json`);
    examManifest = mod.default;
  } catch {
    throw new Error(`Exam manifest not found for slug: ${examSlug}`);
  }

  const questions = [];
  for (const domain of examManifest.domains ?? []) {
    try {
      const mod = await import(
        `../../../data/exams/${examSlug}/domains/${domain.slug}/questions.json`
      );
      const domainQuestions = mod.default?.questions ?? [];
      questions.push(...domainQuestions);
    } catch {
      // Domain questions file missing – skip silently
    }
  }

  return { exam: examManifest, questions };
}

/**
 * Loads the Markdown study content for a specific domain.
 *
 * @param {string} examSlug
 * @param {string} domainSlug
 * @returns {Promise<string>} – raw Markdown string
 */
export async function loadDomainContent(examSlug, domainSlug) {
  const res = await fetch(`/data/exams/${examSlug}/domains/${domainSlug}/content.md`);
  if (!res.ok) throw new Error(`Content not found: ${examSlug}/${domainSlug}`);
  return res.text();
}
