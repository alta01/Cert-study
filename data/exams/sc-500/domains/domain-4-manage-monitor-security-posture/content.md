# SC-500 Domain 4 — Manage and monitor security posture (20–25%)

Quick-reference notes for Defender for Cloud posture, multicloud connectors, EASM, MDVM, Sentinel, and Security Copilot. Pair with the 35 questions in `data/exams/sc-500.json` for this domain.

## Defender for Cloud posture (CSPM)

- **Foundational vs Defender CSPM.** Foundational = free, includes secure score (MCSB), recommendations, asset inventory, workflow automation. **Defender CSPM (paid)** adds attack-path analysis, cloud security graph (Cloud Security Explorer), agentless scanning, data-aware security posture, AI security posture, EASM integration, and CIEM/Permissions Management.
- **Attack path analysis.** Surfaces exploitable chains: external entry → vulnerable resource → identity/permission lateral movement → high-impact target. Requires Defender CSPM + supporting data (agentless scanning for vulnerability data, data-aware posture for sensitive-data classification).
- **Cloud Security Explorer.** Graph-based query interface (built-in templates + custom queries) for multi-hop questions like "internet-exposed VM with managed identity having Owner anywhere".
- **Secure score.** Based exclusively on built-in MCSB recommendations (in the Azure portal). Other regulatory standards appear in Regulatory Compliance but don't change the score. Cloud Secure Score (Defender portal) is a newer risk-based model that factors asset risk + criticality.
- **Regulatory Compliance dashboard.** Add built-in standards (NIST 800-53 R5, ISO 27001, PCI DSS, CIS, etc.) per subscription / AWS account / GCP project; each control maps to Azure Policy assessments with exportable evidence.
- **Custom recommendations & custom standards.** Author via Azure Policy or cloud security graph queries; group into a custom standard that appears in the Regulatory Compliance dashboard.
- **Enforce/Deny on recommendations.** "Enforce" = author the corresponding Azure Policy with DeployIfNotExists/Modify; "Deny" = author with a Deny effect to block non-compliant creation.
- **Exemptions.** Category Waiver/Mitigated + justification + expiration date; scope to specific resources within a recommendation.

## Multicloud connectors

- **AWS connector.** CloudFormation template creates IAM roles via OIDC trust. Choose **Default access** (current + future plans) vs **Least Privilege access** (current plan permissions only; reconfigure when adding plans). Onboard the AWS management account to use StackSets + autoprovisioning for all child accounts.
- **GCP connector.** Uses Workload Identity Federation. Same Default vs Least Privilege options.
- **Defender CSPM on AWS/GCP.** Provides cloud security graph, attack path analysis, Cloud Security Explorer, CIEM, agentless scanning, data-aware posture across the connected cloud.

## EASM, MDVM, plans

- **Defender EASM.** Microsoft proprietary discovery starting from organization-owned **seeds** (domains, IP blocks, hosts, email contacts, ASNs, Whois orgs). Recurses via Whois/DNS/SSL/ASN to build attack surface inventory. **Discovery Groups** = independent seed clusters with their own schedule. **Automated attack surfaces** = pre-built inventories Microsoft has already mapped for many orgs — start there before custom discovery.
- **Microsoft Defender Vulnerability Management (MDVM).** Now under Exposure Management in the Defender portal.
  - **Security baselines assessment** = continuous assessment against CIS / STIG benchmarks (Windows 10/11, Windows Server 2008 R2+). Customizable thresholds + per-device exceptions with justification + duration. Requires MDVM Standalone or MDVM add-on for MDE P2.
  - **Vulnerable application blocking** = block all known-vulnerable versions of an app while patches are deployed.
  - **Network share assessment** = identify world-writable shares, root-folder shares, etc.
  - **Authenticated scan for Windows** = scan unmanaged Windows devices remotely with provided credentials.
- **Permissions Management (CIEM).** Enable as a Defender CSPM extension on Azure/AWS/GCP; Security Admin role required at the scope.
- **Plan enablement.** Defender for Cloud plans are independent and can be enabled simultaneously per subscription. No required order.

## Microsoft Sentinel

