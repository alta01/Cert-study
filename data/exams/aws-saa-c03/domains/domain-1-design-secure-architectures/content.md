# Domain 1: Design Secure Architectures

> **Exam weight:** 30% | **SAA-C03**

This domain covers designing secure access to AWS resources, secure workloads and applications, and appropriate data security controls.

---

## 1. IAM Fundamentals

AWS Identity and Access Management (IAM) provides fine-grained access control across all AWS services.

**Key concepts:**
- **Users** – human identities with long-term credentials
- **Groups** – collections of users sharing the same permissions
- **Roles** – assumed identities with temporary credentials; used by services, cross-account access, and federated users
- **Policies** – JSON documents that define allow/deny rules

**Best practice:** Apply the principle of *least privilege* – grant only the permissions required to perform a task.

### IAM Policy Evaluation Logic

1. Explicit **Deny** always wins
2. **Allow** in identity policy or resource policy
3. Default **Deny** (implicit)

> 💡 **Exam tip:** Service Control Policies (SCPs) in AWS Organizations set the maximum permissions for an account but do not grant permissions themselves.

---

## 2. Encryption at Rest

| Encryption type | Key owner | Use case |
|---|---|---|
| SSE-S3 | AWS | General-purpose, lowest overhead |
| SSE-KMS | You (CMK) | Audit, fine-grained access, compliance |
| SSE-C | Customer | Full key control; AWS never stores key |
| Client-side | Customer | Encrypt before upload |

**SSE-KMS with customer-managed CMK** is required when you need:
- Per-role decryption control via KMS key policy
- CloudTrail audit of every decrypt operation
- Automatic key rotation

---

## 3. Amazon Cognito

Used to add user sign-up, sign-in, and access control to web/mobile apps.

- **User Pools** – user directory for authentication (returns JWTs)
- **Identity Pools (Federated Identities)** – exchange third-party tokens for temporary AWS credentials via STS

> 💡 **Exam tip:** Mobile apps should never embed IAM long-term credentials. Use Cognito Identity Pools to vend scoped temporary credentials.

---

## 4. Audit Logging with AWS CloudTrail

CloudTrail records every AWS API call. For compliance:

- Enable a **multi-region trail** to capture global service events
- Enable **log file validation** to detect tampering
- Store logs in S3 with **Object Lock (COMPLIANCE mode)** for immutable retention
- Create **CloudWatch Metric Filters** on the CloudTrail log group for near-real-time alerting (e.g., root account usage, console logins without MFA)

### Root Account Usage Alert (CIS Benchmark 1.7)

```json
{
  "filterPattern": "{ $.userIdentity.type = \"Root\" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != \"AwsServiceEvent\" }",
  "metricName": "RootAccountUsage"
}
```

---

## 5. Network Security

### Security Groups vs. NACLs

| | Security Groups | Network ACLs |
|---|---|---|
| Operates at | Instance (ENI) level | Subnet level |
| State | Stateful | Stateless |
| Rule type | Allow only | Allow and Deny |
| Rule evaluation | All rules evaluated | Rules evaluated in order (lowest number first) |

### VPC Endpoints

Keep traffic between AWS services inside the AWS network:

- **Interface endpoints** (PrivateLink) – for most services, place an ENI in your VPC
- **Gateway endpoints** – S3 and DynamoDB only, free of charge

---

## 6. AWS Shield & WAF

| Service | Protects against |
|---|---|
| AWS Shield Standard | Layer 3/4 DDoS (included free) |
| AWS Shield Advanced | Sophisticated DDoS, cost protection, 24/7 DDoS response team |
| AWS WAF | Layer 7 attacks (SQL injection, XSS, bad bots) |

> 💡 **Exam tip:** AWS WAF can be attached to CloudFront, ALB, API Gateway, or AppSync.

---

## References

- [AWS IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/)
- [Amazon S3 – Protecting data with encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html)
- [AWS CloudTrail User Guide](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/)
- [AWS Well-Architected Framework – Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)
