# Security policy

## Supported version

Security fixes are applied to the current production line on `main`. The `staging` branch is a pre-production validation branch and should not be treated as a separately supported release.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability or include personal information, assessment responses, access tokens, or database credentials in a report.

Email `hello@olqlab.com` from the [OLQ Lab contact page](https://www.olqlab.com/contact)
and state that your message concerns a security issue. Include the affected URL or
component, the observed impact, and concise reproduction steps. Share the minimum
data needed to demonstrate the issue.

OLQ Lab will review reports and coordinate an appropriate response. This repository does not currently operate a public bug-bounty program or promise a fixed response timeline.

## Scope notes

High-priority reports include authentication or authorization bypasses, exposure of participant assessment data or reports, cross-tenant access, unsafe file handling, and vulnerabilities in public report-share links.

Testing must not disrupt the service, send unsolicited email, access another person’s data, or degrade availability. Use accounts and data you are authorized to test.
