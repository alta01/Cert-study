# SC-300 Domain 4 — Plan and automate identity governance (20–25%)

Pair with the 40 questions in `data/exams/sc-300.json` for this domain.

## Privileged Identity Management (PIM)

- **Eligible vs Active assignments.**
  - **Eligible** — user must activate (with MFA, justification, approval) to use the role.
  - **Active** — always in the role. Reserved for break-glass accounts.
- **Role settings.**
  - Activation max duration (1–24 hours)
  - Require MFA on activation, require justification, require ticket info
  - Require approval — define approvers (or rely on currently-active members; LOCKOUT RISK if all admins are eligible-only and no break-glass account exists).
- **PIM scopes.** Microsoft Entra roles, Azure resource roles (subscriptions/RGs/resources), PIM for Groups (just-in-time membership of role-assignable security groups), PIM for workload identities (preview — service principals).
- **PIM Discovery and Insights.** Surfaces over-permissioned roles and recommendations to convert active assignments to eligible. Useful for PIM rollout.
- **Security alerts.** "Roles are being assigned outside of PIM", "Too many Global Administrators", "Inactive privileged accounts", "Administrators aren't using their privileged roles".
- **Audit history.** Up to 30 days in PIM portal; longer via Microsoft Entra audit log + diagnostic settings export.

## Entitlement management

- **Access packages.** Bundles of resources (groups, apps, SharePoint sites, Microsoft Entra roles via PIM-eligible assignment) that users request via a portal. Lifecycle: request → approval → assignment → expiration / review.
- **Catalogs.** Containers for access packages and resources. Delegate via Catalog Owner / Creator / Reader. Resources must be added to the catalog before they can be referenced in access packages.
- **Connected organizations.** Two types: Configured (specific tenant or domain you trust) and Allow-listed (any tenant). External users from connected organizations can request access packages.
- **Approval workflows.** Single-stage (one approver) or Multi-stage (sequential approvers, e.g., manager → resource owner → security team). Sponsors and Stage 1/2 approvers configurable.
- **Custom extensions.** Logic App callbacks during the access package lifecycle (assignment granted / removed) — integrate with ITSM, HR, licensing.
- **Verified ID integration.** Require presentation of a verifiable credential during the request workflow.
- **Privileged role assignment via packages.** Access package can grant a PIM-eligible role assignment as part of resource provisioning.

## Access reviews

- **Scope targets.** Microsoft Entra groups, Microsoft 365 groups, Microsoft Entra role assignments, Azure resource role assignments, access package assignments, applications, B2B guest users in groups/teams.
- **Reviewer types.** Members themselves (self-review), specific users, group owners, or managers.
- **Multi-stage reviews.** Up to 3 stages (e.g., manager → group owner → security team). Available with Microsoft Entra ID Governance.
- **Recommendations.** Inactive user recommendation (auto-deny if user hasn't signed in within N days). Helps reviewers triage at scale.
- **Auto-apply.** Apply the review decision automatically at review end (remove non-attested users). For synced groups, auto-apply works only on cloud-managed groups (not on-prem AD groups).
- **Privileged role reviews.** Use access reviews of Microsoft Entra roles (PIM-eligible) targeting Global Admin / Privileged Role Administrator / etc. on a quarterly cadence with appropriate reviewers.

## Lifecycle Workflows

- **Categories.** Joiner (before/on hire date), Mover (job/department change), Leaver (before/on/after termination).
- **Triggers.** On-demand, scheduled (recurrence), attribute-based (employeeHireDate / employeeLeaveDateTime with offsetInDays). Pre-hire (negative offset) and post-hire (positive offset) supported.
- **Built-in tasks.** Generate TAP, add to groups, send welcome email, disable account, remove from groups, delete user, send manager notification, run a custom task extension.
- **Custom task extensions.** Logic App-based callbacks for non-Entra actions (ITSM ticket, third-party provisioning).
- **Tenant limits.** Default 50 workflows / tenant, 100 if requested. Each workflow ≤ 25 tasks. Up to 10,000 users per execution.

## Monitoring and reporting

- **Diagnostic settings.** Fan-out per-log destinations: Log Analytics workspace, Azure Storage (archive), Event Hub (SIEM streaming), Partner solutions.
- **Log retention by tier.** Free: 7 days (sign-in logs). P1/P2: 30 days. Beyond 30 days requires Log Analytics export with workspace retention policy or Azure Storage archival.
- **Identity Secure Score.** Microsoft Entra ID's posture score with improvement recommendations (e.g., remove guest with no recent activity, enable MFA for admin roles, configure SSPR). Updated daily.
- **Identity Governance dashboard.** Unified view of Lifecycle Workflows, Entitlement Management, Access Reviews, PIM telemetry.

## Adjacent

- **Microsoft Entra Permissions Management (CIEM).** Discover identities with unused permissions across Azure / AWS / GCP; Permission Creep Index; recommended right-sized roles. Standalone or integrated with Defender CSPM.
- **Source of Authority (SOA) management.** Cloud Sync feature — move authoritative source of specific attributes from on-prem AD to Microsoft Entra ID for cloud-first management.

## Authoritative Microsoft Learn URLs

- Privileged Identity Management overview: https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-configure
- Configure PIM role settings: https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-how-to-change-default-settings
- PIM security alerts: https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-how-to-configure-security-alerts
- Entitlement management overview: https://learn.microsoft.com/entra/id-governance/entitlement-management-overview
- Create catalogs in entitlement management: https://learn.microsoft.com/entra/id-governance/entitlement-management-catalog-create
- Entitlement management custom extensions: https://learn.microsoft.com/entra/id-governance/entitlement-management-logic-apps-integration
- Access reviews overview: https://learn.microsoft.com/entra/id-governance/access-reviews-overview
- Create an access review: https://learn.microsoft.com/entra/id-governance/create-access-review
- Lifecycle Workflows overview: https://learn.microsoft.com/entra/id-governance/what-are-lifecycle-workflows
- Lifecycle Workflows tasks reference: https://learn.microsoft.com/entra/id-governance/lifecycle-workflow-tasks
- Lifecycle Workflows custom task extensions: https://learn.microsoft.com/entra/id-governance/lifecycle-workflow-extensibility
- Microsoft Entra ID Governance licensing: https://learn.microsoft.com/entra/id-governance/licensing-fundamentals
- Microsoft Entra diagnostic settings: https://learn.microsoft.com/entra/identity/monitoring-health/howto-configure-diagnostic-settings
- Identity Secure Score: https://learn.microsoft.com/entra/fundamentals/identity-secure-score
- Microsoft Entra Permissions Management: https://learn.microsoft.com/entra/permissions-management/overview
