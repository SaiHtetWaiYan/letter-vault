# Security Policy

Thank you for taking the time to responsibly disclose any issues you find.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue in Letter Vault, email:

📧 **saihtetwaiyan.contact@gmail.com**

Include as much of the following as you can:

- A description of the issue and its potential impact
- Steps to reproduce
- Affected version / commit hash
- Any proof-of-concept code, screenshots, or logs
- Your name / handle (for credit, if you'd like)

## What to expect

- **Acknowledgement** within 72 hours
- **Initial assessment** within 7 days
- **Fix timeline** depends on severity — critical issues are prioritized immediately
- **Credit** in the release notes if you'd like to be named

## Scope

In scope:

- The Letter Vault application code in this repository
- Authentication, session handling, encryption, and unlock logic
- Cross-site scripting, CSRF, SQL injection, privilege escalation
- Anything that could expose letter contents, recipient data, or account credentials

Out of scope:

- Vulnerabilities in dependencies (please report upstream)
- Issues that require physical access to the server
- Social engineering of administrators
- Denial-of-service via unrealistic request volume
- Self-XSS or issues requiring an already-compromised account

## Safe harbor

Good-faith security research conducted under this policy will not result in legal action.

Please:

- Don't access, modify, or delete data belonging to other users
- Don't disrupt the service for other users
- Don't share the vulnerability publicly until it has been patched
