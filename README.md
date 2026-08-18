# AW Automation — n8n Workflow Fix & API Integration

AW Automation builds and fixes small, bounded automation workflows, API integrations, and operational tooling.

## Starter service — USD 55

One bounded n8n workflow:

- Up to 3 integrations
- Basic error handling
- Basic testing
- Short handoff documentation
- 1 revision
- Typical target: about 3 days for a starter-sized task after scope confirmation

## Good fits

- Fix a broken n8n workflow
- Connect two or three APIs/services
- Webhook processing
- JSON transformation
- Data normalization/validation
- Scheduled automation
- Basic error handling
- Small Python/JavaScript helper logic
- Workflow cleanup or troubleshooting

## Not included by default

- Large multi-week systems
- Unlimited integrations
- 24/7 support
- Paid third-party API costs
- Production credentials
- Legal/compliance consulting
- Guaranteed results dependent on third-party services

## Request work

Use GitHub Issues:

- [Workflow Fix](https://github.com/weissalexey/aw-n8n-workflow-help/issues/new?template=workflow-fix.md)
- [API Integration](https://github.com/weissalexey/aw-n8n-workflow-help/issues/new?template=api-integration.md)
- [Custom Automation](https://github.com/weissalexey/aw-n8n-workflow-help/issues/new?template=custom-automation.md)

Initial scoping can happen through GitHub Issues while the standalone AW project email/storefront is being activated.

Final scope and payment method must be agreed before paid work begins.

## Public work examples
- **Bexio + n8n** [n8n + Bexio API Integration: A Practical Readiness Checklist](guides/n8n-bexio-api-integration-readiness.md)

- **Transport Request Intake Starter demo:** <https://weissalexey.github.io/aw-transport-request-intake-demo/>
- **Free Transport Request Intake Lite workflow:** <https://github.com/weissalexey/aw-transport-request-intake-demo/tree/main/free>
- **Open-source safety hook PR:** <https://github.com/claude-builders-bounty/claude-builders-bounty/pull/3761> (open-source contribution currently under review)


## n8n Workflow Audit GitHub Action

Static validation tool for exported n8n workflow JSON files. Checks structure, portability issues, and potential hardcoded secrets without executing workflows.

**Local CLI:**

    python tools/n8n_workflow_audit.py --path "workflows/*.json"
    python tools/n8n_workflow_audit.py --path "workflow.json" --strict

**GitHub Actions:**

    - name: Audit n8n workflows
      uses: weissalexey/aw-n8n-workflow-help@v1
      with:
        path: "workflows/*.json"

**Exit codes:** 0 = passed, 1 = structural errors, 2 = warnings in strict mode, 3 = no files matched.

**Note:** This tool performs static checks only. It does not execute workflows. Findings are diagnostics and do not guarantee workflow security or correctness.

## About

AW Automation focuses on small practical automations that can be scoped, tested, and handed over clearly.
