# SC-500 Domain 3 — Secure compute (20–25%)

Quick-reference notes for VMs, containers, app services, and AI workloads — the SC-500-defining domain. Pair with the 35 questions in `data/exams/sc-500.json` for this domain.

## VMs & servers

- **Disk encryption recommendation.** Use **encryption at host** with a Disk Encryption Set (DES) referencing a customer-managed key. Covers OS + data + temp + cache, doesn't use VM CPU. **Azure Disk Encryption (ADE) is scheduled for retirement on September 15, 2028** — migrate to encryption at host.
- **Confidential VMs.** DCasv5/ECasv5 use AMD SEV-SNP for memory encryption; confidential OS disk encryption binds keys to the VM's vTPM; attest via Microsoft Azure Attestation.
- **Azure Bastion.** Standard SKU adds native client (mstsc / `az network bastion ssh`), IP-based connection, host scaling units. Premium adds session recording.
- **JIT VM access.** Requires Defender for Servers Plan 2. ARM-deployed VM + NSG/Azure Firewall (not Firewall Manager-controlled). Opens management port for the requesting IP and time window.
- **Defender for Servers P1 vs P2.** P1 = EDR (MDE) + agent-based vulnerability assessment. P2 adds agentless scanning, JIT, FIM (via MDE sensor — MMA-based FIM deprecated), OS configuration assessment against MCSB, regulatory compliance, premium MDVM features, free data ingestion benefit.
- **Agentless vs agent-based vulnerability scanning.** Both use Microsoft Defender Vulnerability Management. Agentless needs no install or network reach to the VM (snapshot-based, Plan 2 / Defender CSPM). Agent-based uses the MDE sensor (P1/P2).
- **Azure Arc.** Onboard non-Azure servers (on-prem, AWS via connector + Arc, GCP) so Defender for Servers can deploy MDE and surface findings.
- **Azure Machine Configuration.** Audits in-guest settings via Azure Policy; combines with Defender for Servers Plan 2 OS configuration assessment against MCSB.

## Containers, Functions, App Services, APIM

- **Defender for Containers sensor.** eBPF-based DaemonSet (`microsoft-defender-collector-ds-*`) on each AKS node — runtime telemetry to Defender for Cloud over outbound HTTPS. Cluster audit logs collected natively by AKS, no in-cluster component needed for those.
- **Runtime antimalware blocking.** Enhanced Defender sensor capability — Helm-provisioned for AKS; `k8s-extension` with antimalware collector for Arc-enabled multicloud. Requires Security Admin to author/modify antimalware policies.
- **Defender Security Gating.** Admission-control layer that evaluates pod specs against security policies (block images with critical CVEs, etc.). Distinct from Azure Policy for Kubernetes (Gatekeeper).
- **AKS Workload Identity.** OIDC-based federation between K8s service account and Entra managed identity / app registration. Replaces deprecated AAD Pod Identity v1. No secrets in the cluster.
- **ACR.** Combine image quarantine with Defender for Containers registry vulnerability assessment + Defender Security Gating for full scan-before-deploy.
- **App Service minimum TLS.** TLS 1.0/1.1 retiring May 31, 2027 for App Service / Functions / Logic Apps (Standard) / ASE. Discover via Azure services retirement workbook + Minimum TLS Version Checker detector; remediate clients; set `minTlsVersion` AND `scmMinTlsVersion` to 1.2+ on every app AND every deployment slot.
- **App Service access restrictions.** IP CIDR + VNet/subnet (service endpoint) + service tag, default deny. Use Private Endpoint to take App Service off public DNS entirely.
- **Azure Functions auth.** Easy Auth with Microsoft Entra ID; set 'HTTP 401 Unauthorized' for unauthenticated requests.
- **APIM `validate-jwt`.** Built-in policy for JWT validation at the gateway — signature via JWKS, claims (issuer/audience/scopes), returns 401 on failure.
- **Logic Apps to Microsoft Graph.** Use managed identity (system- or user-assigned), grant Microsoft Graph application permissions, choose "Managed identity" as HTTP action's Authentication.
- **Container Apps.** Set environment to Internal for zero public exposure; use managed identity + Key Vault Secrets User role for secret retrieval.

## AI security (SC-500 differentiators)

