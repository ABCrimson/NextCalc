# Security Policy

NextCalc Pro takes the security of our software and our users seriously. We appreciate
the efforts of security researchers and the broader community in helping us maintain
a secure platform.

---

## Supported Versions

| Version   | Supported          | Notes                                |
| --------- | ------------------ | ------------------------------------ |
| 1.2.x     | :white_check_mark: | Current release, actively maintained |
| 1.1.x     | :white_check_mark: | Security patches only                |
| < 1.1     | :x:                | End of life                          |

Only the latest minor release within each supported major.minor line receives security updates.
We strongly recommend running the latest version at all times.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, use one of the following channels:

### Preferred: GitHub Security Advisories

1. Navigate to the [Security Advisories](../../security/advisories) tab of this repository.
2. Click **"Report a vulnerability"**.
3. Fill in the details of the vulnerability.

GitHub Security Advisories allow us to collaborate privately on a fix before public disclosure.

### Alternative: Email

If you are unable to use GitHub Security Advisories, you may contact us at:

**security@nextcalc.dev**

Please encrypt sensitive details using our [PGP key](../../security/advisories) when possible.

---

## What to Include

To help us triage and respond quickly, please include as much of the following as possible:

- **Type of vulnerability** (e.g., XSS, SQL injection, CSRF, RCE, information disclosure)
- **Affected component** (e.g., `apps/web`, `apps/api`, `packages/math-engine`)
- **Step-by-step reproduction instructions**
- **Proof-of-concept or exploit code** (if available)
- **Impact assessment** — what an attacker could achieve
- **Suggested fix** (if you have one)

---

## Disclosure Timeline

We follow a coordinated disclosure process:

| Step | Timeline          | Action                                                         |
| ---- | ----------------- | -------------------------------------------------------------- |
| 1    | Day 0             | Report received and acknowledged                               |
| 2    | Within 48 hours   | Initial triage and severity assessment                         |
| 3    | Within 7 days     | Detailed investigation; reporter updated on progress           |
| 4    | Within 30 days    | Fix developed, tested, and deployed                            |
| 5    | Within 90 days    | Public advisory published with credit to the reporter          |

For critical vulnerabilities (CVSS 9.0+), we aim to ship a fix within **72 hours** of confirmation.

---

## Scope

The following are **in scope** for security reports:

- `apps/web` — Next.js frontend (authentication, session handling, XSS, CSRF)
- `apps/api` — GraphQL API (injection, authorization bypass, data exposure)
- `apps/workers/` — Cloudflare Workers (rate-limiter bypass, data exfiltration)
- `packages/math-engine` — Expression parsing (ReDoS, prototype pollution)
- `packages/database` — Prisma schema and data access layer
- Authentication and session management (NextAuth v5)
- Third-party integrations (OAuth providers, Redis, Neon)

The following are **out of scope**:

- Denial of service via excessive computation (math expressions are sandboxed)
- Vulnerabilities in third-party dependencies (report upstream; notify us if critical)
- Social engineering attacks
- Physical security

---

## Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, and service disruption
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a vulnerability beyond what is necessary to confirm its existence
- Report the vulnerability promptly and provide reasonable time for remediation

We will not initiate legal action against researchers who follow this policy.

---

## Recognition

We gratefully acknowledge security researchers who help keep NextCalc Pro safe.
With your permission, we will credit you in the security advisory and in our
[Hall of Fame](../../security/advisories).

---

*This policy is based on industry best practices and is subject to revision.
Last updated: March 2026.*
