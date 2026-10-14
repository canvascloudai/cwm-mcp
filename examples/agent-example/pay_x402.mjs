#!/usr/bin/env node
// Pay once for POST /api/simulations/stateless with x402 on Base (eip155:8453, USDC).
//   npm ci && CWM_EVM_PRIVATE_KEY=0x... node pay_x402.mjs [request.json]
//   node pay_x402.mjs --dry-run          # no key: fetch the 402 and print requirements only
// Env: CWM_EVM_PRIVATE_KEY (required unless --dry-run; never logged),
//      CWM_MAX_USD (cap per call, default 0.01), CWM_URL (override endpoint).
// Pays AT MOST ONCE. Never retries after a payment header was sent.
import { readFileSync, writeFileSync } from "node:fs";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SIGN_ONLY = args.includes("--sign-only"); // test: sign payload, do NOT send it
const file = args.find((a) => !a.startsWith("--")) ?? "request.json";
const URL_ = process.env.CWM_URL ?? "https://www.cloudworldmodel.ai/api/simulations/stateless";
const BASE = "eip155:8453";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const maxUsd = Number(process.env.CWM_MAX_USD ?? "0.01");
if (!(maxUsd > 0 && maxUsd <= 1)) { console.error("CWM_MAX_USD must be >0 and <=1"); process.exit(2); }
const maxAtomic = BigInt(Math.round(maxUsd * 1e6)); // USDC has 6 decimals

const key = process.env.CWM_EVM_PRIVATE_KEY;
if (!DRY && !key) { console.error("Refusing to run: CWM_EVM_PRIVATE_KEY is not set (use --dry-run to only see the 402)."); process.exit(2); }
if (!DRY && !/^0x[0-9a-fA-F]{64}$/.test(key)) { console.error("Refusing to run: CWM_EVM_PRIVATE_KEY is not a 0x-prefixed 32-byte hex key."); process.exit(2); }

const body = readFileSync(file, "utf8"); JSON.parse(body);
const init = { method: "POST", headers: { "Content-Type": "application/json" }, body };
const ac = () => AbortSignal.timeout(30000);

const first = await fetch(URL_, { ...init, signal: ac() });
const firstText = await first.text();
if (first.status !== 402) { console.log(JSON.stringify({ status: first.status, body: safeJson(firstText) }, null, 2)); process.exit(first.status === 200 ? 0 : 1); }

// Selection policy: Base USDC "exact" only, amount <= cap.
const pick = (_v, reqs) => reqs.filter((r) => r.network === BASE && r.scheme === "exact"
  && String(r.asset).toLowerCase() === USDC_BASE && BigInt(r.amount ?? r.maxAmountRequired ?? "0") > 0n
  && BigInt(r.amount ?? r.maxAmountRequired) <= maxAtomic);

const probe = new x402HTTPClient(new x402Client());
const required = probe.getPaymentRequiredResponse((n) => first.headers.get(n), safeJson(firstText));
const ok = pick(required.x402Version, required.accepts ?? []);
const summary = (required.accepts ?? []).map((r) => ({ network: r.network, scheme: r.scheme, asset: r.asset, amount: r.amount ?? r.maxAmountRequired, payTo: r.payTo }));
console.error(JSON.stringify({ status: 402, x402Version: required.x402Version, accepts: summary, capAtomic: String(maxAtomic), eligible: ok.length }, null, 2));
if (DRY) process.exit(0);
if (!ok.length) { console.error("Refusing to pay: no Base USDC option within the cap."); process.exit(3); }

const account = privateKeyToAccount(key);
const client = new x402Client((v, reqs) => pick(v, reqs)[0]);
client.register(BASE, new ExactEvmScheme(account));
client.registerPolicy((v, reqs) => pick(v, reqs));
const http = new x402HTTPClient(client);
const payload = await http.createPaymentPayload(required);
const accepted = payload.accepted ?? {};
if (BigInt(accepted.amount ?? accepted.maxAmountRequired ?? maxAtomic + 1n) > maxAtomic) { console.error("Refusing to pay: signed amount exceeds cap."); process.exit(3); }
const encoded = http.encodePaymentSignatureHeader(payload);
// CWM's live config advertises the header name per chain (Base: X-PAYMENT). The v2 library emits PAYMENT-SIGNATURE,
// so send the same encoded value under the advertised name.
const cfg = await (await fetch(new URL("/api/billing/x402/config", URL_), { signal: ac() })).json();
const advertised = (cfg.paymentOptions ?? []).find((o) => o.network === BASE)?.header ?? Object.keys(encoded)[0];
const headers = { [advertised]: Object.values(encoded)[0] };
if (SIGN_ONLY) { console.log(JSON.stringify({ signOnly: true, sent: false, headerNames: Object.keys(headers), payer: account.address, network: accepted.network, amount: accepted.amount }, null, 2)); process.exit(0); }

let paid;
try { paid = await fetch(URL_, { ...init, headers: { ...init.headers, ...headers }, signal: ac() }); }
catch (e) { console.error(`Outcome UNKNOWN after payment was sent (${e.name}). Do NOT retry; check the payer's USDC transfers on Base.`); process.exit(4); }
const text = await paid.text();
const parsed = safeJson(text);
let settle = null; try { settle = http.getPaymentSettleResponse((n) => paid.headers.get(n)); } catch {}
const tx = settle?.transaction ?? parsed?.settlement?.transactionHash ?? null;
writeFileSync("result.json", text);
console.log(JSON.stringify({ status: paid.status, settlementTx: tx, settlementSource: settle ? "PAYMENT-RESPONSE header" : (tx ? "body.settlement" : "none"), body: parsed }, null, 2));
process.exit(paid.status === 200 ? 0 : 1); // no retry on any outcome

function safeJson(t) { try { return JSON.parse(t); } catch { return t; } }
