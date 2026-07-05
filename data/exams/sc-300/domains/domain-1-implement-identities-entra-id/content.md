# SC-300 Domain 1 — Implement identities in Microsoft Entra ID (20–25%)

Quick-reference notes for the Entra ID foundation domain. Pair with the 35 questions in `data/exams/sc-300.json` for this domain.

## Tenant fundamentals

- **Custom domains.** Verify ownership with TXT or MX records, then make primary. Required before passwordless / SSO for branded UPN.
- **Company branding.** Logo, background, sign-in text, self-service password reset link. Configured per locale. New external-friendly company branding now supports neutral sign-in UX.
- **Bulk operations.** CSV-driven create/invite/delete via the Microsoft Entra admin center; for larger volumes, Microsoft Graph PowerShell or Microsoft Graph API.

## Users, groups, devices

- **Group types.**
  - **Microsoft 365 group** — collaboration; supports Outlook, Teams, SharePoint integration.
  - **Security group** — access control; can be role-assignable (special protection).
  - **Distribution / mail-enabled security** — Exchange-managed.
  - **Dynamic membership** — rules-based (P1 license per user). Rule syntax `user.<prop> -<op> <value>`, combined with `-and`, `-or`, `-not`. Use `-any` / `-all` for multi-valued properties.
- **Role-assignable groups.** Must be flagged at creation; cannot be nested; protected against modification by anyone outside Privileged Role Administrator / Global Administrator.
- **Administrative Units (AUs).** Scope role assignments to a subset of users/groups/devices. Plain AU = scoping. Restricted Management AU = tenant-level admins (including Global Admin) cannot modify members; only roles scoped to the restricted AU can.
- **Restricted Management AU limits.** Locked at creation (can't toggle later); can't combine with Identity Governance features (PIM, entitlement management, lifecycle workflows, access reviews) on members; max 100 per tenant.

## RBAC

- **Entra roles vs Azure RBAC roles.** Entra roles → directory objects. Azure RBAC → Azure resources. Global Admin must "elevate access" in Entra ID > Properties to gain User Access Administrator on the root management group.
- **Custom Entra roles.** Define using permissions reference; assign at directory or AU scope. Limit of 100 per tenant.
- **Common admin role distinctions.**
  - **Application Administrator** vs **Cloud Application Administrator** — Cloud variant cannot manage on-prem App Proxy connectors.
  - **Authentication Administrator** can reset MFA for non-admins; **Privileged Authentication Administrator** can reset for admins too.
  - **User Administrator** cannot manage users in privileged roles.

## External identities

- **B2B collaboration** — guest user invitations with redemption; managed by Cross-tenant access settings (default + per-organization).
- **B2B Direct Connect** — Teams Shared Channels with another tenant; no guest object created; mutual trust configured in cross-tenant access settings.
- **Cross-Tenant Synchronization** — automatic guest-user provisioning between tenants in the same organization. Configure source + target with cross-tenant access settings; auto-redemption removes the need for guests to accept invitations.
- **Microsoft Entra External ID for customers (CIAM)** — strategic CIAM replacement for Azure AD B2C (closed to new purchases May 1, 2025). Separate tenant model with consumer self-sign-up, custom branding, federation with Google/Facebook/Apple/SAML IdPs.

## Hybrid identity

- **Authentication choices.**
  - **PHS** (Password Hash Sync) — hash-of-hash uploaded to Entra; works offline; required for leaked-credentials detection.
  - **PTA** (Pass-Through Authentication) — credentials validated against on-prem AD via lightweight agents (no hash in cloud); enforces real-time AD policy; needs 3 agents for HA.
  - **Federation** (AD FS) — full on-prem auth; complex; declining.
  - **Cloud Sync only supports PHS**, not PTA or federation.
- **Seamless SSO** — Kerberos-based desktop SSO; works with PHS or PTA; key auto-rolls every 30 days.
- **Connect Sync vs Cloud Sync.** Cloud Sync is Microsoft's future direction. Cloud Sync exclusives: disconnected forests, multiple active agents, on-demand provisioning, group provisioning to AD, Source of Authority management. Connect Sync still required for device sync, cross-forest references, complex sync rules.
- **Password writeback** — SSPR in cloud writes new password to on-prem AD; requires writeback permission on user OUs (and AdminSDHolder for protected accounts). Now supported by Cloud Sync.
- **Smart Lockout** — defaults 10 failures → 60 second lockout, doubling. Cloud-only; pair with on-prem AD account lockout for hybrid coverage.

## Authoritative Microsoft Learn URLs

- Choose hybrid authentication method: https://learn.microsoft.com/entra/identity/hybrid/connect/choose-ad-authn
- Microsoft Entra Cloud Sync overview: https://learn.microsoft.com/entra/identity/hybrid/cloud-sync/what-is-cloud-sync
- Cloud Sync vs Connect feature comparison: https://learn.microsoft.com/entra/identity/hybrid/cloud-sync/connect-to-cloud-sync-decision-guide
- Administrative units: https://learn.microsoft.com/entra/identity/role-based-access-control/administrative-units
- Restricted management administrative units: https://learn.microsoft.com/entra/identity/role-based-access-control/admin-units-restricted-management
- Dynamic group rule syntax: https://learn.microsoft.com/entra/identity/users/groups-dynamic-membership
- Cross-tenant synchronization: https://learn.microsoft.com/entra/identity/multi-tenant-organizations/cross-tenant-synchronization-overview
- Microsoft Entra External ID for customers: https://learn.microsoft.com/entra/external-id/customers/overview-customers-ciam
- Custom security attributes: https://learn.microsoft.com/entra/fundamentals/custom-security-attributes-overview
- Microsoft Entra Verified ID: https://learn.microsoft.com/entra/verified-id/decentralized-identifier-overview
