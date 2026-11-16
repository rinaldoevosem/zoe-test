# Hospital identity providers and SSO for Zoe

_Researched 2026-11-16 with the `research` skill. **Source limits:** this session's network blocked `better-auth.com`, `workos.com` and other vendor hosts for WebFetch. Better Auth facts marked **[npm]** were checked directly in the published `better-auth`, `@better-auth/sso` and `@better-auth/scim` 1.7.25 packages from the npm registry, so they are high confidence. Everything else comes from search-result summaries of the cited pages and is **lower confidence**. Re-verify prices, BAA terms and advisory ranges before quoting them externally._

## Answer

- **Assume Microsoft Entra ID, with Imprivata in front of it on clinical workstations.** Okta is the second most likely IdP and Ping is a distant third. No public market-share data exists; KLAS sells it. Treat this ranking as directional.
- **Ship SAML 2.0 first and OIDC second.** Hospital IdPs and Imprivata do both. SAML is still what hospital IT asks for by default, and Okta's catalog requires SHA-256 signing.
- **SCIM is expected at enterprise scale but not needed to launch a single-department pilot.** Plan SCIM 2.0 for Users and Groups to handle deprovisioning, and start the pilot with just-in-time provisioning from SSO.
- **Better Auth covers SAML, OIDC, per-organization providers, domain verification and SCIM 2.0 well enough for v1** [npm], at no license cost. The price is that we own the security patching: several high-severity SSO advisories were published in 2026.
- **Phone sessions should be long and sliding, and the hospital's IdP policy decides when to re-check.** Do not wipe the session when the app goes to the background. Leave badge tap to Imprivata on shared workstations.
- **Locums and private-group physicians** sign in through their own organization's IdP where it is federated, through an Entra B2B guest account if the hospital prefers that, and otherwise through a Zoe-local login with email OTP or magic link plus MFA, scoped to that one organization.
- **Recommendation:** use Better Auth (self-hosted, Drizzle, Postgres) for v1, at about $0 in license cost plus roughly 1–2 engineer-weeks. Keep WorkOS as a fallback that can be swapped in behind the existing session seam, at about $125/month per connection (SSO and SCIM each count as one).

## Findings

### Which IdPs hospitals use

