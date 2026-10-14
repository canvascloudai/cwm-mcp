# Checks run for this bundle (2026-10-14)

These are verification notes, not simulation results to publish as product claims.

## OpenAPI (REST /simulations/stateless)

- Fetched live: `GET https://www.cloudworldmodel.ai/.well-known/x402/openapi.json`
- Validated `request.json` with jsonschema Draft 2020-12 against the path schema: **0 errors**.
- Confirmed accepted fields include `instanceType` (alias for size), `traffic.initialRps`, `traffic.change.{atStep,targetRps}`, and top-level `autoscaling.{minInstances,maxInstances,targetCpuPercent}`.
- Bogus extra property under `traffic.change` is rejected by the schema (sanity check).

## Unpaid REST probe

- `POST /api/simulations/stateless` with `request.json`, no credentials: **HTTP 402**.
- Challenge advertises x402 v2, exact USDC 3000 atomic ($0.003) on Base (`X-PAYMENT`) and Solana (`PAYMENT-SIGNATURE`).
- At first it was unpaid only (402).

## Paid REST run (executed live)

- 2026-10-14 at about 10:31 AM ET, Kevin, via tryponcho (AgentCash).
- HTTP 200, $0.003 USDC on Base, settlement confirmed.
- Tx 0x4ef1ab58…aeab from body.settlement.transactionHash; the client doesn't expose the raw PAYMENT-RESPONSE header.
- See ../sample_run_rest_paid/. interpret_rest.py → modeled_pass.

## Keyless MCP equivalent of request.json fields

REST `traffic` / `autoscaling` shapes differ from MCP `simulation.create`. Equivalent create used:

- one `t3.medium` compute (`instanceType` accepted; resolved to size `t3.medium`)
- `traffic: 100`, then `simulation.inject_traffic` → 300
- `minInstances:1`, `maxInstances:4`, `autoscalingTargetCpu:70`

Live run (simulation `7ca1aba9`, engine 1.2.23, deleted afterward):

| Step | RPS | errors | p95 ms | cost $/hr | notes |
|---|---|---|---|---|---|
| after create+step | 100 | 0 | 45 | 0.20 | web healthy |
| after inject 300 + step | 300 | 0 | 42 | 0.65 | scaled out +3; web marked critical during scale |

This confirms those field *meanings* are accepted by the engine on the keyless MCP path. This was the MCP path, not REST. The paid REST run is recorded above. It is also not the cache before/after demo.

## Cache MCP sample (already in sample_run/)

- Prior verified run: simulation `b27f9be9`, engine 1.2.23 (see README table).
- Re-ran `interpret_mcp_cache.py` on the three saved steps: verdict `modeled_fail` (cache_failure only) matches `sample_run/sim-report.json`.
- Re-ran `interpret_rest.py` on the same three MCP steps: `modeled_fail` with DB CPU / errors / p95 blockers (expected; REST mode is for a single stateless aggregate).

## Not done

- No Solana payment and no independent cold-builder trial.
- Real payment through `pay_x402.mjs` has not been run. The script is in the bundle; dry-run and throwaway-key `--sign-only` were tested.

Publication destination chosen: published at github.com/canvascloudai/cwm-mcp under examples/agent-example.


## pay_x402.mjs (Base signing script)

Pinned: `@x402/core` / `@x402/evm` / `@x402/fetch` 2.28.0, `viem` 2.57.6.
- Dry-run against live 402: OK.
- Throwaway-key `--sign-only`: signs without broadcasting; header remapped to `X-PAYMENT`.
- Cap enforcement and missing/malformed key refusals: OK.
- Real payment through this script: not run.