- **Purview DSPM for AI.** "Front door" for managing AI app data security. Data risk assessments identify SharePoint over-exposure before Copilot rollout. One-click policies for Copilot Studio/M365 Copilot: "Capture interactions", "Detect risky AI usage", "Extend insights into sensitive data". Audit must be on tenant-wide.
- **Microsoft Entra Agent ID.** First-class directory identities for AI agents (autonomous, assistive, on-behalf-of). Brings Conditional Access (Agents (Preview) assignment target, "Block high-risk agent identities" managed template, autonomous-agent policies, on-behalf-of policies), ID Protection (agent risk), ID Governance (access packages, owners), network controls.
- **Conditional Access for agents.** Two scenarios: (1) block high-risk agent identities via Microsoft-managed policy keyed on Agent risk; (2) approve-list specific agents via custom security attributes (e.g., `AgentApprovalStatus = HR_Approved`) or the enhanced object picker.
- **Defender for Cloud AI Security Posture Management (AI SPM).** Defender CSPM capability — discovers AI workloads (Azure OpenAI, Microsoft Foundry, Azure ML, AWS Bedrock, GCP Vertex AI), AI agent inventory (preview, Copilot Studio + Foundry), IaC misconfigurations (private endpoint, managed identity), attack-path analysis for AI workloads.
- **Defender for AI Services.** Runtime threat protection plan for Microsoft Foundry workloads — detects malicious prompts, jailbreak, abnormal execution, abuse patterns. Alerts surface in the Defender portal. Enable per subscription in Defender for Cloud Environment settings.
- **Defender XDR blast radius for agents.** Use incident correlation + Advanced Hunting KQL across IdentityEvents / CloudAppEvents / EntraSignInLogs to pivot on an agent identity and find which resources/files it accessed.
- **AI Gateway in APIM.** `llm-token-limit` policy enforces TPM with `estimate-prompt-tokens` for backend protection. `llm-content-safety` integrates Azure AI Content Safety to block unsafe prompts. `llm-semantic-cache-store/lookup` for cache-and-reuse. Foundry integration: per-project TPM (429 on exceed) + total token quota (403 on exceed) over hourly/daily/weekly/monthly/yearly windows.
- **Foundry guardrails.** Four intervention points for agents: User input, Tool call (preview), Tool response (preview), Output. Models have only User input + Output. Severity levels Low (most restrictive) / Medium / High (least restrictive). Agent's guardrail overrides the model's guardrail.
- **Data and AI security dashboard.** Defender for Cloud's unified surface correlating sensitive data + storage/database/AI threats + AI posture.
- **M365 admin center.** Inventory and governance of Copilot Studio and Microsoft 365 agents at the tenant level.

## Authoritative Microsoft Learn URLs

- Managed disk encryption options: https://learn.microsoft.com/azure/virtual-machines/disk-encryption-overview
- Confidential VMs: https://learn.microsoft.com/azure/confidential-computing/confidential-vm-overview
- Azure Bastion: https://learn.microsoft.com/azure/bastion/configuration-settings
- JIT VM access: https://learn.microsoft.com/azure/defender-for-cloud/just-in-time-access-overview
- Defender for Servers plans: https://learn.microsoft.com/azure/defender-for-cloud/defender-for-servers-overview
- Defender for Containers architecture: https://learn.microsoft.com/azure/defender-for-cloud/defender-for-containers-architecture
- AKS Workload ID: https://learn.microsoft.com/azure/aks/workload-identity-overview
- App Service minimum TLS: https://learn.microsoft.com/azure/app-service/tls-minimum-version
- APIM validate-jwt policy: https://learn.microsoft.com/azure/api-management/validate-jwt-policy
- DSPM for AI: https://learn.microsoft.com/purview/dspm-for-ai
- Entra Agent ID overview: https://learn.microsoft.com/entra/agent-id/identity-professional/microsoft-entra-agent-identities-for-ai-agents
- Conditional Access for autonomous agents: https://learn.microsoft.com/entra/identity/conditional-access/policy-autonomous-agents
- AI security posture management: https://learn.microsoft.com/azure/defender-for-cloud/ai-security-posture
- Enable threat protection for AI services: https://learn.microsoft.com/azure/defender-for-cloud/ai-onboarding
- AI Gateway in APIM: https://learn.microsoft.com/azure/api-management/genai-gateway-capabilities
- Foundry guardrails: https://learn.microsoft.com/azure/foundry/guardrails/guardrails-overview
