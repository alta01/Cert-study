#!/usr/bin/env bash
# Orchestrates SC-500 question generation: 160 questions across 9 batches of ≤20,
# weighted to match the official Microsoft Learn SC-500 study guide.
#
# Source: https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/sc-500
#
# Requires: ANTHROPIC_API_KEY env var.

set -euo pipefail

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "Error: ANTHROPIC_API_KEY must be set." >&2
  exit 1
fi

EXAM_NAME="Implementing End-to-End Security Controls for Cloud and AI Workloads"
EXAM_CODE="SC-500"
EXAM_SLUG="sc-500"
REF_HOST="learn.microsoft.com"

gen() {
  local domain="$1" name="$2" weight="$3" count="$4" focus="$5"
  echo
  echo "─── Domain $domain · $count questions · focus: $focus ───"
  node "$(dirname "$0")/generate-questions.js" \
    --exam "$EXAM_NAME" \
    --code "$EXAM_CODE" \
    --slug "$EXAM_SLUG" \
    --domain "$domain" \
    --domain-name "$name" \
    --domain-weight "$weight" \
    --count "$count" \
    --focus "$focus" \
    --reference-host "$REF_HOST"
}

# ── Domain 1: Manage identity, access, and governance (20-25%) ─ 40 questions
gen 1 "Manage identity, access, and governance" "20-25%" 20 \
  "Privileged Identity Management (PIM) eligible vs active assignments, Conditional Access policy design, MFA and passwordless authentication, app registrations and enterprise applications, OAuth permission grants and admin consent settings, managed identities for Azure resources"

gen 1 "Manage identity, access, and governance" "20-25%" 20 \
  "Azure Key Vault deployment and access models (RBAC vs access policies), Key Vault firewall and private endpoints, Defender for Key Vault, secret scanning in Defender CSPM, Azure Policy built-in and custom definitions, regulatory compliance in Defender for Cloud, resource locks, Azure RBAC custom roles vs Entra roles, infrastructure-as-code security, Azure Backup security features"

# ── Domain 2: Secure storage, databases, and networking (25-30%) ─ 50 questions
gen 2 "Secure storage, databases, and networking" "25-30%" 20 \
  "Storage account security and shared access signatures, storage firewall rules and service endpoints, Defender for Storage malware scanning and sensitive data threat protection, stored access policies for containers, Azure SQL platform security (TDE, Always Encrypted, Microsoft Entra authentication), SQL auditing to Log Analytics, Defender for Databases protection across SQL/MySQL/PostgreSQL/Cosmos DB"

gen 2 "Secure storage, databases, and networking" "25-30%" 20 \
  "NSGs and ASGs application-tier segmentation, Azure Virtual Network Manager security admin rules and connectivity configurations, Azure Virtual WAN secured hub with Firewall Manager, site-to-site and point-to-site VPN security, Microsoft Entra Private Access (Global Secure Access) per-app access policies, Conditional Access on Private Access"

gen 2 "Secure storage, databases, and networking" "25-30%" 10 \
  "Azure private endpoints for PaaS, Private Link service publishing, Azure Firewall premium features (TLS inspection, IDPS), Network Watcher effective security rules and connection troubleshoot"

# ── Domain 3: Secure compute (20-25%) ─ 35 questions
gen 3 "Secure compute" "20-25%" 20 \
  "Azure Disk Encryption vs encryption at host vs server-side encryption with customer-managed keys, Azure Bastion SKUs and native client, just-in-time (JIT) VM access, Azure Arc for hybrid/multicloud servers, Defender for Servers plans (P1 vs P2) including agentless scanning and EDR, VM secure boot, vTPM, integrity monitoring, confidential VM security type, Azure Machine Configuration guest assignments, Defender for Containers runtime threat detection, AKS pod identity and network policies, Azure Container Registry quarantine and Defender vulnerability assessment, Azure Container Apps and Azure Container Instances network isolation, Azure Functions authentication and access restrictions, Logic Apps managed identities, App Service access restrictions and TLS, Azure Web Application Firewall on Application Gateway vs Front Door, API Management policies for back-end protection"

gen 3 "Secure compute" "20-25%" 15 \
  "Identify SharePoint over-exposure for Copilot grounding, Purview DSPM for AI risk insights, Microsoft Copilot Studio real-time protection, Microsoft Entra Agent ID conditional access policies, Defender XDR blast-radius analysis for Entra Agent ID compromises, managing Entra Agent ID access lifecycle, AI Gateway in Azure API Management for Microsoft Foundry, Defender for AI Service in Defender for Cloud, Foundry guardrails for agents, Data and AI security dashboard in Defender for Cloud, managing AI agents in the Microsoft 365 admin center"

# ── Domain 4: Manage and monitor security posture (20-25%) ─ 35 questions
gen 4 "Manage and monitor security posture" "20-25%" 20 \
  "Defender CSPM attack path analysis, framework compliance evaluation (NIST, ISO 27001, PCI DSS), Defender for Cloud workload protection plans enablement, AWS connector and GCP connector onboarding, Defender Vulnerability Management for Azure VMs, Defender External Attack Surface Management (EASM) discovery and inventory"

gen 4 "Manage and monitor security posture" "20-25%" 15 \
  "Microsoft Sentinel workspace design and multi-tenant, Sentinel roles (Reader, Responder, Contributor), content hub solutions, Microsoft data connectors for Azure resources, syslog and CEF event collection via AMA, Windows Security events via data collection rules and Windows Event Forwarding, custom log tables, automation rules and playbooks (Logic Apps), Sentinel data tiers and retention, Purview Audit queries in Defender XDR; Security Copilot workspace setup, role assignments, plugin configuration, Microsoft and Security Store agents"

echo
echo "─── All batches complete. Running validation… ───"
node "$(dirname "$0")/validate-exam.js" "$(dirname "$0")/../data/exams/${EXAM_SLUG}.json"

echo
echo "─── Syncing manifest… ───"
node "$(dirname "$0")/sync-manifest.js"

echo
echo "Done. See data/exams/${EXAM_SLUG}.json"
