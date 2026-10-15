# HireKiwi Engineering Handbook

## 1. Engineering Mission & Architectural Principles

At HireKiwi, our mission is to build resilient, developer-centric, and high-performance talent intelligence infrastructure. Every engineer is expected to design and build systems that adhere to these foundational principles:

### 1.1 Microservices and Service Boundaries
- Services must be decoupled, independently deployable, and communicate via well-defined contract schemas.
- Inter-service synchronous communication must use gRPC with Protocol Buffers (`proto3`).
- Asynchronous communication and event streaming must use Apache Kafka or AWS SQS/SNS with idempotent consumer patterns.
- External client-facing APIs follow RESTful conventions with OpenAPI 3.1 specifications.

### 1.2 The 12-Factor App Methodology
- Configuration must be isolated strictly in environment variables; never hardcode credentials or URLs.
- Treat backing services (databases, caches, message brokers) as attached resources.
- Execute the app as one or more stateless processes with state persisted in PostgreSQL, Redis, or S3.
- Fast startup and graceful shutdown: services must handle `SIGTERM` within 30 seconds to allow seamless Kubernetes rolling deployments.

---

## 2. Git Workflow, Branching & Pull Requests

### 2.1 Branching Strategy
- We follow **Trunk-Based Development** with short-lived feature branches:
  - `main`: Production-ready branch. Direct pushes to `main` are strictly blocked.
  - `feature/<ticket-id>-<short-description>`: For new capabilities.
  - `bugfix/<ticket-id>-<short-description>`: For defects and patch releases.
  - `hotfix/<ticket-id>-<short-description>`: For critical production remediations branched off the latest release tag.
- Branches must not live longer than 3 calendar days before merging or rebasing.

### 2.2 Pull Request Standards
- **Minimum Approvals**: Every pull request requires at least **two peer approvals**, including at least one Staff Engineer or Code Owner approval for core services.
- **PR Description Template**:
  - Context & Jira ticket reference.
  - Summary of changes and trade-offs made.
  - Verification steps (automated tests, manual validation logs, performance benchmarks).
  - Screenshots / API payloads where applicable.
- All CI status checks (linting, unit tests, integration tests, security scan) must pass before merging.

---

## 3. Code Quality, Linters & Testing Standards

### 3.1 Python Standards
- Python runtime: Python 3.11+.
- Formatting and linting: `ruff` (for linting and imports sorting) and `black` (line length 100).
- Static type checking: `mypy` with `--strict` mode enabled on all new modules.
- Virtual environment and dependency management: `uv` or `poetry`.

### 3.2 TypeScript / Frontend Standards
- TypeScript 5.0+ with strict null checks.
- Code style: ESLint and Prettier.
- Component structure: Functional components with hooks, Tailwind CSS for styling, and modular state management.

### 3.3 Test Coverage & Quality Gates
- **Unit Test Coverage**: Minimum **85% line coverage** for backend services; PRs dropping total repo coverage are automatically blocked by SonarQube.
- **Integration Tests**: Every API endpoint must have automated integration tests verifying database transactions, authentication token verification, and error edge cases (400, 401, 403, 404, 429, 500).
- **End-to-End (E2E) Tests**: Critical user flows (auth, candidate ingestion, search pipeline) are validated nightly using Playwright.

---

## 4. CI/CD Deployment Pipeline & Kubernetes Operations

### 4.1 Deployment Automation
- Deployment pipelines are fully automated via GitHub Actions and ArgoCD.
- Pipeline stages:
  1. `Validate`: Linting, static analysis, type checking.
  2. `Test`: Unit and integration test suites executed in isolated ephemeral containers.
  3. `Build`: Multi-stage Docker builds producing minimal distroless container images.
  4. `Security Scan`: Container vulnerability scanning via Trivy. Builds with CRITICAL CVEs are halted.
  5. `Deploy Staging`: Automated continuous deployment to the staging Kubernetes cluster.
  6. `Deploy Production`: Blue-Green or Canary rollout to production with 10% traffic increment every 5 minutes.

### 4.2 Automated Rollback Triggers
- Prometheus metrics are monitored continuously during deployments.
- If the 5xx HTTP error rate exceeds **1.0%** over a 2-minute rolling window, or if P99 latency spikes above **500ms**, ArgoCD automatically triggers an immediate zero-downtime rollback to the prior release.

---

## 5. On-Call Rotation, Incident Response & SLA Tiers

### 5.1 On-Call Rotation
- Primary and secondary on-call shifts rotate weekly on Tuesdays at 10:00 AM UTC.
- On-call engineers are compensated with an on-call stipend and post-shift comp time for overnight incident pages.

### 5.2 Severity Levels and Response SLOs
| Severity | Definition | Response SLO | Target Resolution | Escalation |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Complete service outage or severe data corruption impacting >10% of users. | **< 15 minutes** | < 2 hours | VP of Engineering & CTO paged immediately. |
| **SEV-2 (Major)** | Core feature degraded with no viable customer workaround. | **< 30 minutes** | < 4 hours | Engineering Manager paged within 45 min. |
| **SEV-3 (Moderate)**| Non-critical feature failure or minor customer impact with workaround. | **< 2 hours** | < 24 hours | Handled during local business hours. |
| **SEV-4 (Minor)** | Minor UI bug or cosmetic issue with negligible business impact. | **< 24 hours** | Next sprint | Tracked via standard Jira backlog. |

### 5.3 Incident Post-Mortem & Blameless Culture
- Every SEV-1 and SEV-2 incident requires a blameless post-mortem document completed within **72 hours**.
- The post-mortem must detail the root cause analysis (5 Whys), timeline of events, detection gap, and actionable preventative action items with assigned owners.

---

## 6. API Versioning, Uptime Commitments & Performance SLAs

- **Public API SLA**: HireKiwi guarantees **99.95% monthly uptime** for enterprise tier customers.
- **Latency Targets**:
  - P50 latency < 50ms for cached read requests.
  - P95 latency < 150ms for standard database queries.
  - P99 latency < 200ms across all endpoints.
- **API Deprecation Policy**:
  - API versions are specified via path prefix (e.g., `/api/v1`, `/api/v2`).
  - Deprecated endpoints must remain active with functional parity for a minimum of **180 days** following deprecation announcement.
  - Sunset warnings must be communicated via HTTP response headers: `Sunset: <date>` and `Deprecation: true`.
