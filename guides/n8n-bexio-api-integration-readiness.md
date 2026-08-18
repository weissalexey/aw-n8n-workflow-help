# n8n + Bexio API Integration: A Practical Readiness Checklist

Small Bexio integrations can be straightforward when authentication, the target endpoint, and data mapping are already clear. Scope expands quickly when those prerequisites are missing. This checklist captures the key readiness items before starting an n8n-based Bexio integration.

## Current integration architecture

Because n8n does not currently provide an official native Bexio node in the reviewed official integration documentation, the practical route is the generic HTTP Request node combined with OAuth2 credentials:

```
Trigger / Input
  → (optional) Normalize / Validate
  → HTTP Request node
  → Bexio API
  → Response mapping
  → Result / Error handling
```

The HTTP Request node handles all standard HTTP methods and JSON payloads, while n8n's built-in generic OAuth2 credential type manages the Bexio authorization flow.

## Authentication prerequisites

Bexio uses **OAuth 2.0 Authorization Code Grant**. Before any API call can succeed, the following must be in place:

- A Bexio developer app registered at [developer.bexio.com](https://developer.bexio.com) (requires a Bexio account)
- Client ID and Client Secret obtained from the app details
- At least one redirect URI registered in the Bexio developer app
- The n8n-generated OAuth callback URL registered as a redirect URI in the Bexio app
- Authorization endpoint: `https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth`
- Token endpoint: `https://auth.bexio.com/realms/bexio/protocol/openid-connect/token`
- Scopes matching the required Bexio resources (e.g., `kb_invoice_show`, `kb_invoice_edit`, `accounting`)
- Client ID and Client Secret stored in n8n's credential storage — **never hardcoded in workflow code**
- Access and refresh tokens managed by n8n's OAuth2 credential — **never hardcoded**

Bexio also offers Personal Access Tokens (PAT) for limited developer testing, but OAuth 2.0 remains the production-recommended path.

## Minimal HTTP Request blueprint

```
Method:       <GET|POST|PUT|DELETE AS REQUIRED>

URL:          https://api.bexio.com/2.0/<CONFIRMED_ENDPOINT>

Authentication: OAuth2 credential (configured with Bexio auth/token URLs)

Query:        <CONFIRMED_QUERY_PARAMETERS>

JSON body:    <CONFIRMED_FIELD_MAPPING>

Response:     JSON
```

Do not manually add `Authorization: Bearer` headers — the OAuth2 credential handles this automatically. Typical additional headers: `Accept: application/json`, `Content-Type: application/json` (for POST/PUT).

## Before calling it a one-hour task

A small, bounded Bexio integration is realistic only when most of the following are already true:

- [ ] Exact Bexio object and action are known (e.g., "create one invoice", "read contacts")
- [ ] One primary API operation
- [ ] OAuth client credentials (Client ID + Client Secret) are ready
- [ ] n8n instance is accessible (cloud or self-hosted)
- [ ] Field mapping is small and explicit
- [ ] A safe test record is available
- [ ] Definition of done is stated in one sentence

## When to rescope

Consider expanding the scope estimate if any of these apply:

- OAuth client/app must be created from scratch
- Permissions or access problems block API calls
- Multiple Bexio objects are required (e.g., invoice with line items needing contacts, items, and tax IDs)
- Complex accounting or business logic
- Pagination or bulk processing
- Robust reconciliation or idempotency requirements
- Multiple external systems beyond the agreed operation
- Undocumented field mapping must be reverse-engineered

## Minimum test matrix

These are suggested validation cases, not claims that they have been executed:

| # | Test case |
|---|-----------|
| 1 | Happy path — valid input, expected response |
| 2 | Missing required input — validation error handled |
| 3 | 401 / 403 — expired or insufficient authorization |
| 4 | 4xx — Bexio validation/business error captured |
| 5 | 429 — rate limit detected, no burst retry |
| 6 | 5xx — transient server failure, single retry then stop |
| 7 | Missing or unexpected response field — graceful handling |

## Security notes

- Do not include secrets in exported workflow JSON
- Do not hardcode bearer tokens or client secrets
- Use controlled test records only
- Avoid bulk or destructive changes against production data while validating
- Preserve existing workflows before modification

## Limitation

This guide is based on current official Bexio and n8n documentation plus general integration engineering practice. It does not claim that AW Automation has completed a live Bexio production integration, and the examples here have not been tested against a buyer's Bexio tenant.

## Official references

- [Bexio API documentation](https://docs.bexio.com/)
- [Bexio developer portal](https://developer.bexio.com)
- [n8n HTTP Request node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [n8n HTTP Request credentials](https://docs.n8n.io/integrations/builtin/credentials/httprequest/)

## Need help with a small n8n/API integration?

For small, clearly scoped n8n/API integration or troubleshooting work:

<https://weissalexey.github.io/aw-n8n-workflow-help/>