- In 2020, KLAS said Imprivata's "strong market share" in healthcare SSO gave it weight in IAM purchases. KLAS called Okta technologically strong but a poor fit for some hybrid/on-prem shops, and had validated no wins for Ping (https://klasresearch.com/report/identity-and-access-management-2020-healthcare-looks-well-beyond-sso/1449). The full report is paywalled; this rests on a summary.
- Imprivata claims more than half of Epic health systems use it (https://www.imprivata.com/ehr-epic). This is vendor marketing. Its Epic reference architecture names AD and/or Entra ID as the identity store, with Entra used as the IdP for SSO (https://docs.imprivata.com/supported/content/topics/ecc/2_identity%20authentication.html).
- Imprivata OneSign acts as a SAML 2.0 IdP (https://docs.imprivata.com/onesign/content/topics/onesign/sso/saml_adfs.html) and as an OIDC IdP (https://docs.imprivata.com/onesign/content/topics/onesign/sso/oidc_.html). The cloud IdP ties these to OneSign badge-tap sessions (https://docs.imprivata.com/mda/content/topics/authenticationmethods.html).
- A 2026 Imprivata survey found that 85% of healthcare IT leaders call passwordless vital but adoption remains low (https://www.securityinfowatch.com/security-executives/news/55344530/imprivata-healthcare-it-leaders-embrace-passwordless-authentication-in-principle-but-deployment-remains-elusive). Passwords plus MFA through the IdP are still the norm.

### SAML vs OIDC, and SCIM expectations

- Okta's catalog (OIN) requires multi-tenant apps and SHA-256 SAML signing. It supports SAML, OIDC and SCIM integrations (https://developer.okta.com/docs/guides/submit-app-prereq/main, https://developer.okta.com/docs/guides/submit-sso-app/saml2/main/). One Okta support thread says SCIM cannot currently be attached to an OIDC OIN app (https://support.okta.com/help/s/question/0D54z0000AE5x9XCQR/could-we-publish-a-scim-provisioning-app-in-oin-without-sso-app-integration). That is a reason to pair SCIM with SAML for Okta customers.
- Entra provisions to non-gallery apps over SCIM 2.0. Microsoft publishes a list of known compliance quirks, including that `/scim` must be part of the endpoint path, and asks vendors to test with its SCIM Validator (https://learn.microsoft.com/en-us/entra/identity/app-provisioning/application-provisioning-config-problem-scim-compatibility, https://azure.microsoft.com/documentation/articles/active-directory-scim-provisioning/).
- No public source says QGenda supports SCIM. A search for QGenda SSO documentation returned nothing (search only). Zoe's own landscape note lists "SAML SSO" among QGenda's integrations (docs/research/0001-qgenda-landscape.md).

### Better Auth and alternatives

- **Better Auth SSO** [npm]: The plugin's README says it adds "SAML and OIDC enterprise SSO". Its routes include `/sso/register`, `/sso/saml2/sp/acs/:providerId`, `/sso/saml2/sp/metadata`, single logout (`/sso/saml2/sp/slo/:providerId`) and domain verification (`/sso/request-domain-verification`, `/sso/verify-domain`). Its options include `organizationId`, `wantAssertionsSigned`, encrypted assertions, `idpInitiated`, `defaultRole` and `disableImplicitSignUp`. SAML handling depends on `samlify`.
- **Better Auth SCIM** [npm]: The plugin provides SCIM 2.0 Users, Groups, Schemas, ResourceTypes and ServiceProviderConfig under `/scim/v2`. It authenticates connections with bearer tokens, supports rotating credentials, and can link a connection to an `organization`. Its README calls it "a focused subset" of RFC 7643/7644. The docs say provisioning "does not create a sign-in method", so SSO is still needed (https://better-auth.com/docs/plugins/scim.md).
- **Better Auth core** [npm]: The core package exports a Drizzle adapter and plugins for `organization`, `email-otp`, `magic-link`, `two-factor` and `multi-session`. A separate `@better-auth/passkey` package exists.
- **Better Auth security record:** 2026 advisories include CVE-2026-53515, where an org member could register a rogue SSO provider (fixed in 1.6.11). They also include GHSA-prpr-5gj3-qqhg, where SAML assertions were not bound to the initiating session (fixed in 1.6.21), and a samlify XML-injection bug fixed by moving to samlify 2.13.1 (https://better-auth.com/blog/security-update-june-2026, https://advisories.gitlab.com/npm/@better-auth/sso/CVE-2026-53515/, https://advisories.gitlab.com/npm/samlify/CVE-2026-46490/). Version 1.7.25 pins samlify ^2.13.1 [npm].
- **Auth.js** handles SAML only through the BoxyHQ/Jackson OAuth bridge (https://authjs.dev/getting-started/providers/boxyhq-saml). The project has been under Better Auth's maintainers since September 2025 (https://better-auth.com/blog/authjs-joins-better-auth). It is not a good base for new work.
- **WorkOS**: AuthKit is free up to 1M MAU. SSO and Directory Sync cost $125 per connection per month, falling at higher volume (https://workos.com/pricing). Its BAA status varies by source (https://guptadeepak.com/ciam-compass/compliance/hipaa/).
- **Clerk**: Paid plans include one enterprise SSO connection, with about $75 per month for each extra one (third-party figure) (https://ssojet.com/blog/clerk-saml-enterprise-sso-limits). SCIM Directory Sync has been generally available since April 2026, requires an SSO connection, and is free until 2027-01-01 (https://clerk.com/docs/guides/configure/auth-strategies/enterprise-connections/directory-sync).
- **Stytch B2B**: The free tier covers 10k MAU and 5 SSO-or-SCIM connections (https://stytch.com/pricing?vertical=b2b).
- **Keycloak**: Organizations, fully supported since 26.0, give per-organization IdPs and "redirect when email domain matches" (https://www.keycloak.org/2024/10/keycloak-2600-released.html, https://docs.redhat.com/ja/documentation/red_hat_build_of_keycloak/26.2/html/server_administration_guide/managing_organizations). The cost is running a separate Java service.

### (a) Mobile login reality

- App-store reviews of QGenda's app say it "constantly makes you login—even when just toggling between apps" and that fingerprint login disappeared (https://justuseapp.com/en/app/657634288/qgenda/reviews).
- In Entra, session policy belongs to the IdP. The default sign-in frequency is a rolling 90 days. Microsoft warns that over-prompting hurts productivity and encourages users to approve MFA requests blindly. Its sample policy for *unmanaged* devices is a 1-hour sign-in frequency with non-persistent browser sessions (https://learn.microsoft.com/entra/identity/conditional-access/howto-conditional-access-session-lifetime, https://learn.microsoft.com/mt-mt/entra/identity/conditional-access/howto-policy-persistent-browser-session). Hospitals may apply that policy to personal phones.
- Imprivata Mobile Device Access uses a badge tap followed by a grace period of tap-and-hold re-authentication on shared hospital devices. Its OIDC "Locker SSO" works on iOS only (https://docs.imprivata.com/mda/content/topics/authenticationmethods.html, https://docs.imprivata.com/mam/content/topics/checkout/oidc.html).

### (b) Staff not in the hospital IdP

- Entra B2B lets a hospital invite guests who authenticate with their home IdP, so the hospital controls access and the guest's own organization manages credentials (https://learn.microsoft.com/en-us/entra/external-id/what-is-b2b). Zoe then sees them as ordinary Entra users. Locums agencies and private groups may refuse this, so Zoe also needs a fallback local login.

### (c) Per-organization SSO configuration

- All the options support per-tenant providers. Better Auth keys a provider to `organizationId` and a verified domain [npm]. Keycloak and WorkOS route users by email domain (see links above). The required controls are: only a Zoe admin or a verified org owner may register a provider (CVE-2026-53515 is the lesson here), domains must be DNS-verified, and JIT linking to existing local accounts must be explicit.

## Implications for Zoe

- Put Better Auth behind the existing session seam. Use the `organization` plugin with one org per department or hospital, the `sso` plugin for SAML and OIDC, and `scim` once the pilot hospital asks for it. Pin exact versions and subscribe to GitHub advisories.
- Use a sliding session (for example 30 days idle, re-validated at the IdP via `prompt`/`ForceAuthn` only when a policy flag demands it). Never invalidate the session on visibility change. Make the session length configurable per organization so we can match a hospital's Conditional Access policy.
- Local accounts for locums should use email OTP or magic link plus TOTP or passkey, be scoped to an org, and be invited by a scheduler. SSO-domain users must not be allowed to fall back to a local login.
- Rough v1 cost: $0 in license, about 1–2 engineer-weeks to integrate and test against Entra plus Okta developer tenants, plus ongoing patching. WorkOS for the same pilot would be about $1.5k a year for SSO alone, or $3k a year with SCIM.
- Make a BAA decision: Better Auth stores identities in Zoe's own Postgres, so there is no new subprocessor. A hosted vendor would need a BAA, since schedules plus names are probably not PHI but hospitals often ask for one anyway.

## Open questions for the owner

1. Which IdP does the pilot hospital use, and does it put Imprivata in front of web apps?
2. Will the pilot hospital's security office require SCIM or a vendor security questionnaire before go-live?
3. Are personal phones "unmanaged" under the pilot hospital's Conditional Access, which could mean forced 1-hour re-authentication?
4. Is the team willing to own SAML security patching, or would it rather pay WorkOS to carry that risk?
5. Will the pilot hospital federate locums via B2B, or does Zoe need local accounts on day one?

## Sources

- https://klasresearch.com/report/identity-and-access-management-2020-healthcare-looks-well-beyond-sso/1449
- https://www.imprivata.com/ehr-epic
- https://docs.imprivata.com/supported/content/topics/ecc/2_identity%20authentication.html
- https://docs.imprivata.com/onesign/content/topics/onesign/sso/oidc_.html
- https://docs.imprivata.com/onesign/content/topics/onesign/sso/saml_adfs.html
- https://docs.imprivata.com/mda/content/topics/authenticationmethods.html
- https://docs.imprivata.com/mam/content/topics/checkout/oidc.html
- https://www.securityinfowatch.com/security-executives/news/55344530/imprivata-healthcare-it-leaders-embrace-passwordless-authentication-in-principle-but-deployment-remains-elusive
- https://developer.okta.com/docs/guides/submit-app-prereq/main
- https://developer.okta.com/docs/guides/submit-sso-app/saml2/main/
- https://support.okta.com/help/s/question/0D54z0000AE5x9XCQR/could-we-publish-a-scim-provisioning-app-in-oin-without-sso-app-integration
- https://learn.microsoft.com/en-us/entra/identity/app-provisioning/application-provisioning-config-problem-scim-compatibility
- https://azure.microsoft.com/documentation/articles/active-directory-scim-provisioning/
- https://learn.microsoft.com/entra/identity/conditional-access/howto-conditional-access-session-lifetime
- https://learn.microsoft.com/mt-mt/entra/identity/conditional-access/howto-policy-persistent-browser-session
- https://learn.microsoft.com/en-us/entra/external-id/what-is-b2b
- npm registry: `better-auth@1.7.25`, `@better-auth/sso@1.7.25`, `@better-auth/scim@1.7.25` (package READMEs, dist typings, route strings)
- https://better-auth.com/docs/plugins/sso.md, https://better-auth.com/docs/plugins/scim.md
- https://better-auth.com/blog/security-update-june-2026
- https://advisories.gitlab.com/npm/@better-auth/sso/CVE-2026-53515/
- https://advisories.gitlab.com/npm/samlify/CVE-2026-46490/
- https://better-auth.com/blog/authjs-joins-better-auth
- https://authjs.dev/getting-started/providers/boxyhq-saml
- https://workos.com/pricing
- https://clerk.com/docs/guides/configure/auth-strategies/enterprise-connections/directory-sync
- https://ssojet.com/blog/clerk-saml-enterprise-sso-limits
- https://stytch.com/pricing?vertical=b2b
- https://www.keycloak.org/2024/10/keycloak-2600-released.html
- https://docs.redhat.com/ja/documentation/red_hat_build_of_keycloak/26.2/html/server_administration_guide/managing_organizations
- https://guptadeepak.com/ciam-compass/compliance/hipaa/
- https://justuseapp.com/en/app/657634288/qgenda/reviews
