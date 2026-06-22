# Cloudflare Setup Notes

Updated: 2026-06-22

This document records Cloudflare pre-configuration completed before MemoTask V1 development begins.

## Account

Cloudflare account observed in Dashboard:

```text
956039339@qq.com's Account
```

Dashboard account prefix:

```text
https://dash.cloudflare.com/30f2292f8bb323d4a658c7d1f09bd301
```

## Billing Safety Rule

The user permits Cloudflare account operations needed for MemoTask.

Stop and ask before:

- Buying a domain.
- Changing to a paid plan.
- Selecting paid products.
- Entering or submitting payment details.
- Confirming any checkout, purchase, paid plan, or billable action.

## Completed

### D1 Database

Created:

```text
Name: memotask-db
Database ID: 3c84d13d-803f-41d3-ab97-292ba1500708
Dashboard: https://dash.cloudflare.com/30f2292f8bb323d4a658c7d1f09bd301/workers/d1/databases/3c84d13d-803f-41d3-ab97-292ba1500708/metrics
```

Observed D1 account usage before creation:

```text
Database total: 0 / 10
```

D1 was created through the Cloudflare Dashboard. No payment or upgrade prompt appeared during D1 creation.

Recommended future `wrangler.toml` binding:

```toml
[[d1_databases]]
binding = "DB"
database_name = "memotask-db"
database_id = "3c84d13d-803f-41d3-ab97-292ba1500708"
```

### Zero Trust

The Dashboard showed Cloudflare Zero Trust onboarding.

The free plan was visible before activation:

```text
Zero Trust 免费
0 美元/席位/月
50 seats limit
```

The Standard paid plan was also visible and was not selected:

```text
Zero Trust Standard
7 美元/席位/月
```

Earlier action taken:

- Clicked the first "选择计划" button associated with `Zero Trust 免费`.

Stopped because:

- The browser navigated to:

```text
https://dash.cloudflare.com/30f2292f8bb323d4a658c7d1f09bd301/zero-trust/checkout/payment
```

This was a checkout/payment path. Even though the selected plan was free, the user completed the activation manually.

Current observed state after manual activation:

```text
Cloudflare One URL: https://dash.cloudflare.com/30f2292f8bb323d4a658c7d1f09bd301/one/overview/get-started
Team name: frosty-resonance-2e7a
Plan: Zero Trust Free
User permission: Super Administrator - All Privileges
```

Status:

```text
Zero Trust is active.
```

Identity provider note:

- No custom identity provider was added.
- Cloudflare Access can use the default one-time PIN email login for V1 unless the user later requests Google, GitHub, or another IdP.

### Access Rule Group

Created a reusable Access rule group:

```text
Name: MemoTask owner only
Group ID: 322c66a6-ca17-43b0-a394-c4d1e43e5a01
Dashboard: https://dash.cloudflare.com/30f2292f8bb323d4a658c7d1f09bd301/one/access-controls/policies/rule-groups
```

Rule details verified in the Dashboard:

```text
Type: Include
Selector: Emails
Value: 956039339@qq.com
```

This rule group is not attached to an application yet because no MemoTask deployment URL exists.

## Pending Until Deployment Exists

### Access Application

No Access application has been created yet.

Reason:

- Access application creation needs a target such as a public hostname, Pages project, Worker route, or deployed app URL.
- No Worker or Pages project exists yet.
- Creating a placeholder Access app now would likely require cleanup after the real deployment target is known.

Needed later:

1. Deploy MemoTask and confirm the final app URL.
2. Create an Access self-hosted or Worker-backed application protecting that URL.
3. Attach or reuse the rule group `MemoTask owner only`.
4. If a custom production domain is purchased/added later, update the Access application domain.

## Not Created Yet

### Worker / Pages Project

No Worker or Pages project has been created yet.

Reason:

- Workers and Pages project creation is cleaner after code exists and can be deployed with Wrangler.
- Creating a template or empty project before the scaffold may add avoidable cleanup.

Recommended names:

```text
Worker or app: memotask
Pages project if needed: memotask
```

Recommended deployment approach after code exists:

1. Use Wrangler with the D1 binding above.
2. Deploy the Worker/Pages project.
3. Confirm generated URL.
4. Configure Access on the deployed URL or custom domain.

### Worker Secrets

No Worker secrets have been created yet.

Reason:

- Worker does not exist yet.
- Secrets should be attached after the Worker project name and deployment target are known.

Required later:

```text
APP_ENCRYPTION_KEY
```

Do not store the user's AI API key in Cloudflare as a plain environment variable for V1 unless the implementation explicitly needs a server default. The planned product flow stores user AI settings through the app Settings page and encrypts them with `APP_ENCRYPTION_KEY`.

## Domain Status

Dashboard Domains overview previously showed no visible active domains:

```text
未找到域或子域
```

Implication:

- A clean production domain such as `memo.example.com` cannot be configured until a domain is added to Cloudflare or a Pages/Workers-generated domain is used.
- Buying a domain is a paid action and requires explicit user confirmation.

## Next Cloudflare Steps After Development Scaffold

1. Add the D1 binding to `wrangler.toml` using the existing `memotask-db`.
2. Create and run D1 migrations.
3. Deploy the Worker/Pages app.
4. Generate `APP_ENCRYPTION_KEY`.
5. Store `APP_ENCRYPTION_KEY` as a Worker secret.
6. Create the Access application on the final app URL.
7. Attach the `MemoTask owner only` rule group.
8. Verify unauthenticated users are blocked and `956039339@qq.com` can log in.
