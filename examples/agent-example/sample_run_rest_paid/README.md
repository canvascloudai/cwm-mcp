# Paid REST x402 run of request.json

- When: 2026-10-14, ~10:31 AM ET, run by Kevin Brown.
- Client: tryponcho (AgentCash x402 client).
- Endpoint: POST https://www.cloudworldmodel.ai/api/simulations/stateless with ../request.json
- Result: HTTP 200. Paid $0.003 USDC on Base; settlement confirmed.
- Tx: 0x4ef1ab58ce1b7ec5c9bd7378974e025973e377cde7d28970aa57a77888c4aeab
  (this came from `body.settlement.transactionHash`; the client doesn't expose the raw PAYMENT-RESPONSE header).
- `response.json` is the full body. `sim-report.json` is the output of `python3 ../interpret_rest.py response.json`, which gives the verdict **modeled_pass**.
- Results (modeled): 300 RPS final, 0% errors, p50 17 ms, p95 42 ms, p99 306 ms (diagnostic, not gated), cost $0.20 → $0.61/hr, scaled out +3 at step 2 then in by 1 at step 3, coverage full.
