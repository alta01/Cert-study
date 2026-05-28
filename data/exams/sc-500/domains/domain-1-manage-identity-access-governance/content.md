# SC-500 Domain 1 — Manage identity, access, and governance (20–25%)

Quick-reference notes for the Microsoft Entra, Key Vault, Policy, and governance section of SC-500. Pair with the 40 questions in `data/exams/sc-500.json` for this domain.

## Microsoft Entra: PIM, Conditional Access, passwordless

- **PIM eligible vs active.** Eligible = must activate (with MFA, justification, approval). Active = always in role. Use eligible everywhere except a small number of permanent active break-glass accounts. The "On activation, require Microsoft Entra MFA" setting fires MFA at activation, not at assignment time (which is what the "Require MFA on active assignment" setting does).
- **PIM approval lockout.** If approval is required but no approvers are configured, default approvers are currently-active members of the role. With no active members and no emergency-access account, the role becomes unreachable. Always configure approvers and break-glass accounts.
- **Conditional Access Authentication Strengths.** Use the built-in "Phishing-resistant MFA" strength to require FIDO2 / Windows Hello for Business / certificate auth on high-value apps. The classic "Require MFA" grant accepts any registered method including SMS.
- **Block legacy auth.** Conditional Access policy with Client apps = `Exchange ActiveSync clients` + `Other clients`, grant = Block — Microsoft-documented tenant-wide block. Avoid Security Defaults if custom policies exist.
- **Break-glass exclusions.** Two cloud-only Global Administrator accounts, permanent active, excluded from EVERY Conditional Access policy via a dedicated security group, monitored for use.
- **Risk-based CA.** Two separate policies — user-risk (`Require password change`) and sign-in-risk (`Require authentication strength: MFA`) — using Identity Protection signals. Configure in Conditional Access, not the legacy Identity Protection policies.
- **AI Agents in CA.** Microsoft-managed policy "Block high-risk agent identities" handles agent-risk-based blocking. For approve-listed agents, target Agents (Preview) and exclude approved agents using custom security attributes or the enhanced object picker.
- **Passwordless choice.** Phishing-resistant + portable (admins, kiosks) → FIDO2 keys. Device-bound on a Windows PC → Windows Hello for Business. New user onboarding without a password → Temporary Access Pass.
- **App registrations & workload identities.** Use federated identity credentials (no client secret) for GitHub Actions, Azure DevOps, and Kubernetes Workload ID. Mobile apps register platform-specific redirect URIs. Conditional Access for workload identities is a separate policy targeting service principals.
- **OAuth consent.** Application permissions always require admin consent. Configure user consent settings to "Allow user consent for apps from verified publishers, for selected permissions" + enable admin consent request workflow.
- **Managed identities.** User-assigned for shared identity across resources with pre-created RBAC; system-assigned for per-resource lifecycle. AKS workloads use Microsoft Entra Workload ID with federated identity credentials (replaces AAD Pod Identity v1).

## Key Vault & secret protection

- **Permission model.** Migrate from access-policy to Azure RBAC permission model. With access-policy, anyone with `vaults/write` (Contributor) can self-grant data-plane access. With RBAC, only Owner / User Access Administrator can grant data-plane roles.
- **Network controls.** Disable public network access; attach a private endpoint; configure the Private DNS zone (`privatelink.vaultcore.azure.net`); enable "Allow trusted Microsoft services to bypass this firewall" so services like SQL TDE BYOK can still reach the vault.
- **Soft delete + purge protection.** Together they enforce a 7–90 day retention window during which NO ONE (even a Global Admin) can purge soft-deleted material. Once purge protection is on, it cannot be disabled.
- **Defender for Key Vault.** Alerts on suspicious IP / TOR exit node access, anomalous user/IP combinations, anomalous Put-policy-then-Get-secret patterns. Treat alerts as potential credential compromise: investigate the principal, audit which secrets were accessed in the relevant window, rotate them.
- **Defender CSPM secret scanning.** Code repo scanning relies on GitHub Advanced Security; lateral-movement attack paths from exposed code secrets to cloud resources require Defender CSPM. Cloud deployment secret scanning agentlessly inspects ARM deployment outputs/parameters.
- **Managed HSM** = single-tenant, FIPS 140-3 Level 3. Standard/Premium Key Vault = FIPS 140-2. Dedicated HSM = customer-managed bare-metal.

## Azure Policy & governance

- **Effects.** `modify` patches resource properties during create/update. `deployIfNotExists` ensures related resources exist (e.g., diagnostic settings) and requires a managed identity. `audit` flags; `deny` blocks; `denyAction` blocks specific actions.
- **Safe deployment.** Use `enforcementMode = DoNotEnforce` and `resourceSelectors` to canary policies in one region/tier, then progressively expand selectors and switch to Default enforcement.
- **Exemptions.** Use category `Waiver` or `Mitigated`, scope to specific resources, include an expiration date. Prefer over editing definitions or unassigning initiatives.
- **Custom roles.** Use specific `Actions` (e.g., `Microsoft.Compute/virtualMachines/start/action`), set `AssignableScopes` to the intended scope. DataActions are for data-plane operations.
- **Entra roles vs Azure RBAC.** Entra roles control directory objects. Azure RBAC controls Azure resources. Global Admin must explicitly "Elevate access" to gain User Access Administrator on the root management group before managing Azure subscriptions.
- **Resource locks.** `ReadOnly` blocks all writes, including list-keys for storage accounts (which is implemented as a POST and treated as a write). Use `CanNotDelete` for delete protection without blocking management operations.
- **Backup security.** Enhanced soft delete with always-on = permanent soft delete protection. Multi-User Authorization (MUA) with a Resource Guard in a separate subscription/tenant enforces a two-person rule for destructive backup operations. Immutable vault blocks deletion of recovery points before policy expiry; can be made irreversible.
- **Permissions Management (CIEM).** Enable as a Defender CSPM extension for Azure/AWS/GCP to compute Permission Creep Index per identity and recommend right-sized roles.

## Authoritative Microsoft Learn URLs

- PIM: https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-configure
- Conditional Access policy templates: https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-policy-common
- Authentication strengths: https://learn.microsoft.com/entra/identity/authentication/concept-authentication-strengths
- Phishing-resistant passwordless deployment: https://learn.microsoft.com/entra/identity/authentication/how-to-deploy-phishing-resistant-passwordless-authentication
- Conditional Access for autonomous agents: https://learn.microsoft.com/entra/identity/conditional-access/policy-autonomous-agents
- Workload identity federation: https://learn.microsoft.com/entra/workload-id/workload-identity-federation
- Managed identities overview: https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview
- Key Vault RBAC vs access policies: https://learn.microsoft.com/azure/key-vault/general/rbac-access-policy
- Defender for Key Vault: https://learn.microsoft.com/azure/defender-for-cloud/defender-for-key-vault-introduction
- Defender CSPM secret scanning: https://learn.microsoft.com/azure/defender-for-cloud/secrets-scanning
- Azure Policy effects: https://learn.microsoft.com/azure/governance/policy/concepts/effect-basics
- Safe deployment of Policy assignments: https://learn.microsoft.com/azure/governance/policy/how-to/policy-safe-deployment-practices
- Defender for Cloud Regulatory Compliance: https://learn.microsoft.com/azure/defender-for-cloud/regulatory-compliance-dashboard
- Azure Backup MUA: https://learn.microsoft.com/azure/backup/multi-user-authorization-concept
- Emergency access accounts: https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access
