# 06: Research: hospital identity providers & SSO

Type: research
Status: resolved
Blocked by: None (can start immediately)
Map: [Evenly v1 map](../map.md)

## Question

Which IdPs do target hospitals use (Entra ID/Azure AD, Okta, Ping, Imprivata)? SAML vs OIDC prevalence, SCIM provisioning expectations, and whether Better Auth (or alternatives: WorkOS, Auth.js, Clerk) covers SAML+SCIM well enough for v1.

## Answer

Findings: [Hospital SSO & identity](../../../docs/research/0003-hospital-sso-identity.md). Better Auth facts verified from its published npm packages (1.7.25). Market share, prices and advisories rest on search summaries.

- Assume **Microsoft Entra ID**, with **Imprivata** badge-tap on shared workstations. Okta is second and Ping a distant third (directional only; real share data is behind KLAS).
- Build **SAML 2.0 first, then OIDC**. SCIM 2.0 is expected at enterprise scale; a single-department pilot can create accounts on first SSO login.
- **Better Auth** SSO and SCIM plugins cover SAML, OIDC, per-Organization providers, domain verification and SCIM for v1, with no licence cost. Evenly owns security patching; several high-severity SSO advisories in 2026 are fixed in current versions.
- **Phones:** long sliding session; the hospital's IdP policy decides re-authentication. Never log out on app switch. Badge-tap is Imprivata's job.
- **Locums and affiliated physicians:** their own federated IdP or Entra B2B guest, with a fallback email-code or magic-link + MFA login scoped to one Organization.
- **Recommendation:** Better Auth self-hosted on Drizzle/Postgres behind the existing session seam (ADR-0008), about 1–2 engineer-weeks. Fallback: WorkOS at about $125 per connection per month.