- **Workspace + Defender portal.** Sentinel still uses a Log Analytics workspace. Onboard the workspace to the Defender portal for unified SecOps. **Azure portal experience retires March 31, 2027 — plan the transition.**
- **Roles.** Reader (view), Responder (incident triage), Contributor (analytics rules + workspace settings). Playbook Operator allows manual playbook execution. Automation Contributor is the role assigned to the Sentinel service account on the playbook's resource group to allow automation rules to invoke playbooks.
- **Content Hub.** One-click install of vendor/domain solutions bundling connectors + analytics rules + hunting queries + parsers + workbooks + playbooks (Fortinet, Palo Alto, Okta, etc.). Version-managed updates.
- **Syslog/CEF via AMA.** Install solution from Content Hub → create DCR for the AMA connector → install AMA on a Linux log forwarder VM → run the installer script that configures rsyslog/syslog-ng to listen on port 514 and forward to local AMA on TCP 28330 (AMA 1.28.11+). MMA is deprecated.
- **Windows Security Events via AMA.** DCR with XPath queries filters events at the source (e.g., only 4624/4625/4672/4688), saving ingestion cost. Pre-built sets All / Common / Minimal also available.
- **Custom Logs via AMA.** Read arbitrary text/JSON files into custom tables (`_CL` suffix); apply KQL transforms in the DCR for parsing and filtering at ingestion.
- **Automation rules vs alert-triggered playbooks.** Incident-triggered automation is preferred. Alert-triggered is required when incident creation is disabled — including when the workspace is onboarded to the Defender portal (incidents are created in Defender, so Sentinel-side incident creation rules should be off).
- **Data tiers.** **Analytics tier** = 90-day interactive retention by default for Sentinel (extendable to 2 years), full real-time features. **Data lake tier** = minimal ingestion cost, up to 12-year retention, KQL/Spark/Notebooks, limited real-time features. Combine for cost optimization.
- **Purview Audit in Defender XDR.** Advanced Hunting (KQL) exposes M365 audit data (CloudAppEvents, etc.) from the same SOC tool used for incident investigation.

## Microsoft Security Copilot

- **RBAC.** Copilot owner = platform settings, plugin/tenant configuration, role assignments, capacity management, data sharing toggles. Copilot contributor = create sessions, run promptbooks, manage personal promptbooks, upload files.
- **Service plugin access (OBO).** Security Copilot uses on-behalf-of authentication. Even with Copilot Contributor, the user still needs the underlying service's RBAC role (Microsoft Sentinel Reader/Responder for Sentinel, Defender XDR Unified RBAC, Intune RBAC, etc.) to see data through the plugin.
- **Recommended Microsoft Security roles bundle.** Replace the default "Everyone" assignment with this bundle so only users with Microsoft security Entra roles (Security Reader, Security Operator, Security Administrator, etc.) get Copilot Contributor.
- **Promptbooks + custom plugins.** Promptbooks = reusable multi-step workflows. Custom plugins (OpenAPI / KQL / GPT) extend Copilot to query in-house systems (internal TI platforms, etc.).
- **Security Store / Microsoft agents.** Microsoft and partner agents (Phishing Triage in Defender, Conditional Access Optimization in Entra, etc.) have their own role requirements. Cross-tenant / MSSP access via Azure B2B + tenant switching, GDAP through Partner Center, or Azure Lighthouse — no need to provision Copilot per managed tenant.

## Authoritative Microsoft Learn URLs

- Cloud Security Posture Management overview: https://learn.microsoft.com/azure/defender-for-cloud/concept-cloud-security-posture-management
- Attack paths and Cloud Security Explorer: https://learn.microsoft.com/azure/defender-for-cloud/concept-attack-path
- Secure score: https://learn.microsoft.com/azure/defender-for-cloud/secure-score-security-controls
- Microsoft Cloud Security Benchmark: https://learn.microsoft.com/security/benchmark/azure/introduction
- Regulatory compliance: https://learn.microsoft.com/azure/defender-for-cloud/regulatory-compliance-dashboard
- Connect AWS accounts: https://learn.microsoft.com/azure/defender-for-cloud/quickstart-onboard-aws
- Connect GCP projects: https://learn.microsoft.com/azure/defender-for-cloud/quickstart-onboard-gcp
- Permissions Management (CIEM): https://learn.microsoft.com/azure/defender-for-cloud/enable-permissions-management
- Microsoft Defender EASM: https://learn.microsoft.com/azure/external-attack-surface-management/overview
- MDVM security baselines: https://learn.microsoft.com/defender-vulnerability-management/tvm-security-baselines
- Microsoft Sentinel overview: https://learn.microsoft.com/azure/sentinel/overview
- Sentinel data connectors: https://learn.microsoft.com/azure/sentinel/connect-data-sources
- CEF/Syslog via AMA: https://learn.microsoft.com/azure/sentinel/cef-syslog-ama-overview
- Sentinel data tiers and retention: https://learn.microsoft.com/azure/sentinel/manage-data-overview
- Sentinel automation rules: https://learn.microsoft.com/azure/sentinel/automate-incident-handling-with-automation-rules
- Security Copilot authentication: https://learn.microsoft.com/copilot/security/authentication
- Security Copilot plugins: https://learn.microsoft.com/copilot/security/manage-plugins
