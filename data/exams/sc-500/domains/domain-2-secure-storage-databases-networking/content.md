# SC-500 Domain 2 — Secure storage, databases, and networking (25–30%)

Quick-reference notes for the largest SC-500 domain. Pair with the 50 questions in `data/exams/sc-500.json` for this domain.

## Storage

- **SAS hierarchy.** **User delegation SAS** (signed with an Entra-issued user delegation key) > **Service SAS** > **Account SAS** (last two are signed with the storage account key). Always prefer user delegation SAS — revocation by revoking the delegation key or principal RBAC.
- **Disable Shared Key.** Set "Allow Shared Key access" to Disabled on the account to reject account-key-based access at the data plane. Affects service/account SAS too.
- **Network controls.** Private endpoint + Private DNS zone (`privatelink.blob.core.windows.net`) for zero public exposure. Service endpoint allows the account FQDN to stay public but restricts VNet sources via the storage firewall.
- **Defender for Storage (new plan).** Activity monitoring + Malware Scanning (per uploaded blob, Microsoft Defender Antivirus, billed per GB scanned) + Sensitive data threat detection (powered by Sensitive Data Discovery + Purview SITs/labels) + detection of compromised SAS tokens. Configure per-subscription or per-account.
- **CMK encryption.** Use a versionless Key Vault URI + user-assigned managed identity + Key Vault rotation policy for zero-downtime auto-rotation. Storage CMK supports cross-subscription Key Vault.
- **Immutable blob storage.** Container-level time-based retention policy; once **locked**, retention can only be extended (not shortened or removed). For SQL audit immutability, enable "Allow protected append writes".
- **Anonymous access prevention.** Set "Allow Blob anonymous access" = false at account level (overrides container settings). Pair with the Azure Policy "Storage accounts should prevent blob anonymous access".
- **Azure Files.** Use AD DS / Microsoft Entra Kerberos for identity-based SMB access with NTFS ACLs preserved.

## Databases

- **TDE service-managed vs CMK BYOK.** CMK gives full key lifecycle control; switching from service-managed only re-encrypts the DEK (fast, online). Revoking access in Key Vault renders the DB inaccessible.
- **Always Encrypted.** Only feature that hides data from DBAs (column encryption key stays client-side; the engine processes only ciphertext). Secure enclaves extend to richer query patterns. TDE doesn't separate data owner from DBA; Dynamic Data Masking is presentation-only.
- **Microsoft Entra-only authentication.** Server-level setting that disables SQL authentication for new connections. Combine with the Azure Policy "Azure SQL servers should have Microsoft Entra-only authentication enabled" with Deny effect for tenant-wide enforcement.
- **Auditing destinations.** Storage account (use managed identity when storage is Entra-only), Log Analytics (Sentinel-ready), Event Hubs. Configure server-level (inherited by databases) plus optional per-database.
- **Defender for Databases.** Umbrella for four separately-priced plans: Azure SQL Databases, SQL Servers on Machines, Open-Source Relational DBs (PostgreSQL/MySQL/MariaDB on Azure & AWS RDS), Azure Cosmos DB. SQL VM via Azure Arc + Defender for SQL Servers on Machines auto-deploys an extension.
- **Vulnerability assessment baselines.** Per-rule per-database baselining — once you approve current state as baseline, only deviations are flagged.
- **Conditional Access on SQL.** Target the "Azure SQL Database" enterprise app to enforce MFA / compliant device on interactive SSMS / Azure Data Studio sessions.
- **PostgreSQL Flexible Server.** Use Private access (VNet integration) for zero public exposure; combine with Private DNS zone.

## Networking

