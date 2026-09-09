# AI Security Domain 5 — Defensive controls & detection (15%)

Quick-reference notes for AI defensive controls. Pair with the 7 questions in `data/exams/ai-security.json` for this domain.

## Guardrail frameworks: Llama Guard, Prompt Guard, NeMo Guardrails

- **Llama Guard** (Meta, part of Purple Llama) = an input/output safety classifier — screens prompts before they reach the model and screens generations before they reach the user.
- **Prompt Guard** (Meta, part of Purple Llama) = a small classifier purpose-built for prompt-injection and jailbreak detection — run in front of the LLM call to catch both direct and indirect injection payloads and jailbreak attempts.
- **NeMo Guardrails** (NVIDIA) = a programmable rails framework — input rails, output rails, dialog rails, and retrieval rails, authored in Colang — for teams that need custom, auditable policy logic beyond a fixed classifier.
- **Choosing the right guardrail for the goal:** a narrow, purpose-built detection task (e.g., "catch injection/jailbreak attempts") calls for Prompt Guard; general content-safety screening of inputs and outputs calls for Llama Guard; custom dialog- or retrieval-stage policy that must be programmable and auditable calls for NeMo Guardrails. These are complementary, not mutually exclusive — a production pipeline can layer more than one.

## RAG pipeline security

- **Retrieved chunks are untrusted input** — the same trust tier as raw user input, not trusted system context. Every retrieved document must be treated as potentially adversarial before it is concatenated into the prompt.
- **Indirect prompt injection** — malicious instructions embedded in external content the system ingests (a poisoned RAG document or web page) that hijack the model's behavior once that content is retrieved and placed in context. This is the indirect-injection sub-technique of LLM prompt injection in the MITRE ATLAS taxonomy.
- **Retrieval/embedding poisoning** (OWASP LLM08 — Vector and Embedding Weaknesses) — an attacker manipulates the embedding or vector store, or seeds poisoned documents, so malicious content is preferentially retrieved for target queries.
- **Defense-in-depth for RAG:** log the input, retrieval, and output stages separately. Stage-separated logging lets an investigator trace an indirect-injection or poisoning incident back to the specific retrieved chunk that carried the payload, rather than only seeing the final blended prompt or output.

## Output handling

- **OWASP LLM05 — Improper Output Handling.** Treat all model output as untrusted — the same posture you'd take toward any other user-controlled input — before it is passed downstream.
- Encode, validate, and sanitize model output before it is used in a sensitive downstream context: HTML rendering (XSS), a SQL query, a shell command, or executed code. Do not implicitly trust generated content just because it originated from the model.
- Improper output handling is distinct from Excessive Agency (LLM06): LLM05 is about *how output is consumed* downstream (rendering/encoding/validation); LLM06 is about *how much autonomous action* the system is allowed to take with that output.

## MCP / agent hardening

- **Least-privilege tool scopes** — grant an agent or MCP tool only the specific actions it needs to do its job, not broad or admin-level API access "for convenience."
- **Identity-based auth, no static secrets** — tool/service identity should authenticate via short-lived, identity-based credentials rather than long-lived secrets embedded in configuration.
- **Policy broker / gateway authorizing each tool call** — a mediating layer that evaluates and authorizes every tool invocation (action + arguments) before it executes, rather than letting the model's tool call run straight through to the backend, especially for destructive actions.
- **Treat any tool argument derived from model output as untrusted** — allowlist-validate arguments (e.g., restrict a file path to an approved directory, restrict an ID to a known set) before executing the call. This directly mitigates **Excessive Agency (OWASP LLM06)**, where an agent takes damaging or out-of-scope actions because its permissions and argument validation were too loose.
- **MCP (Model Context Protocol)** is the interoperability layer connecting models to external tools and data sources; hardening the MCP tool surface (scopes, auth, brokered authorization, argument validation) is what keeps that connectivity from becoming an open door.

## Detection engineering & Google SAIF

- Build detection rules over **model I/O telemetry** — input, retrieval, and output logs together — to flag anomalies such as repeated injection-pattern attempts, unexpected spikes in output length/format, or unusual tool-call argument patterns.
- No single guardrail or classifier is a complete prevention guarantee; detection/monitoring is a necessary defense-in-depth layer alongside guardrails and hardened tool surfaces, not a replacement for them.
- **Google SAIF** (Secure AI Framework) is an overarching, practitioner-oriented framework for reasoning about AI system security end to end — a useful frame for tying guardrails, RAG hygiene, output handling, and agent/tool hardening together into one coherent program rather than isolated point controls.

## Authoritative sources

- OWASP GenAI project home: https://genai.owasp.org/
- OWASP LLM Top 10 2025 list: https://genai.owasp.org/llm-top-10/
- LLM05 Improper Output Handling: https://genai.owasp.org/llmrisk/llm05-improper-output-handling/
- LLM06 Excessive Agency: https://genai.owasp.org/llmrisk/llm06-excessive-agency/
- LLM08 Vector and Embedding Weaknesses: https://genai.owasp.org/llmrisk/llm08-vector-and-embedding-weaknesses/
- Purple Llama (Llama Guard, Prompt Guard): https://github.com/meta-llama/PurpleLlama
- NVIDIA NeMo Guardrails: https://github.com/NVIDIA/NeMo-Guardrails
- Google SAIF: https://saif.google/
- Model Context Protocol: https://modelcontextprotocol.io/
- NIST AI Resource Center: https://airc.nist.gov/

## Pairs with (context-vault labs)

lab-02-observable-rag, lab-04-guardrails-proxy, and lab-07-detection-and-mcp-hardening in the context-vault repo.
