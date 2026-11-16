# Authentication is a seam; v0 ships a demo session

All server code reads the current User via `getSession()` in `zoe/src/server/session.ts`. v0 implements it with a signed demo cookie and a "sign in as" picker so the product can be evaluated end-to-end without an identity provider. Production replaces that one adapter with Better Auth (email magic link + OIDC/SAML SSO for hospital IdPs). Permission checks live in the domain (`can(user, action)`), not in the auth adapter, so the swap does not touch business logic.
