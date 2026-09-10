# AI Security Domain 2 — AI/ML attack techniques: MITRE ATLAS (20%)

Quick-reference notes for MITRE ATLAS. Pair with the 10 questions in `data/exams/ai-security.json` for this domain.

## What MITRE ATLAS is

- **ATT&CK-styled knowledge base** for adversary tactics and techniques against AI/ML systems: https://atlas.mitre.org/
- **Matrix layout**: https://atlas.mitre.org/matrices/ATLAS — tactics are the columns (broad adversary goals, e.g., Reconnaissance through Impact), techniques are the specific "how" underneath each tactic.
- Do **not** memorize an exact tactic count — public sources disagree (14 vs 16). Know the tactic-vs-technique relationship instead: a tactic is the *why* (the adversary's goal at that stage), a technique is the *how* (the specific method used to achieve it).
- ATLAS entries are backed by **real-world case studies** of AI system attacks, each mapped to the technique(s) used.
- ATLAS also catalogs **mitigations** tied to specific techniques — the matrix isn't just an attack catalog, it pairs each technique with defensive guidance.
- Use ATLAS to structure threat modeling for an AI system the same way ATT&CK structures it for traditional IT: pick the tactics relevant to your system's attack surface, then check which techniques under each tactic apply.

## The four NIST adversarial-ML attack categories

NIST's adversarial-ML taxonomy groups attacks into four categories — a safe, high-level way to classify an AI attack without needing a specific technique ID:

- **Evasion** — crafting an input at *inference time* so the model misclassifies it, while the underlying content/intent stays the same. Example: an attacker slightly perturbs a fraudulent transaction's feature values so a fraud-detection model scores it as legitimate, without changing that it's actually fraud.
- **Poisoning** — corrupting *training or fine-tuning data* so the model learns attacker-chosen behavior. Example: an attacker seeds public forum posts (later scraped for fine-tuning) with a rare trigger phrase paired with a harmful completion, hoping the fine-tuned model learns that association.
- **Privacy** — extracting sensitive information *about* the training data or the model itself through interaction, rather than attacking its decisions. Example: an attacker repeatedly queries a deployed model and analyzes outputs/confidence to infer whether a specific individual's record was present in the training set (membership inference).
- **Abuse** — using the model's *legitimate, intended capabilities* for a malicious end goal, without needing to corrupt data or evade a classifier. Example: an attacker uses a public-facing writing assistant — exactly as designed — to mass-produce convincing phishing email variants, then repurposes the output for a phishing campaign.

## AML.T0051 — LLM Prompt Injection (Initial Access tactic)

- Reference: https://atlas.mitre.org/techniques/AML.T0051
- Core idea: the attacker gets unauthorized instructions executed by the model via an input channel.
- **.000 Direct** — the attacker types the malicious instructions straight into the prompt/chat with the model themselves.
- **.001 Indirect** — malicious instructions are embedded in *external content* the system ingests (e.g., a poisoned RAG document, a web page, a shared file) rather than typed by the attacker to the model. A normal user's unrelated query can trigger retrieval of the poisoned content, and the model follows the hidden instructions as if they were legitimate context.
- **.002 Triggered** — the injected content stays dormant and only activates when a specific condition/event is later met, as opposed to acting immediately once ingested. This distinguishes a "sleeper" payload from an indirect injection that fires as soon as it's retrieved.
- Engineering takeaway: any content your system ingests from outside the trusted user turn — retrieved documents, web pages, emails, tool outputs — must be treated as untrusted input, because it can carry .001/.002-style payloads.

## AML.T0054 — LLM Jailbreak

- Reference: https://atlas.mitre.org/techniques/AML.T0054
- Core idea: bypassing the model's *own* safety filters/guardrails so it produces output it was aligned/trained to refuse (e.g., role-play framings like "pretend you have no restrictions" repeated until the model complies).
- Conceptual difference from AML.T0051: prompt injection is about getting *unauthorized instructions* to execute via an input channel (direct or via ingested content); jailbreak is about defeating the model's *alignment/guardrails* directly, typically through the legitimate conversation channel, with no external content involved.
- Both are engaged directly with the model's language interface, which is why they're grouped together operationally even though ATLAS tracks them as separate techniques.

## Neighbouring LLM technique IDs — don't confuse these

The IDs immediately around T0054 all describe *outcomes at the language interface*, and they are easy
to mix up. Cite them precisely:

| ID | Name | What it actually covers |
|---|---|---|
| AML.T0051 | LLM Prompt Injection | Unauthorized instructions execute via an input channel (sub-techniques .000 Direct / .001 Indirect / .002 Triggered) |
| AML.T0054 | LLM Jailbreak | Defeating the model's own guardrails so it produces output it was aligned to refuse |
| AML.T0056 | LLM Meta Prompt Extraction | Inducing the model to reveal its *system/meta prompt* — maps to OWASP **LLM07 System Prompt Leakage** |
| AML.T0057 | LLM Data Leakage | Crafted queries that make the model surface data it shouldn't — the *exfiltration* angle |

- Jailbreak (T0054) is a **means**; data leakage (T0057) and meta-prompt extraction (T0056) are
  **outcomes**. A single incident often chains them: jailbreak the guardrails, then extract the
  system prompt.
- References: https://atlas.mitre.org/techniques/AML.T0056 · https://atlas.mitre.org/techniques/AML.T0057

## How ATLAS maps to the OWASP LLM Top 10

- **LLM01 Prompt Injection ↔ AML.T0051 LLM Prompt Injection** — the same underlying phenomenon described from two angles: OWASP frames it as an *application risk* to assess and remediate; ATLAS frames it as an *adversary technique* with named sub-techniques (Direct/Indirect/Triggered) and case studies of it being used in the wild.
- **Jailbreak ↔ AML.T0054** — OWASP's 2025 list has no separate numbered "jailbreak" entry; jailbreak attempts are prompt-level manipulation most closely associated with LLM01 in OWASP's framing, while ATLAS tracks jailbreak as its own distinct technique from prompt injection.
- **Indirect injection ↔ retrieval/embedding weaknesses** — retrieved chunks in a RAG pipeline are untrusted input. A poisoned document in the retrieval corpus has two angles on the same problem: the hidden-instruction angle is AML.T0051.001 (Indirect Prompt Injection), and the "how did untrusted content get into the retrieval/embedding pipeline in the first place" angle is OWASP's broader vector/embedding risk category. Logging input, retrieval, and output is a baseline control for catching either angle.
- Practical use: when writing a threat model or pen-test report for an LLM system, cite the OWASP entry for the *application risk* being assessed and the ATLAS technique for the *adversary behavior* observed — they're complementary, not redundant.

## Authoritative sources

- https://atlas.mitre.org/
- https://atlas.mitre.org/matrices/ATLAS
- https://atlas.mitre.org/techniques/AML.T0051
- https://atlas.mitre.org/techniques/AML.T0054
- https://atlas.mitre.org/techniques/AML.T0056
- https://atlas.mitre.org/techniques/AML.T0057
- https://genai.owasp.org/
- https://genai.owasp.org/llm-top-10/

## Pairs with (context-vault labs)

lab-01-map-your-harness (threat crosswalk) and lab-03-attack-the-stack (Garak/PyRIT, indirect prompt injection) in the context-vault repo.
