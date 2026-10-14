# Cloud World Model: simulate an infra change before you merge it

An agent is about to merge an infra change. It simulates the change in Cloud World Model (CWM) first, then returns a go/no-go `sim-report.json`. CWM models the infrastructure and never provisions anything. Results are **modeled estimates**, not bills or measurements. No verdict authorizes a merge.

This bundle starts with the smaller REST / x402 path (verified paid run). The MCP cache-failure walkthrough is under Advanced.

## 1. Discover

- Agent docs: https://www.cloudworldmodel.ai/llms.txt
- Payment config: `GET https://www.cloudworldmodel.ai/api/billing/x402/config`
- OpenAPI (x402 subset): `GET https://www.cloudworldmodel.ai/.well-known/x402/openapi.json`
- Hosted MCP (Streamable HTTP, POST): `https://www.cloudworldmodel.ai/mcp` — 9 keyless demo tools, 63 with an API key. Anonymous caps: 3 simulations, 20 steps, 1000 RPS.

```bash
curl --fail-with-body -sS https://www.cloudworldmodel.ai/api/billing/x402/config -o payment-config.json
curl --fail-with-body -sS https://www.cloudworldmodel.ai/.well-known/x402/openapi.json -o openapi.json
```

Live config, checked 2026-10-14: `simulation.stateless` costs **$0.003** (3000 atomic USDC); `chaos.run` and `multicloud.explore` cost **$0.005**. Base (`eip155:8453`) uses header `X-PAYMENT`; Solana mainnet uses `PAYMENT-SIGNATURE` (with `feePayer`). Facilitator: `https://facilitator.payai.network`. Re-read `paymentOptions` every session — do not hard-code addresses, chains, or prices. x402 works over REST only; MCP does not carry payments.

## 2. Simulate with x402 (REST)

`request.json` models one `t3.medium` web server at 100 RPS rising to 300 RPS at step 2, over 3 steps. It validates against the live OpenAPI schema. The REST `/simulations/stateless` schema has no `cacheHitRate` / `cacheableRequestShare`, so the cache demo is MCP-only (Advanced).

### Unpaid probe
```bash
curl -sS --max-time 30 -o challenge.json -w '%{http_code}\n' \
  https://www.cloudworldmodel.ai/api/simulations/stateless \
  -H 'Content-Type: application/json' --data-binary @request.json
```
Without payment, expect **402** (x402 v2 challenge with Base and Solana options).

### Pay once with `pay_x402.mjs` (Base)
Uses the official `@x402/*` v2 packages (pinned in `package.json`). Reads the private key only from `CWM_EVM_PRIVATE_KEY`; never logs it. Caps the amount (default `$0.01`). Pays **at most once** — no retry after a payment header is sent. On a timeout after payment, exits with "unknown" and does not re-sign.
```bash
npm ci
node pay_x402.mjs --dry-run            # no key needed: prints the 402 accepts + eligibility under the cap
CWM_EVM_PRIVATE_KEY=0x... node pay_x402.mjs request.json
# optional: CWM_MAX_USD=0.01  CWM_URL=https://www.cloudworldmodel.ai/api/simulations/stateless
```
Safety: refuse if the env key is missing or malformed; refuse if no Base USDC option is within the cap; write the body to `result.json`; print status + settlement tx (from the `PAYMENT-RESPONSE` header when present, else `body.settlement.transactionHash`). Never put private keys into prompts, scripts, or committed files.

### Verified paid run
2026-10-14 ~10:31 AM ET, Kevin, via tryponcho (AgentCash) — HTTP **200**, $0.003 USDC on Base, settlement confirmed. Tx `0x4ef1ab58ce1b7ec5c9bd7378974e025973e377cde7d28970aa57a77888c4aeab` came from `body.settlement.transactionHash` (that client does not expose the raw `PAYMENT-RESPONSE` header). Full body + report: `sample_run_rest_paid/`.

| Final RPS | Err % | p95 | p99 (diagnostic) | Cost $/hr | Coverage |
|---|---|---|---|---|---|
| 300 | 0 | 42 ms | 306 ms | 0.20 → 0.61 | full |

Autoscaling added 3 instances at step 2, then scaled in by 1 at step 3. Gate on p95 and error rate, not p99 (uncalibrated).

### API-key alternative
```bash
curl -sS --max-time 30 -o result.json -w '%{http_code}\n' \
  https://www.cloudworldmodel.ai/api/simulations/stateless \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${CWM_API_KEY:?write-scoped key}" --data-binary @request.json
```
An API-key success does not test payment.

