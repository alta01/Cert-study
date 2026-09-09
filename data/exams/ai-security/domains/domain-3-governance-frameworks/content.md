# AI Security Domain 3 — Governance & risk frameworks: NIST AI RMF, ISO 42001, EU AI Act (20%)

Quick-reference notes for AI governance frameworks. Pair with the 10 questions in `data/exams/ai-security.json` for this domain.

## NIST AI Risk Management Framework (AI RMF 1.0) — four functions

- **Iterative, not sequential.** The four functions are meant to be applied continuously across the AI lifecycle, not run once in a fixed order.
- **GOVERN** — the culture, policy, and accountability structures for managing AI risk across the organization: roles, responsibilities, risk tolerance, approval authority.
- **MAP** — establishes context: what the AI system is for, who is affected, what risks are foreseeable. Frames risk before it can be measured.
- **MEASURE** — assess, benchmark, and track risk using quantitative, qualitative, and mixed methods: metrics, testing, red-teaming.
- **MANAGE** — allocate resources to prioritize, respond to, and monitor risks that MAP/MEASURE identified: treat, transfer, avoid, or accept.

## NIST AI 600-1 — Generative AI Profile (12 GAI risk categories)

Companion profile to AI RMF 1.0 (published July 2024) that applies the four functions specifically to generative AI. Defines 12 GAI risk categories:

- CBRN information
- Confabulation (hallucination)
- Dangerous, violent, or hateful content
- Data privacy
- Environmental impacts
- Harmful bias and homogenization
- Human-AI configuration
- Information integrity
- Information security
- Intellectual property
- Obscene, degrading, and/or abusive content (including CSAM)
- Value chain and component integration

## ISO/IEC 42001:2023 — AI Management System (AIMS)

- First international standard for an **AI Management System (AIMS)** — certifiable, the same way ISO/IEC 27001 certifies an ISMS.
- Uses ISO's **harmonized structure**, clauses 4–10 (Context of the organization, Leadership, Planning, Support, Operation, Performance evaluation, Improvement) — the same scaffolding ISO 27001 uses, so an AIMS and an ISMS can be integrated and audited together.
- **Annex A = 38 controls across 9 control areas** (A.2–A.10).
- Applicability-based: an organization selects which Annex A controls apply and documents the inclusions/exclusions with justification in a **Statement of Applicability (SoA)** — the same mechanism ISO 27001 uses.
- Relationship to ISO 27001: shared harmonized structure enables a combined management system, but AIMS specifically addresses AI-lifecycle risks (e.g., bias, transparency, AI-specific data/model handling) that an ISMS alone does not cover.

## EU AI Act (Regulation (EU) 2024/1689)

- Risk-based regulation with **four risk tiers**:
  - **Unacceptable risk** — banned outright.
  - **High risk** — conformity assessment + human oversight + ongoing (post-market) monitoring obligations.
  - **Limited risk** — transparency obligations only (e.g., chatbot disclosure, deepfake labeling).
  - **Minimal risk** — no obligations.
- **General-Purpose AI (GPAI) models** are addressed under their own separate set of rules, distinct from the four-tier, specific-use-system obligations above.
- **Penalties:** fines up to €35M or 7% of global turnover.
- **Prohibitions** (the unacceptable-risk bans) have applied since **2025-02-02**.

## How the three frameworks interlock

- NIST AI RMF = a voluntary **process** for thinking about and managing AI risk; ISO/IEC 42001 = a **certifiable management system** standard for building and auditing an AIMS; the EU AI Act = binding **law** with tiered legal obligations and fines.

## Authoritative sources

- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- NIST AI Resource Center: https://airc.nist.gov/
- NIST AI 600-1 (Generative AI Profile, PDF): https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- ISO/IEC 42001:2023: https://www.iso.org/standard/81230.html
- EU AI Act — Regulation (EU) 2024/1689: https://eur-lex.europa.eu/eli/reg/2024/1689/oj
- Cloud Security Alliance: https://cloudsecurityalliance.org/

## Pairs with (context-vault labs)

lab-08-governance-capstone (STRIDE+ATLAS threat model → AIMS control set → AIBOM) in the context-vault repo.
