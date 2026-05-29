# SC-300 Domain 3 — Implement access management for applications (15–20%)

Pair with the 30 questions in `data/exams/sc-300.json` for this domain.

## App registrations

- **Supported account types.**
  - Single tenant — apps for one organization.
  - Multi-tenant — apps for organizational customers (no consumers).
  - Multi-tenant + personal Microsoft accounts — broadest.
  - Personal Microsoft accounts only — consumer-only.
- **Redirect URIs.** Mobile apps use platform-specific URIs (`msauth://...`); SPAs use `https://`; web apps use `https://` (localhost loopback OK for desktop dev). Wildcards not supported.
- **Credentials.** Client secret (with expiry — keep short and rotate), certificates (preferred over secrets), federated identity credentials (best for keyless CI/CD).
- **Workload Identity Federation.** OIDC trust to external issuers (GitHub Actions, Azure DevOps, Kubernetes, AWS) — no secret stored in the external system. Audience must match the issuer's expected value (`api://AzureADTokenExchange` is the default).

## Permissions and consent

- **Delegated vs Application permissions.**
  - **Delegated** — used in user context; effective rights = intersection of user permissions and granted scopes.
  - **Application** — daemon / app-only; uses client credentials flow; ALWAYS requires admin consent.
- **Admin consent workflow.** Configure users to request admin consent; reviewers (Cloud Application Administrator, Application Administrator, Global Administrator) approve. URL pattern: `https://login.microsoftonline.com/{tenant}/adminconsent?client_id={appId}`.
- **User consent settings.** Three options: Allow all / Block all / Allow for verified publishers with selected permissions (low-impact). Microsoft's recommended balance is option 3 + admin consent request workflow.
- **Low-impact classifications.** Default low-impact set: openid, offline_access, profile, email. Add User.Read for tenant-specific low-impact.
- **App roles vs OAuth scopes.** App roles (RBAC inside the app, surfaced in tokens via `roles` claim); OAuth scopes (delegated permissions surfaced via `scp` claim).
- **App management policies.** Tenant-default or app-specific policies that constrain credential types and lifetimes (max secret age, allowed credential types).

## SSO and Application Proxy

- **SSO modes.** SAML 2.0, OIDC, Password-based (last-resort: form-fill), Linked (just a tile redirect — no CA enforcement), IWA / KCD via Application Proxy, Header-based.
- **Application Proxy.** Publish on-premises web apps to Entra ID. Connectors deployed on-prem, outbound 443 only. KCD for pre-authentication, B2B guest support, connector groups for HA and segmentation.
- **Claims mapping.** Custom claims via Claims Mapping Policy or token configuration. Use for emitting custom attributes / extension attributes / role names. Note token size limits.
- **Provisioning.** SCIM 2.0 for automatic user lifecycle (create/update/disable). JIT provisioning (SAML attributes on first sign-in) is a limited fallback — doesn't disable accounts.
- **Conditional Access for workload identities.** Targets service principals; requires Workload Identities Premium. Use to block service principals from risky locations or based on risk.

## Logging and audit

- **Sign-in logs (four tabs).** Interactive user sign-ins, Non-interactive user sign-ins, Service principal sign-ins, Managed identity sign-ins. Each has retention based on tier (Free: 7 days, P1/P2: 30 days; longer via Log Analytics export).
- **Audit logs.** Directory changes including consent grants, app registrations, role assignments. Use to investigate OAuth consent attacks.
- **My Apps portal Collections.** Curated grouping of enterprise apps for users; managed by admins or self-service.

## App lifecycle

- **Deactivate vs Delete.** Toggle "Enabled for users to sign in" = soft disable (recoverable). Delete = remove from directory (restorable within 30 days via Deleted applications page).
- **Disable user sign-in.** Per-app via Enterprise applications > Properties > Enabled for users to sign in = No.

## Authoritative Microsoft Learn URLs

- Microsoft identity platform overview: https://learn.microsoft.com/entra/identity-platform/v2-overview
- Application registration quickstart: https://learn.microsoft.com/entra/identity-platform/quickstart-register-app
- Permissions and consent: https://learn.microsoft.com/entra/identity-platform/permissions-consent-overview
- Configure user consent: https://learn.microsoft.com/entra/identity/enterprise-apps/configure-user-consent
- Admin consent workflow: https://learn.microsoft.com/entra/identity/enterprise-apps/configure-admin-consent-workflow
- App management policies: https://learn.microsoft.com/entra/identity/enterprise-apps/app-management-policy-configuration
- Workload identity federation: https://learn.microsoft.com/entra/workload-id/workload-identity-federation
- Configure SAML SSO: https://learn.microsoft.com/entra/identity/enterprise-apps/add-application-portal-setup-sso
- Application Proxy overview: https://learn.microsoft.com/entra/identity/app-proxy/overview-what-is-app-proxy
- Conditional Access for workload identities: https://learn.microsoft.com/entra/identity/conditional-access/workload-identity
- Microsoft Entra sign-in logs: https://learn.microsoft.com/entra/identity/monitoring-health/concept-sign-ins
- Microsoft Entra audit logs: https://learn.microsoft.com/entra/identity/monitoring-health/concept-audit-logs