- **NSGs + ASGs.** Use ASGs to express NSG rules in terms of application roles (`asg-web`, `asg-app`, `asg-db`). NSGs have default rules: AllowVnetInBound, AllowAzureLoadBalancerInBound, DenyAllInBound. Custom rule priorities can override defaults.
- **Flow logs migration.** Migrate NSG flow logs to **Virtual Network flow logs** (capture all VNet traffic regardless of NSG attachment) using Microsoft's documented migration path.
- **AVNM security admin rules.** Evaluated before NSGs and cannot be overridden by NSG rules. Use to enforce tenant-wide blocks (e.g., SSH/RDP from Internet) without taking NSGs away from app teams. Skipped by default for VNets with SQL Managed Instance / Databricks; opt in via `AllowRulesOnly`.
- **AVNM connectivity configs.** Hub-and-spoke or mesh; enable Direct connectivity within a network group for high-throughput spoke-to-spoke without going through the hub.
- **Virtual WAN Routing Intent.** Required to send inter-hub, branch-to-branch, V2V, B2V, V2I, B2I traffic through Azure Firewall without authoring UDRs manually.
- **Azure Firewall.** Standard = FQDN application rules + network rules + threat intel. Premium = TLS inspection (requires intermediate CA in Key Vault + managed identity), IDPS (Alert / Alert and deny modes), URL filtering, web categories. DNS proxy + firewall as DNS server = FQDN-in-network-rules support.
- **Forced tunneling.** Requires the Management subnet (`AzureFirewallManagementSubnet`) created at firewall creation + Forced Tunneling feature + UDR pointing 0/0 to on-prem.
- **Entra Private Access.** Quick Access (broad bucket) → per-app access (one Global Secure Access enterprise application per app for per-app Conditional Access). Source IP restoration preserves the original user IP in sign-in logs for location-based CA.
- **Private Endpoint vs Private Link Service.** Private Endpoint = consumer NIC in YOUR VNet that resolves a target service to a private IP. Private Link Service = provider side (publish a service behind a Standard LB so consumers can attach their own Private Endpoints).
- **DDoS.** Network Protection = flat-rate, full features per VNet. IP Protection = per-public-IP billing, same mitigation, smaller orgs.
- **WAF.** App Gateway WAF v2 = regional, in your VNet. Front Door WAF = global edge POPs (anycast). Both support OWASP Core Rule Set.
- **Bastion SKUs.** Basic = portal-only. Standard = native client (mstsc/az network bastion ssh), host scaling, IP-based connection. Premium = session recording.
- **VPN Gateway.** OpenVPN tunnel type is required for Microsoft Entra ID authentication via the Azure VPN Client; Basic SKU does not support OpenVPN.

## Authoritative Microsoft Learn URLs

- Storage SAS overview: https://learn.microsoft.com/azure/storage/common/storage-sas-overview
- Prevent Shared Key authorization: https://learn.microsoft.com/azure/storage/common/shared-key-authorization-prevent
- Defender for Storage: https://learn.microsoft.com/azure/defender-for-cloud/defender-for-storage-introduction
- Customer-managed keys for Storage: https://learn.microsoft.com/azure/storage/common/customer-managed-keys-overview
- Immutable blob storage: https://learn.microsoft.com/azure/storage/blobs/immutable-time-based-retention-policy-overview
- Always Encrypted: https://learn.microsoft.com/sql/relational-databases/security/encryption/always-encrypted-database-engine
- Azure SQL TDE with CMK (BYOK): https://learn.microsoft.com/azure/azure-sql/database/transparent-data-encryption-byok-overview
- Microsoft Entra-only authentication with Azure SQL: https://learn.microsoft.com/azure/azure-sql/database/authentication-azure-ad-only-authentication
- Defender for Databases overview: https://learn.microsoft.com/azure/defender-for-cloud/defender-for-databases-overview
- AVNM security admin rules: https://learn.microsoft.com/azure/virtual-network-manager/concept-security-admins
- Virtual WAN Routing Intent: https://learn.microsoft.com/azure/virtual-wan/how-to-routing-policies
- Azure Firewall Premium features: https://learn.microsoft.com/azure/firewall/premium-features
- Microsoft Entra Private Access: https://learn.microsoft.com/entra/global-secure-access/concept-private-access
- Azure Private Endpoint DNS: https://learn.microsoft.com/azure/private-link/private-endpoint-dns
- Azure DDoS Protection SKU comparison: https://learn.microsoft.com/azure/ddos-protection/ddos-protection-sku-comparison
