# HireKiwi Cloud Security & Compliance Policy

## 1. Governance & Zero Trust Architecture

HireKiwi enforces a strict **Zero Trust Architecture** across all cloud environments (AWS, GCP, and Cloudflare Edge). Trust is never assumed based on network location; every identity, device, and request must be explicitly verified and authenticated before access is granted.

### 1.1 Identity and Access Management (IAM)
- **Principle of Least Privilege**: All IAM roles, service accounts, and employee credentials must provide only the minimum permissions necessary to execute assigned duties.
- **Multi-Factor Authentication (MFA)**: Hardware security keys (FIDO2 / WebAuthn) or time-based one-time passwords (TOTP) are mandatory for all production systems, code repositories, and VPN gateways. SMS-based MFA is strictly prohibited.
- **Session Duration**: Production AWS IAM session durations are capped at a maximum of **60 minutes** before requiring re-authentication.
- **Quarterly Access Reviews**: All user and service account entitlements are recertified every 90 days. Dormant accounts (>30 days inactive) are automatically suspended.

---

## 2. Cryptographic Controls & Data Protection

### 2.1 Encryption at Rest
- All customer data stored in Amazon Aurora PostgreSQL, DynamoDB, and Amazon S3 buckets must be encrypted using **AES-256** or **AWS KMS Customer Managed Keys (CMK)**.
- KMS encryption keys are configured for **automatic annual key rotation**.
- Database volume backups and snapshots inherit the same cryptographic encryption as the source volumes.

### 2.2 Encryption in Transit
- All external and internal service-to-service communication must enforce **TLS 1.3** (TLS 1.2 permitted only for legacy webhook endpoints).
- HTTP Strict Transport Security (HSTS) with a `max-age` of at least 31,536,000 seconds (1 year) and `includeSubDomains` is mandatory for all HireKiwi public domain names.
- Insecure ciphers (including DES, 3DES, RC4, MD5) are disabled across all Application Load Balancers and Cloudflare Edge Proxies.

### 2.3 Secrets & Key Management
- Secrets must never be committed to source code repositories, Dockerfiles, or environment configuration files.
- All dynamic secrets, database credentials, and third-party API keys are stored in **AWS Secrets Manager** or **HashiCorp Vault**.
- High-privilege API tokens undergo automated rotation every **90 days**.

---

## 3. Network Security & Perimeter Defense

### 3.1 Virtual Private Cloud (VPC) Isolation
- Production databases, caches, and internal compute nodes are deployed strictly within **isolated private subnets** without direct internet route gateways.
- Ingress into the VPC is controlled exclusively through AWS Application Load Balancers behind Cloudflare DDoS and Web Application Firewall (WAF) layers.
- Egress internet access from private subnets is routed through NAT Gateways with strict domain allowlists.

### 3.2 Web Application Firewall (WAF) Rules
- AWS WAF and Cloudflare rules block top OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF, Remote Code Execution).
- Rate limiting is configured at **2,000 requests per 5 minutes per IP address** for standard endpoints and **10 requests per minute** for authentication/login endpoints.

---

## 4. Container & Kubernetes Workload Hardening

### 4.1 Container Image Security
- Container images must use minimal base images (such as Google Distroless or Alpine Linux).
- Containers must never run as the `root` user (`runAsNonRoot: true` in Kubernetes security contexts).
- Container root filesystems must be mounted as read-only (`readOnlyRootFilesystem: true`), with ephemeral `/tmp` volumes allocated via `emptyDir` memory mounts.

### 4.2 Runtime Security & Admission Controllers
- Kyverno and OPA Gatekeeper admission controllers enforce security context constraints prior to pod scheduling.
- Runtime intrusion detection is performed using **Falco**, monitoring syscall anomalies, unexpected shell executions, and outbound socket creations from production pods.

---

## 5. Vulnerability Management & Incident SLA

### 5.1 Scanning and Patching Schedule
- **Static Application Security Testing (SAST)**: Executed on every pull request via Semgrep.
- **Software Composition Analysis (SCA)**: Automated daily Snyk scans across all dependencies.
- **Container Image Scanning**: Trivy scans images during the CI/CD build phase and blocks any container containing CRITICAL or HIGH severity CVEs.

### 5.2 Vulnerability Remediation SLAs
| CVE Severity | CVSS Score | Remediation SLA | Escalation Target |
| :--- | :--- | :--- | :--- |
| **Critical** | 9.0 - 10.0 | **< 48 hours** | Security Director & CTO |
| **High** | 7.0 - 8.9 | **< 7 calendar days** | Lead Platform Engineer |
| **Medium** | 4.0 - 6.9 | **< 30 calendar days** | Product Engineering Team |
| **Low** | 0.1 - 3.9 | **< 90 calendar days** | Backlog prioritization |

---

## 6. Compliance, Audit Logging & Breach Notification

### 6.1 Regulatory Compliance
- HireKiwi maintains **SOC 2 Type II** certification and **ISO/IEC 27001** certification with annual external audits.
- Full compliance with General Data Protection Regulation (GDPR) and California Consumer Privacy Act (CCPA), including automated Subject Access Requests (SAR) and "Right to be Forgotten" deletion pipelines.

### 6.2 Audit Logging & Retention
- AWS CloudTrail, VPC Flow Logs, and Kubernetes audit logs are streamed real-time to Amazon S3 Object Lock buckets with immutable Write-Once-Read-Many (WORM) storage.
- Audit logs are retained for a minimum of **365 days** (1 year) to satisfy regulatory requirements.

### 6.3 Security Breach Notification Protocol
- In the event of a confirmed security breach involving customer data or personally identifiable information (PII):
  - HireKiwi CSIRT must isolate the impacted systems within **1 hour**.
  - Affected enterprise customers and regulatory bodies must be formally notified within **24 hours** of breach confirmation.