## 3. Interpret
```bash
python3 interpret_rest.py result.json > sim-report.json
# or: python3 interpret_rest.py sample_run_rest_paid/response.json
```
Verdicts: `modeled_pass` | `modeled_fail` | `inconclusive`. Only a pass exits 0. Missing/invalid metrics never become a pass. Scope is the final REST aggregate, not every intermediate step. The paid-run report is `modeled_pass`; `diagnostics` carries p99, step warnings, and settlement without gating them.

## Test with a fresh agent builder (20 minutes, no coaching)

Give a builder only this bundle and the llms.txt URL, plus a wallet they already have. Task: discover CWM, run `request.json` through x402 (Base), return the modeled result, cost, coverage limits, and a plain-English interpretation. Budget: 20 minutes, one successful paid call, $0.01. If they first need a wallet, record that time separately.

Observer: do not coach. Record start/end, first blocking instruction, questions, HTTP outcomes, amount spent, any help. Redact secrets and signed payloads. Pass requires a settled 200, a valid report, a correct "modeled" explanation, and zero author intervention. API-key-only does not pass the payment criterion. Test Solana as a separate trial. Any hint makes the trial assisted — fix the example and repeat with a fresh builder.

## Publication checklist
- [x] Paid REST run on Base: done 2026-10-14 ~10:31 AM ET (tryponcho). See `sample_run_rest_paid/`. Tx hash in body.
- [x] Copy-paste Base wallet-signing script: `pay_x402.mjs` + pinned `package.json`. Dry-run and throwaway-key sign-only verified; a real payment through *this* script has **not** been run (Kevin's paid run used a hosted client).
- [ ] Solana payment path.
- [ ] Independent cold-builder trial (author's own run does not count).
- [x] Destination chosen: published at github.com/canvascloudai/cwm-mcp under examples/agent-example.

---

## Advanced: cache before/after via keyless MCP

Use case: "3× m5.large web + Redis in front of Postgres" — simulate baseline, spike, and a Redis failure.

### Cache graph shape (required)
The cache sits in the request path only with this exact shape. Otherwise it is billed as flat cost, and failing it changes nothing.
- A `type:"cache"` resource with `serviceFamily:"elasticache"`, `cacheHitRate` **as a fraction** (0.8, not 80), optional `cacheableRequestShare`.
- Separate web nodes (`web-1`/`web-2`/`web-3`), not `instanceCount:3`.
- Edges: `lb→web-N`, `web-N→redis`, `redis→db`, **and `web-N→db`**. Missing the web→db edges returns 400 (see `sample_run/create_body_rejected_no_web_db.json`).
- `responseMode:"full"` so `metrics.requestFlow` appears. Confirm `requestFlow.cache.hitRps/missRps` on each step.

Full body: `sample_run/create_body.json`. Call sequence:
```jsonc
simulation.create          sample_run/create_body.json   // traffic 600, seed 42
simulation.step            {"simulationId":ID,"responseMode":"full"}
simulation.inject_traffic  {"simulationId":ID,"targetRps":900}
simulation.step            {"simulationId":ID,"responseMode":"full"}
simulation.inject_failure  {"simulationId":ID,"resourceId":"redis"}
simulation.step            {"simulationId":ID,"responseMode":"full"}
simulation.delete          {"simulationId":ID}
```

### Real result (`sample_run/`, simulation b27f9be9, engine 1.2.23)

| Phase | Offered | Err % | p95 | Cache hit/miss | DB RPS | DB CPU | $/hr |
|---|---|---|---|---|---|---|---|
| Baseline | 600 | 0 | 38 | 480 / 120 | 120 | 18.4% | 1.52 |
| Peak | 900 | 0 | 34 | 720 / 180 | 180 | 30.6% | 2.19 |
| Cache failed | 900 | 83.2 | 1284 | 0 / 900 | 900 | 100% | 1.03 |

### Interpret (requires all three phases)
```bash
python3 interpret_mcp_cache.py sample_run/1_*.json sample_run/2_*.json sample_run/3_*.json > sim-report.json
```
Expects **exactly** three full step files (baseline, peak, cache_failure). Fewer or malformed inputs return `inconclusive`. Verdicts match the REST script: `modeled_pass` | `modeled_fail` | `inconclusive`. Example SLOs (builder-chosen): errors ≤1%, p95 ≤200 ms, DB CPU ≤85%, cost ≤$5/hr. Sample report: **`modeled_fail`** with `failedPhases: ["cache_failure"]`. `changeRecommendation` suggests candidate remedies to **test in a follow-up simulation** (more DB headroom, a read replica, serve-stale / circuit-break on cache loss) — not confirmed fixes.

See `VALIDATION.txt` and `checks/README.md` for what was actually run.
