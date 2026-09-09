# AI Security Domain 4 — Model & MLOps supply chain (20%)

Quick-reference notes for AI/ML supply-chain security. Pair with the 10 questions in `data/exams/ai-security.json` for this domain.

## Weight formats: pickle risk vs safetensors

- **Pickle-based formats execute code on load.** `.bin`, `.pt`, `.ckpt` files saved via Python's `pickle` (or `torch.save`, which pickles under the hood) can embed arbitrary object-construction calls. Unpickling with `torch.load()` (or plain `pickle.load()`) runs that code — a malicious checkpoint downloaded from a model hub can achieve code execution the moment it's loaded, with no separate "run" step.
- **safetensors is safe by design.** The safetensors format stores only raw tensor data plus a JSON header describing shapes/dtypes — there is no opcode stream to execute, so loading a `.safetensors` file cannot trigger code execution. Prefer safetensors for any model weights pulled from an external source (model hub, vendor, community fine-tune).
- **Practical rule:** when a hub only offers a pickle-format checkpoint, convert to safetensors (or scan first — see below) before it ever reaches a `torch.load` in a pipeline that isn't fully sandboxed.

## Scanning model files: picklescan and modelscan

- **picklescan** statically inspects a pickle stream for dangerous opcodes/imports (e.g., calls to `os.system`, `subprocess`, `eval`) without executing it, and flags the file as unsafe if it finds them.
- **modelscan** (Protect AI) generalizes this across multiple model-serialization formats — pickle, Keras/HDF5, and others — looking for the same class of "unsafe operator" risk baked into a saved model file.
- **When to run:** before load — as a pre-load gate on anything pulled from outside your own trusted build (a downloaded checkpoint, a community fine-tune) — and again in CI, as an automated step on every model artifact that enters the pipeline, not just at first download. A model that scans clean today can be replaced upstream tomorrow, so CI re-scanning matters as much as the first scan.

## Signing & provenance: Sigstore/cosign, SLSA

- **Sigstore/cosign** signs and verifies build artifacts (including model artifacts and containers) using **keyless signing**: the signer authenticates via OIDC (identity federation) instead of managing a long-lived private key, and the signature plus signing identity is recorded in a public **transparency log**. Verification checks the artifact's signature against that log rather than trusting an unverifiable claim of provenance.
- **SLSA** defines supply-chain integrity **levels** — build/provenance guarantees about how an artifact was produced (source control, build isolation, provenance attestation) — that can be enforced as a policy gate in CI/CD (e.g., "reject any model artifact without a qualifying SLSA provenance attestation").
- Signing answers "did this artifact come from where we think, unmodified" — it does not by itself answer "is this artifact free of dangerous pickle opcodes." Scanning and signing are complementary controls, not substitutes for one another.

## ML-BOM / AI-BOM (CycloneDX)

- **CycloneDX** extends the software bill-of-materials concept with an **ML-BOM / AI-BOM**: a machine-readable inventory of the models, datasets, and dependencies that went into a shipped AI system, including provenance for each.
- An ML-BOM is what lets a downstream consumer (or auditor) answer "what model weights, what training/fine-tuning data, and what library versions actually make up this deployed system" without re-deriving it from build logs — the same role a traditional SBOM plays for application dependencies, extended to model and dataset artifacts.

## CI/CD model-security gate

- A model-security gate is a pipeline stage that **fails the build** when a model artifact does not meet a defined bar before it can be promoted/deployed. Based on the controls above, a defensible gate checks for:
  - **Unsafe:** the artifact fails a picklescan/modelscan pass (dangerous opcodes/imports detected).
  - **Unsigned:** no valid Sigstore/cosign signature (or no qualifying SLSA provenance attestation) tying the artifact to a trusted build.
  - **Unpinned:** the artifact/dependency reference is a mutable tag or "latest" rather than a pinned digest/version, so what gets deployed can change without the pipeline noticing.
  - **No BOM:** no CycloneDX ML-BOM/AI-BOM was generated for the artifact, so its model/dataset/dependency provenance isn't recorded.
- This gate is the practical, enforceable expression of **OWASP LLM03 Supply Chain**: the same risk category (untrusted third-party models, datasets, and dependencies entering the pipeline) is what scanning, signing, and BOM generation collectively mitigate.

## Authoritative sources

- OWASP GenAI project home — https://genai.owasp.org/
- OWASP LLM Top 10 2025 list — https://genai.owasp.org/llm-top-10/
- OWASP LLM03 Supply Chain — https://genai.owasp.org/llmrisk/llm03-supply-chain/
- safetensors — https://github.com/huggingface/safetensors
- Hugging Face Hub: pickle security — https://huggingface.co/docs/hub/security-pickle
- picklescan — https://github.com/mmaitre314/picklescan
- modelscan — https://github.com/protectai/modelscan
- Sigstore docs — https://docs.sigstore.dev/
- cosign — https://github.com/sigstore/cosign
- CycloneDX ML-BOM — https://cyclonedx.org/capabilities/mlbom/
- SLSA — https://slsa.dev/

## Pairs with (context-vault labs)

lab-05-model-supply-chain (scan/sign/ML-BOM) and lab-06-mlops-cicd-gate (pipeline gate) in the context-vault repo.
