# SC-300 Domain 2 — Implement authentication and access management (25–30%)

The largest SC-300 domain. Pair with the 45 questions in `data/exams/sc-300.json` for this domain.

## Authentication methods (unified policy)

- **Authentication methods policy.** The unified control plane for ALL auth methods (MFA + SSPR + passwordless). Legacy per-user MFA + legacy SSPR settings were deprecated September 30, 2025 — migrate using the migration guide, then mark Migration Complete to retire legacy portals.
- **Phishing-resistant options.** FIDO2 security keys, Windows Hello for Business, certificate-based authentication (multi-factor), Microsoft Authenticator passkeys (device-bound FIDO2 on iOS 17+ / Android 14+).
- **Non-phishing-resistant methods.** Authenticator push, SMS, voice, OATH tokens. Useful as fallback only.
- **Temporary Access Pass (TAP).** Time-limited (max 30 days, default 1 hour) bootstrap credential for first-time registration of strong methods. NOT for service accounts.
- **Combined Registration.** Single user experience for SSPR + MFA registration. Enabled by default.
- **Password Protection.** Tenant-wide custom banned password list (max 1000 entries). Deploy on-prem proxy + DC agent for AD password change enforcement.

## Conditional Access

- **Grant controls.** Require MFA / Authentication Strength (preferred) / Compliant device / Hybrid Entra join / Terms of Use / Block. Combine in one policy with AND semantics.
- **Authentication Strengths.** Built-ins: MFA, Passwordless MFA, Phishing-resistant MFA. Custom strengths can specify exact method combinations. Built-in Phishing-resistant MFA = FIDO2 / WHfB / CBA / Authenticator passkey.
- **Session controls.** Sign-in frequency (re-auth interval), Persistent browser session (Never persistent prevents "stay signed in" cookie), App-enforced restrictions, Conditional Access App Control (proxy via Defender for Cloud Apps), Continuous Access Evaluation.
- **Filters for devices.** Rule-based targeting using device properties (`device.deviceOwnership -eq 'Company'`, `device.isCompliant`, `device.trustType`, etc.) — more precise than legacy device platform conditions.
- **Authentication Context.** Sub-app granularity — define context values (c1, c2, ...), tag resources (SharePoint sites via sensitivity labels, OneDrive, Power BI semantic models), then a CA policy targeting the context applies on resource access.
- **Break-glass exclusions.** Two cloud-only Global Administrator accounts excluded from EVERY policy via a dedicated security group; monitored on use.
- **Microsoft-managed policies.** Microsoft ships pre-configured CA policies (Block legacy auth, MFA for admins accessing admin portals, Block device code flow, MFA for all users, Block high-risk agents) that appear in Report-only mode for admin review.
- **Tools.** Report-only mode (real evaluation, no enforcement), Insights & Reporting workbook, What If (limited — can't simulate session controls or risk).
- **Continuous Access Evaluation (CAE).** Near-real-time token revocation when critical events occur (password change, account disable, location policy violation). Enable Strict location enforcement to minimize token-reuse window when IP leaves trusted location.

## Identity Protection

- **Risk types.** Sign-in risk (likelihood the request isn't from the identity owner) vs User risk (likelihood account is compromised).
- **Detection sources.** Microsoft Threat Intelligence, anonymous IP, atypical travel, unfamiliar sign-in, malicious IP, leaked credentials (requires PHS), suspicious browser, password spray, anomalous token, and (new) Agent risk.
- **Policies.** Migrate from legacy Identity Protection policies to Conditional Access policies keyed on risk (Require password change for high user risk; Require MFA / Authentication Strength for medium-and-higher sign-in risk).
- **Investigation actions.** Confirm compromised (true positive, locks risk) vs Dismiss (false positive, signal trains ML). Confirm safe is for sign-in risk false positives.
- **Identity Protection for agents.** New: agent risk detections. Pair with "Block high-risk agent identities" managed CA policy.

## Global Secure Access (GSA)

- **Three traffic profiles** (enable independently): Microsoft 365 (M365 services), Microsoft Entra Internet Access (any Internet), Microsoft Entra Private Access (specific on-prem apps).
- **Per-app vs Quick Access (Private Access).** Quick Access = single bucket; per-app = separate enterprise apps for per-app Conditional Access.
- **Universal Conditional Access.** Internet traffic acquired by the GSA client is evaluated by CA policies before reaching destinations, including non-Entra-aware sites.
- **Compliant Network.** A CA condition — sign-ins via GSA are flagged as coming from a compliant network so policies can restrict access to GSA-acquired traffic.
- **Source IP restoration.** Preserves the user's original public IP in sign-in logs for named-location-based CA policies even when traffic is acquired by GSA.

## Azure RBAC and Key Vault

- **Best practices.** Least privilege at narrowest scope; assign to groups (not users); use Reader for read-only; built-in roles before custom.
- **Key Vault access models.** Migrate from access policy to Azure RBAC. With access policy, anyone with `vaults/write` (Contributor) can self-grant data-plane access. With RBAC, only Owner / User Access Administrator can grant the data-plane roles (Key Vault Secrets User / Officer, Crypto Officer, etc.).
- **Global Administrator elevate access.** Required for Entra Global Admin to manage Azure subscriptions (otherwise the role only manages Entra ID).

## Authoritative Microsoft Learn URLs

- Authentication methods policy: https://learn.microsoft.com/entra/identity/authentication/concept-authentication-methods-manage
- Phishing-resistant passwordless deployment: https://learn.microsoft.com/entra/identity/authentication/how-to-deploy-phishing-resistant-passwordless-authentication
- Conditional Access overview: https://learn.microsoft.com/entra/identity/conditional-access/overview
- Conditional Access authentication strengths: https://learn.microsoft.com/entra/identity/authentication/concept-authentication-strengths
- Conditional Access session controls: https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-session
- Filter for devices: https://learn.microsoft.com/entra/identity/conditional-access/concept-condition-filters-for-devices
- Continuous Access Evaluation: https://learn.microsoft.com/entra/identity/conditional-access/concept-continuous-access-evaluation
- Microsoft-managed Conditional Access policies: https://learn.microsoft.com/entra/identity/conditional-access/managed-policies
- Microsoft Entra ID Protection: https://learn.microsoft.com/entra/id-protection/overview-identity-protection
- Global Secure Access: https://learn.microsoft.com/entra/global-secure-access/overview-what-is-global-secure-access
- Key Vault RBAC vs access policy: https://learn.microsoft.com/azure/key-vault/general/rbac-access-policy
- Elevate access for Global Administrator: https://learn.microsoft.com/azure/role-based-access-control/elevate-access-global-admin
