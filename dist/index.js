#!/usr/bin/env node

// index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// tools.ts
import { z as z8 } from "zod";

// ../shared/do-pricing.ts
var HOURS_PER_MONTH = 730;
var DO_HOURLY_RATES = {
  dropletSmall: 6 / HOURS_PER_MONTH,
  // s-1vcpu-1gb              — $6/mo
  dropletBasic: 24 / HOURS_PER_MONTH,
  // s-2vcpu-4gb              — $24/mo; multi-cloud compute baseline
  dropletPremiumIntel: 32 / HOURS_PER_MONTH,
  // s-2vcpu-4gb-120gb-intel  — $32/mo
  dropletPremiumAmd: 28 / HOURS_PER_MONTH,
  // s-2vcpu-4gb-amd NVMe     — $28/mo
  dropletMid: 48 / HOURS_PER_MONTH,
  // s-4vcpu-8gb              — $48/mo
  dropletMidAmd: 56 / HOURS_PER_MONTH,
  // s-4vcpu-8gb-amd NVMe     — $56/mo
  dropletMidIntel: 56 / HOURS_PER_MONTH,
  // s-4vcpu-8gb-intel NVMe   — $56/mo
  dropletLarge: 96 / HOURS_PER_MONTH,
  // s-8vcpu-16gb             — $96/mo
  dropletLargeAmd: 112 / HOURS_PER_MONTH,
  // s-8vcpu-16gb-amd NVMe    — $112/mo
  dropletLargeIntel: 112 / HOURS_PER_MONTH,
  // s-8vcpu-16gb-intel NVMe  — $112/mo
  dropletXLarge: 208 / HOURS_PER_MONTH,
  // s-16vcpu-32gb            — $0.28493/hr (DO pricing page, June 2026; approx)
  dropletXLargeAmd: 224 / HOURS_PER_MONTH,
  // s-16vcpu-32gb-amd NVMe   — $0.30685/hr (DO pricing page, June 2026; approx)
  dropletXLargeIntel: 256 / HOURS_PER_MONTH,
  // s-16vcpu-32gb-intel NVMe — $0.35068/hr (DO pricing page, June 2026; approx)
  dropletXXLarge: 416 / HOURS_PER_MONTH,
  // s-32vcpu-64gb            — $0.56986/hr (DO pricing page, June 2026; approx)
  dropletXXLargeAmd: 448 / HOURS_PER_MONTH,
  // s-32vcpu-64gb-amd NVMe   — $0.61370/hr (DO pricing page, June 2026; approx)
  dropletXXLargeIntel: 512 / HOURS_PER_MONTH,
  // s-32vcpu-64gb-intel NVMe — $0.70137/hr (DO pricing page, June 2026; approx)
  dropletPremium: 84 / HOURS_PER_MONTH,
  // c-4 CPU-Opt              — $84/mo
  dropletCpuOpt2: 42 / HOURS_PER_MONTH,
  // c-2 CPU-Opt (2 vCPU/4 GB) — $42/mo
  dropletCpuOpt8: 168 / HOURS_PER_MONTH,
  // c-8 CPU-Opt (8 vCPU/16 GB) — $168/mo
  dropletCpuOpt16: 336 / HOURS_PER_MONTH,
  // c-16 CPU-Opt              — $336/mo
  dropletCpuOpt32: 672 / HOURS_PER_MONTH,
  // c-32 CPU-Opt              — $672/mo
  dropletGp2: 63 / HOURS_PER_MONTH,
  // g-2vcpu-8gb General Purpose — $0.0863/hr (DO pricing page, June 2026)
  dropletGp4: 126 / HOURS_PER_MONTH,
  // g-4vcpu-16gb General Purpose — $0.1726/hr (DO pricing page, June 2026)
  dropletGp8: 252 / HOURS_PER_MONTH,
  // g-8vcpu-32gb General Purpose — $0.3452/hr (DO pricing page, June 2026)
  dropletGp16: 504 / HOURS_PER_MONTH,
  // g-16vcpu-64gb General Purpose — $0.6904/hr (DO pricing page, June 2026)
  dropletGp32: 1008 / HOURS_PER_MONTH,
  // g-32vcpu-128gb General Purpose — $1.3808/hr (DO pricing page, June 2026)
  dropletMem2: 84 / HOURS_PER_MONTH,
  // m-2vcpu-16gb Memory-Opt     — $0.1151/hr (DO pricing page, June 2026)
  dropletMem4: 168 / HOURS_PER_MONTH,
  // m-4vcpu-32gb Memory-Opt     — $0.2301/hr (DO pricing page, June 2026)
  dropletMem8: 336 / HOURS_PER_MONTH,
  // m-8vcpu-64gb Memory-Opt     — $0.4603/hr (DO pricing page, June 2026)
  dropletMem16: 672 / HOURS_PER_MONTH,
  // m-16vcpu-128gb Memory-Opt   — $0.9205/hr (DO pricing page, June 2026)
  dropletMem32: 1344 / HOURS_PER_MONTH,
  // m-32vcpu-256gb Memory-Opt   — $1.8411/hr (DO pricing page, June 2026)
  managedDbSmall: 15.15 / HOURS_PER_MONTH,
  // MySQL/PostgreSQL 1 vCPU/1 GiB — $15.15/mo
  managedDbStandard: 60.9 / HOURS_PER_MONTH,
  // MySQL/PostgreSQL 2 vCPU/4 GiB — $60.90/mo
  managedDbLarge: 122.1 / HOURS_PER_MONTH,
  // MySQL/PostgreSQL 4 vCPU/8 GiB — $122.10/mo
  // These legacy simulator tiers have no exact CPU/RAM match in the current
  // DigitalOcean managed-database catalog. Keep the model values, but do not
  // present them as current provider prices or use them as live-check results.
  managedDbGp2: 120 / HOURS_PER_MONTH,
  // modeled legacy tier; no current 2 vCPU/8 GiB plan listed
  managedDbGp4: 240 / HOURS_PER_MONTH,
  // modeled legacy tier; no current 4 vCPU/16 GiB plan listed
  managedDbGp8: 480 / HOURS_PER_MONTH,
  // modeled legacy tier; no current 8 vCPU/32 GiB plan listed
  managedDbMem2: 150 / HOURS_PER_MONTH,
  // modeled legacy tier; no current 2 vCPU/16 GiB plan listed
  managedDbMem4: 300 / HOURS_PER_MONTH,
  // modeled legacy tier; no current 4 vCPU/32 GiB plan listed
  spaces: 5 / HOURS_PER_MONTH,
  // 250 GB plan  — $5/mo
  blockStorageRef: 10 / HOURS_PER_MONTH,
  // 100 GB Block Storage volume — $10/mo ($0.10/GB-mo × 100 GB)
  loadBalancer: 12 / HOURS_PER_MONTH,
  // Standard LB  — $12/mo
  managedRedis: 15 / HOURS_PER_MONTH,
  // Managed Redis 1 GB — $15/mo
  managedMongoDb: 15.23 / HOURS_PER_MONTH,
  // Managed MongoDB 1 GiB — $15.23/mo (published engine table)
  managedKafka: 41 / HOURS_PER_MONTH,
  // Existing simulator estimate retained; current page sources do not identify the same Kafka plan
  doks: 12 / HOURS_PER_MONTH,
  // DOKS base overhead — $12/mo (DO kubernetes pricing page embedded JSON, June 2026; retained for the generic palette baseline)
  doksHaControlPlane: 40 / HOURS_PER_MONTH,
  // DOKS HA control plane — $40/mo, prorated hourly (DigitalOcean Kubernetes pricing, September 2026)
  appPlatformBasic: 12 / HOURS_PER_MONTH,
  // App Platform Basic (1 GB / 1 dedicated vCPU) — $12/mo (DigitalOcean App Platform pricing, June 2026)
  appPlatformPro: 25 / HOURS_PER_MONTH,
  // App Platform Pro (2 GB / 2 dedicated vCPUs) — $25/mo (DigitalOcean App Platform pricing, June 2026)
  // Spaces CDN — excluded from FR-12 (request_based); bandwidth beyond 250 GB/mo free tier is $0.01/GB.
  // Flat sim approx: ~5 GB/hr × $0.01/GB = $0.05/hr at moderate traffic.
  spacesCdn: 0.05
  // Spaces CDN — request_based; flat sim approx (5 GB/hr × $0.01/GB = $0.05/hr, DigitalOcean Spaces pricing, June 2026)
};
var DO_BASE_RATES = {
  compute: DO_HOURLY_RATES.dropletBasic,
  // reference shape: s-2vcpu-4gb
  database: DO_HOURLY_RATES.managedDbSmall,
  // reference shape: db-s-1vcpu-1gb
  storage: DO_HOURLY_RATES.blockStorageRef,
  // reference shape: 100 GB Block Storage volume ($0.10/GB-mo)
  network: DO_HOURLY_RATES.loadBalancer,
  // reference shape: Standard Load Balancer
  cache: DO_HOURLY_RATES.managedRedis,
  // reference shape: Managed Redis 1 GB
  queue: DO_HOURLY_RATES.managedKafka,
  // reference shape: Managed Kafka
  kubernetes: DO_HOURLY_RATES.doks
  // reference shape: DOKS
};
var DO_COST_MULTIPLIERS = {
  dropletSmall: parseFloat((DO_HOURLY_RATES.dropletSmall / DO_BASE_RATES.compute).toFixed(2)),
  dropletBasic: parseFloat((DO_HOURLY_RATES.dropletBasic / DO_BASE_RATES.compute).toFixed(2)),
  dropletPremiumIntel: parseFloat((DO_HOURLY_RATES.dropletPremiumIntel / DO_BASE_RATES.compute).toFixed(2)),
  dropletPremiumAmd: parseFloat((DO_HOURLY_RATES.dropletPremiumAmd / DO_BASE_RATES.compute).toFixed(2)),
  dropletMid: parseFloat((DO_HOURLY_RATES.dropletMid / DO_BASE_RATES.compute).toFixed(2)),
  dropletMidAmd: parseFloat((DO_HOURLY_RATES.dropletMidAmd / DO_BASE_RATES.compute).toFixed(2)),
  dropletMidIntel: parseFloat((DO_HOURLY_RATES.dropletMidIntel / DO_BASE_RATES.compute).toFixed(2)),
  dropletLarge: parseFloat((DO_HOURLY_RATES.dropletLarge / DO_BASE_RATES.compute).toFixed(2)),
  dropletLargeAmd: parseFloat((DO_HOURLY_RATES.dropletLargeAmd / DO_BASE_RATES.compute).toFixed(2)),
  dropletLargeIntel: parseFloat((DO_HOURLY_RATES.dropletLargeIntel / DO_BASE_RATES.compute).toFixed(2)),
  dropletXLarge: parseFloat((DO_HOURLY_RATES.dropletXLarge / DO_BASE_RATES.compute).toFixed(2)),
  dropletXLargeAmd: parseFloat((DO_HOURLY_RATES.dropletXLargeAmd / DO_BASE_RATES.compute).toFixed(2)),
  dropletXLargeIntel: parseFloat((DO_HOURLY_RATES.dropletXLargeIntel / DO_BASE_RATES.compute).toFixed(2)),
  dropletXXLarge: parseFloat((DO_HOURLY_RATES.dropletXXLarge / DO_BASE_RATES.compute).toFixed(2)),
  dropletXXLargeAmd: parseFloat((DO_HOURLY_RATES.dropletXXLargeAmd / DO_BASE_RATES.compute).toFixed(2)),
  dropletXXLargeIntel: parseFloat((DO_HOURLY_RATES.dropletXXLargeIntel / DO_BASE_RATES.compute).toFixed(2)),
  dropletPremium: parseFloat((DO_HOURLY_RATES.dropletPremium / DO_BASE_RATES.compute).toFixed(2)),
  dropletCpuOpt2: parseFloat((DO_HOURLY_RATES.dropletCpuOpt2 / DO_BASE_RATES.compute).toFixed(2)),
  dropletCpuOpt8: parseFloat((DO_HOURLY_RATES.dropletCpuOpt8 / DO_BASE_RATES.compute).toFixed(2)),
  dropletCpuOpt16: parseFloat((DO_HOURLY_RATES.dropletCpuOpt16 / DO_BASE_RATES.compute).toFixed(2)),
  dropletCpuOpt32: parseFloat((DO_HOURLY_RATES.dropletCpuOpt32 / DO_BASE_RATES.compute).toFixed(2)),
  dropletGp2: parseFloat((DO_HOURLY_RATES.dropletGp2 / DO_BASE_RATES.compute).toFixed(2)),
  dropletGp4: parseFloat((DO_HOURLY_RATES.dropletGp4 / DO_BASE_RATES.compute).toFixed(2)),
  dropletGp8: parseFloat((DO_HOURLY_RATES.dropletGp8 / DO_BASE_RATES.compute).toFixed(2)),
  dropletGp16: parseFloat((DO_HOURLY_RATES.dropletGp16 / DO_BASE_RATES.compute).toFixed(2)),
  dropletGp32: parseFloat((DO_HOURLY_RATES.dropletGp32 / DO_BASE_RATES.compute).toFixed(2)),
  dropletMem2: parseFloat((DO_HOURLY_RATES.dropletMem2 / DO_BASE_RATES.compute).toFixed(2)),
  dropletMem4: parseFloat((DO_HOURLY_RATES.dropletMem4 / DO_BASE_RATES.compute).toFixed(2)),
  dropletMem8: parseFloat((DO_HOURLY_RATES.dropletMem8 / DO_BASE_RATES.compute).toFixed(2)),
  dropletMem16: parseFloat((DO_HOURLY_RATES.dropletMem16 / DO_BASE_RATES.compute).toFixed(2)),
  dropletMem32: parseFloat((DO_HOURLY_RATES.dropletMem32 / DO_BASE_RATES.compute).toFixed(2)),
  managedDbSmall: parseFloat((DO_HOURLY_RATES.managedDbSmall / DO_BASE_RATES.database).toFixed(2)),
  managedDbStandard: parseFloat((DO_HOURLY_RATES.managedDbStandard / DO_BASE_RATES.database).toFixed(2)),
  managedDbLarge: parseFloat((DO_HOURLY_RATES.managedDbLarge / DO_BASE_RATES.database).toFixed(2)),
  managedDbGp2: parseFloat((DO_HOURLY_RATES.managedDbGp2 / DO_BASE_RATES.database).toFixed(2)),
  managedDbGp4: parseFloat((DO_HOURLY_RATES.managedDbGp4 / DO_BASE_RATES.database).toFixed(2)),
  managedDbGp8: parseFloat((DO_HOURLY_RATES.managedDbGp8 / DO_BASE_RATES.database).toFixed(2)),
  managedDbMem2: parseFloat((DO_HOURLY_RATES.managedDbMem2 / DO_BASE_RATES.database).toFixed(2)),
  managedDbMem4: parseFloat((DO_HOURLY_RATES.managedDbMem4 / DO_BASE_RATES.database).toFixed(2)),
  spaces: parseFloat((DO_HOURLY_RATES.spaces / DO_BASE_RATES.storage).toFixed(2)),
  loadBalancer: parseFloat((DO_HOURLY_RATES.loadBalancer / DO_BASE_RATES.network).toFixed(2)),
  managedRedis: parseFloat((DO_HOURLY_RATES.managedRedis / DO_BASE_RATES.cache).toFixed(2)),
  managedKafka: parseFloat((DO_HOURLY_RATES.managedKafka / DO_BASE_RATES.queue).toFixed(2)),
  doks: parseFloat((DO_HOURLY_RATES.doks / DO_BASE_RATES.kubernetes).toFixed(2)),
  appPlatformBasic: parseFloat((DO_HOURLY_RATES.appPlatformBasic / DO_BASE_RATES.compute).toFixed(2)),
  appPlatformPro: parseFloat((DO_HOURLY_RATES.appPlatformPro / DO_BASE_RATES.compute).toFixed(2)),
  spacesCdn: parseFloat((DO_HOURLY_RATES.spacesCdn / DO_BASE_RATES.network).toFixed(2)),
  cloudMonitoring: 0
  // excluded (always_free) — DigitalOcean Monitoring is built-in at no charge (CPU/memory/bandwidth/disk metrics)
};
var DO_DROPLET_SIZES = [
  // ── Basic ────────────────────────────────────────────────────────────────────
  { label: "s-1vcpu-1gb", tier: "Basic", vcpus: 1, ram: 1, detail: "1 vCPU \xB7 1 GB \xB7 $0.008/hr \xB7 $6/mo", multiplier: DO_COST_MULTIPLIERS.dropletSmall, maxThroughput: 500 },
  { label: "s-2vcpu-4gb", tier: "Basic", vcpus: 2, ram: 4, detail: "2 vCPU \xB7 4 GB \xB7 $0.033/hr \xB7 $24/mo", multiplier: DO_COST_MULTIPLIERS.dropletBasic, maxThroughput: 1800 },
  { label: "s-4vcpu-8gb", tier: "Basic", vcpus: 4, ram: 8, detail: "4 vCPU \xB7 8 GB \xB7 $0.066/hr \xB7 $48/mo", multiplier: DO_COST_MULTIPLIERS.dropletMid, maxThroughput: 3500 },
  { label: "s-8vcpu-16gb", tier: "Basic", vcpus: 8, ram: 16, detail: "8 vCPU \xB7 16 GB \xB7 $0.132/hr \xB7 $96/mo", multiplier: DO_COST_MULTIPLIERS.dropletLarge, maxThroughput: 7e3 },
  { label: "s-16vcpu-32gb", tier: "Basic", vcpus: 16, ram: 32, detail: "16 vCPU \xB7 32 GB \xB7 $0.285/hr \xB7 $208/mo", multiplier: DO_COST_MULTIPLIERS.dropletXLarge, maxThroughput: 14e3 },
  { label: "s-32vcpu-64gb", tier: "Basic", vcpus: 32, ram: 64, detail: "32 vCPU \xB7 64 GB \xB7 $0.570/hr \xB7 $416/mo", multiplier: DO_COST_MULTIPLIERS.dropletXXLarge, maxThroughput: 28e3 },
  // ── Premium NVMe ─────────────────────────────────────────────────────────────
  { label: "s-2vcpu-4gb-120gb-intel", tier: "Premium NVMe", vcpus: 2, ram: 4, displayLabel: "s-2vcpu-4gb (Premium Intel NVMe)", detail: "2 vCPU \xB7 4 GB \xB7 $0.044/hr \xB7 $32/mo", multiplier: DO_COST_MULTIPLIERS.dropletPremiumIntel, maxThroughput: 1800 },
  { label: "s-2vcpu-4gb-amd", tier: "Premium NVMe", vcpus: 2, ram: 4, displayLabel: "s-2vcpu-4gb (Premium AMD NVMe)", detail: "2 vCPU \xB7 4 GB \xB7 $0.038/hr", multiplier: DO_COST_MULTIPLIERS.dropletPremiumAmd, maxThroughput: 1800 },
  { label: "s-4vcpu-8gb-amd", tier: "Premium NVMe", vcpus: 4, ram: 8, displayLabel: "s-4vcpu-8gb (Premium AMD NVMe)", detail: "4 vCPU \xB7 8 GB \xB7 $0.077/hr", multiplier: DO_COST_MULTIPLIERS.dropletMidAmd, maxThroughput: 3500 },
  { label: "s-4vcpu-8gb-intel", tier: "Premium NVMe", vcpus: 4, ram: 8, displayLabel: "s-4vcpu-8gb (Premium Intel NVMe)", detail: "4 vCPU \xB7 8 GB \xB7 $0.077/hr \xB7 $56/mo", multiplier: DO_COST_MULTIPLIERS.dropletMidIntel, maxThroughput: 3500 },
  { label: "s-8vcpu-16gb-amd", tier: "Premium NVMe", vcpus: 8, ram: 16, displayLabel: "s-8vcpu-16gb (Premium AMD NVMe)", detail: "8 vCPU \xB7 16 GB \xB7 $0.153/hr", multiplier: DO_COST_MULTIPLIERS.dropletLargeAmd, maxThroughput: 7e3 },
  { label: "s-8vcpu-16gb-intel", tier: "Premium NVMe", vcpus: 8, ram: 16, displayLabel: "s-8vcpu-16gb (Premium Intel NVMe)", detail: "8 vCPU \xB7 16 GB \xB7 $0.153/hr \xB7 $112/mo", multiplier: DO_COST_MULTIPLIERS.dropletLargeIntel, maxThroughput: 7e3 },
  { label: "s-16vcpu-32gb-amd", tier: "Premium NVMe", vcpus: 16, ram: 32, displayLabel: "s-16vcpu-32gb (Premium AMD NVMe)", detail: "16 vCPU \xB7 32 GB \xB7 $0.307/hr", multiplier: DO_COST_MULTIPLIERS.dropletXLargeAmd, maxThroughput: 14e3 },
  { label: "s-16vcpu-32gb-intel", tier: "Premium NVMe", vcpus: 16, ram: 32, displayLabel: "s-16vcpu-32gb (Premium Intel NVMe)", detail: "16 vCPU \xB7 32 GB \xB7 $0.351/hr", multiplier: DO_COST_MULTIPLIERS.dropletXLargeIntel, maxThroughput: 14e3 },
  { label: "s-32vcpu-64gb-amd", tier: "Premium NVMe", vcpus: 32, ram: 64, displayLabel: "s-32vcpu-64gb (Premium AMD NVMe)", detail: "32 vCPU \xB7 64 GB \xB7 $0.614/hr", multiplier: DO_COST_MULTIPLIERS.dropletXXLargeAmd, maxThroughput: 28e3 },
  { label: "s-32vcpu-64gb-intel", tier: "Premium NVMe", vcpus: 32, ram: 64, displayLabel: "s-32vcpu-64gb (Premium Intel NVMe)", detail: "32 vCPU \xB7 64 GB \xB7 $0.701/hr", multiplier: DO_COST_MULTIPLIERS.dropletXXLargeIntel, maxThroughput: 28e3 },
  // ── CPU-Optimized ─────────────────────────────────────────────────────────────
  { label: "c-2", tier: "CPU-Optimized", vcpus: 2, ram: 4, detail: "2 vCPU \xB7 4 GB \xB7 $0.058/hr \xB7 $42/mo", multiplier: DO_COST_MULTIPLIERS.dropletCpuOpt2, maxThroughput: 2250 },
  { label: "c-4", tier: "CPU-Optimized", vcpus: 4, ram: 8, detail: "4 vCPU \xB7 8 GB \xB7 $0.115/hr \xB7 $84/mo", multiplier: DO_COST_MULTIPLIERS.dropletPremium, maxThroughput: 4500 },
  { label: "c-8", tier: "CPU-Optimized", vcpus: 8, ram: 16, detail: "8 vCPU \xB7 16 GB \xB7 $0.230/hr \xB7 $168/mo", multiplier: DO_COST_MULTIPLIERS.dropletCpuOpt8, maxThroughput: 9e3 },
  { label: "c-16", tier: "CPU-Optimized", vcpus: 16, ram: 32, detail: "16 vCPU \xB7 32 GB \xB7 $0.460/hr \xB7 $336/mo", multiplier: DO_COST_MULTIPLIERS.dropletCpuOpt16, maxThroughput: 18e3 },
  { label: "c-32", tier: "CPU-Optimized", vcpus: 32, ram: 64, detail: "32 vCPU \xB7 64 GB \xB7 $0.921/hr \xB7 $672/mo", multiplier: DO_COST_MULTIPLIERS.dropletCpuOpt32, maxThroughput: 36e3 },
  // ── General Purpose ───────────────────────────────────────────────────────────
  { label: "g-2vcpu-8gb", tier: "General Purpose", vcpus: 2, ram: 8, detail: "2 vCPU \xB7 8 GB \xB7 $0.086/hr \xB7 $63/mo", multiplier: DO_COST_MULTIPLIERS.dropletGp2, maxThroughput: 3500 },
  { label: "g-4vcpu-16gb", tier: "General Purpose", vcpus: 4, ram: 16, detail: "4 vCPU \xB7 16 GB \xB7 $0.173/hr \xB7 $126/mo", multiplier: DO_COST_MULTIPLIERS.dropletGp4, maxThroughput: 7e3 },
  { label: "g-8vcpu-32gb", tier: "General Purpose", vcpus: 8, ram: 32, detail: "8 vCPU \xB7 32 GB \xB7 $0.345/hr \xB7 $252/mo", multiplier: DO_COST_MULTIPLIERS.dropletGp8, maxThroughput: 14e3 },
  { label: "g-16vcpu-64gb", tier: "General Purpose", vcpus: 16, ram: 64, detail: "16 vCPU \xB7 64 GB \xB7 $0.690/hr \xB7 $504/mo", multiplier: DO_COST_MULTIPLIERS.dropletGp16, maxThroughput: 28e3 },
  { label: "g-32vcpu-128gb", tier: "General Purpose", vcpus: 32, ram: 128, detail: "32 vCPU \xB7 128 GB \xB7 $1.381/hr \xB7 $1008/mo", multiplier: DO_COST_MULTIPLIERS.dropletGp32, maxThroughput: 56e3 },
  // ── Memory-Optimized ──────────────────────────────────────────────────────────
  { label: "m-2vcpu-16gb", tier: "Memory-Optimized", vcpus: 2, ram: 16, detail: "2 vCPU \xB7 16 GB \xB7 $0.115/hr \xB7 $84/mo", multiplier: DO_COST_MULTIPLIERS.dropletMem2, maxThroughput: 3e3 },
  { label: "m-4vcpu-32gb", tier: "Memory-Optimized", vcpus: 4, ram: 32, detail: "4 vCPU \xB7 32 GB \xB7 $0.230/hr \xB7 $168/mo", multiplier: DO_COST_MULTIPLIERS.dropletMem4, maxThroughput: 6e3 },
  { label: "m-8vcpu-64gb", tier: "Memory-Optimized", vcpus: 8, ram: 64, detail: "8 vCPU \xB7 64 GB \xB7 $0.460/hr \xB7 $336/mo", multiplier: DO_COST_MULTIPLIERS.dropletMem8, maxThroughput: 12e3 },
  { label: "m-16vcpu-128gb", tier: "Memory-Optimized", vcpus: 16, ram: 128, detail: "16 vCPU \xB7 128 GB \xB7 $0.921/hr \xB7 $672/mo", multiplier: DO_COST_MULTIPLIERS.dropletMem16, maxThroughput: 24e3 },
  { label: "m-32vcpu-256gb", tier: "Memory-Optimized", vcpus: 32, ram: 256, detail: "32 vCPU \xB7 256 GB \xB7 $1.841/hr \xB7 $1344/mo", multiplier: DO_COST_MULTIPLIERS.dropletMem32, maxThroughput: 48e3 }
];
var DO_DB_SIZES = [
  // ── Basic ────────────────────────────────────────────────────────────────────
  { label: "db-s-1vcpu-1gb", tier: "Basic", vcpus: 1, ram: 1, detail: "1 vCPU \xB7 1 GB \xB7 $0.021/hr \xB7 $15.15/mo", multiplier: DO_COST_MULTIPLIERS.managedDbSmall, maxConnections: 75 },
  { label: "db-s-2vcpu-4gb", tier: "Basic", vcpus: 2, ram: 4, detail: "2 vCPU \xB7 4 GB \xB7 $0.083/hr \xB7 $60.90/mo", multiplier: DO_COST_MULTIPLIERS.managedDbStandard, maxConnections: 200 },
  { label: "db-s-4vcpu-8gb", tier: "Basic", vcpus: 4, ram: 8, detail: "4 vCPU \xB7 8 GB \xB7 $0.167/hr \xB7 $122.10/mo", multiplier: DO_COST_MULTIPLIERS.managedDbLarge, maxConnections: 400 },
  // ── General Purpose ──────────────────────────────────────────────────────────
  { label: "gd-2vcpu-8gb", tier: "General Purpose", vcpus: 2, ram: 8, detail: "2 vCPU \xB7 8 GB \xB7 modeled estimate ~$0.164/hr; no exact current DO plan listed", multiplier: DO_COST_MULTIPLIERS.managedDbGp2, maxConnections: 300 },
  { label: "gd-4vcpu-16gb", tier: "General Purpose", vcpus: 4, ram: 16, detail: "4 vCPU \xB7 16 GB \xB7 modeled estimate ~$0.329/hr; no exact current DO plan listed", multiplier: DO_COST_MULTIPLIERS.managedDbGp4, maxConnections: 600 },
  { label: "gd-8vcpu-32gb", tier: "General Purpose", vcpus: 8, ram: 32, detail: "8 vCPU \xB7 32 GB \xB7 modeled estimate ~$0.658/hr; no exact current DO plan listed", multiplier: DO_COST_MULTIPLIERS.managedDbGp8, maxConnections: 1200 },
  // ── Memory-Optimized ─────────────────────────────────────────────────────────
  { label: "m3-2vcpu-16gb", tier: "Memory-Optimized", vcpus: 2, ram: 16, detail: "2 vCPU \xB7 16 GB \xB7 modeled estimate ~$0.205/hr; no exact current DO plan listed", multiplier: DO_COST_MULTIPLIERS.managedDbMem2, maxConnections: 600 },
  { label: "m3-4vcpu-32gb", tier: "Memory-Optimized", vcpus: 4, ram: 32, detail: "4 vCPU \xB7 32 GB \xB7 modeled estimate ~$0.411/hr; no exact current DO plan listed", multiplier: DO_COST_MULTIPLIERS.managedDbMem4, maxConnections: 1200 }
];
var DO_DB_HOURLY_RATES_BY_LABEL = {
  "db-s-1vcpu-1gb": DO_HOURLY_RATES.managedDbSmall,
  "db-s-2vcpu-4gb": DO_HOURLY_RATES.managedDbStandard,
  "db-s-4vcpu-8gb": DO_HOURLY_RATES.managedDbLarge,
  "gd-2vcpu-8gb": DO_HOURLY_RATES.managedDbGp2,
  "gd-4vcpu-16gb": DO_HOURLY_RATES.managedDbGp4,
  "gd-8vcpu-32gb": DO_HOURLY_RATES.managedDbGp8,
  "m3-2vcpu-16gb": DO_HOURLY_RATES.managedDbMem2,
  "m3-4vcpu-32gb": DO_HOURLY_RATES.managedDbMem4
};

// ../shared/resource-size.ts
function resolveResourceSize(characteristics) {
  const size = characteristics?.size ?? characteristics?.instanceType;
  return typeof size === "string" && size.length > 0 ? size : void 0;
}

// ../shared/provider-pricing.ts
var AWS_M8_STANDARD_SIZES = [
  ["medium", 1, 4],
  ["large", 2, 8],
  ["xlarge", 4, 16],
  ["2xlarge", 8, 32],
  ["4xlarge", 16, 64],
  ["8xlarge", 32, 128],
  ["12xlarge", 48, 192],
  ["16xlarge", 64, 256],
  ["24xlarge", 96, 384],
  ["48xlarge", 192, 768]
];
var AWS_M8_INTEL_SIZES = [
  ["large", 2, 8],
  ["xlarge", 4, 16],
  ["2xlarge", 8, 32],
  ["4xlarge", 16, 64],
  ["8xlarge", 32, 128],
  ["12xlarge", 48, 192],
  ["16xlarge", 64, 256],
  ["24xlarge", 96, 384],
  ["32xlarge", 128, 512],
  ["48xlarge", 192, 768],
  ["96xlarge", 384, 1536]
];
var AWS_M8_FLEX_SIZES = [
  ["large", 2, 8],
  ["xlarge", 4, 16],
  ["2xlarge", 8, 32],
  ["4xlarge", 16, 64],
  ["8xlarge", 32, 128],
  ["12xlarge", 48, 192],
  ["16xlarge", 64, 256]
];
var AWS_M8_AZN_SIZES = [
  ["medium", 1, 4],
  ["large", 2, 8],
  ["xlarge", 4, 16],
  ["3xlarge", 12, 48],
  ["6xlarge", 24, 96],
  ["12xlarge", 48, 192],
  ["24xlarge", 96, 384]
];
var AWS_M8_INE_SIZES = [
  ["large", 2, 8],
  ["xlarge", 4, 16],
  ["2xlarge", 8, 32],
  ["4xlarge", 16, 64],
  ["8xlarge", 32, 128],
  ["12xlarge", 48, 192]
];
var AWS_M9_STANDARD_SIZES = [
  ["medium", 1, 4],
  ["large", 2, 8],
  ["xlarge", 4, 16],
  ["2xlarge", 8, 32],
  ["4xlarge", 16, 64],
  ["8xlarge", 32, 128],
  ["12xlarge", 48, 192],
  ["16xlarge", 64, 256],
  ["24xlarge", 96, 384],
  ["48xlarge", 192, 768]
];
var AWS_M8_FAMILY_DEFINITIONS = [
  { family: "M8a", prefix: "m8a", ratePerVcpu: 0.06086, sizes: AWS_M8_STANDARD_SIZES, rateOverrides: void 0 },
  { family: "M8azn", prefix: "m8azn", ratePerVcpu: 0.10323, sizes: AWS_M8_AZN_SIZES, rateOverrides: void 0 },
  { family: "M8g", prefix: "m8g", ratePerVcpu: 0.04488, sizes: AWS_M8_STANDARD_SIZES, rateOverrides: void 0 },
  { family: "M8gb", prefix: "m8gb", ratePerVcpu: 0.07275, sizes: AWS_M8_STANDARD_SIZES, rateOverrides: void 0 },
  { family: "M8gd", prefix: "m8gd", ratePerVcpu: 0.05766, sizes: AWS_M8_STANDARD_SIZES, rateOverrides: void 0 },
  { family: "M8gn", prefix: "m8gn", ratePerVcpu: 0.07275, sizes: AWS_M8_STANDARD_SIZES, rateOverrides: { medium: 0.0728 } },
  { family: "M8i-flex", prefix: "m8i-flex", ratePerVcpu: 0.050275, sizes: AWS_M8_FLEX_SIZES, rateOverrides: void 0 },
  { family: "M8i", prefix: "m8i", ratePerVcpu: 0.05292, sizes: AWS_M8_INTEL_SIZES, rateOverrides: void 0 },
  { family: "M8ib", prefix: "m8ib", ratePerVcpu: 0.08354, sizes: AWS_M8_INTEL_SIZES, rateOverrides: void 0 },
  { family: "M8id", prefix: "m8id", ratePerVcpu: 0.06526, sizes: AWS_M8_INTEL_SIZES, rateOverrides: void 0 },
  { family: "M8idb", prefix: "m8idb", ratePerVcpu: 0.09547, sizes: AWS_M8_INTEL_SIZES, rateOverrides: void 0 },
  { family: "M8idn", prefix: "m8idn", ratePerVcpu: 0.09547, sizes: AWS_M8_INTEL_SIZES, rateOverrides: void 0 },
  { family: "M8in", prefix: "m8in", ratePerVcpu: 0.08354, sizes: AWS_M8_INTEL_SIZES, rateOverrides: void 0 },
  { family: "M8ine", prefix: "m8ine", ratePerVcpu: 0.104425, sizes: AWS_M8_INE_SIZES, rateOverrides: void 0 }
];
var awsM8HourlyRates = AWS_M8_FAMILY_DEFINITIONS.flatMap(
  ({ prefix, ratePerVcpu, rateOverrides, sizes }) => sizes.map(([suffix, vcpus]) => [
    `${prefix}.${suffix}`,
    rateOverrides?.[suffix] ?? ratePerVcpu * vcpus
  ])
);
var AWS_EC2_M8_HOURLY_RATES = Object.fromEntries(awsM8HourlyRates);
var m8RateKey = (label) => `ec2${label.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())).join("")}`;
var awsM8NamedHourlyRates = Object.fromEntries(
  Object.entries(AWS_EC2_M8_HOURLY_RATES).map(([label, rate]) => [m8RateKey(label), rate])
);
var AWS_M9_FAMILY_DEFINITIONS = [
  { family: "M9g", prefix: "m9g", ratePerVcpu: 0.04892, sizes: AWS_M9_STANDARD_SIZES },
  { family: "M9gd", prefix: "m9gd", ratePerVcpu: 0.06285, sizes: AWS_M9_STANDARD_SIZES }
];
var awsM9HourlyRates = AWS_M9_FAMILY_DEFINITIONS.flatMap(
  ({ prefix, ratePerVcpu, sizes }) => sizes.map(([suffix, vcpus]) => [`${prefix}.${suffix}`, ratePerVcpu * vcpus])
);
var AWS_EC2_M9_HOURLY_RATES = Object.fromEntries(awsM9HourlyRates);
var m9RateKey = (label) => `ec2${label.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())).join("")}`;
var awsM9NamedHourlyRates = Object.fromEntries(
  Object.entries(AWS_EC2_M9_HOURLY_RATES).map(([label, rate]) => [m9RateKey(label), rate])
);
var AWS_HOURLY_RATES = {
  ...AWS_EC2_M8_HOURLY_RATES,
  ...awsM8NamedHourlyRates,
  ...AWS_EC2_M9_HOURLY_RATES,
  ...awsM9NamedHourlyRates,
  ec2Micro: 0.0116,
  // t2.micro — 1 vCPU, 1 GiB
  // T3 burstable instances (AWS Pricing Calculator, Linux on-demand, us-east-1, August 2026)
  ec2T3Micro: 0.0104,
  // t3.micro  — 2 vCPU, 1 GiB
  ec2T3Small: 0.0208,
  // t3.small  — 2 vCPU, 2 GiB
  ec2T3Medium: 0.0416,
  // t3.medium — 2 vCPU, 4 GiB
  ec2T3Large: 0.0832,
  // t3.large  — 2 vCPU, 8 GiB
  ec2T3XLarge: 0.1664,
  // t3.xlarge — 4 vCPU, 16 GiB
  ec2Large: 0.096,
  // m5.large — 2 vCPU, 8 GiB; multi-cloud compute baseline
  ec2XLarge: 0.192,
  // m5.xlarge
  // 6th-gen Intel Ice Lake instances (us-east-1, on-demand Linux, AWS EC2 Price List API, Jun 2026)
  ec2M6iLarge: 0.096,
  // m6i.large  — 2 vCPU, 8 GiB
  ec2M6iXLarge: 0.192,
  // m6i.xlarge — 4 vCPU, 16 GiB
  ec2M6i2XLarge: 0.384,
  // m6i.2xlarge — 8 vCPU, 32 GiB
  ec2M6i4XLarge: 0.768,
  // m6i.4xlarge — 16 vCPU, 64 GiB
  ec2M6i8XLarge: 1.536,
  // m6i.8xlarge — 32 vCPU, 128 GiB
  ec2M6i12XLarge: 2.304,
  // m6i.12xlarge — 48 vCPU, 192 GiB
  ec2M6i16XLarge: 3.072,
  // m6i.16xlarge — 64 vCPU, 256 GiB
  ec2M6i24XLarge: 4.608,
  // m6i.24xlarge — 96 vCPU, 384 GiB
  ec2M6i32XLarge: 6.144,
  // m6i.32xlarge — 128 vCPU, 512 GiB
  ec2C6iLarge: 0.085,
  // c6i.large  — 2 vCPU, 4 GiB (compute-optimized)
  ec2C6iXLarge: 0.17,
  // c6i.xlarge — 4 vCPU, 8 GiB (compute-optimized)
  ec2C6i2XLarge: 0.34,
  // c6i.2xlarge — 8 vCPU, 16 GiB
  ec2C6i4XLarge: 0.68,
  // c6i.4xlarge — 16 vCPU, 32 GiB
  ec2C6i8XLarge: 1.36,
  // c6i.8xlarge — 32 vCPU, 64 GiB
  ec2C6i12XLarge: 2.04,
  // c6i.12xlarge — 48 vCPU, 96 GiB
  ec2C6i16XLarge: 2.72,
  // c6i.16xlarge — 64 vCPU, 128 GiB
  ec2C6i24XLarge: 4.08,
  // c6i.24xlarge — 96 vCPU, 192 GiB
  ec2C6i32XLarge: 5.44,
  // c6i.32xlarge — 128 vCPU, 256 GiB
  ec2R6iLarge: 0.126,
  // r6i.large  — 2 vCPU, 16 GiB (memory-optimized)
  ec2R6iXLarge: 0.252,
  // r6i.xlarge — 4 vCPU, 32 GiB (memory-optimized)
  ec2R6i2XLarge: 0.504,
  // r6i.2xlarge — 8 vCPU, 64 GiB
  ec2R6i4XLarge: 1.008,
  // r6i.4xlarge — 16 vCPU, 128 GiB
  ec2R6i8XLarge: 2.016,
  // r6i.8xlarge — 32 vCPU, 256 GiB
  ec2R6i12XLarge: 3.024,
  // r6i.12xlarge — 48 vCPU, 384 GiB
  ec2R6i16XLarge: 4.032,
  // r6i.16xlarge — 64 vCPU, 512 GiB
  ec2R6i24XLarge: 6.048,
  // r6i.24xlarge — 96 vCPU, 768 GiB
  ec2R6i32XLarge: 8.064,
  // r6i.32xlarge — 128 vCPU, 1024 GiB
  // Complete published M7 EC2 family (us-east-1, Linux, shared tenancy, on-demand).
  // Source: AWS EC2 Price List API, verified September 2026. M7a is AMD EPYC,
  // M7g/M7gd are Graviton3, M7i/M7i-flex are Sapphire Rapids.
  ec2M7aMedium: 0.05796,
  // m7a.medium — 1 vCPU, 4 GiB
  ec2M7aLarge: 0.11592,
  // m7a.large — 2 vCPU, 8 GiB
  ec2M7aXLarge: 0.23184,
  // m7a.xlarge — 4 vCPU, 16 GiB
  ec2M7a2XLarge: 0.46368,
  // m7a.2xlarge — 8 vCPU, 32 GiB
  ec2M7a4XLarge: 0.92736,
  // m7a.4xlarge — 16 vCPU, 64 GiB
  ec2M7a8XLarge: 1.85472,
  // m7a.8xlarge — 32 vCPU, 128 GiB
  ec2M7a12XLarge: 2.78208,
  // m7a.12xlarge — 48 vCPU, 192 GiB
  ec2M7a16XLarge: 3.70944,
  // m7a.16xlarge — 64 vCPU, 256 GiB
  ec2M7a24XLarge: 5.56416,
  // m7a.24xlarge — 96 vCPU, 384 GiB
  ec2M7a32XLarge: 7.41888,
  // m7a.32xlarge — 128 vCPU, 512 GiB
  ec2M7a48XLarge: 11.12832,
  // m7a.48xlarge — 192 vCPU, 768 GiB
  ec2M7gMedium: 0.0408,
  // m7g.medium — 1 vCPU, 4 GiB
  ec2M7gLarge: 0.0816,
  // m7g.large — 2 vCPU, 8 GiB (Graviton3 ARM)
  ec2M7gXLarge: 0.1632,
  // m7g.xlarge — 4 vCPU, 16 GiB
  ec2M7g2XLarge: 0.3264,
  // m7g.2xlarge — 8 vCPU, 32 GiB
  ec2M7g4XLarge: 0.6528,
  // m7g.4xlarge — 16 vCPU, 64 GiB
  ec2M7g8XLarge: 1.3056,
  // m7g.8xlarge — 32 vCPU, 128 GiB
  ec2M7g12XLarge: 1.9584,
  // m7g.12xlarge — 48 vCPU, 192 GiB
  ec2M7g16XLarge: 2.6112,
  // m7g.16xlarge — 64 vCPU, 256 GiB
  ec2M7gdMedium: 0.0534,
  // m7gd.medium — 1 vCPU, 4 GiB, local NVMe
  ec2M7gdLarge: 0.1068,
  // m7gd.large — 2 vCPU, 8 GiB, local NVMe
  ec2M7gdXLarge: 0.2136,
  // m7gd.xlarge — 4 vCPU, 16 GiB, local NVMe
  ec2M7gd2XLarge: 0.4271,
  // m7gd.2xlarge — 8 vCPU, 32 GiB, local NVMe
  ec2M7gd4XLarge: 0.8543,
  // m7gd.4xlarge — 16 vCPU, 64 GiB, local NVMe
  ec2M7gd8XLarge: 1.7086,
  // m7gd.8xlarge — 32 vCPU, 128 GiB, local NVMe
  ec2M7gd12XLarge: 2.5628,
  // m7gd.12xlarge — 48 vCPU, 192 GiB, local NVMe
  ec2M7gd16XLarge: 3.4171,
  // m7gd.16xlarge — 64 vCPU, 256 GiB, local NVMe
  ec2M7iFlexLarge: 0.09576,
  // m7i-flex.large — 2 vCPU, 8 GiB
  ec2M7iFlexXLarge: 0.19152,
  // m7i-flex.xlarge — 4 vCPU, 16 GiB
  ec2M7iFlex2XLarge: 0.38304,
  // m7i-flex.2xlarge — 8 vCPU, 32 GiB
  ec2M7iFlex4XLarge: 0.76608,
  // m7i-flex.4xlarge — 16 vCPU, 64 GiB
  ec2M7iFlex8XLarge: 1.53216,
  // m7i-flex.8xlarge — 32 vCPU, 128 GiB
  ec2M7iFlex12XLarge: 2.29824,
  // m7i-flex.12xlarge — 48 vCPU, 192 GiB
  ec2M7iFlex16XLarge: 3.06432,
  // m7i-flex.16xlarge — 64 vCPU, 256 GiB
  ec2M7iLarge: 0.1008,
  // m7i.large — 2 vCPU, 8 GiB
  ec2M7iXLarge: 0.2016,
  // m7i.xlarge — 4 vCPU, 16 GiB
  ec2M7i2XLarge: 0.4032,
  // m7i.2xlarge — 8 vCPU, 32 GiB
  ec2M7i4XLarge: 0.8064,
  // m7i.4xlarge — 16 vCPU, 64 GiB
  ec2M7i8XLarge: 1.6128,
  // m7i.8xlarge — 32 vCPU, 128 GiB
  ec2M7i12XLarge: 2.4192,
  // m7i.12xlarge — 48 vCPU, 192 GiB
  ec2M7i16XLarge: 3.2256,
  // m7i.16xlarge — 64 vCPU, 256 GiB
  ec2M7i24XLarge: 4.8384,
  // m7i.24xlarge — 96 vCPU, 384 GiB
  ec2M7i48XLarge: 9.6768,
  // m7i.48xlarge — 192 vCPU, 768 GiB
  rdsSmall: 0.034,
  // db.t3.small
  rdsLarge: 0.24,
  // db.r5.large
  // Graviton3-based RDS instances (us-east-1, on-demand, PostgreSQL, Jun 2026)
  rdsT4gSmall: 0.032,
  // db.t4g.small  — 2 vCPU,  2 GiB
  rdsT4gMedium: 0.064,
  // db.t4g.medium — 2 vCPU,  4 GiB
  rdsM6gLarge: 0.162,
  // db.m6g.large  — 2 vCPU,  8 GiB
  rdsM6gXLarge: 0.325,
  // db.m6g.xlarge — 4 vCPU, 16 GiB
  rdsR6gLarge: 0.229,
  // db.r6g.large  — 2 vCPU, 16 GiB (non-Aurora)
  rdsR6gXLarge: 0.458,
  // db.r6g.xlarge — 4 vCPU, 32 GiB (non-Aurora)
  // Graviton3 7th-gen RDS instances (us-east-1, on-demand, PostgreSQL, Jun 2026)
  rdsM7gLarge: 0.193,
  // db.m7g.large   — 2 vCPU,  8 GiB
  rdsM7gXLarge: 0.386,
  // db.m7g.xlarge  — 4 vCPU, 16 GiB
  rdsM7g2XLarge: 0.772,
  // db.m7g.2xlarge — 8 vCPU, 32 GiB
  rdsR7gLarge: 0.27,
  // db.r7g.large   — 2 vCPU, 16 GiB (non-Aurora)
  rdsR7gXLarge: 0.54,
  // db.r7g.xlarge  — 4 vCPU, 32 GiB (non-Aurora)
  // Aurora PostgreSQL db.r6g.large (current-gen r6g, on-demand, us-east-1, June 2026)
  auroraPostgresql: 0.26,
  // db.r6g.large Aurora PostgreSQL — $0.26/hr official
  auroraDsql: 0.12,
  // Aurora DSQL — excluded from FR-12 (request_based); flat sim approximation
  // Aurora Serverless v2 — $0.12/ACU-hr (us-east-1, June 2026); ACU-based billing excluded from FR-12
  auroraServerless: 0.12,
  // Aurora Serverless v2 — $0.12/ACU-hr official
  dynamoDb: 65e-6,
  // on-demand read request units — excluded from FR-12 (request_based)
  s3: 317e-7,
  // per GB-month → $0.023/730 hr — excluded from FR-12 (request_based)
  appRunner: 0.078,
  // App Runner (1 vCPU/2 GB active) — excluded from FR-12 (request_based); $0.064/vCPU-hr + $0.007/GB-hr × 2 GB = $0.078/hr total (us-east-1, June 2026)
  // AWS Fargate Linux on-demand, us-east-1, August 2026. Reference task:
  // 0.25 vCPU × $0.04048 + 0.5 GB × $0.004445 = $0.01234/hr.
  fargate: 0.01234,
  cloudWatch: 0.01,
  // CloudWatch Logs + Metrics — excluded from FR-12 (request_based); flat sim approx ($0.50/GB ingested beyond 5 GB free, us-east-1, June 2026)
  alb: 0.0225,
  // Application Load Balancer
  cloudfront: 0.034
  // CDN (approximate blended rate)
};
var AWS_BASE_RATES = {
  compute: 0.096,
  // reference: m5.large (multiplier = 1)
  database: 0.12,
  // reference: db.r5.large / 2 (multiplier = 2)
  storage: 0.01,
  // reference: S3 (very low, request-based)
  network: 0.0225
  // reference: ALB (multiplier = 1)
};
var AWS_EC2_M8_COST_MULTIPLIERS = Object.fromEntries(
  Object.entries(awsM8NamedHourlyRates).map(([key, rate]) => [key, rate / AWS_BASE_RATES.compute])
);
var AWS_EC2_M9_COST_MULTIPLIERS = Object.fromEntries(
  Object.entries(awsM9NamedHourlyRates).map(([key, rate]) => [key, rate / AWS_BASE_RATES.compute])
);
var AWS_COST_MULTIPLIERS = {
  ...AWS_EC2_M8_COST_MULTIPLIERS,
  ...AWS_EC2_M9_COST_MULTIPLIERS,
  ec2Micro: 0.12,
  // t2.micro  = $0.01152/hr (0.096 × 0.12 ≈ $0.0116 official)  ✓ <1%
  // T3 burstable instances — costMultiplier = officialRate / AWS_BASE_RATES.compute (0.096)
  ec2T3Micro: 0.108333,
  // t3.micro  = $0.0104/hr (0.096 × 0.108333 ≈ $0.0104) ✓ <0.01%
  ec2T3Small: 0.216667,
  // t3.small  = $0.0208/hr (0.096 × 0.216667 ≈ $0.0208) ✓ <0.01%
  ec2T3Medium: 0.433333,
  // t3.medium = $0.0416/hr (0.096 × 0.433333 ≈ $0.0416) ✓ <0.01%
  ec2T3Large: 0.866667,
  // t3.large  = $0.0832/hr (0.096 × 0.866667 ≈ $0.0832) ✓ <0.01%
  ec2T3XLarge: 1.733333,
  // t3.xlarge = $0.1664/hr (0.096 × 1.733333 ≈ $0.1664) ✓ <0.01%
  ec2Large: 1,
  // m5.large  = $0.096/hr  ✓ exact
  ec2XLarge: 2,
  // m5.xlarge = $0.192/hr  ✓ exact
  // 6th-gen Intel Ice Lake instances — costMultiplier = officialRate / AWS_BASE_RATES.compute (0.096)
  ec2M6iLarge: 1,
  // m6i.large  = $0.096/hr   (0.096 × 1.0 = $0.096)    ✓ exact
  ec2M6iXLarge: 2,
  // m6i.xlarge = $0.192/hr   (0.096 × 2.0 = $0.192)    ✓ exact
  ec2C6iLarge: 0.885,
  // c6i.large  = $0.085/hr   (0.096 × 0.885 = $0.08496) ✓ <0.1%
  ec2C6iXLarge: 1.771,
  // c6i.xlarge = $0.170/hr   (0.096 × 1.771 = $0.16992) ✓ <0.1%
  ec2C6i2XLarge: 3.542,
  // c6i.2xlarge = $0.340/hr
  ec2C6i4XLarge: 7.083,
  // c6i.4xlarge = $0.680/hr
  ec2C6i8XLarge: 14.167,
  // c6i.8xlarge = $1.360/hr
  ec2C6i12XLarge: 21.25,
  // c6i.12xlarge = $2.040/hr
  ec2C6i16XLarge: 28.333,
  // c6i.16xlarge = $2.720/hr
  ec2C6i24XLarge: 42.5,
  // c6i.24xlarge = $4.080/hr
  ec2C6i32XLarge: 56.667,
  // c6i.32xlarge = $5.440/hr
  ec2M6i2XLarge: 4,
  // m6i.2xlarge = $0.384/hr
  ec2M6i4XLarge: 8,
  // m6i.4xlarge = $0.768/hr
  ec2M6i8XLarge: 16,
  // m6i.8xlarge = $1.536/hr
  ec2M6i12XLarge: 24,
  // m6i.12xlarge = $2.304/hr
  ec2M6i16XLarge: 32,
  // m6i.16xlarge = $3.072/hr
  ec2M6i24XLarge: 48,
  // m6i.24xlarge = $4.608/hr
  ec2M6i32XLarge: 64,
  // m6i.32xlarge = $6.144/hr
  // Complete M7 EC2 family — official rate / $0.096 compute base.
  ec2M7aMedium: 0.60375,
  ec2M7aLarge: 1.2075,
  ec2M7aXLarge: 2.415,
  ec2M7a2XLarge: 4.83,
  ec2M7a4XLarge: 9.66,
  ec2M7a8XLarge: 19.32,
  ec2M7a12XLarge: 28.98,
  ec2M7a16XLarge: 38.64,
  ec2M7a24XLarge: 57.96,
  ec2M7a32XLarge: 77.28,
  ec2M7a48XLarge: 115.92,
  ec2M7gMedium: 0.425,
  ec2M7gLarge: 0.85,
  ec2M7gXLarge: 1.7,
  ec2M7g2XLarge: 3.4,
  ec2M7g4XLarge: 6.8,
  ec2M7g8XLarge: 13.6,
  ec2M7g12XLarge: 20.4,
  ec2M7g16XLarge: 27.2,
  ec2M7gdMedium: 0.55625,
  ec2M7gdLarge: 1.1125,
  ec2M7gdXLarge: 2.225,
  ec2M7gd2XLarge: 4.448958,
  ec2M7gd4XLarge: 8.898958,
  ec2M7gd8XLarge: 17.797917,
  ec2M7gd12XLarge: 26.695833,
  ec2M7gd16XLarge: 35.594792,
  ec2M7iFlexLarge: 0.9975,
  ec2M7iFlexXLarge: 1.995,
  ec2M7iFlex2XLarge: 3.99,
  ec2M7iFlex4XLarge: 7.98,
  ec2M7iFlex8XLarge: 15.96,
  ec2M7iFlex12XLarge: 23.94,
  ec2M7iFlex16XLarge: 31.92,
  ec2M7iLarge: 1.05,
  ec2M7iXLarge: 2.1,
  ec2M7i2XLarge: 4.2,
  ec2M7i4XLarge: 8.4,
  ec2M7i8XLarge: 16.8,
  ec2M7i12XLarge: 25.2,
  ec2M7i16XLarge: 33.6,
  ec2M7i24XLarge: 50.4,
  ec2M7i48XLarge: 100.8,
  ec2R6iLarge: 1.3125,
  // r6i.large  = $0.126/hr   (0.096 × 1.3125 = $0.126)  ✓ exact
  ec2R6iXLarge: 2.625,
  // r6i.xlarge = $0.252/hr   (0.096 × 2.625 = $0.252)   ✓ exact
  ec2R6i2XLarge: 5.25,
  // r6i.2xlarge = $0.504/hr
  ec2R6i4XLarge: 10.5,
  // r6i.4xlarge = $1.008/hr
  ec2R6i8XLarge: 21,
  // r6i.8xlarge = $2.016/hr
  ec2R6i12XLarge: 31.5,
  // r6i.12xlarge = $3.024/hr
  ec2R6i16XLarge: 42,
  // r6i.16xlarge = $4.032/hr
  ec2R6i24XLarge: 63,
  // r6i.24xlarge = $6.048/hr
  ec2R6i32XLarge: 84,
  // r6i.32xlarge = $8.064/hr
  lambda: 0.3,
  // excluded (request_based) — flat simulation approximation
  rdsSmall: 0.2833,
  // db.t3.small = $0.034/hr (0.12 × 0.2833 ≈ $0.034 official)  ✓ <0.01%
  rdsLarge: 2,
  // db.r5.large = $0.24/hr  ✓ exact
  // Graviton3-based RDS multipliers — costMultiplier = round2(officialRate / 0.12)
  rdsT4gSmall: 0.27,
  // db.t4g.small  = $0.032/hr (0.12 × 0.27 = $0.0324)   ✓ <2%
  rdsT4gMedium: 0.53,
  // db.t4g.medium = $0.064/hr (0.12 × 0.53 = $0.0636)   ✓ <1%
  rdsM6gLarge: 1.35,
  // db.m6g.large  = $0.162/hr (0.12 × 1.35 = $0.162)    ✓ exact
  rdsM6gXLarge: 2.71,
  // db.m6g.xlarge = $0.325/hr (0.12 × 2.71 = $0.3252)   ✓ <0.1%
  rdsR6gLarge: 1.91,
  // db.r6g.large  = $0.229/hr (0.12 × 1.91 = $0.2292)   ✓ <0.1%
  rdsR6gXLarge: 3.82,
  // db.r6g.xlarge = $0.458/hr (0.12 × 3.82 = $0.4584)   ✓ <0.1%
  // Graviton3 7th-gen RDS multipliers — costMultiplier = round2(officialRate / 0.12)
  rdsM7gLarge: 1.61,
  // db.m7g.large   = $0.193/hr (0.12 × 1.61 = $0.1932)   ✓ <0.1%
  rdsM7gXLarge: 3.22,
  // db.m7g.xlarge  = $0.386/hr (0.12 × 3.22 = $0.3864)   ✓ <0.1%
  rdsM7g2XLarge: 6.43,
  // db.m7g.2xlarge = $0.772/hr (0.12 × 6.43 = $0.7716)   ✓ <0.1%
  rdsR7gLarge: 2.25,
  // db.r7g.large   = $0.270/hr (0.12 × 2.25 = $0.27)     ✓ exact
  rdsR7gXLarge: 4.5,
  // db.r7g.xlarge  = $0.540/hr (0.12 × 4.50 = $0.54)     ✓ exact
  auroraPostgresql: 2.17,
  // db.r6g.large Aurora PostgreSQL = $0.2604/hr (0.12 × 2.17 ≈ $0.26 official)  ✓ <1%
  auroraDsql: 1,
  // excluded (request_based) — flat simulation approximation ($0.12/hr)
  auroraServerless: 1,
  // excluded (request_based) — flat simulation approximation ($0.12/hr)
  dynamoDb: 1.2,
  // excluded (request_based) — flat simulation approximation
  s3: 1,
  // excluded (request_based) — flat simulation approximation
  alb: 1,
  // ALB = $0.0225/hr  ✓ exact
  cloudfront: 1.5,
  // CloudFront CDN = $0.03375/hr (≈ $0.034 official)  ✓ <1%
  // New managed app hosting / observability — costMultiplier = officialRate / AWS_BASE_RATES.compute (0.096)
  appRunner: 0.81,
  // excluded (request_based) — App Runner 1 vCPU/2 GB: $0.064+$0.014=$0.078/hr (0.096 × 0.81 ≈ $0.078)  ✓ <0.1%
  fargate: 0.1285,
  // reference 0.25 vCPU / 0.5 GB task = $0.01234/hr (0.096 × 0.1285 ≈ $0.01234) ✓ <1%; runtime uses task vCPU/GiB rates
  cloudWatch: 0.44
  // excluded (request_based) — CloudWatch: $0.010/hr target ÷ $0.0225 AWS security base = 0.44 → $0.0225×0.44=$0.0099 ✓ <1%
};
var m7Throughput = (vcpus) => ({
  1: 1100,
  2: 2400,
  4: 6e3,
  8: 12e3,
  16: 24e3,
  32: 48e3,
  48: 72e3,
  64: 96e3,
  96: 144e3,
  128: 192e3,
  192: 288e3
})[vcpus] ?? vcpus * 1500;
var m7CatalogEntry = (label, family, key, vcpus, ram) => ({
  label,
  family,
  hourlyRate: AWS_HOURLY_RATES[key],
  multiplier: AWS_COST_MULTIPLIERS[key],
  maxThroughput: m7Throughput(vcpus),
  vcpus,
  ram,
  tier: `General Purpose (${family})`,
  detail: `${vcpus} vCPU \xB7 ${ram} GB \xB7 $${AWS_HOURLY_RATES[key].toFixed(5)}/hr`
});
var AWS_EC2_M7_CATALOG = [
  m7CatalogEntry("m7a.medium", "M7a", "ec2M7aMedium", 1, 4),
  m7CatalogEntry("m7a.large", "M7a", "ec2M7aLarge", 2, 8),
  m7CatalogEntry("m7a.xlarge", "M7a", "ec2M7aXLarge", 4, 16),
  m7CatalogEntry("m7a.2xlarge", "M7a", "ec2M7a2XLarge", 8, 32),
  m7CatalogEntry("m7a.4xlarge", "M7a", "ec2M7a4XLarge", 16, 64),
  m7CatalogEntry("m7a.8xlarge", "M7a", "ec2M7a8XLarge", 32, 128),
  m7CatalogEntry("m7a.12xlarge", "M7a", "ec2M7a12XLarge", 48, 192),
  m7CatalogEntry("m7a.16xlarge", "M7a", "ec2M7a16XLarge", 64, 256),
  m7CatalogEntry("m7a.24xlarge", "M7a", "ec2M7a24XLarge", 96, 384),
  m7CatalogEntry("m7a.32xlarge", "M7a", "ec2M7a32XLarge", 128, 512),
  m7CatalogEntry("m7a.48xlarge", "M7a", "ec2M7a48XLarge", 192, 768),
  m7CatalogEntry("m7g.medium", "M7g", "ec2M7gMedium", 1, 4),
  m7CatalogEntry("m7g.large", "M7g", "ec2M7gLarge", 2, 8),
  m7CatalogEntry("m7g.xlarge", "M7g", "ec2M7gXLarge", 4, 16),
  m7CatalogEntry("m7g.2xlarge", "M7g", "ec2M7g2XLarge", 8, 32),
  m7CatalogEntry("m7g.4xlarge", "M7g", "ec2M7g4XLarge", 16, 64),
  m7CatalogEntry("m7g.8xlarge", "M7g", "ec2M7g8XLarge", 32, 128),
  m7CatalogEntry("m7g.12xlarge", "M7g", "ec2M7g12XLarge", 48, 192),
  m7CatalogEntry("m7g.16xlarge", "M7g", "ec2M7g16XLarge", 64, 256),
  m7CatalogEntry("m7gd.medium", "M7gd", "ec2M7gdMedium", 1, 4),
  m7CatalogEntry("m7gd.large", "M7gd", "ec2M7gdLarge", 2, 8),
  m7CatalogEntry("m7gd.xlarge", "M7gd", "ec2M7gdXLarge", 4, 16),
  m7CatalogEntry("m7gd.2xlarge", "M7gd", "ec2M7gd2XLarge", 8, 32),
  m7CatalogEntry("m7gd.4xlarge", "M7gd", "ec2M7gd4XLarge", 16, 64),
  m7CatalogEntry("m7gd.8xlarge", "M7gd", "ec2M7gd8XLarge", 32, 128),
  m7CatalogEntry("m7gd.12xlarge", "M7gd", "ec2M7gd12XLarge", 48, 192),
  m7CatalogEntry("m7gd.16xlarge", "M7gd", "ec2M7gd16XLarge", 64, 256),
  m7CatalogEntry("m7i-flex.large", "M7i-flex", "ec2M7iFlexLarge", 2, 8),
  m7CatalogEntry("m7i-flex.xlarge", "M7i-flex", "ec2M7iFlexXLarge", 4, 16),
  m7CatalogEntry("m7i-flex.2xlarge", "M7i-flex", "ec2M7iFlex2XLarge", 8, 32),
  m7CatalogEntry("m7i-flex.4xlarge", "M7i-flex", "ec2M7iFlex4XLarge", 16, 64),
  m7CatalogEntry("m7i-flex.8xlarge", "M7i-flex", "ec2M7iFlex8XLarge", 32, 128),
  m7CatalogEntry("m7i-flex.12xlarge", "M7i-flex", "ec2M7iFlex12XLarge", 48, 192),
  m7CatalogEntry("m7i-flex.16xlarge", "M7i-flex", "ec2M7iFlex16XLarge", 64, 256),
  m7CatalogEntry("m7i.large", "M7i", "ec2M7iLarge", 2, 8),
  m7CatalogEntry("m7i.xlarge", "M7i", "ec2M7iXLarge", 4, 16),
  m7CatalogEntry("m7i.2xlarge", "M7i", "ec2M7i2XLarge", 8, 32),
  m7CatalogEntry("m7i.4xlarge", "M7i", "ec2M7i4XLarge", 16, 64),
  m7CatalogEntry("m7i.8xlarge", "M7i", "ec2M7i8XLarge", 32, 128),
  m7CatalogEntry("m7i.12xlarge", "M7i", "ec2M7i12XLarge", 48, 192),
  m7CatalogEntry("m7i.16xlarge", "M7i", "ec2M7i16XLarge", 64, 256),
  m7CatalogEntry("m7i.24xlarge", "M7i", "ec2M7i24XLarge", 96, 384),
  m7CatalogEntry("m7i.48xlarge", "M7i", "ec2M7i48XLarge", 192, 768)
];
var m8Throughput = (vcpus) => ({
  1: 1100,
  2: 2400,
  4: 6e3,
  8: 12e3,
  12: 18e3,
  16: 24e3,
  24: 36e3,
  32: 48e3,
  48: 72e3,
  64: 96e3,
  96: 144e3,
  128: 192e3,
  192: 288e3,
  384: 576e3
})[vcpus] ?? vcpus * 1500;
var m8CatalogEntry = (label, family, hourlyRate, vcpus, ram) => ({
  label,
  family,
  hourlyRate,
  multiplier: hourlyRate / AWS_BASE_RATES.compute,
  maxThroughput: m8Throughput(vcpus),
  vcpus,
  ram,
  tier: `General Purpose (${family})`,
  detail: `${vcpus} vCPU \xB7 ${ram} GB \xB7 $${hourlyRate.toFixed(5)}/hr`
});
var AWS_EC2_M8_CATALOG = AWS_M8_FAMILY_DEFINITIONS.flatMap(
  ({ family, prefix, ratePerVcpu, rateOverrides, sizes }) => sizes.map(
    ([suffix, vcpus, ram]) => m8CatalogEntry(
      `${prefix}.${suffix}`,
      family,
      rateOverrides?.[suffix] ?? ratePerVcpu * vcpus,
      vcpus,
      ram
    )
  )
);
var m9Throughput = (vcpus) => ({
  1: 1100,
  2: 2400,
  4: 6e3,
  8: 12e3,
  16: 24e3,
  32: 48e3,
  48: 72e3,
  64: 96e3,
  96: 144e3,
  192: 288e3
})[vcpus] ?? vcpus * 1500;
var m9CatalogEntry = (label, family, hourlyRate, vcpus, ram) => ({
  label,
  family,
  hourlyRate,
  multiplier: hourlyRate / AWS_BASE_RATES.compute,
  maxThroughput: m9Throughput(vcpus),
  vcpus,
  ram,
  tier: `General Purpose (${family})`,
  detail: `${vcpus} vCPU \xB7 ${ram} GB \xB7 $${hourlyRate.toFixed(5)}/hr`
});
var AWS_EC2_M9_CATALOG = AWS_M9_FAMILY_DEFINITIONS.flatMap(
  ({ family, prefix, ratePerVcpu, sizes }) => sizes.map(
    ([suffix, vcpus, ram]) => m9CatalogEntry(`${prefix}.${suffix}`, family, ratePerVcpu * vcpus, vcpus, ram)
  )
);
var GCP_C4_COMPONENT_RATES = {
  vcpu: 0.03465,
  ramGb: 3938e-6
};
function gcpC4HourlyRate(vcpus, ramGb) {
  return Number((vcpus * GCP_C4_COMPONENT_RATES.vcpu + ramGb * GCP_C4_COMPONENT_RATES.ramGb).toFixed(6));
}
var GCP_HOURLY_RATES = {
  vmSmall: 0.0553,
  // e2-medium (2 vCPU, 4 GB)
  vmStandard: 0.194,
  // n2-standard-4 (4 vCPU, 16 GB)
  // N2 standard (x86, Intel/AMD) instances (us-central1, on-demand, Jun 2026)
  // 2 vCPU × $0.033174/vCPU-hr + 8 GB × $0.004446/GB-hr ≈ $0.097/hr on-demand; multi-cloud compute baseline
  vmN2Standard2: 0.097,
  // n2-standard-2 — 2 vCPU, 8 GiB, us-central1; reference config for multi-cloud baseline
  // C4 (Sapphire Rapids) base VM families, us-central1 on-demand, June 2026.
  // Rates are the regional list prices for the exact machine type; no
  // sustained-use or committed-use discount is included.
  c4Standard2: gcpC4HourlyRate(2, 8),
  c4Standard4: gcpC4HourlyRate(4, 15),
  c4Standard8: gcpC4HourlyRate(8, 30),
  c4Standard16: gcpC4HourlyRate(16, 60),
  c4Standard24: gcpC4HourlyRate(24, 90),
  c4Standard32: gcpC4HourlyRate(32, 120),
  c4Standard48: gcpC4HourlyRate(48, 180),
  c4Standard96: gcpC4HourlyRate(96, 360),
  c4Standard144: gcpC4HourlyRate(144, 540),
  c4Standard192: gcpC4HourlyRate(192, 720),
  c4Standard288: gcpC4HourlyRate(288, 1080),
  c4Highcpu2: gcpC4HourlyRate(2, 4),
  c4Highcpu4: gcpC4HourlyRate(4, 8),
  c4Highcpu8: gcpC4HourlyRate(8, 16),
  c4Highcpu16: gcpC4HourlyRate(16, 32),
  c4Highcpu24: gcpC4HourlyRate(24, 48),
  c4Highcpu32: gcpC4HourlyRate(32, 64),
  c4Highcpu48: gcpC4HourlyRate(48, 96),
  c4Highcpu96: gcpC4HourlyRate(96, 192),
  c4Highcpu144: gcpC4HourlyRate(144, 288),
  c4Highcpu192: gcpC4HourlyRate(192, 384),
  c4Highcpu288: gcpC4HourlyRate(288, 576),
  c4Highmem2: gcpC4HourlyRate(2, 16),
  c4Highmem4: gcpC4HourlyRate(4, 32),
  c4Highmem8: gcpC4HourlyRate(8, 64),
  c4Highmem16: gcpC4HourlyRate(16, 128),
  c4Highmem24: gcpC4HourlyRate(24, 192),
  c4Highmem32: gcpC4HourlyRate(32, 256),
  c4Highmem48: gcpC4HourlyRate(48, 384),
  c4Highmem96: gcpC4HourlyRate(96, 768),
  c4Highmem144: gcpC4HourlyRate(144, 1152),
  c4Highmem192: gcpC4HourlyRate(192, 1536),
  c4Highmem288: gcpC4HourlyRate(288, 2304),
  // T2A (Tau ARM, Ampere Altra) instances (us-central1, on-demand, Jun 2026)
  // 2 vCPU × $0.031611/vCPU-hr + 8 GB × $0.004237/GB-hr = $0.063222 + $0.033896 = $0.097118/hr → $0.097/hr
  t2aStandard2: 0.097,
  // t2a-standard-2 — 2 vCPU, 8 GB (Ampere Altra ARM)
  cloudRun: 0,
  // serverless — excluded from FR-12 (request_based)
  sqlSmall: 0.0105,
  // db-f1-micro (shared-core, 0.6 GB)
  sqlStandard: 0.1351,
  // db-n1-standard-2 (2 vCPU, 7.5 GB) — Zonal, us-central1
  sqlLarge: 0.2702,
  // db-n1-standard-4 (4 vCPU, 15 GB) — Zonal, us-central1 (≈ 2× standard-2)
  spannerNode: 0.9,
  // Cloud Spanner 1000 processing units (1 node), us-central1
  bigtableSsd: 0.65,
  // Cloud Bigtable SSD node, us-central1 — $0.65/node-hr official
  bigtableHdd: 0.17,
  // Cloud Bigtable HDD node, us-central1 — $0.17/node-hr official
  firestore: 0.06,
  // Firestore native mode — excluded from FR-12 (request_based); flat sim approximation
  cloudStorage: 9e-3,
  // per GB-month → approximate flat simulation rate — excluded from FR-12 (request_based)
  lb: 0.025,
  // Cloud Load Balancing (per forwarding rule)
  cloudArmor: 7e-3,
  // Cloud Armor — excluded from FR-12 (request_based); flat sim approximation (policy fee only)
  appEngine: 0.1,
  // App Engine Standard F2 instance-hr — excluded from FR-12 (request_based); flat sim approx ($0.10/F2-hr, us-central1, June 2026)
  cloudCdn: 0.4,
  // Cloud CDN — excluded from FR-12 (request_based); flat sim approx (5 GB/hr × $0.08/GB = $0.40/hr at moderate 50 k RPS, us-central1, June 2026)
  cloudOps: 0.01
  // Cloud Operations Suite (Logging + Monitoring) — excluded from FR-12 (request_based); flat sim approx ($0.50/GB ingested beyond free tier, us-central1, June 2026)
};
var GCP_BASE_RATES = {
  compute: 0.1,
  // reference: n2-standard-4 / ~2 (multiplier ~1.94 for n2-standard-4)
  database: 0.092,
  // reference: Cloud SQL approximate
  storage: 0.01,
  // reference: Cloud Storage
  network: 0.025
  // reference: Load Balancer
};
var AZURE_HOURLY_RATES = {
  vmSmall: 0.0416,
  // Standard_B2s (2 vCPU, 4 GiB)
  vmD2sV3: 0.096,
  // Standard_D2s_v3 — 2 vCPU, 8 GiB, East US, on-demand; reference config for multi-cloud baseline
  vmStandard: 0.192,
  // Standard_D4s_v3 (4 vCPU, 16 GiB), East US Linux 1 Hour Consumption — Azure Retail Prices API, retrieved 2026-09-26
  // Dsv5, Fsv2, and Esv5 Linux VMs, East US on-demand; API rows verified 2026-09-26.
  vmD2sV5: 0.096,
  vmD4sV5: 0.192,
  vmD8sV5: 0.384,
  vmD16sV5: 0.768,
  vmD32sV5: 1.536,
  vmD48sV5: 2.304,
  vmD64sV5: 3.072,
  vmD96sV5: 4.608,
  vmF2sV2: 0.085,
  vmF4sV2: 0.17,
  vmF8sV2: 0.34,
  vmF16sV2: 0.68,
  vmF32sV2: 1.36,
  vmF48sV2: 2.04,
  vmF64sV2: 2.72,
  vmF72sV2: 3.045,
  // Standard_F72s_v2 Linux, East US, 1 Hour Consumption; retrieved 2026-09-26
  vmE2sV5: 0.126,
  vmE4sV5: 0.252,
  vmE8sV5: 0.504,
  vmE16sV5: 1.008,
  vmE20sV5: 1.26,
  vmE32sV5: 2.016,
  vmE48sV5: 3.024,
  vmE64sV5: 4.032,
  vmE96sV5: 6.048,
  functions: 0,
  // serverless — excluded from FR-12 (request_based)
  sqlBasic: 68e-4,
  // Basic tier (SKU "B", ~$0.161/day ÷ 24 ≈ $0.0067/hr, 5 DTUs)
  sqlStandard: 0.1008,
  // Standard_S2 (SKU "S2", ~$2.42/day ÷ 24 ≈ $0.1008/hr, 50 DTUs)
  sqlS4: 0.4032,
  // Standard S4 (SKU "S4", ~$9.68/day ÷ 24 ≈ $0.4032/hr, 200 DTUs)
  // SQL Managed Instance reference configs: MI_GP_Gen5_4 and MI_BC_Gen5_4
  // (East US; Azure Retail Prices API verified October 2026).
  // These benchmark rates use the Compute Gen5 meter only (separate SQL license
  // charges excluded); total = exact API rate × 4 vCores, rounded to $0.001/hr.
  // GP Gen5: $0.152218/vCore/hr × 4 = $0.608872 → $0.609/hr (~$444/mo)
  // BC Gen5: $0.304435/vCore/hr × 4 = $1.217740 → $1.218/hr (~$889/mo)
  sqlMI_GP: 0.609,
  // MI_GP_Gen5_4 — 4 vCPU · 20.4 GB · $0.609/hr · ~$444/mo
  sqlMI_BC: 1.218,
  // MI_BC_Gen5_4 — 4 vCPU · 20.4 GB · $1.218/hr · ~$889/mo
  sqlMI: 0.609,
  // alias for MI_GP_Gen5_4 — used by ResourcePalette and validate-pricing
  cosmosDb: 0.048,
  // Cosmos DB provisioned 400 RU/s (East US): 4 × $0.012/100 RU-s/hr — June 2026
  blobStorage: 0.018,
  // Blob Storage (approximate flat simulation rate) — excluded from FR-12 (request_based)
  lb: 0.025,
  // Azure Load Balancer (approximate)
  // App Service Linux on-demand plans, East US, 1 Hour Consumption meters.
  // Source: Azure Retail Prices API (https://prices.azure.com/api/retail/prices), retrieved 2026-09-26.
  appServiceF1: 0,
  // App Service Free F1 — $0/hr (excluded, always_free; limited to 60 CPU-min/day)
  appServiceB1: 0.017,
  // B1, Azure App Service Basic Plan - Linux (1 vCPU, 1.75 GB) — $0.017/hr
  appServiceB2: 0.034,
  // B2, Azure App Service Basic Plan - Linux (2 vCPU, 3.5 GB) — $0.034/hr
  appServiceS1: 0.095,
  // S1, Azure App Service Standard Plan - Linux (1 vCPU, 1.75 GB) — $0.095/hr
  appServiceP1v3: 0.155,
  // P1 v3, Azure App Service Premium v3 Plan - Linux (2 vCPU, 8 GB) — $0.155/hr
  // Networking / edge (East US, June 2026)
  frontDoor: 0.05,
  // Front Door Standard — excluded from FR-12 (request_based); flat sim approx (~$35/mo base + data-transfer)
  // Observability / security (East US, June 2026)
  azureMonitor: 0.015,
  // Azure Monitor / Log Analytics — excluded from FR-12 (request_based); flat sim approx ($0.25/GB ingested)
  defenderCloud: 0.021,
  // Defender for Cloud Server Plan 2 — excluded from FR-12 (request_based); flat sim approx ($15/server/mo)
  // PostgreSQL Flexible Server (East US, on-demand, June 2026 — Azure Pricing Calculator)
  postgresFlexB1ms: 0.0175,
  // PostgreSQL Flexible B1ms (1 vCore, 2 GB) — $0.0175/hr
  postgresFlexD4s: 0.337
  // PostgreSQL Flexible D4s_v3 (4 vCore, 16 GB) — $0.337/hr
};
var AZURE_COST_MULTIPLIERS = {
  vmSmall: 0.43,
  // B2s = $0.04128/hr (0.096 × 0.43 ≈ $0.0416 official)  ✓ <1%
  vmStandard: 2,
  // D4s_v3 = $0.192/hr (0.096 × 2.0 = $0.192 official)  ✓ exact
  functions: 0.32,
  // excluded (request_based) — flat simulation approximation
  containerApps: 0.32,
  // excluded (request_based) — usage resolver applies HTTP + vCPU/GiB seconds
  sqlBasic: 0.09,
  // Basic tier = $0.00675/hr (0.075 × 0.09 ≈ $0.0068 official)  ✓ <1%
  sqlStandard: 1.34,
  // S2 tier = $0.1005/hr (0.075 × 1.34 ≈ $0.1008 official)  ✓ <1%
  sqlMI: 8.12,
  // MI_GP_Gen5_4 = $0.609/hr (0.075 × 8.12 = $0.609 official)  ✓ exact
  cosmosDb: 0.64,
  // 400 RU/s provisioned = $0.048/hr (0.075 × 0.64 = $0.048 official)  ✓ exact
  blobStorage: 1,
  // Blob Storage = $0.018/hr  ✓ exact
  lb: 1,
  // Load Balancer = $0.025/hr  ✓ exact
  // App Service plans — costMultiplier = officialRate / AZURE_BASE_RATES.compute (0.096)
  appServiceF1: 0,
  // excluded (always_free) — $0/hr official
  appServiceB1: 0.177083,
  // B1 = $0.017/hr (0.096 × 0.177083 ≈ $0.017) ✓ <0.001%
  appServiceB2: 0.354167,
  // B2 = $0.034/hr (0.096 × 0.354167 ≈ $0.034) ✓ <0.001%
  appServiceS1: 0.989583,
  // S1 = $0.095/hr (0.096 × 0.989583 ≈ $0.095) ✓ <0.001%
  appServiceP1v3: 1.614583,
  // P1 v3 = $0.155/hr (0.096 × 1.614583 ≈ $0.155) ✓ <0.001%
  // Networking / edge — costMultiplier = officialRate / AZURE_BASE_RATES.network (0.025)
  frontDoor: 2,
  // excluded (request_based) — flat sim approx ($0.050/hr ÷ $0.025 network base = 2.0)
  // Observability / security — costMultiplier = officialRate / AZURE_BASE_RATES.compute (0.096)
  azureMonitor: 0.6,
  // excluded (request_based) — Azure Monitor: $0.015/hr ÷ $0.025 Azure security base = 0.60 → $0.025×0.60=$0.015 ✓ exact
  defenderCloud: 0.84,
  // excluded (request_based) — Defender: $0.021/hr ÷ $0.025 Azure security base = 0.84 → $0.025×0.84=$0.021 ✓ exact
  // PostgreSQL Flexible — costMultiplier = officialRate / AZURE_BASE_RATES.database (0.075)
  postgresFlexB1ms: 0.23,
  // Flex B1ms = $0.01725/hr (0.075 × 0.23 ≈ $0.0175 official)  ✓ <2%
  postgresFlexD4s: 4.49
  // Flex D4s_v3 = $0.33675/hr (0.075 × 4.49 ≈ $0.337 official)  ✓ <0.1%
};
var OCI_HOURLY_RATES = {
  // E2.1.Micro is a fixed (non-Flex) Always Free shape — no per-unit calculation.
  vmMicro: 0,
  // VM.Standard.E2.1.Micro — Always Free — $0.00/hr official; excluded from FR-12 (always_free)
  // Reference config: 2 OCPU + 16 GB RAM
  //   2 OCPU × $0.025/OCPU-hr           = $0.050
  //   16 GB  × $0.0015/GB-hr            = $0.024
  //   Total                              = $0.074/hr  (using $0.050 + $0.024 = $0.074)
  vmE4Flex: 0.074,
  // VM.Standard.E4.Flex — 2 OCPU @ $0.025 + 16 GB @ $0.0015/GB ($0.024) = $0.074/hr
  // Reference config: 1 OCPU + 6 GB RAM
  //   1 OCPU × $0.04/OCPU-hr            = $0.04
  //   6 GB   × $0.0015/GB-hr            = $0.009
  //   Total                              = $0.049/hr
  vmStandard: 0.049,
  // VM.Standard3.Flex — 1 OCPU @ $0.04 + 6 GB @ $0.0015/GB ($0.009) = $0.049/hr
  // Reference config: 1 OCPU + 6 GB RAM (Ampere Altra ARM; no hyperthreading — 1 OCPU = 1 physical core)
  //   1 OCPU × $0.01/OCPU-hr            = $0.010
  //   6 GB   × $0.0015/GB-hr            = $0.009
  //   Total                              = $0.019/hr
  vmA1Flex: 0.019,
  // VM.Standard.A1.Flex — 1 OCPU @ $0.01 (B88514) + 6 GB @ $0.0015/GB (B88515) = $0.019/hr
  // Reference config: 2 OCPU + 16 GB RAM (AMD EPYC Genoa)
  //   2 OCPU × $0.026/OCPU-hr           = $0.052
  //   16 GB  × $0.00175/GB-hr           = $0.028
  //   Total                              = $0.080/hr
  vmE5Flex: 0.08,
  // VM.Standard.E5.Flex — 2 OCPU @ $0.026 (B97037) + 16 GB @ $0.00175/GB (B97038) = $0.080/hr
  // Additional Standard E5.Flex, Standard3.Flex, and Optimized3.Flex
  // configurations. Rates use OCI's billed line-item rounding in us-ashburn-1.
  vmE5Flex1: 0.04,
  vmE5Flex4: 0.16,
  vmE5Flex8: 0.32,
  vmE5Flex16: 0.64,
  vmE5Flex24: 0.96,
  vmE5Flex32: 1.28,
  vmStandard3Flex1: 0.049,
  vmStandard3Flex2: 0.098,
  vmStandard3Flex4: 0.196,
  vmStandard3Flex8: 0.392,
  vmStandard3Flex16: 0.784,
  vmStandard3Flex24: 1.176,
  vmStandard3Flex32: 1.568,
  vmOptimized3Flex1: 0.044,
  vmOptimized3Flex2: 0.088,
  vmOptimized3Flex4: 0.176,
  vmOptimized3Flex8: 0.352,
  vmOptimized3Flex16: 0.704,
  vmOptimized3Flex24: 1.056,
  vmOptimized3Flex32: 1.408,
  // Container Instances use the E4.Flex per-unit rates; $0.02/hr is an
  // approximate flat rate used for simulation (exact cost varies with workload).
  // Reference config: ~0.5 OCPU + ~6 GB RAM (E4.Flex shape)
  //   0.5 OCPU × $0.025/OCPU-hr         = $0.0125
  //   6 GB     × $0.0015/GB-hr          = $0.009
  //   Total (approx)                     ≈ $0.0215 → rounded to $0.02 for simulation
  container: 0.02,
  // OCI Container Instances — E4.Flex shape, ~0.5 OCPU @ $0.025 + ~6 GB @ $0.0015/GB ≈ $0.02/hr (approx)
  autonomousDbFree: 0,
  // Autonomous DB Always Free tier — $0.00/hr official; excluded from FR-12 (always_free)
  // Autonomous AI Transaction Processing, ECPU-based (Serverless).
  // OCI rebranded Autonomous Database → Autonomous AI; part B95702 repriced to $0.336/ECPU-hr.
  // Reference config: 2 ECPUs (minimum billable), us-ashburn-1.
  //   2 ECPUs × $0.336/ECPU-hr          = $0.672 compute
  //   Storage/licensing component        ≈ $0.117/hr (blended from $0.02/GB-mo at 5 TB reserved)
  //   Blended total used for simulation  = $0.789/hr
  autonomousDbStd: 0.789,
  // Autonomous AI Transaction Processing (Serverless) — 2 ECPUs @ $0.336/ECPU-hr + storage ≈ $0.789/hr
  // Autonomous AI — 8 OCPU (= 16 ECPU in the OCI ECPU billing model), us-ashburn-1.
  //   16 ECPUs × $0.336/ECPU-hr         = $5.376 compute
  //   Storage/licensing component        ≈ $0.117/hr (same blended component as Standard tier)
  //   Blended total used for simulation  = $5.493/hr
  autonomousDb8Ocpu: 5.493,
  // Autonomous AI — 8 OCPU (16 ECPUs @ $0.336/ECPU-hr + storage) = $5.493/hr
  // Autonomous AI — 16 OCPU (= 32 ECPU in the OCI ECPU billing model), us-ashburn-1.
  //   32 ECPUs × $0.336/ECPU-hr         = $10.752 compute
  //   Storage/licensing component        ≈ $0.117/hr (same blended component as Standard tier)
  //   Blended total used for simulation  = $10.869/hr
  autonomousDb16Ocpu: 10.869,
  // Autonomous AI — 16 OCPU (32 ECPUs @ $0.336/ECPU-hr + storage) = $10.869/hr
  // MySQL HeatWave DB System (no HeatWave cluster), E4.Flex shape.
  // Reference config: 2 OCPU / 16 GB RAM, us-ashburn-1.
  //   2 OCPU  × $0.025/OCPU-hr          = $0.05
  //   16 GB   × $0.0015/GB-hr           = $0.024
  //   Total                              = $0.074/hr
  mysqlHeatwave: 0.074,
  // MySQL HeatWave DB System — 2 OCPU / 16 GB E4.Flex, no cluster — $0.074/hr
  // MySQL HeatWave DB System catalog shapes (HeatWave.1 – HeatWave.16).
  // These are the OCI right-sizing overlay tiers (OCI_MYSQL_HEATWAVE_CATALOG_SIZES in
  // shared/provider-sizes.ts).  Each N-OCPU shape bundles N×8 GB of RAM.
  // Source: OCI Pricing Calculator (us-ashburn-1, June 2026) — E4.Flex per-unit
  // rates (B93113 OCPU + B93114 memory) with MySQL HeatWave DB System billing.
  // Drift checked weekly by scripts/check-oci-pricing.ts (±5 % tolerance).
  mysqlHeatwaveCatalog1: 0.038,
  // HeatWave.1  — 1 OCPU ·  8 GB  — $0.038/hr
  mysqlHeatwaveCatalog2: 0.076,
  // HeatWave.2  — 2 OCPU · 16 GB  — $0.076/hr
  mysqlHeatwaveCatalog4: 0.151,
  // HeatWave.4  — 4 OCPU · 32 GB  — $0.151/hr
  mysqlHeatwaveCatalog8: 0.302,
  // HeatWave.8  — 8 OCPU · 64 GB  — $0.302/hr
  mysqlHeatwaveCatalog16: 0.604,
  // HeatWave.16 — 16 OCPU · 128 GB — $0.604/hr
  // HeatWave cluster node (separate add-on to the DB System above).
  // Billed per node per hour regardless of OCPU/RAM; shape: HeatWave.512GB.
  // Source: OCI Pricing (us-ashburn-1), part number B91961, MySQL HeatWave cluster node rate.
  mysqlHeatwaveClusterNode: 0.0255,
  // HeatWave cluster node — $0.0255/node-hr (HeatWave.512GB, OCI B91961 PAY_AS_YOU_GO USD, us-ashburn-1, verified Sep 2026)
  objectStorage: 8e-3,
  // Object Storage — approximate: $0.0255/GB-mo → /730 hr ≈ $0.0000349/GB-hr; flat sim rate $0.008/hr
  // Per-GB-month rate anchor for Block Volume Balanced (10 VPUs/GB), us-ashburn-1.
  // Unit: USD/GB-month (NOT USD/hr). Used as the source-of-truth for STORAGE_GB_MONTH_RATES.oci.
  // Source: https://www.oracle.com/cloud/storage/pricing/ (June 2026)
  blockVolumeBalanced: 0.0255,
  // Block Volume Balanced — $0.0255/GB-mo official; unit = $/GB-month
  blockVolume: 0.015,
  // Block Volume (Balanced, 10 VPUs/GB) — flat sim rate $0.015/hr (represents a moderate-sized volume)
  // Higher Performance (20 VPUs/GB): $0.0255/GB-mo base + 10 extra VPUs × $0.00225/VPU/GB-mo = $0.0480/GB-mo; flat sim rate $0.028/hr
  blockVolumeHigher: 0.028,
  // Block Volume (Higher Performance, 20 VPUs/GB) — $0.0480/GB-mo; flat sim rate $0.028/hr
  // Ultra High Performance (30 VPUs/GB): $0.0255/GB-mo base + 20 extra VPUs × $0.00225/VPU/GB-mo = $0.0705/GB-mo; flat sim rate $0.041/hr
  blockVolumeUltra: 0.041,
  // Block Volume (Ultra High Performance, 30 VPUs/GB) — $0.0705/GB-mo; flat sim rate $0.041/hr
  // Ultra High Performance (60 VPUs/GB): $0.0255/GB-mo base + 50 extra VPUs × $0.00225/VPU/GB-mo = $0.138/GB-mo; flat sim rate $0.082/hr (~430 GB reference volume)
  blockVolumeUltra60: 0.082,
  // Block Volume (Ultra High Performance, 60 VPUs/GB) — $0.138/GB-mo; flat sim rate $0.082/hr
  // Ultra High Performance (90 VPUs/GB): $0.0255/GB-mo base + 80 extra VPUs × $0.00225/VPU/GB-mo = $0.2055/GB-mo; flat sim rate $0.123/hr (~430 GB reference volume)
  blockVolumeUltra90: 0.123,
  // Block Volume (Ultra High Performance, 90 VPUs/GB) — $0.2055/GB-mo; flat sim rate $0.123/hr
  // Ultra High Performance (120 VPUs/GB): $0.0255/GB-mo base + 110 extra VPUs × $0.00225/VPU/GB-mo = $0.273/GB-mo; flat sim rate $0.163/hr (~430 GB reference volume)
  blockVolumeUltra120: 0.163,
  // Block Volume (Ultra High Performance, 120 VPUs/GB) — $0.273/GB-mo; flat sim rate $0.163/hr
  fileStorage: 0.012,
  // File Storage — $0.025/GB-mo actual; flat sim rate $0.012/hr (billed per GB stored, grows automatically)
  lb: 0.022,
  // Flexible Load Balancer — 10 Mbps baseline shape, $0.022/hr approximate
  // Bare Metal — Standard3.64 (64 OCPU, 512 GB RAM), us-ashburn-1.
  // 64 OCPU × $0.04/OCPU-hr = $2.56/hr + 512 GB × $0.0015/GB-hr = $0.768/hr → $3.328/hr
  bmStandard364: 3.328,
  // BM.Standard3.64 — 64 OCPU @ $0.04 + 512 GB @ $0.0015/GB = $3.328/hr
  // Bare Metal — Optimized3.36 (36 OCPU, 512 GB RAM, Intel Sapphire Rapids), us-ashburn-1.
  // 36 OCPU × $0.04/OCPU-hr = $1.44/hr + 512 GB × $0.0015/GB-hr = $0.768/hr → $2.208/hr
  bmOptimized336: 2.208,
  // BM.Optimized3.36 — 36 OCPU @ $0.04 + 512 GB @ $0.0015/GB = $2.208/hr
  // Serverless / observability (us-ashburn-1, June 2026)
  functions: 5e-3,
  // OCI Functions — excluded from FR-12 (request_based); flat sim approx; first 2M req/mo free (OCI Functions pricing, June 2026)
  logging: 5e-3
  // OCI Logging — excluded from FR-12 (request_based); flat sim approx; $0.10/GB ingested (OCI Logging pricing, June 2026)
};
var STORAGE_GB_MONTH_RATES = {
  aws: 0.08,
  // EBS gp3 us-east-1 — $0.08/GB-mo official
  gcp: 0.04,
  // Persistent Disk Standard us-central1 — $0.04/GB-mo official
  azure: 0.04,
  // Managed Disk Standard HDD East US — $0.04/GB-mo official
  oci: OCI_HOURLY_RATES.blockVolumeBalanced,
  // Block Volume Balanced us-ashburn-1 — $0.0255/GB-mo (source: OCI_HOURLY_RATES.blockVolumeBalanced)
  digitalocean: 0.1
  // Block Storage volume nyc3 — $0.10/GB-mo official
};
var QUEUE_HOURLY_RATES = {
  awsSQS: 0.01,
  // SQS — request_based; flat simulation approximation
  gcpPubSub: 0.01,
  // Pub/Sub — request_based; flat simulation approximation
  azureServiceBus: 0.01,
  // Service Bus Standard — request_based; flat simulation approximation
  ociStreaming: 7e-3,
  // OCI Streaming — request_based; flat simulation approximation
  doManagedKafka: DO_HOURLY_RATES.managedKafka
  // DO Managed Kafka basic plan — $41/mo / 730 hr (auto-syncs with do-pricing.ts)
};
var KUBERNETES_HOURLY_RATES = {
  eksCluster: 0.1,
  // EKS cluster fee (us-east-1) — $0.10/hr official
  gkeCluster: 0.1,
  // GKE Autopilot cluster fee (us-central1) — ~$0.10/hr
  aksCluster: 0.1,
  // AKS — free control plane, modeled as $0.10/hr overhead
  okeCluster: 0.05,
  // OKE — free control plane, modeled as $0.05/hr overhead
  doksCluster: DO_HOURLY_RATES.doks
  // DOKS — no cluster fee; modeled as $12/mo / 730 hr overhead (auto-syncs with do-pricing.ts)
};
var ARO_PRICING_EVIDENCE = {
  offering: "aro",
  sku: "D4s v3",
  vcpu: 4,
  billingUnit: "4-vcpu-hour",
  billingUnitVcpu: 4,
  monthlyLicenseUsd: 124.83,
  hoursPerMonth: 730,
  sourceUrl: "https://azure.microsoft.com/en-us/pricing/details/openshift/",
  sourceName: "Azure Red Hat OpenShift Pricing",
  referenceRegion: "Azure East US",
  verificationDate: "2026-08-27",
  pricingStatus: "official",
  arithmetic: "$124.830/month \xF7 730 = $0.171/hour per 4 vCPU"
};
var OPENSHIFT_HOURLY_RATES = {
  rosaWorkerServicePer4VcpuHour: 0.171,
  // ROSA worker service fee, AWS standard regions — AWS ROSA Pricing, verified 2026-08-27
  rosaHcpClusterHour: 0.25,
  // ROSA HCP cluster fee, AWS standard regions — AWS ROSA Pricing, verified 2026-08-27
  aroLicensePer4VcpuHour: ARO_PRICING_EVIDENCE.monthlyLicenseUsd / ARO_PRICING_EVIDENCE.hoursPerMonth
  // ARO D4s v3 OpenShift license, East US — Azure OpenShift Pricing, verified 2026-08-27
};
var RATE_PROVENANCE_RESOLUTIONS = [
  "exact-catalog",
  "large-sku",
  "entry-level-fallback",
  "base-rate-multiplier",
  "cloud-run-request-based",
  "request-serving-usage-based",
  "fargate-task-vcpu-memory",
  "aurora-acu-hour"
];
var AWS_EC2_M8_RATE_SOURCE = "AWS EC2 Price List API (Linux, shared tenancy, on-demand), https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.json";
var AWS_EC2_M8_RATE_REGION = "us-east-1";
var AWS_EC2_M8_RATE_LAST_VERIFIED = "2026-09-04";
var AWS_EC2_M8_RATE_METADATA = Object.fromEntries(
  AWS_EC2_M8_CATALOG.map(({ label, hourlyRate }) => [
    label,
    {
      sku: label,
      source: AWS_EC2_M8_RATE_SOURCE,
      basis: "on-demand",
      region: AWS_EC2_M8_RATE_REGION,
      lastVerified: AWS_EC2_M8_RATE_LAST_VERIFIED,
      hourlyRate
    }
  ])
);
var AWS_EC2_M7_RATE_SOURCE = AWS_EC2_M8_RATE_SOURCE;
var AWS_EC2_M7_RATE_REGION = AWS_EC2_M8_RATE_REGION;
var AWS_EC2_M7_RATE_LAST_VERIFIED = AWS_EC2_M8_RATE_LAST_VERIFIED;
var AWS_EC2_M7_RATE_METADATA = Object.fromEntries(
  AWS_EC2_M7_CATALOG.map(({ label, hourlyRate }) => [
    label,
    {
      sku: label,
      source: AWS_EC2_M7_RATE_SOURCE,
      basis: "on-demand",
      region: AWS_EC2_M7_RATE_REGION,
      lastVerified: AWS_EC2_M7_RATE_LAST_VERIFIED,
      hourlyRate
    }
  ])
);
var AWS_EC2_M9_RATE_SOURCE = AWS_EC2_M8_RATE_SOURCE;
var AWS_EC2_M9_RATE_REGION = AWS_EC2_M8_RATE_REGION;
var AWS_EC2_M9_RATE_LAST_VERIFIED = AWS_EC2_M8_RATE_LAST_VERIFIED;
var AWS_EC2_M9_RATE_METADATA = Object.fromEntries(
  AWS_EC2_M9_CATALOG.map(({ label, hourlyRate }) => [
    label,
    {
      sku: label,
      source: AWS_EC2_M9_RATE_SOURCE,
      basis: "on-demand",
      region: AWS_EC2_M9_RATE_REGION,
      lastVerified: AWS_EC2_M9_RATE_LAST_VERIFIED,
      hourlyRate
    }
  ])
);
var K8S_CLUSTER_FEE_BY_PROVIDER = {
  aws: KUBERNETES_HOURLY_RATES.eksCluster,
  gcp: KUBERNETES_HOURLY_RATES.gkeCluster,
  azure: KUBERNETES_HOURLY_RATES.aksCluster,
  oci: KUBERNETES_HOURLY_RATES.okeCluster,
  digitalocean: KUBERNETES_HOURLY_RATES.doksCluster
};
var MULTICLOUD_STRATEGY_BASE_RATES = {
  aws: { compute: 0.096, database: 0.27, storage: 0.023 },
  gcp: { compute: GCP_HOURLY_RATES.vmN2Standard2, database: 0.192, storage: 0.02 },
  azure: { compute: AZURE_HOURLY_RATES.vmD2sV3, database: 0.272, storage: 0.024 },
  oci: { compute: OCI_HOURLY_RATES.vmE4Flex, database: 0.24, storage: 0.018 },
  digitalocean: { compute: 0.036, database: 0.022, storage: 0.023 }
};
var AWS_RDS_SQLSERVER_PRICING = {
  instanceHourly: { micro: 0.022, small: 0.044, medium: 0.088, large: 0.162, xlarge: 0.35 },
  storageGbMonth: { gp2: 0.115, gp3: 0.115 },
  cpuCreditVcpuHour: 0.144
};

// ../shared/session-affinity.ts
import { z } from "zod";
var sessionAffinitySchema = z.object({
  mode: z.literal("sticky"),
  fleetId: z.string().min(1).max(128),
  initialSessions: z.number().finite().nonnegative().default(100),
  arrivalsPerStep: z.number().finite().nonnegative().default(0),
  meanLifetimeSteps: z.number().finite().min(1).default(300),
  requestsPerSessionPerSecond: z.number().finite().positive().default(1),
  maxSessionsPerOwner: z.number().finite().positive().default(1e3),
  reconnect: z.enum(["none", "next-step"]).default("none"),
  /** An application replica controller, independent of Kubernetes node autoscaling. */
  workload: z.object({
    replicas: z.number().int().min(1).max(1e4),
    minReplicas: z.number().int().min(1).max(1e4),
    maxReplicas: z.number().int().min(1).max(1e4),
    targetCpuPercent: z.number().finite().min(1).max(100).default(70),
    capacityRpsPerReplica: z.number().finite().positive(),
    autoscaling: z.boolean().default(true)
  }).strict().refine(
    (w) => w.minReplicas <= w.replicas && w.replicas <= w.maxReplicas,
    "replicas must be between minReplicas and maxReplicas"
  ).optional()
}).strict();
var sessionAffinityEvidenceSchema = z.object({
  fleetId: z.string(),
  basis: z.literal("modeled-expected-session-cohorts"),
  ownerKind: z.enum(["compute-member", "workload-replica"]),
  reconnectPolicy: z.enum(["none", "next-step"]),
  offeredRps: z.number(),
  sessionOfferedRps: z.number(),
  statelessRps: z.number(),
  activeSessions: z.number(),
  newSessions: z.number(),
  reconnectingSessions: z.number(),
  disconnectedSessions: z.number(),
  ownerLossDisconnects: z.number(),
  rejectedSessionArrivals: z.number(),
  disconnectedRps: z.number(),
  capacityRejectedRps: z.number(),
  servedRpsCeiling: z.number(),
  owners: z.array(z.object({
    ownerId: z.string(),
    resourceId: z.string(),
    activeSessions: z.number(),
    newSessions: z.number(),
    reconnectingSessions: z.number(),
    offeredRps: z.number(),
    capacityRps: z.number(),
    capacityRejectedRps: z.number(),
    cpuPercent: z.number()
  })),
  assumptions: z.string()
});

// ../shared/cdn-traffic.ts
import { z as z2 } from "zod";
var cdnTrafficSchema = z2.object({
  cacheableFraction: z2.number().min(0).max(1),
  cacheableMissDatabaseFraction: z2.number().min(0).max(1),
  dynamicDatabaseFraction: z2.number().min(0).max(1)
}).strict();
var cdnFlowSchema = z2.object({
  resourceId: z2.string(),
  basis: z2.literal("scenario-assumption"),
  offeredRps: z2.number().nonnegative(),
  cacheableRps: z2.number().nonnegative(),
  dynamicRps: z2.number().nonnegative(),
  cacheHitRate: z2.number().min(0).max(1),
  edgeHitRps: z2.number().nonnegative(),
  cacheMissRps: z2.number().nonnegative(),
  originRps: z2.number().nonnegative(),
  databaseRps: z2.number().nonnegative(),
  compute: z2.array(z2.object({
    resourceId: z2.string(),
    name: z2.string(),
    routedRps: z2.number().nonnegative()
  })),
  databases: z2.array(z2.object({
    resourceId: z2.string(),
    name: z2.string(),
    offeredRps: z2.number().nonnegative(),
    estimatedConnections: z2.number().nonnegative(),
    connectionLimit: z2.number().nonnegative()
  }))
});

// ../shared/pre-provision-evidence.ts
import { z as z3 } from "zod";
var completedResilienceEvidenceSchema = z3.object({
  candidateFingerprint: z3.string().regex(/^[a-f0-9]{64}$/),
  reportRef: z3.string().trim().min(1).max(500),
  status: z3.literal("completed"),
  completedAt: z3.string().datetime({ offset: true }),
  provenance: z3.enum(["recorded", "estimated"]),
  failureInjected: z3.boolean(),
  recoveryObserved: z3.boolean(),
  finalHealthy: z3.boolean(),
  resilienceCheck: z3.enum(["pass", "fail", "not_evaluated"]),
  scope: z3.string().trim().min(1).max(2e3)
}).strict();
var preProvisionFinalizeRequestSchema = z3.object({
  strategyId: z3.string().min(1).max(200),
  maxCostPerHour: z3.number().finite().positive().optional(),
  errorBudgetPct: z3.number().finite().min(0).max(100).optional(),
  resilienceEvidence: completedResilienceEvidenceSchema.optional()
}).strict();

// ../shared/external-metrics.ts
import { z as z4 } from "zod";
var externalMetricSampleSchema = z4.discriminatedUnion("status", [
  z4.object({
    step: z4.number().int().min(0).max(1e5),
    status: z4.literal("value"),
    value: z4.number().finite().min(0).max(1e9)
  }).strict(),
  z4.object({
    step: z4.number().int().min(0).max(1e5),
    status: z4.enum(["no_ready_endpoints", "discovery_error", "fetch_error"])
  }).strict()
]);
var externalMetricsConfigSchema = z4.object({
  errorMode: z4.enum(["drop_failed_trigger", "freeze_combined_decision"]),
  initialCapacity: z4.number().int().min(0).max(1e4),
  minCapacity: z4.number().int().min(0).max(1e4).default(0),
  maxCapacity: z4.number().int().min(1).max(1e4).default(100),
  triggers: z4.array(z4.object({
    id: z4.string().min(1).max(128),
    targetValue: z4.number().finite().positive().min(1e-6).max(1e9),
    noReadyEndpointsAsZero: z4.boolean().default(false),
    samples: z4.array(externalMetricSampleSchema).min(1).max(120)
  }).strict()).min(1).max(16)
}).strict().superRefine((config, ctx) => {
  if (config.minCapacity > config.maxCapacity || config.initialCapacity < config.minCapacity || config.initialCapacity > config.maxCapacity)
    ctx.addIssue({ code: "custom", path: ["initialCapacity"], message: "Capacity bounds must contain initialCapacity" });
  const ids = /* @__PURE__ */ new Set();
  config.triggers.forEach((trigger, index) => {
    if (ids.has(trigger.id))
      ctx.addIssue({ code: "custom", path: ["triggers", index, "id"], message: "Trigger IDs must be unique" });
    ids.add(trigger.id);
    if (trigger.samples[0].step !== 0 || trigger.samples.some((s, i) => i > 0 && s.step <= trigger.samples[i - 1].step))
      ctx.addIssue({ code: "custom", path: ["triggers", index, "samples"], message: "Samples must start at step 0 and have strictly increasing steps" });
  });
});
var externalMetricsTelemetrySchema = z4.object({
  step: z4.number().int().nonnegative(),
  errorMode: z4.enum(["drop_failed_trigger", "freeze_combined_decision"]),
  currentCapacity: z4.number().int().nonnegative(),
  desiredCapacity: z4.number().int().nonnegative().nullable(),
  lastSuccessfulRecommendation: z4.number().int().nonnegative().nullable(),
  decision: z4.enum(["scale_out", "scale_in", "no_scale", "no_recommendation", "frozen", "frozen_without_prior"]),
  scaleInBlocked: z4.boolean(),
  triggers: z4.array(z4.object({
    id: z4.string(),
    sampleStatus: z4.enum(["value", "no_ready_endpoints", "discovery_error", "fetch_error"]),
    outcome: z4.enum(["success", "error"]),
    value: z4.number().nonnegative().nullable(),
    desiredCapacity: z4.number().int().nonnegative().nullable()
  }))
});

// ../shared/goodput-comparison.ts
var POST_STEP_INTERVAL_END = "post_step_interval_end";
var SIMULATION_CLOCK_FLOAT_TOLERANCE_SECONDS = 1e-9;
function invalid(message) {
  throw new Error(`Cannot compare goodput: ${message}`);
}
function finiteNonnegative(value, name) {
  if (!Number.isFinite(value) || value < 0) invalid(`${name} must be a finite non-negative number`);
}
function sameSimulationInstant(left, right) {
  return Math.abs(left - right) <= SIMULATION_CLOCK_FLOAT_TOLERANCE_SECONDS;
}
function goodputPointSampleId(sample) {
  if (!sample.simulationId) invalid("sample simulationId is required");
  if (!sample.metricId && sample.metricIndex === void 0) {
    invalid("sample requires metricId or metricIndex; retrieval time is not an identity");
  }
  if (sample.metricId !== void 0 && !sample.metricId) invalid("metricId must be non-empty");
  if (sample.metricIndex !== void 0 && (!Number.isInteger(sample.metricIndex) || sample.metricIndex < 0)) {
    invalid("metricIndex must be a non-negative integer");
  }
  finiteNonnegative(sample.simulationTimestampSeconds, "simulationTimestampSeconds");
  finiteNonnegative(sample.tickDurationSeconds, "tickDurationSeconds");
  if (sample.tickDurationSeconds === 0) invalid("tickDurationSeconds must be greater than zero");
  finiteNonnegative(sample.goodputRps, "goodputRps");
  if (sample.intervalSemantics !== POST_STEP_INTERVAL_END) {
    invalid(`unknown interval semantics '${String(sample.intervalSemantics)}'`);
  }
  return [
    sample.simulationId,
    sample.metricId ? `metric:${sample.metricId}` : `index:${sample.metricIndex}`,
    `post-step:${sample.simulationTimestampSeconds}`,
    `tick:${sample.tickDurationSeconds}`
  ].join("|");
}
function intervalFor(sample) {
  const id = goodputPointSampleId(sample);
  return {
    start: sample.simulationTimestampSeconds - sample.tickDurationSeconds,
    end: sample.simulationTimestampSeconds,
    id
  };
}
function persistedGoodputWindow(samples) {
  if (samples.length === 0) {
    return {
      status: "unavailable",
      provenance: {
        kind: "unavailable",
        reason: "persisted simulation-clock interval bounds are unavailable"
      }
    };
  }
  try {
    const intervals = samples.map(intervalFor);
    const window = {
      windowStartSeconds: Math.min(...intervals.map(({ start }) => start)),
      windowEndSeconds: Math.max(...intervals.map(({ end }) => end)),
      inclusion: "[start,end)"
    };
    const aggregate = durationWeightedGoodput(samples, window);
    return {
      status: "recorded",
      window,
      aggregate,
      provenance: {
        kind: "recorded",
        source: "persisted simulation-clock interval bounds"
      }
    };
  } catch (error) {
    return {
      status: "unavailable",
      provenance: {
        kind: "unavailable",
        reason: error instanceof Error ? error.message.replace(/^Cannot compare goodput:\s*/, "") : "persisted simulation-clock interval bounds do not cover a contiguous window"
      }
    };
  }
}
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function persistedIntervalAttribution(metric) {
  const direct = record(metric.intervalAttribution ?? metric.goodputIntervalAttribution);
  if (direct) return direct;
  const interruptions = Array.isArray(metric.eksSpotInterruptions) ? metric.eksSpotInterruptions : [];
  for (const interruption of interruptions) {
    const checkpoint = record(record(interruption)?.checkpointEvidence);
    const attribution = record(checkpoint?.intervalAttribution);
    if (attribution) return attribution;
  }
  return null;
}
function goodputWindowFromPersistedMetrics(simulationId, metrics) {
  if (!simulationId || metrics.length === 0) {
    return persistedGoodputWindow([]);
  }
  const samples = [];
  for (let metricIndex = 0; metricIndex < metrics.length; metricIndex += 1) {
    const metric = record(metrics[metricIndex]);
    if (!metric || typeof metric.throughput !== "number" || !Number.isFinite(metric.throughput)) {
      return {
        status: "unavailable",
        provenance: {
          kind: "unavailable",
          reason: "persisted simulation-clock interval bounds are unavailable for every goodput point"
        }
      };
    }
    const attribution = persistedIntervalAttribution(metric);
    if (!attribution || attribution.status !== "recorded") {
      return {
        status: "unavailable",
        provenance: {
          kind: "unavailable",
          reason: "persisted goodput points do not include recorded simulation-clock interval bounds"
        }
      };
    }
    const window = record(attribution.window);
    if (!window || typeof window.windowStartSeconds !== "number" || typeof window.windowEndSeconds !== "number" || window.inclusion !== "[start,end)") {
      return {
        status: "unavailable",
        provenance: {
          kind: "unavailable",
          reason: "persisted goodput interval bounds are invalid"
        }
      };
    }
    const metricId = typeof metric.metricId === "string" ? metric.metricId : void 0;
    samples.push({
      simulationId,
      ...metricId ? { metricId } : { metricIndex },
      simulationTimestampSeconds: window.windowEndSeconds,
      tickDurationSeconds: window.windowEndSeconds - window.windowStartSeconds,
      intervalSemantics: POST_STEP_INTERVAL_END,
      goodputRps: metric.throughput,
      goodputProvenance: {
        kind: "derived",
        sourceFields: ["metrics.throughput"]
      }
    });
  }
  return persistedGoodputWindow(samples);
}
function durationWeightedGoodput(samples, window) {
  if (window.inclusion !== "[start,end)") invalid("window inclusion must be '[start,end)'");
  finiteNonnegative(window.windowStartSeconds, "windowStartSeconds");
  finiteNonnegative(window.windowEndSeconds, "windowEndSeconds");
  if (window.windowEndSeconds <= window.windowStartSeconds) {
    invalid("windowEndSeconds must be greater than windowStartSeconds");
  }
  if (samples.length === 0) invalid("no point samples supplied");
  const simulationId = samples[0].simulationId;
  if (!samples.every((sample) => sample.simulationId === simulationId)) {
    invalid("samples from different simulations cannot form one covered window");
  }
  const intervals = samples.map((sample) => ({ sample, ...intervalFor(sample) })).filter(({ start, end }) => end > window.windowStartSeconds && start < window.windowEndSeconds).map(({ sample, start, end, id }) => ({
    sample,
    start: Math.max(start, window.windowStartSeconds),
    end: Math.min(end, window.windowEndSeconds),
    id
  })).sort((left, right) => left.start - right.start || left.end - right.end);
  if (intervals.length === 0) invalid("no point intervals overlap the requested window");
  let cursor = window.windowStartSeconds;
  let goodputRequestTotal = 0;
  for (const interval of intervals) {
    if (!sameSimulationInstant(interval.start, cursor)) {
      invalid(
        interval.start > cursor ? `incomplete interval coverage: gap [${cursor}, ${interval.start})` : `overlapping interval coverage at ${interval.start}`
      );
    }
    const start = sameSimulationInstant(interval.start, cursor) ? cursor : interval.start;
    const duration = interval.end - start;
    if (duration <= 0) invalid(`empty clipped interval for ${interval.id}`);
    goodputRequestTotal += interval.sample.goodputRps * duration;
    cursor = interval.end;
  }
  if (!sameSimulationInstant(cursor, window.windowEndSeconds)) {
    invalid(`incomplete interval coverage: gap [${cursor}, ${window.windowEndSeconds})`);
  }
  const coveredDurationSeconds = window.windowEndSeconds - window.windowStartSeconds;
  const sampleIds = intervals.map((interval) => interval.id);
  return {
    window,
    coveredDurationSeconds,
    goodputRps: goodputRequestTotal / coveredDurationSeconds,
    goodputRequestTotal,
    sampleIds,
    provenance: {
      kind: "derived",
      sourceFields: sampleIds.map((sampleId) => `${sampleId}.goodputRps`)
    }
  };
}

// ../shared/schema.ts
import { z as z7 } from "zod";

// ../shared/openshift.ts
var OPENSHIFT_OFFERING_VALUES = [
  "rosa-hcp",
  "rosa-classic",
  "aro",
  "openshift-dedicated",
  "self-managed"
];
var OPENSHIFT_OFFERING_PROFILES = {
  "rosa-hcp": {
    offering: "rosa-hcp",
    label: "ROSA Hosted Control Planes",
    substrates: ["aws"],
    platformFeePerHour: OPENSHIFT_HOURLY_RATES.rosaWorkerServicePer4VcpuHour,
    platformFeeUnit: "per-4-vcpu-worker",
    controlPlaneFeePerHour: OPENSHIFT_HOURLY_RATES.rosaHcpClusterHour,
    pricingStatus: "official",
    controlPlanePricingStatus: "official",
    pricingSource: "AWS ROSA Pricing, https://aws.amazon.com/rosa/pricing/",
    sourceDate: "2026-08-27",
    effectiveDate: "2026-08-27",
    referenceRegion: "AWS standard regions (worker service and HCP cluster fee)",
    pricingArithmetic: "$0.171 per 4 vCPU-hour worker service fee + $0.25 per cluster-hour HCP fee; AWS worker rates remain separate",
    workerRateMultiplier: 1,
    latencyOverheadMs: 2,
    warmupSteps: 4,
    warmupSeverity: 0.45,
    scaleOutCpuThreshold: 70,
    scaleInCpuThreshold: 25,
    description: "Red Hat OpenShift hosted control planes on AWS; AWS remains the worker and network substrate."
  },
  "rosa-classic": {
    offering: "rosa-classic",
    label: "ROSA Classic",
    substrates: ["aws"],
    platformFeePerHour: OPENSHIFT_HOURLY_RATES.rosaWorkerServicePer4VcpuHour,
    platformFeeUnit: "per-4-vcpu-worker",
    controlPlaneFeePerHour: 0,
    pricingStatus: "official",
    controlPlanePricingStatus: "official",
    pricingSource: "AWS ROSA Pricing, https://aws.amazon.com/rosa/pricing/",
    sourceDate: "2026-08-27",
    effectiveDate: "2026-08-27",
    referenceRegion: "AWS standard regions (worker service; Classic cluster fee $0)",
    pricingArithmetic: "$0.171 per 4 vCPU-hour worker service fee + $0 per cluster-hour Classic cluster fee; AWS worker rates remain separate",
    workerRateMultiplier: 1,
    latencyOverheadMs: 3,
    warmupSteps: 5,
    warmupSeverity: 0.5,
    scaleOutCpuThreshold: 70,
    scaleInCpuThreshold: 25,
    description: "Red Hat OpenShift with customer-managed AWS control-plane infrastructure and AWS workers."
  },
  aro: {
    offering: "aro",
    label: "Azure Red Hat OpenShift",
    substrates: ["azure"],
    platformFeePerHour: OPENSHIFT_HOURLY_RATES.aroLicensePer4VcpuHour,
    platformFeeUnit: "per-4-vcpu-worker",
    pricingStatus: "official",
    controlPlanePricingStatus: "estimated",
    pricingSource: `${ARO_PRICING_EVIDENCE.sourceName}, ${ARO_PRICING_EVIDENCE.sourceUrl}`,
    sourceDate: ARO_PRICING_EVIDENCE.verificationDate,
    effectiveDate: ARO_PRICING_EVIDENCE.verificationDate,
    referenceRegion: ARO_PRICING_EVIDENCE.referenceRegion,
    pricingArithmetic: `${ARO_PRICING_EVIDENCE.arithmetic} for ${ARO_PRICING_EVIDENCE.sku} (${ARO_PRICING_EVIDENCE.vcpu} vCPU); Azure worker and control-plane VM rates remain separate`,
    workerRateMultiplier: 1,
    latencyOverheadMs: 4,
    warmupSteps: 5,
    warmupSeverity: 0.5,
    scaleOutCpuThreshold: 65,
    scaleInCpuThreshold: 30,
    description: "Jointly engineered Azure and Red Hat OpenShift service; Azure remains the worker and network substrate."
  },
  "openshift-dedicated": {
    offering: "openshift-dedicated",
    label: "OpenShift Dedicated",
    substrates: ["aws", "gcp"],
    platformFeePerHour: 0.34,
    pricingStatus: "estimated",
    pricingSource: "Red Hat OpenShift Dedicated pricing, https://www.redhat.com/en/technologies/cloud-computing/openshift/dedicated",
    sourceDate: "2026-08-27",
    effectiveDate: "2026-08-27",
    referenceRegion: "AWS us-east-1 and GCP us-central1",
    pricingArithmetic: "estimated platform subscription allocation; substrate worker rates remain separate",
    workerRateMultiplier: 1,
    latencyOverheadMs: 3,
    warmupSteps: 4,
    warmupSeverity: 0.45,
    scaleOutCpuThreshold: 70,
    scaleInCpuThreshold: 25,
    description: "Red Hat-operated OpenShift Dedicated on an AWS or GCP substrate."
  },
  "self-managed": {
    offering: "self-managed",
    label: "Self-managed OpenShift",
    substrates: ["aws", "gcp", "azure", "oci", "digitalocean"],
    platformFeePerHour: 0,
    pricingStatus: "estimated",
    pricingSource: "Red Hat OpenShift subscription overview, https://www.redhat.com/en/technologies/cloud-computing/openshift",
    sourceDate: "2026-08-27",
    effectiveDate: "2026-08-27",
    referenceRegion: "backing provider region",
    pricingArithmetic: "subscription fee not included in the hourly estimate; worker rates remain separate",
    workerRateMultiplier: 1,
    latencyOverheadMs: 1,
    warmupSteps: 6,
    warmupSeverity: 0.55,
    scaleOutCpuThreshold: 75,
    scaleInCpuThreshold: 25,
    description: "Customer-operated OpenShift on an existing CWM provider; subscription and support are not invoiced as an exact hourly line item."
  }
};
var OPENSHIFT_ACCURACY_SCENARIOS = [
  {
    id: "rosa-hcp-aws-us-east-1",
    offering: "rosa-hcp",
    provider: "aws",
    region: "us-east-1",
    sourceDate: "2026-08",
    architecture: "ROSA Hosted Control Planes with AWS worker nodes",
    expectedCost: {
      platformFeePerHour: OPENSHIFT_OFFERING_PROFILES["rosa-hcp"].platformFeePerHour,
      workerCharges: "backing-provider-list-rates",
      behavior: "Estimated ROSA subscription/control-plane allocation is additive to AWS worker and network charges."
    },
    expectedLatency: {
      platformOverheadMs: OPENSHIFT_OFFERING_PROFILES["rosa-hcp"].latencyOverheadMs,
      behavior: "Expect a small control-plane/platform overhead over the equivalent AWS worker topology; request latency remains substrate-dominated."
    },
    componentFidelity: {
      cost: "estimated",
      latency: "extrapolated",
      cpu: "extrapolated",
      throughput: "extrapolated",
      errorRate: "extrapolated"
    },
    scorecard: {
      included: false,
      reason: "No independently published ROSA HCP load-test series matches the canonical CWM topology."
    },
    sources: [
      {
        metric: "product architecture / substrate",
        citation: "Red Hat documents ROSA Hosted Control Planes as a hosted OpenShift control-plane offering on AWS with customer worker infrastructure.",
        url: "https://docs.redhat.com/en/documentation/red_hat_openshift_service_on_aws/4"
      },
      {
        metric: "pricing behavior",
        citation: "Red Hat ROSA pricing documentation describes subscription pricing and directs customers to the current service pricing rather than publishing a universal topology-independent hourly performance rate.",
        url: "https://aws.amazon.com/rosa/pricing/"
      }
    ]
  },
  {
    id: "rosa-classic-aws-us-east-1",
    offering: "rosa-classic",
    provider: "aws",
    region: "us-east-1",
    sourceDate: "2026-08",
    architecture: "ROSA Classic with customer-managed AWS control-plane infrastructure and AWS worker nodes",
    expectedCost: {
      platformFeePerHour: OPENSHIFT_OFFERING_PROFILES["rosa-classic"].platformFeePerHour,
      workerCharges: "backing-provider-list-rates",
      behavior: "Estimated ROSA subscription allocation is additive to AWS control-plane, worker, and network charges."
    },
    expectedLatency: {
      platformOverheadMs: OPENSHIFT_OFFERING_PROFILES["rosa-classic"].latencyOverheadMs,
      behavior: "Expect a small OpenShift control-plane/platform overhead over the equivalent AWS worker topology; request latency remains substrate-dominated."
    },
    componentFidelity: {
      cost: "estimated",
      latency: "extrapolated",
      cpu: "extrapolated",
      throughput: "extrapolated",
      errorRate: "extrapolated"
    },
    scorecard: {
      included: false,
      reason: "No independently published ROSA Classic load-test series matches the canonical CWM topology."
    },
    sources: [
      {
        metric: "product architecture / substrate",
        citation: "Red Hat documents ROSA Classic as the customer-managed control-plane ROSA deployment on AWS.",
        url: "https://docs.redhat.com/en/documentation/red_hat_openshift_service_on_aws/4"
      },
      {
        metric: "pricing behavior",
        citation: "Red Hat ROSA pricing documentation describes subscription pricing and does not publish a universal hourly rate for this exact cluster topology.",
        url: "https://aws.amazon.com/rosa/pricing/"
      }
    ]
  },
  {
    id: "aro-azure-east-us",
    offering: "aro",
    provider: "azure",
    region: "East US",
    sourceDate: "2026-08",
    architecture: "Azure Red Hat OpenShift with Azure worker nodes",
    expectedCost: {
      platformFeePerHour: OPENSHIFT_OFFERING_PROFILES.aro.platformFeePerHour,
      workerCharges: "backing-provider-list-rates",
      behavior: "ARO platform and backing Azure control-plane charges are already included as separate estimated rows; add Azure worker and network charges, but do not add the platform fee again."
    },
    expectedLatency: {
      platformOverheadMs: OPENSHIFT_OFFERING_PROFILES.aro.latencyOverheadMs,
      behavior: "Expect a small jointly managed service overhead over the equivalent Azure worker topology; request latency remains substrate-dominated."
    },
    componentFidelity: {
      cost: "estimated",
      latency: "extrapolated",
      cpu: "extrapolated",
      throughput: "extrapolated",
      errorRate: "extrapolated"
    },
    scorecard: {
      included: false,
      reason: "Azure publishes ARO product and pricing information but not a comparable independent four-load-point performance series for the canonical CWM topology."
    },
    sources: [
      {
        metric: "product architecture / substrate",
        citation: "Microsoft documents Azure Red Hat OpenShift as a jointly engineered and operated OpenShift service running on Azure.",
        url: "https://learn.microsoft.com/en-us/azure/openshift/intro-openshift"
      },
      {
        metric: "pricing behavior",
        citation: "Microsoft's Azure Red Hat OpenShift pricing table lists D4s v3 (4 vCPU) OpenShift at $124.830/month, separate from the Azure Linux VM line; using 730 hours/month this is $0.171/hour per 4 vCPU. Verified 2026-08-27.",
        url: "https://azure.microsoft.com/en-us/pricing/details/openshift/"
      }
    ]
  },
  {
    id: "openshift-dedicated-aws-us-east-1",
    offering: "openshift-dedicated",
    provider: "aws",
    region: "us-east-1",
    sourceDate: "2026-08",
    architecture: "OpenShift Dedicated operated by Red Hat on an AWS substrate",
    expectedCost: {
      platformFeePerHour: OPENSHIFT_OFFERING_PROFILES["openshift-dedicated"].platformFeePerHour,
      workerCharges: "backing-provider-list-rates",
      behavior: "Estimated OpenShift Dedicated subscription allocation is additive to AWS worker and network charges."
    },
    expectedLatency: {
      platformOverheadMs: OPENSHIFT_OFFERING_PROFILES["openshift-dedicated"].latencyOverheadMs,
      behavior: "Expect a small managed-service overhead over the equivalent AWS worker topology; request latency remains substrate-dominated."
    },
    componentFidelity: {
      cost: "estimated",
      latency: "extrapolated",
      cpu: "extrapolated",
      throughput: "extrapolated",
      errorRate: "extrapolated"
    },
    scorecard: {
      included: false,
      reason: "OpenShift Dedicated pricing and architecture are documented, but no independent topology-matched load-test series is published."
    },
    sources: [
      {
        metric: "product architecture / substrate",
        citation: "Red Hat documents OpenShift Dedicated as a Red Hat-operated OpenShift service available on AWS and GCP infrastructure.",
        url: "https://www.redhat.com/en/technologies/cloud-computing/openshift/dedicated"
      },
      {
        metric: "pricing behavior",
        citation: "Red Hat OpenShift Dedicated pricing is subscription/contract based rather than a universal public hourly line item for a fixed cluster topology.",
        url: "https://docs.redhat.com/en/documentation/openshift_dedicated/4"
      }
    ]
  },
  {
    id: "openshift-dedicated-gcp-us-central1",
    offering: "openshift-dedicated",
    provider: "gcp",
    region: "us-central1",
    sourceDate: "2026-08",
    architecture: "OpenShift Dedicated operated by Red Hat on a GCP substrate",
    expectedCost: {
      platformFeePerHour: OPENSHIFT_OFFERING_PROFILES["openshift-dedicated"].platformFeePerHour,
      workerCharges: "backing-provider-list-rates",
      behavior: "Estimated OpenShift Dedicated subscription allocation is additive to GCP worker and network charges."
    },
    expectedLatency: {
      platformOverheadMs: OPENSHIFT_OFFERING_PROFILES["openshift-dedicated"].latencyOverheadMs,
      behavior: "Expect a small managed-service overhead over the equivalent GCP worker topology; request latency remains substrate-dominated."
    },
    componentFidelity: {
      cost: "estimated",
      latency: "extrapolated",
      cpu: "extrapolated",
      throughput: "extrapolated",
      errorRate: "extrapolated"
    },
    scorecard: {
      included: false,
      reason: "OpenShift Dedicated pricing and architecture are documented, but no independent topology-matched load-test series is published."
    },
    sources: [
      {
        metric: "product architecture / substrate",
        citation: "Red Hat documents OpenShift Dedicated as a Red Hat-operated OpenShift service available on AWS and GCP infrastructure.",
        url: "https://www.redhat.com/en/technologies/cloud-computing/openshift/dedicated"
      },
      {
        metric: "pricing behavior",
        citation: "Red Hat OpenShift Dedicated pricing is subscription/contract based rather than a universal public hourly line item for a fixed cluster topology.",
        url: "https://docs.redhat.com/en/documentation/openshift_dedicated/4"
      }
    ]
  },
  {
    id: "self-managed-aws-us-east-1",
    offering: "self-managed",
    provider: "aws",
    region: "us-east-1",
    sourceDate: "2026-08",
    architecture: "Self-managed Red Hat OpenShift Container Platform on AWS worker infrastructure",
    expectedCost: {
      platformFeePerHour: OPENSHIFT_OFFERING_PROFILES["self-managed"].platformFeePerHour,
      workerCharges: "backing-provider-list-rates",
      behavior: "AWS worker and network charges are modeled; Red Hat subscription and support are separate and excluded from the hourly estimate."
    },
    expectedLatency: {
      platformOverheadMs: OPENSHIFT_OFFERING_PROFILES["self-managed"].latencyOverheadMs,
      behavior: "Expect a small self-managed platform overhead over the equivalent AWS worker topology; request latency remains substrate- and operator-configuration-dominated."
    },
    componentFidelity: {
      cost: "estimated",
      latency: "extrapolated",
      cpu: "extrapolated",
      throughput: "extrapolated",
      errorRate: "extrapolated"
    },
    scorecard: {
      included: false,
      reason: "Self-managed OpenShift has no single provider-independent topology or public performance series that can support a comparable scorecard claim."
    },
    sources: [
      {
        metric: "product architecture / subscription",
        citation: "Red Hat documents OpenShift Container Platform as a customer-operated product whose subscription and support are separate from underlying infrastructure.",
        url: "https://www.redhat.com/en/technologies/cloud-computing/openshift/container-platform"
      },
      {
        metric: "deployment behavior",
        citation: "Red Hat OpenShift Container Platform documentation describes customer-managed installation and infrastructure choices, so performance depends on the selected substrate and cluster configuration.",
        url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.18"
      }
    ]
  }
];
function validateOpenShiftOffering(offering, provider, resourceType) {
  if (offering === void 0 || offering === null) return null;
  if (typeof offering !== "string" || !OPENSHIFT_OFFERING_VALUES.includes(offering)) {
    return `openshiftOffering must be one of: ${OPENSHIFT_OFFERING_VALUES.join(", ")}`;
  }
  if (resourceType !== void 0 && resourceType !== "kubernetes") {
    return "openshiftOffering is only supported on resources with type 'kubernetes'";
  }
  const profile = OPENSHIFT_OFFERING_PROFILES[offering];
  if (typeof provider !== "string" || !profile.substrates.includes(provider)) {
    return `${offering} is not supported on provider '${String(provider)}'; supported substrates: ${profile.substrates.join(", ")}`;
  }
  return null;
}

// ../shared/scenario-purpose.ts
import { z as z5 } from "zod";
var SCENARIO_PURPOSE_VALUES = [
  "educational",
  "chaos",
  "predictive",
  "optimization"
];
var scenarioPurposeSchema = z5.enum(SCENARIO_PURPOSE_VALUES);

// ../shared/data-integrity.ts
function validateDataIntegrityFailureScope(type, scope, resources) {
  if (type !== "region_outage" && type !== "permanent_data_loss") return [];
  const issues = [];
  if (type === "region_outage" && !scope.targetRegion?.trim()) {
    issues.push({ path: "targetRegion", message: "region_outage requires targetRegion" });
  }
  if ((scope.targetRegion !== void 0 || scope.targetZone !== void 0) && !scope.targetProvider) {
    issues.push({ path: "targetProvider", message: `${type} requires targetProvider for region or zone targeting` });
  }
  if (type === "permanent_data_loss" && !scope.targetResourceId?.trim() && !scope.targetRegion?.trim() && !scope.targetZone?.trim()) {
    issues.push({ path: "targetResourceId", message: "permanent_data_loss requires an explicit resource, region, or zone target" });
  }
  if (!issues.length && resources) {
    const eligible = resources.filter((resource) => matchesFailureScope(resource, scope) && (type !== "permanent_data_loss" || isDataBearing(resource)));
    if (!eligible.length) {
      issues.push({ path: "targetResourceId", message: type === "permanent_data_loss" ? "permanent_data_loss must match at least one database or storage resource" : "region_outage must match at least one resource in the selected provider and region" });
    }
  }
  return issues;
}
function matchesFailureScope(resource, scope) {
  if (!scope.targetResourceId && !scope.targetRegion && !scope.targetZone) return false;
  return (!scope.targetProvider || resource.provider === scope.targetProvider) && (!scope.targetResourceId || resource.id === scope.targetResourceId) && (!scope.targetRegion || resource.location?.regionKey === scope.targetRegion) && (!scope.targetZone || resource.location?.zoneKey === scope.targetZone);
}
function isDataBearing(resource) {
  return resource.type === "database" || resource.type === "storage";
}

// ../shared/rds-sqlserver-billing.ts
import { z as z6 } from "zod";
var RDS_SQLSERVER_CATALOG = {
  "db.t3.micro": { vcpus: 2, ramGiB: 1, baselineCpuPercent: 10, creditsPerHour: 12, hourlyRate: AWS_RDS_SQLSERVER_PRICING.instanceHourly.micro },
  "db.t3.small": { vcpus: 2, ramGiB: 2, baselineCpuPercent: 20, creditsPerHour: 24, hourlyRate: AWS_RDS_SQLSERVER_PRICING.instanceHourly.small },
  "db.t3.medium": { vcpus: 2, ramGiB: 4, baselineCpuPercent: 20, creditsPerHour: 24, hourlyRate: AWS_RDS_SQLSERVER_PRICING.instanceHourly.medium },
  "db.t3.large": { vcpus: 2, ramGiB: 8, baselineCpuPercent: 30, creditsPerHour: 36, hourlyRate: AWS_RDS_SQLSERVER_PRICING.instanceHourly.large },
  "db.t3.xlarge": { vcpus: 4, ramGiB: 16, baselineCpuPercent: 40, creditsPerHour: 96, hourlyRate: AWS_RDS_SQLSERVER_PRICING.instanceHourly.xlarge }
};
var rdsSqlServerBillingSchema = z6.object({
  engine: z6.literal("sqlserver-ex").default("sqlserver-ex"),
  region: z6.literal("us-east-1").default("us-east-1"),
  deployment: z6.literal("single-az").default("single-az"),
  instanceClass: z6.enum(["db.t3.micro", "db.t3.small", "db.t3.medium", "db.t3.large", "db.t3.xlarge"]),
  storageType: z6.enum(["gp2", "gp3"]),
  allocatedStorageGiB: z6.number().int().min(20).max(16384),
  durationHours: z6.number().finite().positive().max(8784),
  sustainedCpuPercent: z6.number().finite().min(0).max(100),
  creditMode: z6.literal("unlimited").default("unlimited"),
  initialCreditBalance: z6.number().finite().nonnegative().default(0),
  initialSurplusCreditBalance: z6.number().finite().nonnegative().default(0),
  settleSurplusAtEnd: z6.boolean().default(false)
}).strict().superRefine((input, ctx) => {
  const cap = RDS_SQLSERVER_CATALOG[input.instanceClass].creditsPerHour * 24;
  for (const key of ["initialCreditBalance", "initialSurplusCreditBalance"]) {
    if (input[key] > cap) ctx.addIssue({ code: "custom", path: [key], message: `Balance cannot exceed ${cap} credits (24-hour earning limit).` });
  }
  if (input.initialCreditBalance > 0 && input.initialSurplusCreditBalance > 0) {
    ctx.addIssue({ code: "custom", path: ["initialSurplusCreditBalance"], message: "Earned and surplus balances cannot both be positive; earned credits first pay down surplus." });
  }
});
function isRdsSqlServerResource(resource) {
  return resource.provider === "aws" && resource.type === "database" && resource.characteristics?.serviceFamily === "rds-sqlserver-express";
}
function validateRdsSqlServerBillingResource(resource) {
  const raw = resource.characteristics?.rdsSqlServerBilling;
  if (raw === void 0) return isRdsSqlServerResource(resource) ? [{ path: ["characteristics", "rdsSqlServerBilling"], message: "Explicit RDS SQL Server Express resources require rdsSqlServerBilling configuration." }] : [];
  const errors = [];
  if (!isRdsSqlServerResource(resource)) errors.push({ path: ["characteristics", "rdsSqlServerBilling"], message: "RDS SQL Server billing requires aws/database with serviceFamily rds-sqlserver-express." });
  const parsed = rdsSqlServerBillingSchema.safeParse(raw);
  if (!parsed.success) return [...errors, ...parsed.error.issues.map((i) => ({ path: ["characteristics", "rdsSqlServerBilling", ...i.path], message: i.message }))];
  const size = resource.characteristics?.size ?? resource.characteristics?.instanceType;
  if (size !== void 0 && size !== parsed.data.instanceClass) errors.push({ path: ["characteristics", "size"], message: "Resource size must match rdsSqlServerBilling.instanceClass." });
  if (resource.location?.regionKey && resource.location.regionKey !== parsed.data.region) errors.push({ path: ["location", "regionKey"], message: "RDS SQL Server billing supports only us-east-1." });
  return errors;
}

// ../shared/provider-locations.ts
var AWS_REGIONS = [
  {
    provider: "aws",
    regionKey: "use1",
    regionLabel: "us-east-1",
    zones: [
      { zoneKey: "use1-az1", providerLabel: "us-east-1a", localityType: "az" },
      { zoneKey: "use1-az2", providerLabel: "us-east-1b", localityType: "az" },
      { zoneKey: "use1-az3", providerLabel: "us-east-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "use2",
    regionLabel: "us-east-2",
    zones: [
      { zoneKey: "use2-az1", providerLabel: "us-east-2a", localityType: "az" },
      { zoneKey: "use2-az2", providerLabel: "us-east-2b", localityType: "az" },
      { zoneKey: "use2-az3", providerLabel: "us-east-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "usw1",
    regionLabel: "us-west-1",
    zones: [
      { zoneKey: "usw1-az1", providerLabel: "us-west-1a", localityType: "az" },
      { zoneKey: "usw1-az2", providerLabel: "us-west-1b", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "usw2",
    regionLabel: "us-west-2",
    zones: [
      { zoneKey: "usw2-az1", providerLabel: "us-west-2a", localityType: "az" },
      { zoneKey: "usw2-az2", providerLabel: "us-west-2b", localityType: "az" },
      { zoneKey: "usw2-az3", providerLabel: "us-west-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "afs1",
    regionLabel: "af-south-1",
    zones: [
      { zoneKey: "afs1-az1", providerLabel: "af-south-1a", localityType: "az" },
      { zoneKey: "afs1-az2", providerLabel: "af-south-1b", localityType: "az" },
      { zoneKey: "afs1-az3", providerLabel: "af-south-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "ape1",
    regionLabel: "ap-east-1",
    zones: [
      { zoneKey: "ape1-az1", providerLabel: "ap-east-1a", localityType: "az" },
      { zoneKey: "ape1-az2", providerLabel: "ap-east-1b", localityType: "az" },
      { zoneKey: "ape1-az3", providerLabel: "ap-east-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "ape2",
    regionLabel: "ap-east-2",
    zones: [
      { zoneKey: "ape2-az1", providerLabel: "ap-east-2a", localityType: "az" },
      { zoneKey: "ape2-az2", providerLabel: "ap-east-2b", localityType: "az" },
      { zoneKey: "ape2-az3", providerLabel: "ap-east-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "aps1",
    regionLabel: "ap-south-1",
    zones: [
      { zoneKey: "aps1-az1", providerLabel: "ap-south-1a", localityType: "az" },
      { zoneKey: "aps1-az2", providerLabel: "ap-south-1b", localityType: "az" },
      { zoneKey: "aps1-az3", providerLabel: "ap-south-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "aps2",
    regionLabel: "ap-south-2",
    zones: [
      { zoneKey: "aps2-az1", providerLabel: "ap-south-2a", localityType: "az" },
      { zoneKey: "aps2-az2", providerLabel: "ap-south-2b", localityType: "az" },
      { zoneKey: "aps2-az3", providerLabel: "ap-south-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apne1",
    regionLabel: "ap-northeast-1",
    zones: [
      { zoneKey: "apne1-az1", providerLabel: "ap-northeast-1a", localityType: "az" },
      { zoneKey: "apne1-az2", providerLabel: "ap-northeast-1b", localityType: "az" },
      { zoneKey: "apne1-az3", providerLabel: "ap-northeast-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apne2",
    regionLabel: "ap-northeast-2",
    zones: [
      { zoneKey: "apne2-az1", providerLabel: "ap-northeast-2a", localityType: "az" },
      { zoneKey: "apne2-az2", providerLabel: "ap-northeast-2b", localityType: "az" },
      { zoneKey: "apne2-az3", providerLabel: "ap-northeast-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apne3",
    regionLabel: "ap-northeast-3",
    zones: [
      { zoneKey: "apne3-az1", providerLabel: "ap-northeast-3a", localityType: "az" },
      { zoneKey: "apne3-az2", providerLabel: "ap-northeast-3b", localityType: "az" },
      { zoneKey: "apne3-az3", providerLabel: "ap-northeast-3c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apse1",
    regionLabel: "ap-southeast-1",
    zones: [
      { zoneKey: "apse1-az1", providerLabel: "ap-southeast-1a", localityType: "az" },
      { zoneKey: "apse1-az2", providerLabel: "ap-southeast-1b", localityType: "az" },
      { zoneKey: "apse1-az3", providerLabel: "ap-southeast-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apse2",
    regionLabel: "ap-southeast-2",
    zones: [
      { zoneKey: "apse2-az1", providerLabel: "ap-southeast-2a", localityType: "az" },
      { zoneKey: "apse2-az2", providerLabel: "ap-southeast-2b", localityType: "az" },
      { zoneKey: "apse2-az3", providerLabel: "ap-southeast-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apse3",
    regionLabel: "ap-southeast-3",
    zones: [
      { zoneKey: "apse3-az1", providerLabel: "ap-southeast-3a", localityType: "az" },
      { zoneKey: "apse3-az2", providerLabel: "ap-southeast-3b", localityType: "az" },
      { zoneKey: "apse3-az3", providerLabel: "ap-southeast-3c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apse4",
    regionLabel: "ap-southeast-4",
    zones: [
      { zoneKey: "apse4-az1", providerLabel: "ap-southeast-4a", localityType: "az" },
      { zoneKey: "apse4-az2", providerLabel: "ap-southeast-4b", localityType: "az" },
      { zoneKey: "apse4-az3", providerLabel: "ap-southeast-4c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apse5",
    regionLabel: "ap-southeast-5",
    zones: [
      { zoneKey: "apse5-az1", providerLabel: "ap-southeast-5a", localityType: "az" },
      { zoneKey: "apse5-az2", providerLabel: "ap-southeast-5b", localityType: "az" },
      { zoneKey: "apse5-az3", providerLabel: "ap-southeast-5c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apse6",
    regionLabel: "ap-southeast-6",
    zones: [
      { zoneKey: "apse6-az1", providerLabel: "ap-southeast-6a", localityType: "az" },
      { zoneKey: "apse6-az2", providerLabel: "ap-southeast-6b", localityType: "az" },
      { zoneKey: "apse6-az3", providerLabel: "ap-southeast-6c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "apse7",
    regionLabel: "ap-southeast-7",
    zones: [
      { zoneKey: "apse7-az1", providerLabel: "ap-southeast-7a", localityType: "az" },
      { zoneKey: "apse7-az2", providerLabel: "ap-southeast-7b", localityType: "az" },
      { zoneKey: "apse7-az3", providerLabel: "ap-southeast-7c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "cac1",
    regionLabel: "ca-central-1",
    zones: [
      { zoneKey: "cac1-az1", providerLabel: "ca-central-1a", localityType: "az" },
      { zoneKey: "cac1-az2", providerLabel: "ca-central-1b", localityType: "az" },
      { zoneKey: "cac1-az3", providerLabel: "ca-central-1d", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "caw1",
    regionLabel: "ca-west-1",
    zones: [
      { zoneKey: "caw1-az1", providerLabel: "ca-west-1a", localityType: "az" },
      { zoneKey: "caw1-az2", providerLabel: "ca-west-1b", localityType: "az" },
      { zoneKey: "caw1-az3", providerLabel: "ca-west-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "euc1",
    regionLabel: "eu-central-1",
    zones: [
      { zoneKey: "euc1-az1", providerLabel: "eu-central-1a", localityType: "az" },
      { zoneKey: "euc1-az2", providerLabel: "eu-central-1b", localityType: "az" },
      { zoneKey: "euc1-az3", providerLabel: "eu-central-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "euc2",
    regionLabel: "eu-central-2",
    zones: [
      { zoneKey: "euc2-az1", providerLabel: "eu-central-2a", localityType: "az" },
      { zoneKey: "euc2-az2", providerLabel: "eu-central-2b", localityType: "az" },
      { zoneKey: "euc2-az3", providerLabel: "eu-central-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "euw1",
    regionLabel: "eu-west-1",
    zones: [
      { zoneKey: "euw1-az1", providerLabel: "eu-west-1a", localityType: "az" },
      { zoneKey: "euw1-az2", providerLabel: "eu-west-1b", localityType: "az" },
      { zoneKey: "euw1-az3", providerLabel: "eu-west-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "euw2",
    regionLabel: "eu-west-2",
    zones: [
      { zoneKey: "euw2-az1", providerLabel: "eu-west-2a", localityType: "az" },
      { zoneKey: "euw2-az2", providerLabel: "eu-west-2b", localityType: "az" },
      { zoneKey: "euw2-az3", providerLabel: "eu-west-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "euw3",
    regionLabel: "eu-west-3",
    zones: [
      { zoneKey: "euw3-az1", providerLabel: "eu-west-3a", localityType: "az" },
      { zoneKey: "euw3-az2", providerLabel: "eu-west-3b", localityType: "az" },
      { zoneKey: "euw3-az3", providerLabel: "eu-west-3c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "eun1",
    regionLabel: "eu-north-1",
    zones: [
      { zoneKey: "eun1-az1", providerLabel: "eu-north-1a", localityType: "az" },
      { zoneKey: "eun1-az2", providerLabel: "eu-north-1b", localityType: "az" },
      { zoneKey: "eun1-az3", providerLabel: "eu-north-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "eus1",
    regionLabel: "eu-south-1",
    zones: [
      { zoneKey: "eus1-az1", providerLabel: "eu-south-1a", localityType: "az" },
      { zoneKey: "eus1-az2", providerLabel: "eu-south-1b", localityType: "az" },
      { zoneKey: "eus1-az3", providerLabel: "eu-south-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "eus2",
    regionLabel: "eu-south-2",
    zones: [
      { zoneKey: "eus2-az1", providerLabel: "eu-south-2a", localityType: "az" },
      { zoneKey: "eus2-az2", providerLabel: "eu-south-2b", localityType: "az" },
      { zoneKey: "eus2-az3", providerLabel: "eu-south-2c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "ilc1",
    regionLabel: "il-central-1",
    zones: [
      { zoneKey: "ilc1-az1", providerLabel: "il-central-1a", localityType: "az" },
      { zoneKey: "ilc1-az2", providerLabel: "il-central-1b", localityType: "az" },
      { zoneKey: "ilc1-az3", providerLabel: "il-central-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "mec1",
    regionLabel: "me-central-1",
    zones: [
      { zoneKey: "mec1-az1", providerLabel: "me-central-1a", localityType: "az" },
      { zoneKey: "mec1-az2", providerLabel: "me-central-1b", localityType: "az" },
      { zoneKey: "mec1-az3", providerLabel: "me-central-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "mes1",
    regionLabel: "me-south-1",
    zones: [
      { zoneKey: "mes1-az1", providerLabel: "me-south-1a", localityType: "az" },
      { zoneKey: "mes1-az2", providerLabel: "me-south-1b", localityType: "az" },
      { zoneKey: "mes1-az3", providerLabel: "me-south-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "mxc1",
    regionLabel: "mx-central-1",
    zones: [
      { zoneKey: "mxc1-az1", providerLabel: "mx-central-1a", localityType: "az" },
      { zoneKey: "mxc1-az2", providerLabel: "mx-central-1b", localityType: "az" },
      { zoneKey: "mxc1-az3", providerLabel: "mx-central-1c", localityType: "az" }
    ]
  },
  {
    provider: "aws",
    regionKey: "sae1",
    regionLabel: "sa-east-1",
    zones: [
      { zoneKey: "sae1-az1", providerLabel: "sa-east-1a", localityType: "az" },
      { zoneKey: "sae1-az2", providerLabel: "sa-east-1b", localityType: "az" },
      { zoneKey: "sae1-az3", providerLabel: "sa-east-1c", localityType: "az" }
    ]
  }
];
var GCP_REGIONS = [
  {
    provider: "gcp",
    regionKey: "usc1",
    regionLabel: "us-central1",
    zones: [
      { zoneKey: "usc1-zone-a", providerLabel: "us-central1-a", localityType: "zone" },
      { zoneKey: "usc1-zone-b", providerLabel: "us-central1-b", localityType: "zone" },
      { zoneKey: "usc1-zone-c", providerLabel: "us-central1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "use1",
    regionLabel: "us-east1",
    zones: [
      { zoneKey: "use1-zone-b", providerLabel: "us-east1-b", localityType: "zone" },
      { zoneKey: "use1-zone-c", providerLabel: "us-east1-c", localityType: "zone" },
      { zoneKey: "use1-zone-d", providerLabel: "us-east1-d", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "use4",
    regionLabel: "us-east4",
    zones: [
      { zoneKey: "use4-zone-a", providerLabel: "us-east4-a", localityType: "zone" },
      { zoneKey: "use4-zone-b", providerLabel: "us-east4-b", localityType: "zone" },
      { zoneKey: "use4-zone-c", providerLabel: "us-east4-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "use5",
    regionLabel: "us-east5",
    zones: [
      { zoneKey: "use5-zone-a", providerLabel: "us-east5-a", localityType: "zone" },
      { zoneKey: "use5-zone-b", providerLabel: "us-east5-b", localityType: "zone" },
      { zoneKey: "use5-zone-c", providerLabel: "us-east5-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "uss1",
    regionLabel: "us-south1",
    zones: [
      { zoneKey: "uss1-zone-a", providerLabel: "us-south1-a", localityType: "zone" },
      { zoneKey: "uss1-zone-b", providerLabel: "us-south1-b", localityType: "zone" },
      { zoneKey: "uss1-zone-c", providerLabel: "us-south1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "usw1",
    regionLabel: "us-west1",
    zones: [
      { zoneKey: "usw1-zone-a", providerLabel: "us-west1-a", localityType: "zone" },
      { zoneKey: "usw1-zone-b", providerLabel: "us-west1-b", localityType: "zone" },
      { zoneKey: "usw1-zone-c", providerLabel: "us-west1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "usw2",
    regionLabel: "us-west2",
    zones: [
      { zoneKey: "usw2-zone-a", providerLabel: "us-west2-a", localityType: "zone" },
      { zoneKey: "usw2-zone-b", providerLabel: "us-west2-b", localityType: "zone" },
      { zoneKey: "usw2-zone-c", providerLabel: "us-west2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "usw3",
    regionLabel: "us-west3",
    zones: [
      { zoneKey: "usw3-zone-a", providerLabel: "us-west3-a", localityType: "zone" },
      { zoneKey: "usw3-zone-b", providerLabel: "us-west3-b", localityType: "zone" },
      { zoneKey: "usw3-zone-c", providerLabel: "us-west3-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "usw4",
    regionLabel: "us-west4",
    zones: [
      { zoneKey: "usw4-zone-a", providerLabel: "us-west4-a", localityType: "zone" },
      { zoneKey: "usw4-zone-b", providerLabel: "us-west4-b", localityType: "zone" },
      { zoneKey: "usw4-zone-c", providerLabel: "us-west4-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "nane1",
    regionLabel: "northamerica-northeast1",
    zones: [
      { zoneKey: "nane1-zone-a", providerLabel: "northamerica-northeast1-a", localityType: "zone" },
      { zoneKey: "nane1-zone-b", providerLabel: "northamerica-northeast1-b", localityType: "zone" },
      { zoneKey: "nane1-zone-c", providerLabel: "northamerica-northeast1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "nane2",
    regionLabel: "northamerica-northeast2",
    zones: [
      { zoneKey: "nane2-zone-a", providerLabel: "northamerica-northeast2-a", localityType: "zone" },
      { zoneKey: "nane2-zone-b", providerLabel: "northamerica-northeast2-b", localityType: "zone" },
      { zoneKey: "nane2-zone-c", providerLabel: "northamerica-northeast2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "sae1",
    regionLabel: "southamerica-east1",
    zones: [
      { zoneKey: "sae1-zone-a", providerLabel: "southamerica-east1-a", localityType: "zone" },
      { zoneKey: "sae1-zone-b", providerLabel: "southamerica-east1-b", localityType: "zone" },
      { zoneKey: "sae1-zone-c", providerLabel: "southamerica-east1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "saw1",
    regionLabel: "southamerica-west1",
    zones: [
      { zoneKey: "saw1-zone-a", providerLabel: "southamerica-west1-a", localityType: "zone" },
      { zoneKey: "saw1-zone-b", providerLabel: "southamerica-west1-b", localityType: "zone" },
      { zoneKey: "saw1-zone-c", providerLabel: "southamerica-west1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euc2",
    regionLabel: "europe-central2",
    zones: [
      { zoneKey: "euc2-zone-a", providerLabel: "europe-central2-a", localityType: "zone" },
      { zoneKey: "euc2-zone-b", providerLabel: "europe-central2-b", localityType: "zone" },
      { zoneKey: "euc2-zone-c", providerLabel: "europe-central2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "eun1",
    regionLabel: "europe-north1",
    zones: [
      { zoneKey: "eun1-zone-a", providerLabel: "europe-north1-a", localityType: "zone" },
      { zoneKey: "eun1-zone-b", providerLabel: "europe-north1-b", localityType: "zone" },
      { zoneKey: "eun1-zone-c", providerLabel: "europe-north1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "eusw1",
    regionLabel: "europe-southwest1",
    zones: [
      { zoneKey: "eusw1-zone-a", providerLabel: "europe-southwest1-a", localityType: "zone" },
      { zoneKey: "eusw1-zone-b", providerLabel: "europe-southwest1-b", localityType: "zone" },
      { zoneKey: "eusw1-zone-c", providerLabel: "europe-southwest1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw1",
    regionLabel: "europe-west1",
    zones: [
      { zoneKey: "euw1-zone-a", providerLabel: "europe-west1-a", localityType: "zone" },
      { zoneKey: "euw1-zone-b", providerLabel: "europe-west1-b", localityType: "zone" },
      { zoneKey: "euw1-zone-c", providerLabel: "europe-west1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw2",
    regionLabel: "europe-west2",
    zones: [
      { zoneKey: "euw2-zone-a", providerLabel: "europe-west2-a", localityType: "zone" },
      { zoneKey: "euw2-zone-b", providerLabel: "europe-west2-b", localityType: "zone" },
      { zoneKey: "euw2-zone-c", providerLabel: "europe-west2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw3",
    regionLabel: "europe-west3",
    zones: [
      { zoneKey: "euw3-zone-a", providerLabel: "europe-west3-a", localityType: "zone" },
      { zoneKey: "euw3-zone-b", providerLabel: "europe-west3-b", localityType: "zone" },
      { zoneKey: "euw3-zone-c", providerLabel: "europe-west3-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw4",
    regionLabel: "europe-west4",
    zones: [
      { zoneKey: "euw4-zone-a", providerLabel: "europe-west4-a", localityType: "zone" },
      { zoneKey: "euw4-zone-b", providerLabel: "europe-west4-b", localityType: "zone" },
      { zoneKey: "euw4-zone-c", providerLabel: "europe-west4-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw6",
    regionLabel: "europe-west6",
    zones: [
      { zoneKey: "euw6-zone-a", providerLabel: "europe-west6-a", localityType: "zone" },
      { zoneKey: "euw6-zone-b", providerLabel: "europe-west6-b", localityType: "zone" },
      { zoneKey: "euw6-zone-c", providerLabel: "europe-west6-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw8",
    regionLabel: "europe-west8",
    zones: [
      { zoneKey: "euw8-zone-a", providerLabel: "europe-west8-a", localityType: "zone" },
      { zoneKey: "euw8-zone-b", providerLabel: "europe-west8-b", localityType: "zone" },
      { zoneKey: "euw8-zone-c", providerLabel: "europe-west8-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw9",
    regionLabel: "europe-west9",
    zones: [
      { zoneKey: "euw9-zone-a", providerLabel: "europe-west9-a", localityType: "zone" },
      { zoneKey: "euw9-zone-b", providerLabel: "europe-west9-b", localityType: "zone" },
      { zoneKey: "euw9-zone-c", providerLabel: "europe-west9-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw10",
    regionLabel: "europe-west10",
    zones: [
      { zoneKey: "euw10-zone-a", providerLabel: "europe-west10-a", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "euw12",
    regionLabel: "europe-west12",
    zones: [
      { zoneKey: "euw12-zone-a", providerLabel: "europe-west12-a", localityType: "zone" },
      { zoneKey: "euw12-zone-b", providerLabel: "europe-west12-b", localityType: "zone" },
      { zoneKey: "euw12-zone-c", providerLabel: "europe-west12-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "afs1",
    regionLabel: "africa-south1",
    zones: [
      { zoneKey: "afs1-zone-a", providerLabel: "africa-south1-a", localityType: "zone" },
      { zoneKey: "afs1-zone-b", providerLabel: "africa-south1-b", localityType: "zone" },
      { zoneKey: "afs1-zone-c", providerLabel: "africa-south1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "ase1",
    regionLabel: "asia-east1",
    zones: [
      { zoneKey: "ase1-zone-a", providerLabel: "asia-east1-a", localityType: "zone" },
      { zoneKey: "ase1-zone-b", providerLabel: "asia-east1-b", localityType: "zone" },
      { zoneKey: "ase1-zone-c", providerLabel: "asia-east1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "ase2",
    regionLabel: "asia-east2",
    zones: [
      { zoneKey: "ase2-zone-a", providerLabel: "asia-east2-a", localityType: "zone" },
      { zoneKey: "ase2-zone-b", providerLabel: "asia-east2-b", localityType: "zone" },
      { zoneKey: "ase2-zone-c", providerLabel: "asia-east2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "asne1",
    regionLabel: "asia-northeast1",
    zones: [
      { zoneKey: "asne1-zone-a", providerLabel: "asia-northeast1-a", localityType: "zone" },
      { zoneKey: "asne1-zone-b", providerLabel: "asia-northeast1-b", localityType: "zone" },
      { zoneKey: "asne1-zone-c", providerLabel: "asia-northeast1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "asne2",
    regionLabel: "asia-northeast2",
    zones: [
      { zoneKey: "asne2-zone-a", providerLabel: "asia-northeast2-a", localityType: "zone" },
      { zoneKey: "asne2-zone-b", providerLabel: "asia-northeast2-b", localityType: "zone" },
      { zoneKey: "asne2-zone-c", providerLabel: "asia-northeast2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "asne3",
    regionLabel: "asia-northeast3",
    zones: [
      { zoneKey: "asne3-zone-a", providerLabel: "asia-northeast3-a", localityType: "zone" },
      { zoneKey: "asne3-zone-b", providerLabel: "asia-northeast3-b", localityType: "zone" },
      { zoneKey: "asne3-zone-c", providerLabel: "asia-northeast3-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "ass1",
    regionLabel: "asia-south1",
    zones: [
      { zoneKey: "ass1-zone-a", providerLabel: "asia-south1-a", localityType: "zone" },
      { zoneKey: "ass1-zone-b", providerLabel: "asia-south1-b", localityType: "zone" },
      { zoneKey: "ass1-zone-c", providerLabel: "asia-south1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "ass2",
    regionLabel: "asia-south2",
    zones: [
      { zoneKey: "ass2-zone-a", providerLabel: "asia-south2-a", localityType: "zone" },
      { zoneKey: "ass2-zone-b", providerLabel: "asia-south2-b", localityType: "zone" },
      { zoneKey: "ass2-zone-c", providerLabel: "asia-south2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "asse1",
    regionLabel: "asia-southeast1",
    zones: [
      { zoneKey: "asse1-zone-a", providerLabel: "asia-southeast1-a", localityType: "zone" },
      { zoneKey: "asse1-zone-b", providerLabel: "asia-southeast1-b", localityType: "zone" },
      { zoneKey: "asse1-zone-c", providerLabel: "asia-southeast1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "asse2",
    regionLabel: "asia-southeast2",
    zones: [
      { zoneKey: "asse2-zone-a", providerLabel: "asia-southeast2-a", localityType: "zone" },
      { zoneKey: "asse2-zone-b", providerLabel: "asia-southeast2-b", localityType: "zone" },
      { zoneKey: "asse2-zone-c", providerLabel: "asia-southeast2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "ause1",
    regionLabel: "australia-southeast1",
    zones: [
      { zoneKey: "ause1-zone-a", providerLabel: "australia-southeast1-a", localityType: "zone" },
      { zoneKey: "ause1-zone-b", providerLabel: "australia-southeast1-b", localityType: "zone" },
      { zoneKey: "ause1-zone-c", providerLabel: "australia-southeast1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "ause2",
    regionLabel: "australia-southeast2",
    zones: [
      { zoneKey: "ause2-zone-a", providerLabel: "australia-southeast2-a", localityType: "zone" },
      { zoneKey: "ause2-zone-b", providerLabel: "australia-southeast2-b", localityType: "zone" },
      { zoneKey: "ause2-zone-c", providerLabel: "australia-southeast2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "mec1",
    regionLabel: "me-central1",
    zones: [
      { zoneKey: "mec1-zone-a", providerLabel: "me-central1-a", localityType: "zone" },
      { zoneKey: "mec1-zone-b", providerLabel: "me-central1-b", localityType: "zone" },
      { zoneKey: "mec1-zone-c", providerLabel: "me-central1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "mec2",
    regionLabel: "me-central2",
    zones: [
      { zoneKey: "mec2-zone-a", providerLabel: "me-central2-a", localityType: "zone" },
      { zoneKey: "mec2-zone-b", providerLabel: "me-central2-b", localityType: "zone" },
      { zoneKey: "mec2-zone-c", providerLabel: "me-central2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "mew1",
    regionLabel: "me-west1",
    zones: [
      { zoneKey: "mew1-zone-a", providerLabel: "me-west1-a", localityType: "zone" },
      { zoneKey: "mew1-zone-b", providerLabel: "me-west1-b", localityType: "zone" },
      { zoneKey: "mew1-zone-c", providerLabel: "me-west1-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "asse3",
    regionLabel: "asia-southeast3",
    zones: [
      { zoneKey: "asse3-zone-a", providerLabel: "asia-southeast3-a", localityType: "zone" },
      { zoneKey: "asse3-zone-b", providerLabel: "asia-southeast3-b", localityType: "zone" },
      { zoneKey: "asse3-zone-c", providerLabel: "asia-southeast3-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "eun2",
    regionLabel: "europe-north2",
    zones: [
      { zoneKey: "eun2-zone-a", providerLabel: "europe-north2-a", localityType: "zone" },
      { zoneKey: "eun2-zone-b", providerLabel: "europe-north2-b", localityType: "zone" },
      { zoneKey: "eun2-zone-c", providerLabel: "europe-north2-c", localityType: "zone" }
    ]
  },
  {
    provider: "gcp",
    regionKey: "nas1",
    regionLabel: "northamerica-south1",
    zones: [
      { zoneKey: "nas1-zone-a", providerLabel: "northamerica-south1-a", localityType: "zone" },
      { zoneKey: "nas1-zone-b", providerLabel: "northamerica-south1-b", localityType: "zone" },
      { zoneKey: "nas1-zone-c", providerLabel: "northamerica-south1-c", localityType: "zone" }
    ]
  }
];
var AZURE_ARM_REGION_NAMES = {
  eus: "eastus",
  eus2: "eastus2",
  wus: "westus",
  wus2: "westus2",
  wus3: "westus3",
  cus: "centralus",
  ncus: "northcentralus",
  scus: "southcentralus",
  wcus: "westcentralus",
  cac: "canadacentral",
  cae: "canadaeast",
  brs: "brazilsouth",
  brse: "brazilsoutheast",
  neu: "northeurope",
  weu: "westeurope",
  uks: "uksouth",
  ukw: "ukwest",
  frc: "francecentral",
  frs: "francesouth",
  gwc: "germanywestcentral",
  gn: "germanynorth",
  noe: "norwayeast",
  now: "norwaywest",
  swn: "switzerlandnorth",
  sww: "switzerlandwest",
  swc: "swedencentral",
  sws: "swedensouth",
  plc: "polandcentral",
  itn: "italynorth",
  spc: "spaincentral",
  ea: "eastasia",
  sea: "southeastasia",
  jpe: "japaneast",
  jpw: "japanwest",
  krc: "koreacentral",
  krs: "koreasouth",
  aue: "australiaeast",
  ause: "australiasoutheast",
  auc: "australiacentral",
  auc2: "australiacentral2",
  inc: "centralindia",
  ins: "southindia",
  inw: "westindia",
  injw: "jioindiawest",
  injc: "jioindiacentral",
  zan: "southafricanorth",
  zaw: "southafricawest",
  uaen: "uaenorth",
  uaec: "uaecentral",
  ilc: "israelcentral",
  qac: "qatarcentral",
  mxc: "mexicocentral",
  nzn: "newzealandnorth",
  twn: "taiwannorth",
  idc: "indonesiacentral",
  dee: "denmarkeast",
  maw: "malaysiawest"
};
var AZURE_REGIONS_RAW = [
  {
    provider: "azure",
    regionKey: "eus",
    regionLabel: "East US",
    zones: [
      { zoneKey: "eus-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "eus-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "eus-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "eus2",
    regionLabel: "East US 2",
    zones: [
      { zoneKey: "eus2-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "eus2-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "eus2-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "wus",
    regionLabel: "West US",
    zones: [
      { zoneKey: "wus-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "wus-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "wus-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "wus2",
    regionLabel: "West US 2",
    zones: [
      { zoneKey: "wus2-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "wus2-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "wus2-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "wus3",
    regionLabel: "West US 3",
    zones: [
      { zoneKey: "wus3-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "wus3-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "wus3-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "cus",
    regionLabel: "Central US",
    zones: [
      { zoneKey: "cus-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "ncus",
    regionLabel: "North Central US",
    zones: [
      { zoneKey: "ncus-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "scus",
    regionLabel: "South Central US",
    zones: [
      { zoneKey: "scus-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "scus-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "scus-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "wcus",
    regionLabel: "West Central US",
    zones: [
      { zoneKey: "wcus-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "cac",
    regionLabel: "Canada Central",
    zones: [
      { zoneKey: "cac-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "cac-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "cac-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "cae",
    regionLabel: "Canada East",
    zones: [
      { zoneKey: "cae-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "brs",
    regionLabel: "Brazil South",
    zones: [
      { zoneKey: "brs-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "brs-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "brs-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "brse",
    regionLabel: "Brazil Southeast",
    zones: [
      { zoneKey: "brse-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "neu",
    regionLabel: "North Europe",
    zones: [
      { zoneKey: "neu-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "neu-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "neu-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "weu",
    regionLabel: "West Europe",
    zones: [
      { zoneKey: "weu-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "weu-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "weu-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "uks",
    regionLabel: "UK South",
    zones: [
      { zoneKey: "uks-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "uks-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "uks-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "ukw",
    regionLabel: "UK West",
    zones: [
      { zoneKey: "ukw-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "frc",
    regionLabel: "France Central",
    zones: [
      { zoneKey: "frc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "frc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "frc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "frs",
    regionLabel: "France South",
    zones: [
      { zoneKey: "frs-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "gwc",
    regionLabel: "Germany West Central",
    zones: [
      { zoneKey: "gwc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "gwc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "gwc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "gn",
    regionLabel: "Germany North",
    zones: [
      { zoneKey: "gn-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "noe",
    regionLabel: "Norway East",
    zones: [
      { zoneKey: "noe-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "noe-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "noe-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "now",
    regionLabel: "Norway West",
    zones: [
      { zoneKey: "now-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "swn",
    regionLabel: "Switzerland North",
    zones: [
      { zoneKey: "swn-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "swn-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "swn-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "sww",
    regionLabel: "Switzerland West",
    zones: [
      { zoneKey: "sww-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "swc",
    regionLabel: "Sweden Central",
    zones: [
      { zoneKey: "swc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "swc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "swc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "sws",
    regionLabel: "Sweden South",
    zones: [
      { zoneKey: "sws-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "plc",
    regionLabel: "Poland Central",
    zones: [
      { zoneKey: "plc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "plc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "plc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "itn",
    regionLabel: "Italy North",
    zones: [
      { zoneKey: "itn-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "itn-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "itn-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "spc",
    regionLabel: "Spain Central",
    zones: [
      { zoneKey: "spc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "spc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "spc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "ea",
    regionLabel: "East Asia",
    zones: [
      { zoneKey: "ea-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "ea-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "ea-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "sea",
    regionLabel: "Southeast Asia",
    zones: [
      { zoneKey: "sea-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "sea-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "sea-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "jpe",
    regionLabel: "Japan East",
    zones: [
      { zoneKey: "jpe-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "jpe-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "jpe-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "jpw",
    regionLabel: "Japan West",
    zones: [
      { zoneKey: "jpw-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "krc",
    regionLabel: "Korea Central",
    zones: [
      { zoneKey: "krc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "krc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "krc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "krs",
    regionLabel: "Korea South",
    zones: [
      { zoneKey: "krs-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "aue",
    regionLabel: "Australia East",
    zones: [
      { zoneKey: "aue-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "aue-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "aue-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "ause",
    regionLabel: "Australia Southeast",
    zones: [
      { zoneKey: "ause-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "auc",
    regionLabel: "Australia Central",
    zones: [
      { zoneKey: "auc-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "auc2",
    regionLabel: "Australia Central 2",
    zones: [
      { zoneKey: "auc2-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "inc",
    regionLabel: "Central India",
    zones: [
      { zoneKey: "inc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "inc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "inc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "ins",
    regionLabel: "South India",
    zones: [
      { zoneKey: "ins-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "inw",
    regionLabel: "West India",
    zones: [
      { zoneKey: "inw-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "injw",
    regionLabel: "Jio India West",
    zones: [
      { zoneKey: "injw-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "injc",
    regionLabel: "Jio India Central",
    zones: [
      { zoneKey: "injc-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "zan",
    regionLabel: "South Africa North",
    zones: [
      { zoneKey: "zan-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "zan-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "zan-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "zaw",
    regionLabel: "South Africa West",
    zones: [
      { zoneKey: "zaw-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "uaen",
    regionLabel: "UAE North",
    zones: [
      { zoneKey: "uaen-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "uaen-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "uaen-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "uaec",
    regionLabel: "UAE Central",
    zones: [
      { zoneKey: "uaec-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "ilc",
    regionLabel: "Israel Central",
    zones: [
      { zoneKey: "ilc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "ilc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "ilc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "qac",
    regionLabel: "Qatar Central",
    zones: [
      { zoneKey: "qac-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "qac-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "qac-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "mxc",
    regionLabel: "Mexico Central",
    zones: [
      { zoneKey: "mxc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "mxc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "mxc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "nzn",
    regionLabel: "New Zealand North",
    zones: [
      { zoneKey: "nzn-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "nzn-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "nzn-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "twn",
    regionLabel: "Taiwan North",
    zones: [
      { zoneKey: "twn-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "idc",
    regionLabel: "Indonesia Central",
    zones: [
      { zoneKey: "idc-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "idc-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "idc-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "dee",
    regionLabel: "Denmark East",
    zones: [
      { zoneKey: "dee-zone-1", providerLabel: "Zone 1", localityType: "az" },
      { zoneKey: "dee-zone-2", providerLabel: "Zone 2", localityType: "az" },
      { zoneKey: "dee-zone-3", providerLabel: "Zone 3", localityType: "az" }
    ]
  },
  {
    provider: "azure",
    regionKey: "maw",
    regionLabel: "Malaysia West",
    zones: [
      { zoneKey: "maw-zone-1", providerLabel: "Zone 1", localityType: "az" }
    ]
  }
];
var AZURE_REGIONS = AZURE_REGIONS_RAW.map((region) => {
  const armName = AZURE_ARM_REGION_NAMES[region.regionKey];
  if (!armName) return region;
  return {
    ...region,
    aliases: [...region.aliases ?? [], armName],
    // Register the Azure ARM-style zone identifier ("<armName>-<n>", e.g.
    // "eastus-1") as a resolvable alias for each canonical zone ("eus-zone-1").
    // This is the form Azure scenarios and ARM APIs use; the canonical zoneKey
    // and friendly providerLabel remain the stored/displayed values.
    zones: region.zones.map((zone) => {
      const zoneNumberMatch = zone.zoneKey.match(/-zone-(\d+)$/);
      if (!zoneNumberMatch) return zone;
      const armZoneAlias = `${armName}-${zoneNumberMatch[1]}`;
      return { ...zone, aliases: [...zone.aliases ?? [], armZoneAlias] };
    })
  };
});
var OCI_REGIONS_RAW = [
  {
    provider: "oci",
    regionKey: "iad",
    regionLabel: "us-ashburn-1",
    zones: [
      { zoneKey: "iad-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "iad-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "iad-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "phx",
    regionLabel: "us-phoenix-1",
    zones: [
      { zoneKey: "phx-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "phx-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "phx-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "sjc",
    regionLabel: "us-sanjose-1",
    zones: [
      { zoneKey: "sjc-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "ord",
    regionLabel: "us-chicago-1",
    zones: [
      { zoneKey: "ord-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "ord-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "ord-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "yyz",
    regionLabel: "ca-toronto-1",
    zones: [
      { zoneKey: "yyz-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "yyz-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "yyz-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "yul",
    regionLabel: "ca-montreal-1",
    zones: [
      { zoneKey: "yul-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "gru",
    regionLabel: "sa-saopaulo-1",
    zones: [
      { zoneKey: "gru-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "gru-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "gru-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "vcp",
    regionLabel: "sa-vinhedo-1",
    zones: [
      { zoneKey: "vcp-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "scl",
    regionLabel: "sa-santiago-1",
    zones: [
      { zoneKey: "scl-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "fra",
    regionLabel: "eu-frankfurt-1",
    zones: [
      { zoneKey: "fra-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "fra-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "fra-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "ams",
    regionLabel: "eu-amsterdam-1",
    zones: [
      { zoneKey: "ams-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "ams-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "ams-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "arn",
    regionLabel: "eu-stockholm-1",
    zones: [
      { zoneKey: "arn-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "mad",
    regionLabel: "eu-madrid-1",
    zones: [
      { zoneKey: "mad-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "mad-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "mad-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "cdg",
    regionLabel: "eu-paris-1",
    zones: [
      { zoneKey: "cdg-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "cdg-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "cdg-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "lin",
    regionLabel: "eu-milan-1",
    zones: [
      { zoneKey: "lin-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "mrs",
    regionLabel: "eu-marseille-1",
    zones: [
      { zoneKey: "mrs-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "lhr",
    regionLabel: "uk-london-1",
    zones: [
      { zoneKey: "lhr-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "lhr-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "lhr-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "cwl",
    regionLabel: "uk-cardiff-1",
    zones: [
      { zoneKey: "cwl-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "dxb",
    regionLabel: "me-dubai-1",
    zones: [
      { zoneKey: "dxb-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "auh",
    regionLabel: "me-abudhabi-1",
    zones: [
      { zoneKey: "auh-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "auh-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "auh-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "ruh",
    regionLabel: "me-riyadh-1",
    zones: [
      { zoneKey: "ruh-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "jed",
    regionLabel: "me-jeddah-1",
    zones: [
      { zoneKey: "jed-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "mtz",
    regionLabel: "il-jerusalem-1",
    zones: [
      { zoneKey: "mtz-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "jnb",
    regionLabel: "af-johannesburg-1",
    zones: [
      { zoneKey: "jnb-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "nrt",
    regionLabel: "ap-tokyo-1",
    zones: [
      { zoneKey: "nrt-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "nrt-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "nrt-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "kix",
    regionLabel: "ap-osaka-1",
    zones: [
      { zoneKey: "kix-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "kix-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "kix-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "icn",
    regionLabel: "ap-seoul-1",
    zones: [
      { zoneKey: "icn-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "icn-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "icn-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "yny",
    regionLabel: "ap-chuncheon-1",
    zones: [
      { zoneKey: "yny-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "bom",
    regionLabel: "ap-mumbai-1",
    zones: [
      { zoneKey: "bom-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "bom-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "bom-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "hyd",
    regionLabel: "ap-hyderabad-1",
    zones: [
      { zoneKey: "hyd-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "hyd-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "hyd-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "sin",
    regionLabel: "ap-singapore-1",
    zones: [
      { zoneKey: "sin-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "sin-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "sin-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "xsp",
    regionLabel: "ap-singapore-2",
    zones: [
      { zoneKey: "xsp-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "syd",
    regionLabel: "ap-sydney-1",
    zones: [
      { zoneKey: "syd-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "syd-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "syd-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "mel",
    regionLabel: "ap-melbourne-1",
    zones: [
      { zoneKey: "mel-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "mel-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "mel-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "qro",
    regionLabel: "mx-queretaro-1",
    zones: [
      { zoneKey: "qro-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "qro-ad-2", providerLabel: "AD-2", localityType: "availability_domain", faultDomainKey: "fd-1" },
      { zoneKey: "qro-ad-3", providerLabel: "AD-3", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "mty",
    regionLabel: "mx-monterrey-1",
    zones: [
      { zoneKey: "mty-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "beg",
    regionLabel: "eu-jovanovac-1",
    zones: [
      { zoneKey: "beg-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "lej",
    regionLabel: "af-casablanca-1",
    zones: [
      { zoneKey: "lej-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "hsg",
    regionLabel: "ap-batam-1",
    zones: [
      { zoneKey: "hsg-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "nja",
    regionLabel: "ap-chiyoda-1",
    zones: [
      { zoneKey: "nja-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "bno",
    regionLabel: "ap-chuncheon-2",
    zones: [
      { zoneKey: "bno-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "onm",
    regionLabel: "ap-delhi-1",
    zones: [
      { zoneKey: "onm-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "ukb",
    regionLabel: "ap-ibaraki-1",
    zones: [
      { zoneKey: "ukb-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "jbp",
    regionLabel: "ap-kulai-2",
    zones: [
      { zoneKey: "jbp-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "dtz",
    regionLabel: "ap-seoul-2",
    zones: [
      { zoneKey: "dtz-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "dln",
    regionLabel: "ap-suwon-1",
    zones: [
      { zoneKey: "dln-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "jsk",
    regionLabel: "eu-budapest-1",
    zones: [
      { zoneKey: "jsk-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "avf",
    regionLabel: "eu-crissier-1",
    zones: [
      { zoneKey: "avf-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "str",
    regionLabel: "eu-frankfurt-2",
    zones: [
      { zoneKey: "str-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "vll",
    regionLabel: "eu-madrid-2",
    zones: [
      { zoneKey: "vll-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "orf",
    regionLabel: "eu-madrid-3",
    zones: [
      { zoneKey: "orf-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "nrq",
    regionLabel: "eu-turin-1",
    zones: [
      { zoneKey: "nrq-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "zrh",
    regionLabel: "eu-zurich-1",
    zones: [
      { zoneKey: "zrh-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "rkt",
    regionLabel: "me-abudhabi-2",
    zones: [
      { zoneKey: "rkt-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "ahu",
    regionLabel: "me-abudhabi-3",
    zones: [
      { zoneKey: "ahu-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "shj",
    regionLabel: "me-abudhabi-4",
    zones: [
      { zoneKey: "shj-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "rba",
    regionLabel: "me-alain-1",
    zones: [
      { zoneKey: "rba-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "vve",
    regionLabel: "me-alrayyan-1",
    zones: [
      { zoneKey: "vve-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "ibr",
    regionLabel: "me-ibri-1",
    zones: [
      { zoneKey: "ibr-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "bog",
    regionLabel: "sa-bogota-1",
    zones: [
      { zoneKey: "bog-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "hnw",
    regionLabel: "sa-riodejaneiro-1",
    zones: [
      { zoneKey: "hnw-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "vap",
    regionLabel: "sa-valparaiso-1",
    zones: [
      { zoneKey: "vap-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "yxj",
    regionLabel: "us-ashburn-2",
    zones: [
      { zoneKey: "yxj-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "pgc",
    regionLabel: "us-newark-1",
    zones: [
      { zoneKey: "pgc-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "aga",
    regionLabel: "us-saltlake-2",
    zones: [
      { zoneKey: "aga-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "ebb",
    regionLabel: "us-somerset-1",
    zones: [
      { zoneKey: "ebb-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  },
  {
    provider: "oci",
    regionKey: "ebl",
    regionLabel: "us-thames-1",
    zones: [
      { zoneKey: "ebl-ad-1", providerLabel: "AD-1", localityType: "availability_domain", faultDomainKey: "fd-1" }
    ]
  }
];
var OCI_REGIONS = OCI_REGIONS_RAW.map((region) => ({
  ...region,
  zones: region.zones.map((zone) => {
    const adNumberMatch = zone.zoneKey.match(/-ad-(\d+)$/);
    if (!adNumberMatch) return zone;
    const nativeZoneAlias = `${region.regionLabel}-ad-${adNumberMatch[1]}`;
    return { ...zone, aliases: [...zone.aliases ?? [], nativeZoneAlias] };
  })
}));
var DIGITALOCEAN_REGIONS = [
  {
    provider: "digitalocean",
    regionKey: "nyc1",
    regionLabel: "nyc1",
    zones: [
      { zoneKey: "nyc1-az1", providerLabel: "nyc1 (New York 1)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "nyc3",
    regionLabel: "nyc3",
    zones: [
      { zoneKey: "nyc3-az1", providerLabel: "nyc3 (New York 3)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "sfo3",
    regionLabel: "sfo3",
    zones: [
      { zoneKey: "sfo3-az1", providerLabel: "sfo3 (San Francisco 3)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "ams3",
    regionLabel: "ams3",
    zones: [
      { zoneKey: "ams3-az1", providerLabel: "ams3 (Amsterdam 3)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "fra1",
    regionLabel: "fra1",
    zones: [
      { zoneKey: "fra1-az1", providerLabel: "fra1 (Frankfurt 1)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "lon1",
    regionLabel: "lon1",
    zones: [
      { zoneKey: "lon1-az1", providerLabel: "lon1 (London 1)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "sgp1",
    regionLabel: "sgp1",
    zones: [
      { zoneKey: "sgp1-az1", providerLabel: "sgp1 (Singapore 1)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "blr1",
    regionLabel: "blr1",
    zones: [
      { zoneKey: "blr1-az1", providerLabel: "blr1 (Bangalore 1)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "tor1",
    regionLabel: "tor1",
    zones: [
      { zoneKey: "tor1-az1", providerLabel: "tor1 (Toronto 1)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "syd1",
    regionLabel: "syd1",
    zones: [
      { zoneKey: "syd1-az1", providerLabel: "syd1 (Sydney 1)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "mkc1",
    regionLabel: "mkc1",
    zones: [
      { zoneKey: "mkc1-az1", providerLabel: "mkc1 (Kansas City 1)", localityType: "az" }
    ]
  },
  {
    provider: "digitalocean",
    regionKey: "mem1",
    regionLabel: "mem1",
    zones: [
      { zoneKey: "mem1-az1", providerLabel: "mem1 (Memphis 1)", localityType: "az" }
    ]
  }
];
var ALL_REGION_MAPPINGS = [
  ...AWS_REGIONS,
  ...GCP_REGIONS,
  ...AZURE_REGIONS,
  ...OCI_REGIONS,
  ...DIGITALOCEAN_REGIONS
];

// ../shared/aws-variable-pricing.ts
var FARGATE_RATES = {
  X86_64: { vcpu: 0.04048, memoryGiB: 4445e-6 },
  ARM64: { vcpu: 0.03238, memoryGiB: 356e-5 }
};

// ../shared/provider-sizes.ts
var GCP_PREDICTION_STANDARD_SHAPES = [
  ...[2, 4, 8, 16, 32].map((vcpus) => ({
    label: `e2-standard-${vcpus}`,
    vcpus,
    ram: vcpus * 4
  })),
  ...[1, 2, 4, 8, 16, 32, 64, 96].map((vcpus) => ({
    label: `n1-standard-${vcpus}`,
    vcpus,
    ram: vcpus * 3.75
  })),
  ...[16, 32, 48, 64, 80, 96, 128].map((vcpus) => ({
    label: `n2-standard-${vcpus}`,
    vcpus,
    ram: vcpus * 4
  }))
];
var OCI_FLEX_SHAPE_RULES = {
  E3: { shapeName: "VM.Standard.E3.Flex", minOcpus: 1, maxOcpus: 64, vcpusPerOcpu: 2 },
  E4: { shapeName: "VM.Standard.E4.Flex", minOcpus: 1, maxOcpus: 64, vcpusPerOcpu: 2 },
  E5: { shapeName: "VM.Standard.E5.Flex", minOcpus: 1, maxOcpus: 126, vcpusPerOcpu: 2 },
  Standard3: { shapeName: "VM.Standard3.Flex", minOcpus: 1, maxOcpus: 32, vcpusPerOcpu: 2 },
  A1: { shapeName: "VM.Standard.A1.Flex", minOcpus: 1, maxOcpus: 76, vcpusPerOcpu: 1 }
};
function resolveOciFlexOcpus(size, name, ocpus) {
  if (typeof size === "string" && size.length > 0) {
    const base = /^(VM\.[^(]+?)\s*\((\d+)\s*OCPU\)$/i.exec(size)?.[1] ?? size;
    if (!Object.values(OCI_FLEX_SHAPE_RULES).some((rule2) => rule2.shapeName.toLowerCase() === base.toLowerCase())) {
      return void 0;
    }
  }
  const values = [size, name].filter((value) => typeof value === "string");
  let family;
  const counts = [];
  for (const value of values) {
    const countMatch = /^(VM\.[^(]+?)\s*\((\d+)\s*OCPU\)$/i.exec(value);
    const candidate = (countMatch?.[1] ?? value).toLowerCase();
    for (const [candidateFamily, rule2] of Object.entries(OCI_FLEX_SHAPE_RULES)) {
      if (rule2.shapeName.toLowerCase() === candidate) {
        if (family && family !== candidateFamily) {
          return { ok: false, family, message: "Conflicting OCI Flex shape identifiers." };
        }
        family = candidateFamily;
        if (countMatch) counts.push(Number(countMatch[2]));
        break;
      }
    }
  }
  if (!family) return void 0;
  const rule = OCI_FLEX_SHAPE_RULES[family];
  if (counts.some((count) => !Number.isInteger(count) || count < rule.minOcpus || count > rule.maxOcpus)) {
    return { ok: false, family, message: `${family} Flex OCPU count must be an integer from ${rule.minOcpus} to ${rule.maxOcpus}.` };
  }
  if (ocpus !== void 0 && (typeof ocpus !== "number" || !Number.isInteger(ocpus) || ocpus < rule.minOcpus || ocpus > rule.maxOcpus)) {
    return { ok: false, family, message: `${family} Flex characteristics.ocpus must be an integer from ${rule.minOcpus} to ${rule.maxOcpus}.` };
  }
  if (new Set(counts).size > 1) {
    return { ok: false, family, message: "Conflicting OCI Flex OCPU counts in shape identifiers." };
  }
  const nameCount = counts[0];
  if (ocpus !== void 0 && nameCount !== void 0 && ocpus !== nameCount) {
    return { ok: false, family, message: `Conflicting OCI Flex sizing: characteristics.ocpus (${ocpus}) does not match the size count (${nameCount}).` };
  }
  return { ok: true, family, ocpus: ocpus ?? nameCount, vcpusPerOcpu: rule.vcpusPerOcpu };
}
var AWS_RDS_SQLSERVER_SIZES = Object.entries(RDS_SQLSERVER_CATALOG).map(([label, shape]) => ({
  label,
  multiplier: shape.hourlyRate / AWS_BASE_RATES.database,
  maxConnections: label === "db.t3.micro" ? 50 : 100,
  vcpus: shape.vcpus,
  ram: shape.ramGiB,
  tier: "SQL Server Express \xB7 Single-AZ",
  detail: `${shape.vcpus} vCPU \xB7 ${shape.ramGiB} GiB \xB7 $${shape.hourlyRate.toFixed(3)}/hr instance only; credits/storage extra`
}));
var c4Multiplier = (vcpus, ramGb) => gcpC4HourlyRate(vcpus, ramGb) / GCP_BASE_RATES.compute;
var c4Detail = (vcpus, ramGb) => `${vcpus} vCPU \xB7 ${ramGb} GB \xB7 $${gcpC4HourlyRate(vcpus, ramGb).toFixed(6)}/hr`;
var FARGATE_VCPU_HOUR_RATE = FARGATE_RATES.X86_64.vcpu;
var FARGATE_MEMORY_GIB_HOUR_RATE = FARGATE_RATES.X86_64.memoryGiB;
var inclusiveRange = (start, end, step) => {
  const values = [];
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
};
var AWS_FARGATE_TASK_SIZES = [
  { cpu: 0.25, memory: [0.5, 1, 2] },
  { cpu: 0.5, memory: inclusiveRange(1, 4, 1) },
  { cpu: 1, memory: inclusiveRange(2, 8, 1) },
  { cpu: 2, memory: inclusiveRange(4, 16, 1) },
  { cpu: 4, memory: inclusiveRange(8, 30, 1) },
  { cpu: 8, memory: inclusiveRange(16, 60, 4) },
  { cpu: 16, memory: inclusiveRange(32, 120, 8) }
].flatMap(({ cpu, memory }) => memory.map((ram) => {
  const hourly = cpu * FARGATE_VCPU_HOUR_RATE + ram * FARGATE_MEMORY_GIB_HOUR_RATE;
  return {
    label: `${cpu} vCPU / ${ram} GB`,
    multiplier: 1,
    maxThroughput: cpu * 400,
    vcpus: cpu,
    ram,
    tier: "Fargate task",
    detail: `${cpu} vCPU \xB7 ${ram} GB \xB7 $${hourly.toFixed(3)}/hr per task`
  };
}));
var GCP_COMPUTE_SIZES = [
  { label: "e2-micro", tier: "General Purpose", multiplier: 0.2, maxThroughput: 400, vcpus: 0.25, ram: 1, detail: "0.25 vCPU \xB7 1 GB \xB7 ~$0.007/hr" },
  { label: "e2-medium", tier: "General Purpose", multiplier: 0.5, maxThroughput: 1e3, vcpus: 1, ram: 4, detail: "1 vCPU \xB7 4 GB \xB7 ~$0.034/hr" },
  { label: "n2-standard-2", tier: "General Purpose", multiplier: 1, maxThroughput: 3e3, vcpus: 2, ram: 8, detail: "2 vCPU \xB7 8 GB \xB7 ~$0.097/hr" },
  { label: "n2-standard-4", tier: "General Purpose", multiplier: 2, maxThroughput: 6e3, vcpus: 4, ram: 16, detail: "4 vCPU \xB7 16 GB \xB7 ~$0.194/hr" },
  { label: "n2-standard-8", tier: "General Purpose", multiplier: 4, maxThroughput: 12e3, vcpus: 8, ram: 32, detail: "8 vCPU \xB7 32 GB \xB7 ~$0.388/hr" },
  { label: "n2d-standard-2", tier: "General Purpose (AMD)", multiplier: 0.85, maxThroughput: 3300, vcpus: 2, ram: 8, detail: "2 vCPU \xB7 8 GB \xB7 ~$0.085/hr" },
  { label: "n2d-standard-4", tier: "General Purpose (AMD)", multiplier: 1.7, maxThroughput: 6600, vcpus: 4, ram: 16, detail: "4 vCPU \xB7 16 GB \xB7 ~$0.170/hr" },
  { label: "n2d-standard-8", tier: "General Purpose (AMD)", multiplier: 3.4, maxThroughput: 13e3, vcpus: 8, ram: 32, detail: "8 vCPU \xB7 32 GB \xB7 ~$0.340/hr" },
  { label: "c2-standard-4", tier: "Compute Optimized", multiplier: 2.5, maxThroughput: 8e3, vcpus: 4, ram: 16, detail: "4 vCPU \xB7 16 GB \xB7 ~$0.209/hr" },
  { label: "c2-standard-8", tier: "Compute Optimized", multiplier: 5, maxThroughput: 16e3, vcpus: 8, ram: 32, detail: "8 vCPU \xB7 32 GB \xB7 ~$0.417/hr" },
  // ── C4 Standard — Sapphire Rapids, us-central1 on-demand ────────────────
  { label: "c4-standard-2", tier: "C4 Standard", multiplier: c4Multiplier(2, 8), maxThroughput: 3e3, vcpus: 2, ram: 8, detail: c4Detail(2, 8) },
  { label: "c4-standard-4", tier: "C4 Standard", multiplier: c4Multiplier(4, 15), maxThroughput: 6e3, vcpus: 4, ram: 15, detail: c4Detail(4, 15) },
  { label: "c4-standard-8", tier: "C4 Standard", multiplier: c4Multiplier(8, 30), maxThroughput: 12e3, vcpus: 8, ram: 30, detail: c4Detail(8, 30) },
  { label: "c4-standard-16", tier: "C4 Standard", multiplier: c4Multiplier(16, 60), maxThroughput: 24e3, vcpus: 16, ram: 60, detail: c4Detail(16, 60) },
  { label: "c4-standard-24", tier: "C4 Standard", multiplier: c4Multiplier(24, 90), maxThroughput: 36e3, vcpus: 24, ram: 90, detail: c4Detail(24, 90) },
  { label: "c4-standard-32", tier: "C4 Standard", multiplier: c4Multiplier(32, 120), maxThroughput: 48e3, vcpus: 32, ram: 120, detail: c4Detail(32, 120) },
  { label: "c4-standard-48", tier: "C4 Standard", multiplier: c4Multiplier(48, 180), maxThroughput: 72e3, vcpus: 48, ram: 180, detail: c4Detail(48, 180) },
  { label: "c4-standard-96", tier: "C4 Standard", multiplier: c4Multiplier(96, 360), maxThroughput: 144e3, vcpus: 96, ram: 360, detail: c4Detail(96, 360) },
  { label: "c4-standard-144", tier: "C4 Standard", multiplier: c4Multiplier(144, 540), maxThroughput: 216e3, vcpus: 144, ram: 540, detail: c4Detail(144, 540) },
  { label: "c4-standard-192", tier: "C4 Standard", multiplier: c4Multiplier(192, 720), maxThroughput: 288e3, vcpus: 192, ram: 720, detail: c4Detail(192, 720) },
  { label: "c4-standard-288", tier: "C4 Standard", multiplier: c4Multiplier(288, 1080), maxThroughput: 432e3, vcpus: 288, ram: 1080, detail: c4Detail(288, 1080) },
  // ── C4 High CPU ─────────────────────────────────────────────────────────
  { label: "c4-highcpu-2", tier: "C4 High CPU", multiplier: c4Multiplier(2, 4), maxThroughput: 3600, vcpus: 2, ram: 4, detail: c4Detail(2, 4) },
  { label: "c4-highcpu-4", tier: "C4 High CPU", multiplier: c4Multiplier(4, 8), maxThroughput: 7200, vcpus: 4, ram: 8, detail: c4Detail(4, 8) },
  { label: "c4-highcpu-8", tier: "C4 High CPU", multiplier: c4Multiplier(8, 16), maxThroughput: 14400, vcpus: 8, ram: 16, detail: c4Detail(8, 16) },
  { label: "c4-highcpu-16", tier: "C4 High CPU", multiplier: c4Multiplier(16, 32), maxThroughput: 28800, vcpus: 16, ram: 32, detail: c4Detail(16, 32) },
  { label: "c4-highcpu-24", tier: "C4 High CPU", multiplier: c4Multiplier(24, 48), maxThroughput: 43200, vcpus: 24, ram: 48, detail: c4Detail(24, 48) },
  { label: "c4-highcpu-32", tier: "C4 High CPU", multiplier: c4Multiplier(32, 64), maxThroughput: 57600, vcpus: 32, ram: 64, detail: c4Detail(32, 64) },
  { label: "c4-highcpu-48", tier: "C4 High CPU", multiplier: c4Multiplier(48, 96), maxThroughput: 86400, vcpus: 48, ram: 96, detail: c4Detail(48, 96) },
  { label: "c4-highcpu-96", tier: "C4 High CPU", multiplier: c4Multiplier(96, 192), maxThroughput: 172800, vcpus: 96, ram: 192, detail: c4Detail(96, 192) },
  { label: "c4-highcpu-144", tier: "C4 High CPU", multiplier: c4Multiplier(144, 288), maxThroughput: 259200, vcpus: 144, ram: 288, detail: c4Detail(144, 288) },
  { label: "c4-highcpu-192", tier: "C4 High CPU", multiplier: c4Multiplier(192, 384), maxThroughput: 345600, vcpus: 192, ram: 384, detail: c4Detail(192, 384) },
  { label: "c4-highcpu-288", tier: "C4 High CPU", multiplier: c4Multiplier(288, 576), maxThroughput: 518400, vcpus: 288, ram: 576, detail: c4Detail(288, 576) },
  // ── C4 High Memory ──────────────────────────────────────────────────────
  { label: "c4-highmem-2", tier: "C4 High Memory", multiplier: c4Multiplier(2, 16), maxThroughput: 2400, vcpus: 2, ram: 16, detail: c4Detail(2, 16) },
  { label: "c4-highmem-4", tier: "C4 High Memory", multiplier: c4Multiplier(4, 32), maxThroughput: 4800, vcpus: 4, ram: 32, detail: c4Detail(4, 32) },
  { label: "c4-highmem-8", tier: "C4 High Memory", multiplier: c4Multiplier(8, 64), maxThroughput: 9600, vcpus: 8, ram: 64, detail: c4Detail(8, 64) },
  { label: "c4-highmem-16", tier: "C4 High Memory", multiplier: c4Multiplier(16, 128), maxThroughput: 19200, vcpus: 16, ram: 128, detail: c4Detail(16, 128) },
  { label: "c4-highmem-24", tier: "C4 High Memory", multiplier: c4Multiplier(24, 192), maxThroughput: 28800, vcpus: 24, ram: 192, detail: c4Detail(24, 192) },
  { label: "c4-highmem-32", tier: "C4 High Memory", multiplier: c4Multiplier(32, 256), maxThroughput: 38400, vcpus: 32, ram: 256, detail: c4Detail(32, 256) },
  { label: "c4-highmem-48", tier: "C4 High Memory", multiplier: c4Multiplier(48, 384), maxThroughput: 57600, vcpus: 48, ram: 384, detail: c4Detail(48, 384) },
  { label: "c4-highmem-96", tier: "C4 High Memory", multiplier: c4Multiplier(96, 768), maxThroughput: 115200, vcpus: 96, ram: 768, detail: c4Detail(96, 768) },
  { label: "c4-highmem-144", tier: "C4 High Memory", multiplier: c4Multiplier(144, 1152), maxThroughput: 172800, vcpus: 144, ram: 1152, detail: c4Detail(144, 1152) },
  { label: "c4-highmem-192", tier: "C4 High Memory", multiplier: c4Multiplier(192, 1536), maxThroughput: 230400, vcpus: 192, ram: 1536, detail: c4Detail(192, 1536) },
  { label: "c4-highmem-288", tier: "C4 High Memory", multiplier: c4Multiplier(288, 2304), maxThroughput: 345600, vcpus: 288, ram: 2304, detail: c4Detail(288, 2304) },
  // ── Large GPU (multi-GPU nodes) — A2 family, us-central1 on-demand, Aug 2026 ──
  { label: "a2-highgpu-4g", tier: "Large GPU (multi-GPU)", multiplier: 146.9, maxThroughput: 12e3, vcpus: 48, ram: 340, detail: "4\xD7 A100 40GB \xB7 48 vCPU \xB7 340 GB \xB7 $14.69/hr" },
  { label: "a2-highgpu-8g", tier: "Large GPU (multi-GPU)", multiplier: 293.9, maxThroughput: 16e3, vcpus: 96, ram: 680, detail: "8\xD7 A100 40GB \xB7 96 vCPU \xB7 680 GB \xB7 $29.39/hr" },
  { label: "a2-megagpu-16g", tier: "Large GPU (multi-GPU)", multiplier: 557.4, maxThroughput: 2e4, vcpus: 96, ram: 1360, detail: "16\xD7 A100 40GB \xB7 96 vCPU \xB7 1360 GB \xB7 $55.74/hr" },
  // ── Large GPU (multi-GPU nodes) — A3 family (H100), us-central1 on-demand, Aug 2026 ──
  { label: "a3-highgpu-8g", tier: "Large GPU (multi-GPU)", multiplier: 331.9, maxThroughput: 18e3, vcpus: 208, ram: 1872, detail: "8\xD7 H100 80GB \xB7 208 vCPU \xB7 1872 GB \xB7 $33.19/hr" },
  { label: "a3-megagpu-8g", tier: "Large GPU (multi-GPU)", multiplier: 594.1, maxThroughput: 2e4, vcpus: 208, ram: 1872, detail: "8\xD7 H100 80GB SXM5 + NVSwitch \xB7 208 vCPU \xB7 $59.41/hr" }
];
var AZURE_SQL_SIZES = [
  // ── DTU-Based ───────────────────────────────────────────────────────────────
  { label: "Basic", multiplier: 0.3, maxConnections: 30, vcpus: 1, ram: 2, tier: "DTU-Based", detail: "5 DTU \xB7 2 GB \xB7 $0.007/hr \xB7 ~$5/mo" },
  { label: "S0 Standard", multiplier: 0.6, maxConnections: 100, vcpus: 1, ram: 2, tier: "DTU-Based", detail: "10 DTU \xB7 2 GB \xB7 $0.021/hr \xB7 ~$15/mo" },
  { label: "S2 Standard", multiplier: 1, maxConnections: 300, vcpus: 2, ram: 4, tier: "DTU-Based", detail: "50 DTU \xB7 4 GB \xB7 $0.075/hr \xB7 ~$55/mo" },
  { label: "S4 Standard", multiplier: 2.69, maxConnections: 800, vcpus: 2, ram: 4, tier: "DTU-Based", detail: "200 DTU \xB7 4 GB \xB7 $0.202/hr \xB7 ~$148/mo" },
  // ── vCore General Purpose (Gen5) ────────────────────────────────────────────
  { label: "GP_Gen5_2", multiplier: 2, maxConnections: 600, vcpus: 2, ram: 10.2, tier: "vCore General Purpose", detail: "2 vCPU \xB7 10.2 GB \xB7 $0.374/hr \xB7 ~$273/mo" },
  { label: "GP_Gen5_4", multiplier: 3.5, maxConnections: 1200, vcpus: 4, ram: 20.4, tier: "vCore General Purpose", detail: "4 vCPU \xB7 20.4 GB \xB7 $0.748/hr \xB7 ~$546/mo" },
  { label: "GP_Gen5_8", multiplier: 12.1, maxConnections: 2500, vcpus: 8, ram: 40.8, tier: "vCore General Purpose", detail: "8 vCPU \xB7 40.8 GB \xB7 $0.908/hr \xB7 ~$663/mo" },
  // ── vCore Hyperscale (Gen5) — distributed storage, rapid scale-out ──────────
  { label: "HS_Gen5_2", multiplier: 4.38, maxConnections: 600, vcpus: 2, ram: 10.2, tier: "vCore Hyperscale", detail: "2 vCPU \xB7 10.2 GB \xB7 $0.329/hr \xB7 ~$240/mo" },
  { label: "HS_Gen5_4", multiplier: 8.76, maxConnections: 1200, vcpus: 4, ram: 20.4, tier: "vCore Hyperscale", detail: "4 vCPU \xB7 20.4 GB \xB7 $0.657/hr \xB7 ~$480/mo" },
  { label: "HS_Gen5_8", multiplier: 17.52, maxConnections: 2500, vcpus: 8, ram: 40.8, tier: "vCore Hyperscale", detail: "8 vCPU \xB7 40.8 GB \xB7 $1.314/hr \xB7 ~$959/mo" },
  // ── vCore Business Critical (Gen5) — local SSD RAID, in-memory OLTP ─────────
  { label: "BC_Gen5_2", multiplier: 8.37, maxConnections: 800, vcpus: 2, ram: 10.2, tier: "vCore Business Critical", detail: "2 vCPU \xB7 10.2 GB \xB7 $0.628/hr \xB7 ~$459/mo" },
  { label: "BC_Gen5_4", multiplier: 16.73, maxConnections: 1600, vcpus: 4, ram: 20.4, tier: "vCore Business Critical", detail: "4 vCPU \xB7 20.4 GB \xB7 $1.255/hr \xB7 ~$917/mo" },
  { label: "BC_Gen5_8", multiplier: 33.46, maxConnections: 3200, vcpus: 8, ram: 40.8, tier: "vCore Business Critical", detail: "8 vCPU \xB7 40.8 GB \xB7 $2.510/hr \xB7 ~$1,833/mo" },
  // ── Managed Instance General Purpose (Gen5) — isolated VNet, full SQL Agent ──
  { label: "MI_GP_Gen5_4", multiplier: 8.12, maxConnections: 1500, vcpus: 4, ram: 20.4, tier: "Managed Instance GP", detail: "4 vCPU \xB7 20.4 GB \xB7 $0.609/hr \xB7 ~$444/mo" },
  { label: "MI_GP_Gen5_8", multiplier: 16.24, maxConnections: 3e3, vcpus: 8, ram: 40.8, tier: "Managed Instance GP", detail: "8 vCPU \xB7 40.8 GB \xB7 $1.218/hr \xB7 ~$889/mo" },
  { label: "MI_GP_Gen5_16", multiplier: 32.47, maxConnections: 6e3, vcpus: 16, ram: 81.6, tier: "Managed Instance GP", detail: "16 vCPU \xB7 81.6 GB \xB7 $2.435/hr \xB7 ~$1,778/mo" },
  // ── Managed Instance Business Critical (Gen5) — local SSD, in-memory OLTP ───
  { label: "MI_BC_Gen5_4", multiplier: 16.24, maxConnections: 2e3, vcpus: 4, ram: 20.4, tier: "Managed Instance BC", detail: "4 vCPU \xB7 20.4 GB \xB7 $1.218/hr \xB7 ~$889/mo" },
  { label: "MI_BC_Gen5_8", multiplier: 32.47, maxConnections: 4e3, vcpus: 8, ram: 40.8, tier: "Managed Instance BC", detail: "8 vCPU \xB7 40.8 GB \xB7 $2.435/hr \xB7 ~$1,778/mo" },
  { label: "MI_BC_Gen5_16", multiplier: 64.95, maxConnections: 8e3, vcpus: 16, ram: 81.6, tier: "Managed Instance BC", detail: "16 vCPU \xB7 81.6 GB \xB7 $4.871/hr \xB7 ~$3,556/mo" }
];
var AZURE_SQL_MI_SIZES = AZURE_SQL_SIZES.filter(
  (s) => s.tier === "Managed Instance GP" || s.tier === "Managed Instance BC"
);
var AZURE_APP_SERVICE_SIZES = [
  { label: "B1", tier: "Basic", multiplier: AZURE_COST_MULTIPLIERS.appServiceB1, maxThroughput: 500, vcpus: 1, ram: 1.75, detail: "1 vCPU \xB7 1.75 GB \xB7 $0.017/hr \xB7 ~$12/mo" },
  { label: "B2", tier: "Basic", multiplier: AZURE_COST_MULTIPLIERS.appServiceB2, maxThroughput: 1e3, vcpus: 2, ram: 3.5, detail: "2 vCPU \xB7 3.5 GB \xB7 $0.034/hr \xB7 ~$25/mo" },
  { label: "S1", tier: "Standard", multiplier: AZURE_COST_MULTIPLIERS.appServiceS1, maxThroughput: 1200, vcpus: 1, ram: 1.75, detail: "1 vCPU \xB7 1.75 GB \xB7 auto-scale \xB7 $0.095/hr \xB7 ~$69/mo" },
  { label: "P1v3", tier: "Premium v3", multiplier: AZURE_COST_MULTIPLIERS.appServiceP1v3, maxThroughput: 3e3, vcpus: 2, ram: 8, detail: "2 vCPU \xB7 8 GB \xB7 $0.155/hr \xB7 ~$113/mo" }
];
var AZURE_POSTGRES_FLEX_SIZES = [
  { label: "B1ms", tier: "Burstable", multiplier: AZURE_COST_MULTIPLIERS.postgresFlexB1ms, maxConnections: 50, vcpus: 1, ram: 2, detail: "1 vCore \xB7 2 GB \xB7 $0.0175/hr \xB7 ~$13/mo" },
  { label: "D4s_v3", tier: "General Purpose", multiplier: AZURE_COST_MULTIPLIERS.postgresFlexD4s, maxConnections: 500, vcpus: 4, ram: 16, detail: "4 vCore \xB7 16 GB \xB7 $0.337/hr \xB7 ~$246/mo" }
];
var DO_APP_PLATFORM_SIZES = [
  { label: "basic-xxs", tier: "Basic", multiplier: DO_COST_MULTIPLIERS.appPlatformBasic, maxThroughput: 500, vcpus: 1, ram: 1, detail: "1 vCPU \xB7 1 GB \xB7 $0.0164/hr \xB7 $12/mo" },
  { label: "professional-xs", tier: "Professional", multiplier: DO_COST_MULTIPLIERS.appPlatformPro, maxThroughput: 1500, vcpus: 2, ram: 2, detail: "2 vCPU \xB7 2 GB \xB7 $0.0342/hr \xB7 $25/mo" }
];
var EC2_SIZES = [
  // ── Burstable (T-family) ─────────────────────────────────────────────────
  { label: "t2.micro", tier: "Burstable", multiplier: 0.12, maxThroughput: 300, vcpus: 1, ram: 1, detail: "1 vCPU \xB7 1 GB \xB7 $0.012/hr" },
  // AWS EC2 on-demand Linux, us-east-1 (AWS Pricing Calculator, August 2026).
  { label: "t3.micro", tier: "Burstable", multiplier: 0.108333, maxThroughput: 350, vcpus: 2, ram: 1, detail: "2 vCPU \xB7 1 GB \xB7 $0.0104/hr" },
  { label: "t3.small", tier: "Burstable", multiplier: 0.216667, maxThroughput: 700, vcpus: 2, ram: 2, detail: "2 vCPU \xB7 2 GB \xB7 $0.0208/hr" },
  { label: "t3.medium", tier: "Burstable", multiplier: 0.433333, maxThroughput: 1400, vcpus: 2, ram: 4, detail: "2 vCPU \xB7 4 GB \xB7 $0.0416/hr" },
  { label: "t3.large", tier: "Burstable", multiplier: 0.866667, maxThroughput: 2800, vcpus: 2, ram: 8, detail: "2 vCPU \xB7 8 GB \xB7 $0.0832/hr" },
  { label: "t3.xlarge", tier: "Burstable", multiplier: 1.733333, maxThroughput: 5600, vcpus: 4, ram: 16, detail: "4 vCPU \xB7 16 GB \xB7 $0.1664/hr" },
  // ── General Purpose (M5) ────────────────────────────────────────────────
  { label: "m5.large", tier: "General Purpose", multiplier: 1, maxThroughput: 2e3, vcpus: 2, ram: 8, detail: "2 vCPU \xB7 8 GB \xB7 $0.096/hr" },
  { label: "m5.xlarge", tier: "General Purpose", multiplier: 2, maxThroughput: 5e3, vcpus: 4, ram: 16, detail: "4 vCPU \xB7 16 GB \xB7 $0.192/hr" },
  { label: "m5.2xlarge", tier: "General Purpose", multiplier: 4, maxThroughput: 1e4, vcpus: 8, ram: 32, detail: "8 vCPU \xB7 32 GB \xB7 $0.384/hr" },
  // ── General Purpose (M6i — Ice Lake, ~10% better perf vs M5) ────────────
  { label: "m6i.large", tier: "General Purpose", multiplier: 1, maxThroughput: 2200, vcpus: 2, ram: 8, detail: "2 vCPU \xB7 8 GB \xB7 $0.096/hr" },
  { label: "m6i.xlarge", tier: "General Purpose", multiplier: 2, maxThroughput: 5500, vcpus: 4, ram: 16, detail: "4 vCPU \xB7 16 GB \xB7 $0.192/hr" },
  { label: "m6i.2xlarge", tier: "General Purpose (M6i)", multiplier: 4, maxThroughput: 11e3, vcpus: 8, ram: 32, detail: "8 vCPU \xB7 32 GB \xB7 $0.384/hr" },
  { label: "m6i.4xlarge", tier: "General Purpose (M6i)", multiplier: 8, maxThroughput: 22e3, vcpus: 16, ram: 64, detail: "16 vCPU \xB7 64 GB \xB7 $0.768/hr" },
  { label: "m6i.8xlarge", tier: "General Purpose (M6i)", multiplier: 16, maxThroughput: 44e3, vcpus: 32, ram: 128, detail: "32 vCPU \xB7 128 GB \xB7 $1.536/hr" },
  { label: "m6i.12xlarge", tier: "General Purpose (M6i)", multiplier: 24, maxThroughput: 66e3, vcpus: 48, ram: 192, detail: "48 vCPU \xB7 192 GB \xB7 $2.304/hr" },
  { label: "m6i.16xlarge", tier: "General Purpose (M6i)", multiplier: 32, maxThroughput: 88e3, vcpus: 64, ram: 256, detail: "64 vCPU \xB7 256 GB \xB7 $3.072/hr" },
  { label: "m6i.24xlarge", tier: "General Purpose (M6i)", multiplier: 48, maxThroughput: 132e3, vcpus: 96, ram: 384, detail: "96 vCPU \xB7 384 GB \xB7 $4.608/hr" },
  { label: "m6i.32xlarge", tier: "General Purpose (M6i)", multiplier: 64, maxThroughput: 176e3, vcpus: 128, ram: 512, detail: "128 vCPU \xB7 512 GB \xB7 $6.144/hr" },
  // ── General Purpose (M7 — AMD, Graviton3, local-NVMe, Intel) ─────────────
  // Derive all M7 fields from the canonical pricing catalog.
  ...AWS_EC2_M7_CATALOG.map(({ label, multiplier, maxThroughput, vcpus, ram, tier, detail }) => ({
    label,
    tier,
    multiplier,
    maxThroughput,
    vcpus,
    ram,
    detail
  })),
  // ── General Purpose (M8 — complete AWS Price List API catalog) ───────────
  ...AWS_EC2_M8_CATALOG.map(({ label, multiplier, maxThroughput, vcpus, ram, tier, detail }) => ({
    label,
    tier,
    multiplier,
    maxThroughput,
    vcpus,
    ram,
    detail
  })),
  // ── General Purpose (M9 — Graviton4, with and without local NVMe) ────────
  ...AWS_EC2_M9_CATALOG.map(({ label, multiplier, maxThroughput, vcpus, ram, tier, detail }) => ({
    label,
    tier,
    multiplier,
    maxThroughput,
    vcpus,
    ram,
    detail
  })),
  // ── Compute Optimized (C5) ───────────────────────────────────────────────
  { label: "c5.large", tier: "Compute Optimized", multiplier: 0.89, maxThroughput: 2500, vcpus: 2, ram: 4, detail: "2 vCPU \xB7 4 GB \xB7 $0.085/hr" },
  { label: "c5.xlarge", tier: "Compute Optimized", multiplier: 1.77, maxThroughput: 5500, vcpus: 4, ram: 8, detail: "4 vCPU \xB7 8 GB \xB7 $0.170/hr" },
  // ── Compute Optimized (C6i — Ice Lake, ~10% better perf vs C5) ──────────
  { label: "c6i.large", tier: "Compute Optimized", multiplier: 0.89, maxThroughput: 2750, vcpus: 2, ram: 4, detail: "2 vCPU \xB7 4 GB \xB7 $0.085/hr" },
  { label: "c6i.xlarge", tier: "Compute Optimized", multiplier: 1.77, maxThroughput: 6e3, vcpus: 4, ram: 8, detail: "4 vCPU \xB7 8 GB \xB7 $0.170/hr" },
  { label: "c6i.2xlarge", tier: "Compute Optimized (C6i)", multiplier: 3.542, maxThroughput: 12e3, vcpus: 8, ram: 16, detail: "8 vCPU \xB7 16 GB \xB7 $0.340/hr" },
  { label: "c6i.4xlarge", tier: "Compute Optimized (C6i)", multiplier: 7.083, maxThroughput: 24e3, vcpus: 16, ram: 32, detail: "16 vCPU \xB7 32 GB \xB7 $0.680/hr" },
  { label: "c6i.8xlarge", tier: "Compute Optimized (C6i)", multiplier: 14.167, maxThroughput: 48e3, vcpus: 32, ram: 64, detail: "32 vCPU \xB7 64 GB \xB7 $1.360/hr" },
  { label: "c6i.12xlarge", tier: "Compute Optimized (C6i)", multiplier: 21.25, maxThroughput: 72e3, vcpus: 48, ram: 96, detail: "48 vCPU \xB7 96 GB \xB7 $2.040/hr" },
  { label: "c6i.16xlarge", tier: "Compute Optimized (C6i)", multiplier: 28.333, maxThroughput: 96e3, vcpus: 64, ram: 128, detail: "64 vCPU \xB7 128 GB \xB7 $2.720/hr" },
  { label: "c6i.24xlarge", tier: "Compute Optimized (C6i)", multiplier: 42.5, maxThroughput: 144e3, vcpus: 96, ram: 192, detail: "96 vCPU \xB7 192 GB \xB7 $4.080/hr" },
  { label: "c6i.32xlarge", tier: "Compute Optimized (C6i)", multiplier: 56.667, maxThroughput: 192e3, vcpus: 128, ram: 256, detail: "128 vCPU \xB7 256 GB \xB7 $5.440/hr" },
  // ── Memory Optimized (R5) ────────────────────────────────────────────────
  { label: "r5.large", tier: "Memory Optimized", multiplier: 1.31, maxThroughput: 2e3, vcpus: 2, ram: 16, detail: "2 vCPU \xB7 16 GB \xB7 $0.126/hr" },
  { label: "r5.xlarge", tier: "Memory Optimized", multiplier: 2.63, maxThroughput: 4500, vcpus: 4, ram: 32, detail: "4 vCPU \xB7 32 GB \xB7 $0.252/hr" },
  // ── Memory Optimized (R6i — Ice Lake, ~10% better perf vs R5) ───────────
  { label: "r6i.large", tier: "Memory Optimized", multiplier: 1.575, maxThroughput: 2200, vcpus: 2, ram: 16, detail: "2 vCPU \xB7 16 GB \xB7 $0.1512/hr" },
  { label: "r6i.xlarge", tier: "Memory Optimized", multiplier: 3.15, maxThroughput: 4900, vcpus: 4, ram: 32, detail: "4 vCPU \xB7 32 GB \xB7 $0.3024/hr" },
  { label: "r6i.2xlarge", tier: "Memory Optimized (R6i)", multiplier: 5.25, maxThroughput: 1e4, vcpus: 8, ram: 64, detail: "8 vCPU \xB7 64 GB \xB7 $0.504/hr" },
  { label: "r6i.4xlarge", tier: "Memory Optimized (R6i)", multiplier: 10.5, maxThroughput: 2e4, vcpus: 16, ram: 128, detail: "16 vCPU \xB7 128 GB \xB7 $1.008/hr" },
  { label: "r6i.8xlarge", tier: "Memory Optimized (R6i)", multiplier: 21, maxThroughput: 4e4, vcpus: 32, ram: 256, detail: "32 vCPU \xB7 256 GB \xB7 $2.016/hr" },
  { label: "r6i.12xlarge", tier: "Memory Optimized (R6i)", multiplier: 31.5, maxThroughput: 6e4, vcpus: 48, ram: 384, detail: "48 vCPU \xB7 384 GB \xB7 $3.024/hr" },
  { label: "r6i.16xlarge", tier: "Memory Optimized (R6i)", multiplier: 42, maxThroughput: 8e4, vcpus: 64, ram: 512, detail: "64 vCPU \xB7 512 GB \xB7 $4.032/hr" },
  { label: "r6i.24xlarge", tier: "Memory Optimized (R6i)", multiplier: 63, maxThroughput: 12e4, vcpus: 96, ram: 768, detail: "96 vCPU \xB7 768 GB \xB7 $6.048/hr" },
  { label: "r6i.32xlarge", tier: "Memory Optimized (R6i)", multiplier: 84, maxThroughput: 16e4, vcpus: 128, ram: 1024, detail: "128 vCPU \xB7 1024 GB \xB7 $8.064/hr" },
  // ── Large GPU (multi-GPU nodes) — P/G families, us-east-1 on-demand, Aug 2026 ──
  { label: "g5.48xlarge", tier: "Large GPU (multi-GPU)", multiplier: 169.69, maxThroughput: 14e3, vcpus: 192, ram: 768, detail: "8\xD7 A10G 24GB \xB7 192 vCPU \xB7 768 GB \xB7 $16.29/hr" },
  { label: "p3.16xlarge", tier: "Large GPU (multi-GPU)", multiplier: 255, maxThroughput: 14e3, vcpus: 64, ram: 488, detail: "8\xD7 V100 16GB \xB7 64 vCPU \xB7 488 GB \xB7 $24.48/hr" },
  { label: "p4d.24xlarge", tier: "Large GPU (multi-GPU)", multiplier: 341.35, maxThroughput: 16e3, vcpus: 96, ram: 1152, detail: "8\xD7 A100 40GB \xB7 96 vCPU \xB7 1152 GB \xB7 $32.77/hr" },
  // ── Large GPU (G6e / L40S + Trn2) — us-east-1 on-demand, Aug 2026 ──
  { label: "g6e.48xlarge", tier: "Large GPU (multi-GPU)", multiplier: 313.85, maxThroughput: 16e3, vcpus: 192, ram: 1536, detail: "8\xD7 L40S 48GB \xB7 192 vCPU \xB7 1536 GB \xB7 $30.13/hr" },
  { label: "trn2.48xlarge", tier: "Large GPU (multi-GPU)", multiplier: 445.63, maxThroughput: 18e3, vcpus: 192, ram: 4096, detail: "16\xD7 Trainium2 \xB7 192 vCPU \xB7 4096 GB HBM \xB7 $42.78/hr" }
];

// ../shared/kubernetes-cpu-hpa-calibration.ts
var KUBERNETES_CPU_HPA_MAX_TRACE_POINTS = 100;
var KUBERNETES_CPU_HPA_MAX_TRACE_RPS = 1e6;
var KUBERNETES_CPU_HPA_MAX_TRACE_CPU_MILLICORES = 1e9;
function deriveKubernetesCpuDemandMilliCoresPerRps(measurements) {
  if (measurements.length < 2 || measurements.length > KUBERNETES_CPU_HPA_MAX_TRACE_POINTS) {
    return void 0;
  }
  let loadCpuProduct = 0;
  let loadSquares = 0;
  for (const measurement of measurements) {
    if (!Number.isFinite(measurement.rps) || measurement.rps <= 0 || measurement.rps > KUBERNETES_CPU_HPA_MAX_TRACE_RPS || !Number.isFinite(measurement.cpuMilliCores) || measurement.cpuMilliCores < 0 || measurement.cpuMilliCores > KUBERNETES_CPU_HPA_MAX_TRACE_CPU_MILLICORES) return void 0;
    loadCpuProduct += measurement.rps * measurement.cpuMilliCores;
    loadSquares += measurement.rps * measurement.rps;
  }
  if (loadSquares <= 0) return void 0;
  const demand = loadCpuProduct / loadSquares;
  return Number.isFinite(demand) && demand > 0 && demand <= 1e6 ? demand : void 0;
}

// ../shared/schema.ts
var CWM_RESOURCE_TYPES = [
  "compute",
  "database",
  "storage",
  "network",
  "cache",
  "queue",
  "kubernetes",
  "security"
];
var CWM_CLOUD_PROVIDERS = ["aws", "gcp", "azure", "oci", "digitalocean"];
var resourceTypeSchema = z7.enum(CWM_RESOURCE_TYPES);
var cloudProviderSchema = z7.enum(CWM_CLOUD_PROVIDERS);
var locationSchema = z7.object({
  regionKey: z7.string(),
  zoneKey: z7.string().optional(),
  localityType: z7.enum(["az", "zone", "availability_domain", "fault_domain"]).optional(),
  providerLabel: z7.string().optional(),
  faultDomainKey: z7.string().optional()
});
var runtimeMemoryProfileSchema = z7.object({
  workingSetGiB: z7.number().finite().positive().max(1024),
  source: z7.enum(["user-provided", "calibrated", "external"]),
  confidence: z7.enum(["low", "medium", "high"]),
  /**
   * An explicit calibrated/external probability, when one is available. With
   * no probability the model reports a deterministic limit comparison only.
   */
  limitExceededProbability: z7.number().finite().min(0).max(1).optional(),
  /**
   * Consequences are opt-in and bounded. Omitting this object records the
   * threshold condition without inventing a restart, failed work, retry, or
   * latency outcome.
   */
  onLimitExceeded: z7.object({
    termination: z7.enum(["terminate", "restart"]).optional(),
    failedWorkFraction: z7.number().finite().min(0).max(1).optional(),
    retryMultiplier: z7.number().finite().min(1).max(10).optional(),
    latencyPenaltyMs: z7.number().finite().min(0).max(6e4).optional(),
    /** Explicit retry charge only; never changes allocated-memory billing. */
    retryCostPerMillionRequests: z7.number().finite().min(0).max(1e5).optional()
  }).optional()
}).superRefine((profile, ctx) => {
  if (profile.limitExceededProbability !== void 0 && profile.source === "user-provided") {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["limitExceededProbability"],
      message: "limitExceededProbability requires a calibrated or external source"
    });
  }
  if (profile.onLimitExceeded?.termination !== void 0 && profile.onLimitExceeded.failedWorkFraction === void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["onLimitExceeded", "failedWorkFraction"],
      message: "failedWorkFraction is required when a termination state is declared"
    });
  }
});
var githubKubernetesProfileMapSchema = z7.lazy(() => z7.record(
  z7.string().min(1).max(128),
  kubernetesRuntimeMemoryProfileSchema
).refine((profiles) => Object.keys(profiles).length > 0, "at least one Kubernetes runtime-memory profile is required"));
var githubKubernetesProfileEntrySchema = z7.lazy(() => z7.object({
  workload: z7.string().min(1).max(128),
  namespace: z7.string().min(1).max(128).optional(),
  profile: kubernetesRuntimeMemoryProfileSchema
}).strict());
var githubRuntimeMemoryProfileManifestSchema = z7.object({
  version: z7.literal(1),
  iacFiles: z7.array(
    z7.string().min(1).max(512).refine(
      (path) => !path.startsWith("/") && !path.split("/").includes(".."),
      "must be a repository-relative path without '..' segments"
    )
  ).min(1).max(32),
  profiles: z7.record(
    z7.string().min(1).max(128),
    runtimeMemoryProfileSchema
  ).default({}),
  kubernetes: z7.object({
    profiles: githubKubernetesProfileMapSchema.optional(),
    workloads: z7.array(githubKubernetesProfileEntrySchema).min(1).max(256).optional()
  }).strict().optional(),
  kubernetesProfiles: z7.union([
    githubKubernetesProfileMapSchema,
    z7.array(githubKubernetesProfileEntrySchema).min(1).max(256)
  ]).optional()
}).strict().superRefine((manifest, ctx) => {
  if (Object.keys(manifest.profiles).length > 256) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["profiles"],
      message: "at most 256 runtime-memory profiles may be supplied"
    });
  }
  if (new Set(manifest.iacFiles).size !== manifest.iacFiles.length) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["iacFiles"],
      message: "IaC source paths must be unique"
    });
  }
  const kubernetesProfileCount = Object.keys(manifest.kubernetes?.profiles ?? {}).length + (manifest.kubernetes?.workloads?.length ?? 0) + (manifest.kubernetesProfiles ? Array.isArray(manifest.kubernetesProfiles) ? manifest.kubernetesProfiles.length : Object.keys(manifest.kubernetesProfiles).length : 0);
  if (kubernetesProfileCount > 256) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["kubernetes"],
      message: "at most 256 Kubernetes runtime-memory profiles may be supplied"
    });
  }
  if (manifest.kubernetes?.profiles && manifest.kubernetes?.workloads) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["kubernetes"],
      message: "use either kubernetes.profiles or kubernetes.workloads, not both"
    });
  }
  if (manifest.kubernetes && manifest.kubernetesProfiles) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["kubernetesProfiles"],
      message: "use one Kubernetes profile section, not both kubernetes and kubernetesProfiles"
    });
  }
  if (Object.keys(manifest.profiles).length === 0 && kubernetesProfileCount === 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["profiles"],
      message: "at least one runtime-memory profile is required"
    });
  }
});
var kubernetesMemoryProfileFieldsSchema = z7.object({
  limitGiB: z7.number().finite().positive().max(1024),
  requestGiB: z7.number().finite().positive().max(1024).optional(),
  baselineWorkingSetGiB: z7.number().finite().positive().max(1024),
  burstWorkingSetGiB: z7.number().finite().positive().max(1024).optional(),
  headroomGiB: z7.number().finite().min(0).max(1024).default(0),
  /** Declared working-set curve, keyed on per-replica RPS. Ascending order required. */
  loadBreakpoints: z7.array(z7.object({
    perReplicaRps: z7.number().finite().positive(),
    workingSetGiB: z7.number().finite().positive().max(1024)
  })).min(1).max(20),
  /** Behavior above the highest declared loadBreakpoint. "linear" (default)
   *  extrapolates the final declared segment's slope; "clamp" holds demand
   *  flat at the last breakpoint's workingSetGiB value for any RPS beyond it.
   *  Only governs the region above the last breakpoint — the below-first-
   *  breakpoint ramp from baselineWorkingSetGiB is unchanged either way.
   *  Omitting this field preserves today's linear-extrapolation behavior
   *  exactly. */
  extrapolation: z7.enum(["clamp", "linear"]).default("linear"),
  source: z7.enum(["user-provided", "calibrated", "external"]),
  confidence: z7.enum(["low", "medium", "high"]),
  /** Canonical bounded restart/readiness delay, measured in simulation steps,
   *  before an OOMKilled replica rejoins serving capacity. */
  restartDelaySteps: z7.number().finite().min(1).max(600).optional(),
  /** @deprecated Use restartDelaySteps. Accepted for backwards-compatible
   *  profile intake; values are normalized to a whole number of steps. */
  restartDelaySeconds: z7.number().finite().min(1).max(600).optional(),
  /** Upper bound on the fraction of replicas that may be mid-restart at once,
   *  modeling k8s's staggered (not simultaneous) pod eviction/restart behavior
   *  so surviving replicas remain available to absorb redistributed traffic. */
  maxConcurrentRestartFraction: z7.number().finite().min(0.05).max(1).default(1 / 3),
  /** Opt-in: when true, the modeled memory-pressure ratio can also trigger HPA
   *  scale-out (in addition to the existing CPU-only default). Leaving this
   *  unset/false keeps CPU-only scale-out decisions byte-identical. */
  memoryAwareAutoscaling: z7.boolean().optional(),
  /** demand/limit ratio at or above which memory-aware scale-out engages.
   *  Only consulted when memoryAwareAutoscaling is true. */
  memoryScaleOutThresholdRatio: z7.number().finite().min(0).max(1).default(0.85)
}).superRefine((profile, ctx) => {
  if (profile.restartDelaySteps !== void 0 && profile.restartDelaySeconds !== void 0 && Math.ceil(profile.restartDelaySteps) !== Math.ceil(profile.restartDelaySeconds)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["restartDelaySteps"],
      message: "restartDelaySteps and deprecated restartDelaySeconds must resolve to the same number of simulation steps"
    });
  }
  const rps = profile.loadBreakpoints.map((b) => b.perReplicaRps);
  for (let i = 1; i < rps.length; i++) {
    if (rps[i] <= rps[i - 1]) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["loadBreakpoints"],
        message: "loadBreakpoints must be sorted by strictly ascending perReplicaRps"
      });
    }
  }
  if (profile.burstWorkingSetGiB !== void 0 && profile.burstWorkingSetGiB < profile.baselineWorkingSetGiB) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["burstWorkingSetGiB"],
      message: "burstWorkingSetGiB must be at least baselineWorkingSetGiB"
    });
  }
  if (profile.memoryScaleOutThresholdRatio !== void 0 && profile.memoryAwareAutoscaling !== true && profile.memoryScaleOutThresholdRatio !== 0.85) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["memoryScaleOutThresholdRatio"],
      message: "memoryScaleOutThresholdRatio requires memoryAwareAutoscaling: true"
    });
  }
});
var eksSpotInterruptionConfigSchema = z7.object({
  enabled: z7.literal(true).default(true),
  triggerAtStep: z7.number().int().min(0).max(1e5).default(0),
  noticeWindowSeconds: z7.literal(120).default(120),
  simulationSecondsPerStep: z7.number().finite().positive().max(60).default(1),
  workloadReplicas: z7.number().int().min(1).max(1e4).default(1),
  imageSizeMiB: z7.number().finite().min(0).max(102400).default(0),
  imageCacheState: z7.enum(["warm", "cold"]).default("cold"),
  imageCacheHit: z7.boolean().optional(),
  pullBandwidthMiBPerSecond: z7.number().finite().positive().max(1e5).default(100),
  schedulingCapacity: z7.number().int().min(0).max(1e4).default(1),
  startupSeconds: z7.number().finite().min(0).max(3600).default(10),
  interruptionHandling: z7.enum(["reschedule", "drain-only", "fail-fast"]).default("reschedule")
});
var kubernetesCpuHpaEvidenceSchema = z7.object({
  source: z7.enum(["calibrated", "external"]),
  reference: z7.string().trim().min(1).max(512)
}).strict();
var kubernetesCpuHpaCalibrationSchema = z7.object({
  method: z7.literal("least-squares-through-origin"),
  reviewed: z7.literal(true),
  measurements: z7.array(z7.object({
    rps: z7.number().finite().positive().max(KUBERNETES_CPU_HPA_MAX_TRACE_RPS),
    cpuMilliCores: z7.number().finite().min(0).max(KUBERNETES_CPU_HPA_MAX_TRACE_CPU_MILLICORES)
  }).strict()).min(2).max(KUBERNETES_CPU_HPA_MAX_TRACE_POINTS)
}).strict();
var kubernetesCpuHpaSchema = z7.object({
  /** Declared per-pod CPU request; no request is inferred when omitted. */
  cpuRequestMilliCores: z7.number().finite().positive().max(1e5).optional(),
  cpuRequestEvidence: kubernetesCpuHpaEvidenceSchema.optional(),
  /** Explicit workload assumption; never inferred from aggregate CPU or RPS. */
  cpuDemandMilliCoresPerRps: z7.number().finite().positive().max(1e6),
  cpuDemandEvidence: kubernetesCpuHpaEvidenceSchema.optional(),
  /** Reviewed trace used to derive cpuDemandMilliCoresPerRps; absent for assumptions. */
  cpuDemandCalibration: kubernetesCpuHpaCalibrationSchema.optional(),
  targets: z7.array(z7.discriminatedUnion("type", [
    z7.object({
      type: z7.literal("Utilization"),
      targetPercent: z7.number().finite().positive().max(1e3)
    }).strict(),
    z7.object({
      type: z7.literal("AverageValue"),
      targetMilliCores: z7.number().finite().positive().max(1e5)
    }).strict()
  ])).min(1).max(2),
  /** Current workload pod replicas, updated by this model each simulation step. */
  replicas: z7.number().int().min(1).max(1e4),
  minReplicas: z7.number().int().min(1).max(1e4),
  maxReplicas: z7.number().int().min(1).max(1e4),
  /** Optional scale-down stabilization duration in simulation steps. */
  scaleDownStabilizationSteps: z7.number().int().min(1).max(1e4).optional()
}).strict().superRefine((config, ctx) => {
  if (config.minReplicas > config.maxReplicas) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["maxReplicas"],
      message: "maxReplicas must be greater than or equal to minReplicas"
    });
  }
  if (config.replicas < config.minReplicas || config.replicas > config.maxReplicas) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["replicas"],
      message: "replicas must be within minReplicas and maxReplicas"
    });
  }
  if (config.cpuRequestEvidence && config.cpuRequestMilliCores === void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["cpuRequestEvidence"],
      message: "CPU request evidence requires cpuRequestMilliCores"
    });
  }
  if (config.cpuDemandCalibration) {
    const fittedDemand = deriveKubernetesCpuDemandMilliCoresPerRps(
      config.cpuDemandCalibration.measurements
    );
    if (!config.cpuDemandEvidence) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["cpuDemandEvidence"],
        message: "A reviewed CPU demand trace requires a source and reference."
      });
    }
    if (fittedDemand === void 0 || fittedDemand !== config.cpuDemandMilliCoresPerRps) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["cpuDemandMilliCoresPerRps"],
        message: "CPU demand must match the reviewed trace's least-squares calibration."
      });
    }
  }
  const types = config.targets.map((target) => target.type);
  if (new Set(types).size !== types.length) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["targets"],
      message: "Configure at most one target of each type"
    });
  }
});
var endpointHealthCheckSchema = z7.object({
  path: z7.string().min(1).max(256).default("/health"),
  intervalSeconds: z7.number().int().min(1).max(300).default(15),
  timeoutSeconds: z7.number().int().min(1).max(120).default(5),
  unhealthyThreshold: z7.number().int().min(1).max(20).default(3),
  healthyThreshold: z7.number().int().min(1).max(20).default(2),
  dependencyResourceIds: z7.array(z7.string().min(1).max(128)).max(32).default([]),
  /** Explicitly declares an endpoint independent of downstream dependencies. */
  livenessOnly: z7.boolean().default(false)
}).strict().superRefine((check, ctx) => {
  if (check.livenessOnly && check.dependencyResourceIds.length) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["dependencyResourceIds"],
      message: "livenessOnly checks cannot declare dependencyResourceIds"
    });
  }
});
var resourceHealthChecksSchema = z7.object({
  /** ALB/target-group readiness contract for an ECS or other request-serving target. */
  loadBalancer: endpointHealthCheckSchema.optional(),
  /** Kubernetes container restart contract; liveness failures restart replicas. */
  livenessProbe: endpointHealthCheckSchema.optional(),
  /** Kubernetes endpoint-membership contract; readiness failures remove replicas from service. */
  readinessProbe: endpointHealthCheckSchema.optional(),
  /** ECS service scheduler limits, expressed as percentages of desired task count. */
  deployment: z7.object({
    maximumPercent: z7.number().int().min(100).max(200).default(200),
    minimumHealthyPercent: z7.number().int().min(0).max(100).default(100)
  }).strict().optional(),
  /** Kubernetes maximum concurrent pod restart fraction. */
  maxConcurrentRestartFraction: z7.number().finite().min(0.05).max(1).default(1 / 3),
  restartDelaySeconds: z7.number().finite().min(0).max(3600).optional()
}).strict();
var healthCheckLifecycleSchema = z7.object({
  resourceId: z7.string(),
  resourceName: z7.string(),
  platform: z7.enum(["ecs", "kubernetes"]),
  checkType: z7.enum(["load_balancer_readiness", "liveness", "readiness"]),
  desiredReplicas: z7.number().int().nonnegative(),
  unhealthyReplicas: z7.number().int().nonnegative(),
  deregisteredReplicas: z7.number().int().nonnegative(),
  replacementReplicas: z7.number().int().nonnegative(),
  readyReplicas: z7.number().int().nonnegative(),
  unhealthyAtSeconds: z7.number().nonnegative().nullable(),
  deregisteredAtSeconds: z7.number().nonnegative().nullable(),
  replacementStartedAtSeconds: z7.number().nonnegative().nullable(),
  /** Estimated minimum cold-start completion; readiness may be observed later. */
  scheduledReadyAtSeconds: z7.number().nonnegative().nullable().optional(),
  /** First simulation-clock sample at which readiness is actually observed. */
  readyAtSeconds: z7.number().nonnegative().nullable(),
  albFailOpen: z7.boolean()
});
var eksSpotWorkloadStateSchema = z7.object({
  id: z7.string(),
  state: z7.enum(["pending", "pulling", "starting", "ready", "missed_deadline"]),
  node: z7.enum(["interrupted", "surviving", "replacement"]).optional(),
  remainingSeconds: z7.number().nonnegative(),
  /**
   * Historical deadline evidence is independent from the live workload state.
   * A workload may be marked here and later become ready after the immutable
   * 120-second adjudication.
   */
  missedDeadline: z7.boolean().optional()
});
var eksSpotMigrationEvaluationFieldProvenanceSchema = z7.discriminatedUnion("kind", [
  z7.object({ kind: z7.literal("recorded") }).strict(),
  z7.object({
    kind: z7.literal("derived"),
    sourceFields: z7.array(z7.string().min(1).max(128)).min(1).max(8)
  }).strict(),
  z7.object({
    kind: z7.literal("unavailable"),
    reason: z7.string().min(1).max(256)
  }).strict()
]);
var goodputWindowFieldProvenanceSchema = z7.discriminatedUnion("kind", [
  z7.object({ kind: z7.literal("recorded"), source: z7.string().min(1).max(256) }).strict(),
  z7.object({
    kind: z7.literal("derived"),
    sourceFields: z7.array(z7.string().min(1).max(256)).min(1).max(256)
  }).strict(),
  z7.object({
    kind: z7.literal("unavailable"),
    reason: z7.string().min(1).max(256)
  }).strict()
]);
var goodputSimulationClockWindowSchema = z7.object({
  windowStartSeconds: z7.number().finite().nonnegative(),
  windowEndSeconds: z7.number().finite().nonnegative(),
  inclusion: z7.literal("[start,end)")
}).refine(
  (window) => window.windowEndSeconds > window.windowStartSeconds,
  { message: "windowEndSeconds must be greater than windowStartSeconds" }
);
var goodputIntervalAttributionSchema = z7.discriminatedUnion("status", [
  z7.object({
    status: z7.literal("recorded"),
    window: goodputSimulationClockWindowSchema,
    provenance: z7.object({
      kind: z7.literal("recorded"),
      source: z7.string().min(1).max(256)
    }).strict()
  }).strict(),
  z7.object({
    status: z7.literal("unavailable"),
    provenance: z7.object({
      kind: z7.literal("unavailable"),
      reason: z7.string().min(1).max(256)
    }).strict()
  }).strict()
]);
var goodputDurationWeightedAggregateSchema = z7.object({
  window: goodputSimulationClockWindowSchema,
  coveredDurationSeconds: z7.number().finite().nonnegative(),
  goodputRps: z7.number().finite().nonnegative(),
  goodputRequestTotal: z7.number().finite().nonnegative(),
  sampleIds: z7.array(z7.string().min(1)),
  provenance: goodputWindowFieldProvenanceSchema
}).strict();
var goodputWindowSchema = z7.discriminatedUnion("status", [
  z7.object({
    status: z7.literal("unavailable"),
    provenance: z7.object({
      kind: z7.literal("unavailable"),
      reason: z7.string().min(1).max(256)
    }).strict()
  }).strict(),
  z7.object({
    status: z7.literal("recorded"),
    window: goodputSimulationClockWindowSchema,
    aggregate: goodputDurationWeightedAggregateSchema,
    provenance: z7.object({
      kind: z7.literal("recorded"),
      source: z7.string().min(1).max(256)
    }).strict()
  }).strict()
]);
var eksSpotMigrationEvaluationReasonSchema = z7.object({
  code: z7.enum([
    "no_reschedule",
    "scheduling_capacity_exhausted",
    "image_pull_incomplete",
    "startup_incomplete",
    "unclassified_runtime_work_remaining"
  ]),
  workloadCount: z7.number().int().nonnegative(),
  pendingWorkloadCount: z7.number().int().nonnegative(),
  pullingWorkloadCount: z7.number().int().nonnegative(),
  startingWorkloadCount: z7.number().int().nonnegative(),
  residualPullSeconds: z7.number().nonnegative(),
  residualStartupSeconds: z7.number().nonnegative(),
  schedulingCapacity: z7.number().int().nonnegative(),
  interruptionHandling: z7.enum(["reschedule", "drain-only", "fail-fast"]),
  provenance: z7.literal("recorded")
}).strict();
var eksSpotMigrationEvaluationSchema = z7.object({
  status: z7.enum(["not_started", "in_progress", "completed"]),
  interruptionNoticeAtSimulationSeconds: z7.number().nonnegative().nullable(),
  deadlineAtSimulationSeconds: z7.number().nonnegative().nullable(),
  migrationStartedAtSimulationSeconds: z7.number().nonnegative().nullable(),
  allAffectedWorkloadsReadyAtSimulationSeconds: z7.number().nonnegative().nullable(),
  /** Derived only from the two recorded notice/all-ready milestones. */
  migrationDurationSeconds: z7.number().nonnegative().nullable(),
  deadlineSeconds: z7.literal(120),
  /** Null until completion; derived from the recorded readiness/deadline facts. */
  deadlineMet: z7.boolean().nullable(),
  affectedWorkloadCount: z7.number().int().nonnegative().nullable(),
  readyWorkloadCountAtDeadline: z7.number().int().nonnegative().nullable(),
  missedDeadlineWorkloadCount: z7.number().int().nonnegative().nullable(),
  evaluatedAtSimulationSeconds: z7.number().nonnegative().nullable(),
  limitingReasons: z7.array(eksSpotMigrationEvaluationReasonSchema).max(5),
  fieldProvenance: z7.object({
    status: eksSpotMigrationEvaluationFieldProvenanceSchema,
    interruptionNoticeAtSimulationSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    deadlineAtSimulationSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    migrationStartedAtSimulationSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    allAffectedWorkloadsReadyAtSimulationSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    migrationDurationSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    deadlineSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    deadlineMet: eksSpotMigrationEvaluationFieldProvenanceSchema,
    affectedWorkloadCount: eksSpotMigrationEvaluationFieldProvenanceSchema,
    readyWorkloadCountAtDeadline: eksSpotMigrationEvaluationFieldProvenanceSchema,
    missedDeadlineWorkloadCount: eksSpotMigrationEvaluationFieldProvenanceSchema,
    evaluatedAtSimulationSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    limitingReasons: eksSpotMigrationEvaluationFieldProvenanceSchema
  }).strict()
}).strict();
var eksSpotInterruptionCheckpointEvidenceSchema = z7.object({
  engineInputStepIndex: z7.number().int().nonnegative(),
  simulationSeconds: z7.number().nonnegative(),
  tickDurationSeconds: z7.number().finite().positive(),
  pointRateSemantics: z7.literal("post_step_point_rate"),
  intervalAttribution: goodputIntervalAttributionSchema.nullable(),
  fieldProvenance: z7.object({
    engineInputStepIndex: eksSpotMigrationEvaluationFieldProvenanceSchema,
    simulationSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    tickDurationSeconds: eksSpotMigrationEvaluationFieldProvenanceSchema,
    pointRateSemantics: eksSpotMigrationEvaluationFieldProvenanceSchema,
    intervalAttribution: eksSpotMigrationEvaluationFieldProvenanceSchema
  }).strict(),
  trafficFieldProvenance: z7.object({
    throughputRps: eksSpotMigrationEvaluationFieldProvenanceSchema,
    offeredRps: eksSpotMigrationEvaluationFieldProvenanceSchema,
    errorRatePercent: eksSpotMigrationEvaluationFieldProvenanceSchema,
    latencyP50Ms: eksSpotMigrationEvaluationFieldProvenanceSchema
  }).strict()
}).strict();
var eksSpotInterruptionTelemetrySchema = z7.object({
  resourceId: z7.string(),
  name: z7.string(),
  phase: z7.enum(["armed", "notice", "terminated", "complete"]),
  interruptionNotice: z7.boolean(),
  triggerAtStep: z7.number().int().nonnegative(),
  noticeWindowSeconds: z7.literal(120),
  elapsedNoticeSeconds: z7.number().nonnegative(),
  remainingDeadlineSeconds: z7.number().nonnegative(),
  affectedWorkloadCount: z7.number().int().nonnegative(),
  pendingWorkloadCount: z7.number().int().nonnegative(),
  pullingWorkloadCount: z7.number().int().nonnegative(),
  startingWorkloadCount: z7.number().int().nonnegative(),
  readyWorkloadCount: z7.number().int().nonnegative(),
  missedDeadlineWorkloadCount: z7.number().int().nonnegative(),
  drainProgress: z7.number().min(0).max(1),
  imagePullProgress: z7.number().min(0).max(1),
  startupProgress: z7.number().min(0).max(1),
  unavailableNodeCount: z7.number().int().nonnegative(),
  replacementNodeCount: z7.number().int().nonnegative(),
  workloads: z7.array(eksSpotWorkloadStateSchema),
  /**
   * Explicit terminal signal for agents. This is separate from `phase`, which
   * intentionally preserves the raw terminated lifecycle state.
   */
  migrationEvaluationComplete: z7.boolean().optional(),
  /** Optional so persisted telemetry created before the evaluation contract remains readable. */
  migrationEvaluation: eksSpotMigrationEvaluationSchema.optional(),
  /**
   * Optional for historical JSONB telemetry. Newly-produced seeded lifecycle
   * metrics record this in the same JSONB item as the interruption evidence.
   */
  checkpointEvidence: eksSpotInterruptionCheckpointEvidenceSchema.optional()
});
var eksSpotInterruptionParametersSchema = eksSpotInterruptionConfigSchema.omit({ enabled: true }).partial().extend({
  _lifecycleInitialized: z7.boolean().optional(),
  _targetResourceId: z7.string().optional()
}).passthrough();
var kubernetesMemoryProfileSchema = z7.preprocess((input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const raw = input;
  const restartDelaySteps = raw.restartDelaySteps !== void 0 ? raw.restartDelaySteps : raw.restartDelaySeconds;
  return restartDelaySteps === void 0 ? raw : { ...raw, restartDelaySteps: Math.ceil(Number(restartDelaySteps)) };
}, kubernetesMemoryProfileFieldsSchema.transform((profile) => {
  const { restartDelaySeconds: _deprecated, ...canonical } = profile;
  return {
    ...canonical,
    restartDelaySteps: Math.ceil(profile.restartDelaySteps ?? 30)
  };
}));
var kubernetesMemoryEvidenceSchema = z7.object({
  source: z7.literal("kubernetes-manifest"),
  sourceFile: z7.string().min(1).max(512),
  kind: z7.enum(["Deployment", "StatefulSet"]),
  workload: z7.string().min(1).max(256),
  namespace: z7.string().min(1).max(256),
  replicas: z7.number().int().positive().max(1e6).optional(),
  status: z7.enum(["complete", "partial", "ambiguous", "missing", "non_literal"]),
  requestGiB: z7.number().finite().positive().max(1024).optional(),
  limitGiB: z7.number().finite().positive().max(1024).optional(),
  reason: z7.enum([
    "multiple_containers",
    "non_literal_memory",
    "memory_not_declared"
  ]).optional()
}).strict();
var kubernetesRuntimeMemoryProfileSchema = z7.preprocess((input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const raw = input;
  const restartDelaySteps = raw.restartDelaySteps !== void 0 ? raw.restartDelaySteps : raw.restartDelaySeconds;
  return restartDelaySteps === void 0 ? raw : { ...raw, restartDelaySteps: Math.ceil(Number(restartDelaySteps)) };
}, z7.object({
  baselineWorkingSetGiB: z7.number().finite().positive().max(1024),
  burstWorkingSetGiB: z7.number().finite().positive().max(1024).optional(),
  headroomGiB: z7.number().finite().min(0).max(1024).default(0),
  loadBreakpoints: z7.array(z7.object({
    perReplicaRps: z7.number().finite().positive(),
    workingSetGiB: z7.number().finite().positive().max(1024)
  })).min(1).max(20),
  extrapolation: z7.enum(["clamp", "linear"]).default("linear"),
  source: z7.enum(["user-provided", "calibrated", "external"]),
  confidence: z7.enum(["low", "medium", "high"]),
  restartDelaySteps: z7.number().finite().min(1).max(600).optional(),
  restartDelaySeconds: z7.number().finite().min(1).max(600).optional(),
  maxConcurrentRestartFraction: z7.number().finite().min(0.05).max(1).default(1 / 3),
  memoryAwareAutoscaling: z7.boolean().optional(),
  memoryScaleOutThresholdRatio: z7.number().finite().min(0).max(1).default(0.85)
}).strict().superRefine((profile, ctx) => {
  if (profile.restartDelaySteps !== void 0 && profile.restartDelaySeconds !== void 0 && Math.ceil(profile.restartDelaySteps) !== Math.ceil(profile.restartDelaySeconds)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["restartDelaySteps"],
      message: "restartDelaySteps and deprecated restartDelaySeconds must resolve to the same number of simulation steps"
    });
  }
  const rps = profile.loadBreakpoints.map((b) => b.perReplicaRps);
  for (let i = 1; i < rps.length; i++) {
    if (rps[i] <= rps[i - 1]) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["loadBreakpoints"],
        message: "loadBreakpoints must be sorted by strictly ascending perReplicaRps"
      });
    }
  }
  if (profile.burstWorkingSetGiB !== void 0 && profile.burstWorkingSetGiB < profile.baselineWorkingSetGiB) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["burstWorkingSetGiB"],
      message: "burstWorkingSetGiB must be at least baselineWorkingSetGiB"
    });
  }
  if (profile.memoryScaleOutThresholdRatio !== void 0 && profile.memoryAwareAutoscaling !== true && profile.memoryScaleOutThresholdRatio !== 0.85) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["memoryScaleOutThresholdRatio"],
      message: "memoryScaleOutThresholdRatio requires memoryAwareAutoscaling: true"
    });
  }
}).transform((profile) => {
  const { restartDelaySeconds: _deprecated, ...canonical } = profile;
  return {
    ...canonical,
    restartDelaySteps: Math.ceil(profile.restartDelaySteps ?? 30)
  };
}));
var databaseConnectionDemandSchema = z7.object({
  /**
   * load-derived preserves the existing RPS-derived estimate; declared uses
   * the plan-time declared values only; max combines both by taking the largest.
   */
  mode: z7.enum(["load-derived", "declared", "max"]),
  /**
   * Optional pool-utilization threshold for the load-derived error curve.
   * Above this threshold, errors rise with utilization beyond the threshold;
   * below it, pool saturation contributes no errors. When configured on
   * multiple databases, all must use the same value for the override to apply.
   */
  saturationErrorThreshold: z7.number().min(0).max(0.99).finite().optional(),
  /** ASSUMPTION / plan-time peak pool budget; not a live connection observation. */
  declaredConnections: z7.number().int().nonnegative().finite().max(1e6).optional(),
  /** ASSUMPTION / plan-time minimum idle pool footprint; not live occupancy. */
  idlePoolFloor: z7.number().int().nonnegative().finite().max(1e6).optional()
}).superRefine((demand, ctx) => {
  if (demand.mode === "load-derived" && (demand.declaredConnections !== void 0 || demand.idlePoolFloor !== void 0)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["mode"],
      message: "load-derived mode cannot include declaredConnections or idlePoolFloor; use declared or max"
    });
  }
  if (demand.mode === "declared" && demand.declaredConnections === void 0 && demand.idlePoolFloor === void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["declaredConnections"],
      message: "declared mode requires declaredConnections and/or idlePoolFloor"
    });
  }
  if (demand.mode === "max" && demand.declaredConnections === void 0 && demand.idlePoolFloor === void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["declaredConnections"],
      message: "max mode requires declaredConnections and/or idlePoolFloor"
    });
  }
});
var resourceCharacteristicsSchema = z7.object({
  rdsSqlServerBilling: rdsSqlServerBillingSchema.optional(),
  size: z7.string().optional(),
  /** Explicit OCPU allocation for documented OCI Flex compute shapes. */
  ocpus: z7.number().int().positive().max(126).optional(),
  /** Aurora reader: promotion tiers 0/1 mirror writer capacity; tiers 2–15 scale on routed work. */
  auroraReaderScalingMode: z7.enum(["writer-mirror", "independent"]).optional(),
  /** Opt-in modeled Aurora writer failover; a supported two-instance Serverless v2 configuration materializes this relationship at creation. */
  auroraStandbyResourceId: z7.string().min(1).optional(),
  /** Aurora Serverless v2: true with instanceCount 2 materializes a billable reader in a second AZ. Generic fixed compute: instanceCount represents that many VMs and cannot be combined with autoscaling bounds. */
  multiAz: z7.boolean().optional(),
  /** Fixed generic-compute VM count (1–100), or Aurora Serverless v2 topology count (1–2). Fixed compute cannot combine this with autoscaling or minInstances/maxInstances. */
  instanceCount: z7.number().int().min(1).max(100).optional(),
  /**
   * Compatibility alias for size. When size is omitted, this value is
   * canonicalized into size before the resource reaches the engine. If both
   * fields are supplied they must be identical; size is the canonical field.
   */
  instanceType: z7.string().optional(),
  maxThroughput: z7.number().optional(),
  /** Internal: maxThroughput was materialized from a cross-provider DigitalOcean alternative, not declared by the caller. */
  catalogAlternativeThroughput: z7.boolean().optional(),
  maxConnections: z7.number().int().positive().finite().max(1e6).optional(),
  /** Modeled serving pool ceiling during an overload; maxConnections remains the configured ceiling. */
  effectiveMaxConnections: z7.number().int().positive().finite().max(1e6).optional(),
  /**
   * Optional database-side connection-demand assumption. `declaredConnections`
   * can represent a plan-time sum such as replicas × per-pod pool size; it is
   * not an assertion about live RDS connections. `max` compares it with the
   * existing load-derived estimate; `declared` uses only the declared budget;
   * omitting this object preserves the historical load-derived behavior.
   */
  connectionDemand: databaseConnectionDemandSchema.optional(),
  sessionAffinity: sessionAffinitySchema.optional(),
  /** AWS Aurora Serverless flat compatibility aliases; validated at resource intake. */
  minAcu: z7.number().positive().finite().optional(),
  maxAcu: z7.number().positive().finite().optional(),
  /** Explicit chaos failover relationship; capacity hints do not establish a replica. */
  replicaOf: z7.string().optional(),
  baseLatency: z7.number().optional(),
  coldStartLatency: z7.number().optional(),
  costMultiplier: z7.number().default(1),
  systemRole: z7.string().optional(),
  // Declared storage size in GB. When set on a storage resource, it drives a
  // size-based cost term in addition to the flat base rate × costMultiplier:
  //   costPerHour += (capacityGB × STORAGE_GB_MONTH_RATES[provider]) / 730
  // Each provider's per-GB-month rate is cited in shared/provider-pricing.ts.
  // On generic compute, this is disk GB PER VM, not aggregate fleet storage.
  // Stopped fixed fleets retain capacityGB × represented VM count; individually
  // materialized autoscaling members retain one disk each. Deleted VMs bill zero.
  // When omitted the size term is zero, leaving cost unchanged (backward-compatible).
  capacityGB: z7.number().optional(),
  cacheHitRate: z7.number().optional(),
  cdnTraffic: cdnTrafficSchema.optional(),
  availableSize: z7.array(z7.string()).optional(),
  serviceFamily: z7.string().optional(),
  /** Explicit application workload identity; used only by narrow owned-fit eligibility. */
  workload: z7.string().min(1).max(128).optional(),
  /** Explicit Node process and per-host DB pool settings for the owned typical workload. */
  appWorkerCount: z7.number().int().positive().optional(),
  appDbPoolSize: z7.number().int().positive().optional(),
  appRuntime: z7.string().optional(),
  workloadDatabaseVersion: z7.string().optional(),
  loadBalancerScheme: z7.enum(["internal", "internet-facing"]).optional(),
  /** Workload-level database identity, separate from unsupported RDS lifecycle engine inputs. */
  workloadDatabaseEngine: z7.literal("mysql").optional(),
  /** Only on canonical AWS db.r5.large RDS: workload-only MySQL alias; lifecycle input is rejected at intake. */
  engine: z7.string().optional(),
  // Serverless DB ACU bounds; either flat or nested under config. The engine
  // uses config first, then the flat form, then its documented defaults.
  minCapacity: z7.number().positive().finite().optional(),
  maxCapacity: z7.number().positive().finite().optional(),
  config: z7.object({
    minCapacity: z7.number().positive().finite().optional(),
    maxCapacity: z7.number().positive().finite().optional()
  }).passthrough().optional(),
  // Reusable request-serving compute contract. Cloud Run uses these fields
  // today; other serverless container platforms can opt into the same bounded
  // vocabulary without becoming a separate CWM resource category.
  containerCpu: z7.number().positive().optional(),
  containerMemoryGiB: z7.number().positive().optional(),
  vcpu: z7.number().positive().optional(),
  memoryGiB: z7.number().positive().optional(),
  cpuArchitecture: z7.string().optional(),
  runtimeMemoryProfile: runtimeMemoryProfileSchema.optional(),
  // Opt-in per-replica memory-pressure contract for kubernetes resources. See
  // kubernetesMemoryProfileSchema for the full provenance/behavior contract.
  // Absent by default — kubernetes resources without a profile explicitly
  // report "not evaluated" rather than inferring OOM risk from memoryUsage,
  // CPU, or RPS.
  kubernetesMemoryProfile: kubernetesMemoryProfileSchema.optional(),
  // Native manifest facts are configuration evidence only; they never activate
  // the runtime working-set/OOM state machine.
  kubernetesMemoryEvidence: kubernetesMemoryEvidenceSchema.optional(),
  /** Opt-in workload-pod CPU HPA model; independent of worker node autoscaling. */
  kubernetesCpuHpa: kubernetesCpuHpaSchema.optional(),
  /**
   * Opt-in AWS EKS Spot interruption lifecycle. This is intentionally
   * independent from pricingModel so existing Spot simulations remain
   * byte-compatible unless a caller explicitly enables the bounded model.
   */
  eksSpotInterruption: eksSpotInterruptionConfigSchema.optional(),
  healthChecks: resourceHealthChecksSchema.optional(),
  // AWS ECS/Fargate task-service contract. Fargate bills allocated task
  // capacity (not requests) and scales a bounded task fleet.
  desiredTaskCount: z7.number().int().min(0).optional(),
  minTaskCount: z7.number().int().min(0).optional(),
  maxTaskCount: z7.number().int().min(1).optional(),
  perTaskCapacityRps: z7.number().positive().optional(),
  /** Caller-supplied evidence for perTaskCapacityRps. Unannotated rates remain assumptions. */
  perTaskCapacityEvidence: z7.object({
    basis: z7.enum(["assumption", "documented", "measured"]),
    source: z7.string().trim().min(1).max(512).optional()
  }).optional(),
  taskStartupSeconds: z7.number().min(0).optional(),
  /** Steps an instance needs after the platform reports it Active before
   * the application is ready to serve traffic. 0 = today's binary behavior. */
  appReadySteps: z7.number().int().min(0).optional(),
  taskScaleDownSeconds: z7.number().min(0).optional(),
  /** Caller-configured application behavior; not a native ECS queue or CPU alarm. */
  fargateApplicationModel: z7.object({
    queueCapacityRequests: z7.number().int().min(1).max(1e5).optional(),
    scaleToZeroOnIdle: z7.boolean().optional()
  }).optional(),
  // Narrow, source-proven ECS Application Auto Scaling behavior used by
  // immutable PR snapshots. This is intentionally not inferred for generic
  // simulations: the IaC extractor must prove the service relationship first.
  applicationAutoscalingPolicy: z7.object({
    policyType: z7.enum(["TargetTrackingScaling", "StepScaling"]),
    metricType: z7.literal("ECSServiceAverageCPUUtilization"),
    targetValue: z7.number().gt(0).max(100).optional(),
    threshold: z7.number().gt(0).max(100).optional(),
    scaleOutCooldownSeconds: z7.number().int().nonnegative().max(86400).optional(),
    scaleInCooldownSeconds: z7.number().int().nonnegative().max(86400).optional(),
    simulationSecondsPerStep: z7.number().finite().positive().max(60).optional(),
    cooldownSeconds: z7.number().int().nonnegative().max(86400).optional(),
    disableScaleIn: z7.boolean().optional(),
    stepAdjustments: z7.array(z7.object({
      lowerBound: z7.number().finite().optional(),
      upperBound: z7.number().finite().optional(),
      scalingAdjustment: z7.number().int()
    })).max(32).optional()
  }).superRefine((policy, ctx) => {
    if (policy.policyType === "TargetTrackingScaling" && policy.targetValue === void 0) {
      ctx.addIssue({ code: z7.ZodIssueCode.custom, path: ["targetValue"], message: "TargetTrackingScaling requires targetValue" });
    }
    if (policy.policyType === "StepScaling" && (policy.threshold === void 0 || !policy.stepAdjustments?.length)) {
      ctx.addIssue({ code: z7.ZodIssueCode.custom, path: ["stepAdjustments"], message: "StepScaling requires threshold and stepAdjustments" });
    }
  }).optional(),
  concurrency: z7.number().int().min(1).max(1e3).optional(),
  requestDurationSeconds: z7.number().positive().optional(),
  /** Optional per-resource Lambda scale target; lower targets retain request headroom. */
  requestServingTargetUtilizationPct: z7.number().gt(0).max(100).optional(),
  connectionScaleFactor: z7.number().optional(),
  autoscaling: z7.boolean().optional(),
  // Per-resource hard ceiling/floor for RL scale_out / scale_in actions.
  // When set, these take the tighter bound against the simulation's
  // autoscalingConfig.maxInstances / minInstances so individual resources
  // can be capped independently without changing the global config.
  maxInstances: z7.number().int().min(1).optional(),
  minInstances: z7.number().int().min(0).optional(),
  // Per-resource CPU-HPA autoscaling override. When set, THIS resource's own
  // scale-out/scale-in decisions use these thresholds instead of the
  // simulation-wide default (autoscalingConfig, or the provider profile when
  // autoscalingConfig is absent) — mirrors the maxInstances/minInstances
  // override above, but for the CPU trigger point rather than the instance
  // bounds. Two resources in the same simulation can therefore scale at
  // different CPU percentages (e.g. a GKE cluster at 60% while an EC2 fleet
  // in the same simulation stays on the 80% simulation-wide default). Route
  // intake also accepts the canonical top-level CPU-HPA-target alias names
  // (autoscalingTargetCpu, scaleOutCpuPercent, autoscaleTargetCpuPercent)
  // nested under characteristics as synonyms, normalized into
  // scaleOutCpuThreshold before storage.
  scaleOutCpuThreshold: z7.number().min(0).max(100).optional(),
  scaleInCpuThreshold: z7.number().min(0).max(100).optional(),
  // Explicit ready capacity. Lambda maps this to provisioned concurrency;
  // request-serving containers use it as an additional warm-replica floor.
  provisionedInstances: z7.number().int().min(0).optional(),
  // Service-level lifecycle controls for the shared request-serving contract.
  // Providers may retain their documented default when omitted.
  idleTimeoutSeconds: z7.number().min(0).optional(),
  requestServingKind: z7.enum(["function", "container"]).optional(),
  fr12Key: z7.string().optional(),
  nodeCount: z7.number().optional(),
  // For adapter-produced single-pool workloads, one declared pod replica may
  // expand to multiple modeled worker nodes when its CPU limit exceeds the
  // selected shape. HPA replica bounds are converted with this factor.
  replicaCount: z7.number().int().min(1).optional(),
  nodesPerReplica: z7.number().int().min(1).optional(),
  // Worker capacity used for OpenShift's per-4-vCPU service/license units.
  // When absent, the provider's canonical 2-vCPU worker is assumed.
  workerVcpu: z7.number().positive().optional(),
  minNodes: z7.number().optional(),
  maxNodes: z7.number().optional(),
  // Multiple node pools per Kubernetes cluster. When present, each pool scales
  // independently within its own min/max bounds and is billed at its own
  // per-node hourly rate (falling back to the provider default when omitted).
  // The legacy single-pool fields above are used only when nodePools is absent.
  nodePools: z7.array(z7.object({
    name: z7.string().optional(),
    nodeCount: z7.number().optional(),
    minNodes: z7.number().optional(),
    maxNodes: z7.number().optional(),
    perNodeRate: z7.number().positive().optional(),
    // OpenShift service/license billing unit for this pool. Falls back to the
    // cluster-level workerVcpu, size inference, or the 2-vCPU canonical worker.
    workerVcpu: z7.number().positive().optional(),
    // Per-node serving capacity for this pool. When pools have different instance
    // sizes, the engine uses these values (rather than a uniform node-count ratio)
    // to compute the correct CPU credit on scale events — a pool of large nodes
    // relieves more load per node added/removed than a pool of small nodes.
    // Falls back to baseThroughput/totalNodes (uniform) when omitted.
    maxThroughput: z7.number().optional(),
    // Opt-in per-replica memory-pressure contract, scoped to THIS pool only.
    // Each pool is evaluated independently — a pool without its own profile
    // reports "missing_memory_profile" while a sibling pool with a profile is
    // fully evaluated (including OOM/restart cascades), rather than the
    // cluster-wide "unsupported_multi_pool_topology" basis this replaced. The
    // cluster-level `kubernetesMemoryProfile` above is never consulted for
    // pools (a profile only applies to the pool that declares it).
    kubernetesMemoryProfile: kubernetesMemoryProfileSchema.optional()
  }).passthrough()).optional(),
  // Literal RPS ceiling for compute resources only: the per-node request rate at
  // which the CPU formula reaches ~95% (critical territory). When present, the
  // engine converts it to an internal effectiveMaxThroughput by dividing by the
  // provider's calibrated criticalUtilThreshold coefficient, so agents can reason
  // about capacity in concrete RPS terms without needing to know the internal
  // throughput-scale denominator. Simulations that omit this field continue using
  // maxThroughput directly (byte-identical behaviour, backward-compatible).
  capacityRps: z7.number().positive().optional(),
  maxIops: z7.number().optional(),
  // GPU / inference-economics fields. When inferenceMode is true on a
  // kubernetes resource the engine treats worker nodes as GPU nodes (billed at
  // GPU_NODE_HOURLY_RATES instead of K8S_PER_NODE_RATE) and derives inference
  // metrics (gpuUtilization, tokensPerSecond, costPerMillionTokens) each step.
  // accelerator names the GPU type (e.g. "a10g", "t4", "h100") and is
  // informational plus used by hints/AI context. tokensPerRequest is the
  // average OUTPUT tokens generated per request (default 500 when omitted);
  // it bounds token throughput and drives the decode component of inference
  // latency. inputTokensPerRequest is the average PROMPT (prefill) tokens per
  // request and drives the TTFT component; when omitted it defaults to
  // 2 × tokensPerRequest (a typical ⅔-input / ⅓-output chat mix).
  inferenceMode: z7.boolean().optional(),
  accelerator: z7.string().optional(),
  tokensPerRequest: z7.number().positive().optional(),
  inputTokensPerRequest: z7.number().positive().optional(),
  // Managed AI platform overlay (e.g. NVIDIA DGX Cloud). The underlying
  // `provider` field stays a real CloudProvider (azure/gcp/oci/…) and keeps
  // driving region + base pricing; the overlay drives billing semantics
  // (bundled control plane / networking) and topology-aware throughput.
  // Absent on all non-platform resources — behavior is byte-identical to
  // resources created before this field existed.
  managedComputePlatform: z7.enum(["nvidia-dgx-cloud", "nvidia-dgx-cloud-lepton"]).optional(),
  /**
   * Optional Kubernetes distribution overlay. The provider remains the backing
   * cloud substrate; this field selects OpenShift platform/licensing behavior.
   * Omitted means the existing generic Kubernetes behavior, byte-for-byte.
   */
  openshiftOffering: z7.enum(OPENSHIFT_OFFERING_VALUES).optional(),
  // GPU interconnect topology for multi-GPU inference nodes. The engine maps
  // the categorical pair to an efficiency coefficient at simulation time
  // (resolveTopologyScalingFactor) — no derived scaling factor is ever stored,
  // so existing resources never need migrating. Omitted topology → factor 1.0
  // (current flat multi-GPU throughput assumption, byte-identical).
  topology: z7.object({
    intraNode: z7.enum(["pcie", "nvlink", "nvlink-nvswitch", "infiniband"]).optional(),
    interNode: z7.enum(["pcie", "nvlink", "nvlink-nvswitch", "infiniband"]).optional()
  }).optional(),
  // Flat-form ALIASES for topology.intraNode / topology.interNode. Agents and
  // external callers naturally reach for `characteristics.intraNode` instead of
  // the canonical nested `characteristics.topology.intraNode`; without these
  // fields a strip-mode parse would silently discard the value and the engine
  // would always resolve topologyIntraNode: null. The server normalizes both
  // shapes to the canonical nested form at the validation boundary
  // (normalizeTopologyAliases) before storage and engine evaluation — the
  // nested form wins when both are present, and the flat keys are stripped so
  // only the nested representation is ever stored.
  intraNode: z7.enum(["pcie", "nvlink", "nvlink-nvswitch", "infiniband"]).optional().describe("Alias for topology.intraNode (flat form). Normalized into characteristics.topology.intraNode; nested value wins when both are present."),
  interNode: z7.enum(["pcie", "nvlink", "nvlink-nvswitch", "infiniband"]).optional().describe("Alias for topology.interNode (flat form). Normalized into characteristics.topology.interNode; nested value wins when both are present."),
  // Declarative billing semantics for managed AI platforms. When
  // includesControlPlane is true the resource does NOT incur the managed-K8s
  // control-plane fee (DGX Cloud bundles it into the node rate). When
  // bundledNetworking is true the platform bundles fabric networking into the
  // node rate (informational in Phase 1; reserved for egress modeling).
  // Both default to undefined (falsy) — existing resources bill unchanged.
  includesControlPlane: z7.boolean().optional(),
  bundledNetworking: z7.boolean().optional(),
  // Spot / preemptible pricing model for this resource.
  // "on-demand" (default) = standard pay-as-you-go rates.
  // "spot" = provider spot/preemptible discount applied to the compute cost.
  // Non-compute resources and DigitalOcean resources ignore this field.
  pricingModel: z7.enum(["on-demand", "spot"]).optional(),
  /**
   * Bounded EKS Spot interruption/migration contract. This is deliberately
   * opt-in so existing Kubernetes and Spot simulations retain their current
   * behavior and informational interruption warning.
   */
  eksSpotMigration: z7.object({
    enabled: z7.boolean().default(false),
    deadlineSeconds: z7.number().int().min(1).max(120).default(120),
    workloadCount: z7.number().int().min(1).max(1e3).default(1),
    imageSizeMiB: z7.number().finite().min(0).max(1e7).default(0),
    imageCached: z7.boolean().default(true),
    pullBandwidthMiBPerSecond: z7.number().finite().positive().max(1e6).default(100),
    schedulingCapacity: z7.number().finite().positive().max(1e3).default(100),
    startupSeconds: z7.number().finite().min(0).max(120).default(0),
    /**
     * Test/scenario override for a measured migration duration. When absent,
     * the bounded pull + scheduling + startup estimate is used.
     */
    migrationDurationSeconds: z7.number().finite().min(0).max(3600).optional(),
    triggerAtSeconds: z7.number().finite().nonnegative().default(0),
    handling: z7.enum(["reschedule", "no_reschedule"]).default("reschedule")
  }).passthrough().optional(),
  // DynamoDB Streams: number of shards provisioned for the stream. Each shard
  // processes up to 1 000 records/s. When write throughput exceeds shard
  // capacity the engine accumulates iterator age (seconds) and emits a
  // stream_lag warning event. Ignored on non-DynamoDB resources.
  streamShardsCount: z7.number().optional(),
  // Explicit write RPS for a DynamoDB stream. When omitted the engine
  // estimates write load as 10 % of the current simulation traffic.
  streamWriteRps: z7.number().optional(),
  // S3 / GCS / Azure Blob / OCI Object Storage event notifications: when true
  // the engine models notification delivery latency (baseline 1 500 ms,
  // +1 ms per 10 RPS above 5 000 RPS, capped at 30 000 ms) and propagates it
  // to downstream serverless compute resources as an added latency penalty.
  // For S3 the consumer is Lambda; for GCS a Cloud Function; for Azure Blob an
  // Azure Function via Event Grid; for OCI Object Storage an OCI Function.
  // Ignored on non-storage resources or storage resources that are not in the
  // supported providers (aws, gcp, azure, oci).
  eventNotificationsEnabled: z7.boolean().optional(),
  // Azure Event Hubs: number of partitions provisioned on the event hub.
  // Each partition processes up to `partitionWriteRps` write records/s
  // (defaults to 1 000 records/s per partition when omitted). When write
  // throughput exceeds total partition capacity, `partitionLag` (seconds)
  // accumulates in resource metadata and a `partition_lag` warning event fires
  // when lag exceeds 30 s. Ignored on non-eventhub resources.
  partitionCount: z7.number().optional(),
  // OCI Streaming: number of stream partitions. Uses the same Kafka-style
  // offset lag model as Azure Event Hubs partitions. Falls back to
  // `partitionCount` when absent. A `stream_lag` warning event fires when lag
  // exceeds 30 s. Ignored on non-oci-streaming resources.
  streamPartitions: z7.number().optional(),
  // Azure Event Hubs / OCI Streaming: total write records/second produced
  // into the event stream by all upstream writers combined. When omitted
  // the engine estimates write load as 10 % of the current simulation traffic.
  // Each partition handles 1 000 records/s; lag accumulates when writeRps
  // exceeds partitionCount × 1 000 (Event Hubs) or streamPartitions × 1 000
  // (OCI Streaming).
  partitionWriteRps: z7.number().optional(),
  // Distributed training mode for multi-node DGX / GPU workloads.
  // When true, the simulation engine applies the inter-node topology coefficient
  // (resolveTopologyScalingFactor with mode="training") to bound aggregate
  // throughput across N nodes by the cross-node fabric efficiency — modelling
  // the all-reduce collective-communication bottleneck in distributed training.
  // Inference single-node behaviour is unchanged (interNode ignored there).
  // Omit (default: false/absent) for inference resources — byte-identical to
  // resources created before this field existed.
  trainingMode: z7.boolean().optional(),
  // JIT / CPU warm-up tuning: controls the cold-start penalty applied to
  // freshly (re)started compute and Kubernetes resources.
  //
  // warmupSteps  — length of the warm-up window in simulation steps (must be a
  //   positive integer). Falls back to COMPUTE_WARMUP_STEPS (3) when omitted.
  //   A longer window models runtimes that take many steps to fully warm (e.g.
  //   JVM + JIT compilation, Python ML model loading). A value of 1 gives a
  //   single-step burst then immediate full capacity.
  //
  // warmupSeverity — peak fraction by which effective capacity is reduced on
  //   the FIRST warm-up step (0 ≤ value ≤ 1; e.g. 0.8 = capacity cut to 20%;
  //   0 = no capacity reduction at all, i.e. effectively no warm-up penalty).
  //   The penalty decays linearly to 0 across the window. Falls back to
  //   COMPUTE_WARMUP_SEVERITY (0.5) when omitted. Higher values model
  //   cold-start-heavy stacks (JVM, large model loading); lower values model
  //   near-instant start-ups (static binaries, pre-warmed containers).
  warmupSteps: z7.number().int().min(1).optional(),
  warmupSeverity: z7.number().min(0).max(1).optional(),
  // Residual billing state for idle-infrastructure cost simulation.
  //   "active"   (default) — normal billing; all existing scenarios unaffected.
  //   "idle"     — resource exists but serves no traffic; idle-family resources
  //                (see shared/idle-pricing.ts) bill their flat residual rate.
  //   "stopped"  — compute/database instance stopped: compute cost is $0, but
  //                any capacityGB storage cost is retained (disks keep billing).
  //   "detached" — unattached IP / orphaned network artifact; bills the
  //                unattached rate for its serviceFamily.
  //   "deleted"  — remediated via "Remove idle resources"; skipped entirely
  //                by the cost engine.
  billingState: z7.enum(["active", "idle", "stopped", "detached", "deleted"]).optional(),
  // Caller-supplied GPU node hourly rate for inferenceMode Kubernetes clusters
  // whose GPU SKU is not in the CWM catalog. Must be a strictly-positive finite
  // number (USD/hr per worker node); zero and negative values are rejected —
  // zero looks like "free" to any consumer that skips the costFidelity field,
  // and negative values would reduce the aggregate cost below the true floor.
  // When this field is absent and the cluster size is also not in the catalog,
  // the engine excludes the cluster's cost from the aggregate total and sets
  // costComplete: false, so consumers know the figure is incomplete.
  perNodeRate: z7.number().positive().optional()
}).passthrough().superRefine((characteristics, ctx) => {
  if (characteristics.perTaskCapacityEvidence && characteristics.perTaskCapacityRps === void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["perTaskCapacityEvidence"],
      message: "perTaskCapacityEvidence requires perTaskCapacityRps."
    });
  }
  if ((characteristics.perTaskCapacityEvidence?.basis === "documented" || characteristics.perTaskCapacityEvidence?.basis === "measured") && !characteristics.perTaskCapacityEvidence.source) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["perTaskCapacityEvidence", "source"],
      message: "Documented or measured task capacity requires a supporting source."
    });
  }
  for (const [alias, canonical] of [["minAcu", "minCapacity"], ["maxAcu", "maxCapacity"]]) {
    if (alias in characteristics && (canonical in characteristics || canonical in (characteristics.config ?? {}))) {
      ctx.addIssue({ code: z7.ZodIssueCode.custom, path: [alias], message: `${alias} conflicts with ${canonical}` });
    }
    if (alias in characteristics && (typeof characteristics[alias] !== "number" || !Number.isFinite(characteristics[alias]) || characteristics[alias] <= 0)) {
      ctx.addIssue({ code: z7.ZodIssueCode.custom, path: [alias], message: `${alias} must be a positive finite number` });
    }
  }
  if (characteristics.size !== void 0 && characteristics.instanceType !== void 0 && characteristics.size !== characteristics.instanceType) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["instanceType"],
      message: "instanceType is a compatibility alias for size; when both are supplied they must match."
    });
  }
});
var recoveryPolicySchema = z7.object({
  criticalCpuThreshold: z7.number().min(0).max(100).default(80),
  criticalSteps: z7.number().int().min(1).default(4),
  warningCpuThreshold: z7.number().min(0).max(100).default(70),
  warningSteps: z7.number().int().min(1).default(3),
  // Optional separate knob for the failure-park window (steps a node stays
  // unavailable after injectNodeFailure before maxThroughput is restored).
  // When absent, the engine falls back to criticalSteps so existing behaviour
  // is byte-identical. Set this to a value different from criticalSteps when
  // the normal cooldown-demotion arc and the failure-park window should differ.
  failureParkSteps: z7.number().int().min(1).optional()
});
var recoveryProgressSchema = z7.object({
  state: z7.enum(["parked", "blocked", "cooling_down", "healthy"]),
  parkWindow: z7.object({
    totalSteps: z7.number().int().min(0),
    completedSteps: z7.number().int().min(0),
    remainingSteps: z7.number().int().min(0)
  }),
  cooldown: z7.object({
    target: z7.enum(["warning", "healthy"]).nullable(),
    completedSteps: z7.number().int().min(0),
    requiredSteps: z7.number().int().min(0),
    remainingSteps: z7.number().int().min(0)
  })
});
var resourceSchema = z7.object({
  dataState: z7.enum(["intact", "temporarily_unavailable", "permanently_lost"]).optional(),
  recoverySource: z7.enum(["none", "surviving_backup", "surviving_replica"]).optional(),
  recoverySourceResourceId: z7.string().optional(),
  /** An explicitly rebuilt empty DB can serve without recovering its original data. */
  databaseRebuilt: z7.boolean().optional(),
  id: z7.string(),
  type: resourceTypeSchema,
  name: z7.string(),
  provider: cloudProviderSchema.default("aws"),
  x: z7.number().default(0),
  y: z7.number().default(0),
  /** Current health severity; recovery hysteresis is represented by recoveryProgress/cooldown fields. */
  status: z7.enum(["healthy", "warning", "critical"]).default("healthy"),
  cpuUsage: z7.number().min(0).max(100).optional(),
  characteristics: z7.preprocess((val) => val === null ? {} : val, resourceCharacteristicsSchema).optional(),
  location: locationSchema.optional(),
  metadata: z7.record(z7.unknown()).optional(),
  cooldownSteps: z7.number().int().min(0).optional(),
  cooldownTarget: z7.enum(["warning", "healthy"]).optional(),
  recoveryPolicy: recoveryPolicySchema.optional(),
  routedRps: z7.number().optional(),
  recoveryProgress: recoveryProgressSchema.optional(),
  /**
   * Explicit availability classification for compute, kubernetes, and database resources.
   * Set by the step pipeline after traffic redistribution is finalised; absent on stored
   * snapshots that predate this field (backward-compatible).
   *
   *   "available"   — resource is currently healthy (status: "healthy") and serving traffic normally.
   *   "degraded"    — resource is under stress but still serving positive routed traffic
   *                   (isRoutable: true). Both `status: "warning"` and `status: "critical"`
   *                   with routedRps > 0 map to "degraded" — "warning" NEVER maps to
   *                   "unavailable". A saturated DB with many open connections that is still
   *                   handling requests correctly shows "degraded", NOT "unavailable".
   *   "unavailable" — resource has no routed traffic (routedRps === 0): it is
   *                   parked-critical (cpuUsage=0 and/or maxThroughput=0 while
   *                   status=critical), downed by an AZ outage, or removed by an
   *                   instance_kill failure. isRoutable: false.
   *   "scaled_to_zero" — an ECS Fargate service has no running tasks after scale-in.
   *   "cold_start"     — Fargate tasks are starting but none can serve traffic yet.
   *                   Both are explicitly not routable, but are not generic failures.
   *
   * Recovery cooldown is separate from status: a currently healthy resource may
   * still report recoveryProgress.state="cooling_down".
   *
   * Rule: `status: "critical"` alone does NOT imply "unavailable". Availability is
   * determined solely by whether routed RPS > 0 after traffic redistribution.
   *
   * This block is the single authoritative source; applyAvailabilityState() in
   * server/routes.ts implements these rules and references this comment.
   */
  availabilityState: z7.enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"]).optional(),
  /**
   * Whether this resource is receiving routed traffic during the current step.
   * True for "available" and "degraded"; false for unavailable and Fargate no-task states.
   * Absent on resource types where availability state is not tracked (e.g. network,
   * storage, cache, queue, security).
   */
  isRoutable: z7.boolean().optional(),
  /**
   * When the recovery cooldown is not advancing because an engine guard blocked the
   * demotion step, this field names the active guard. Absent (or undefined) when no
   * guard is active and the resource is progressing normally through its cooldown arc.
   *
   *   "failure_park_window" — the node was explicitly failed (injectNodeFailure) and
   *                           the minimum park-window has not yet elapsed.
   *   "idle_cpu_floor"      — the resource is parked-critical but the estimated idle CPU
   *                           is still above the recovery threshold, so it cannot heal yet.
   */
  recoveryBlockedReason: z7.string().optional()
}).superRefine((resource, ctx) => {
  if (resource.characteristics?.cdnTraffic && resource.type !== "network") {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["characteristics", "cdnTraffic"],
      message: "cdnTraffic requires a network CDN resource."
    });
  }
  const affinity = resource.characteristics?.sessionAffinity;
  if (affinity && (!["compute", "kubernetes"].includes(resource.type) || resource.type === "kubernetes" !== Boolean(affinity.workload) || resource.metadata?.iacCostOnly === true || ["ecsFargate", "cloudRun", "lambda", "appService", "appPlatform"].includes(resource.characteristics?.serviceFamily ?? ""))) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["characteristics", "sessionAffinity"],
      message: "sessionAffinity requires generic compute members, or Kubernetes with an explicit workload replica contract; managed request-serving services are not supported."
    });
  }
  if (resource.characteristics?.connectionDemand && resource.type !== "database") {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["characteristics", "connectionDemand"],
      message: "characteristics.connectionDemand is supported only for database resources."
    });
  }
  if (resource.characteristics?.kubernetesCpuHpa && resource.type !== "kubernetes") {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["characteristics", "kubernetesCpuHpa"],
      message: "kubernetesCpuHpa is supported only for Kubernetes resources."
    });
  }
  if (resource.type !== "compute" && (resource.characteristics?.instanceCount ?? 1) > 2) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["characteristics", "instanceCount"],
      message: "Only generic fixed compute supports instanceCount above 2; Aurora Serverless v2 remains limited to 1 or 2 instances."
    });
  }
  const hasOcpus = resource.characteristics?.ocpus !== void 0;
  if (hasOcpus && (resource.provider !== "oci" || resource.type !== "compute")) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["characteristics", "ocpus"],
      message: "characteristics.ocpus is supported only for documented OCI Flex compute shapes."
    });
  }
  if (resource.provider === "oci" && resource.type === "compute") {
    const resolution = resolveOciFlexOcpus(
      resolveResourceSize(resource.characteristics),
      resource.name,
      resource.characteristics?.ocpus
    );
    if (hasOcpus && resolution === void 0) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["characteristics", "ocpus"],
        message: "characteristics.ocpus is supported only for documented OCI Flex compute shapes."
      });
    } else if (resolution?.ok === false) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["characteristics", "ocpus"],
        message: resolution.message
      });
    }
  }
  for (const issue of validateRdsSqlServerBillingResource(resource)) {
    ctx.addIssue({ code: z7.ZodIssueCode.custom, ...issue });
  }
  const offering = resource.characteristics?.openshiftOffering;
  const error = validateOpenShiftOffering(offering, resource.provider, resource.type);
  if (error) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["characteristics", "openshiftOffering"],
      message: error
    });
  }
});
var connectionSchema = z7.object({
  id: z7.string().optional(),
  sourceId: z7.string(),
  targetId: z7.string(),
  label: z7.string().optional()
});
var scalingEventSchema = z7.object({
  timestamp: z7.number(),
  type: z7.enum(["scale_out", "scale_in", "resize"]).optional(),
  action: z7.enum(["scale_out", "scale_in", "resize"]),
  provider: cloudProviderSchema,
  resourceName: z7.string().optional(),
  instancesAdded: z7.number().optional(),
  instancesRemoved: z7.number().optional(),
  fromSize: z7.string().optional(),
  toSize: z7.string().optional(),
  reason: z7.string(),
  metrics: z7.object({
    cpu: z7.number(),
    throughputUtilization: z7.number(),
    latency: z7.number().optional()
  })
});
var autoscalingConfigSchema = z7.object({
  scaleOutCpuThreshold: z7.number(),
  scaleInCpuThreshold: z7.number(),
  scaleOutThroughputThreshold: z7.number(),
  scaleInThroughputThreshold: z7.number(),
  scaleOutLatencyThreshold: z7.number(),
  cooldownSeconds: z7.number(),
  /** Opt-in ECS CPU-only target tracking; other resources retain provider defaults. */
  ecsCpuTargetTracking: z7.boolean().optional(),
  scaleOutCooldownSeconds: z7.number().int().nonnegative().max(86400).optional(),
  scaleInCooldownSeconds: z7.number().int().nonnegative().max(86400).optional(),
  simulationSecondsPerStep: z7.number().finite().positive().max(60).optional(),
  minInstances: z7.number(),
  maxInstances: z7.number()
});
var autoscalingTargetAliasFields = {
  autoscalingTargetCpu: z7.number().finite().min(0).max(100).optional(),
  scaleOutCpuThreshold: z7.number().finite().min(0).max(100).optional(),
  scaleOutCpuPercent: z7.number().finite().min(0).max(100).optional(),
  autoscaleTargetCpuPercent: z7.number().finite().min(0).max(100).optional()
};
var RESILIENCE_MAX_DEPENDENCIES = 64;
var RESILIENCE_MAX_CAPACITY_ATTRIBUTIONS = RESILIENCE_MAX_DEPENDENCIES * 2;
var RESILIENCE_MAX_FAULTS = 32;
var RESILIENCE_MAX_RETRIES = 8;
var RESILIENCE_MAX_CASCADE_DEPTH = 8;
var RESILIENCE_MAX_GENERATED_RPS = 5e5;
var RESILIENCE_MAX_STEP_WORK = 2048;
var RESILIENCE_MAX_SCALING_POLICIES = 32;
var resilienceRetryPolicySchema = z7.object({
  maxRetries: z7.number().int().min(0).max(RESILIENCE_MAX_RETRIES).default(2),
  backoffMs: z7.number().int().min(0).max(6e4).default(100),
  backoffMultiplier: z7.number().min(1).max(10).default(2),
  jitterRatio: z7.number().min(0).max(1).default(0.1),
  /** Per-attempt client deadline, applied to queue wait + service + latency. */
  timeoutMs: z7.number().int().min(1).max(12e4).default(2e3),
  retryBudgetRatio: z7.number().min(0).max(10).default(2),
  retryBudgetRps: z7.number().min(0).max(RESILIENCE_MAX_GENERATED_RPS).optional(),
  // Identifies the actor producing retries (for example a gateway or client)
  // so investigations can distinguish independent amplification sources.
  retryActorId: z7.string().min(1).max(128).optional()
});
var resilienceCircuitBreakerSchema = z7.object({
  enabled: z7.boolean().default(false),
  failureRateThreshold: z7.number().min(0).max(1).default(0.5),
  minimumRequests: z7.number().int().min(1).max(1e5).default(20),
  openSteps: z7.number().int().min(1).max(120).default(3),
  halfOpenMaxRequests: z7.number().int().min(1).max(1e4).default(10)
});
var resilienceProtectionSchema = z7.object({
  circuitBreaker: resilienceCircuitBreakerSchema.optional(),
  rateLimitRps: z7.number().positive().max(RESILIENCE_MAX_GENERATED_RPS).optional(),
  loadShedding: z7.boolean().default(false)
});
var resilienceCapacityConstraintSchema = z7.object({
  maxRps: z7.number().positive().max(RESILIENCE_MAX_GENERATED_RPS).optional(),
  maxConcurrent: z7.number().int().positive().max(1e6).optional(),
  meanServiceTimeMs: z7.number().positive().max(12e4).default(100)
});
var resilienceScalingPolicySchema = z7.object({
  id: z7.string().min(1).max(128),
  dependencyId: z7.string().min(1).max(128),
  constrainedMetric: z7.enum(["rps", "concurrency"]),
  observationMetric: z7.enum(["source_cpu", "capacity_utilization"]),
  observedResourceId: z7.string().min(1).optional(),
  scaleOutThresholdPercent: z7.number().min(1).max(100),
  scaleOutCapacityMultiplier: z7.number().min(1).max(20).default(2)
});
var resilienceDependencySchema = z7.object({
  id: z7.string().min(1).max(128),
  sourceId: z7.string().min(1),
  targetId: z7.string().min(1),
  requestRatio: z7.number().min(0).max(20).default(1),
  authRequestsPerAttempt: z7.number().min(0).max(10).default(0),
  // Optional dependency edge that receives the auth/token requests generated
  // by this edge. This makes auth amplification causal rather than merely
  // observational: retries on a gateway edge can load and saturate the token
  // service edge without inflating normal client traffic.
  authDependencyId: z7.string().min(1).max(128).optional(),
  retryPolicy: resilienceRetryPolicySchema.default({}),
  capacity: resilienceCapacityConstraintSchema.optional(),
  protection: resilienceProtectionSchema.optional()
});
var resilienceScheduledFaultSchema = z7.object({
  id: z7.string().min(1).max(128),
  type: z7.enum(["capacity_limit", "concurrency_limit", "latency", "error_rate", "traffic_surge"]),
  targetResourceId: z7.string().optional(),
  dependencyId: z7.string().optional(),
  startStep: z7.number().int().min(0),
  endStep: z7.number().int().min(1).optional(),
  capacityPercent: z7.number().min(0).max(100).optional(),
  maxConcurrent: z7.number().int().positive().max(1e6).optional(),
  addedLatencyMs: z7.number().min(0).max(12e4).optional(),
  errorRate: z7.number().min(0).max(1).optional(),
  trafficMultiplier: z7.number().gt(1).max(20).optional()
}).superRefine((fault, ctx) => {
  if (!fault.targetResourceId && !fault.dependencyId) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["targetResourceId"],
      message: "A scheduled resilience fault must target a resource or dependency"
    });
  }
  if (fault.endStep !== void 0 && fault.endStep <= fault.startStep) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["endStep"],
      message: "endStep must be greater than startStep"
    });
  }
  const requiredFieldByType = {
    capacity_limit: "capacityPercent",
    concurrency_limit: "maxConcurrent",
    latency: "addedLatencyMs",
    error_rate: "errorRate",
    traffic_surge: "trafficMultiplier"
  };
  const requiredField = requiredFieldByType[fault.type];
  if (fault[requiredField] === void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: [requiredField],
      message: `${requiredField} is required for a ${fault.type} fault`
    });
  }
});
var resilienceConfigSchema = z7.object({
  enabled: z7.boolean().default(true),
  version: z7.literal(1).default(1),
  dependencies: z7.array(resilienceDependencySchema).max(RESILIENCE_MAX_DEPENDENCIES).default([]),
  scheduledFaults: z7.array(resilienceScheduledFaultSchema).max(RESILIENCE_MAX_FAULTS).default([]),
  scalingPolicies: z7.array(resilienceScalingPolicySchema).max(RESILIENCE_MAX_SCALING_POLICIES).default([]),
  externalMetrics: externalMetricsConfigSchema.optional(),
  maxCascadeDepth: z7.number().int().min(1).max(RESILIENCE_MAX_CASCADE_DEPTH).default(4),
  maxGeneratedRps: z7.number().positive().max(RESILIENCE_MAX_GENERATED_RPS).default(1e5),
  maxStepWork: z7.number().int().min(1).max(RESILIENCE_MAX_STEP_WORK).default(512),
  retryGeneratedTrafficAffectsCost: z7.boolean().default(false)
}).superRefine((config, ctx) => {
  const dependencyIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < config.dependencies.length; i++) {
    const dependency = config.dependencies[i];
    const id = dependency.id;
    if (dependencyIds.has(id)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["dependencies", i, "id"],
        message: `Duplicate dependency id: ${id}`
      });
    }
    dependencyIds.add(id);
  }
  for (let i = 0; i < config.dependencies.length; i++) {
    const dependency = config.dependencies[i];
    if (dependency.authDependencyId && !dependencyIds.has(dependency.authDependencyId)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["dependencies", i, "authDependencyId"],
        message: `Unknown auth dependency id: ${dependency.authDependencyId}`
      });
    }
    if (dependency.authDependencyId === dependency.id) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["dependencies", i, "authDependencyId"],
        message: "A dependency cannot route auth traffic to itself"
      });
    }
  }
  const faultIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < config.scheduledFaults.length; i++) {
    const fault = config.scheduledFaults[i];
    if (faultIds.has(fault.id)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["scheduledFaults", i, "id"],
        message: `Duplicate scheduled fault id: ${fault.id}`
      });
    }
    faultIds.add(fault.id);
    if (fault.dependencyId && !dependencyIds.has(fault.dependencyId)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["scheduledFaults", i, "dependencyId"],
        message: `Unknown dependency id: ${fault.dependencyId}`
      });
    }
  }
  const scalingPolicyIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < config.scalingPolicies.length; i++) {
    const policy = config.scalingPolicies[i];
    if (scalingPolicyIds.has(policy.id)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["scalingPolicies", i, "id"],
        message: `Duplicate scaling policy id: ${policy.id}`
      });
    }
    scalingPolicyIds.add(policy.id);
    if (!dependencyIds.has(policy.dependencyId)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["scalingPolicies", i, "dependencyId"],
        message: `Unknown dependency id: ${policy.dependencyId}`
      });
    }
  }
});
var resiliencePathMetricsSchema = z7.object({
  dependencyId: z7.string(),
  sourceId: z7.string(),
  targetId: z7.string(),
  depth: z7.number().int().nonnegative(),
  originalRps: z7.number().nonnegative(),
  attemptedRps: z7.number().nonnegative(),
  retryRps: z7.number().nonnegative(),
  servedRps: z7.number().nonnegative(),
  shedRps: z7.number().nonnegative(),
  failedRps: z7.number().nonnegative(),
  timedOutRps: z7.number().nonnegative(),
  authTokenRps: z7.number().nonnegative(),
  authTokenFailedRps: z7.number().nonnegative(),
  retryAmplificationFactor: z7.number().nonnegative(),
  queueDepth: z7.number().nonnegative(),
  connectionPressure: z7.number().nonnegative(),
  availability: z7.number().min(0).max(1),
  circuitState: z7.enum(["closed", "open", "half_open"]),
  saturated: z7.boolean(),
  activeFaultIds: z7.array(z7.string())
});
var resilienceScalingPolicyTelemetrySchema = z7.object({
  id: z7.string(),
  dependencyId: z7.string(),
  constrainedMetric: z7.enum(["rps", "concurrency"]),
  observationMetric: z7.enum(["source_cpu", "capacity_utilization"]),
  constrainedValuePercent: z7.number().nonnegative(),
  observedValuePercent: z7.number().nonnegative(),
  scaleOutThresholdPercent: z7.number().positive(),
  decision: z7.enum(["not_needed", "no_scale", "scale_out"])
});
var resilienceRetryActorTelemetrySchema = z7.object({
  id: z7.string(),
  retryRps: z7.number().nonnegative()
});
var resilienceCapacityAttributionSchema = z7.object({
  resourceId: z7.string(),
  role: z7.enum(["source", "target", "source_and_target"]),
  routableCapacityRps: z7.number().finite().nonnegative().nullable(),
  nominalCapacityRps: z7.number().finite().nonnegative().nullable().optional(),
  warmupCapacityLossRps: z7.number().finite().nonnegative().nullable().optional(),
  healthCapacityLossRps: z7.number().finite().nonnegative().nullable().optional()
});
var resilienceTelemetrySchema = z7.object({
  originalClientRps: z7.number().nonnegative(),
  totalAttemptedRps: z7.number().nonnegative(),
  retryRps: z7.number().nonnegative(),
  servedRps: z7.number().nonnegative(),
  shedRps: z7.number().nonnegative(),
  authTokenRps: z7.number().nonnegative(),
  authTokenFailedRps: z7.number().nonnegative(),
  retryAmplificationFactor: z7.number().nullable(),
  queueDepth: z7.number().nonnegative(),
  connectionPressure: z7.number().nonnegative(),
  incidentOutcome: z7.enum(["stable", "degraded", "cascading", "protected", "recovered"]),
  bounded: z7.boolean(),
  truncatedWorkItems: z7.number().int().nonnegative(),
  paths: z7.array(resiliencePathMetricsSchema).max(RESILIENCE_MAX_STEP_WORK),
  capacityByResource: z7.array(resilienceCapacityAttributionSchema).max(RESILIENCE_MAX_CAPACITY_ATTRIBUTIONS).optional(),
  scalingPolicies: z7.array(resilienceScalingPolicyTelemetrySchema).max(RESILIENCE_MAX_SCALING_POLICIES),
  externalMetrics: externalMetricsTelemetrySchema.optional(),
  retryActors: z7.array(resilienceRetryActorTelemetrySchema).max(RESILIENCE_MAX_DEPENDENCIES)
});
var resilienceComparisonRequestSchema = z7.object({
  steps: z7.number().int().min(1).max(120).default(20),
  baselineConfig: resilienceConfigSchema.optional(),
  mitigatedConfig: resilienceConfigSchema,
  mitigatedResources: z7.array(resourceSchema).max(256).optional(),
  mitigatedAutoscalingConfig: autoscalingConfigSchema.optional()
});
var resilienceIncidentOutcomeSchema = z7.object({
  rootTrigger: z7.object({
    faultIds: z7.array(z7.string()),
    faultTypes: z7.array(z7.enum(["capacity_limit", "concurrency_limit", "latency", "error_rate", "traffic_surge"])),
    targetResourceIds: z7.array(z7.string()),
    dependencyIds: z7.array(z7.string()),
    firstActiveStep: z7.number().int().nonnegative().nullable()
  }),
  retryAmplificationFactor: z7.number().nullable(),
  peakOriginalRps: z7.number().nonnegative(),
  peakAttemptedRps: z7.number().nonnegative(),
  peakErrorRate: z7.number().min(0).max(100),
  affectedDependencyIds: z7.array(z7.string()),
  protectiveControlsActivated: z7.array(z7.string()),
  timeToRecoverySteps: z7.number().int().nonnegative().nullable(),
  cascadeContained: z7.boolean(),
  runMetadata: z7.object({
    seed: z7.number().int().nonnegative(),
    startStep: z7.number().int().nonnegative(),
    endStep: z7.number().int().nonnegative(),
    steps: z7.number().int().positive(),
    trafficRps: z7.number().nonnegative(),
    configVersion: z7.number().int().positive(),
    faultIds: z7.array(z7.string())
  })
});
var resilienceRunSummarySchema = z7.object({
  config: resilienceConfigSchema,
  peakRetryAmplificationFactor: z7.number().nullable(),
  peakErrorRate: z7.number().nonnegative(),
  peakLatencyP95: z7.number().nonnegative(),
  totalServedRequests: z7.number().nonnegative(),
  totalShedRequests: z7.number().nonnegative(),
  finalOutcome: z7.enum(["stable", "degraded", "cascading", "protected", "recovered"]),
  incidentOutcome: resilienceIncidentOutcomeSchema
});
var resilienceComparisonSchema = z7.object({
  seed: z7.number().int().nonnegative(),
  startStep: z7.number().nonnegative(),
  traffic: z7.number().nonnegative(),
  steps: z7.number().int().positive(),
  baseline: resilienceRunSummarySchema,
  mitigated: resilienceRunSummarySchema,
  delta: z7.object({
    retryAmplificationFactor: z7.number().nullable(),
    errorRate: z7.number(),
    latencyP95: z7.number(),
    shedRequests: z7.number()
  })
});
var scenarioAttributionSchema = z7.object({
  id: z7.string(),
  version: z7.string().nullable(),
  revision: z7.string().nullable(),
  source: z7.literal("scenario-catalog")
});
var replayInputSnapshotSchema = z7.object({
  resources: z7.array(resourceSchema),
  connections: z7.array(connectionSchema).default([]),
  // Traffic patterns are stored as a frozen ordered receipt at execution
  // start. Keep this loose because trafficPatternSchema is declared later.
  trafficPatterns: z7.array(z7.unknown()).optional(),
  finalized: z7.boolean().optional()
});
var resilienceReceiptSchema = z7.object({
  startStep: z7.number().int().nonnegative(),
  endStep: z7.number().int().nonnegative(),
  terminalMetric: z7.unknown(),
  completedResult: z7.unknown(),
  metricCount: z7.number().int().nonnegative(),
  eventCount: z7.number().int().nonnegative()
}).strict();
var appWeightSchema = z7.enum(["lean", "typical", "heavy"]);
var predictionEvidenceLevelSchema = z7.enum(["measured", "scaled from measured", "reference estimate"]);
var predictionRangeSchema = z7.object({
  low: z7.number().finite().nonnegative(),
  central: z7.number().finite().nonnegative(),
  high: z7.number().finite().nonnegative()
});
var predictionQuantityEvidenceSchema = predictionRangeSchema.extend({
  evidenceLevel: predictionEvidenceLevelSchema
});
var predictionLatencyAvailabilitySchema = z7.object({
  status: z7.literal("unavailable"),
  reason: z7.string().min(1),
  resourceIds: z7.array(z7.string().min(1))
}).strict();
var predictionEvidenceSchema = z7.object({
  version: z7.literal(1),
  evidenceLevel: predictionEvidenceLevelSchema,
  legacyGeneric: z7.boolean(),
  appWeight: appWeightSchema,
  appWeightDefaulted: z7.boolean(),
  loadScope: z7.enum(["within measured load", "beyond measured load", "below measured load", "not calibrated"]),
  sourceIds: z7.array(z7.string()),
  formulaIds: z7.array(z7.string()),
  appCpu: predictionRangeSchema.nullable(),
  appCpuByResource: z7.array(predictionQuantityEvidenceSchema.extend({
    resourceId: z7.string(),
    legacyGeneric: z7.boolean()
  })),
  requestServingCapacity: z7.array(z7.object({
    resourceId: z7.string(),
    resourceName: z7.string(),
    taskCount: z7.number().int().nonnegative(),
    perTaskCapacityRps: z7.number().positive(),
    aggregateCapacityRps: z7.number().nonnegative(),
    maxTaskCount: z7.number().int().positive(),
    maxAggregateCapacityRps: z7.number().nonnegative(),
    capacityEvidence: z7.object({
      basis: z7.enum(["assumption", "documented", "measured", "catalog"]),
      origin: z7.enum(["caller-provided", "fargate-size-heuristic", "policy-default", "provider-catalog"]),
      source: z7.string().optional()
    })
  })).optional(),
  latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
  latencyPercentileStatus: z7.enum(["modeled", "unavailable"]).optional(),
  latencyP50: predictionQuantityEvidenceSchema.nullable(),
  latencyP95: predictionQuantityEvidenceSchema.nullable(),
  latencyP99: predictionQuantityEvidenceSchema.nullable().optional(),
  note: z7.string()
});
var legacyPredictionEvidenceSchema = z7.object({
  version: z7.literal(1),
  evidenceLevel: z7.literal("unavailable/legacy"),
  legacyGeneric: z7.null().optional(),
  appWeight: z7.null(),
  appWeightDefaulted: z7.null(),
  loadScope: z7.null(),
  sourceIds: z7.array(z7.string()),
  formulaIds: z7.array(z7.string()),
  appCpu: z7.null(),
  appCpuByResource: z7.array(predictionQuantityEvidenceSchema.extend({ resourceId: z7.string() })).max(0),
  latencyP50: z7.null(),
  latencyP95: z7.null(),
  latencyP99: z7.null().optional(),
  note: z7.string()
});
var preGenericFlagPredictionEvidenceSchema = z7.object({
  version: z7.literal(1),
  evidenceLevel: predictionEvidenceLevelSchema,
  legacyGeneric: z7.boolean().optional(),
  appWeight: appWeightSchema,
  appWeightDefaulted: z7.boolean(),
  loadScope: z7.enum(["within measured load", "beyond measured load", "below measured load", "not calibrated"]),
  sourceIds: z7.array(z7.string()),
  formulaIds: z7.array(z7.string()),
  appCpu: predictionRangeSchema.nullable(),
  appCpuByResource: z7.array(predictionQuantityEvidenceSchema.extend({
    resourceId: z7.string(),
    legacyGeneric: z7.boolean().optional()
  })),
  latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
  latencyPercentileStatus: z7.enum(["modeled", "unavailable"]).optional(),
  latencyP50: predictionQuantityEvidenceSchema.nullable(),
  latencyP95: predictionQuantityEvidenceSchema.nullable(),
  latencyP99: predictionQuantityEvidenceSchema.nullable().optional(),
  note: z7.string()
});
var storedPredictionEvidenceSchema = z7.union([
  predictionEvidenceSchema,
  legacyPredictionEvidenceSchema,
  preGenericFlagPredictionEvidenceSchema
]);
var simulationSchema = z7.object({
  appWeight: appWeightSchema.optional(),
  appWeightDefaulted: z7.boolean().optional(),
  predictionEvidence: storedPredictionEvidenceSchema.optional(),
  id: z7.string(),
  name: z7.string(),
  description: z7.string().optional(),
  resources: z7.array(resourceSchema),
  connections: z7.array(connectionSchema).default([]),
  currentTime: z7.number().default(0),
  traffic: z7.number().min(0).default(0),
  isRunning: z7.boolean().default(false),
  playbackSpeed: z7.number().default(1),
  lastCostPerHour: z7.number().default(0),
  crossedCostThresholds: z7.array(z7.number()).default([]),
  lastScaleTime: z7.number().optional(),
  cooldownUntil: z7.number().optional(),
  scaleInCooldownUntil: z7.number().optional(),
  scalingHistory: z7.array(scalingEventSchema).default([]),
  autoscalingConfig: autoscalingConfigSchema.optional(),
  // Request-only aliases resolved into autoscalingConfig.scaleOutCpuThreshold
  // by route intake. They are removed before a simulation is persisted.
  ...autoscalingTargetAliasFields,
  // Explicit opt-in dependency retry/cascade model. Existing simulations that
  // omit this field never traverse connections and remain byte-equivalent.
  resilienceConfig: resilienceConfigSchema.optional(),
  apiKeyId: z7.string().optional(),
  ownerWallet: z7.string().optional(),
  expiresAt: z7.string().optional(),
  uiSessionId: z7.string().optional(),
  demoStepCount: z7.number().optional(),
  isRlClone: z7.boolean().optional(),
  seed: z7.number().int().nonnegative().optional(),
  engineVersion: z7.string().optional(),
  scenarioHash: z7.string().length(64).optional(),
  /** Transport projection: prediction hash; replay-only hash is nested below. */
  effectiveConfigHash: z7.string().length(64).optional(),
  replayIdentity: z7.object({
    scenarioHash: z7.string().length(64),
    effectiveConfigHash: z7.string().length(64)
  }).optional(),
  /** Alias for the versioned transport effectiveConfigHash prediction identity. */
  predictionEffectiveConfigHash: z7.string().length(64).optional(),
  calibrationEvidence: z7.object({
    kind: z7.enum(["owned", "owned-scaled", "modeled"]),
    latencyBasis: z7.string(),
    latencyP99Basis: z7.string().optional(),
    calibrationId: z7.string().optional(),
    note: z7.string()
  }).optional(),
  rngAlgorithm: z7.string().optional(),
  // Immutable, versioned receipt created at simulation intake. It records
  // requested Kubernetes inputs, effective engine values, and provenance.
  normalizationReceipt: z7.unknown().optional(),
  scenarioAttribution: scenarioAttributionSchema.optional(),
  replayInputSnapshot: replayInputSnapshotSchema.optional(),
  resilienceReceipt: resilienceReceiptSchema.optional(),
  createdAt: z7.string(),
  updatedAt: z7.string()
});
var kubernetesCpuHpaTelemetrySchema = z7.object({
  resourceId: z7.string(),
  name: z7.string(),
  cpuRequestMilliCores: z7.number().positive().optional(),
  cpuRequestProvenance: z7.object({
    basis: z7.enum(["ASSUMED", "EVIDENCE", "UNDECLARED"]),
    source: z7.enum(["calibrated", "external"]).optional(),
    reference: z7.string().optional()
  }).strict(),
  cpuDemandMilliCoresPerRps: z7.number().positive(),
  cpuDemandProvenance: z7.object({
    basis: z7.enum(["ASSUMED", "EVIDENCE"]),
    source: z7.enum(["calibrated", "external"]).optional(),
    reference: z7.string().optional()
  }).strict(),
  offeredRps: z7.number().nonnegative(),
  observedCpuMilliCoresPerPod: z7.number().nonnegative(),
  currentReplicas: z7.number().int().positive(),
  minReplicas: z7.number().int().positive(),
  maxReplicas: z7.number().int().positive(),
  targets: z7.array(z7.object({
    type: z7.enum(["Utilization", "AverageValue"]),
    targetValue: z7.number().positive(),
    currentMetric: z7.number().nonnegative().optional(),
    desiredReplicas: z7.number().int().positive().nullable(),
    error: z7.object({
      code: z7.literal("MISSING_CPU_REQUEST"),
      message: z7.string()
    }).strict().optional()
  }).strict()),
  desiredReplicas: z7.number().int().positive().nullable(),
  appliedReplicas: z7.number().int().positive(),
  scaleDownStabilizationSteps: z7.number().int().positive().optional(),
  scaleDownStabilizationHeld: z7.boolean(),
  scaleDownStabilizationReason: z7.string().optional(),
  modelScope: z7.literal("workload-replicas-only; no Kubernetes controller parity claim")
}).strict();
var metricsSchema = z7.object({
  sessionAffinity: z7.array(sessionAffinityEvidenceSchema).optional(),
  appWeight: appWeightSchema.optional(),
  appWeightDefaulted: z7.boolean().optional(),
  predictionEvidence: storedPredictionEvidenceSchema.optional(),
  dataIntegrity: z7.array(z7.object({
    resourceId: z7.string(),
    resourceName: z7.string(),
    serviceAvailability: z7.enum(["available", "degraded", "unavailable"]),
    dataState: z7.enum(["intact", "temporarily_unavailable", "permanently_lost"]),
    recoverySource: z7.enum(["none", "surviving_backup", "surviving_replica"]),
    recoverySourceResourceId: z7.string().optional()
  })).optional(),
  /**
   * Storage-assigned identity for this persisted metric record. It is absent
   * only for transient/pre-persistence metric values.
   */
  metricId: z7.string().min(1).optional(),
  simulationId: z7.string(),
  timestamp: z7.number(),
  /** Prediction provenance captured when this metric was persisted. */
  engineVersion: z7.string().optional(),
  predictionEffectiveConfigHash: z7.string().length(64).optional(),
  latencyBasis: z7.string().optional(),
  latencyP99Basis: z7.string().optional(),
  latencyPercentileStatus: z7.enum(["modeled", "unavailable"]).optional(),
  calibrationEvidence: z7.object({
    kind: z7.enum(["owned", "owned-scaled", "modeled"]),
    latencyBasis: z7.string(),
    latencyP99Basis: z7.string().optional(),
    calibrationId: z7.string().optional(),
    note: z7.string()
  }).optional(),
  // Persisted engine values stay numeric for deterministic simulation.
  // Public read transports may return null when percentile evidence is unavailable.
  latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
  latencyP50: z7.number(),
  latencyP95: z7.number(),
  latencyP99: z7.number(),
  cpuUsage: z7.number(),
  memoryUsage: z7.number(),
  /**
   * Aggregate original-client request rate offered during this metric's time
   * slice. The normal simulation engine emits this on each final top-level
   * step result, and current metric history persists it. It remains optional
   * for legacy histories. `throughput` is goodput, while retry/path and
   * per-resource rates have different denominators and MUST NOT be substituted
   * here. For final client accounting, failed client RPS is
   * `offeredRps * errorRate / 100`; the rate and `throughput` use this same
   * denominator. When present, this is the only request denominator the
   * resilience outcome analyzer may treat as observed.
   */
  offeredRps: z7.number().nonnegative().optional(),
  /**
   * Aggregate requests per second rejected by modeled hard capacity in this
   * metric slice. This is a subset of the final errorRate failures, not an
   * additional failure count. It is optional when complete aggregate capacity
   * evidence is unavailable; the engine never infers it from goodput or errors.
   * Do not add it to failed client RPS when reconciling offered traffic.
   */
  modeledShedRps: z7.number().nonnegative().optional(),
  /**
   * Successfully served requests per second (goodput), after the error rate
   * and any modeled throughput shedding have been applied. For explicit
   * dependency graphs, terminal path goodput and final errorRate are reconciled
   * on the original-client offeredRps denominator. When a resilience dependency
   * targets a member of an autoscaled compute fleet, its modeled capacity and
   * health are aggregated across the fleet's routable members; a non-autoscaled
   * compute target uses its resolved resource capacity (including any declared
   * fixed-instance count) once. Retry amplification is
   * (original client RPS + generated retry RPS) / original client RPS, not a
   * capacity or goodput measure. Goodput is not offered traffic and must never
   * be multiplied by `(1 - errorRate / 100)` again.
   */
  /** Requests completed in this interval. During queue drain this may exceed
   * offeredRps; backlogDrainRps and requestServing.applicationQueue receipts
   * identify completions from earlier arrivals. */
  throughput: z7.number(),
  /** Portion of completed throughput above this interval's newly offered RPS,
   * which is backlog work completed from a prior interval. */
  backlogDrainRps: z7.number().nonnegative().optional(),
  /** Client-level failure rate against offeredRps. Explicit resilience paths
   *  reconcile terminal-path goodput against original client demand; a target
   *  in a materialized autoscaling fleet uses aggregate capacity and member
   *  health, while an independent target counts once. */
  errorRate: z7.number().min(0).max(100),
  costPerHour: z7.number(),
  /** Subtotal of unavailable, parked, or stopped resource costs. Healthy/degraded idle resources, including ALBs, are excluded. */
  residualCostPerHour: z7.number().nonnegative().optional(),
  residualCostDefinition: z7.string().optional(),
  lastCostPerHour: z7.number().optional(),
  cacheHitRate: z7.number().optional(),
  cdnFlow: cdnFlowSchema.optional(),
  queueDepth: z7.number().optional(),
  queueFillPct: z7.number().optional(),
  k8sNodeUtilization: z7.number().optional(),
  // Inference metrics — present only when the simulation contains a GPU
  // (inferenceMode) kubernetes resource. costPerMillionTokens is null when
  // no tokens are being generated (zero traffic → infinite per-token cost).
  gpuUtilization: z7.number().optional(),
  tokensPerSecond: z7.number().optional(),
  costPerMillionTokens: z7.number().nullable().optional(),
  // Idle HA overhead — share of the GPU bill funding standby (non-serving)
  // node capacity, and that share expressed in $/hr. Present only alongside
  // the other inference metrics.
  idleGpuCostPerHour: z7.number().optional(),
  idleGpuFraction: z7.number().optional(),
  // Per-request TTFT and decode latency decomposition for inference-mode GPU
  // resources (inferenceMode: true kubernetes clusters). Both fields are absent
  // on non-inference simulations so existing consumers stay byte-identical.
  //
  // ttftP50Ms    — weighted-average time-to-first-token (ms) across all GPU
  //                clusters in the simulation; derived from the accelerator's
  //                TTFT base, the prompt-token count (inputTokensPerRequest),
  //                and the topology TTFT factor (resolveTopologyLatencyFactors).
  //                Accounts for batch-pressure at the step's GPU utilization.
  //                null is not used — the field is simply absent when no GPU
  //                inference resources are present.
  //
  // decodeTokensPerSec — weighted-average effective decode throughput (tokens/s)
  //                across all GPU clusters; derived from the accelerator's decode
  //                rate and the topology decode factor, adjusted for batch pressure.
  //                Consumers can convert to decode latency: ms = (outputTokens /
  //                decodeTokensPerSec) * 1000.
  ttftP50Ms: z7.number().optional(),
  decodeTokensPerSec: z7.number().optional(),
  storageIopsUtilization: z7.number().optional(),
  connectionPressure: z7.number().optional(),
  // Null/absent means the resilience model did not run. Never synthesize 1.0
  // for disabled simulations: that would incorrectly imply retries were modeled.
  retryAmplificationFactor: z7.number().nullable().optional(),
  resilience: resilienceTelemetrySchema.optional(),
  /** Current per-step health-check and replacement lifecycle evidence. */
  healthCheckLifecycle: z7.array(healthCheckLifecycleSchema).max(64).optional(),
  serverless: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    instanceRole: z7.enum(["writer", "reader"]).optional(),
    scalingMode: z7.enum(["writer-mirror", "independent"]).optional(),
    cpuBasis: z7.string().optional(),
    billingReason: z7.string().optional(),
    ratePerAcuHour: z7.number().optional(),
    rateBasis: z7.string().optional(),
    cpuUtil: z7.number(),
    acu: z7.number(),
    minAcu: z7.number(),
    maxAcu: z7.number(),
    warming: z7.boolean(),
    costPerHour: z7.number(),
    connectionPressure: z7.number(),
    connectionLimit: z7.number(),
    effectiveConnectionLimit: z7.number().optional(),
    minConnectionLimit: z7.number(),
    maxConnectionLimit: z7.number()
  })).optional(),
  compute: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    cpuUtil: z7.number(),
    warming: z7.boolean(),
    warmupStepsRemaining: z7.number(),
    warmupFactor: z7.number()
  })).optional(),
  databases: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    auroraFailover: z7.object({
      failedResourceId: z7.string(),
      standbyResourceId: z7.string(),
      succeeded: z7.boolean(),
      phase: z7.enum(["promoting", "serving", "unavailable"])
    }).optional(),
    cpuUtil: z7.number(),
    /** Configured connection ceiling; the serving ceiling may be lower during modeled overload. */
    maxConnections: z7.number(),
    effectiveConnectionLimit: z7.number(),
    /** Modeled demand divided by the effective limit; this is not an observed session count. */
    connectionPressure: z7.number(),
    /**
     * Worst-case plan-time budget from directly connected compute fleet maxima;
     * never observed live sessions and never used to change cost, database CPU, or latency.
     */
    declaredFleetConnectionBudget: z7.number().nonnegative().optional(),
    /**
     * Plan-time fleet budget divided by this database's effective connection limit.
     * Omitted when the effective limit is unavailable or nonpositive.
     */
    declaredFleetConnectionPressure: z7.number().nonnegative().optional(),
    declaredFleetConnectionBudgetBasis: z7.literal(
      "ASSUMPTION / maximum declared fleet \xD7 app pool size; not observed live DB connections"
    ).optional(),
    declaredFleetConnectionBudgetTiers: z7.array(z7.object({
      resourceId: z7.string(),
      resourceName: z7.string(),
      resourceIds: z7.array(z7.string()).min(1),
      instanceCount: z7.number().int().positive(),
      poolSize: z7.number().int().positive(),
      connectionBudget: z7.number().nonnegative(),
      fleetSizeBasis: z7.enum([
        "autoscaling_max",
        "request_serving_max",
        "fixed_instance_count",
        "fixed_fleet_bound",
        "single_resource_default"
      ])
    })).optional(),
    /** Present when this DB explicitly configures connectionDemand. */
    connectionDemandMode: z7.enum(["load-derived", "declared", "max"]).optional(),
    /** Traffic-derived connection estimate; keep separate from fleet budget and live pressure. */
    loadDerivedConnections: z7.number().nonnegative().optional(),
    loadDerivedBasis: z7.literal("load-derived estimate; not observed live DB connections").optional(),
    /** Plan-time budget inputs; not observed live connection counts. */
    declaredConnections: z7.number().nonnegative().optional(),
    idlePoolFloor: z7.number().nonnegative().optional(),
    /** Demand selected by connectionDemand.mode, before the pressure cap. */
    modeledConnections: z7.number().nonnegative().optional(),
    isServerless: z7.boolean()
  })).optional(),
  loadBalancers: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    routedRps: z7.number(),
    cpuUtil: z7.number(),
    lbLatencyMs: z7.number(),
    lbUtil: z7.number(),
    // percent (0–100), same scale as cpuUtil
    targetErrorRate: z7.number()
  })).optional(),
  /**
   * Per-Kubernetes-resource capacity-ceiling accounting for the step. Present only
   * when the simulation contains at least one kubernetes resource. The ceiling is
   * the directly declared cluster-level maxThroughput (fixed across node
   * scaling), or the sum of nodeCount × per-node maxThroughput for pools.
   * When offeredRps exceeds the ceiling the engine caps servedRps (routedRps) to
   * the ceiling and sheds the excess (shedRps), inflating p95 latency and — above
   * the overload threshold — error rate. GPU/CPU utilisation still reflects the
   * full offered load pressure.
   */
  kubernetes: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    capacityCeilingRps: z7.number(),
    nodeCount: z7.number().optional(),
    perNodeCapacityRps: z7.number().optional(),
    offeredRps: z7.number(),
    servedRps: z7.number(),
    shedRps: z7.number(),
    overloadRatio: z7.number()
  })).optional(),
  /** Per-step EKS Spot interruption migration telemetry (opt-in only). */
  eksSpotInterruptions: z7.array(eksSpotInterruptionTelemetrySchema).optional(),
  /**
   * Per-replica Kubernetes memory-pressure telemetry (see
   * kubernetesMemoryProfileSchema). Present only for kubernetes resources; a
   * cluster without an explicit profile still reports a
   * `evaluationStatus: "not_evaluated"` row so consumers never mistake
   * silence for "no risk". This is fully separate from the aggregate
   * `memoryUsage` metric and from CPU/RPS-based inference — never a fallback
   * signal for one another. Any `evaluationStatus: "limit_exceeded"` row this
   * step reduces the resource's effective kubernetes capacity-ceiling entry
   * above (`kubernetes[].capacityCeilingRps`) for the affected window; it
   * never changes kubernetes node billing.
   *
   * Multi-pool clusters (`characteristics.nodePools`) report ONE ROW PER
   * NODE POOL, all sharing the same `resourceId` — pools with their own
   * per-pool `kubernetesMemoryProfile` get a fully evaluated row (OOM/restart
   * cascade included); pools without one get a `missing_memory_profile` row.
   * `poolId` distinguishes rows from the same cluster; consumers must
   * `.filter(resourceId)` rather than assume a single `.find` match for
   * multi-pool clusters. Single-pool clusters keep the original one-row
   * shape with `poolId` absent.
   */
  kubernetesMemory: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    /** Which node pool this row applies to — a stable, GUARANTEED-unique
     *  identifier (see server/simulation-engine.ts's assignK8sPoolIds):
     *  `pool.name` when unique among siblings, `pool-N` when unnamed, or
     *  `<name>#N`/`pool-N` (1-indexed) when a name collides with another
     *  pool's. Absent for single-pool clusters (the legacy shape). */
    poolId: z7.string().optional(),
    limitGiB: z7.number().positive().optional(),
    requestGiB: z7.number().positive().optional(),
    /** Effective pod replica count used by the per-replica memory model. */
    nodeCount: z7.number().int().nonnegative(),
    /** Modeled worker-node count represented by this row. */
    modeledNodeCount: z7.number().int().nonnegative().optional(),
    /** Modeled worker nodes represented by each pod replica. */
    nodesPerReplica: z7.number().int().positive().optional(),
    evaluated: z7.boolean(),
    evaluationStatus: z7.enum(["not_evaluated", "within_limit", "limit_exceeded"]),
    evaluationBasis: z7.enum([
      "explicit_memory_profile",
      "missing_memory_profile",
      "unsupported_multi_pool_topology",
      "native_configuration_only"
    ]),
    memoryEvidence: kubernetesMemoryEvidenceSchema.optional(),
    /**
     * The resource's total offered RPS for this step — the SAME value fed
     * into `perReplicaRps` (perReplicaRps × survivingReplicas ≈ offeredRps)
     * and into the CPU/capacity-ceiling accounting above. Always present,
     * even on "not_evaluated" rows, so a consumer can reconstruct why a
     * given perReplicaRps occurred without cross-referencing
     * `metrics.kubernetes`.
     */
    offeredRps: z7.number().nonnegative(),
    /**
     * Which existing traffic-distribution rule produced this resource's
     * share of offered traffic — the SAME rule already driving CPU and
     * capacity-ceiling accounting, now made machine-readable instead of
     * implicit. `single_resource`: this is the only compute/kubernetes
      * resource in the simulation (gets 100% of traffic). `even_split`:
      * traffic is split evenly because of an explicit load balancer or a
      * horizontally-autoscaled tier; a proven shared autoscaling group uses
      * its logical fleet share in proportion to explicit member capacities.
      * `unbalanced_80_20`: no load balancer and no proven shared
      * fleet — the first logical resource/fleet (creation order) gets 80% of
      * traffic and the rest evenly share the remaining 20%.
     */
    routingRule: z7.enum([
      "single_resource",
      "even_split",
      "unbalanced_80_20",
      "isolated_target",
      "unevaluable"
    ]),
    perReplicaRps: z7.number().nonnegative().optional(),
    modeledDemandPerReplicaGiB: z7.number().nonnegative().optional(),
    headroomGiB: z7.number().optional(),
    source: z7.enum(["user-provided", "calibrated", "external"]).optional(),
    confidence: z7.enum(["low", "medium", "high"]).optional(),
    restartingReplicas: z7.number().int().nonnegative().optional(),
    /** Number of serving replicas available when this step's demand was
     * evaluated, before applying any OOMs triggered by that evaluation. */
    preEvaluationServingReplicas: z7.number().int().nonnegative().optional(),
    /** Number of serving replicas after this step's OOM/restart effect. */
    postEffectServingReplicas: z7.number().int().nonnegative().optional(),
    /** Backwards-compatible alias for postEffectServingReplicas. */
    effectiveServingReplicas: z7.number().int().nonnegative().optional(),
    oomReplicasThisStep: z7.number().int().nonnegative().optional(),
    recoveredReplicasThisStep: z7.number().int().nonnegative().optional(),
    /** Capacity accounting copied from metrics.kubernetes for direct
     * reconciliation with this memory-pressure row. */
    effectiveCapacityFraction: z7.number().min(0).max(1),
    capacityCeilingRps: z7.number().nonnegative().optional(),
    servedRps: z7.number().nonnegative().optional(),
    shedRps: z7.number().nonnegative().optional(),
    overloadRatio: z7.number().nonnegative().optional(),
    capacityStatus: z7.enum(["enforced", "no_ceiling"]),
    capacityStatusReason: z7.string(),
    cpuUsagePercent: z7.number().optional(),
    memoryPressureRatio: z7.number().optional(),
    memoryAwareAutoscaling: z7.boolean(),
    /** Which signal drove (or would have driven) the scale-out decision this
     *  step. "cpu" / "memory" / "both" / "none" once autoscaling evaluates the
     *  cluster; absent when this row was produced before autoscaling ran. */
    autoscaleDriver: z7.enum(["cpu", "memory", "both", "none"]).optional(),
    /** The effective above-last-breakpoint extrapolation policy actually
     *  applied to this profile this step (see kubernetesMemoryProfileSchema's
     *  `extrapolation` field). Present only for a profiled resource; absent
     *  on "not_evaluated"/unsupported rows, consistent with the other
     *  profile-derived optional fields above. */
    extrapolationPolicy: z7.enum(["clamp", "linear"]).optional(),
    message: z7.string()
  })).optional(),
  /**
   * Per-step CPU-request HPA workload evidence. These recommendations change
   * the configured pod replica count only; Kubernetes worker nodes are handled
   * by the separate cluster autoscaling model.
   */
  kubernetesCpuHpa: z7.array(kubernetesCpuHpaTelemetrySchema).optional(),
  /** Per-request-serving-compute lifecycle and capacity telemetry. Present for
   * Cloud Run and future policies that use the shared contract. */
  requestServing: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    serviceFamily: z7.string(),
    containerCpu: z7.number(),
    containerMemoryGiB: z7.number(),
    concurrency: z7.number(),
    requestDurationSeconds: z7.number(),
    activeInstances: z7.number().int().nonnegative(),
    minInstances: z7.number().int().nonnegative(),
    maxInstances: z7.number().int().positive(),
    provisionedInstances: z7.number().int().nonnegative().optional().describe("For ECS Fargate this is the number of currently running tasks, not desired task count."),
    /** During ECS scale-in, excess running tasks remain serving and billable until their drain completes. */
    drainingTasks: z7.number().int().nonnegative().optional(),
    serviceKind: z7.enum(["function", "container"]).optional(),
    desiredTaskCount: z7.number().int().nonnegative().optional(),
    /** Remaining startup countdown; positive while desired tasks are not running yet. */
    fargateStartupStepsRemaining: z7.number().int().nonnegative().optional(),
    /** Desired ECS tasks not yet running because task startup is in progress. */
    initializingTasks: z7.number().int().nonnegative().optional(),
    applicationQueue: z7.object({
      previousDepth: z7.number().nonnegative(),
      offeredRequests: z7.number().nonnegative(),
      capacityRequests: z7.number().nonnegative(),
      seconds: z7.number().positive(),
      depth: z7.number().nonnegative(),
      completedQueuedRequests: z7.number().nonnegative(),
      completedIncomingRequests: z7.number().nonnegative(),
      acceptedQueuedRequests: z7.number().nonnegative(),
      shedRequests: z7.number().nonnegative(),
      drainSeconds: z7.number().nonnegative().nullable()
    }).optional(),
    minTaskCount: z7.number().int().nonnegative().optional(),
    maxTaskCount: z7.number().int().positive().optional(),
    perTaskCapacityRps: z7.number().positive().optional(),
    aggregateCapacityRps: z7.number().nonnegative().optional().describe("Aggregate capacity from active running tasks; tasks reported as draining still serve and bill until drain completes."),
    perTaskCapacityEvidence: z7.object({
      basis: z7.enum(["assumption", "documented", "measured", "catalog"]),
      origin: z7.enum(["caller-provided", "fargate-size-heuristic", "policy-default", "provider-catalog"]),
      source: z7.string().optional()
    }).optional(),
    taskStartupSeconds: z7.number().nonnegative().optional(),
    taskScaleDownSeconds: z7.number().nonnegative().optional(),
    /** Resolved fleet ceiling for Lambda-like request-serving functions. */
    maxCapacityRps: z7.number().nonnegative().optional(),
    /** Count of Lambda execution environments created during this step. */
    coldStartCount: z7.number().int().nonnegative().optional(),
    /** Newly created Lambda environments still initializing this step. */
    initializingInstances: z7.number().int().nonnegative().optional(),
    /** Configured initialization delay applied to requests routed to new environments. */
    coldStartLatencyMs: z7.number().nonnegative().optional(),
    /** Approximate offered request rate affected by the initializing cohort. */
    coldStartAffectedRequestRps: z7.number().nonnegative().optional(),
    /** Rolling deployment progress — present only while a deploy is in flight. */
    rollingDeploy: z7.object({
      replacingCount: z7.number().int().nonnegative(),
      maxSurge: z7.number().int().positive(),
      pendingTasks: z7.number().int().nonnegative(),
      drainingTasks: z7.number().int().nonnegative(),
      startupStepsRemaining: z7.number().int().nonnegative(),
      drainStepsRemaining: z7.number().int().nonnegative()
    }).optional(),
    capacityRps: z7.number().nonnegative(),
    scalingState: z7.enum(["scaled_to_zero", "cold_start", "active", "minimum_warm", "initializing", "scaling_in"]).describe("For ECS, scaling_in means scale-in toward the configured floor is in progress; when active exceeds desired, excess tasks remain serving and billable while draining."),
    /** Fraction of capacity that has cleared the application-readiness check (0–1).
     * 1.0 when appReadySteps = 0 (the default) or the ramp has completed.
     * Present only when a resource is in the 'initializing' state. CWM estimate. */
    readyFraction: z7.number().min(0).max(1).optional(),
    /** Cloud Run's selected request-serving price policy region. */
    policyRegion: z7.string().optional(),
    /** Published rate metadata for regional Cloud Run request-serving billing. */
    rateProvenance: z7.object({
      basis: z7.enum(["on-demand", "spot", "estimated"]),
      resolution: z7.enum([
        "exact-catalog",
        "large-sku",
        "entry-level-fallback",
        "base-rate-multiplier",
        "cloud-run-request-based",
        "request-serving-usage-based",
        "fargate-task-vcpu-memory",
        "aurora-acu-hour"
      ]),
      lastVerified: z7.string().nullable(),
      region: z7.string().nullable(),
      sku: z7.string().optional(),
      source: z7.string().optional(),
      architecture: z7.string().optional()
    }).optional()
  })).optional(),
  /**
   * Explicit runtime working-set telemetry. This is emitted only for
   * simulations containing a profile so old/no-profile metric payloads stay
   * byte-equivalent. `memoryUsage` remains an unrelated aggregate synthetic
   * metric and must never be treated as a fallback profile.
   */
  runtimeMemory: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    configuredLimitGiB: z7.number().positive(),
    activeInstances: z7.number().int().nonnegative(),
    concurrency: z7.number().int().positive(),
    evaluated: z7.boolean(),
    evaluationStatus: z7.enum(["not_evaluated", "within_limit", "limit_exceeded"]),
    evaluationBasis: z7.enum(["explicit_working_set_profile", "missing_working_set_profile"]),
    modeledDemandGiB: z7.number().positive().optional(),
    headroomGiB: z7.number().optional(),
    source: z7.enum(["user-provided", "calibrated", "external"]).optional(),
    confidence: z7.enum(["low", "medium", "high"]).optional(),
    limitExceededProbability: z7.number().min(0).max(1).optional(),
    terminationState: z7.enum(["not_applicable", "none", "terminated", "restarting"]),
    behaviorApplied: z7.boolean(),
    failedWorkRps: z7.number().nonnegative().optional(),
    retryRps: z7.number().nonnegative().optional(),
    latencyPenaltyMs: z7.number().nonnegative().optional(),
    retryCostPerHour: z7.number().nonnegative().optional(),
    message: z7.string()
  })).optional(),
  egressCostPerHour: z7.number().optional(),
  costBreakdown: z7.array(z7.object({
    resourceId: z7.string(),
    name: z7.string(),
    instanceRole: z7.enum(["writer", "reader"]).optional(),
    scalingMode: z7.enum(["writer-mirror", "independent"]).optional(),
    billableAcu: z7.number().optional(),
    ratePerAcuHour: z7.number().optional(),
    rateBasis: z7.string().optional(),
    billingReason: z7.string().optional(),
    resourceType: z7.string(),
    provider: z7.string(),
    costPerHour: z7.number(),
    /** Allocated request rate used for this step's modeled DynamoDB request-volume charge. */
    dynamoDbRequestRateRps: z7.number().nonnegative().optional(),
    /** Current serving classification joined from the live resource when exposed by a cost route. */
    availabilityState: z7.enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"]).optional(),
    /** Whether the resource is currently receiving routed traffic, when tracked. */
    isRoutable: z7.boolean().optional(),
    /** Current routed requests per second, when tracked. */
    routedRps: z7.number().optional(),
    /** Current raw health severity, when a metrics payload includes the live join. */
    status: z7.string().optional(),
    cpuUsage: z7.number().optional(),
    storageCostPerHour: z7.number().optional(),
    /** Explicit caller CPU/window estimate, never inferred from simulation CPU. */
    rdsSqlServerBilling: z7.object({
      input: rdsSqlServerBillingSchema,
      computeCost: z7.number(),
      licensingCost: z7.number().min(0).max(0),
      storageCost: z7.number(),
      cpuCreditCost: z7.number(),
      totalCost: z7.number(),
      effectiveHourlyCost: z7.number(),
      workloadVcpus: z7.number(),
      credits: z7.object({
        earnedCredits: z7.number(),
        consumedCredits: z7.number(),
        creditCap: z7.number(),
        endingCreditBalance: z7.number(),
        endingSurplusCreditBalance: z7.number(),
        chargedCredits: z7.number(),
        overflowChargedCredits: z7.number(),
        settlementChargedCredits: z7.number()
      }),
      assumptions: z7.array(z7.string())
    }).optional(),
    storageGb: z7.number().optional(),
    storageGbRate: z7.number().optional(),
    /** Fixed per-hour fee component (USD/hr). Present on NAT gateway and
     *  private endpoint resources — the flat hourly charge regardless of traffic. */
    fixedFeePerHour: z7.number().optional(),
    /** Traffic-proportional data-processing component (USD/hr). Present on NAT
     *  gateway and private endpoint resources when traffic > 0.
     *  fixedFeePerHour + dataProcessingCostPerHour === costPerHour. */
    dataProcessingCostPerHour: z7.number().optional(),
    /** GPU inference cluster rate source. Present only on inferenceMode K8s clusters.
     *  'catalog'  = GPU_LARGE_NODE_HOURLY_RATES SKU matched (rate is exact on-demand).
     *  'caller'   = characteristics.perNodeRate used as-is (user-supplied).
     *  'excluded' = neither matched; costPerHour is 0 (known gap).
     *  'mixed'    = multi-pool cluster where at least one pool has its own perNodeRate
     *               override; no single rate describes the billed cost — inspect pool configs. */
    rateSource: z7.enum(["catalog", "caller", "excluded", "mixed"]).optional(),
    /** Effective per-node rate that produced costPerHour. Present on all three
     *  rateSource paths: catalog/caller carry the winning rate; excluded carries 0. */
    perNodeRateUsed: z7.number().optional(),
    /** Catalog SKU key that matched GPU_LARGE_NODE_HOURLY_RATES.
     *  Present only when rateSource === 'catalog'. */
    catalogKey: z7.string().optional(),
    /** OpenShift charge annotation. Platform and control-plane rows are
     * additive to worker rows. */
    offering: z7.string().optional(),
    chargeType: z7.enum(["platform", "control-plane", "worker"]).optional(),
    pricingStatus: z7.enum(["official", "estimated"]).optional(),
    pricingSource: z7.string().optional(),
    effectiveDate: z7.string().optional(),
    referenceRegion: z7.string().optional(),
    pricingArithmetic: z7.string().optional(),
    /** Published OpenShift platform billing unit and topology proration metadata. */
    billingUnit: z7.enum(["4-vcpu-hour", "cluster-hour"]).optional(),
    billingUnitVcpu: z7.number().positive().optional(),
    publishedUnitRatePerHour: z7.number().nonnegative().optional(),
    effectiveWorkerCount: z7.number().int().positive().optional(),
    effectiveWorkerVcpu: z7.number().positive().optional(),
    derivedPlatformFeePerHour: z7.number().nonnegative().optional(),
    workerTopology: z7.object({
      workerCount: z7.number().int().positive(),
      effectiveWorkerVcpu: z7.number().positive(),
      nodePools: z7.array(z7.object({
        name: z7.string(),
        workerCount: z7.number().int().positive(),
        workerVcpu: z7.number().positive(),
        effectiveWorkerVcpu: z7.number().positive()
      }))
    }).optional(),
    requestCostPerHour: z7.number().optional(),
    activeVcpuCostPerHour: z7.number().optional(),
    activeMemoryCostPerHour: z7.number().optional(),
    idleMinimumVcpuCostPerHour: z7.number().optional(),
    idleMinimumMemoryCostPerHour: z7.number().optional(),
    activeInstances: z7.number().int().nonnegative().optional(),
    requestDurationSeconds: z7.number().optional(),
    invocationCostPerHour: z7.number().optional(),
    warmCapacityCostPerHour: z7.number().optional(),
    billableTaskSeconds: z7.number().nonnegative().optional(),
    taskVcpuHourRate: z7.number().nonnegative().optional(),
    taskMemoryGibHourRate: z7.number().nonnegative().optional(),
    /** Cloud Run's selected request-serving price policy region. */
    policyRegion: z7.string().optional(),
    /** Published rate metadata for regional Cloud Run request-serving billing. */
    rateProvenance: z7.object({
      basis: z7.enum(["on-demand", "spot", "estimated"]),
      resolution: z7.enum([
        "exact-catalog",
        "large-sku",
        "entry-level-fallback",
        "base-rate-multiplier",
        "cloud-run-request-based",
        "request-serving-usage-based",
        "fargate-task-vcpu-memory",
        "aurora-acu-hour"
      ]),
      lastVerified: z7.string().nullable(),
      region: z7.string().nullable(),
      sku: z7.string().optional(),
      source: z7.string().optional(),
      architecture: z7.string().optional()
    }).optional()
  })).optional(),
  dynamoIteratorAgeSumMs: z7.number().optional(),
  s3NotificationLatencySumMs: z7.number().optional(),
  // Sum of partitionLag (in ms) across all Azure Event Hubs and OCI Streaming
  // queue resources in this simulation step. Useful for monitoring whether
  // event consumers are keeping pace with event producers.
  partitionLagSumMs: z7.number().optional(),
  // Cost completeness flag — false when at least one inferenceMode K8s cluster
  // has an unknown GPU rate (unrecognized size, no characteristics.perNodeRate).
  // excludedCostResources is the count of resources excluded from the aggregate.
  // Absent when no known-gap inference resources exist (treat as true).
  costComplete: z7.boolean().optional(),
  excludedCostResources: z7.number().optional(),
  /** Current bounded EKS Spot migration state for this step. */
  eksSpotMigration: z7.object({
    resourceId: z7.string(),
    resourceName: z7.string(),
    status: z7.enum(["not_started", "notice", "migrating", "ready", "deadline_hit", "deadline_missed"]),
    noticeAtSeconds: z7.number().nonnegative(),
    deadlineAtSeconds: z7.number().nonnegative(),
    migrationStartedAtSeconds: z7.number().nonnegative(),
    migrationDurationSeconds: z7.number().nonnegative(),
    workloadCount: z7.number().int().nonnegative(),
    readyWorkloadCount: z7.number().int().nonnegative(),
    remainingDeadlineSeconds: z7.number(),
    unavailableCapacity: z7.number().nonnegative(),
    /**
     * Replacement node capacity explicitly observed by the bounded lifecycle.
     * Omitted means the migration path did not record replacement capacity.
     */
    replacementNodeCount: z7.number().int().nonnegative().optional(),
    outcome: z7.enum(["hit", "miss"]).optional()
  }).optional(),
  /** Current bounded migration state for every active EKS Spot resource. */
  eksSpotMigrations: z7.array(z7.object({
    resourceId: z7.string(),
    resourceName: z7.string(),
    status: z7.enum(["not_started", "notice", "migrating", "ready", "deadline_hit", "deadline_missed"]),
    noticeAtSeconds: z7.number().nonnegative(),
    deadlineAtSeconds: z7.number().nonnegative(),
    migrationStartedAtSeconds: z7.number().nonnegative(),
    migrationDurationSeconds: z7.number().nonnegative(),
    workloadCount: z7.number().int().nonnegative(),
    readyWorkloadCount: z7.number().int().nonnegative(),
    remainingDeadlineSeconds: z7.number(),
    unavailableCapacity: z7.number().nonnegative(),
    replacementNodeCount: z7.number().int().nonnegative().optional(),
    outcome: z7.enum(["hit", "miss"]).optional()
  })).optional(),
  /** Lifecycle records emitted during this step, separate from resilience recovery. */
  eksSpotMigrationEvents: z7.array(z7.object({
    type: z7.enum([
      "interruption_notice",
      "migration_deadline",
      "workload_migration_started",
      "workload_ready",
      "deadline_outcome"
    ]),
    timestampSeconds: z7.number().nonnegative(),
    resourceId: z7.string(),
    resourceName: z7.string(),
    deadlineSeconds: z7.number().positive(),
    workloadCount: z7.number().int().nonnegative(),
    readyWorkloadCount: z7.number().int().nonnegative(),
    migrationDurationSeconds: z7.number().nonnegative(),
    remainingDeadlineSeconds: z7.number(),
    replacementNodeCount: z7.number().int().nonnegative().optional(),
    outcome: z7.enum(["hit", "miss"]).optional()
  })).optional(),
  // Per-cause breakdown of the error rate in percentage points. Each cause is
  // bounded 0–100 and causes sum to errorRate within rounding. queueAbsorption
  // is reported separately and is not included in the failed-cause sum.
  // Accepted Fargate queue work is reported in applicationQueue receipts, not
  // as a failed cause. `dependencyFailure` covers dependency-path telemetry.
  // Optional for backward compatibility; absent on stored snapshots that predate this field.
  errorBreakdown: z7.object({
    /** Generic pressure above its threshold (80% by default); benchmark-compatibility runs retain their reference fit. */
    databasePressure: z7.number().min(0).max(100).optional(),
    /** Benchmark-only reference residual below database pressure onset; not a live database-pressure signal. */
    benchmarkReferenceFit: z7.number().min(0).max(100).optional(),
    /** Databases contributing to under-limit pressure; contributionPct apportions the aggregate pressure amount across these rows. */
    databasePressureDetails: z7.array(z7.object({
      resourceId: z7.string(),
      name: z7.string(),
      cause: z7.enum([
        "connection_pressure",
        "cpu_pressure",
        "connection_and_cpu_pressure",
        "provider_reference_fit"
      ]),
      modeledConnections: z7.number().nonnegative(),
      usableConnectionLimit: z7.number().nonnegative(),
      connectionUtilization: z7.number().nonnegative(),
      cpuUtilization: z7.number().nonnegative(),
      contributionPct: z7.number().min(0).max(100)
    })).optional(),
    poolSaturation: z7.number().min(0).max(100),
    /** Per-database modeled demand above usable capacity; never observed live sessions. */
    poolSaturationDetails: z7.array(z7.object({
      resourceId: z7.string(),
      name: z7.string(),
      cause: z7.literal("connection_limit_exceeded").optional().describe("Modeled cause indicating demand exceeded this database's usable connection limit."),
      modeledConnections: z7.number().nonnegative(),
      usableConnectionLimit: z7.number().nonnegative(),
      demandBasis: z7.literal("modeled connection demand; not observed live sessions")
    })).optional(),
    dbFailure: z7.number().min(0).max(100),
    computeFailure: z7.number().min(0).max(100),
    capacityOverload: z7.number().min(0).max(100),
    cpuOverload: z7.number().min(0).max(100),
    ociStorage: z7.number().min(0).max(100),
    queueAbsorption: z7.number().min(0).max(100),
    runtimeMemory: z7.number().min(0).max(100).optional(),
    /** Startup backpressure from application-readiness ramp (appReadySteps). Present
     * while at least one request-serving resource is in the 'initializing' state.
     * Pre-clamp additive contribution in percentage-point units. [cwm-est] */
    startupBackpressure: z7.number().min(0).max(100).optional(),
    dependencyFailure: z7.number().min(0).max(100).optional(),
    sessionAffinity: z7.number().min(0).max(100).optional()
  }).optional()
});
var metricsResponseSchema = metricsSchema.extend({
  latencyPercentileStatus: z7.enum(["modeled", "unavailable"]).optional(),
  latencyP50: z7.number().nullable(),
  latencyP95: z7.number().nullable(),
  latencyP99: z7.number().nullable()
});
var eventSchema = z7.object({
  id: z7.string(),
  simulationId: z7.string(),
  timestamp: z7.string(),
  /** Stable event discriminator; legacy rows may omit it. */
  type: z7.string().optional(),
  severity: z7.enum(["info", "success", "warning", "error"]),
  message: z7.string(),
  resource: z7.string().optional(),
  metadata: z7.record(z7.unknown()).optional()
});
var scenarioDefaultTrafficPatternSchema = z7.object({
  name: z7.string(),
  type: z7.enum(["ramp", "burst", "step", "wave", "custom"]),
  startTime: z7.number().default(0),
  endTime: z7.number().optional(),
  parameters: z7.object({
    startTraffic: z7.number().optional(),
    endTraffic: z7.number().optional(),
    peakTraffic: z7.number().optional(),
    duration: z7.number().optional(),
    period: z7.number().optional(),
    amplitude: z7.number().optional(),
    baseline: z7.number().optional()
  }).default({}),
  isActive: z7.boolean().default(true)
});
var scenarioTrafficPhaseSummarySchema = z7.object({
  name: z7.string(),
  type: z7.enum(["ramp", "burst", "step", "wave", "custom"]),
  startStep: z7.number().nonnegative(),
  endStep: z7.number().nonnegative().optional(),
  isActive: z7.boolean(),
  traffic: z7.object({
    startRps: z7.number().nonnegative().optional(),
    endRps: z7.number().nonnegative().optional(),
    peakRps: z7.number().nonnegative().optional()
  })
});
var scenarioRetryTrafficDisclosureSchema = z7.object({
  enabled: z7.literal(true),
  dependencyCount: z7.number().int().positive(),
  maxConfiguredRetries: z7.number().int().positive(),
  externalTraffic: z7.string(),
  internalRetryAttempts: z7.string()
});
var scenarioDefaultFailureInjectionSchema = z7.object({
  name: z7.string(),
  type: z7.enum(["instance_kill", "instance_down", "az_outage", "region_outage", "permanent_data_loss", "database_overload", "network_latency", "spot_interruption"]),
  targetRegion: z7.string().optional(),
  targetProvider: cloudProviderSchema.optional(),
  targetResourceId: z7.string().optional(),
  targetZone: z7.string().optional(),
  severity: z7.enum(["minor", "moderate", "severe"]).default("moderate"),
  startTime: z7.number().default(0),
  duration: z7.number().optional(),
  endTime: z7.number().optional(),
  isActive: z7.boolean().default(true),
  parameters: z7.record(z7.unknown()).default({})
});
var scenarioLifecycleEventSchema = z7.object({
  name: z7.string(),
  type: z7.literal("spot_interruption"),
  targetResourceId: z7.string(),
  startTime: z7.number().int().nonnegative(),
  noticeWindowSeconds: z7.literal(120),
  simulationSecondsPerStep: z7.number().finite().positive().max(60).optional(),
  affectedWorkloadCount: z7.number().int().positive(),
  handling: z7.enum(["reschedule", "drain-only", "fail-fast"]).default("reschedule")
});
var scenarioProviderApiLimitSchema = z7.object({
  question: z7.string().min(1),
  policyId: z7.string().min(1),
  scopeDescription: z7.string().min(1),
  provider: cloudProviderSchema,
  region: z7.string().min(1),
  service: z7.string().min(1),
  operation: z7.string().min(1),
  category: z7.string().min(1),
  plannedCount: z7.number().int().positive().max(1e5),
  workerCount: z7.number().int().positive().max(1e3),
  maxConcurrency: z7.number().int().positive().max(1e3),
  latency: z7.object({
    meanMs: z7.number().finite().nonnegative(),
    p95Ms: z7.number().finite().nonnegative(),
    timeoutMs: z7.number().finite().positive()
  }),
  retryAttempts: z7.number().int().positive().max(10)
});
var scenarioFailurePhaseSummarySchema = scenarioDefaultFailureInjectionSchema.pick({
  targetRegion: true,
  targetProvider: true,
  name: true,
  type: true,
  targetResourceId: true,
  targetZone: true,
  severity: true,
  isActive: true
}).extend({
  startStep: z7.number().nonnegative(),
  endStep: z7.number().nonnegative().optional()
});
var scenarioSchema = z7.object({
  id: z7.string(),
  // The catalog currently has no independent release/version source. Keep
  // these explicit so consumers can distinguish unavailable metadata from a
  // transport omission without inventing a revision.
  version: z7.null().optional(),
  revision: z7.null().optional(),
  title: z7.string(),
  description: z7.string(),
  difficulty: z7.enum(["beginner", "intermediate", "advanced"]),
  resources: z7.array(resourceSchema),
  connections: z7.array(connectionSchema).default([]),
  duration: z7.string(),
  tags: z7.array(z7.string()),
  category: z7.string(),
  primaryPurpose: scenarioPurposeSchema.optional(),
  autoscalingConfig: autoscalingConfigSchema.optional(),
  seed: z7.number().int().nonnegative().optional(),
  resilienceConfig: resilienceConfigSchema.optional(),
  protectedResilienceConfig: resilienceConfigSchema.optional(),
  defaultTrafficPatterns: z7.array(scenarioDefaultTrafficPatternSchema).optional(),
  defaultFailureInjections: z7.array(scenarioDefaultFailureInjectionSchema.superRefine((failure, ctx) => {
    for (const issue of validateDataIntegrityFailureScope(failure.type, failure)) {
      ctx.addIssue({ code: z7.ZodIssueCode.custom, path: [issue.path], message: issue.message });
    }
  })).optional(),
  defaultLifecycleEvents: z7.array(scenarioLifecycleEventSchema).optional(),
  providerApiLimitScenario: scenarioProviderApiLimitSchema.optional(),
  realWorldIncident: z7.object({
    date: z7.string(),
    provider: z7.string(),
    summary: z7.string().optional(),
    references: z7.array(z7.object({ label: z7.string(), url: z7.string() })).optional()
  }).optional()
});
var trafficPatternSchema = z7.object({
  id: z7.string(),
  simulationId: z7.string(),
  name: z7.string(),
  type: z7.enum(["ramp", "burst", "step", "wave", "custom"]),
  startTime: z7.number(),
  endTime: z7.number().optional(),
  parameters: z7.object({
    startTraffic: z7.number().optional(),
    endTraffic: z7.number().optional(),
    peakTraffic: z7.number().optional(),
    duration: z7.number().optional(),
    period: z7.number().optional(),
    amplitude: z7.number().optional(),
    baseline: z7.number().optional(),
    // Stable baseline traffic captured when the pattern is created. The engine
    // uses this (never the live, written-back traffic) as the "return to" /
    // center reference so partially-specified patterns can never compound
    // across steps. Set server-side at creation; callers may omit it.
    baselineTraffic: z7.number().optional(),
    points: z7.array(z7.object({
      time: z7.number(),
      traffic: z7.number()
    })).optional()
  }).default({}),
  isActive: z7.boolean().default(true),
  createdAt: z7.string()
});
var failureInjectionSchema = z7.object({
  id: z7.string(),
  simulationId: z7.string(),
  name: z7.string(),
  type: z7.enum(["instance_kill", "instance_down", "az_outage", "region_outage", "permanent_data_loss", "database_overload", "network_latency", "spot_interruption"]),
  targetRegion: z7.string().optional(),
  targetProvider: cloudProviderSchema.optional(),
  targetResourceId: z7.string().optional(),
  targetZone: z7.string().optional(),
  severity: z7.enum(["minor", "moderate", "severe"]).default("moderate"),
  duration: z7.number().optional(),
  parameters: z7.object({
    latencyMs: z7.number().optional(),
    errorRateIncrease: z7.number().optional(),
    latencyMultiplier: z7.number().optional(),
    _snapshotBaseLatency: z7.number().optional(),
    _snapshotMaxConnections: z7.number().optional(),
    _snapshotStatus: z7.string().optional(),
    spotInterruption: eksSpotInterruptionParametersSchema.optional()
  }).default({}),
  isActive: z7.boolean().default(true),
  startTime: z7.number(),
  endTime: z7.number().optional(),
  createdAt: z7.string()
});
var optimizationGoalsSchema = z7.object({
  primary: z7.enum(["minimize_cost", "maximize_performance", "balance"]),
  constraints: z7.object({
    max_cost_per_hour: z7.number().optional(),
    min_throughput: z7.number().optional(),
    max_latency_p95: z7.number().optional()
  }).optional(),
  weights: z7.object({
    cost: z7.number().optional(),
    performance: z7.number().optional(),
    stability: z7.number().optional()
  }).optional()
});
var recommendationReversibilitySchema = z7.object({
  tier: z7.enum(["instant", "minutes", "hours", "days"]),
  estimatedMinutesMin: z7.number().optional(),
  estimatedMinutesMax: z7.number().optional(),
  reason: z7.string(),
  basis: z7.literal("rule_based")
});
var optimizationRecommendationSchema = z7.object({
  rank: z7.number(),
  name: z7.string(),
  description: z7.string(),
  simulationSnapshot: z7.object({
    resources: z7.array(resourceSchema),
    connections: z7.array(connectionSchema),
    autoscalingConfig: autoscalingConfigSchema.optional()
  }),
  metrics: z7.object({
    costPerHour: z7.number(),
    latencyP95: z7.number(),
    throughput: z7.number(),
    errorRate: z7.number()
  }),
  improvements: z7.array(z7.string()),
  changes: z7.array(z7.string()),
  score: z7.number(),
  // null when the baseline's aggregate cost was incomplete (an unknown-rate
  // resource was excluded), so callers cannot treat a fabricated percentage
  // as a real figure. See coverageState.
  costSavingsPercent: z7.number().nullable(),
  // Cost-coverage trust signal for this recommendation's cost figures.
  //   "cost_complete"              — baseline cost covered every resource; costSavingsPercent is real.
  //   "insufficient_cost_coverage" — at least one resource with an unknown rate was excluded from the
  //                                  baseline aggregate; costSavingsPercent is null.
  // Optional for backward compatibility with jobs completed before this field existed
  // (absence means cost_complete).
  coverageState: z7.enum(["cost_complete", "insufficient_cost_coverage"]).optional(),
  // Names of the resources excluded from the baseline cost aggregate. Empty/absent
  // when coverage is complete.
  excludedRateResources: z7.array(z7.string()).optional(),
  reversibility: recommendationReversibilitySchema.optional()
});
var optimizationJobSchema = z7.object({
  id: z7.string(),
  status: z7.enum(["pending", "running", "completed", "failed", "cancelled"]),
  baseSimulationId: z7.string(),
  goals: optimizationGoalsSchema,
  testScenario: z7.object({
    traffic_pattern: z7.string(),
    duration_steps: z7.number(),
    include_failures: z7.boolean()
  }),
  variantsGenerated: z7.number(),
  variantsCompleted: z7.number(),
  recommendations: z7.array(optimizationRecommendationSchema),
  webhookUrl: z7.string().optional(),
  webhookSecret: z7.string().optional(),
  webhookDeliveryStatus: z7.enum(["pending", "delivered", "failed"]).optional(),
  webhookDeliveryAttempts: z7.number().optional(),
  webhookDeliveryError: z7.string().optional(),
  webhookDeliveredAt: z7.string().optional(),
  apiKeyId: z7.string().optional(),
  createdAt: z7.string(),
  completedAt: z7.string().optional(),
  cancelledAt: z7.string().optional(),
  error: z7.string().optional()
});
var insertSimulationSchema = simulationSchema.omit({
  predictionEvidence: true,
  id: true,
  createdAt: true,
  updatedAt: true,
  demoStepCount: true,
  ownerWallet: true,
  expiresAt: true,
  engineVersion: true,
  normalizationReceipt: true,
  resilienceReceipt: true,
  replayInputSnapshot: true
});
var scenarioOverridesSchema = z7.object({
  eksSpotInterruption: z7.object({
    startupSeconds: z7.number().int().min(0).max(3600)
  }).strict().optional(),
  webAutoscaling: z7.object({
    includeTrafficRecovery: z7.boolean()
  }).strict().optional()
}).strict().superRefine((overrides, ctx) => {
  if (Number(overrides.eksSpotInterruption !== void 0) + Number(overrides.webAutoscaling !== void 0) !== 1) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      message: "Provide exactly one supported scenario override."
    });
  }
});
var simulationCreationRequestSchema = insertSimulationSchema.extend({
  resources: z7.array(resourceSchema).optional(),
  connections: z7.array(connectionSchema).optional(),
  scenarioId: z7.string().min(1).optional(),
  scenarioOverrides: scenarioOverridesSchema.optional()
}).passthrough().superRefine((input, ctx) => {
  const resourceIds = new Set(input.resources?.map((resource) => resource.id) ?? []);
  input.resources?.forEach((resource, index) => {
    if (resource.type === "kubernetes" && resource.characteristics?.capacityRps !== void 0) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["resources", index, "characteristics", "capacityRps"],
        message: "capacityRps is compute-only and is not supported for Kubernetes; use maxThroughput for the total cluster RPS ceiling (or nodePools[].maxThroughput for per-node capacity)."
      });
    }
    const checks = resource.characteristics?.healthChecks;
    if (checks) {
      for (const [checkName, check] of [
        ["loadBalancer", checks.loadBalancer],
        ["livenessProbe", checks.livenessProbe],
        ["readinessProbe", checks.readinessProbe]
      ]) {
        (check?.dependencyResourceIds ?? []).forEach((dependencyId, dependencyIndex) => {
          if (!resourceIds.has(dependencyId) || dependencyId === resource.id) {
            ctx.addIssue({
              code: z7.ZodIssueCode.custom,
              path: ["resources", index, "characteristics", "healthChecks", checkName, "dependencyResourceIds", dependencyIndex],
              message: dependencyId === resource.id ? "A health check cannot depend on its own resource." : `Health-check dependency ${dependencyId} must identify a resource in this simulation.`
            });
          }
        });
      }
    }
  });
  const hasResources = input.resources !== void 0;
  const hasScenario = input.scenarioId !== void 0;
  const hasConnections = input.connections !== void 0;
  const hasOverrides = input.scenarioOverrides !== void 0;
  if (!hasResources && !hasScenario) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["resources"],
      message: "Provide either resources or scenarioId."
    });
  }
  if (hasScenario && (hasResources || hasConnections)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["scenarioId"],
      message: "Do not provide scenarioId with resources or connections; choose one graph source."
    });
  }
  if (hasOverrides && !hasScenario) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["scenarioOverrides"],
      message: "scenarioOverrides requires scenarioId and cannot be used with an explicit resource graph."
    });
  }
  const nearMisses = {
    resourceOverrides: "Use scenarioOverrides.eksSpotInterruption.startupSeconds.",
    characteristicsOverrides: "Use scenarioOverrides.eksSpotInterruption.startupSeconds.",
    startupSeconds: "Use scenarioOverrides.eksSpotInterruption.startupSeconds."
  };
  for (const [field, suggestion] of Object.entries(nearMisses)) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: [field],
        message: `"${field}" is not supported for simulation creation. ${suggestion}`
      });
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, "scenarioAttribution")) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["scenarioAttribution"],
      message: "scenarioAttribution is server-assigned from scenarioId and cannot be supplied."
    });
  }
});
var insertConnectionSchema = connectionSchema.omit({ id: true });
var insertEventSchema = eventSchema.omit({ id: true });
var insertTrafficPatternSchema = trafficPatternSchema.omit({
  id: true,
  createdAt: true
});
var insertFailureInjectionSchema = failureInjectionSchema.omit({
  id: true,
  createdAt: true
});
var insertOptimizationJobSchema = optimizationJobSchema.omit({
  id: true,
  createdAt: true
});
var trafficForecastPointSchema = z7.object({
  timestamp: z7.number(),
  rps: z7.number(),
  label: z7.string().optional()
});
var trafficForecastSchema = z7.object({
  name: z7.string(),
  description: z7.string().optional(),
  dataPoints: z7.array(trafficForecastPointSchema),
  peakRPS: z7.number().optional(),
  avgRPS: z7.number().optional()
});
var thresholdTestResultSchema = z7.object({
  scaleOutCpuThreshold: z7.number(),
  scaleInCpuThreshold: z7.number(),
  scaleOutThroughputThreshold: z7.number(),
  scaleInThroughputThreshold: z7.number(),
  metrics: z7.object({
    costPerHour: z7.number(),
    latencyP95: z7.number(),
    errorRate: z7.number(),
    throughput: z7.number(),
    scalingEvents: z7.number()
  }),
  bottlenecks: z7.array(z7.string()),
  score: z7.number(),
  passed: z7.boolean()
});
var validationResultSchema = z7.object({
  passed: z7.boolean(),
  summary: z7.string(),
  peakMetrics: z7.object({
    cpuUsage: z7.number(),
    latencyP95: z7.number(),
    errorRate: z7.number(),
    costPerHour: z7.number()
  }),
  bottlenecksDetected: z7.array(z7.string()),
  failurePoints: z7.array(z7.object({
    timestamp: z7.number(),
    rps: z7.number(),
    issue: z7.string()
  })),
  recommendations: z7.array(z7.string())
});
var predictionRecommendationSchema = z7.object({
  rank: z7.number(),
  title: z7.string(),
  description: z7.string(),
  priority: z7.enum(["critical", "high", "medium", "low"]),
  action: z7.string(),
  expectedImpact: z7.string(),
  autoscalingConfig: autoscalingConfigSchema.optional(),
  resourceChanges: z7.array(z7.string()).optional()
});
var predictionJobSchema = z7.object({
  id: z7.string(),
  type: z7.enum(["validate", "optimize_thresholds"]),
  status: z7.enum(["pending", "running", "completed", "failed", "cancelled"]),
  baseSimulationId: z7.string(),
  trafficForecast: trafficForecastSchema,
  validationResult: validationResultSchema.optional(),
  thresholdTests: z7.array(thresholdTestResultSchema).optional(),
  bestThresholds: autoscalingConfigSchema.optional(),
  recommendations: z7.array(predictionRecommendationSchema),
  webhookUrl: z7.string().optional(),
  webhookSecret: z7.string().optional(),
  webhookDeliveryStatus: z7.enum(["pending", "delivered", "failed"]).optional(),
  webhookDeliveryAttempts: z7.number().optional(),
  webhookDeliveryError: z7.string().optional(),
  webhookDeliveredAt: z7.string().optional(),
  apiKeyId: z7.string().optional(),
  createdAt: z7.string(),
  completedAt: z7.string().optional(),
  cancelledAt: z7.string().optional(),
  error: z7.string().optional(),
  suggestions: z7.array(z7.string()).optional()
});
var insertPredictionJobSchema = predictionJobSchema.omit({
  id: true,
  createdAt: true
});
var metricsReadTransportSchema = metricsSchema.extend({
  latencyP50: z7.number().nullable(),
  latencyP95: z7.number().nullable(),
  latencyP99: z7.number().nullable()
});
var chaosFailureTypeSchema = z7.enum([
  "region_outage",
  "permanent_data_loss",
  "database_crash",
  "database_slowdown",
  "database_overload",
  "zone_outage",
  "instance_failure",
  "eks_spot_interruption",
  "network_latency",
  "network_partition",
  "cascading_failure",
  "cpu_stress"
]);
var chaosInjectionConfigSchema = z7.object({
  targetRegion: z7.string().optional(),
  failureType: chaosFailureTypeSchema,
  targetResourceId: z7.string().optional(),
  targetResourceName: z7.string().optional(),
  targetZone: z7.string().optional(),
  targetProvider: cloudProviderSchema.optional(),
  duration: z7.number().optional(),
  intensity: z7.number().min(0).max(100).optional(),
  startTime: z7.number().optional(),
  affectedResources: z7.array(z7.string()).optional(),
  /** Chaos simulation-clock assumptions, not provider SLAs. Only database_crash uses these. */
  promotionDelaySeconds: z7.number().int().min(0).max(86400).optional(),
  restartDelaySeconds: z7.number().int().min(0).max(86400).optional()
}).superRefine((failure, ctx) => {
  for (const issue of validateDataIntegrityFailureScope(failure.failureType, failure)) {
    ctx.addIssue({ code: z7.ZodIssueCode.custom, path: [issue.path], message: issue.message });
  }
  if (failure.failureType !== "database_crash") {
    for (const field of ["promotionDelaySeconds", "restartDelaySeconds"]) {
      if (failure[field] !== void 0) {
        ctx.addIssue({ code: z7.ZodIssueCode.custom, path: [field], message: `${field} applies only to database_crash` });
      }
    }
  }
});
var scenarioRecoveryDelayFields = {
  promotionDelaySeconds: z7.number().int().min(0).max(86400).optional(),
  restartDelaySeconds: z7.number().int().min(0).max(86400).optional()
};
var scenarioRecoveryDelaysSchema = z7.object(scenarioRecoveryDelayFields);
function validateScenarioRecoveryDelays(input, ctx) {
  for (const field of ["promotionDelaySeconds", "restartDelaySeconds"]) {
    if (input[field] !== void 0 && (input.scenarioId !== "database_crash" || input.customInjections !== void 0)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: [field],
        message: `${field} requires scenarioId database_crash without customInjections`
      });
    }
  }
}
var resilienceMetricsSchema = z7.object({
  /** Null when sustained recovery was not observed (including no incident). */
  recoveryTimeSeconds: z7.number().nullable(),
  /** Opt-in health-check and orchestrator lifecycle evidence from chaos runs. */
  healthCheckLifecycle: z7.array(healthCheckLifecycleSchema).max(64).optional(),
  /** Effective assumptions for each database crash target; absent on older jobs. */
  databaseCrashAssumptions: z7.array(z7.object({
    targetResourceId: z7.string(),
    recoveryMode: z7.enum(["explicit_replica_promotion", "sole_writer_restart"]),
    /** Present when a related standby exists but is not eligible at injection time. */
    promotionUnavailableReason: z7.enum(["related_replica_unavailable_at_injection"]).optional(),
    promotionDelaySeconds: z7.number().int().min(0).max(86400),
    restartDelaySeconds: z7.number().int().min(0).max(86400)
  })).max(32).optional(),
  /** Peak of the sampled interval p95 values, not a pooled request percentile. */
  latencyP95Ms: z7.number().nonnegative().nullable().optional(),
  chaosIntervals: z7.array(z7.object({
    startSeconds: z7.number(),
    endSeconds: z7.number(),
    offeredRps: z7.number().nonnegative().nullable(),
    errorRatePercent: z7.number().min(0).max(100).nullable(),
    successfulThroughputRps: z7.number().nonnegative().nullable(),
    latencyP95Ms: z7.number().nonnegative().nullable(),
    targetResourceId: z7.string().nullable(),
    /** First target or its related serving replacement only; null during aggregate outage. */
    servingResourceId: z7.string().nullable(),
    targetStatus: z7.enum(["healthy", "warning", "critical"]).nullable(),
    servingStatus: z7.enum(["healthy", "warning", "critical"]).nullable(),
    servingMaxConnections: z7.number().nonnegative().nullable(),
    /** Per-crash target state only; request rates and totals belong to the interval. */
    databaseTargets: z7.array(z7.object({
      targetResourceId: z7.string(),
      targetStatus: z7.enum(["healthy", "warning", "critical"]).nullable(),
      servingReplacementResourceId: z7.string().nullable(),
      servingReplacementStatus: z7.enum(["healthy", "warning", "critical"]).nullable(),
      servingReplacementMaxConnections: z7.number().nonnegative().nullable()
    })).max(32).optional(),
    healthChecks: z7.array(healthCheckLifecycleSchema).max(64).optional()
  })).max(100).optional(),
  availabilityPercent: z7.number(),
  dataLossIncidents: z7.number(),
  gracefulDegradationScore: z7.number(),
  meanTimeToRecovery: z7.number().nullable(),
  errorRateDuringChaos: z7.number(),
  /** EKS Spot migration evidence is intentionally separate from recovery. */
  eksSpotMigration: z7.object({
    resourceId: z7.string(),
    resourceName: z7.string(),
    status: z7.enum(["not_started", "notice", "migrating", "ready", "deadline_hit", "deadline_missed"]),
    noticeAtSeconds: z7.number().nonnegative(),
    deadlineAtSeconds: z7.number().nonnegative(),
    migrationStartedAtSeconds: z7.number().nonnegative(),
    migrationDurationSeconds: z7.number().nonnegative(),
    workloadCount: z7.number().int().nonnegative(),
    readyWorkloadCount: z7.number().int().nonnegative(),
    remainingDeadlineSeconds: z7.number(),
    unavailableCapacity: z7.number().nonnegative(),
    replacementNodeCount: z7.number().int().nonnegative().optional(),
    outcome: z7.enum(["hit", "miss"]).optional()
  }).optional(),
  /** Per-resource EKS Spot migration evidence, separate from recovery. */
  eksSpotMigrations: z7.array(z7.object({
    resourceId: z7.string(),
    resourceName: z7.string(),
    status: z7.enum(["not_started", "notice", "migrating", "ready", "deadline_hit", "deadline_missed"]),
    noticeAtSeconds: z7.number().nonnegative(),
    deadlineAtSeconds: z7.number().nonnegative(),
    migrationStartedAtSeconds: z7.number().nonnegative(),
    migrationDurationSeconds: z7.number().nonnegative(),
    workloadCount: z7.number().int().nonnegative(),
    readyWorkloadCount: z7.number().int().nonnegative(),
    remainingDeadlineSeconds: z7.number(),
    unavailableCapacity: z7.number().nonnegative(),
    replacementNodeCount: z7.number().int().nonnegative().optional(),
    outcome: z7.enum(["hit", "miss"]).optional()
  })).optional(),
  /**
   * Optional evidence-backed outcome contract.  The legacy scalar metrics
   * remain for existing persisted jobs and clients; consumers needing to
   * distinguish unavailable evidence from a measured zero must use this
   * object when it is present.
   */
  outcome: z7.object({
    /**
     * `throughput` is goodput.  Observed availability requires aggregate
     * original-client offered load aligned to that goodput.  The estimate
     * variants are explicitly not request-count observations.
     */
    availabilityBasis: z7.enum([
      "observed_offered_load",
      "estimated_from_goodput_and_error_rate",
      "estimated_from_error_rate",
      "mixed_observed_and_estimated",
      "unavailable"
    ]),
    requestWindowSeconds: z7.number().nonnegative().nullable(),
    observedOfferedRequests: z7.number().nonnegative().nullable(),
    /**
     * @deprecated Use modeledOfferedRequests. Kept during the outcome-contract
     * transition for clients already consuming the initial optional shape.
     */
    estimatedOfferedRequests: z7.number().nonnegative().nullable(),
    /** Modeled (not observed) offered-request equivalent derived from goodput
     * and error rate. Null when the run has no reconstructable denominator. */
    modeledOfferedRequests: z7.number().nonnegative().nullable().optional(),
    successfulRequests: z7.number().nonnegative().nullable(),
    modeledShedRequests: z7.number().nonnegative().nullable(),
    observedOfferedLoadRps: z7.number().nonnegative().nullable(),
    /** @deprecated Use modeledOfferedLoadRps. */
    estimatedOfferedLoadRps: z7.number().nonnegative().nullable(),
    modeledOfferedLoadRps: z7.number().nonnegative().nullable().optional(),
    successfulThroughputRps: z7.number().nonnegative().nullable(),
    modeledSheddingRps: z7.number().nonnegative().nullable(),
    errorRatePercent: z7.number().min(0).max(100).nullable(),
    recovery: z7.object({
      healthErrorRateThresholdPercent: z7.literal(5),
      sustainPeriodSeconds: z7.literal(30),
      incidentStartSeconds: z7.number().nonnegative().nullable(),
      firstHealthyStartSeconds: z7.number().nonnegative().nullable(),
      firstRecoveryCompletedSeconds: z7.number().nonnegative().nullable(),
      finalSustainedRecoveryCompletedSeconds: z7.number().nonnegative().nullable(),
      sustainPeriodCompleted: z7.boolean(),
      regressedAfterRecovery: z7.boolean(),
      finalState: z7.enum(["healthy", "unhealthy", "unavailable"]),
      /** Lower bound on completion when no sustained recovery was observed. */
      recoveryTimeLowerBoundSeconds: z7.number().nonnegative().nullable().optional(),
      estimatedServiceRestoreSeconds: z7.number().nonnegative().nullable().optional(),
      assumption: z7.string().optional()
    })
  }).optional()
});
var resilienceScoreSchema = z7.object({
  overall: z7.number(),
  scoringReason: z7.string().optional(),
  breakdown: z7.object({
    recovery: z7.number(),
    availability: z7.number(),
    dataIntegrity: z7.number(),
    gracefulDegradation: z7.number()
  }),
  metrics: resilienceMetricsSchema,
  grade: z7.enum(["A", "B", "C", "D", "F"])
});
var vulnerabilityApplyActionSchema = z7.discriminatedUnion("type", [
  z7.object({
    type: z7.literal("clone_resource_to_alternate_zone"),
    resourceId: z7.string(),
    nameSuffix: z7.string()
  }),
  z7.object({
    type: z7.literal("distribute_resources_across_zones")
  })
]);
var vulnerabilitySchema = z7.object({
  id: z7.string(),
  type: z7.enum([
    "single_point_of_failure",
    "no_redundancy",
    "insufficient_capacity",
    "slow_recovery",
    "cascading_risk",
    "no_failover",
    "zone_dependency",
    "health_check_replacement"
  ]),
  severity: z7.enum(["critical", "high", "medium", "low"]),
  title: z7.string(),
  description: z7.string(),
  affectedResources: z7.array(z7.string()),
  recommendation: z7.string(),
  estimatedImpact: z7.string(),
  applyAction: vulnerabilityApplyActionSchema.optional()
});
var chaosScenarioSchema = z7.object({
  id: z7.string(),
  name: z7.string(),
  description: z7.string(),
  category: z7.enum(["availability", "performance", "data_integrity", "networking"]),
  injections: z7.array(chaosInjectionConfigSchema),
  expectedOutcome: z7.string(),
  passThreshold: z7.number()
});
var chaosJobSchema = z7.object({
  id: z7.string(),
  status: z7.enum(["pending", "running", "completed", "failed", "cancelled"]),
  baseSimulationId: z7.string(),
  scenarioId: z7.string().optional(),
  scenarioRecoveryDelays: scenarioRecoveryDelaysSchema.optional(),
  customInjections: z7.array(chaosInjectionConfigSchema).optional(),
  duration: z7.number(),
  resilienceScore: resilienceScoreSchema.optional(),
  vulnerabilities: z7.array(vulnerabilitySchema),
  recommendations: z7.array(z7.string()),
  timeline: z7.array(z7.object({
    timestamp: z7.number(),
    event: z7.string(),
    severity: z7.enum(["info", "warning", "error", "critical"]),
    details: z7.string().optional()
  })),
  webhookUrl: z7.string().optional(),
  webhookSecret: z7.string().optional(),
  webhookDeliveryStatus: z7.enum(["pending", "delivered", "failed"]).optional(),
  webhookDeliveryAttempts: z7.number().optional(),
  webhookDeliveryError: z7.string().optional(),
  webhookDeliveredAt: z7.string().optional(),
  apiKeyId: z7.string().optional(),
  createdAt: z7.string(),
  completedAt: z7.string().optional(),
  cancelledAt: z7.string().optional(),
  error: z7.string().optional()
});
var insertChaosJobSchema = chaosJobSchema.omit({
  id: true,
  createdAt: true
});
var batchChaosJobSchema = z7.object({
  id: z7.string(),
  status: z7.enum(["pending", "running", "completed", "failed", "cancelled", "partial_failed"]),
  childJobIds: z7.array(z7.string()).default([]),
  totalJobs: z7.number(),
  completedJobs: z7.number().default(0),
  failedJobs: z7.number().default(0),
  cancelledJobs: z7.number().default(0),
  aggregatedResilienceScore: resilienceScoreSchema.optional(),
  aggregatedVulnerabilities: z7.array(vulnerabilitySchema).default([]),
  aggregatedRecommendations: z7.array(z7.string()).default([]),
  childJobResults: z7.array(z7.object({
    jobId: z7.string(),
    status: z7.enum(["pending", "running", "completed", "failed", "cancelled"]),
    resilienceScore: resilienceScoreSchema.optional(),
    vulnerabilities: z7.array(vulnerabilitySchema).default([]),
    error: z7.string().optional()
  })).default([]),
  webhookUrl: z7.string().optional(),
  webhookSecret: z7.string().optional(),
  webhookDeliveryStatus: z7.enum(["pending", "delivered", "failed"]).optional(),
  webhookDeliveryAttempts: z7.number().optional(),
  webhookDeliveryError: z7.string().optional(),
  webhookDeliveredAt: z7.string().optional(),
  apiKeyId: z7.string().optional(),
  createdAt: z7.string(),
  updatedAt: z7.string(),
  completedAt: z7.string().optional(),
  cancelledAt: z7.string().optional(),
  error: z7.string().optional()
});
var insertBatchChaosJobSchema = batchChaosJobSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var batchChaosChildProgressSchema = z7.object({
  jobId: z7.string(),
  status: chaosJobSchema.shape.status,
  scenarioId: z7.string().optional(),
  scenarioRecoveryDelays: scenarioRecoveryDelaysSchema.optional()
});
var batchChaosRequestSchema = z7.object({
  simulationId: z7.string(),
  scenarios: z7.array(z7.object({
    scenarioId: z7.string().optional(),
    customInjections: z7.array(chaosInjectionConfigSchema).optional(),
    duration: z7.number().min(10).max(300),
    ...scenarioRecoveryDelayFields
  }).superRefine(validateScenarioRecoveryDelays)).min(1).max(10),
  webhookUrl: z7.string().url().optional(),
  webhookSecret: z7.string().optional()
});
var rlActionSchema = z7.object({
  type: z7.enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "no_op", "set_recovery_policy"]),
  parameters: z7.object({
    cpuThreshold: z7.number().min(0).max(100).optional(),
    throughputThreshold: z7.number().min(0).max(100).optional(),
    latencyThreshold: z7.number().min(0).optional(),
    instanceCount: z7.number().min(1).optional(),
    resourceType: z7.enum(["compute", "database", "storage", "network", "security"]).optional(),
    provider: cloudProviderSchema.optional(),
    resourceId: z7.string().optional(),
    targetSize: z7.string().optional(),
    regionKey: z7.string().optional(),
    serviceFamily: z7.string().optional(),
    config: z7.object({
      minCapacity: z7.number().positive().optional(),
      maxCapacity: z7.number().positive().optional()
    }).passthrough().optional(),
    recoveryPolicy: recoveryPolicySchema.optional(),
    // Flat-field form for set_recovery_policy: pass threshold fields directly
    // at the top level (no nested recoveryPolicy object, no resourceId) to
    // apply the policy globally to every resource in the simulation.
    criticalCpuThreshold: z7.number().min(0).max(100).optional(),
    criticalSteps: z7.number().int().min(1).optional(),
    warningCpuThreshold: z7.number().min(0).max(100).optional(),
    warningSteps: z7.number().int().min(1).optional()
  }).default({})
});
var rlObservationSchema = z7.object({
  metrics: metricsSchema,
  resources: z7.array(resourceSchema),
  traffic: z7.number(),
  currentTime: z7.number(),
  scalingHistory: z7.array(scalingEventSchema),
  recentEvents: z7.array(eventSchema),
  autoscalingConfig: autoscalingConfigSchema.optional(),
  sim_time_seconds: z7.number().optional(),
  tick_seconds: z7.number().int().min(1).max(3600).optional(),
  routedRps_per_node: z7.number().optional(),
  unavailable_node_count: z7.number().int().optional()
});
var rlObsSchema = z7.object({
  rps: z7.number().describe("Throughput in requests per second"),
  cpu_util: z7.number().describe("CPU utilization as a fraction (0\u20131)"),
  instances: z7.number().int().describe("Total number of active compute instances"),
  traffic: z7.number().describe("Current traffic load"),
  currentTime: z7.number().int().describe("Current simulation time step"),
  tick_seconds: z7.number().int().min(1).max(3600).optional().describe("Simulation seconds represented by this step"),
  unmodeled_dimensions_active: z7.boolean().optional().describe("True when at least one unmodeled cost dimension (e.g. egress, cross_az_traffic) was active during this step. Agents should condition their policy on this flag \u2014 when true, the reported cost is an underestimate and the topology exploits unpriced blind spots."),
  warmup_factor: z7.number().optional().describe("Minimum warmup capacity factor across all compute/Kubernetes resources that carry a warm-up counter, in (0, 1]. Value is 1.0 when all instances are fully warmed; less than 1.0 while any instance is still in its warm-up window. Absent when no resources carry a warm-up counter. Use this as a direct observation feature in your reward function \u2014 low values indicate recently-provisioned instances are not yet at full throughput. The curve shape (window length and peak penalty) varies by cloud provider, reflecting each cloud's real-world JIT/cold-start characteristics: AWS ~2 steps / 40% peak penalty, GCP ~3 steps / 35%, Azure ~4 steps / 45%, OCI ~3 steps / 30%, DigitalOcean ~2 steps / 25%. Check metrics.compute[].warmup_steps_remaining for the per-resource window."),
  routedRps_per_node: z7.number().optional().describe("Average requests per second routed to each active compute node this step. Computed as total traffic routed to all compute resources divided by total active compute instance count. Unlike `rps` (which is the simulation-wide throughput total), this field tells the agent exactly how much per-node load each instance is carrying \u2014 without requiring a manual division. Absent on reset observations and on steps where no compute resources exist."),
  unavailable_node_count: z7.number().int().optional().describe("Number of compute, kubernetes, and database resources with availabilityState 'unavailable' at this step. Zero means all tracked resources are serving traffic. Use this as a direct policy signal \u2014 when greater than zero, at least one node has failed and surviving nodes are absorbing its traffic share. For per-node detail, inspect observation.resources[].availabilityState.")
});
var rlMetricsSchema = z7.object({
  cost_usd_hr: z7.number().describe("Current hourly cost in USD"),
  latency_p95: z7.number().describe("P95 latency in milliseconds"),
  error_rate: z7.number().describe("Error rate as a fraction (0\u20131)"),
  uptime: z7.number().describe("Uptime fraction (0\u20131)"),
  sla_violations: z7.number().int().describe("Number of SLA violations at this step"),
  error_breakdown: z7.object({
    database_pressure: z7.number().optional().describe("Database pressure contribution when a database's connection utilization or CPU utilization exceeds 80%; shares a combined 5-point cap with pool_saturation."),
    benchmark_reference_fit: z7.number().optional().describe("Benchmark-compatibility reference residual below database pressure onset; not a live database-pressure signal."),
    database_pressure_details: z7.array(z7.object({
      resource_id: z7.string(),
      name: z7.string(),
      cause: z7.enum([
        "connection_pressure",
        "cpu_pressure",
        "connection_and_cpu_pressure",
        "provider_reference_fit"
      ]),
      modeled_connections: z7.number().nonnegative(),
      usable_connection_limit: z7.number().nonnegative(),
      connection_utilization: z7.number().nonnegative(),
      cpu_utilization: z7.number().nonnegative(),
      contribution_pct: z7.number().nonnegative()
    })).optional().describe("Database and load signal responsible for the under-limit pressure contribution."),
    pool_saturation: z7.number(),
    pool_saturation_details: z7.array(z7.object({
      resource_id: z7.string(),
      name: z7.string(),
      cause: z7.literal("connection_limit_exceeded"),
      modeled_connections: z7.number().nonnegative(),
      usable_connection_limit: z7.number().nonnegative(),
      demand_basis: z7.literal("modeled connection demand; not observed live sessions")
    })).optional().describe("Databases whose modeled connection demand exceeds their own usable pool limits."),
    db_failure: z7.number(),
    compute_failure: z7.number(),
    capacity_overload: z7.number(),
    cpu_overload: z7.number(),
    oci_storage: z7.number(),
    queue_absorption: z7.number(),
    dependency_failure: z7.number().optional()
  }).optional().describe("Optional per-contributor error breakdown in percentage-point units."),
  connection_pressure: z7.number().optional().describe("DB connection-pool pressure ratio (activeConnections / maxConnections), capped at 3.0. Only present when the simulation contains database resources. Values > 1.0 indicate pool exhaustion."),
  serverless: z7.array(z7.object({
    resource_id: z7.string().describe("Resource id of this Aurora Serverless v2 database."),
    name: z7.string().describe("Human-readable resource name."),
    cpu_util: z7.number().describe("This DB's own CPU utilization as a fraction (0\u20131); reads 0 during the ACU warm-up window so the warming gap is visible even when the sim-wide cpu_util is non-zero."),
    acu: z7.number().describe("Current Aurora Capacity Units provisioned for this DB."),
    min_acu: z7.number().describe("Configured minimum ACU floor (default 0.5)."),
    max_acu: z7.number().describe("Configured maximum ACU ceiling (default 16)."),
    warming: z7.boolean().describe("True during the 4-step ACU scale-out window after the DB is added \u2014 while warming, cpu_util reads 0 and the DB is billed at the min_acu floor."),
    cost_usd_hr: z7.number().describe("This DB's own ACU-based hourly cost in USD (floor \u2248 $0.06/hr at 0.5 ACU). Derived from the existing per-ACU rate; no separate pricing constant."),
    connection_pressure: z7.number().describe("This DB's own connection-pool pressure against its fixed effective limit, capped at 3.0. The default Aurora PostgreSQL estimate derives from maximum configured ACU, not current ACU; an explicit maxConnections wins.")
  })).optional().describe("Per-serverless-DB breakdown so a single Aurora Serverless v2 database's warming window, ACU floor, and ACU-based cost are observable even when the simulation-wide cpu_util and cost_usd_hr aggregates mask them. Only present when the simulation contains at least one Aurora Serverless v2 database."),
  databases: z7.array(z7.object({
    resource_id: z7.string().describe("Resource id of this database."),
    name: z7.string().describe("Human-readable resource name."),
    cpu_util: z7.number().describe("This DB's own CPU utilization as a fraction (0\u20131)."),
    max_connections: z7.number().describe("This DB's connection-pool capacity. For provisioned DBs this is the configured maxConnections (default 100); for Aurora Serverless v2 it is the fixed explicit limit or maximum-ACU-derived estimate."),
    connection_pressure: z7.number().describe("This DB's own connection-pool pressure ratio against its own pool, capped at 3.0. Charged on the DB's even share (1/N) of routed traffic divided by this DB's pool size (an approximation that does not account for replica-specific routing). With a single DB this equals the sim-wide connection_pressure. Values > 1.0 indicate this DB's pool is saturating."),
    is_serverless: z7.boolean().describe("True if this is an Aurora Serverless v2 database (also present in the serverless array with ACU/warming detail).")
  })).optional().describe("Per-DB connection-pressure breakdown for EVERY database resource (provisioned and serverless). The sim-wide connection_pressure aggregate divides total estimated connections by the SUM of all pools, masking which DB is saturating in a multi-DB topology (e.g. RDS primary + read replicas). This array surfaces each DB's own cpu_util, pool size, and connection_pressure so agents can tell exactly which database is the bottleneck. Only present when the simulation contains at least one database resource."),
  compute: z7.array(z7.object({
    resource_id: z7.string().describe("Resource id of this compute or Kubernetes resource."),
    name: z7.string().describe("Human-readable resource name."),
    warmup_factor: z7.number().describe("Normalized capacity factor in (0, 1]. Value is 1.0 when fully warmed; less than 1.0 while warming (steepest at step 0). Use this directly as an RL observation feature instead of inferring it from step counters."),
    warming: z7.boolean().describe("True while the resource is still in its warm-up window."),
    warmup_steps_remaining: z7.number().int().describe("Steps remaining until the resource is fully warmed (0 when warmed). The total window length varies by provider: AWS 2 steps, GCP/OCI 3 steps, Azure 4 steps, DigitalOcean 2 steps.")
  })).optional().describe("Per-resource warm-up state for compute and Kubernetes resources that carry a warm-up counter. Only present when at least one such resource exists in the simulation. Absent when no resources have a warm-up counter. Agents should read warmup_factor directly as an observation feature \u2014 do not re-derive it from step counters. The curve shape varies by cloud provider (window length and peak penalty), reflecting each provider's real-world JIT/cold-start characteristics.")
});
var rlRewardComponentsSchema = z7.object({
  performance: z7.number().describe("Latency adherence reward component"),
  cost: z7.number().describe("Cost efficiency reward component"),
  stability: z7.number().describe("Autoscaling stability penalty component"),
  sla: z7.number().describe("SLA violation penalty component"),
  connection_pressure: z7.number().optional().describe("DB connection-pool saturation penalty (0 when healthy, negative when pool is exhausted). Only present when the simulation contains database resources. Ranges from 0 (pressure \u2264 1.0) to \u22121.0 (pressure \u2265 2.0), with a steeper slope above 1.5."),
  unmodeled_cost: z7.number().optional().describe("Penalty for active unmodeled cost dimensions (egress, cross_az_traffic). Negative when any unmodeled dimension was active this step; magnitude equals penalty_per_dimension \xD7 active_dimension_count. Absent when all cost dimensions are fully modeled.")
});
var rlRewardSchema = z7.object({
  total: z7.number(),
  components: rlRewardComponentsSchema,
  metrics: z7.object({
    avgLatency: z7.number(),
    errorRate: z7.number(),
    costPerHour: z7.number(),
    slaViolations: z7.number()
  })
});
var rewardWeightsSchema = z7.object({
  cost: z7.number().min(0),
  resilience: z7.number().min(0),
  latency: z7.number().min(0),
  performance: z7.number().min(0).optional(),
  stability: z7.number().min(0).optional()
}).strict();
var rlEpisodeConfigSchema = z7.object({
  maxSteps: z7.number().default(300),
  targetTrafficPattern: z7.enum(["ramp", "burst", "step", "wave", "custom"]).optional(),
  initialTraffic: z7.number().default(1e4),
  targetSLA: z7.object({
    maxLatencyP95: z7.number(),
    maxErrorRate: z7.number()
  }).default({ maxLatencyP95: 200, maxErrorRate: 1 }),
  costBudgetPerHour: z7.number().optional(),
  enableFailures: z7.boolean().default(false),
  scenarioId: z7.string().optional(),
  tick_seconds: z7.number().int().min(1).max(3600).default(60),
  // Conservative penalty applied per active unmodeled cost dimension (egress,
  // cross_az_traffic) at each step so agents are discouraged from exploiting
  // unpriced blind spots. Set to 0 to disable the guard and receive raw reward.
  unmodeled_cost_penalty_per_dimension: z7.number().min(0).default(0.1),
  // Per-dimension cost override rates (USD per 1000 RPS per hour). Supported
  // keys: "egress", "cross_az_traffic". When present, these extra rates are
  // applied to the cost model so previously unpriced dimensions become visible
  // in the reward signal. Primarily consumed by the eval-episodes endpoint to
  // stress-test trained policies against real-world cost blind spots.
  evalCostOverrides: z7.record(z7.number()).optional(),
  /**
   * Policy gate configuration for the pre-step policy validation gate (spike).
   * When enabled, validateActionPolicy runs before every processAction call.
   * The gate is off by default so existing environments are unaffected.
   */
  policyGate: z7.object({
    enabled: z7.boolean().default(false),
    mode: z7.enum(["warn", "block"]).default("warn")
  }).optional(),
  /**
   * Structural constraints for the compliance checker.
   * Enforced by checkCompliance() in the policy validator when policyGate is
   * enabled. Passed by default when absent.
   */
  constraints: z7.object({
    allowedProviders: z7.array(z7.string()).optional(),
    deniedProviders: z7.array(z7.string()).optional(),
    maxResourceCount: z7.number().int().optional(),
    deniedActionTypes: z7.array(z7.string()).optional()
  }).optional()
});
var rlInitialMetricsSnapshotSchema = z7.object({
  costUsdHr: z7.number().describe("Cost per hour at episode start (USD)"),
  latencyP95Ms: z7.number().describe("P95 latency at episode start (ms)"),
  errorRate: z7.number().describe("Error rate at episode start (fraction 0\u20131)")
});
var rlTradeoffSummarySchema = z7.object({
  costDeltaPercent: z7.number().describe("Cost change as a percentage of starting cost. Negative = cheaper."),
  costDirection: z7.enum(["improved", "degraded", "unchanged"]).describe("improved = lower cost, degraded = higher cost"),
  latencyP95DeltaMs: z7.number().describe("P95 latency change in milliseconds. Negative = faster."),
  latencyP95Direction: z7.enum(["improved", "degraded", "unchanged"]).describe("improved = lower latency, degraded = higher latency"),
  resilienceDeltaScore: z7.number().describe("Change in resilience score (uptime, 0\u20131). Positive = more resilient."),
  resilienceDirection: z7.enum(["improved", "degraded", "unchanged"]).describe("improved = higher uptime, degraded = lower uptime")
});
var rlEnvironmentSchema = z7.object({
  id: z7.string(),
  simulationId: z7.string(),
  episodeConfig: rlEpisodeConfigSchema,
  currentStep: z7.number().default(0),
  totalReward: z7.number().default(0),
  connectionPressureFirstSeenStep: z7.number().optional().describe("Step index at which connection_pressure first appeared in the reward (i.e. when a database resource first existed). Used to ramp the pressure penalty in gradually so adding a DB mid-episode does not cause a sudden reward discontinuity."),
  isActive: z7.boolean().default(true),
  lastSimTimeHuman: z7.string().optional(),
  cancelledAt: z7.string().optional(),
  lastActivityAt: z7.string().optional(),
  webhookUrl: z7.string().optional(),
  webhookSecret: z7.string().optional(),
  webhookDeliveryStatus: z7.enum(["pending", "delivered", "failed"]).optional(),
  webhookDeliveryAttempts: z7.number().optional(),
  webhookDeliveryError: z7.string().optional(),
  webhookDeliveredAt: z7.string().optional(),
  apiKeyId: z7.string().optional(),
  recoveryPolicies: z7.record(recoveryPolicySchema).optional(),
  rewardWeights: rewardWeightsSchema.optional(),
  initialMetricsSnapshot: rlInitialMetricsSnapshotSchema.optional().describe("Metrics captured at the first step of the episode. Used to compute the tradeoffSummary when done=true."),
  tradeoffSummary: rlTradeoffSummarySchema.optional().describe("Per-metric deltas stored when the episode ends (done=true). Absent for in-progress or cancelled episodes."),
  rewardHistory: z7.array(z7.number()).optional().describe("Per-step reward totals in episode order. Populated as steps execute; index 0 = step 1."),
  createdAt: z7.string(),
  updatedAt: z7.string()
});
var insertRLEnvironmentSchema = rlEnvironmentSchema.omit({
  id: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true
});
var rlStepRequestSchema = z7.object({
  action: rlActionSchema,
  tick_seconds: z7.number().int().min(1).max(3600).optional()
}).passthrough().superRefine((val, ctx) => {
  if (!val || typeof val !== "object") return;
  const KNOWN = /* @__PURE__ */ new Set(["action", "tick_seconds"]);
  const HINTS = {
    action_type: 'Did you mean "action.type"? The "action" field is a nested object: { action: { type: "scale_out", parameters: {} } }.',
    type: 'Did you mean "action.type"? Wrap it in an action object: { action: { type: "...", parameters: {} } }.',
    parameters: 'Did you mean "action.parameters"? The "parameters" field is nested inside "action": { action: { type: "...", parameters: { ... } } }.',
    action_parameters: 'Did you mean "action.parameters"? The action field is an object: { type: "...", parameters: { ... } }.',
    tick: 'Did you mean "tick_seconds"? (integer seconds per step, 1\u20133600)',
    tickSeconds: 'Did you mean "tick_seconds"? (snake_case)',
    seconds: 'Did you mean "tick_seconds"?'
  };
  for (const key of Object.keys(val)) {
    if (KNOWN.has(key)) continue;
    let msg = `Unknown field "${key}". Accepted fields: action, tick_seconds.`;
    if (HINTS[key]) msg += ` ${HINTS[key]}`;
    ctx.addIssue({ code: z7.ZodIssueCode.custom, path: [key], message: msg });
  }
});
var rlStepResponseSchema = z7.object({
  t: z7.number().int().describe("Current step index"),
  obs: rlObsSchema,
  metrics: rlMetricsSchema,
  reward: z7.number().describe("Scalar total reward for this step"),
  reward_components: rlRewardComponentsSchema,
  done: z7.boolean().describe("True when the episode has ended"),
  sim_time_human: z7.string().describe("Human-readable simulation time (e.g. '5m 0s')"),
  info: z7.record(z7.unknown()).describe("Additional episode metadata"),
  resources: z7.array(resourceSchema).describe("Full resource list with per-resource recoveryPolicy (defaults filled in for resources that have never had set_recovery_policy applied)"),
  tradeoffSummary: rlTradeoffSummarySchema.optional().describe("Per-metric deltas between episode-start and episode-end config. Present only when done=true."),
  unmodeled_cost_warning: z7.array(z7.string()).optional().describe("Cost dimensions that were active but unpriced during this step (e.g. ['egress', 'cross_az_traffic']). Empty or absent when all dimensions are fully modeled. Use this to detect topologies that exploit reward blind spots."),
  unmodeled_cost_penalty: z7.number().optional().describe("Total penalty subtracted from the reward for unmodeled cost dimensions this step. Equals penalty_per_dimension \xD7 active_dimension_count. Zero when no dimensions are active. Configure the per-dimension penalty magnitude via episodeConfig.unmodeled_cost_penalty_per_dimension.")
});
var rlBatchStepRequestSchema = z7.object({
  steps: z7.array(rlStepRequestSchema).min(1).max(30).describe("Ordered list of step actions to execute (max 30)")
}).passthrough().superRefine((val, ctx) => {
  if (!val || typeof val !== "object") return;
  const KNOWN = /* @__PURE__ */ new Set(["steps"]);
  const HINTS = {
    actions: 'Did you mean "steps"? The field is an array of step objects: [{ action: { type: "...", parameters: {} }, tick_seconds?: number }].',
    action: 'Did you mean "steps"? Provide an array: { steps: [{ action: { type: "...", parameters: {} } }] }.',
    step: 'Did you mean "steps"? Provide an array: { steps: [{ action: {...} }] }.',
    batch: 'Did you mean "steps"? The field is an array: { steps: [{ action: {...} }] }.'
  };
  for (const key of Object.keys(val)) {
    if (KNOWN.has(key)) continue;
    let msg = `Unknown field "${key}". Accepted field: steps (array of step objects, max 30).`;
    if (HINTS[key]) msg += ` ${HINTS[key]}`;
    ctx.addIssue({ code: z7.ZodIssueCode.custom, path: [key], message: msg });
  }
});
var rlBatchStepResponseSchema = z7.object({
  results: z7.array(rlStepResponseSchema).describe("Step results in the same order as the request steps array")
});
var rlEvalJobResultSchema = z7.object({
  episodes: z7.array(z7.object({
    episodeIndex: z7.number().int(),
    stepsExecuted: z7.number().int(),
    totalReward: z7.number(),
    /** Per-step error evidence from the replay, when available. */
    steps: z7.array(z7.object({
      step: z7.number().int().positive(),
      errorBreakdown: metricsSchema.shape.errorBreakdown.optional()
    })).optional()
  })),
  meanEvalReward: z7.number(),
  trainingTotalReward: z7.number(),
  collapseThreshold: z7.number(),
  reward_collapse: z7.boolean()
});
var rlEvalJobSchema = z7.object({
  id: z7.string(),
  status: z7.enum(["pending", "running", "completed", "failed"]),
  environmentId: z7.string(),
  simulationId: z7.string(),
  actions: z7.array(z7.array(rlActionSchema)),
  collapseThreshold: z7.number(),
  evalCostOverrides: z7.record(z7.number()),
  result: rlEvalJobResultSchema.optional(),
  apiKeyId: z7.string().optional(),
  createdAt: z7.string(),
  completedAt: z7.string().optional(),
  error: z7.string().optional()
});
var insertRlEvalJobSchema = rlEvalJobSchema.omit({
  id: true,
  createdAt: true
});
var apiKeySchema = z7.object({
  id: z7.string(),
  keyHash: z7.string(),
  keyPrefix: z7.string(),
  userId: z7.string().optional(),
  name: z7.string(),
  scopes: z7.array(z7.enum(["read", "write", "admin"])).default(["read", "write"]),
  rateLimit: z7.number().default(1e3),
  createdAt: z7.string(),
  lastUsedAt: z7.string().optional(),
  expiresAt: z7.string().optional(),
  isActive: z7.boolean().default(true)
});
var insertApiKeySchema = apiKeySchema.omit({
  id: true,
  createdAt: true
});
var registrationTokenSchema = z7.object({
  id: z7.string(),
  tokenHash: z7.string(),
  tokenPrefix: z7.string(),
  name: z7.string(),
  scopes: z7.array(z7.enum(["read", "write", "admin"])).default(["read", "write"]),
  rateLimit: z7.number().default(1e3),
  expiresAt: z7.string().optional(),
  usedAt: z7.string().optional(),
  issuedKeyId: z7.string().optional(),
  createdByKeyId: z7.string(),
  isActive: z7.boolean().default(true),
  createdAt: z7.string()
});
var insertRegistrationTokenSchema = registrationTokenSchema.omit({
  id: true,
  createdAt: true
});
var workloadProfileSchema = z7.object({
  computeInstances: z7.number().min(1),
  databaseInstances: z7.number().min(1),
  storageGB: z7.number().min(1),
  trafficRPS: z7.number().min(1),
  latencyRequirementMs: z7.number().min(1),
  primaryRegion: z7.string(),
  secondaryRegions: z7.array(z7.string()).default([]),
  requiresMultiRegion: z7.boolean().default(false),
  dataResidencyRequirements: z7.array(z7.string()).default([]),
  sourceProvider: cloudProviderSchema.default("aws"),
  /**
   * "standard" (default) — CPU-only workload; generates the full set of CPU compute strategies.
   * "inference"          — GPU inference workload; additionally generates one GPU K8s strategy
   *                        per provider (EKS A10G, GKE T4, AKS A10, OKE A10, DOKS H100),
   *                        priced from GPU_NODE_HOURLY_RATES in shared/provider-pricing.ts.
   */
  workloadType: z7.enum(["standard", "inference"]).default("standard"),
  /**
   * Target sustained output-token throughput (tokens/sec) for inference workloads.
   * When provided, the generator sizes each provider's GPU node count to meet this
   * target (ceil(targetTokensPerSec / acceleratorTokensPerSec)).  Ignored for
   * standard workloads.  If omitted for inference workloads, computeInstances is
   * used as the GPU node count directly.
   */
  targetTokensPerSec: z7.number().min(1).optional()
}).strict();
var providerAllocationSchema = z7.object({
  provider: cloudProviderSchema,
  computeInstances: z7.number(),
  databaseInstances: z7.number(),
  storageGB: z7.number(),
  trafficPercentage: z7.number(),
  regions: z7.array(z7.string()),
  databaseServiceFamily: z7.string().optional(),
  computeServiceFamily: z7.string().optional(),
  skuClass: z7.string(),
  computeSkuClass: z7.string().optional(),
  databaseSkuClass: z7.string().optional()
});
var strategyMetricsSchema = z7.object({
  totalCostPerHour: z7.number(),
  avgLatencyMs: z7.number(),
  p95LatencyMs: z7.number().optional(),
  vendorLockInScore: z7.number(),
  dataPortabilityScore: z7.number(),
  geographicCoverage: z7.number(),
  compositeScore: z7.number(),
  migrationEgressCost: z7.number().optional(),
  egressCostPerHour: z7.number().optional(),
  errorRate: z7.number().optional(),
  withinBudget: z7.boolean().nullable().optional(),
  meetsErrorBudget: z7.boolean().nullable().optional(),
  latencyHeadroomPct: z7.number().optional()
});
var providerCostBreakdownSchema = z7.object({
  provider: cloudProviderSchema,
  computeCostPerHour: z7.number(),
  databaseCostPerHour: z7.number(),
  storageCostPerHour: z7.number(),
  egressCostPerHour: z7.number(),
  totalCostPerHour: z7.number(),
  computeInstances: z7.number(),
  databaseInstances: z7.number(),
  storageGB: z7.number(),
  computeUnitRate: z7.number().optional(),
  databaseUnitRate: z7.number().optional(),
  storageUnitRate: z7.number().optional(),
  databaseServiceFamily: z7.string().optional(),
  /** RPS at which this allocation's hourly egress volume exhausts its free-tier allowance.
   *  Above this threshold, overage charges apply; below it, egress is $0.
   *  Math: freeHourlyGB / (RPS_TO_GB_PER_HOUR × trafficShare).
   *  0 means the free tier is exhausted at any positive traffic volume (e.g. Azure at ~1 RPS). */
  egressFreeTierExhaustedAtRPS: z7.number().optional()
});
var suggestedResourceSchema = z7.object({
  provider: cloudProviderSchema,
  resourceType: z7.enum(["compute", "database", "storage"]),
  size: z7.string(),
  count: z7.number(),
  hourlyRate: z7.number()
});
var strategySchema = z7.object({
  id: z7.string(),
  name: z7.string(),
  description: z7.string(),
  allocations: z7.array(providerAllocationSchema),
  metrics: strategyMetricsSchema,
  tradeoffs: z7.array(z7.string()),
  recommendations: z7.array(z7.string()),
  suggestedResources: z7.array(suggestedResourceSchema).optional(),
  securityRecommendations: z7.array(z7.string()).optional(),
  costBreakdown: z7.array(providerCostBreakdownSchema).default([]),
  crossClassNote: z7.string().optional()
});
var multiCloudJobSchema = z7.object({
  id: z7.string(),
  workloadProfile: workloadProfileSchema,
  optimizationWeights: z7.object({
    cost: z7.number(),
    latency: z7.number(),
    vendorLockIn: z7.number()
  }).strict().default({ cost: 0.4, latency: 0.4, vendorLockIn: 0.2 }),
  status: z7.enum(["pending", "running", "completed", "failed", "cancelled"]),
  progress: z7.number().default(0),
  strategiesGenerated: z7.number().default(0),
  allStrategies: z7.array(strategySchema).default([]),
  topStrategies: z7.array(strategySchema).default([]),
  comparisonReport: z7.string().optional(),
  latencyWarning: z7.string().optional(),
  estimateDisclaimer: z7.string().optional(),
  error: z7.string().optional(),
  webhookUrl: z7.string().optional(),
  webhookSecret: z7.string().optional(),
  webhookDeliveryStatus: z7.enum(["pending", "delivered", "failed"]).optional(),
  webhookDeliveryAttempts: z7.number().optional(),
  webhookDeliveryError: z7.string().optional(),
  webhookDeliveredAt: z7.string().optional(),
  apiKeyId: z7.string().optional(),
  createdAt: z7.string(),
  updatedAt: z7.string(),
  completedAt: z7.string().optional(),
  cancelledAt: z7.string().optional()
});
var insertMultiCloudJobSchema = multiCloudJobSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var mlMetricsPredictionSchema = z7.object({
  latencyP50: z7.number(),
  latencyP95: z7.number(),
  latencyP99: z7.number(),
  cpuUsage: z7.number(),
  memoryUsage: z7.number(),
  throughput: z7.number(),
  errorRate: z7.number(),
  costPerHour: z7.number(),
  confidence: z7.number().min(0).max(1)
});
var scalingProbabilitySchema = z7.object({
  scaleOut: z7.number().min(0).max(1),
  scaleIn: z7.number().min(0).max(1),
  expectedInstanceChange: z7.number(),
  expectedDelaySeconds: z7.number(),
  confidence: z7.number().min(0).max(1)
});
var bottleneckPredictionSchema = z7.object({
  resourceId: z7.string(),
  resourceName: z7.string(),
  probability: z7.number().min(0).max(1),
  type: z7.enum(["cpu", "memory", "throughput", "connections", "latency"]),
  severity: z7.enum(["low", "medium", "high", "critical"]),
  estimatedImpact: z7.string(),
  timeToBottleneck: z7.number().optional()
});
var providerQuirkSchema = z7.object({
  provider: cloudProviderSchema,
  region: z7.string().optional(),
  quirkType: z7.enum(["scaling_delay", "latency_jitter", "warmup_spike", "connection_overhead"]),
  value: z7.number(),
  description: z7.string()
});
var costDeltaPredictionSchema = z7.object({
  predictedCostPerHour: z7.number(),
  variance: z7.number(),
  hiddenCharges: z7.array(z7.object({
    type: z7.string(),
    amount: z7.number(),
    description: z7.string()
  })),
  confidence: z7.number().min(0).max(1)
});
var eventLikelihoodSchema = z7.object({
  eventType: z7.enum(["cascading_failure", "retry_storm", "queue_overload", "connection_exhaustion"]),
  probability: z7.number().min(0).max(1),
  timeframe: z7.number(),
  triggeredBy: z7.array(z7.string()),
  potentialImpact: z7.string()
});
var mlPredictionSchema = z7.object({
  timestamp: z7.number(),
  metrics: mlMetricsPredictionSchema,
  scalingProbability: scalingProbabilitySchema.optional(),
  bottlenecks: z7.array(bottleneckPredictionSchema),
  providerQuirks: z7.array(providerQuirkSchema),
  costDelta: costDeltaPredictionSchema.optional(),
  eventLikelihoods: z7.array(eventLikelihoodSchema),
  overallConfidence: z7.number().min(0).max(1),
  reasoning: z7.string().optional(),
  /**
   * Label for the behavioral path the ML predictor used for this prediction,
   * e.g. "gpu-inference/ttft-decode-ml" when the ML service detected an
   * inferenceMode Kubernetes GPU workload and applied its token-economics
   * latency model, or "generic/nonlinear-heuristics" for the default
   * capacity/CPU heuristic path. Optional for backward compatibility with
   * persisted predictions that predate this field.
   */
  mlBehaviorModel: z7.string().optional()
});
var hybridConfigSchema = z7.object({
  enabled: z7.boolean().default(true),
  blendingWeights: z7.object({
    rules: z7.number().min(0).max(1).default(0.5),
    ml: z7.number().min(0).max(1).default(0.5)
  }),
  confidenceThreshold: z7.number().min(0).max(1).default(0.7),
  safetyBounds: z7.object({
    maxLatencyDeviation: z7.number().default(50),
    maxCostDeviation: z7.number().default(0.2),
    maxErrorRateDeviation: z7.number().default(5)
  }),
  fallbackToRules: z7.boolean().default(true),
  enableBottleneckPrediction: z7.boolean().default(true),
  enableProviderQuirks: z7.boolean().default(true),
  enableEventPrediction: z7.boolean().default(true)
});
var predictionComparisonSchema = z7.object({
  field: z7.string(),
  ruleValue: z7.number(),
  mlValue: z7.number(),
  hybridValue: z7.number(),
  deviation: z7.number(),
  source: z7.enum(["rules", "ml", "hybrid_blend", "rules_fallback"]),
  confidence: z7.number().min(0).max(1),
  reasoning: z7.string()
});
var hybridAgreementSchema = z7.object({
  score: z7.number().min(0).max(1),
  level: z7.enum(["high", "moderate", "low"]),
  largestDisagreement: z7.enum(["cost", "latencyP95", "latencyP99", "errorRate"]),
  // The agreement score is calibrated against the configured safety-bound
  // thresholds, not against relative metric sensitivity: latency (P95/P99) and
  // error-rate deviations are absolute (ms / pp) divided by their bounds, while
  // cost deviation is relative to the rule-based cost divided by
  // maxCostDeviation. Optional for backward compatibility with persisted
  // decisions that predate this field.
  normalizationBasis: z7.literal("absolute_safety_bounds").optional()
});
var coverageFidelitySchema = z7.enum([
  // Deterministic CWM pricing rules cover this resource/behaviour using public
  // list rates. Modeled does not mean billing-validated — real invoices may
  // differ due to committed-use discounts, support surcharges, marketplace
  // licensing, and on-demand price changes.
  "modeled",
  "estimated",
  // represented through ML-blend, approximation, or extrapolation
  "known_gap",
  // known to exist in this simulation but not simulated
  "not_observable"
  // dependencies/charges CWM has no visibility into at all
]);
var coverageResourceEntrySchema = z7.object({
  name: z7.string(),
  resourceType: z7.string(),
  costFidelity: coverageFidelitySchema,
  behaviourFidelity: coverageFidelitySchema,
  // Share (0–1) of total simulated cost for this resource. May be deliberately
  // set to 0 when the pricing engine could not match the resource's declared
  // SKU (unrecognized_skus path) — in that case shareExcluded is set to true
  // so consumers can distinguish a zero-cost resource from an excluded one.
  shareOfSimulatedCost: z7.number(),
  // True when shareOfSimulatedCost is deliberately zeroed because the SKU/basis
  // is unrecognized or unsupported — as opposed to a resource that legitimately
  // costs nothing. Absent (undefined/false) for normal entries.
  shareExcluded: z7.boolean().optional(),
  reason: z7.string(),
  coverageBasis: z7.enum(["deterministic", "ml", "estimated", "unsupported"]),
  // Optional human-readable rationale for how this row's fidelity was
  // resolved (e.g. which GPU per-node rate path an inference cluster took),
  // so callers can surface the "why" without parsing the fidelity enums.
  note: z7.string().optional()
});
var billingPolicyExclusionSchema = z7.object({
  resourceId: z7.string(),
  resourceName: z7.string(),
  policy: z7.string(),
  priced: z7.literal(false),
  reason: z7.string()
});
var coverageSummarySchema = z7.object({
  // Resource/behavior fidelity only. This level must not be interpreted as
  // complete economic or invoice coverage; consult billingPolicyCoverage.
  level: z7.enum(["full", "partial", "limited"]),
  modeledCount: z7.number(),
  estimatedCount: z7.number(),
  knownGapCount: z7.number(),
  // Topology-specific dimensions CWM cannot observe about THIS simulation's
  // environment (e.g. support-plan charges in a multi-cloud mix). Populated
  // from applicability predicates against the resource mix. An empty value is
  // valid and intentional — it means no not-observable predicates fired for
  // this particular topology (distinct from structuralLimitations, which is
  // model-wide and always present for any provider).
  notObservableCategories: z7.array(z7.string()),
  // Permanent model-level exclusions: whole service/pricing classes CWM never
  // simulates for the providers present in the resource mix (e.g. IAM,
  // CloudWatch metering, Savings Plans for AWS). Semantically distinct from
  // notObservableCategories — these are limitations of the model itself, not
  // of what is observable in this particular topology. Should be consistent
  // across all decision objects within the same session (same providers).
  // Defaulted for backward compatibility with decisions persisted before this field shipped.
  structuralLimitations: z7.array(z7.string()).default([]),
  // Sum of shareOfSimulatedCost ONLY for rows with costFidelity === "modeled"
  // (deterministically simulated, not estimated). This is the authoritative
  // Trust Layer denominator: values in (0, 1] indicate the fraction of
  // simulated cost backed by fully-modeled resources. A value well below 1.0
  // (e.g. 0.0166) signals that most simulated cost is in unsupported or
  // estimated resources. Defaults to 0 for backward compatibility with legacy
  // persisted decisions produced before this field shipped.
  modeledCostShareOfTotal: z7.number().default(0),
  billingPolicyCoverage: z7.object({
    complete: z7.boolean(),
    status: z7.enum(["complete", "excluded_policies"]),
    exclusions: z7.array(billingPolicyExclusionSchema)
  }).default({ complete: true, status: "complete", exclusions: [] }),
  resources: z7.array(coverageResourceEntrySchema)
});
var behaviorMismatchSchema = z7.object({
  /** True when a rule-engine path mismatch was detected on this step. */
  detected: z7.boolean(),
  /**
   * Human-readable explanation of the detected rule-engine configuration issue.
   * States which GPU signals were found, which latency model the rule engine is
   * using, and what to set to activate the GPU inference path. This is a
   * factual note about the rule engine's path — not a claim about what the
   * hybrid ML predictor does internally (the ML predictor derives its latency
   * prediction from the rule engine's baseline output).
   */
  cause: z7.string(),
  /**
   * IDs of Kubernetes resources that carry GPU/inference characteristics
   * (`accelerator`, `tokensPerRequest`, or `inputTokensPerRequest`) but have
   * `inferenceMode: false` (or absent), causing the rule engine to use
   * `generic-kubernetes/load-saturation` instead of `gpu-inference/ttft-decode`.
   */
  affectedResources: z7.array(z7.string())
});
var hybridDecisionSchema = z7.object({
  timestamp: z7.number(),
  ruleBasedMetrics: metricsSchema,
  mlPrediction: mlPredictionSchema,
  hybridMetrics: metricsSchema,
  comparisons: z7.array(predictionComparisonSchema),
  // Optional for backward compatibility: persisted hybrid results that predate
  // this field have decisions without an agreement object.
  agreement: hybridAgreementSchema.optional(),
  blendingApplied: z7.boolean(),
  fallbackUsed: z7.boolean(),
  safetyBoundsViolated: z7.array(z7.string()),
  explanation: z7.string(),
  // Optional for backward compatibility: decisions persisted before the
  // coverage layer shipped do not carry this field.
  coverageSummary: coverageSummarySchema.optional(),
  /**
   * Present when `agreement.level === "low"` AND at least one Kubernetes
   * resource in the simulation carries GPU/inference signals without
   * `inferenceMode: true`. Indicates the rule engine is using the
   * generic-kubernetes latency path for a resource that may be intended as a
   * GPU inference workload. This is a factual configuration note about the
   * rule engine's behavior — not a claim about the ML predictor, which derives
   * its latency prediction from the rule engine's baseline output.
   * Absent when the agreement level is not "low" or no mismatch was detected.
   */
  behaviorMismatch: behaviorMismatchSchema.optional(),
  /**
   * Provenance: the latency path the rules engine used for this step's
   * dominant workload class (e.g. "gpu-inference/ttft-decode" or
   * "generic-kubernetes/load-saturation"). Optional for backward
   * compatibility with persisted decisions that predate this field.
   */
  rulesBehaviorModel: z7.string().optional(),
  /**
   * Provenance: the path/label the ML service used for this prediction
   * (e.g. "gpu-inference/ttft-decode-ml" or "generic/nonlinear-heuristics").
   */
  mlBehaviorModel: z7.string().optional(),
  /**
   * "aligned" when the rules engine and ML service operated on the same
   * workload class for this step; "misaligned" when they diverged (e.g. the
   * rules engine used the GPU-inference TTFT model but the ML service fell
   * back to generic compute saturation). Lets a disagreement be diagnosed as
   * "same model, different numbers" vs "different models entirely".
   */
  behaviorAlignment: z7.enum(["aligned", "misaligned"]).optional(),
  /**
   * Provenance disclaimer for agents reading GPU inference latency figures from
   * this decision. Copied from the dominant inference resource's
   * `behaviorModel.modelingNote` when `rulesBehaviorModel` is the GPU inference
   * path. Absent on non-inference steps.
   */
  modelingNote: z7.string().optional()
});
var hybridSimulationResultSchema = z7.object({
  simulationId: z7.string(),
  config: hybridConfigSchema,
  decisions: z7.array(hybridDecisionSchema),
  summary: z7.object({
    totalSteps: z7.number(),
    mlConfidenceAvg: z7.number(),
    blendedSteps: z7.number(),
    fallbackSteps: z7.number(),
    bottlenecksDetected: z7.number(),
    eventsDetected: z7.number()
  }),
  createdAt: z7.string()
});
var insertHybridSimulationResultSchema = hybridSimulationResultSchema.omit({
  createdAt: true
});
var hybridDecisionReadSchema = hybridDecisionSchema.extend({
  latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
  blendingApplied: z7.boolean().nullable(),
  fallbackUsed: z7.boolean().nullable(),
  mlPrediction: mlPredictionSchema.extend({
    metrics: mlMetricsPredictionSchema.extend({
      latencyP50: z7.number().nullable(),
      latencyP95: z7.number().nullable(),
      latencyP99: z7.number().nullable()
    })
  })
});
var hybridSimulationResultReadSchema = hybridSimulationResultSchema.extend({
  decisions: z7.array(hybridDecisionReadSchema)
});
var creditAccountSchema = z7.object({
  userId: z7.string(),
  balance: z7.number().int().min(0),
  freeRefreshAt: z7.string(),
  createdAt: z7.string()
});
var creditTransactionSchema = z7.object({
  id: z7.string(),
  userId: z7.string(),
  delta: z7.number().int(),
  callType: z7.string(),
  apiKeyId: z7.string().optional(),
  stripeSessionId: z7.string().optional(),
  description: z7.string(),
  createdAt: z7.string()
});
var aiJobSchema = z7.object({
  id: z7.string(),
  status: z7.enum(["pending", "running", "completed", "failed", "cancelled"]),
  simulationId: z7.string(),
  jobType: z7.enum(["explain", "troubleshoot", "analyze_bottlenecks", "optimize"]),
  beginnerMode: z7.boolean().optional(),
  issue: z7.string().optional(),
  result: z7.record(z7.unknown()).optional(),
  apiKeyId: z7.string().optional(),
  createdAt: z7.string(),
  completedAt: z7.string().optional(),
  cancelledAt: z7.string().optional(),
  error: z7.string().optional()
});
var insertAiJobSchema = aiJobSchema.omit({
  id: true,
  createdAt: true
});
var rightSizingReversibilitySchema = z7.object({
  tier: z7.enum(["instant", "minutes", "hours", "days"]),
  estimatedMinutesMin: z7.number().optional(),
  estimatedMinutesMax: z7.number().optional(),
  reason: z7.string(),
  basis: z7.literal("rule_based")
});
var utilizationMetricSchema = z7.enum(["cpu", "gpu", "memory", "connections", "iops", "unknown"]);
var PROVIDER_API_LIMIT_CONTRACT_VERSION = 1;
var PROVIDER_API_LIMIT_MAX_WORKERS = 1e3;
var PROVIDER_API_LIMIT_MAX_PLANNED_OPERATIONS = 1e5;
var PROVIDER_API_LIMIT_MAX_DEPENDENCIES_PER_OPERATION = 32;
var PROVIDER_API_LIMIT_MAX_RETRY_ATTEMPTS = 10;
var PROVIDER_API_LIMIT_MAX_CONCURRENCY = 1e3;
var PROVIDER_API_LIMIT_MAX_CONCURRENCY_SWEEP = 16;
var PROVIDER_API_LIMIT_MAX_OPERATIONS = 256;
var providerApiBoundedNameSchema = z7.string().trim().min(1).max(128);
var providerApiDateSchema = z7.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "asOfDate must use YYYY-MM-DD"
).refine((value) => {
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}, "asOfDate must be a real calendar date");
var providerApiOperationCategorySchema = z7.enum([
  "compute",
  "database",
  "storage",
  "network",
  "kubernetes",
  "identity",
  "monitoring",
  "quota",
  "other"
]);
var providerApiQuotaClassificationSchema = z7.enum([
  "documented_public_default",
  "configurable_account_quota",
  "observed_behavior"
]);
var providerApiQuotaSourceKindSchema = z7.enum([
  "provider_documentation",
  "provider_quota_documentation",
  "provider_observation",
  "caller_supplied"
]);
var providerApiQuotaConfidenceSchema = z7.enum(["high", "medium", "low"]);
var providerApiQuotaUnitSchema = z7.preprocess((value) => {
  if (typeof value !== "string") return value;
  const aliases = {
    "requests/sec": "requests_per_second",
    "requests/second": "requests_per_second",
    "requests/min": "requests_per_minute",
    "requests/minute": "requests_per_minute",
    "requests/hour": "requests_per_hour",
    "operations/sec": "operations_per_second",
    "operations/second": "operations_per_second",
    "operations/min": "operations_per_minute",
    "operations/minute": "operations_per_minute",
    "requests/window": "requests_per_window",
    "operations/window": "operations_per_window",
    "concurrency": "concurrent_requests"
  };
  return aliases[value] ?? value;
}, z7.enum([
  "requests_per_second",
  "requests_per_minute",
  "requests_per_hour",
  "operations_per_second",
  "operations_per_minute",
  "requests_per_window",
  "operations_per_window",
  "concurrent_requests"
]));
var providerApiQuotaScopeSchema = z7.object({
  account: providerApiBoundedNameSchema.optional(),
  subscription: providerApiBoundedNameSchema.optional(),
  project: providerApiBoundedNameSchema.optional(),
  servicePrincipal: providerApiBoundedNameSchema.optional(),
  region: providerApiBoundedNameSchema.optional(),
  service: providerApiBoundedNameSchema.optional(),
  operation: providerApiBoundedNameSchema.optional(),
  resource: providerApiBoundedNameSchema.optional()
}).strict().superRefine((scope, ctx) => {
  if (Object.keys(scope).length === 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      message: "quota scope must identify at least one dimension"
    });
  }
});
var providerApiQuotaProvenanceSchema = z7.object({
  sourceKind: providerApiQuotaSourceKindSchema,
  sourceReference: providerApiBoundedNameSchema,
  asOfDate: providerApiDateSchema,
  customerSpecific: z7.boolean(),
  observed: z7.boolean(),
  confidence: providerApiQuotaConfidenceSchema
}).strict().superRefine((provenance, ctx) => {
  const providerDocs = provenance.sourceKind === "provider_documentation" || provenance.sourceKind === "provider_quota_documentation";
  if (providerDocs && !/^https?:\/\/\S+$/i.test(provenance.sourceReference)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["sourceReference"],
      message: "provider documentation provenance requires an HTTP(S) source reference"
    });
  }
  if (provenance.sourceKind === "provider_observation" && !provenance.observed) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["observed"],
      message: "provider_observation provenance must be marked observed"
    });
  }
  if ((provenance.sourceKind === "provider_documentation" || provenance.sourceKind === "provider_quota_documentation") && (provenance.customerSpecific || provenance.observed)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["sourceKind"],
      message: "provider documentation provenance cannot be customer-specific or observed"
    });
  }
  if (provenance.sourceKind === "caller_supplied" && provenance.observed) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["observed"],
      message: "caller_supplied quota overrides must not be marked as observed behavior"
    });
  }
  if (provenance.sourceKind === "caller_supplied" && !provenance.customerSpecific) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["customerSpecific"],
      message: "caller_supplied provenance must be customer-specific"
    });
  }
});
var providerApiRateQuantitySchema = z7.object({
  limit: z7.number().finite().positive().max(1e9),
  unit: providerApiQuotaUnitSchema,
  windowSeconds: z7.number().finite().positive().max(86400)
}).strict();
var providerApiBurstCapacitySchema = z7.object({
  capacity: z7.number().finite().positive().max(1e9),
  unit: providerApiQuotaUnitSchema,
  windowSeconds: z7.number().finite().positive().max(86400),
  refill: z7.enum(["none", "fixed_window", "token_bucket"]),
  refillRate: z7.number().finite().positive().max(1e9).optional()
}).strict().superRefine((burst, ctx) => {
  if (burst.refill === "none" && burst.refillRate !== void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["refillRate"],
      message: "refillRate is only valid for a refilling burst policy"
    });
  }
  if (burst.refill !== "none" && burst.refillRate === void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["refillRate"],
      message: "refillRate is required for a refilling burst policy"
    });
  }
});
var providerApiLatencySchema = z7.object({
  meanMs: z7.number().finite().nonnegative().max(12e4),
  p95Ms: z7.number().finite().nonnegative().max(12e4),
  timeoutMs: z7.number().finite().positive().max(12e4),
  jitterMs: z7.number().finite().nonnegative().max(12e4).default(0)
}).strict().superRefine((latency, ctx) => {
  if (latency.p95Ms < latency.meanMs) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["p95Ms"],
      message: "p95Ms must be at least meanMs"
    });
  }
});
var providerApiRetrySchema = z7.object({
  maxAttempts: z7.number().int().min(1).max(PROVIDER_API_LIMIT_MAX_RETRY_ATTEMPTS).default(1),
  baseBackoffMs: z7.number().finite().nonnegative().max(6e4).default(0),
  maxBackoffMs: z7.number().finite().nonnegative().max(6e5).default(0),
  backoffMultiplier: z7.number().finite().min(1).max(10).default(2),
  jitterRatio: z7.number().finite().min(0).max(1).default(0),
  retryable: z7.array(z7.enum(["throttled", "timeout", "server_error"])).max(3).default([
    "throttled",
    "timeout",
    "server_error"
  ])
}).strict().superRefine((retry, ctx) => {
  if (retry.maxBackoffMs < retry.baseBackoffMs) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["maxBackoffMs"],
      message: "maxBackoffMs must be at least baseBackoffMs"
    });
  }
  if (new Set(retry.retryable).size !== retry.retryable.length) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["retryable"],
      message: "retryable conditions must be unique"
    });
  }
});
var providerApiOperationSchema = z7.object({
  id: providerApiBoundedNameSchema,
  operation: providerApiBoundedNameSchema,
  category: providerApiOperationCategorySchema,
  plannedCount: z7.number().int().positive().max(PROVIDER_API_LIMIT_MAX_PLANNED_OPERATIONS),
  dependsOn: z7.array(providerApiBoundedNameSchema).max(PROVIDER_API_LIMIT_MAX_DEPENDENCIES_PER_OPERATION).default([]),
  resource: providerApiBoundedNameSchema.optional()
}).strict();
var providerApiConcurrencySweepSchema = z7.object({
  values: z7.array(z7.number().int().positive().max(PROVIDER_API_LIMIT_MAX_CONCURRENCY)).min(1).max(PROVIDER_API_LIMIT_MAX_CONCURRENCY_SWEEP)
}).strict().superRefine((sweep, ctx) => {
  if (new Set(sweep.values).size !== sweep.values.length) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["values"],
      message: "concurrency sweep values must be unique"
    });
  }
});
var providerApiOperationAccountingSchema = z7.object({
  plannedOperations: z7.number().int().nonnegative(),
  attemptedOperations: z7.number().int().nonnegative(),
  retryOperations: z7.number().int().nonnegative(),
  /** Quota-rejected attempts; this may overlap with retries and eventual completions. */
  throttledOperations: z7.number().int().nonnegative(),
  completedOperations: z7.number().int().nonnegative(),
  denominator: z7.literal("planned_operations")
}).strict();
var providerApiQuotaPolicySchema = z7.object({
  policyId: providerApiBoundedNameSchema,
  provider: cloudProviderSchema,
  service: providerApiBoundedNameSchema,
  operationCategory: providerApiOperationCategorySchema,
  /** Use the explicit "all" value for a policy that covers every operation. */
  operation: providerApiBoundedNameSchema,
  scope: providerApiQuotaScopeSchema,
  classification: providerApiQuotaClassificationSchema,
  provenance: providerApiQuotaProvenanceSchema,
  sustainedRate: providerApiRateQuantitySchema.optional(),
  burstCapacity: providerApiBurstCapacitySchema.optional(),
  concurrencyCeiling: z7.number().int().positive().max(PROVIDER_API_LIMIT_MAX_CONCURRENCY).optional(),
  /** Absent means the existing rejection/throttle behavior. */
  concurrencyOverflow: z7.enum(["queue", "reject"]).optional(),
  enforcement: z7.enum([
    "token_bucket",
    "fixed_window",
    "sliding_window",
    "concurrency_ceiling",
    "provider_defined"
  ]),
  notes: z7.string().trim().min(1).max(512)
}).strict().superRefine((policy, ctx) => {
  if (!policy.sustainedRate && !policy.burstCapacity && policy.concurrencyCeiling === void 0) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      message: "a quota policy must provide a sustained rate, burst capacity, or concurrency ceiling"
    });
  }
  const { classification, provenance } = policy;
  if (classification === "documented_public_default" && (provenance.sourceKind !== "provider_documentation" || provenance.customerSpecific || provenance.observed)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["provenance"],
      message: "documented_public_default must be non-customer-specific, unobserved provider documentation"
    });
  }
  if (classification === "configurable_account_quota" && !["provider_quota_documentation", "caller_supplied"].includes(provenance.sourceKind)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["provenance", "sourceKind"],
      message: "configurable_account_quota requires quota documentation or a caller-supplied override"
    });
  }
  if (classification === "observed_behavior" && !provenance.observed) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["provenance", "observed"],
      message: "observed_behavior must include observed provenance"
    });
  }
  if (provenance.sourceKind === "caller_supplied" && ![policy.scope.account, policy.scope.subscription, policy.scope.project].some((value) => value !== void 0 && value !== "*")) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["scope"],
      message: "caller_supplied overrides require a concrete account, subscription, or project scope"
    });
  }
  if (policy.scope.service !== void 0 && policy.scope.service !== policy.service) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["scope", "service"],
      message: "scope.service must match the policy service"
    });
  }
  if (policy.scope.operation !== void 0 && policy.scope.operation !== policy.operation) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["scope", "operation"],
      message: "scope.operation must match the policy operation"
    });
  }
});
var providerApiLimitRequestSchema = z7.object({
  contractVersion: z7.literal(PROVIDER_API_LIMIT_CONTRACT_VERSION).default(
    PROVIDER_API_LIMIT_CONTRACT_VERSION
  ),
  provider: cloudProviderSchema,
  region: providerApiBoundedNameSchema,
  service: providerApiBoundedNameSchema,
  operations: z7.array(providerApiOperationSchema).min(1).max(PROVIDER_API_LIMIT_MAX_OPERATIONS),
  workerCount: z7.number().int().positive().max(PROVIDER_API_LIMIT_MAX_WORKERS).default(1),
  maxConcurrency: z7.number().int().positive().max(PROVIDER_API_LIMIT_MAX_CONCURRENCY).default(1),
  concurrencySweep: providerApiConcurrencySweepSchema.optional(),
  latency: providerApiLatencySchema,
  retry: providerApiRetrySchema.default({}),
  quotaScope: providerApiQuotaScopeSchema.optional(),
  quotaOverrides: z7.array(providerApiQuotaPolicySchema).max(32).default([])
}).strict().superRefine((request, ctx) => {
  if (request.provider === "aws" && request.service === "rds-data-api-aurora-serverless-v1" && new Set(request.operations.map((operation) => operation.operation)).size > 1 && request.operations.some((operation) => operation.operation === "requests-per-second" || operation.operation === "concurrent-requests")) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["operations"],
      message: "Aurora Serverless v1 Data API rate and concurrency selectors are independent models; mixed selectors cannot enforce both jointly"
    });
  }
  const operationIds = /* @__PURE__ */ new Set();
  let totalPlanned = 0;
  for (let i = 0; i < request.operations.length; i++) {
    const operation = request.operations[i];
    if (operationIds.has(operation.id)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["operations", i, "id"],
        message: `Duplicate operation id: ${operation.id}`
      });
    }
    operationIds.add(operation.id);
    totalPlanned += operation.plannedCount;
    if (operation.dependsOn.includes(operation.id)) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["operations", i, "dependsOn"],
        message: "an operation cannot depend on itself"
      });
    }
    for (const dependency of operation.dependsOn) {
      if (!request.operations.some((candidate) => candidate.id === dependency)) {
        ctx.addIssue({
          code: z7.ZodIssueCode.custom,
          path: ["operations", i, "dependsOn"],
          message: `Unknown operation dependency: ${dependency}`
        });
      }
    }
  }
  if (totalPlanned > PROVIDER_API_LIMIT_MAX_PLANNED_OPERATIONS) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["operations"],
      message: `planned operations must not exceed ${PROVIDER_API_LIMIT_MAX_PLANNED_OPERATIONS}`
    });
  }
  if (request.concurrencySweep?.values.some((value) => value > request.maxConcurrency)) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["concurrencySweep", "values"],
      message: "concurrency sweep values cannot exceed maxConcurrency"
    });
  }
  if (request.quotaScope) {
    if (request.quotaScope.region !== void 0 && request.quotaScope.region !== request.region) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["quotaScope", "region"],
        message: "quotaScope.region must match the request region"
      });
    }
    if (request.quotaScope.service !== void 0 && request.quotaScope.service !== request.service) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["quotaScope", "service"],
        message: "quotaScope.service must match the request service"
      });
    }
    const operationNames = new Set(request.operations.map((operation) => operation.operation));
    if (request.quotaScope.operation !== void 0 && (operationNames.size !== 1 || !operationNames.has(request.quotaScope.operation))) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["quotaScope", "operation"],
        message: "quotaScope.operation must identify the single operation in the workload"
      });
    }
    const operationResources = new Set(
      request.operations.map((operation) => operation.resource).filter((resource) => resource !== void 0)
    );
    if (request.quotaScope.resource !== void 0 && !(request.provider === "aws" && request.service === "rds-data-api-aurora-serverless-v1" && operationNames.size === 1 && operationNames.has("concurrent-requests")) && (operationResources.size !== 0 && (operationResources.size !== 1 || !operationResources.has(request.quotaScope.resource)))) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["quotaScope", "resource"],
        message: "quotaScope.resource must match the single resource in the workload"
      });
    }
  }
  const indegree = new Map(request.operations.map((operation) => [operation.id, operation.dependsOn.length]));
  const outgoing = /* @__PURE__ */ new Map();
  for (const operation of request.operations) {
    for (const dependency of operation.dependsOn) {
      const dependents = outgoing.get(dependency) ?? [];
      dependents.push(operation.id);
      outgoing.set(dependency, dependents);
    }
  }
  const ready = Array.from(indegree.entries()).filter(([, degree]) => degree === 0).map(([id]) => id).sort();
  let visited = 0;
  while (ready.length > 0) {
    const id = ready.shift();
    visited++;
    for (const dependent of outgoing.get(id) ?? []) {
      const nextDegree = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, nextDegree);
      if (nextDegree === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }
  if (visited !== request.operations.length) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["operations"],
      message: "operation dependencies must form an acyclic graph"
    });
  }
});
var providerApiLimitSimulationRequestSchema = providerApiLimitRequestSchema.innerType().extend({
  seed: z7.number().int().min(0).max(4294967295).default(0),
  concurrency: z7.number().int().positive().max(PROVIDER_API_LIMIT_MAX_CONCURRENCY).optional(),
  failureProbability: z7.number().finite().min(0).max(1).default(0),
  maxThrottleRate: z7.number().finite().min(0).max(1).default(1),
  maxEvents: z7.number().int().positive().max(1e6).default(1e6)
}).superRefine((request, ctx) => {
  const {
    seed: _seed,
    concurrency: _concurrency,
    failureProbability: _failureProbability,
    maxThrottleRate: _maxThrottleRate,
    maxEvents: _maxEvents,
    ...baseRequest
  } = request;
  const baseResult = providerApiLimitRequestSchema.safeParse(baseRequest);
  if (baseResult.success) return;
  for (const issue of baseResult.error.issues) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: issue.path,
      message: issue.message
    });
  }
});
var providerApiLimitResolutionSchema = z7.object({
  contractVersion: z7.literal(PROVIDER_API_LIMIT_CONTRACT_VERSION),
  status: z7.enum(["supported", "unsupported"]),
  operationCategory: providerApiOperationCategorySchema.optional(),
  operation: providerApiBoundedNameSchema.optional(),
  resource: providerApiBoundedNameSchema.optional(),
  policySource: z7.enum(["catalog_default", "caller_override"]).optional(),
  policy: providerApiQuotaPolicySchema.optional(),
  reason: z7.string().min(1).max(512).optional(),
  accounting: providerApiOperationAccountingSchema
}).strict().superRefine((result, ctx) => {
  if (result.status === "supported" && !result.policy) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["policy"],
      message: "supported resolution requires a policy"
    });
  }
  if (result.status === "unsupported" && !result.reason) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["reason"],
      message: "unsupported resolution requires a stable reason"
    });
  }
  if (result.policySource === "caller_override" && result.policy?.provenance.sourceKind !== "caller_supplied") {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["policySource"],
      message: "caller_override resolution must carry caller_supplied provenance"
    });
  }
});

// tools.ts
function errorResult(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
function notReadyResult(code, message, pollWith) {
  const body = {
    status: "not_ready",
    code,
    message,
    retryable: true,
    pollWith
  };
  return {
    content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
    structuredContent: body
  };
}
function toCompactStepResponse(raw) {
  const obj = raw !== null && typeof raw === "object" ? raw : {};
  const simulation = obj.simulation !== null && typeof obj.simulation === "object" ? obj.simulation : {};
  const metrics = obj.metrics !== null && typeof obj.metrics === "object" ? obj.metrics : {};
  const rawResources = Array.isArray(simulation.resources) ? simulation.resources : [];
  const rawEvents = Array.isArray(obj.events) ? obj.events : [];
  const num = (v) => typeof v === "number" ? v : void 0;
  const str = (v) => typeof v === "string" ? v : void 0;
  const latencyUnavailable = (value) => {
    const evidence = value.predictionEvidence;
    return evidence !== null && typeof evidence === "object" && evidence.latencyAvailability !== null && typeof evidence.latencyAvailability === "object" && evidence.latencyAvailability.status === "unavailable";
  };
  const latencyValue = (field) => latencyUnavailable(metrics) ? null : num(metrics[field]);
  const compact = {
    simulationId: str(simulation.id),
    scenarioHash: str(obj.scenarioHash ?? simulation.scenarioHash),
    effectiveConfigHash: str(obj.effectiveConfigHash ?? simulation.effectiveConfigHash),
    predictionEffectiveConfigHash: str(obj.predictionEffectiveConfigHash ?? simulation.predictionEffectiveConfigHash),
    engineVersion: str(obj.engineVersion ?? simulation.engineVersion),
    calibrationEvidence: metrics.calibrationEvidence ?? obj.calibrationEvidence ?? simulation.calibrationEvidence,
    predictionEvidence: metrics.predictionEvidence ?? obj.predictionEvidence ?? simulation.predictionEvidence,
    appWeight: simulation.appWeight ?? obj.appWeight,
    appWeightDefaulted: simulation.appWeightDefaulted ?? obj.appWeightDefaulted,
    predictionEvidenceStatus: metrics.predictionEvidenceStatus ?? obj.predictionEvidenceStatus,
    replayIdentity: obj.replayIdentity ?? simulation.replayIdentity,
    currentStep: num(simulation.currentTime),
    traffic: num(simulation.traffic),
    latencyAvailability: metrics.latencyAvailability ?? metrics.predictionEvidence?.latencyAvailability,
    latencyP50: latencyValue("latencyP50"),
    latencyP95: latencyValue("latencyP95"),
    latencyP99: latencyValue("latencyP99"),
    latencyP99Basis: str(metrics.latencyP99Basis),
    errorRate: num(metrics.errorRate),
    throughput: num(metrics.throughput),
    goodputRps: num(metrics.throughput),
    goodputSemantics: "post_step_point_rate",
    goodputProvenance: {
      kind: "derived",
      sourceFields: ["metrics.throughput"]
    },
    goodputWindow: goodputWindowFromPersistedMetrics(
      str(simulation.id) ?? "",
      [metrics]
    ),
    offeredRps: num(metrics.offeredRps),
    modeledShedRps: num(metrics.modeledShedRps),
    costPerHour: num(metrics.costPerHour),
    residualCostPerHour: num(metrics.residualCostPerHour),
    residualCostDefinition: str(metrics.residualCostDefinition),
    ...Array.isArray(metrics.requestServing) ? { requestServing: metrics.requestServing } : {},
    latencyBasis: str(metrics.latencyBasis),
    metricId: str(metrics.metricId),
    resources: toCompactResources(rawResources, rawEvents),
    events: rawEvents.map(toMcpEvent),
    // EKS Spot migration evidence is deliberately kept beside compact
    // resource status. Agents must be able to distinguish a missed 120s
    // migration deadline from later service recovery without requesting full
    // simulation state.
    // A response currentTime identifies simulation state, not a persisted
    // metric row. Do not turn it into a fabricated history index.
    ...compactEksEvidence(metrics),
    ...metrics.sessionAffinity !== void 0 ? { sessionAffinity: metrics.sessionAffinity } : {},
    ...metrics.kubernetesCpuHpa !== void 0 ? { kubernetesCpuHpa: metrics.kubernetesCpuHpa } : {},
    ...metrics.cdnFlow !== void 0 ? { cdnFlow: metrics.cdnFlow } : {},
    ...Array.isArray(metrics.loadBalancers) ? {
      loadBalancers: metrics.loadBalancers.filter((lb) => lb !== null && typeof lb === "object").map((lb) => ({
        ...str(lb.resourceId) !== void 0 ? { resourceId: str(lb.resourceId) } : {},
        ...num(lb.routedRps) !== void 0 ? { routedRps: num(lb.routedRps) } : {}
      }))
    } : {},
    // GPU / inference metrics — present only when the simulation contains a
    // GPU kubernetes resource with inferenceMode: true.
    ...metrics.gpuUtilization !== void 0 ? { gpuUtilization: metrics.gpuUtilization } : {},
    ...metrics.tokensPerSecond !== void 0 ? { tokensPerSecond: metrics.tokensPerSecond } : {},
    ..."costPerMillionTokens" in metrics ? { costPerMillionTokens: metrics.costPerMillionTokens } : {},
    ...metrics.idleGpuCostPerHour !== void 0 ? { idleGpuCostPerHour: metrics.idleGpuCostPerHour } : {},
    ...metrics.idleGpuFraction !== void 0 ? { idleGpuFraction: metrics.idleGpuFraction } : {},
    ...isErrorBreakdown(metrics.errorBreakdown) ? { errorBreakdown: metrics.errorBreakdown } : {},
    ...Array.isArray(metrics.databases) ? {
      ...metrics.databases.some((db) => db !== null && typeof db === "object" && ("connectionDemandMode" in db || "declaredFleetConnectionBudget" in db)) ? {
        databaseConnectionDemand: metrics.databases.filter((db) => db !== null && typeof db === "object" && ("connectionDemandMode" in db || "declaredFleetConnectionBudget" in db)).map((db) => ({
          resourceId: db.resourceId,
          connectionDemandMode: db.connectionDemandMode,
          loadDerivedConnections: db.loadDerivedConnections,
          loadDerivedBasis: db.loadDerivedBasis,
          declaredConnections: db.declaredConnections,
          idlePoolFloor: db.idlePoolFloor,
          modeledConnections: db.modeledConnections,
          connectionPressure: db.connectionPressure,
          declaredFleetConnectionBudget: db.declaredFleetConnectionBudget,
          declaredFleetConnectionPressure: db.declaredFleetConnectionPressure,
          declaredFleetConnectionBudgetBasis: db.declaredFleetConnectionBudgetBasis,
          declaredFleetConnectionBudgetTiers: db.declaredFleetConnectionBudgetTiers,
          assumption: db.declaredFleetConnectionBudget !== void 0 ? "ASSUMPTION / maximum declared fleet \xD7 app pool size; not observed live DB connections" : "ASSUMPTION / plan-time budget; not observed live connections"
        }))
      } : {},
      auroraFailovers: metrics.databases.filter((db) => db !== null && typeof db === "object" && db.auroraFailover !== void 0).map((db) => db.auroraFailover)
    } : {},
    // Resilience telemetry — present only when simulation.resilienceConfig.enabled is true.
    // retryAmplificationFactor: null means the resilience model ran but produced no traffic (zero RPS).
    // Absent (not in response at all) means the resilience model is disabled.
    ..."retryAmplificationFactor" in metrics ? { retryAmplificationFactor: metrics.retryAmplificationFactor } : {},
    // Bounded resilience diagnostics — incidentOutcome + path count only (paths array omitted for compactness).
    ...metrics.resilience !== null && typeof metrics.resilience === "object" ? {
      resilienceDiagnostics: {
        incidentOutcome: metrics.resilience.incidentOutcome,
        pathCount: Array.isArray(metrics.resilience.paths) ? metrics.resilience.paths.length : 0,
        bounded: metrics.resilience.bounded,
        capacityByResource: metrics.resilience.capacityByResource
      }
    } : {},
    ...compactExternalMetrics(metrics)
  };
  for (const key of Object.keys(compact)) {
    if (compact[key] === void 0) delete compact[key];
  }
  return compact;
}
function toCompactResources(rawResources, rawEvents = []) {
  const num = (v) => typeof v === "number" ? v : void 0;
  const str = (v) => typeof v === "string" ? v : void 0;
  return rawResources.filter((r) => r !== null && typeof r === "object").map((r) => {
    const lifecycle = compactFailureTelemetry(r, rawEvents);
    const compact = {
      id: str(r.id),
      name: str(r.name),
      ...r.location !== void 0 ? { location: r.location } : {},
      ...r.characteristics !== null && typeof r.characteristics === "object" && typeof r.characteristics.replicaOf === "string" ? { replicaOf: r.characteristics.replicaOf } : {},
      ...r.characteristics !== null && typeof r.characteristics === "object" && typeof r.characteristics.auroraReaderScalingMode === "string" ? { auroraReaderScalingMode: r.characteristics.auroraReaderScalingMode } : {},
      status: str(r.status),
      cpuPercent: num(r.cpuUsage),
      ...r.routedRps !== void 0 ? { routedRps: num(r.routedRps) } : {},
      ...r.availabilityState !== void 0 ? { availabilityState: str(r.availabilityState) } : {},
      ...typeof r.isRoutable === "boolean" ? { isRoutable: r.isRoutable } : {},
      ...r.recoveryBlockedReason !== void 0 ? { recoveryBlockedReason: str(r.recoveryBlockedReason) } : {},
      ...r.recoveryProgress !== void 0 ? { recoveryProgress: r.recoveryProgress } : {},
      ...lifecycle.failureLifecycle !== void 0 ? { failureLifecycle: lifecycle.failureLifecycle } : {},
      ...lifecycle.routingState !== void 0 ? { routingState: lifecycle.routingState } : {}
    };
    for (const key of Object.keys(compact)) {
      if (compact[key] === void 0) delete compact[key];
    }
    return compact;
  });
}
var COMPACT_FAILURE_LIFECYCLES = /* @__PURE__ */ new Set([
  "quick_injection_parked",
  "quick_injection_rejoined",
  "instance_down",
  "instance_kill"
]);
var COMPACT_ROUTING_STATES = /* @__PURE__ */ new Set(["unavailable", "serving"]);
function compactFailureTelemetry(resource, rawEvents) {
  const acceptedLifecycle = (value) => typeof value === "string" && COMPACT_FAILURE_LIFECYCLES.has(value) ? value : void 0;
  const acceptedRouting = (value) => typeof value === "string" && COMPACT_ROUTING_STATES.has(value) ? value : void 0;
  let failureLifecycle = acceptedLifecycle(resource.failureLifecycle);
  let routingState = acceptedRouting(resource.routingState);
  if (failureLifecycle === void 0 && typeof resource.failureParkStepsRemaining === "number" && resource.failureParkStepsRemaining > 0) {
    failureLifecycle = "quick_injection_parked";
    routingState ??= "unavailable";
  }
  const resourceId = typeof resource.id === "string" ? resource.id : void 0;
  const resourceName = typeof resource.name === "string" ? resource.name : void 0;
  for (let i = rawEvents.length - 1; i >= 0 && (failureLifecycle === void 0 || routingState === void 0); i--) {
    const event = rawEvents[i];
    if (event === null || typeof event !== "object") continue;
    const eventRecord = event;
    const metadata = eventRecord.metadata;
    if (metadata === null || typeof metadata !== "object") continue;
    const metadataRecord = metadata;
    const eventResource = eventRecord.resource;
    const metadataResourceId = metadataRecord.resourceId;
    if ((resourceId === void 0 || metadataResourceId !== resourceId) && (resourceName === void 0 || eventResource !== resourceName)) {
      continue;
    }
    failureLifecycle ??= acceptedLifecycle(metadataRecord.failureLifecycle);
    routingState ??= acceptedRouting(metadataRecord.routingState);
  }
  return { failureLifecycle, routingState };
}
function isErrorBreakdown(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const breakdown = value;
  const required = [
    "poolSaturation",
    "dbFailure",
    "computeFailure",
    "capacityOverload",
    "cpuOverload",
    "ociStorage",
    "queueAbsorption"
  ];
  return required.every((key) => typeof breakdown[key] === "number") && (breakdown.databasePressure === void 0 || typeof breakdown.databasePressure === "number") && (breakdown.benchmarkReferenceFit === void 0 || typeof breakdown.benchmarkReferenceFit === "number") && (breakdown.runtimeMemory === void 0 || typeof breakdown.runtimeMemory === "number") && (breakdown.dependencyFailure === void 0 || typeof breakdown.dependencyFailure === "number") && (breakdown.poolSaturationDetails === void 0 || Array.isArray(breakdown.poolSaturationDetails));
}
function simStatus(sim) {
  if (typeof sim.status === "string") return sim.status;
  if (typeof sim.isRunning === "boolean") return sim.isRunning ? "running" : "stopped";
  return void 0;
}
function toCompactCreateResponse(raw) {
  const sim = raw !== null && typeof raw === "object" ? raw : {};
  const num = (v) => typeof v === "number" ? v : void 0;
  const str = (v) => typeof v === "string" ? v : void 0;
  const compact = {
    id: str(sim.id),
    name: str(sim.name),
    engineVersion: str(sim.engineVersion),
    predictionEffectiveConfigHash: str(sim.predictionEffectiveConfigHash),
    calibrationEvidence: sim.calibrationEvidence,
    predictionEvidence: sim.predictionEvidence,
    appWeight: sim.appWeight,
    appWeightDefaulted: sim.appWeightDefaulted,
    predictionEvidenceStatus: sim.predictionEvidenceStatus,
    status: simStatus(sim),
    traffic: num(sim.traffic),
    ...typeof sim.scenarioHash === "string" ? { scenarioHash: sim.scenarioHash } : {},
    ...typeof sim.effectiveConfigHash === "string" ? { effectiveConfigHash: sim.effectiveConfigHash } : {},
    ...sim.scenarioAttribution !== void 0 ? { scenarioAttribution: sim.scenarioAttribution } : {},
    ...sim.replayIdentity !== void 0 ? { replayIdentity: sim.replayIdentity } : {},
    resources: toCompactResources(Array.isArray(sim.resources) ? sim.resources : []),
    effectiveMaxInstances: num(sim.effectiveMaxInstances),
    effectiveMinInstances: num(sim.effectiveMinInstances),
    ...sim.autoscalingConfig !== void 0 ? { autoscalingConfig: sim.autoscalingConfig } : {},
    ...sim.resilienceConfig !== void 0 ? { resilienceConfig: sim.resilienceConfig } : {},
    // Always pass normalizedConfig through when present — agents use it to
    // verify the resolved GPU SKU, billing floor, autoscale thresholds, and
    // cost multipliers immediately after create without an extra round-trip.
    ...sim.normalizedConfig !== void 0 ? { normalizedConfig: sim.normalizedConfig } : {},
    ...sim.hpaAudit !== void 0 ? { hpaAudit: sim.hpaAudit } : {}
  };
  for (const key of Object.keys(compact)) {
    if (compact[key] === void 0) delete compact[key];
  }
  return compact;
}
function toCompactListItems(items) {
  const str = (v) => typeof v === "string" ? v : void 0;
  return items.filter((s) => s !== null && typeof s === "object").map((s) => {
    const compact = {
      id: str(s.id),
      name: str(s.name),
      status: simStatus(s),
      resourceCount: Array.isArray(s.resources) ? s.resources.length : 0
    };
    for (const key of Object.keys(compact)) {
      if (compact[key] === void 0) delete compact[key];
    }
    return compact;
  });
}
var METRICS_HISTORY_TAIL = 10;
function toCompactMetricsResponse(simulationRaw, metrics, lastCostPerHour) {
  const simulation = simulationRaw !== null && typeof simulationRaw === "object" ? simulationRaw : {};
  const num = (v) => typeof v === "number" ? v : void 0;
  const str = (v) => typeof v === "string" ? v : void 0;
  const latest = metrics.length > 0 && metrics[metrics.length - 1] !== null && typeof metrics[metrics.length - 1] === "object" ? metrics[metrics.length - 1] : {};
  const latencyUnavailable = (value) => {
    const evidence = value.predictionEvidence;
    const availability = evidence !== null && typeof evidence === "object" ? evidence.latencyAvailability : void 0;
    return availability !== null && typeof availability === "object" && availability.status === "unavailable";
  };
  const latencyValue = (field) => latencyUnavailable(latest) ? null : num(latest[field]);
  const compactHistory = metrics.slice(-METRICS_HISTORY_TAIL).map((entry) => {
    if (entry === null || typeof entry !== "object") return entry;
    const row = entry;
    const contracted = addMcpGoodputContract(row);
    return latencyUnavailable(row) ? {
      ...contracted,
      latencyP50: null,
      latencyP95: null,
      latencyP99: null,
      latencyAvailability: row.predictionEvidence.latencyAvailability
    } : contracted;
  });
  const compact = {
    simulationId: str(simulation.id),
    scenarioHash: str(simulation.scenarioHash),
    effectiveConfigHash: str(simulation.effectiveConfigHash),
    replayIdentity: simulation.replayIdentity,
    engineVersion: str(simulation.engineVersion),
    predictionEffectiveConfigHash: str(
      latest.predictionEffectiveConfigHash ?? simulation.predictionEffectiveConfigHash
    ),
    calibrationEvidence: latest.calibrationEvidence ?? simulation.calibrationEvidence,
    predictionEvidence: latest.predictionEvidence,
    predictionEvidenceStatus: latest.predictionEvidenceStatus,
    latencyAvailability: latest.latencyAvailability ?? latest.predictionEvidence?.latencyAvailability,
    appWeight: simulation.appWeight,
    appWeightDefaulted: simulation.appWeightDefaulted,
    currentStep: num(simulation.currentTime),
    traffic: num(simulation.traffic),
    latencyP50: latencyValue("latencyP50"),
    latencyP95: latencyValue("latencyP95"),
    latencyP99: latencyValue("latencyP99"),
    latencyP99Basis: str(latest.latencyP99Basis),
    latencyBasis: str(latest.latencyBasis),
    errorRate: num(latest.errorRate),
    throughput: num(latest.throughput),
    goodputRps: num(latest.throughput),
    goodputSemantics: "post_step_point_rate",
    goodputProvenance: {
      kind: "derived",
      sourceFields: ["metrics.throughput"]
    },
    goodputWindow: goodputWindowFromPersistedMetrics(
      str(simulation.id) ?? "",
      metrics
    ),
    offeredRps: num(latest.offeredRps),
    modeledShedRps: num(latest.modeledShedRps),
    costPerHour: num(latest.costPerHour) ?? lastCostPerHour,
    residualCostPerHour: num(latest.residualCostPerHour),
    residualCostDefinition: str(latest.residualCostDefinition),
    metricId: str(latest.metricId),
    ...latest.kubernetesCpuHpa !== void 0 ? { kubernetesCpuHpa: latest.kubernetesCpuHpa } : {},
    resources: toCompactResources(Array.isArray(simulation.resources) ? simulation.resources : []),
    metricsHistoryLength: metrics.length,
    metrics: compactHistory,
    ...compactEksEvidence(latest),
    eksSpotEvidenceHistory: metrics.map((entry) => entry !== null && typeof entry === "object" ? { entry } : void 0).filter((value) => value !== void 0 && (value.entry.eksSpotMigration !== void 0 || value.entry.eksSpotMigrations !== void 0 || value.entry.eksSpotInterruptions !== void 0)).map(({ entry }) => ({
      metricId: typeof entry.metricId === "string" ? entry.metricId : void 0,
      engineInputStepIndex: typeof entry.timestamp === "number" ? entry.timestamp : void 0,
      ...compactEksEvidence(entry)
    })),
    ...isErrorBreakdown(latest.errorBreakdown) ? { errorBreakdown: latest.errorBreakdown } : {},
    ...latest.sessionAffinity !== void 0 ? { sessionAffinity: latest.sessionAffinity } : {},
    ...latest.cdnFlow !== void 0 ? { cdnFlow: latest.cdnFlow } : {},
    ...Array.isArray(latest.databases) ? {
      ...latest.databases.some((db) => db !== null && typeof db === "object" && ("connectionDemandMode" in db || "declaredFleetConnectionBudget" in db)) ? {
        databaseConnectionDemand: latest.databases.filter((db) => db !== null && typeof db === "object" && ("connectionDemandMode" in db || "declaredFleetConnectionBudget" in db)).map((db) => ({
          resourceId: db.resourceId,
          connectionDemandMode: db.connectionDemandMode,
          loadDerivedConnections: db.loadDerivedConnections,
          loadDerivedBasis: db.loadDerivedBasis,
          declaredConnections: db.declaredConnections,
          idlePoolFloor: db.idlePoolFloor,
          modeledConnections: db.modeledConnections,
          connectionPressure: db.connectionPressure,
          declaredFleetConnectionBudget: db.declaredFleetConnectionBudget,
          declaredFleetConnectionPressure: db.declaredFleetConnectionPressure,
          declaredFleetConnectionBudgetBasis: db.declaredFleetConnectionBudgetBasis,
          declaredFleetConnectionBudgetTiers: db.declaredFleetConnectionBudgetTiers,
          assumption: db.declaredFleetConnectionBudget !== void 0 ? "ASSUMPTION / maximum declared fleet \xD7 app pool size; not observed live DB connections" : "ASSUMPTION / plan-time budget; not observed live connections"
        }))
      } : {},
      auroraFailovers: latest.databases.filter((db) => db !== null && typeof db === "object" && db.auroraFailover !== void 0).map((db) => db.auroraFailover)
    } : {},
    // GPU / inference metrics — present only when the simulation contains a
    // GPU kubernetes resource with inferenceMode: true.
    ...latest.gpuUtilization !== void 0 ? { gpuUtilization: latest.gpuUtilization } : {},
    ...latest.tokensPerSecond !== void 0 ? { tokensPerSecond: latest.tokensPerSecond } : {},
    ..."costPerMillionTokens" in latest ? { costPerMillionTokens: latest.costPerMillionTokens } : {},
    ...latest.idleGpuCostPerHour !== void 0 ? { idleGpuCostPerHour: latest.idleGpuCostPerHour } : {},
    ...latest.idleGpuFraction !== void 0 ? { idleGpuFraction: latest.idleGpuFraction } : {},
    // Resilience telemetry from the latest step — present only when the resilience model ran.
    ..."retryAmplificationFactor" in latest ? { retryAmplificationFactor: latest.retryAmplificationFactor } : {},
    ...latest.resilience !== null && typeof latest.resilience === "object" ? {
      resilienceDiagnostics: {
        incidentOutcome: latest.resilience.incidentOutcome,
        pathCount: Array.isArray(latest.resilience.paths) ? latest.resilience.paths.length : 0,
        bounded: latest.resilience.bounded,
        capacityByResource: latest.resilience.capacityByResource
      }
    } : {},
    ...compactExternalMetrics(latest)
  };
  for (const key of Object.keys(compact)) {
    if (compact[key] === void 0) delete compact[key];
  }
  return compact;
}
function compactExternalMetrics(metrics) {
  const resilience = metrics.resilience;
  if (resilience === null || typeof resilience !== "object" || resilience.externalMetrics === void 0) {
    return {};
  }
  return { externalMetrics: resilience.externalMetrics };
}
function compactEksEvidence(metrics) {
  const evidence = {};
  for (const key of [
    "eksSpotMigration",
    "eksSpotMigrations",
    "eksSpotMigrationEvents",
    "eksSpotInterruptions"
  ]) {
    if (metrics[key] !== void 0) evidence[key] = metrics[key];
  }
  return evidence;
}
function toMcpEvent(raw) {
  if (raw === null || typeof raw !== "object") return raw;
  const event = raw;
  return {
    ...event,
    type: typeof event.type === "string" && event.type.trim() ? event.type : (() => {
      const metadata = event.metadata;
      const kind = metadata !== null && typeof metadata === "object" ? metadata.kind : void 0;
      return typeof kind === "string" && kind.trim() ? kind : "simulation_event";
    })()
  };
}
function addMcpGoodputContract(metric) {
  if (typeof metric.throughput !== "number" || !Number.isFinite(metric.throughput)) return metric;
  return {
    ...metric,
    goodputRps: metric.throughput,
    goodputSemantics: "post_step_point_rate",
    goodputProvenance: {
      kind: "derived",
      sourceFields: ["metrics.throughput"]
    }
  };
}
function structuredResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value
  };
}
function currentStepFromResponse(value) {
  const response = value !== null && typeof value === "object" ? value : {};
  if (typeof response.currentStep === "number") return response.currentStep;
  if (typeof response.currentTime === "number") return response.currentTime;
  const simulation = response.simulation !== null && typeof response.simulation === "object" ? response.simulation : {};
  return typeof simulation.currentTime === "number" ? simulation.currentTime : void 0;
}
async function stepResponseResult(value, readCurrentState) {
  const parsed = stepOutputSchema.safeParse(value);
  if (parsed.success) return structuredResult(value);
  let currentStep = currentStepFromResponse(value);
  if (currentStep === void 0 && readCurrentState) {
    try {
      currentStep = currentStepFromResponse(await readCurrentState());
    } catch {
    }
  }
  const issue = parsed.error.issues[0];
  const issuePath = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  const detail = issue ? `${issuePath}${issue.message}` : "unknown output-schema mismatch";
  return errorResult(
    `Simulation step was applied, but the MCP response failed validation. currentStep=${currentStep === void 0 ? "unknown" : currentStep}. Do not retry this step; inspect simulation.metrics before proceeding. Response validation error: ${detail}`
  );
}
function arrayResult(items, objectKey) {
  return {
    content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
    structuredContent: { [objectKey]: items }
  };
}
var providerApiLimitMcpInputSchema = {
  simulationId: z8.string().min(1).describe("Owned simulation ID used for access control and result context; the workload is not persisted"),
  ...providerApiLimitSimulationRequestSchema.innerType().shape
};
var providerApiLimitMcpOutputSchema = z8.object({
  simulation: z8.object({
    id: z8.string(),
    name: z8.string(),
    currentTime: z8.number()
  }).strict().describe("Owned simulation context; provider-limit work does not advance this state"),
  modeled: z8.object({
    namespace: z8.literal("simulated-provider-api-quota"),
    platformRateLimitNamespace: z8.literal("cwm-api-rate-limit"),
    providerThrottlingIsModeled: z8.literal(true),
    platformHttpRateLimitsAreNotModeled: z8.literal(true)
  }).strict().describe("Explicit boundary between modeled provider throttling and CWM HTTP rate limiting"),
  request: z8.record(z8.unknown()).describe("Normalized bounded provider-limit request, including any caller-supplied overrides"),
  result: z8.record(z8.unknown()).describe("Deterministic scheduler result with policy resolutions, accounting, queue, timing, and outcomes"),
  provenance: z8.object({
    catalogVersion: z8.number().int().positive(),
    policies: z8.array(z8.record(z8.unknown()))
  }).strict().describe("Catalog or caller-override source metadata, including source references and as-of dates")
}).strict();
var SCENARIO_CARD_DESCRIPTION_MAX_LENGTH = 500;
var SCENARIO_CARD_DESCRIPTION_TRUNCATION_MARKER = "\u2026";
function compactScenarioDescription(value) {
  const description = typeof value === "string" ? value : "";
  if (description.length <= SCENARIO_CARD_DESCRIPTION_MAX_LENGTH) return description;
  const contentLength = SCENARIO_CARD_DESCRIPTION_MAX_LENGTH - SCENARIO_CARD_DESCRIPTION_TRUNCATION_MARKER.length;
  return `${description.slice(0, contentLength).trimEnd()}${SCENARIO_CARD_DESCRIPTION_TRUNCATION_MARKER}`;
}
function scenarioPatternEnd(pattern) {
  return pattern.endTime ?? (pattern.parameters.duration !== void 0 ? pattern.startTime + pattern.parameters.duration : void 0);
}
function toScenarioTrafficPhaseSummary(pattern) {
  const { startTraffic, endTraffic, peakTraffic } = pattern.parameters;
  const endStep = scenarioPatternEnd(pattern);
  return {
    name: pattern.name,
    type: pattern.type,
    startStep: pattern.startTime,
    ...endStep !== void 0 ? { endStep } : {},
    isActive: pattern.isActive !== false,
    traffic: {
      ...startTraffic !== void 0 ? { startRps: startTraffic } : {},
      ...endTraffic !== void 0 ? { endRps: endTraffic } : {},
      ...peakTraffic !== void 0 ? { peakRps: peakTraffic } : {}
    }
  };
}
function scenarioRetryTrafficDisclosure(scenario, activePhases) {
  const resilienceConfig = scenario.resilienceConfig;
  if (resilienceConfig === null || typeof resilienceConfig !== "object") return void 0;
  const config = resilienceConfig;
  if (config.enabled !== true || !Array.isArray(config.dependencies)) return void 0;
  const retryDependencies = config.dependencies.filter((dependency) => {
    if (dependency === null || typeof dependency !== "object") return false;
    const retryPolicy = dependency.retryPolicy;
    if (retryPolicy === null || typeof retryPolicy !== "object") return false;
    const policy = retryPolicy;
    return typeof policy.maxRetries === "number" && policy.maxRetries > 0 && typeof policy.retryBudgetRatio === "number" && policy.retryBudgetRatio > 0;
  });
  if (retryDependencies.length === 0) return void 0;
  const maxConfiguredRetries = Math.max(...retryDependencies.map((dependency) => {
    const policy = dependency.retryPolicy;
    return policy.maxRetries;
  }));
  const firstPhase = activePhases[0];
  const startRps = firstPhase?.traffic.startRps;
  const externalTraffic = startRps !== void 0 ? `External traffic follows the listed phases, starting at ${startRps.toLocaleString()} RPS.` : "External traffic follows the listed phases.";
  return {
    enabled: true,
    dependencyCount: retryDependencies.length,
    maxConfiguredRetries,
    externalTraffic,
    internalRetryAttempts: "Configured dependency retries can increase internal request volume after failures; retry attempts are internal, not additional external traffic."
  };
}
function scenarioTrafficDisclosure(raw) {
  const patterns = Array.isArray(raw.defaultTrafficPatterns) ? raw.defaultTrafficPatterns.filter(
    (pattern) => pattern !== null && typeof pattern === "object"
  ) : [];
  const phases = patterns.map(toScenarioTrafficPhaseSummary);
  const activeTrafficPhases = phases.filter((phase) => phase.isActive);
  const optionalTrafficPhases = phases.filter((phase) => !phase.isActive);
  return {
    activeTrafficPhases,
    optionalTrafficPhases,
    retryTrafficDisclosure: scenarioRetryTrafficDisclosure(raw, activeTrafficPhases)
  };
}
function scenarioFailureDisclosure(raw) {
  const presets = Array.isArray(raw.defaultFailureInjections) ? raw.defaultFailureInjections : [];
  const phases = presets.map((rawPreset) => {
    const preset = scenarioDefaultFailureInjectionSchema.parse(rawPreset);
    const endStep = preset.endTime ?? (preset.duration !== void 0 ? preset.startTime + preset.duration : void 0);
    return {
      name: preset.name,
      type: preset.type,
      ...preset.targetResourceId !== void 0 ? { targetResourceId: preset.targetResourceId } : {},
      ...preset.targetZone !== void 0 ? { targetZone: preset.targetZone } : {},
      ...preset.targetRegion !== void 0 ? { targetRegion: preset.targetRegion } : {},
      ...preset.targetProvider !== void 0 ? { targetProvider: preset.targetProvider } : {},
      severity: preset.severity,
      isActive: preset.isActive,
      startStep: preset.startTime,
      ...endStep !== void 0 ? { endStep } : {}
    };
  });
  return {
    activeFailurePhases: phases.filter((phase) => phase.isActive),
    optionalFailurePhases: phases.filter((phase) => !phase.isActive)
  };
}
function toCompactScenarioCard(raw) {
  const scenario = raw !== null && typeof raw === "object" ? raw : {};
  const resources = Array.isArray(scenario.resources) ? scenario.resources : [];
  const connections = Array.isArray(scenario.connections) ? scenario.connections : [];
  const providers2 = Array.from(new Set(
    resources.filter((resource) => resource !== null && typeof resource === "object").map((resource) => resource.provider).filter((provider) => typeof provider === "string" && provider.length > 0)
  ));
  const title = typeof scenario.title === "string" ? scenario.title : typeof scenario.name === "string" ? scenario.name : String(scenario.id ?? "");
  const trafficDisclosure = scenarioTrafficDisclosure(scenario);
  return {
    id: String(scenario.id ?? ""),
    title,
    name: title,
    description: compactScenarioDescription(scenario.description),
    version: scenario.version ?? null,
    revision: scenario.revision ?? null,
    difficulty: scenario.difficulty,
    tags: Array.isArray(scenario.tags) ? scenario.tags : [],
    category: typeof scenario.category === "string" ? scenario.category : "",
    primaryPurpose: typeof scenario.primaryPurpose === "string" ? scenario.primaryPurpose : void 0,
    duration: typeof scenario.duration === "string" ? scenario.duration : "",
    provider: providers2[0],
    providers: providers2,
    providerSummary: providers2.length > 0 ? providers2.join(", ") : "unknown",
    resourceCount: resources.length,
    connectionCount: connections.length,
    ...trafficDisclosure,
    ...scenarioFailureDisclosure(scenario)
  };
}
function hydrateScenario(raw) {
  const scenario = raw !== null && typeof raw === "object" ? raw : {};
  const title = typeof scenario.title === "string" ? scenario.title : typeof scenario.name === "string" ? scenario.name : String(scenario.id ?? "");
  return {
    ...scenario,
    title,
    name: title,
    version: scenario.version ?? null,
    revision: scenario.revision ?? null,
    ...scenarioTrafficDisclosure(scenario),
    ...scenarioFailureDisclosure(scenario)
  };
}
var scenarioCardSchema = z8.object({
  activeFailurePhases: z8.array(scenarioFailurePhaseSummarySchema).optional().describe("Scheduled active failures: name, type, target resource/zone, severity and step range; no parameters"),
  optionalFailurePhases: z8.array(scenarioFailurePhaseSummarySchema).optional().describe("Disabled optional failure presets; not scheduled unless enabled"),
  id: z8.string().optional().describe("Stable scenario identifier \u2014 pass to scenario.get"),
  title: z8.string().optional().describe("Scenario title"),
  name: z8.string().optional().describe("Scenario display name; equivalent to title"),
  description: z8.string().optional().describe("What this scenario demonstrates; capped at 500 characters with an ellipsis when truncated"),
  difficulty: z8.string().optional().describe("Scenario difficulty"),
  tags: z8.array(z8.string()).optional().describe("Discovery tags"),
  category: z8.string().optional().describe("Scenario category"),
  version: z8.string().nullable().optional().describe("Catalog version; null when unavailable"),
  revision: z8.string().nullable().optional().describe("Catalog revision; null when unavailable"),
  primaryPurpose: z8.enum(["educational", "chaos", "predictive", "optimization"]).optional().describe("Primary purpose: educational guided scenario, chaos injected failure, predictive capacity simulation, or optimization configuration comparison"),
  duration: z8.string().optional().describe("Expected scenario duration"),
  provider: z8.string().optional().describe("Primary cloud provider"),
  providers: z8.array(z8.string()).optional().describe("Cloud providers represented in the scenario"),
  providerSummary: z8.string().optional().describe("Compact provider summary"),
  resourceCount: z8.number().optional().describe("Number of resources in the scenario graph"),
  connectionCount: z8.number().optional().describe("Number of connections in the scenario graph"),
  activeTrafficPhases: z8.array(scenarioTrafficPhaseSummarySchema).optional().describe("Named active catalog traffic phases with type, step range, and workload shape"),
  optionalTrafficPhases: z8.array(scenarioTrafficPhaseSummarySchema).optional().describe("Named optional catalog traffic phases; these are inactive until enabled in the workspace"),
  retryTrafficDisclosure: scenarioRetryTrafficDisclosureSchema.optional().describe("When present, separates external catalog traffic from modeled internal retry attempts")
}).passthrough();
var scenarioListInputSchema = {
  provider: z8.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Only scenarios that include resources from this cloud provider"),
  category: z8.string().trim().min(1).optional().describe("Only scenarios in this category, such as scaling, failure, reliability, networking, or cost"),
  difficulty: z8.enum(["beginner", "intermediate", "advanced"]).optional().describe("Only scenarios at this difficulty level")
};
function scenarioListPath(filters) {
  const params = new URLSearchParams();
  if (filters.provider !== void 0) params.set("provider", filters.provider);
  if (filters.category !== void 0) params.set("category", filters.category);
  if (filters.difficulty !== void 0) params.set("difficulty", filters.difficulty);
  const query = params.toString();
  return query ? `/api/scenarios?${query}` : "/api/scenarios";
}
var scenarioGetOutputSchema = z8.object({
  status: z8.string().optional().describe("Result status; not_found when the requested scenario does not exist"),
  message: z8.string().optional().describe("Error or guidance message"),
  id: z8.string().optional().describe("Stable scenario identifier"),
  title: z8.string().optional().describe("Scenario title"),
  name: z8.string().optional().describe("Scenario display name; equivalent to title"),
  description: z8.string().optional(),
  difficulty: z8.string().optional(),
  resources: z8.array(z8.record(z8.unknown())).optional().describe("Full resource graph; pass to simulation.create"),
  connections: z8.array(z8.record(z8.unknown())).optional().describe("Full connection graph; pass to simulation.create"),
  duration: z8.string().optional(),
  tags: z8.array(z8.string()).optional(),
  category: z8.string().optional(),
  primaryPurpose: z8.enum(["educational", "chaos", "predictive", "optimization"]).optional().describe("Primary purpose of the scenario; absent means legacy purpose not specified"),
  seed: z8.number().int().min(0).optional(),
  resilienceConfig: z8.record(z8.unknown()).optional(),
  protectedResilienceConfig: z8.record(z8.unknown()).optional(),
  defaultTrafficPatterns: z8.array(z8.record(z8.unknown())).optional(),
  defaultFailureInjections: z8.array(z8.record(z8.unknown())).optional(),
  activeFailurePhases: z8.array(scenarioFailurePhaseSummarySchema).optional(),
  optionalFailurePhases: z8.array(scenarioFailurePhaseSummarySchema).optional(),
  activeTrafficPhases: z8.array(scenarioTrafficPhaseSummarySchema).optional(),
  optionalTrafficPhases: z8.array(scenarioTrafficPhaseSummarySchema).optional(),
  retryTrafficDisclosure: scenarioRetryTrafficDisclosureSchema.optional(),
  realWorldIncident: z8.record(z8.unknown()).optional()
}).passthrough();
var SCENARIO_CREATE_GUIDANCE = 'Built-in scenario workflow: call `scenario.list` and pass a returned card\'s `id` as `scenarioId` to `simulation.create` for server-side graph expansion. For full control, call `scenario.get` and pass its hydrated `resources` and `connections` arrays instead. These are two alternatives \u2014 do not send `scenarioId` with `resources` or `connections`. For the catalog EKS Spot Interruption Migration scenario, you may set `scenarioOverrides: { eksSpotInterruption: { startupSeconds } }` with an integer startupSeconds from 0 through 3600 to test a different readiness deadline without copying the graph; this override requires scenarioId and is mutually exclusive with resources and connections. For the Web App Autoscaling scenario, create with `scenarioId: "web-autoscaling"` and `scenarioOverrides: { webAutoscaling: { includeTrafficRecovery: true } }` to activate the optional Traffic Recovery ramp and observe scale-in. `includeTrafficRecovery` is optional and defaults to false, leaving the phase inactive. Opt in before the first simulation.step because replay identity is finalized when stepping starts. This override also requires scenarioId and is mutually exclusive with resources and connections. `scenario.list` returns graph-free cards with bounded active/optional traffic-phase and retry-workload summaries; it is not a source of resource, connection, traffic-pattern, or failure-injection graphs. Scenario traffic and failure presets are not applied automatically. ';
var SCENARIO_RESOURCES_INPUT_DESCRIPTION = "List of cloud resources composing this simulation. For a built-in scenario, pass the hydrated resources from scenario.get; scenario.list cards are graph-free.";
var SCENARIO_CONNECTIONS_INPUT_DESCRIPTION = "Directed connections between resources. For a built-in scenario, pass the hydrated connections from scenario.get; scenario.list cards are graph-free.";
function unwrapMetricsResponse(raw) {
  if (Array.isArray(raw)) return { metrics: raw };
  if (raw && typeof raw === "object") {
    const obj = raw;
    const metrics = Array.isArray(obj.metrics) ? obj.metrics : [];
    return typeof obj.lastCostPerHour === "number" ? { metrics, lastCostPerHour: obj.lastCostPerHour } : { metrics };
  }
  return { metrics: [] };
}
function apiSpecPayload(ctx) {
  return {
    openapi_spec_url: `${ctx.specBaseUrl ?? ctx.baseUrl}/api-docs/openapi.json`,
    openapi_spec_format: "openapi3_json",
    description: "Fetch openapi_spec_url to retrieve the full OpenAPI 3.0 specification in JSON format. It documents every REST endpoint, request schema, response schema, and authentication requirement for this Cloud World Model instance."
  };
}
var mcpResilienceConfigSchema = z8.object({
  enabled: z8.boolean().optional().describe("Master switch for retry/cascade modeling"),
  version: z8.literal(1).optional().describe("Resilience model version"),
  dependencies: z8.array(z8.object({
    id: z8.string().min(1).max(128).describe("Unique dependency edge ID"),
    sourceId: z8.string().min(1).describe("Upstream resource ID"),
    targetId: z8.string().min(1).describe("Downstream resource ID"),
    requestRatio: z8.number().min(0).max(20).optional().describe("Requests to target per original request"),
    authRequestsPerAttempt: z8.number().min(0).max(10).optional().describe("Auth/token requests generated per dependency attempt"),
    authDependencyId: z8.string().min(1).max(128).optional().describe("Dependency receiving generated auth/token traffic"),
    retryPolicy: z8.object({
      maxRetries: z8.number().int().min(0).max(8).optional().describe("Maximum retries for this dependency edge (0 disables retries; default 2)."),
      backoffMs: z8.number().int().min(0).max(6e4).optional().describe("Initial retry backoff in milliseconds (default 100)."),
      backoffMultiplier: z8.number().min(1).max(10).optional().describe("Exponential backoff multiplier (default 2)."),
      jitterRatio: z8.number().min(0).max(1).optional().describe("Fractional backoff jitter from 0 to 1 (default 0.1)."),
      timeoutMs: z8.number().int().min(1).max(12e4).optional().describe("Per-attempt client deadline in milliseconds (default 2000); includes queue wait, service, and latency."),
      retryBudgetRatio: z8.number().min(0).max(10).optional().describe("Retry RPS budget as a multiple of original edge RPS (default 2)."),
      retryBudgetRps: z8.number().min(0).max(5e5).optional().describe("Optional absolute retry RPS cap, also bounded by retryBudgetRatio."),
      retryActorId: z8.string().min(1).max(128).optional().describe("Actor producing retries, such as a gateway or client")
    }).optional(),
    protection: z8.object({
      circuitBreaker: z8.object({
        enabled: z8.boolean().optional(),
        failureRateThreshold: z8.number().min(0).max(1).optional(),
        minimumRequests: z8.number().int().min(1).max(1e5).optional(),
        openSteps: z8.number().int().min(1).max(120).optional(),
        halfOpenMaxRequests: z8.number().int().min(1).max(1e4).optional()
      }).optional(),
      rateLimitRps: z8.number().positive().max(5e5).optional(),
      loadShedding: z8.boolean().optional()
    }).optional(),
    capacity: z8.object({
      maxRps: z8.number().positive().max(5e5).optional(),
      maxConcurrent: z8.number().int().positive().max(1e6).optional(),
      meanServiceTimeMs: z8.number().positive().max(12e4).optional()
    }).optional()
  })).max(64).optional().describe("Dependency edges with retry and protection policies"),
  scheduledFaults: z8.array(z8.object({
    id: z8.string().min(1).max(128),
    type: z8.enum(["capacity_limit", "concurrency_limit", "latency", "error_rate", "traffic_surge"]).describe("Fault type; traffic_surge increases root client demand"),
    targetResourceId: z8.string().optional(),
    dependencyId: z8.string().optional(),
    startStep: z8.number().int().min(0),
    endStep: z8.number().int().min(1).optional(),
    capacityPercent: z8.number().min(0).max(100).optional(),
    maxConcurrent: z8.number().int().positive().max(1e6).optional(),
    addedLatencyMs: z8.number().min(0).max(12e4).optional(),
    errorRate: z8.number().min(0).max(1).optional(),
    trafficMultiplier: z8.number().gt(1).max(20).optional().describe("traffic_surge demand multiplier")
  })).max(32).optional().describe("Scheduled capacity, error, latency, concurrency, or traffic-surge faults"),
  scalingPolicies: z8.array(z8.object({
    id: z8.string().min(1).max(128),
    dependencyId: z8.string().min(1).max(128),
    constrainedMetric: z8.enum(["rps", "concurrency"]),
    observationMetric: z8.enum(["source_cpu", "capacity_utilization"]),
    observedResourceId: z8.string().min(1).optional(),
    scaleOutThresholdPercent: z8.number().min(1).max(100),
    scaleOutCapacityMultiplier: z8.number().min(1).max(20).optional()
  })).max(32).optional().describe("Capacity-observation policies, including intentional autoscaling blind spots"),
  maxCascadeDepth: z8.number().int().min(1).max(8).optional(),
  maxGeneratedRps: z8.number().positive().max(5e5).optional(),
  maxStepWork: z8.number().int().min(1).max(2048).optional(),
  retryGeneratedTrafficAffectsCost: z8.boolean().optional(),
  externalMetrics: externalMetricsConfigSchema.optional().describe(
    "Deterministic per-trigger recommendation inputs. A no_ready_endpoints sample is a successful zero only when that trigger sets noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. This is not a KEDA/provider actuator and does not change resource counts."
  )
});
function registerTools(server2, ctx) {
  server2.registerTool(
    "api.spec",
    {
      title: "Get API Spec",
      description: "Return the location and format of the Cloud World Model OpenAPI specification. openapi_spec_url: /api-docs/openapi.json \u2014 fetch this path relative to the server base URL to retrieve the full machine-readable spec. openapi_spec_format: openapi3_json \u2014 the spec is an OpenAPI 3.0 document in JSON format. Use it only when you need REST endpoint details outside this MCP session (e.g. generating an HTTP client). Do not call api.spec to learn the simulation workflow \u2014 the tool descriptions in this session contain everything needed: start with simulation.create or simulation.list. No prerequisites, no API key required; the result is static per server, so one call per session is enough. Returns no identifiers consumed by other tools.",
      inputSchema: {},
      outputSchema: z8.object({
        openapi_spec_url: z8.string().describe("Absolute URL to the OpenAPI JSON specification"),
        openapi_spec_format: z8.string().describe("Spec format identifier (e.g. openapi3_json)"),
        description: z8.string().describe("Short description of the spec and how to use it")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    () => structuredResult(apiSpecPayload(ctx))
  );
  server2.registerTool(
    "simulation.create",
    {
      title: "Create Simulation",
      description: "Create a new virtual cloud environment (simulation) with resources such as compute, database, storage, network, cache, queue, or kubernetes nodes. resilienceConfig.externalMetrics is a deterministic sampled recommendation model: no_ready_endpoints is successful zero only when its trigger sets noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. It is not a KEDA/provider actuator and does not change resource counts. Set retry behavior per dependency at resilienceConfig.dependencies[].retryPolicy, e.g. {id:'web-to-db',sourceId:'web-1',targetId:'db-1',retryPolicy:{timeoutMs:10000,maxRetries:0}}. Omitted values default to 2000 ms and 2 retries; simulation.update accepts the same resilienceConfig and returns its effective values. " + SCENARIO_CREATE_GUIDANCE + "P99 has distinct per-percentile provenance: latencyP99Basis identifies the owned in-VPC internal-ALB fit, a scaled-from-fit estimate (not directly measured), or an uncalibrated generic model. On the exact healthy lean owned graph at 10\u20131,000 offered target RPS, P99=max(final P95, 7.021919127633514 + 0.00027013891327780484*T) ms; only 10/100/500 RPS were fit, 1,000 RPS was held out. Lean M5 scaling is not a new measurement; typical/heavy and active failures retain uncalibrated P99. predictionEvidence.latencyP99 has measured 0.65\u20131.35\xD7, scaled 0.50\u20131.50\xD7 (beyond 1,000: 0.25\u20132\xD7), or uncalibrated 0.50\u20132\xD7 (beyond: 0.25\u20133\xD7) assumption bounds centered on final P99. These are not confidence intervals or provider measurements. Historical evidence may omit P99. latencyBasis describes the general modeled latency path; use latencyP99Basis specifically for P99. P99 is diagnostic, not scored. Use it as the entry point of every workflow \u2014 simulation stepping, RL training (rl.create), chaos experiments (chaos.run), and prediction validation (prediction.validate) all require a simulation id from this tool. Do not use it to modify an existing simulation (use simulation.inject_traffic / simulation.resize) or to re-create one you already own (use simulation.list to find it). For compute, set characteristics.capacityRps for an explicit per-node RPS ceiling at which CPU reaches ~95%; do not use maxThroughput for that compute contract. Kubernetes rejects capacityRps: set maxThroughput for the total cluster RPS ceiling, or nodePools[].maxThroughput for per-node pool capacity. Omitted compute capacityRps uses the selected catalog tier and can intentionally produce a stressed baseline (for example, the AWS m5.large catalog denominator is 2,000 RPS); for a healthy, capacity-bounded compute experiment, declare an explicit per-node capacity such as 500 RPS. That value is an experiment control, not a universal hardware fact. For ECS/Fargate, set characteristics.perTaskCapacityRps independently on each service/resource; the configured desired and maximum task counts are multiplied by that resource's own rate. If you omit it, CWM's size-based heuristic is labeled an assumption, not a provider-published or measured rate. An explicit rate without evidence is also an unverified assumption. To assert documented or measured capacity, include characteristics.perTaskCapacityEvidence with basis='documented' or basis='measured' and a supporting source; a numeric rate alone is never labeled measured. normalizedConfig.requestServing and predictionEvidence.requestServingCapacity report each tier's rate, task counts, aggregates, and basis. Owned AWS CRUD calibration eligibility is exact and intentionally narrow. The graph must contain exactly four healthy, routable AWS resources and exactly four edges: one internal ALB \u2192 each of two compute apps \u2192 one database, with no other nodes or edges. Each app must be m5.large; its absent serviceFamily is inferred as ec2 for eligibility only, explicit ec2 is accepted, and any other explicit family fails. The database must be db.r5.large; absent serviceFamily is inferred as rds for eligibility only, explicit rds is accepted, and any other explicit family fails. The database must declare MySQL workload identity using characteristics.workloadDatabaseEngine='mysql', or the literal characteristics.engine='mysql' alias on this exact database shape. The alias is accepted on that database shape even in an incomplete graph, but does not by itself make the graph fit-eligible. That engine alias is workload identity only: it does not declare an engine version, Extended Support, lifecycle, or billing option; those inputs remain rejected, and callers should prefer workloadDatabaseEngine. The sole network node must be identified by explicit serviceFamily='alb', or, only when serviceFamily is absent, by an unambiguous name containing 'ALB' or 'Application Load Balancer'; explicit network-service size/type discriminators must not indicate NLB or another service. A generic unnamed network node, explicit nlb, or contradictory discriminator is ambiguous and does not qualify. Each app may explicitly set characteristics.workload='crud', or omit it only for this fully matched canonical graph with the MySQL identity above; this is a canonical CRUD modeling assumption, not evidence of the caller's real application behavior, and is identified in calibrationEvidence.note. Explicit conflicting workload values fail. No workload inference applies to similar-but-not-exact graphs, other instance types, providers, or incomplete graphs. Each app must have autoscaling disabled and fixed minInstances=maxInstances=2. Traffic must be within the inclusive 10\u20131,000 RPS range. The fit also requires no active failure and no failure, warmup, or snapshot metadata; no explicit app capacity override (capacityRps, requestsPerSecond, or non-default maxThroughput); and no non-default app baseLatency. If set, database maxConnections must be 500 and effectiveMaxConnections must be absent; if set, ALB maxThroughput must be 50,000. The us-east-2 / seed 20240601 result is the parity fixture, not a claim that other regions have been measured. When the gate fails, calibrationEvidence.kind is modeled and calibrationEvidence.note identifies actual exclusions. Lean owned calibration requires explicit appWeight:'lean': aws-crud/v1:473f1339-f712-4096-96d6-3d4fc07cb427:7416cb63ace3a7ab2e3486bb6f132a2dcb574c34. Separately, the exact owned typical graph uses appWeight:'typical', resource.location.regionKey:'us-east-2' on ALL four nodes (normalized to use2), internal ALB characteristics.loadBalancerScheme:'internal', two m5.large apps each with workload:'crud-typical', appRuntime:'node', appWorkerCount:2, appDbPoolSize:250, and a db.r5.large MySQL with explicit maxConnections:500 and workloadDatabaseVersion:'8.0'. Set minInstances=maxInstances=2, autoscaling:false on apps, and traffic 20\u2013300 RPS. Its calibrationId names typical-v1-20260927c and measurement 6aa574d7ff9d3080b88b221bcd59f7d218ae37f0; ONLY typical-fit-20, typical-fit-100, typical-fit-200 were fitting rungs. 300 RPS is an independent holdout, 500 RPS diagnostic only. Neither fit establishes measurements for arbitrary typical workloads; cost is list price, not a measured bill. Generic typical CPU/latency anchors remain placeholder guidance. Known-vCPU shapes use the workload model, never a validated cross-provider conversion. Lean proportional M5 scaling is 'scaled from measured'; its latency at offered application RPS T is P50=max(1.45, 2.4833-0.0010466*T) ms and P95=max(P50, 3.10, 4.3697-0.0012973*T) ms (full-precision fit); penalties follow the baseline, with no generic 5 ms floor (only a 0.05 ms physical safety floor). Other providers and generic typical/heavy are 'reference estimate'. predictionEvidence version 1 reports app CPU (not aggregate CPU), per-resource CPU and P50/P95 low/central/high, sourceIds/formulaIds, and loadScope. Intervals are assumptions, not confidence intervals; beyond 1000 offered RPS they widen and cannot be measured. Unknown-vCPU fallback retains unverified generic numbers with no external reference. No other hardware has been validated. For generic fixed compute, characteristics.instanceCount accepts integer 1\u2013100 represented VMs; capacity is aggregated and CPU is per VM. Do not combine it with autoscaling:true, minInstances, or maxInstances. Aurora Serverless v2 remains limited to 1 with multiAz:false or 2 with multiAz:true. For Aurora Serverless ACU limits, use characteristics.config.minCapacity/maxCapacity or flat characteristics.minCapacity/maxCapacity. The exact AWS database shape with serviceFamily: 'aurora-serverless' and size: 'db.serverless' also accepts flat characteristics.minAcu/maxAcu; those aliases are rejected elsewhere, including at the resource root or inside config. Its connection limit is fixed from maximum configured ACU (16 ACU and minimum 2 estimates 3360), unless characteristics.maxConnections is supplied. For that shape, multiAz:true with instanceCount:2 creates a separately billable reader (<writer-id>-reader) in another AZ. Inspect returned resources and metrics before using simulation.step or chaos.run to observe modeled failover; no AWS timing guarantee is implied. For database connection budgets, set characteristics.connectionDemand on a database: {mode:'declared',declaredConnections:240} uses that plan-time demand without RPS; {mode:'max',declaredConnections:240,idlePoolFloor:200} takes the maximum of load-derived demand and the declared/floor values; omitted configuration preserves load-derived behavior. Separately, a compute resource with characteristics.appDbPoolSize and a direct database connection automatically contributes its maximum fleet count \xD7 pool size to metrics.databases[].declaredFleetConnectionBudget; declaredFleetConnectionBudgetTiers identifies each tier's count, pool size, and capacity basis. Autoscaled tiers use maxInstances (or the provider maximum), independent of current warm members or routed traffic; fixed tiers use instanceCount or declared fleet bounds. This is an ASSUMPTION / worst-case pool-holder budget, not observed DB sessions. loadDerivedConnections stays separately available as the traffic-derived estimate, and this automatic budget does not replace it or alter cost, DB CPU, or latency. declaredConnections and idlePoolFloor are ASSUMPTIONS / plan-time budgets (for example, replicas \xD7 per-pod pool size), not observed live DB connections. Set maxConnections to the usable limit you intend to test. Per-database metrics report connectionDemandMode, loadDerivedConnections, declaredConnections/idlePoolFloor, and modeledConnections; cost and DB CPU/latency remain based on existing load-driven behavior. Demand above the usable limit adds a bounded, rule-based pool-saturation error signal; it is not a provider-calibrated rate. A declared reader defaults to writer-mirror (Aurora promotion tiers 0/1, mirrored ACU and modeled CPU; not independently routed read work). Set characteristics.auroraReaderScalingMode to independent (tiers 2\u201315) for own routed load and ACU floor; set it on a two-instance writer to configure its derived reader. Inspect normalizedConfig.resources[].auroraReaderScalingMode and metrics.serverless[].scalingMode; use simulation.cost_breakdown for each separately billed ACU-hour and modeled parked-writer charge. For OCI flexible compute shapes, pass the documented positive integer characteristics.ocpus explicitly; VM.Standard.E4.Flex accepts 1\u201364 OCPUs and each OCPU maps to 2 vCPUs. OCPU count establishes capacity dimensions only, not provider-specific performance, throughput, or price. An uncounted flexible shape remains an unverified generic estimate. Check GET /api/prediction/generic-shapes for the catalog-derived generic fallback inventory. New prediction-only GCP standard capacity entries include e2-standard-2/4/8/16/32, n1-standard-1/2/4/8/16/32/64/96, and n2-standard-16/32/48/64/80/96/128; provider specifications establish vCPU/memory dimensions, not CWM performance or pricing. Version 1 predictionEvidence explicitly reports legacyGeneric at the top level and on every appCpuByResource item; its note identifies each generic resource's shape and fallback reason. Any capacity, node-bound, SKU, or autoscaling value supplied through this tool is recorded as agent-supplied in the immutable normalizationReceipt; use responseMode: 'full' and inspect that receipt rather than describing an agent calibration as observed human input. Generic GKE telemetry and recovery apply only to worker nodes; its control-plane management fee is cost-only, and this tool does not model control-plane CPU, API throttling, or control-plane cooldown. To bound the autoscaled fleet size, set the top-level maxInstances / minInstances parameters. If you do not set maxInstances, the engine uses the provider default \u2014 AWS 50, GCP 15, Azure/OCI/DigitalOcean 10 \u2014 which may be much larger than your intended fleet size (e.g. an 'ASG with max 6 nodes' would silently be allowed to grow toward 50 on AWS). The response includes effectiveMaxInstances / effectiveMinInstances so you can confirm the bounds that will be enforced. For a targeted CPU HPA scale-out threshold, send the canonical autoscalingTargetCpu field in this create call (for example, autoscalingTargetCpu: 70 for GKE). The compatible aliases scaleOutCpuThreshold, scaleOutCpuPercent, and autoscaleTargetCpuPercent are also accepted; if more than one is sent, their values must agree. Every create response includes hpaAudit with the supplied field, persisted thresholds, and any provider default. For an ECS Fargate CPU-only target-tracking fleet, set ecsCpuTargetTracking: true with autoscalingTargetCpu, minInstances/maxInstances, and optional scaleOutCooldownSeconds/scaleInCooldownSeconds (simulated seconds, defaulting to cooldownSeconds). simulationSecondsPerStep controls clock conversion (default 1). This disables latency/throughput scale-out for that ECS fleet; inspect autoscalingConfig and the resource's applicationAutoscalingPolicy in the full response. These four TOP-LEVEL fields are simulation-wide \u2014 the engine applies one CPU threshold identically to every resource's scale decision by default. To make ONE resource scale at a different CPU target than the rest of the simulation (e.g. a GKE cluster scaling out at 60% while an EC2 fleet in the same simulation scales out at 80%), set characteristics.scaleOutCpuThreshold and/or characteristics.scaleInCpuThreshold on that specific resource instead \u2014 the per-resource value wins over the simulation-wide default for that resource only, and every other resource is unaffected. A misnamed near-miss field nested under characteristics (e.g. targetCPUUtilizationPercentage) is rejected with a 400 explaining the correct field name \u2014 it is never silently dropped and defaulted. Responses are compact by default: id, name, status, traffic, and a per-resource summary (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided). Pass responseMode: 'full' to get the complete simulation object instead. During a failure workflow, lower traffic to serviceable levels before calling simulation.recover_resource, then use simulation.step until the recovered resource is healthy. Recovery progress is included when applicable: recoveryProgress.state is parked, cooling_down, or healthy, and its parkWindow/cooldown objects report totalSteps, completedSteps, remainingSteps, target, and requiredSteps. Poll simulation.get or simulation.step until state is healthy. No prerequisites beyond authentication. Returns the created simulation's id, consumed by every simulation-scoped tool. The likely next tool is simulation.step. Do not call api.spec to learn the workflow \u2014 the tool descriptions in this session contain everything needed. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        name: z8.string().describe("Human-readable name for the simulation"),
        appWeight: z8.enum(["lean", "typical", "heavy"]).optional().describe("Immutable root-level workload weight. Omitted means typical (appWeightDefaulted=true); explicit typical predicts identical values. Lean selects the owned fit only for the eligible graph. predictionEvidence contains CPU/P50/P95 assumption ranges, not confidence intervals. Heavy is an unsupported product assumption."),
        description: z8.string().optional().describe("Optional description of the simulation scenario"),
        scenarioId: z8.string().min(1).optional().describe("Live scenario identifier from scenario.list; mutually exclusive with resources and connections"),
        scenarioOverrides: z8.union([
          z8.object({
            eksSpotInterruption: z8.object({
              startupSeconds: z8.number().int().min(0).max(3600).describe("Catalog EKS Spot startup duration in seconds (0\u20133600)")
            }).strict()
          }).strict(),
          z8.object({
            webAutoscaling: z8.object({
              includeTrafficRecovery: z8.boolean().default(false).describe(
                "Activate the optional Web App Autoscaling Traffic Recovery ramp; defaults to false (inactive). Set true to observe scale-in, or false to leave it inactive."
              )
            }).strict()
          }).strict()
        ]).optional().describe("Scenario-only customization; requires scenarioId and exactly one supported override. Web App Autoscaling recovery must be selected before the first simulation.step."),
        resources: z8.array(
          z8.object({
            id: z8.string().describe("Unique identifier for this resource within the simulation"),
            type: z8.enum(["compute", "database", "storage", "network", "cache", "queue", "kubernetes"]).describe("Resource category"),
            name: z8.string().describe("Display name for the resource"),
            // Preserve output-only near-misses so HTTP intake can return
            // INVALID_FIELD instead of Zod silently stripping them.
            minAcu: z8.unknown().optional().describe("Not accepted at resource level; use characteristics.minAcu for the exact AWS Aurora Serverless v2 db.serverless shape."),
            maxAcu: z8.unknown().optional().describe("Not accepted at resource level; use characteristics.maxAcu for the exact AWS Aurora Serverless v2 db.serverless shape."),
            provider: z8.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).default("aws").describe("Cloud provider"),
            location: z8.object({ regionKey: z8.string(), zoneKey: z8.string().optional(), localityType: z8.enum(["az", "zone", "availability_domain", "fault_domain"]).optional(), providerLabel: z8.string().optional(), faultDomainKey: z8.string().optional() }).optional().describe("Resource location. Set regionKey:'us-east-2' on all four owned typical nodes; REST normalizes it to the AWS catalog key use2. Do not put region under characteristics."),
            recoveryPolicy: z8.object({
              criticalCpuThreshold: z8.number().min(0).max(100).optional(),
              criticalSteps: z8.number().int().min(1).optional(),
              warningCpuThreshold: z8.number().min(0).max(100).optional(),
              warningSteps: z8.number().int().min(1).optional(),
              failureParkSteps: z8.number().int().min(1).optional()
            }).optional().describe("Optional recovery thresholds and cooldown lengths for this resource"),
            characteristics: z8.object({
              size: z8.string().optional().describe("Instance/resource size, e.g. t3.medium, n1-standard-2"),
              ocpus: z8.number().int().positive().max(126).optional().describe("OCI flexible compute shape capacity. Family-specific limits are validated against the provider shape; VM.Standard.E4.Flex accepts 1\u201364 OCPUs and 1 OCPU = 2 vCPUs. Not a performance or price claim."),
              workload: z8.enum(["crud", "crud-typical"]).optional().describe("Set 'crud' for the lean owned graph or 'crud-typical' for the exact owned typical Node graph. Omission can qualify for lean only on the complete canonical graph; typical requires explicit identity."),
              appRuntime: z8.string().optional().describe("Owned typical: 'node' on both apps."),
              appWorkerCount: z8.number().int().positive().optional().describe("Owned typical: 2 on each app."),
              appDbPoolSize: z8.number().int().positive().optional().describe("Owned typical: 250 on each app."),
              workloadDatabaseVersion: z8.string().optional().describe("Owned typical: '8.0' on the MySQL database; workload identity only, not RDS lifecycle billing."),
              loadBalancerScheme: z8.enum(["internal", "internet-facing"]).optional().describe("Owned typical: 'internal' on the ALB."),
              workloadDatabaseEngine: z8.enum(["mysql"]).optional().describe("Preferred MySQL workload identity for the exact healthy AWS db.r5.large RDS node in the owned CRUD graph. Literal characteristics.engine='mysql' is a narrow workload-only alias for this exact shape; it does not enable engine-version, Extended Support, lifecycle, or billing inputs, which remain rejected."),
              engine: z8.string().optional().describe("AWS RDS direct engine field is accepted only as literal 'mysql' workload identity on the exact db.r5.large canonical owned-CRUD database; prefer workloadDatabaseEngine. It does not declare engine version, Extended Support, lifecycle, or billing behavior; other engine values and lifecycle/billing fields remain rejected."),
              capacityRps: z8.number().positive().optional().describe("Compute only: literal per-node RPS ceiling at which CPU reaches ~95%. Kubernetes rejects capacityRps; use maxThroughput for its total cluster ceiling."),
              maxThroughput: z8.number().optional().describe("Kubernetes: total cluster RPS ceiling; compute: legacy internal throughput scaling parameter (prefer capacityRps for compute)."),
              maxConnections: z8.number().int().positive().max(1e6).optional().describe("Fixed concurrent DB connection budget; Aurora Serverless defaults from maximum configured ACU."),
              cdnTraffic: cdnTrafficSchema.optional().describe("Assumed CDN cacheable/dynamic request mix and DB-query fractions. cacheHitRate applies only to the cacheable share. Read simulation.step metrics.cdnFlow for the modeled edge, origin and database flow."),
              cacheHitRate: z8.number().min(0).max(1).optional(),
              sessionAffinity: sessionAffinitySchema.optional().describe("Opt-in modeled sticky owners for generic compute; Kubernetes requires explicit workload replicas independent of nodes. Use identical fleetId/config on compute peers. Existing sessions do not migrate on scale-out; owner loss disconnects them. reconnect:'next-step' explicitly enables rebinding; default none. Session arrivals/lifetime are assumptions, not measured OpenShell data. Read full step metrics.sessionAffinity for per-owner load, rejects and disconnects."),
              connectionDemand: z8.object({
                mode: z8.enum(["load-derived", "declared", "max"]).describe("load-derived keeps the legacy traffic estimate; declared uses only the plan-time declaredConnections/idlePoolFloor; max uses the greatest of load-derived and declared/floor demand."),
                declaredConnections: z8.number().int().min(0).max(1e6).optional().describe("ASSUMPTION / plan-time peak pool budget (for example, replicas \xD7 per-pod pool size), not an observed live connection count."),
                idlePoolFloor: z8.number().int().min(0).max(1e6).optional().describe("ASSUMPTION / plan-time minimum idle pool footprint, not an observed live connection count.")
              }).optional().describe("Database only. Omit to preserve legacy load-derived connection use. `declared` and `max` require declaredConnections and/or idlePoolFloor. Demand above usable maxConnections adds a bounded rule-based pool-saturation error signal, not a provider-calibrated rate."),
              minCapacity: z8.number().positive().optional().describe("Aurora Serverless minimum ACU (flat form; nested config wins)."),
              maxCapacity: z8.number().positive().optional().describe("Aurora Serverless maximum ACU (flat form; nested config wins)."),
              minAcu: z8.number().positive().optional().describe("Flat minimum ACU alias only for AWS Aurora Serverless v2 size db.serverless; conflicts with minCapacity are rejected."),
              maxAcu: z8.number().positive().optional().describe("Flat maximum ACU alias only for AWS Aurora Serverless v2 size db.serverless; conflicts with maxCapacity are rejected."),
              config: z8.object({
                minCapacity: z8.number().positive().optional(),
                maxCapacity: z8.number().positive().optional()
              }).passthrough().optional().describe("Aurora Serverless ACU bounds. Nested config uses minCapacity/maxCapacity; flat characteristics.minAcu/maxAcu aliases are accepted only on the exact AWS Aurora Serverless v2 db.serverless shape."),
              auroraStandbyResourceId: z8.string().min(1).optional().describe("AWS Aurora writer only: ID of a distinct healthy Aurora standby for opt-in modeled quick-failure promotion; no AWS calls."),
              auroraReaderScalingMode: z8.enum(["writer-mirror", "independent"]).optional().describe("Aurora Serverless v2 reader: writer-mirror (default, promotion tier 0/1) follows writer ACU; independent (tier 2\u201315) uses routed reader load and ACU floor. Each instance incurs its own ACU-hour charge. Set on a declared reader, or writer when generating a multiAz two-instance reader."),
              multiAz: z8.boolean().optional().describe("AWS Aurora Serverless v2: true with instanceCount:2 creates a billable reader in a second AZ."),
              instanceCount: z8.number().int().min(1).max(100).optional().describe("Generic fixed compute: represented VM count (integer 1\u2013100); capacity aggregates and CPU is per VM. Cannot combine with autoscaling:true, minInstances, or maxInstances. AWS Aurora Serverless v2 remains 1 with multiAz:false or 2 with multiAz:true."),
              autoscaling: z8.boolean().optional().describe("Whether autoscaling is enabled for this resource"),
              billingState: z8.enum(["active", "idle", "stopped", "detached", "deleted"]).optional().describe("Billing state: 'stopped' bills storage only, 'idle'/'detached' bill flat idle rates, 'deleted' bills nothing. Default 'active'."),
              serviceFamily: z8.string().optional().describe("Service family discriminator. For owned AWS CRUD eligibility only, absent ec2/rds may be inferred for exact m5.large/db.r5.large shapes; explicit ec2/rds is accepted, conflicting families fail. The sole ALB may use explicit 'alb'; absent family requires an unambiguous ALB resource name. These inferences do not rewrite persisted caller configuration. Idle-billed families include nat-gateway, vpc-endpoint, eip-detached, ebs-snapshot, cloud-nat, and private-endpoint."),
              capacityGB: z8.number().optional().describe("Storage capacity in GB \u2014 drives per-GB snapshot/backup idle cost and stopped-instance storage cost"),
              scaleOutCpuThreshold: z8.number().min(0).max(100).optional().describe("Compute or Kubernetes only \u2014 overrides the simulation-wide CPU HPA scale-out target (see the top-level autoscalingTargetCpu) for THIS resource's scale decisions only; every other resource keeps the simulation-wide default."),
              scaleInCpuThreshold: z8.number().min(0).max(100).optional().describe("Compute or Kubernetes only \u2014 overrides the simulation-wide CPU HPA scale-in target for THIS resource's scale decisions only; every other resource keeps the simulation-wide default."),
              kubernetesCpuHpa: kubernetesCpuHpaSchema.optional().describe(
                "Opt-in bounded workload-pod replica model, separate from node-pool scaling. Declare CPU demand in millicores/RPS and targets (Utilization requires an explicit CPU request). A reviewed cpuDemandCalibration may include 2\u2013100 offered-RPS/aggregate-mCPU points and must match the explicit demand value; cite its source and reference in cpuDemandEvidence. Unannotated request/demand inputs are ASSUMED; no HPA controller parity is claimed."
              )
            }).passthrough().optional().describe("Provider-specific resource characteristics (extra keys such as costMultiplier pass through unchanged)")
          })
        ).optional().describe(`${SCENARIO_RESOURCES_INPUT_DESCRIPTION} Mutually exclusive with scenarioId.`),
        connections: z8.array(
          z8.object({
            sourceId: z8.string().describe("ID of the source (upstream) resource"),
            targetId: z8.string().describe("ID of the target (downstream) resource"),
            label: z8.string().optional().describe("Optional label describing the connection type")
          })
        ).optional().describe(`${SCENARIO_CONNECTIONS_INPUT_DESCRIPTION} (e.g. web server \u2192 database). Omit when using scenarioId.`),
        traffic: z8.number().optional().describe("Initial traffic level in requests per second (defaults to 0 for explicit resource graphs; scenarioId uses the catalog's step-zero traffic when omitted)"),
        seed: z8.number().int().min(0).optional().describe("Deterministic RNG seed. Reuse the same seed, traffic, topology, and fault schedule for reproducible incident replays."),
        maxInstances: z8.number().int().min(1).optional().describe("Hard ceiling on the autoscaled compute fleet size, stored as autoscalingConfig.maxInstances and enforced by the engine's autoscale cap logic. If omitted, the provider default applies (AWS 50, GCP 15, Azure/OCI/DigitalOcean 10) \u2014 which may be much larger than your intended fleet size."),
        minInstances: z8.number().int().min(1).optional().describe("Floor on the autoscaled compute fleet size, stored as autoscalingConfig.minInstances. If omitted, the provider default applies (AWS/GCP/Azure/OCI 2, DigitalOcean 1)."),
        autoscalingTargetCpu: z8.number().min(0).max(100).optional().describe("Canonical CPU HPA scale-out target percent. CWM synthesizes unrelated autoscaling defaults."),
        scaleOutCpuThreshold: z8.number().min(0).max(100).optional().describe("Equivalent alias for autoscalingTargetCpu; if both are sent they must match."),
        scaleOutCpuPercent: z8.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
        autoscaleTargetCpuPercent: z8.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
        ecsCpuTargetTracking: z8.boolean().optional().describe("Opt into CPU-only ECS Fargate target tracking; other providers keep their existing scaling policy."),
        scaleOutCooldownSeconds: z8.number().int().min(0).max(86400).optional().describe("ECS CPU target-tracking scale-out cooldown in simulated seconds."),
        scaleInCooldownSeconds: z8.number().int().min(0).max(86400).optional().describe("ECS CPU target-tracking scale-in cooldown in simulated seconds."),
        simulationSecondsPerStep: z8.number().positive().max(60).optional().describe("Simulated seconds per step for ECS cooldowns (default 1)."),
        resilienceConfig: mcpResilienceConfigSchema.optional().describe(
          "Optional retry/cascade resilience model. When set, the step engine models retry amplification, circuit-breaker state, rate limiting, and cascading-failure depth across the declared dependencies. resilienceConfig.externalMetrics accepts deterministic sampled metrics for independent triggers. no_ready_endpoints is a successful zero only when that trigger opts in with noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. This is a recommendation model, not a KEDA/provider actuator, and does not change resource counts. Goodput and errorRate are client-level outcomes against original offered RPS. A dependency targeting an autoscaled compute member uses aggregate capacity and health from its routable fleet; a non-autoscaled target uses its resolved resource capacity (including any declared fixed-instance count) once. retryAmplificationFactor is (original offered RPS + generated retry RPS) / original offered RPS, not a capacity measure. Set per-edge policy at resilienceConfig.dependencies[].retryPolicy, e.g. {id:'web-to-db',sourceId:'web-1',targetId:'db-1',retryPolicy:{timeoutMs:10000,maxRetries:0}}. Also supported there: backoffMs, backoffMultiplier, jitterRatio, retryBudgetRatio, retryBudgetRps, and retryActorId. Omitted fields use maxRetries:2 and timeoutMs:2000; compact create responses return the effective resilienceConfig. Each step response then includes retryAmplificationFactor (headline metric) and a full resilience telemetry block. Omit entirely to leave the resilience model disabled (byte-identical to existing behavior)."
        ),
        responseMode: z8.enum(["compact", "full"]).default("compact").describe(CREATE_RESPONSE_MODE_DESCRIBE)
      },
      outputSchema: createOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const { responseMode, ...createArgs } = args;
        const hasResources = createArgs.resources !== void 0;
        const hasScenarioId = createArgs.scenarioId !== void 0;
        const hasScenarioOverrides = createArgs.scenarioOverrides !== void 0;
        if (!hasResources && !hasScenarioId) {
          return errorResult("Provide either resources or scenarioId to create a simulation.");
        }
        if (hasScenarioOverrides && !hasScenarioId) {
          return errorResult("scenarioOverrides requires scenarioId and cannot be used with an explicit resource graph.");
        }
        if (hasResources && hasScenarioId) {
          return errorResult("Do not provide scenarioId with resources or connections; choose one graph source.");
        }
        const result = await ctx.apiCall(
          "POST",
          "/api/simulations",
          {
            ...createArgs,
            ...hasScenarioId ? {} : { connections: createArgs.connections ?? [] }
          },
          true
        );
        if (responseMode === "full") return structuredResult(result);
        return structuredResult(toCompactCreateResponse(result));
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.update",
    {
      title: "Update Simulation",
      description: "Update an existing simulation's autoscaling fleet bounds, CPU HPA target, resilience config, or complete resource list. resilienceConfig.externalMetrics is a deterministic sampled recommendation model: no_ready_endpoints is successful zero only when its trigger sets noReadyEndpointsAsZero:true; discovery_error and fetch_error always remain errors. It is not a KEDA/provider actuator and does not change resource counts. Use it to adjust maxInstances / minInstances after creation \u2014 e.g. to tighten a fleet ceiling before a surge experiment \u2014 or to attach/replace a resilienceConfig to enable retry amplification modeling. Set per-edge retry behavior inside resilienceConfig.dependencies[].retryPolicy, e.g. {id:'web-to-db',sourceId:'web-1',targetId:'db-1',retryPolicy:{timeoutMs:10000,maxRetries:0}}. backoffMs, backoffMultiplier, jitterRatio, retryBudgetRatio, retryBudgetRps, and retryActorId are also supported there; omitted fields keep the defaults (2 retries, 2000 ms timeout). The response includes the effective resilienceConfig. PATCH replaces the resilience model, so include the complete config you want retained. To set only the CPU HPA scale-out target while preserving provider defaults for all other autoscaling fields, send one of autoscalingTargetCpu, scaleOutCpuThreshold, scaleOutCpuPercent, or autoscaleTargetCpuPercent. If multiple target names are sent, their values must agree. These fields are simulation-wide and only recognized at the top level of this call \u2014 a misnamed CPU target field is rejected with a 400, not silently dropped and defaulted. To change per-resource characteristics such as connectionDemand, pass the complete updated resources array; it replaces the stored resource list, so preserve all existing resource fields and connections. Set resources and connections before the first simulation.step: once the first step finalizes replay identity, updates that include either field return 409 and topology cannot be edited. This replay protection cannot be bypassed. For sticky Kubernetes workloads, configure characteristics.sessionAffinity.workload.replicas and its CPU-driven autoscaling before stepping; this is modeled workload behavior, not a manual in-run scaling command. If a simulation was created without maxInstances, the engine enforces the provider default cap \u2014 AWS 50, GCP 15, Azure/OCI/DigitalOcean 10 \u2014 which may be much larger than your intended fleet size. The response includes effectiveMaxInstances / effectiveMinInstances so you can confirm the bounds that will be enforced. Do not use it to change traffic (use simulation.inject_traffic) or resource sizes (use simulation.resize). Requires a simulationId from simulation.create or simulation.list. The likely next tool is simulation.step to observe the updated bounds, or simulation.compare_resilience to quantify a resilience improvement. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to update. Required \u2014 obtain it from simulation.create or simulation.list."),
        maxInstances: z8.number().int().min(1).optional().describe("New hard ceiling on the autoscaled compute fleet size, stored as autoscalingConfig.maxInstances and enforced by the engine's autoscale cap logic."),
        minInstances: z8.number().int().min(1).optional().describe("New floor on the autoscaled compute fleet size, stored as autoscalingConfig.minInstances."),
        autoscalingTargetCpu: z8.number().min(0).max(100).optional().describe("Canonical CPU HPA scale-out target percent. Unrelated provider autoscaling defaults are preserved."),
        scaleOutCpuThreshold: z8.number().min(0).max(100).optional().describe("Equivalent alias for autoscalingTargetCpu; if both are sent they must match."),
        scaleOutCpuPercent: z8.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
        autoscaleTargetCpuPercent: z8.number().min(0).max(100).optional().describe("Grok-compatible alias for the CPU HPA scale-out target; if multiple target names are sent they must match."),
        resources: z8.array(z8.object({
          characteristics: z8.object({
            kubernetesCpuHpa: kubernetesCpuHpaSchema.optional().describe(
              "Opt-in per-workload replica recommendations from explicit CPU request, demand, and Utilization/AverageValue targets. A reviewed cpuDemandCalibration can derive demand from 2\u2013100 CPU/RPS measurements; cite the source and reference in cpuDemandEvidence. This bounded model does not change node pools or claim controller parity."
            )
          }).passthrough().optional()
        }).passthrough()).max(256).optional().describe("Complete replacement resource list. Preserve existing IDs and topology. Use database characteristics.connectionDemand with load-derived, declared, or max mode; declaredConnections and idlePoolFloor are ASSUMPTIONS / plan-time budgets, not live connections. Demand above usable maxConnections adds a bounded rule-based pool-saturation error signal, not a provider-calibrated rate."),
        resilienceConfig: mcpResilienceConfigSchema.optional().describe("Replace the simulation's resilience model using the same full resilienceConfig schema as simulation.create. Per-edge retry settings belong in dependencies[].retryPolicy. externalMetrics supports deterministic sampled triggers: no_ready_endpoints is successful zero only with noReadyEndpointsAsZero:true; discovery_error and fetch_error remain errors. It is a recommendation model, not a KEDA/provider actuator, and does not change resource counts.")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Simulation ID"),
        name: z8.string().optional().describe("Simulation name"),
        effectiveMaxInstances: z8.number().optional().describe("The fleet-size ceiling the engine will enforce after this update"),
        effectiveMinInstances: z8.number().optional().describe("The fleet-size floor the engine will enforce after this update"),
        resilienceConfig: mcpResilienceConfigSchema.optional().describe("Effective resilience configuration after server defaults are applied")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        if (args.maxInstances === void 0 && args.minInstances === void 0 && args.resilienceConfig === void 0 && args.autoscalingTargetCpu === void 0 && args.scaleOutCpuThreshold === void 0 && args.scaleOutCpuPercent === void 0 && args.autoscaleTargetCpuPercent === void 0 && args.resources === void 0) {
          return errorResult("Provide autoscaling bounds, a CPU HPA target, resources, or resilienceConfig to update.");
        }
        const body = {};
        if (args.maxInstances !== void 0) body.maxInstances = args.maxInstances;
        if (args.minInstances !== void 0) body.minInstances = args.minInstances;
        if (args.resilienceConfig !== void 0) body.resilienceConfig = args.resilienceConfig;
        if (args.autoscalingTargetCpu !== void 0) body.autoscalingTargetCpu = args.autoscalingTargetCpu;
        if (args.scaleOutCpuThreshold !== void 0) body.scaleOutCpuThreshold = args.scaleOutCpuThreshold;
        if (args.scaleOutCpuPercent !== void 0) body.scaleOutCpuPercent = args.scaleOutCpuPercent;
        if (args.autoscaleTargetCpuPercent !== void 0) body.autoscaleTargetCpuPercent = args.autoscaleTargetCpuPercent;
        if (args.resources !== void 0) body.resources = args.resources;
        const result = await ctx.apiCall("PATCH", `/api/simulations/${args.simulationId}`, body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.step",
    {
      title: "Simulate Step",
      description: "Advance a simulation by one time step and return updated metrics (CPU, latency, throughput, error rate, cost). Concurrent simulation.step calls on one simulation either serialize as distinct consecutive steps or receive HTTP 409 simulation_step_in_progress without advancing or consuming a demo credit. Wait for the running call to finish, then retry only rejected calls; steps for different simulations can run concurrently. A timeout is not an idempotency key: inspect simulation.metrics or simulation.get before retrying an uncertain result. Use it to drive the simulation forward and observe system behaviour over time, typically right after simulation.create or a traffic/failure change. Do not use it to read current state without advancing time \u2014 that is simulation.metrics. With Aurora Serverless v2, responseMode:'full' includes metrics.serverless[] instanceRole, scalingMode, cpuBasis, acu, ratePerAcuHour, rateBasis and billingReason. A mirrored reader's CPU is modeled, not evidence of separately routed reads. For current per-instance spend, call simulation.cost_breakdown after stepping. Responses are compact by default: principal metrics plus per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided) and this step's events. Seeded characteristics.eksSpotInterruption telemetry retains its additive migrationEvaluation beside the interruption lifecycle: use its recorded/derived/unavailable field provenance, frozen deadline verdict/counts/reasons, and simulation-clock milestones rather than final service health. The distinct eksSpotMigration contract remains separately reported when configured. Compact responses also include errorBreakdown when the engine provides it. A critical resource with isRoutable: true is degraded but still serving; unavailable identifies a failed or parked node, while scaled_to_zero and cold_start identify Fargate no-task states. Pass responseMode: 'full' to get the complete simulation state instead. During recovery, each resource may include recoveryProgress with state parked, cooling_down, or healthy, plus parkWindow and cooldown counters. Poll simulation.step or simulation.get and stop when the targeted resource's recoveryProgress.state is healthy. GPU / inference workflow: when the simulation includes a kubernetes resource with characteristics.inferenceMode: true, each step response also includes gpuUtilization (%), tokensPerSecond, costPerMillionTokens (USD/M tokens), idleGpuCostPerHour (USD/hr of standby GPU spend), and idleGpuFraction (0-1 share of the GPU bill that is idle HA overhead). costPerMillionTokens rises non-linearly as gpuUtilization falls \u2014 use it to track inference economics step by step. After sustained steps, fetch GPU right-sizing hints via GET /api/simulations/{id}/right-sizing-hint to get gpu-underutilized, gpu-saturated, or gpu-api-breakeven recommendations. Requires a simulationId from simulation.create (or simulation.list). The likely next tool is simulation.step again, simulation.inject_traffic to change load, or simulation.metrics to review history. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to step. Required \u2014 obtain it from simulation.create or simulation.list; authenticated tools have no session default."),
        traffic: z8.number().min(0).optional().describe("Optional traffic override in RPS for this step. Omit to use the simulation's current traffic."),
        responseMode: z8.enum(["compact", "full"]).default("compact").describe(RESPONSE_MODE_DESCRIBE)
      },
      outputSchema: stepOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {};
        if (args.traffic !== void 0) body.traffic = args.traffic;
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/step`, body, true);
        const response = args.responseMode === "full" ? result : toCompactStepResponse(result);
        return stepResponseResult(response, () => ctx.apiCall("GET", `/api/simulations/${args.simulationId}`, void 0, true));
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.metrics",
    {
      title: "Get Simulation Metrics",
      description: `Read the latest metrics and resource states for an existing simulation. Returns latency (P50/P95/P99), CPU usage, memory, throughput, error rate, cost per hour, and per-resource health. For P99, use latencyP99Basis for its percentile-specific basis and predictionEvidence.latencyP99 for evidenceLevel plus low/central/high assumption bounds when present. Values are prediction provenance, not observed simulated output; intervals are not statistical confidence intervals. Historical rows may omit P99 evidence. Top-level effectiveConfigHash versions replay startup inputs with engineVersion and calibration identity; replayIdentity.effectiveConfigHash remains the original replay-only hash. Use it to inspect current state and metrics history without advancing time; do not use it to move the simulation forward \u2014 that is simulation.step. Responses are compact by default: principal current metrics plus explicit modeled goodputRps (a post-step point rate sourced from throughput, with provenance), goodputWindow (recorded only from persisted simulation-clock bounds, otherwise unavailable with provenance; never derive it from retrieval time or currentStep), errorBreakdown when available, per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, and recoveryBlockedReason when provided), seeded EKS Spot checkpoint history and migrationEvaluationComplete/provenance when present, and the last ${METRICS_HISTORY_TAIL} metrics-history entries. Pass responseMode: 'full' to get the complete simulation object and full metrics history instead. When a DB-connected compute tier declares characteristics.appDbPoolSize, compact databaseConnectionDemand and full metrics.databases entries include the separate declaredFleetConnectionBudget plus tier-level max-count provenance; it is a plan-time worst case, not observed DB sessions. loadDerivedConnections and its estimate basis remain distinct. During recovery, each resource may include recoveryProgress.state (parked, cooling_down, or healthy) with parkWindow and cooldown counters; poll simulation.metrics or simulation.get until healthy. Aurora Serverless v2 metrics.serverless[] identifies the instance role, reader mode, CPU basis, billable ACU, per-ACU-hour rate and modeled allocated-writer billing during quick failure; use simulation.cost_breakdown for an exact per-resource cost sum. GPU / inference workflow: when the simulation includes a kubernetes resource with characteristics.inferenceMode: true, the response also includes top-level gpuUtilization (%), tokensPerSecond, costPerMillionTokens (USD/M tokens), idleGpuCostPerHour (USD/hr of standby GPU spend), and idleGpuFraction (0-1 idle HA overhead share) from the latest step, and each history entry carries the same inference fields. Use costPerMillionTokens to evaluate self-hosted inference economics \u2014 after 3+ steps you can call GET /api/simulations/{id}/right-sizing-hint to get gpu-underutilized, gpu-saturated, or gpu-api-breakeven right-sizing recommendations. Requires a simulationId from simulation.create or simulation.list, and at least one simulation.step for meaningful metrics. Read-only and does not advance time; repeated calls may consume credits according to the call type's listed price. The likely next tool is simulation.step or simulation.inject_traffic. Requires CWM_API_KEY with read scope.`,
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to query. Required \u2014 obtain it from simulation.create or simulation.list; authenticated tools have no session default."),
        responseMode: z8.enum(["compact", "full"]).default("compact").describe(METRICS_RESPONSE_MODE_DESCRIBE)
      },
      outputSchema: metricsOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const [simulation, rawMetrics] = await Promise.all([
          ctx.apiCall("GET", `/api/simulations/${args.simulationId}`, void 0, true),
          ctx.apiCall("GET", `/api/simulations/${args.simulationId}/metrics`, void 0, true)
        ]);
        const { metrics, lastCostPerHour } = unwrapMetricsResponse(rawMetrics);
        if (args.responseMode === "full") {
          return structuredResult({
            ...toCompactMetricsResponse(simulation, metrics, lastCostPerHour),
            simulation,
            goodputWindow: goodputWindowFromPersistedMetrics(
              args.simulationId,
              metrics
            ),
            metrics: metrics.map(
              (entry) => entry !== null && typeof entry === "object" ? addMcpGoodputContract(entry) : entry
            ),
            ...lastCostPerHour !== void 0 ? { lastCostPerHour } : {}
          });
        }
        return structuredResult(toCompactMetricsResponse(simulation, metrics, lastCostPerHour));
      } catch (err) {
        const status = err.status;
        if (status === 404) {
          return structuredResult({
            status: "not_found",
            message: "Simulation not found or has expired. Call simulation.create to start a new one, or simulation.list to view your active simulations."
          });
        }
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.cost_breakdown",
    {
      title: "Get Per-Resource Cost Breakdown",
      description: "Return the latest per-resource hourly cost array for a simulation, joined with each resource's current status (healthy / warning / critical / stopped). Use this after a failure or traffic surge to identify which resources continue billing while degraded ('zombie' or 'residual' infrastructure) \u2014 e.g. assert 'NAT Gateway: $0.045/hr, RDS: $0.29/hr, 15\xD7 EC2 idle nodes: $0.096/hr each = $1.44/hr \u2014 total residual $1.77/hr' resource by resource instead of narrating aggregate cost jumps. The response is always a flat array from the most recent metrics record \u2014 no paging, no metrics history \u2014 so it is cheap to call between every scenario step. totalCostPerHour equals the exact sum of all resources[].costPerHour values. Aurora Serverless v2 rows include instanceRole, scalingMode, billableAcu, ratePerAcuHour, rateBasis and billingReason. A default promotion-tier 0/1 reader mirrors the writer's modeled capacity/CPU but does not receive writer read traffic without routing; tier 2\u201315 independent readers use their own routed load/floor. Each instance bills its own ACU-hours. A quick-failure writer retains its frozen pre-failure allocated ACU as an explicit modeling assumption; it is unavailable, not a stopped cluster. Do not use it to read full metrics history (that is simulation.metrics) or to advance time (that is simulation.step). Requires a simulationId from simulation.create or simulation.list, and at least one simulation.step (404 not_ready until the first step). Read-only; repeated calls may consume credits according to the call type's listed price. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to query. Required \u2014 obtain it from simulation.create or simulation.list; authenticated tools have no session default.")
      },
      outputSchema: z8.object({
        simulationId: z8.string().optional().describe("Simulation ID"),
        stepIndex: z8.number().optional().describe("Simulation step the breakdown was computed at"),
        totalCostPerHour: z8.number().optional().describe("Exact sum of all resources[].costPerHour values (USD/hr)"),
        residualCostPerHour: z8.number().optional().describe("Subtotal of unavailable, parked, or stopped resource costs; healthy/degraded idle resources including ALBs are excluded."),
        resources: z8.array(
          z8.object({
            resourceId: z8.string(),
            name: z8.string(),
            resourceType: z8.string(),
            provider: z8.string(),
            costPerHour: z8.number(),
            status: z8.string().describe("Current resource status: healthy, warning, critical, stopped, or removed")
          }).passthrough()
        ).optional().describe("Per-resource hourly cost entries from the latest metrics record"),
        status: z8.string().optional().describe("Set on not_found / not_ready responses"),
        message: z8.string().optional()
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/cost-breakdown`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        const status = err.status;
        if (status === 404) {
          return structuredResult({
            status: "not_found",
            message: "Simulation not found/expired, or it has not been stepped yet (cost breakdowns are computed on every step). Call simulation.step at least once, or simulation.list to view your active simulations."
          });
        }
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.list",
    {
      title: "List Simulations",
      description: "List all simulations owned by the current API key. Returns simulation IDs, names, resource counts, and status. Use the returned IDs with simulation.step, simulation.metrics, rl.create, chaos.run, or multicloud.explore. Responses are compact by default: id, name, status, and resourceCount per simulation. Pass responseMode: 'full' to get the complete simulation objects instead. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        responseMode: z8.enum(["compact", "full"]).default("compact").describe(LIST_RESPONSE_MODE_DESCRIBE)
      },
      outputSchema: listOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", "/api/simulations", void 0, true);
        const items = Array.isArray(result) ? result : [result];
        if (args.responseMode === "full") return arrayResult(items, "simulations");
        return arrayResult(toCompactListItems(items), "simulations");
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.get",
    {
      title: "Get Simulation",
      description: "Fetch the current state of a simulation including its normalizedConfig \u2014 the engine-resolved billing parameters (cost multipliers, hourly rates, autoscale thresholds, GPU SKU, per-node token throughput, billing floors, connection limits) that show exactly what CWM is modelling. Use it to verify a simulation was configured as intended \u2014 e.g. confirm which GPU SKU was resolved, the effective autoscale CPU threshold, or the billing floor node count \u2014 without advancing time. For GPU inference clusters, normalizedConfig.resources[].behaviorModel exposes two distinct topology model components: (1) throughput scaling \u2014 topologyThroughputFactor (resolveTopologyScalingFactor) is the coefficient applied to token capacity (nodes \xD7 perNodeTokensPerSec \xD7 factor \xD7 gpuUtil/100); topologyIsLegacyBaseline=true when intraNode was absent/unrecognised (factor 1.0, pre-topology assumption, not a fabric measurement); topologyThroughputCalibrationStatus qualifies the factor. (2) latency shape \u2014 topologyTtftFactor + topologyDecodeFactor (resolveTopologyLatencyFactors) scale TTFT and decode curves; topologyCalibrationStatus qualifies those latency factors. Do not use it to step the simulation forward (use simulation.step) or read metrics history (use simulation.metrics). Compact mode (default) returns id, name, status, traffic, prediction/replay identity metadata, effectiveMaxInstances, effectiveMinInstances, a per-resource status summary, and normalizedConfig. Pass responseMode: 'full' to get the complete simulation object. Requires a simulationId from simulation.create or simulation.list. Returns no identifiers consumed by other tools \u2014 read-only, but repeated calls may consume credits according to the call type's listed price. The likely next tool is simulation.step or simulation.metrics. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to fetch. Required \u2014 obtain it from simulation.create or simulation.list."),
        responseMode: z8.enum(["compact", "full"]).default("compact").describe(
          "Response detail level. 'compact' (default) returns id, name, status, traffic, prediction/replay identity metadata, effectiveMaxInstances, effectiveMinInstances, a per-resource status summary (id, name, status, cpuPercent), and normalizedConfig. 'full' returns the complete simulation object including all resource characteristics and connections."
        )
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Simulation ID"),
        name: z8.string().optional().describe("Simulation name"),
        engineVersion: z8.string().optional().describe("Simulation engine version used for this prediction."),
        predictionEffectiveConfigHash: z8.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
        calibrationEvidence: calibrationEvidenceOutputSchema.optional().describe("Owned-versus-modeled evidence and latency boundary."),
        predictionEvidence: storedPredictionEvidenceSchema.optional(),
        appWeight: z8.enum(["lean", "typical", "heavy"]).optional(),
        appWeightDefaulted: z8.boolean().optional(),
        status: z8.string().optional().describe("Current simulation status"),
        traffic: z8.number().optional().describe("Current traffic in RPS"),
        scenarioHash: z8.string().length(64).optional().describe("Canonical replay scenario graph hash."),
        effectiveConfigHash: z8.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
        replayIdentity: replayIdentitySchema.optional(),
        scenarioAttribution: mcpScenarioAttributionSchema.optional().describe(
          "Trusted server-side attribution copied from the live scenario catalog; absent for explicit resource-graph creates"
        ),
        resources: z8.array(
          z8.object({
            id: z8.string().optional().describe("Resource ID"),
            name: z8.string().optional().describe("Resource display name"),
            status: z8.string().optional().describe("Health status (healthy/warning/critical/failed)"),
            cpuPercent: z8.number().optional().describe("CPU utilization (%)"),
            routedRps: z8.number().optional().describe("Requests per second routed to this resource (compute/kubernetes only)"),
            availabilityState: z8.enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"]).optional().describe("Availability derived from lifecycle and routed traffic; degraded can still serve, unavailable is failed/parked, scaled_to_zero and cold_start are Fargate no-task states"),
            isRoutable: z8.boolean().optional().describe("Whether this compute/Kubernetes resource can receive traffic"),
            recoveryBlockedReason: z8.string().optional().describe("Engine recovery guard currently blocking cooldown progress, when present"),
            recoveryProgress: z8.object({
              state: z8.enum(["parked", "blocked", "cooling_down", "healthy"]),
              parkWindow: z8.object({
                totalSteps: z8.number(),
                completedSteps: z8.number(),
                remainingSteps: z8.number()
              }),
              cooldown: z8.object({
                target: z8.enum(["warning", "healthy"]).nullable(),
                completedSteps: z8.number(),
                requiredSteps: z8.number(),
                remainingSteps: z8.number()
              })
            }).optional().describe("Read-only recovery progress; poll simulation.get or simulation.step until state is healthy"),
            ...compactFailureTelemetrySchema
          }).passthrough()
        ).optional().describe("Per-resource status summary (compact mode) or full resource states (full mode)"),
        effectiveMaxInstances: z8.number().optional().describe("Fleet-size ceiling the engine enforces (autoscalingConfig.maxInstances or provider default)"),
        effectiveMinInstances: z8.number().optional().describe("Fleet-size floor the engine enforces (autoscalingConfig.minInstances or provider default)"),
        normalizedConfig: normalizedConfigSchema.optional().describe(
          "Engine-resolved billing parameters for every resource: cost multipliers, hourly rates, autoscale thresholds (scaleOut/scaleIn CPU %), GPU SKU, per-node token throughput, billing floors, connection limits. Compare these against your intended configuration to confirm the engine is modelling what you designed."
        ),
        // Error / not_found shape.
        status_code: z8.string().optional().describe("Set on error responses (e.g. not_found)"),
        message: z8.string().optional().describe("Human-readable error message")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}`, void 0, true);
        if (args.responseMode === "full") return structuredResult(result);
        const sim = result !== null && typeof result === "object" ? result : {};
        const num = (v) => typeof v === "number" ? v : void 0;
        const str = (v) => typeof v === "string" ? v : void 0;
        const compact = {
          id: str(sim.id),
          name: str(sim.name),
          engineVersion: str(sim.engineVersion),
          predictionEffectiveConfigHash: str(sim.predictionEffectiveConfigHash),
          calibrationEvidence: sim.calibrationEvidence,
          predictionEvidence: sim.predictionEvidence,
          appWeight: sim.appWeight,
          appWeightDefaulted: sim.appWeightDefaulted,
          predictionEvidenceStatus: sim.predictionEvidenceStatus,
          status: simStatus(sim),
          traffic: num(sim.traffic),
          ...typeof sim.scenarioHash === "string" ? { scenarioHash: sim.scenarioHash } : {},
          ...typeof sim.effectiveConfigHash === "string" ? { effectiveConfigHash: sim.effectiveConfigHash } : {},
          ...sim.scenarioAttribution !== void 0 ? { scenarioAttribution: sim.scenarioAttribution } : {},
          ...sim.replayIdentity !== void 0 ? { replayIdentity: sim.replayIdentity } : {},
          resources: toCompactResources(Array.isArray(sim.resources) ? sim.resources : []),
          effectiveMaxInstances: num(sim.effectiveMaxInstances),
          effectiveMinInstances: num(sim.effectiveMinInstances),
          ...sim.normalizedConfig !== void 0 ? { normalizedConfig: sim.normalizedConfig } : {}
        };
        for (const key of Object.keys(compact)) {
          if (compact[key] === void 0) delete compact[key];
        }
        return structuredResult(compact);
      } catch (err) {
        const status = err.status;
        if (status === 404) {
          return structuredResult({
            status_code: "not_found",
            message: "Simulation not found or has expired. Call simulation.create to start a new one, or simulation.list to view your active simulations."
          });
        }
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.provider_api_limits",
    {
      title: "Simulate Provider API Limits",
      description: 'Simulate provider quotas, API throttling, retries, backoff, queueing, worker/concurrency limits, and control-plane operations for an owned simulation. This is a bounded, deterministic model of provider control-plane behavior: it calls the existing CWM provider-limit route, returns scheduler results plus catalog or caller-override provenance, and does not call AWS, Azure, GCP, DigitalOcean, OCI, or any live quota service. Use this when the request is about provider API quotas, throttling, retries, backoff, queueing, workers, concurrency, or control-plane operations. Supply one service per request: the top-level service applies to every operation group, including dependency groups; compare different services in separate requests. Do not use simulation.step or /api/simulations/stateless for that intent: simulation.step advances resource-graph state, while the stateless simulator models cloud workload behavior rather than provider API limits. Catalog-backed policies cover AWS EC2 mutating APIs (service: ec2, operation: mutating, category: compute; aws.ec2.mutating-api), ELBv1 and ELBv2 action-category buckets (service: elbv1 or elbv2, category: network; operation: resource-intensive, registration, non-mutating, or mutating; aws.elbv1.resource-intensive, aws.elbv1.registration, aws.elbv1.non-mutating, aws.elbv1.mutating, aws.elbv2.resource-intensive, aws.elbv2.registration, aws.elbv2.non-mutating, aws.elbv2.mutating), and Azure Resource Manager read/write buckets. Use the documented ELB category for an action; do not map arbitrary action names or uncategorized actions into a supported category, or conflate the v1/v2 buckets. For AWS EC2, represent create, update, and delete requests with operation: "mutating" (the API action names are not separate catalog operations). Aurora Serverless v1 Data API (service: rds-data-api-aurora-serverless-v1, category: database) has two independent limit models, NOT joint enforcement of one workload: requests-per-second (aws.rds-data-api-aurora-serverless-v1.requests-per-second) models 1,000 requests/s per account and Region, with no documented burst; its fixed 1-second scheduler window is an approximation, not AWS timing. concurrent-requests (aws.rds-data-api-aurora-serverless-v1.concurrent-requests) models 500 concurrent requests for ONE cluster using the SAME secret, queueing overflow. Both need quotaScope.account; concurrency additionally needs quotaScope.resource, an opaque cluster-secret-pair label, never the actual secret. Source: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html. Generic RDS control-plane, Aurora Serverless v2 Data API and provisioned Aurora Data API are unsupported by these selectors. IAM, generic RDS control-plane, EC2 Auto Scaling, Application Auto Scaling, and S3 control-plane tuples have no numeric scheduler-compatible public default here; S3 per-prefix object throughput is data-plane guidance, not a control-plane API limit. Try catalog-backed policy resolution first; add a caller-supplied override only when the exact provider/service/operation/category tuple is not covered or a concrete account, subscription, or project scope is required. Otherwise the result is a stable unsupported_policy outcome, not an HTTP 429. A request mixing Aurora Serverless v1 Data API requests-per-second and concurrent-requests selectors is rejected; send separate requests and do not treat results as simultaneous enforcement. Canonical AWS EC2 workload (copy-pasteable MCP request): ```json {"simulationId":"<simulationId>","provider":"aws","region":"us-east-1","service":"ec2","operations":[{"id":"create","operation":"mutating","category":"compute","plannedCount":80},{"id":"update","operation":"mutating","category":"compute","plannedCount":80},{"id":"delete","operation":"mutating","category":"compute","plannedCount":80}],"workerCount":8,"concurrency":8,"maxConcurrency":8,"latency":{"meanMs":40,"p95Ms":80,"timeoutMs":5000}} ``` This is 240 operations in three groups of 80. concurrency is the selected in-flight scheduler width, maxConcurrency is the request ceiling (and sweep bound), and workerCount is the worker cap; set all three to 8 for this example. Inputs are bounded to the public request contract (256 operations, 100,000 planned units, 1,000 workers/concurrency, 16 sweep values, 10 retry attempts, a 1,000,000-event aggregate sweep budget shared across candidates, and a 2-second wall-clock deadline across the whole request). Oversized work is rejected before scheduling with non-retryable 413 PROVIDER_LIMIT_WORK_BUDGET. Two executions may run concurrently. A third request, or an identical active/recently interrupted request, returns a non-retryable 409 with PROVIDER_LIMIT_BUSY or PROVIDER_LIMIT_DUPLICATE; identical interrupted workloads remain guarded for five minutes. The response includes policy source, documentation reference, confidence, and as-of metadata when available. Workflow: call simulation.create first and save its returned simulationId, pass that simulationId to simulation.provider_api_limits, inspect result.status and result.policyResolutions[].policySource (the canonical AWS example should return supported and catalog_default), then call simulation.delete with the same simulationId to clean up. The provider-limit workload is not persisted, does not create resources, and does not advance /step state. Requires CWM_API_KEY with read scope for this tool; simulation.create and simulation.delete require write scope. The likely next tool is simulation.delete for cleanup, or simulation.get or simulation.metrics if you want to confirm resource state was unchanged.',
      inputSchema: providerApiLimitMcpInputSchema,
      outputSchema: providerApiLimitMcpOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const { simulationId, ...request } = args;
        const result = await ctx.apiCall(
          "POST",
          `/api/simulations/${encodeURIComponent(simulationId)}/provider-api-limits`,
          request,
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.create",
    {
      title: "Create RL Environment",
      description: "Create a Gym-compatible reinforcement learning training environment linked to a simulation. Use it when you want to train or evaluate an autoscaling agent with observation/action/reward loops; do not use it for one-off what-if analysis \u2014 plain simulation.step is simpler for that. Requires an existing simulationId from simulation.create. Returns an environment id (consumed by rl.step, rl.reset, rl.observation) plus the initial observation vector. The likely next tool is rl.step to take the first action. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to wrap as an RL environment"),
        maxSteps: z8.number().int().min(1).max(1e4).default(300).describe("Maximum number of steps per episode (1\u201310000, default 300)"),
        initialTraffic: z8.number().min(0).default(1e4).describe("Initial traffic load at the start of each episode in RPS (default 10000)"),
        targetTrafficPattern: z8.enum(["ramp", "burst", "step", "wave", "custom"]).optional().describe("Traffic pattern to apply during training episodes"),
        maxLatencyP95Ms: z8.number().min(0).default(200).describe("SLA target: maximum P95 latency in milliseconds (default 200)"),
        maxErrorRatePercent: z8.number().min(0).max(100).default(1).describe("SLA target: maximum acceptable error rate in percent (default 1)"),
        costBudgetPerHour: z8.number().min(0).optional().describe("Optional cost budget in USD per simulated hour. Episodes that exceed this budget incur negative reward."),
        enableFailures: z8.boolean().default(false).describe("Whether to randomly inject failures during training episodes (default false)"),
        tickSeconds: z8.number().int().min(1).default(3600).describe("Simulated seconds per environment tick (default 3600 = 1 hour). Controls the time-scale of cost and traffic patterns.")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("RL environment ID \u2014 use with rl.step, rl.reset, rl.observation"),
        simulationId: z8.string().optional().describe("Linked simulation ID"),
        observation: z8.record(z8.unknown()).optional().describe("Initial observation vector"),
        status: z8.string().optional().describe("Environment status (active/completed)")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const episodeConfig = {
          maxSteps: args.maxSteps,
          initialTraffic: args.initialTraffic,
          targetSLA: {
            maxLatencyP95: args.maxLatencyP95Ms,
            maxErrorRate: args.maxErrorRatePercent
          },
          enableFailures: args.enableFailures,
          tickSeconds: args.tickSeconds
        };
        if (args.targetTrafficPattern) episodeConfig.targetTrafficPattern = args.targetTrafficPattern;
        if (args.costBudgetPerHour !== void 0) episodeConfig.costBudgetPerHour = args.costBudgetPerHour;
        const result = await ctx.apiCall(
          "POST",
          "/api/rl/environments",
          { simulationId: args.simulationId, episodeConfig },
          true
        );
        const r = result;
        const env = r.environment ?? {};
        return structuredResult({
          ...r,
          id: env.id ?? r.id,
          simulationId: env.simulationId ?? r.simulationId,
          status: env.status ?? r.status
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.step",
    {
      title: "RL Step",
      description: "Execute one RL action in a training environment and receive the next observation, reward, done flag, and diagnostic info. Use it as the inner loop of RL training; use rl.batch_step instead when you have a predetermined sequence of up to 30 actions. Requires an environmentId from rl.create. The likely next tool is rl.step again while done=false, or rl.reset when done=true to start a new episode. Requires CWM_API_KEY with write scope.\n\nScaling scope: scale_out adds separate compute-type resource nodes (instances); scale_in removes those compute nodes. Neither action changes a Kubernetes resource's node count or characteristics.sessionAffinity.workload.replicas, the application workload-owner count. Configure sticky workload replicas and optional CPU-driven workload autoscaling on the Kubernetes resource before stepping; that autoscaling is model-driven behavior, not an exact manual in-run scale command. Resource-topology edits through simulation.update must be made before the first simulation step; after replay identity finalizes, resource/connection edits return 409.\n\nAction types:\n- scale_out: add compute instances\n- scale_in: remove compute instances\n- add_resource: add a new resource node\n- remove_resource: remove a resource node\n- adjust_threshold: change autoscaling CPU/latency/throughput thresholds\n- set_recovery_policy: set per-resource recovery thresholds (requires resourceId + criticalCpuThreshold/criticalSteps/warningCpuThreshold/warningSteps)",
      inputSchema: {
        environmentId: z8.string().describe("ID of the RL environment (from rl.create)"),
        actionType: z8.enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "set_recovery_policy"]).describe("Type of autoscaling action to apply"),
        resourceId: z8.string().optional().describe("ID of the specific resource to target. Required for add_resource, remove_resource, and set_recovery_policy."),
        instanceCount: z8.number().int().min(1).optional().describe("Number of instances to add or remove (for scale_out / scale_in)"),
        cpuThreshold: z8.number().min(0).max(100).optional().describe("New CPU scale-out threshold in percent (for adjust_threshold)"),
        latencyThreshold: z8.number().min(0).optional().describe("New latency threshold in milliseconds (for adjust_threshold)"),
        resourceType: z8.enum(["compute", "database", "storage", "network"]).optional().describe("Type of resource to add (for add_resource)"),
        provider: z8.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Cloud provider for the new resource (for add_resource)"),
        tick_seconds: z8.number().int().min(1).max(3600).optional().describe("Simulated seconds per step (1\u20133600). Overrides the environment default for this step only."),
        criticalCpuThreshold: z8.number().min(0).max(100).optional().describe("CPU % above which a resource is considered critical (for set_recovery_policy). Default 80."),
        criticalSteps: z8.number().int().min(1).optional().describe("Steps the resource must stay at critical CPU before recovery triggers (for set_recovery_policy). Default 4."),
        warningCpuThreshold: z8.number().min(0).max(100).optional().describe("CPU % above which a resource is considered in warning state (for set_recovery_policy). Default 70."),
        warningSteps: z8.number().int().min(1).optional().describe("Steps the resource must stay at warning CPU before recovery triggers (for set_recovery_policy). Default 3.")
      },
      outputSchema: z8.object({
        observation: z8.record(z8.unknown()).optional().describe("Next observation vector"),
        reward: z8.number().optional().describe("Reward signal for this step"),
        done: z8.boolean().optional().describe("True when the episode has ended; call rl.reset to start a new episode"),
        info: z8.record(z8.unknown()).optional().describe("Diagnostic information about this step")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const parameters = {};
        if (args.resourceId !== void 0) parameters.resourceId = args.resourceId;
        if (args.instanceCount !== void 0) parameters.instanceCount = args.instanceCount;
        if (args.cpuThreshold !== void 0) parameters.cpuThreshold = args.cpuThreshold;
        if (args.latencyThreshold !== void 0) parameters.latencyThreshold = args.latencyThreshold;
        if (args.resourceType !== void 0) parameters.resourceType = args.resourceType;
        if (args.provider !== void 0) parameters.provider = args.provider;
        if (args.criticalCpuThreshold !== void 0 || args.criticalSteps !== void 0 || args.warningCpuThreshold !== void 0 || args.warningSteps !== void 0) {
          parameters.recoveryPolicy = {
            criticalCpuThreshold: args.criticalCpuThreshold ?? 80,
            criticalSteps: args.criticalSteps ?? 4,
            warningCpuThreshold: args.warningCpuThreshold ?? 70,
            warningSteps: args.warningSteps ?? 3
          };
        }
        const body = { action: { type: args.actionType, parameters } };
        if (args.tick_seconds !== void 0) body.tick_seconds = args.tick_seconds;
        const result = await ctx.apiCall(
          "POST",
          `/api/rl/environments/${args.environmentId}/step`,
          body,
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.validate_policy",
    {
      title: "Validate Action Policy (Dev)",
      description: "Pre-validate an RL action against the four policy domains (budget, SLA, region, compliance) without executing the step or mutating any state. Returns a PolicyResult with all applicable violations. Use this before rl.step to check whether an action would be blocked or warn. This is a development/spike tool \u2014 not yet in the curated registry. The likely next tool is rl.step to execute the validated action. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        environmentId: z8.string().describe("ID of the RL environment to evaluate against"),
        actionType: z8.enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "set_recovery_policy", "no_op"]).describe("Type of action to pre-validate"),
        resourceId: z8.string().optional().describe("Resource ID (for add_resource, remove_resource, set_recovery_policy)"),
        instanceCount: z8.number().int().min(1).optional().describe("Instance count delta (scale_out / scale_in)"),
        resourceType: z8.enum(["compute", "database", "storage", "network", "cache", "queue", "kubernetes"]).optional().describe("Resource type (add_resource)"),
        provider: z8.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Cloud provider"),
        regionKey: z8.string().optional().describe("Region key (e.g. use1, euw1) \u2014 checked against provider region list"),
        policyMode: z8.enum(["warn", "block"]).optional().describe("Optional per-call mode override. May only escalate (warn\u2192block), never relax (block\u2192warn).")
      },
      outputSchema: z8.object({
        allowed: z8.boolean().optional().describe("Whether the action is allowed under the current policy (absent when status=not_found)"),
        outcome: z8.enum(["pass", "warn", "block"]).optional().describe("Policy evaluation outcome"),
        mode: z8.enum(["warn", "block"]).optional().describe("Effective policy mode used"),
        violations: z8.array(z8.object({
          domain: z8.enum(["budget", "sla", "region", "compliance"]),
          rule: z8.string(),
          message: z8.string(),
          severity: z8.enum(["warning", "error"])
        }).passthrough()).optional().describe("All policy violations found (never first-hit only)"),
        evaluatedAt: z8.string().optional().describe("ISO timestamp of evaluation"),
        status: z8.string().optional().describe("not_found when the environment does not exist"),
        message: z8.string().optional().describe("Human-readable message (present when status=not_found)")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const parameters = {};
        if (args.resourceId !== void 0) parameters.resourceId = args.resourceId;
        if (args.instanceCount !== void 0) parameters.instanceCount = args.instanceCount;
        if (args.resourceType !== void 0) parameters.resourceType = args.resourceType;
        if (args.provider !== void 0) parameters.provider = args.provider;
        if (args.regionKey !== void 0) parameters.regionKey = args.regionKey;
        if (args.policyMode !== void 0) parameters.policyMode = args.policyMode;
        const result = await ctx.apiCall(
          "POST",
          `/api/rl/environments/${args.environmentId}/validate-action`,
          { action: { type: args.actionType, parameters } },
          true
        );
        return structuredResult(result);
      } catch (err) {
        const status = err.status;
        if (status === 404) {
          return structuredResult({
            status: "not_found",
            message: "RL environment not found. Use rl.create to create one."
          });
        }
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.reset",
    {
      title: "Reset RL Environment",
      description: "Reset an RL environment to begin a fresh training episode. Use it when the done flag from rl.step is true (episode over) or to restart training from a clean state; do not use it mid-episode unless you intend to discard progress. Requires an environmentId from rl.create. Returns the initial observation and new episode number. The likely next tool is rl.step. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        environmentId: z8.string().describe("ID of the RL environment to reset")
      },
      outputSchema: z8.object({
        observation: z8.record(z8.unknown()).optional().describe("Initial observation vector for the new episode"),
        episodeNumber: z8.number().optional().describe("New episode number after reset")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall(
          "POST",
          `/api/rl/environments/${args.environmentId}/reset`,
          {},
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.batch_step",
    {
      title: "RL Batch Step",
      description: "Execute up to 30 RL actions in a single round-trip. More efficient than calling rl.step repeatedly when you have a predetermined action sequence. Returns an ordered array of step results (same shape as rl.step). Execution stops early if the episode ends (done=true). The likely next tool is rl.batch_step again while done=false, or rl.reset when done=true to begin a fresh episode. Requires CWM_API_KEY with write scope.\n\nScaling scope: scale_out adds separate compute-type resource nodes (instances); scale_in removes those compute nodes. Neither action changes a Kubernetes resource's node count or characteristics.sessionAffinity.workload.replicas, the application workload-owner count. Configure sticky workload replicas and optional CPU-driven workload autoscaling on the Kubernetes resource before stepping; that autoscaling is model-driven behavior, not an exact manual in-run scale command. Resource-topology edits through simulation.update must be made before the first simulation step; after replay identity finalizes, resource/connection edits return 409.\n\nAction types per step:\n- scale_out: add compute instances\n- scale_in: remove compute instances\n- add_resource: add a new resource node\n- remove_resource: remove a resource node\n- adjust_threshold: change autoscaling CPU/latency/throughput thresholds\n- set_recovery_policy: set per-resource recovery thresholds",
      inputSchema: {
        environmentId: z8.string().describe("ID of the RL environment (from rl.create)"),
        steps: z8.array(
          z8.object({
            actionType: z8.enum(["adjust_threshold", "scale_out", "scale_in", "add_resource", "remove_resource", "set_recovery_policy"]).describe("Type of autoscaling action to apply"),
            resourceId: z8.string().optional().describe("ID of the specific resource to target"),
            instanceCount: z8.number().int().min(1).optional().describe("Instances to add or remove (scale_out / scale_in)"),
            cpuThreshold: z8.number().min(0).max(100).optional().describe("New CPU scale-out threshold in percent (adjust_threshold)"),
            latencyThreshold: z8.number().min(0).optional().describe("New latency threshold in ms (adjust_threshold)"),
            resourceType: z8.enum(["compute", "database", "storage", "network"]).optional().describe("Resource type for add_resource"),
            provider: z8.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Cloud provider for add_resource"),
            criticalCpuThreshold: z8.number().min(0).max(100).optional().describe("Critical CPU % threshold (set_recovery_policy)"),
            criticalSteps: z8.number().int().min(1).optional().describe("Steps at critical before recovery triggers (set_recovery_policy)"),
            warningCpuThreshold: z8.number().min(0).max(100).optional().describe("Warning CPU % threshold (set_recovery_policy)"),
            warningSteps: z8.number().int().min(1).optional().describe("Steps at warning before recovery triggers (set_recovery_policy)"),
            tick_seconds: z8.number().int().min(1).max(3600).optional().describe("Simulated seconds for this step (overrides environment default)")
          })
        ).min(1).max(30).describe("Ordered list of step actions to execute (1\u201330)")
      },
      outputSchema: z8.object({
        results: z8.array(z8.record(z8.unknown())).optional().describe("Ordered step results; same shape as rl.step. May be shorter if episode ended early."),
        stoppedEarly: z8.boolean().optional().describe("True if execution stopped early because done=true")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const steps = args.steps.map((s) => {
          const parameters = {};
          if (s.resourceId !== void 0) parameters.resourceId = s.resourceId;
          if (s.instanceCount !== void 0) parameters.instanceCount = s.instanceCount;
          if (s.cpuThreshold !== void 0) parameters.cpuThreshold = s.cpuThreshold;
          if (s.latencyThreshold !== void 0) parameters.latencyThreshold = s.latencyThreshold;
          if (s.resourceType !== void 0) parameters.resourceType = s.resourceType;
          if (s.provider !== void 0) parameters.provider = s.provider;
          if (s.criticalCpuThreshold !== void 0 || s.criticalSteps !== void 0 || s.warningCpuThreshold !== void 0 || s.warningSteps !== void 0) {
            parameters.recoveryPolicy = {
              criticalCpuThreshold: s.criticalCpuThreshold ?? 80,
              criticalSteps: s.criticalSteps ?? 4,
              warningCpuThreshold: s.warningCpuThreshold ?? 70,
              warningSteps: s.warningSteps ?? 3
            };
          }
          const step = { action: { type: s.actionType, parameters } };
          if (s.tick_seconds !== void 0) step.tick_seconds = s.tick_seconds;
          return step;
        });
        const result = await ctx.apiCall(
          "POST",
          `/api/rl/environments/${args.environmentId}/batch-step`,
          { steps },
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "chaos.scenarios",
    {
      title: "List Chaos Scenarios",
      description: "List all pre-built chaos engineering scenarios available on this Cloud World Model instance. Returns scenario IDs, names, descriptions, and expected outcomes. Use the returned IDs with the chaos.run tool. No API key required.",
      inputSchema: {},
      outputSchema: z8.object({
        scenarios: z8.array(
          z8.object({
            id: z8.string().optional().describe("Scenario identifier"),
            name: z8.string().optional().describe("Scenario display name"),
            description: z8.string().optional().describe("What this scenario demonstrates")
          }).passthrough()
        ).optional().describe("Available chaos engineering scenarios")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async () => {
      try {
        const result = await ctx.apiCall("GET", "/api/chaos/scenarios");
        const items = Array.isArray(result) ? result : [result];
        return arrayResult(items, "scenarios");
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "chaos.run",
    {
      title: "Run Chaos Experiment",
      description: "Inject a failure into a simulation and measure resilience (asynchronous). Use it to discover architectural weak points \u2014 database crashes, zone outages, network partitions, and more; do not use it for simple load changes (simulation.inject_traffic) or routine stepping (simulation.step). Requires a simulationId from simulation.create, plus either a scenarioId (browse with chaos.scenarios) or customInjections. Custom injections can target a resource by targetResourceId or by targetResourceName (exact-then-prefix, case-insensitive; ambiguous names return a 400 with candidates). For database_crash, set promotionDelaySeconds and restartDelaySeconds (integer simulation seconds, 0\u201386400; defaults 30 and 1800) either on the prebuilt database_crash scenario request or inside a custom database_crash injection, not both. Other scenario IDs reject these fields. Only an explicit healthy replicaOf relationship uses promotion; a sole writer restarts after the injection duration. A replica crashing at the same simulation instant is not eligible: the writer uses sole_writer_restart and databaseCrashAssumptions records promotionUnavailableReason; a replica lost after promotion is pending instead produces an Explicit replica promotion failed event. Connected independent writers are hard dependencies: if any required writer is crashed without its own promoted replica, all offered work fails (100% errors, zero goodput), whether one or multiple crashes overlap. A healthy unrelated writer cannot replace it; a non-serving reader crash does not interrupt service. With no connections, each writer is treated as required. Scalar servingResourceId describes only the first crash target and is null when that target is unavailable or aggregate service is down; databaseTargets shows each target's replacement. Chaos samples every 10 simulation seconds (default promotion at 30 seconds); quick simulation.inject_failure uses one-second steps and promotes on its second step (one second after injection). Compare matching phases, not equal step indices or wall-clock times. These are assumptions, not provider SLAs; chaos.results records effective values in resilienceScore.metrics.databaseCrashAssumptions. Returns a job ID immediately \u2014 the experiment runs in the background. The next tool is chaos.status to poll progress, then chaos.results once completed. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to run chaos against"),
        scenarioId: z8.string().optional().describe(
          "Pre-built chaos scenario ID (e.g. az_outage, db_crash, network_partition, cascading_failure, cpu_stress). Use chaos.scenarios to browse available IDs."
        ),
        customInjections: z8.array(
          z8.object({
            failureType: z8.enum([
              "database_crash",
              "database_slowdown",
              "zone_outage",
              "instance_failure",
              "network_latency",
              "network_partition",
              "cascading_failure",
              "cpu_stress"
            ]).describe("Type of failure to inject"),
            targetResourceId: z8.string().optional().describe("Specific resource to target by internal ID"),
            targetResourceName: z8.string().optional().describe(
              "Specific resource to target by display name \u2014 resolved case-insensitively, exact match first then unique prefix; ambiguous names return a 400 listing candidates"
            ),
            targetZone: z8.string().optional().describe("Availability zone to target"),
            intensity: z8.number().min(0).max(100).optional().describe("Failure severity from 0 (minimal) to 100 (maximum)"),
            duration: z8.number().optional().describe("Duration of the failure in simulation seconds"),
            promotionDelaySeconds: z8.number().int().min(0).max(86400).optional().describe("database_crash only: simulated explicit-replica promotion delay (default 30 seconds), not a provider SLA"),
            restartDelaySeconds: z8.number().int().min(0).max(86400).optional().describe("database_crash only: simulated sole-writer restart delay after injection ends (default 1800 seconds), not a provider SLA")
          })
        ).optional().describe("Custom failure injections \u2014 use instead of scenarioId for fine-grained control."),
        promotionDelaySeconds: z8.number().int().min(0).max(86400).optional().describe("Prebuilt database_crash scenario only: simulated explicit-replica promotion delay (default 30 seconds), not a provider SLA"),
        restartDelaySeconds: z8.number().int().min(0).max(86400).optional().describe("Prebuilt database_crash scenario only: simulated sole-writer restart delay after injection ends (default 1800 seconds), not a provider SLA"),
        duration: z8.number().min(10).max(1e3).default(300).describe("Total chaos experiment duration in simulation seconds (10\u20131000, default 300)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("Job ID \u2014 pass to chaos.status to poll progress"),
        status: z8.string().optional().describe("Initial job status (pending)")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {
          simulationId: args.simulationId,
          duration: args.duration
        };
        if (args.scenarioId) body.scenarioId = args.scenarioId;
        if (args.customInjections) body.customInjections = args.customInjections;
        if (args.promotionDelaySeconds !== void 0) body.promotionDelaySeconds = args.promotionDelaySeconds;
        if (args.restartDelaySeconds !== void 0) body.restartDelaySeconds = args.restartDelaySeconds;
        const result = await ctx.apiCall("POST", "/api/chaos/run", body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "chaos.status",
    {
      title: "Chaos Job Status",
      description: "Poll the status of a chaos job. Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. Use it after chaos.run to track progress; do not use it to fetch the report itself \u2014 that is chaos.results. Requires a jobId from chaos.run. Read-only and safe to repeat. The next tool depends on status: when 'completed', call chaos.results; while 'pending' or 'running', call chaos.status again after a short wait. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        jobId: z8.string().describe("Chaos job ID returned by chaos.run")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Job ID"),
        status: z8.string().optional().describe("Current status: pending | running | completed | failed | cancelled"),
        progress: z8.number().optional().describe("Completion percentage (0\u2013100)")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/chaos/jobs/${args.jobId}`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "chaos.results",
    {
      title: "Chaos Job Results",
      description: "Requires a completed jobId from chaos.run/chaos.status. Returns resilienceScore with score, grade, scoringReason, metrics.outcome.recovery (null milestone means recovery not observed), peak sampled latencyP95Ms and bounded chaosIntervals (10-second simulation-clock offered RPS, errors, goodput and target/serving state); also returns vulnerabilities and timeline. For database_crash, metrics.databaseCrashAssumptions records each target's effective simulation-time delays and recovery mode, including defaults; promotionUnavailableReason indicates a related standby was unavailable at injection time, while a later loss appears as an Explicit replica promotion failed timeline event. Promotion requires an explicit healthy replicaOf relationship, which simulation.create materializes for AWS Aurora Serverless v2 multiAz:true with instanceCount:2. No further tool is required; this is a terminal report. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        jobId: z8.string().describe("Chaos job ID returned by chaos.run")
      },
      outputSchema: z8.object({
        score: z8.number().optional().describe("Overall resilience score (0\u2013100)"),
        grade: z8.string().optional().describe("Letter grade (A\u2013F)"),
        vulnerabilities: z8.array(z8.record(z8.unknown())).optional().describe("Discovered vulnerabilities with severity and remediation advice"),
        timeline: z8.array(z8.record(z8.unknown())).optional().describe("Timeline of chaos events")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/chaos/jobs/${args.jobId}/results`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "multicloud.explore",
    {
      title: "Multi-Cloud Explore",
      description: "All results from this tool are simulation-model outputs \u2014 they must not be presented as externally validated provider benchmarks, and consistency across runs reflects model stability, not real-world cloud behaviour. Generate and score multi-cloud deployment strategies for a workload (asynchronous). Compares AWS, GCP, Azure, OCI, and DigitalOcean combinations across cost, latency, and vendor lock-in. Use it when deciding which provider mix fits a workload's cost/latency/lock-in trade-offs; do not use it to simulate behaviour over time (simulation.create + simulation.step) or test failures (chaos.run). No simulation required \u2014 it takes a workload description (instances, storage, traffic, latency SLA, region) directly. Returns a job ID immediately. The next tool is multicloud.status to poll, then multicloud.results for the ranked strategies. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        computeInstances: z8.number().int().min(1).describe("Number of compute instances in the workload"),
        databaseInstances: z8.number().int().min(1).describe("Number of database instances"),
        storageGB: z8.number().min(1).describe("Total storage required in GB"),
        trafficRPS: z8.number().min(1).describe("Average requests per second"),
        latencyRequirementMs: z8.number().min(1).describe("Maximum acceptable P95 latency in milliseconds (your SLA)"),
        primaryRegion: z8.string().describe(
          "Primary deployment region, e.g. 'us-east-1', 'us-central1', 'eastus'. This is the main region where most traffic originates."
        ),
        secondaryRegions: z8.array(z8.string().describe("Region identifier (e.g. 'us-west-2', 'europe-west1')")).optional().describe("Optional list of secondary/failover regions"),
        requiresMultiRegion: z8.boolean().optional().describe("Whether the architecture must span multiple regions (default false)"),
        costWeight: z8.number().min(0).max(1).default(0.4).describe("Optimization weight for minimizing cost (0\u20131, default 0.4)"),
        latencyWeight: z8.number().min(0).max(1).default(0.4).describe("Optimization weight for minimizing latency (0\u20131, default 0.4)"),
        vendorLockInWeight: z8.number().min(0).max(1).default(0.2).describe("Optimization weight for minimizing vendor lock-in risk (0\u20131, default 0.2)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("Job ID \u2014 pass to multicloud.status to poll progress"),
        status: z8.string().optional().describe("Initial job status (pending)")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall(
          "POST",
          "/api/multi-cloud/explore",
          {
            workloadProfile: {
              computeInstances: args.computeInstances,
              databaseInstances: args.databaseInstances,
              storageGB: args.storageGB,
              trafficRPS: args.trafficRPS,
              latencyRequirementMs: args.latencyRequirementMs,
              primaryRegion: args.primaryRegion,
              secondaryRegions: args.secondaryRegions ?? [],
              requiresMultiRegion: args.requiresMultiRegion ?? false,
              dataResidencyRequirements: []
            },
            optimizationWeights: {
              cost: args.costWeight,
              latency: args.latencyWeight,
              vendorLockIn: args.vendorLockInWeight
            }
          },
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "multicloud.status",
    {
      title: "Multi-Cloud Job Status",
      description: "Poll the status of a multi-cloud exploration job. Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. When completed, call multicloud.results. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        jobId: z8.string().describe("Multi-cloud job ID returned by multicloud.explore")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Job ID"),
        status: z8.string().optional().describe("Current status: pending | running | completed | failed | cancelled")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/multi-cloud/jobs/${args.jobId}`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "multicloud.results",
    {
      title: "Multi-Cloud Job Results",
      description: "All figures in these results are simulation-model outputs \u2014 they must not be presented as externally validated provider benchmarks, and cross-run consistency reflects model stability, not real-world cloud behaviour. The response includes an interpretationScope object; consult it before forming any conclusion about provider performance \u2014 check planned claims against its prohibitedClaimCategories and treat load levels outside its testedLoadLevels as hypotheses requiring a new simulation run. Retrieve the full results of a completed multi-cloud exploration job. Returns ranked deployment strategies with per-provider cost, latency, and vendor lock-in scores, plus a comparison report. The top-ranked candidate also has a preProvisionVerdict with decision (hold or ship_with_changes), the checks and evidence behind it, and explicit uncertainty. Multi-cloud exploration cannot return ship: it does not run failure injection, so resilience must be validated separately before deployment. providerTrustLevels records the worst rateProvenance.basis behind each provider's cost figures. The likely next tool is multicloud.verdict to obtain a candidateFingerprint and submit completed caller-attested resilience evidence for that exact candidate and workload. Results are model estimates, not externally validated provider benchmarks. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        jobId: z8.string().describe("Multi-cloud job ID returned by multicloud.explore")
      },
      outputSchema: z8.object({
        allStrategies: z8.array(z8.record(z8.unknown())).optional().describe("All ranked deployment strategies returned by the REST results endpoint"),
        topStrategies: z8.array(z8.record(z8.unknown())).optional().describe("Top-ranked deployment strategies returned by the REST results endpoint"),
        preProvisionVerdict: z8.object({
          decision: z8.enum(["ship", "hold", "ship_with_changes"]),
          strategy: z8.object({ id: z8.string(), name: z8.string() }).nullable(),
          candidateFingerprint: z8.string().nullable(),
          reasons: z8.array(z8.object({
            code: z8.enum([
              "no_candidate_strategy",
              "cost_budget_exceeded",
              "latency_slo_missed",
              "error_budget_exceeded",
              "resilience_validation_required",
              "resilience_check_failed",
              "resilience_evidence_insufficient",
              "required_checks_incomplete",
              "required_checks_passed"
            ]),
            message: z8.string()
          })),
          evidence: z8.object({
            cost: z8.object({
              estimatedPerHour: z8.number().nullable(),
              budgetCheck: z8.enum(["pass", "fail", "not_provided"])
            }),
            latency: z8.object({
              estimatedP95Ms: z8.number().nullable(),
              requirementMs: z8.number(),
              sloCheck: z8.enum(["pass", "fail", "not_evaluated"]),
              headroomPct: z8.number().nullable()
            }),
            errorRate: z8.object({
              modeledFraction: z8.number().nullable(),
              budgetCheck: z8.enum(["pass", "fail", "not_provided"])
            }),
            resilience: z8.object({
              status: z8.enum(["not_evaluated", "pass", "fail"]),
              reason: z8.string(),
              provenance: z8.enum(["recorded", "estimated"]).optional(),
              verification: z8.literal("caller_attested").optional(),
              report: completedResilienceEvidenceSchema.optional()
            })
          }),
          uncertainty: z8.object({
            dataSource: z8.literal("simulation-model"),
            externallyValidated: z8.literal(false),
            providerRateTrust: z8.record(z8.enum(["on-demand", "spot", "estimated"])),
            limitations: z8.array(z8.string())
          })
        }).optional().describe("Conservative, machine-readable verdict for topStrategies[0], including cost, latency, error-rate and resilience evidence"),
        providerTrustLevels: z8.record(z8.enum(["on-demand", "spot", "estimated"])).optional().describe(
          "Per-provider rate trust level \u2014 the worst rateProvenance.basis across the pricing constants behind that provider's cost figures. 'on-demand' = verified published list prices; 'estimated' = at least one contributing rate is a flat estimate, so treat that provider's ranking as approximate."
        )
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall(
          "GET",
          `/api/multi-cloud/jobs/${args.jobId}/results`,
          void 0,
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "multicloud.verdict",
    {
      title: "Finalize Pre-Provision Verdict",
      description: "Requires a completed jobId and strategyId from multicloud.results. Returns preProvisionVerdict and its candidateFingerprint. First omit resilienceEvidence to obtain the fingerprint identifying the exact candidate architecture and workload; retain it with the test inputs. Then submit a completed report only if those exact inputs were tested. Imported evidence is caller-attested, not authenticated as a CWM chaos job or independently verified. Recorded and estimated provenance are preserved; only recorded failure injection, observed recovery, final health and a passing resilience check can complete the resilience gate. Ship additionally requires passing cost, latency and error budgets, and remains a planning decision, not a production guarantee. The likely next tool is multicloud.verdict with the completed resilienceEvidence; omit it to inspect an unfinalized candidate. This read-only computation does not persist the report or change subsequent multicloud.results. Requires CWM_API_KEY with read scope.",
      inputSchema: { jobId: z8.string(), ...preProvisionFinalizeRequestSchema.shape },
      outputSchema: z8.object({ preProvisionVerdict: z8.object({
        decision: z8.enum(["ship", "hold", "ship_with_changes"]),
        candidateFingerprint: z8.string().nullable(),
        evidence: z8.object({
          resilience: z8.object({
            status: z8.enum(["not_evaluated", "pass", "fail"]),
            reason: z8.string(),
            provenance: z8.enum(["recorded", "estimated"]).optional(),
            verification: z8.literal("caller_attested").optional(),
            report: completedResilienceEvidenceSchema.optional()
          })
        }).passthrough()
      }).passthrough() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ jobId, ...body }) => {
      try {
        return structuredResult(await ctx.apiCall("POST", `/api/multi-cloud/jobs/${encodeURIComponent(jobId)}/verdict`, body, true));
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "prediction.validate",
    {
      title: "Prediction Validate",
      description: "Submit an infrastructure validation job: test a simulation against a traffic forecast and detect SLA violations and bottlenecks (asynchronous). Use it to answer 'will this architecture survive this traffic pattern?' before it happens; do not use it for open-ended exploration (simulation.step) or failure injection (chaos.run). Requires a simulationId from simulation.create and a time-series forecast (dataPoints). Returns a job ID immediately. The next tool is prediction.status to poll, then prediction.results for bottleneck detections and recommended autoscaling thresholds. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to validate against the traffic forecast"),
        forecastName: z8.string().describe("Human-readable name for this traffic forecast"),
        forecastDescription: z8.string().optional().describe("Optional description of the forecast scenario"),
        dataPoints: z8.array(
          z8.object({
            timestamp: z8.number().describe("Unix timestamp (seconds) for this data point"),
            rps: z8.number().describe("Requests per second at this point in time"),
            label: z8.string().optional().describe("Optional label such as 'morning peak' or 'flash sale'")
          })
        ).describe("Time-series traffic forecast data points"),
        peakRPS: z8.number().optional().describe("Peak RPS across the forecast window (computed automatically if omitted)"),
        avgRPS: z8.number().optional().describe("Average RPS across the forecast window (computed automatically if omitted)"),
        testSteps: z8.number().int().min(1).default(100).describe("Number of simulation steps to run during validation (default 100)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("Job ID \u2014 pass to prediction.status to poll progress"),
        status: z8.string().optional().describe("Initial job status (pending)")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const trafficForecast = {
          name: args.forecastName,
          dataPoints: args.dataPoints
        };
        if (args.forecastDescription !== void 0) trafficForecast.description = args.forecastDescription;
        if (args.peakRPS !== void 0) trafficForecast.peakRPS = args.peakRPS;
        if (args.avgRPS !== void 0) trafficForecast.avgRPS = args.avgRPS;
        const result = await ctx.apiCall(
          "POST",
          "/api/predictions/validate",
          { simulationId: args.simulationId, trafficForecast, testSteps: args.testSteps },
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "prediction.status",
    {
      title: "Prediction Job Status",
      description: "Poll the status of a prediction job (validation or threshold optimization). Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. When status is 'completed', call prediction.results for the full report. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        jobId: z8.string().describe("Prediction job ID returned by prediction.validate or prediction.optimize_thresholds")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Job ID"),
        status: z8.string().optional().describe("Current status: pending | running | completed | failed | cancelled")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/predictions/jobs/${args.jobId}`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "prediction.results",
    {
      title: "Prediction Job Results",
      description: "Retrieve the full results of a completed prediction job. Includes: detected bottlenecks with severity and timing, SLA violation windows, per-resource health during the forecast, and recommended autoscaling thresholds. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        jobId: z8.string().describe("Prediction job ID returned by prediction.validate or prediction.optimize_thresholds")
      },
      outputSchema: z8.object({
        bottlenecks: z8.array(z8.record(z8.unknown())).optional().describe("Detected bottlenecks with severity and timing"),
        slaViolations: z8.array(z8.record(z8.unknown())).optional().describe("SLA violation windows"),
        recommendedThresholds: z8.record(z8.unknown()).optional().describe("Recommended autoscaling thresholds per resource")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/predictions/jobs/${args.jobId}/results`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "optimization.run",
    {
      title: "Run Optimization Job",
      description: "Start an infrastructure optimization analysis job. The engine generates architecture variants, runs batch simulations, and produces ranked recommendations to minimize cost, maximize performance, or balance both. Returns a job ID immediately; poll optimization.status until completed, then call optimization.results for recommendations. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to optimize"),
        primaryGoal: z8.enum(["minimize_cost", "maximize_performance", "balance"]).describe("Primary optimization objective"),
        maxCostPerHour: z8.number().min(0).optional().describe("Cost constraint: maximum acceptable cost in USD per simulated hour"),
        minThroughput: z8.number().min(0).optional().describe("Performance constraint: minimum acceptable throughput in RPS"),
        maxLatencyP95: z8.number().min(0).optional().describe("Performance constraint: maximum acceptable P95 latency in milliseconds"),
        costWeight: z8.number().min(0).max(1).optional().describe("Weight for cost in multi-objective scoring (0\u20131)"),
        performanceWeight: z8.number().min(0).max(1).optional().describe("Weight for performance in multi-objective scoring (0\u20131)"),
        stabilityWeight: z8.number().min(0).max(1).optional().describe("Weight for stability in multi-objective scoring (0\u20131)"),
        trafficPattern: z8.string().default("steady").describe("Traffic pattern to simulate during optimization: 'steady', 'ramp', 'burst', 'wave' (default 'steady')"),
        durationSteps: z8.number().int().min(1).default(100).describe("Number of simulation steps for each variant evaluation (default 100)"),
        includeFailures: z8.boolean().default(false).describe("Whether to include random failure injections during variant simulations (default false)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("Job ID \u2014 pass to optimization.status to poll progress"),
        status: z8.string().optional().describe("Initial job status (pending)")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const goals = { primary: args.primaryGoal };
        const constraints = {};
        if (args.maxCostPerHour !== void 0) constraints.max_cost_per_hour = args.maxCostPerHour;
        if (args.minThroughput !== void 0) constraints.min_throughput = args.minThroughput;
        if (args.maxLatencyP95 !== void 0) constraints.max_latency_p95 = args.maxLatencyP95;
        if (Object.keys(constraints).length > 0) goals.constraints = constraints;
        const weights = {};
        if (args.costWeight !== void 0) weights.cost = args.costWeight;
        if (args.performanceWeight !== void 0) weights.performance = args.performanceWeight;
        if (args.stabilityWeight !== void 0) weights.stability = args.stabilityWeight;
        if (Object.keys(weights).length > 0) goals.weights = weights;
        const result = await ctx.apiCall(
          "POST",
          "/api/analysis/optimize",
          {
            simulationId: args.simulationId,
            goals,
            testScenario: {
              traffic_pattern: args.trafficPattern,
              duration_steps: args.durationSteps,
              include_failures: args.includeFailures
            }
          },
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "optimization.status",
    {
      title: "Optimization Job Status",
      description: "Poll the status of an infrastructure optimization job. Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. Reports how many architecture variants have been generated and evaluated. When completed, call optimization.results for recommendations. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        jobId: z8.string().describe("Optimization job ID returned by optimization.run")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Job ID"),
        status: z8.string().optional().describe("Current status: pending | running | completed | failed | cancelled"),
        variantsGenerated: z8.number().optional().describe("Number of architecture variants generated so far"),
        variantsEvaluated: z8.number().optional().describe("Number of variants evaluated so far")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/analysis/jobs/${args.jobId}`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "optimization.results",
    {
      title: "Optimization Job Results",
      description: "Retrieve the ranked infrastructure optimization recommendations for a completed job. Each recommendation includes a title, description, priority (critical/high/medium/low), the action to take, expected impact on cost/performance/reliability, and optionally suggested autoscaling configs or resource changes. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        jobId: z8.string().describe("Optimization job ID returned by optimization.run")
      },
      outputSchema: z8.object({
        recommendations: z8.array(
          z8.object({
            title: z8.string().optional().describe("Recommendation title"),
            priority: z8.string().optional().describe("Priority: critical | high | medium | low"),
            action: z8.string().optional().describe("Recommended action to take"),
            impact: z8.record(z8.unknown()).optional().describe("Expected impact on cost/performance/reliability")
          }).passthrough()
        ).optional().describe("Ranked optimization recommendations")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/analysis/jobs/${args.jobId}/recommendations`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "prediction.optimize_thresholds",
    {
      title: "Prediction Optimize Thresholds",
      description: "Submit a threshold optimization job: run a traffic forecast through the simulation engine and derive recommended CPU/latency scale-out and scale-in thresholds for each resource tier. Uses the same forecast format as prediction.validate. Returns a job ID immediately; poll prediction.status until completed, then call prediction.results to retrieve the recommended threshold table. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to derive thresholds for"),
        forecastName: z8.string().describe("Human-readable name for this traffic forecast"),
        forecastDescription: z8.string().optional().describe("Optional description of the forecast scenario"),
        dataPoints: z8.array(
          z8.object({
            timestamp: z8.number().describe("Unix timestamp (seconds) for this data point"),
            rps: z8.number().describe("Requests per second at this point in time"),
            label: z8.string().optional().describe("Optional label such as 'morning peak' or 'flash sale'")
          })
        ).describe("Time-series traffic forecast data points"),
        peakRPS: z8.number().optional().describe("Peak RPS across the forecast window (computed automatically if omitted)"),
        avgRPS: z8.number().optional().describe("Average RPS across the forecast window (computed automatically if omitted)"),
        testSteps: z8.number().int().min(1).default(100).describe("Number of simulation steps to run during threshold search (default 100)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("Job ID \u2014 pass to prediction.status to poll progress"),
        status: z8.string().optional().describe("Initial job status (pending)")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const trafficForecast = {
          name: args.forecastName,
          dataPoints: args.dataPoints
        };
        if (args.forecastDescription !== void 0) trafficForecast.description = args.forecastDescription;
        if (args.peakRPS !== void 0) trafficForecast.peakRPS = args.peakRPS;
        if (args.avgRPS !== void 0) trafficForecast.avgRPS = args.avgRPS;
        const result = await ctx.apiCall(
          "POST",
          "/api/predictions/optimize-thresholds",
          { simulationId: args.simulationId, trafficForecast, testSteps: args.testSteps },
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.inject_traffic",
    {
      title: "Inject Traffic",
      description: "Change a running simulation's traffic level in one call. Three modes: (1) targetRps sets traffic to an exact absolute level, clamped 1\u2013500,000 RPS (e.g. { targetRps: 700 } \u2192 exactly 700 RPS; mode 'target_rps'); (2) deltaPercent applies a relative change \u2014 newTraffic = currentTraffic \xD7 (1 + deltaPercent/100), rounded (e.g. { deltaPercent: 75 } at 400 RPS \u2192 700 RPS; mode 'delta_percent'). targetRps takes precedence if both are given. (3) Set random: true (with no other fields) to inject a large RANDOM spike of +30,000\u201350,000 RPS on top of current traffic (mode 'random_spike'; if a ramp pattern is active it instead advances one increment, mode 'ramp_increment') \u2014 suitable for stress demos, NOT controlled scenarios; use targetRps/deltaPercent for precise load levels. random: true is mutually exclusive with targetRps and deltaPercent \u2014 passing both returns a 400. Traffic persistence: a controlled inject (targetRps/deltaPercent) DEACTIVATES any active traffic patterns (names echoed in deactivatedPatterns), so the injected level persists across subsequent simulation.step calls instead of being pulled back toward a pattern target. The response echoes the applied outcome: { previousRps, appliedRps, mode, requestedTargetRps?, requestedDeltaPercent? } plus the updated simulation and logged event. The likely next tool is simulation.step to observe the effect of the traffic change. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to inject traffic into"),
        targetRps: z8.number().int().min(1).optional().describe("Absolute traffic target in RPS (clamped 1\u2013500,000). Takes precedence over deltaPercent. Deactivates active traffic patterns so the level persists across steps."),
        deltaPercent: z8.number().optional().describe("Relative traffic change in percent (e.g. 75 = +75% of current traffic; must be > -100). Ignored when targetRps is supplied.")
      },
      outputSchema: z8.object({
        simulation: z8.record(z8.unknown()).optional().describe("Updated simulation state after the traffic change"),
        event: z8.record(z8.unknown()).optional().describe("Event logged for this traffic injection"),
        previousRps: z8.number().optional().describe("Traffic level (RPS) before this call"),
        appliedRps: z8.number().optional().describe("Traffic level (RPS) after this call"),
        mode: z8.string().optional().describe("Applied injection mode: target_rps, delta_percent, random_spike, or ramp_increment"),
        requestedTargetRps: z8.number().optional().describe("Echo of the targetRps request field (present only when supplied)"),
        requestedDeltaPercent: z8.number().optional().describe("Echo of the deltaPercent request field (present only when supplied)")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {};
        if (args.targetRps !== void 0) body.targetRps = args.targetRps;
        if (args.deltaPercent !== void 0) body.deltaPercent = args.deltaPercent;
        if (body.targetRps === void 0 && body.deltaPercent === void 0) body.random = true;
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/inject-traffic`, body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.inject_failure",
    {
      title: "Inject Failure",
      description: "Fail one compute/Kubernetes node or database in a running simulation (marked critical, not removed). A targeted database outage is bounded and reversible: no serving database means 100% errors and zero goodput at positive load; use simulation.recover_resource to restore it early, or step through the park window for automatic capacity restoration and cooldown. An AWS Aurora writer declaring characteristics.auroraStandbyResourceId (populated by simulation.create for multiAz:true, instanceCount:2 Serverless v2) requires a healthy related replicaOf standby; multiAz or another DB alone is not sufficient. The first step has no serving writer, and promotion on the second step restores service without a residual writer-failure penalty. Read metrics.databases[].auroraFailover and the promotion event for failed and standby IDs and success, plus errorRate, throughput and errorBreakdown.dbFailure. Each quick step is one modeled simulation second: promotion on step two is one second after injection, not 30 seconds. Chaos database_crash instead samples every 10 seconds and defaults to a 30-second promotion and a 1800-second sole-writer restart after its injection duration. Compare the equivalent unavailable/serving phases, not equal step indices or wall-clock times. This is modeled, not observed AWS behavior. Exact targeting: pass resourceName (human-readable name, e.g. 'app-server-01'; exact match preferred, an unambiguous prefix is accepted) or resourceId to fail a specific resource \u2014 including an individual named instance, not only a group. If resourceName matches multiple resources the call fails with a 400 listing every matching candidate by name \u2014 retry with one exact name (or its resourceId) from that list. The database must be healthy; an already failed database returns a 400 describing its current status. When neither parameter is supplied, a RANDOM healthy compute/Kubernetes node is selected (not a database) \u2014 this path is non-deterministic and NOT suitable for controlled scenarios or CI replay; always target by name/id when reproducing a precise fault sequence. The response always echoes the applied outcome via resolvedResourceId, resolvedResourceName, and previousHealth (populated from the selected resource on the random path too). For typed, durational database failures use failure.create with database_overload (requires an API key); instance_kill PERMANENTLY removes the instance (failure.delete does not restore it), while instance_down is reversible. Network, storage, cache, queue, and security resource types are not supported by quick injection. Use simulation.events to review the full event log after injecting. The likely next tool is simulation.step to observe the failure propagating through the system. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to inject a node failure into"),
        resourceName: z8.string().optional().describe("Optional: name of the resource to fail (exact match preferred; unambiguous prefix accepted). Ambiguous names return a 400 with a candidate list."),
        resourceId: z8.string().optional().describe("Optional: ID of the resource to fail. Takes precedence over resourceName.")
      },
      outputSchema: z8.object({
        resources: z8.array(z8.record(z8.unknown())).optional().describe("Updated resource list after failure injection"),
        event: z8.record(z8.unknown()).optional().describe("Failure event that was logged"),
        resolvedResourceId: z8.string().optional().describe("ID of the resource that was failed (targeted or randomly selected)"),
        resolvedResourceName: z8.string().optional().describe("Name of the resource that was failed"),
        previousHealth: z8.string().optional().describe("The resource's health status immediately before the failure was applied")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {};
        if (args.resourceName !== void 0) body.resourceName = args.resourceName;
        if (args.resourceId !== void 0) body.resourceId = args.resourceId;
        if (body.resourceName === void 0 && body.resourceId === void 0) body.random = true;
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/inject-failure`, body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.events",
    {
      title: "Get Simulation Events",
      description: "Retrieve the full ordered event log for a simulation. Events include scale-out/in actions, failure injections, cost spikes, bottleneck alerts, routing changes, and autoscaling triggers \u2014 the primary audit trail for understanding what happened during a run. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation whose event log to retrieve")
      },
      outputSchema: z8.object({
        events: z8.array(
          z8.object({
            id: z8.string().optional().describe("Event ID"),
            type: z8.string().min(1).describe("Event type (e.g. scale_out, failure_injection, cost_spike)"),
            timestamp: z8.string().optional().describe("ISO timestamp at which the event occurred"),
            message: z8.string().optional().describe("Human-readable description of the event")
          }).passthrough()
        ).optional().describe("Ordered event log entries")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/events`, void 0, true);
        const items = Array.isArray(result) ? result : [result];
        return arrayResult(items, "events");
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.delete",
    {
      title: "Delete Simulation",
      description: "Permanently delete a simulation and all of its associated metrics, events, snapshots, and failure injections. This action is irreversible. Requires CWM_API_KEY with write scope and ownership of the simulation.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to delete")
      },
      outputSchema: z8.object({
        deleted: z8.boolean().optional().describe("True if the simulation was successfully deleted"),
        id: z8.string().optional().describe("ID of the deleted simulation")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("DELETE", `/api/simulations/${args.simulationId}`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "snapshot.create",
    {
      title: "Create Snapshot",
      description: "Pin the current simulation state as a named snapshot for later comparison. Captures resources, latest metrics, active failures, and significant recent events. Returns a pinId you can use with snapshot.get to retrieve the pinned state later. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to snapshot"),
        label: z8.string().optional().describe("Optional human-readable label for this snapshot (e.g. 'before scale-out')")
      },
      outputSchema: z8.object({
        pinId: z8.string().optional().describe("Pin ID \u2014 use with snapshot.get or snapshot.list"),
        label: z8.string().nullable().optional().describe("Snapshot label (null when omitted)"),
        pinnedAt: z8.string().optional().describe("ISO timestamp at which the snapshot was pinned"),
        simulationId: z8.string().optional().describe("ID of the snapshotted simulation")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {};
        if (args.label !== void 0) body.label = args.label;
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/snapshots`, body, true);
        const r = result;
        return structuredResult({
          pinId: r.pinnedSnapshotId ?? r.pinId,
          label: r.label ?? null,
          pinnedAt: r.pinnedAt,
          simulationId: r.simulationId
        });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "snapshot.list",
    {
      title: "List Snapshots",
      description: "List all pinned snapshots for a simulation in reverse chronological order (newest first). Returns summary entries with pinId, label, pinnedAt timestamp, and top-level metrics \u2014 use snapshot.get to retrieve full detail for a specific pin. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation whose snapshots to list")
      },
      outputSchema: z8.object({
        snapshots: z8.array(
          z8.object({
            pinId: z8.string().optional().describe("Snapshot pin ID"),
            label: z8.string().nullable().optional().describe("Snapshot label (null when omitted)"),
            pinnedAt: z8.string().optional().describe("ISO timestamp when pinned")
          }).passthrough()
        ).optional().describe("Snapshot summary entries, newest first")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/snapshots`, void 0, true);
        const r = result;
        const raw = Array.isArray(r) ? r : r.snapshots ?? [];
        const snapshots = raw.map((s) => ({ ...s, pinId: s.pinId ?? s.id }));
        return structuredResult({ snapshots });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "snapshot.get",
    {
      title: "Get Snapshot",
      description: "Retrieve a specific pinned snapshot by its pin ID. Returns the full snapshot payload: resources at pin time, latest metrics, active failures, and the significant events that were captured. Useful for before/after comparisons after scaling or failure injection. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation that owns the snapshot"),
        pinId: z8.string().describe("Pin ID returned by snapshot.create or snapshot.list")
      },
      outputSchema: z8.object({
        pinId: z8.string().optional().describe("Snapshot pin ID"),
        label: z8.string().nullable().optional().describe("Snapshot label (null when omitted)"),
        pinnedAt: z8.string().optional().describe("ISO timestamp when pinned"),
        simulationId: z8.string().optional().describe("ID of the snapshotted simulation"),
        data: z8.record(z8.unknown()).optional().describe("Full snapshot payload: architecture, metrics, activeFailures, recentEvents, recommendations")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/snapshots/${args.pinId}`, void 0, true);
        const r = result;
        return structuredResult({ ...r, pinId: r.pinId ?? r.id });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "ai.explain",
    {
      title: "AI Explain",
      description: "Submit an async AI analysis job to explain the simulation's current behavior. Returns a jobId immediately (no 502 timeout). Poll ai.status until completed, then call ai.results to retrieve the natural-language explanation. Set beginnerMode for jargon-free output. Requires CWM_API_KEY.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to explain"),
        beginnerMode: z8.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("AI job ID \u2014 use with ai.status and ai.results"),
        status: z8.string().optional().describe("Initial job status (pending)"),
        createdAt: z8.string().optional().describe("ISO timestamp when the job was created"),
        message: z8.string().optional().describe("Instructions for polling")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (args) => {
      try {
        const body = { simulationId: args.simulationId, type: "explain" };
        if (args.beginnerMode !== void 0) body.beginnerMode = args.beginnerMode;
        const result = await ctx.apiCall("POST", "/api/ai-jobs", body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "ai.troubleshoot",
    {
      title: "AI Troubleshoot",
      description: "Submit an async AI troubleshooting job for a specific problem in the simulation. Returns a jobId immediately (no 502 timeout). Poll ai.status until completed, then call ai.results to retrieve the diagnosis and remediation steps. Requires CWM_API_KEY.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to troubleshoot"),
        issue: z8.string().describe("Description of the problem to troubleshoot (e.g. 'latency spiking after 500 RPS', 'cost doubled after scale-out')"),
        beginnerMode: z8.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("AI job ID \u2014 use with ai.status and ai.results"),
        status: z8.string().optional().describe("Initial job status (pending)"),
        createdAt: z8.string().optional().describe("ISO timestamp when the job was created"),
        message: z8.string().optional().describe("Instructions for polling")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (args) => {
      try {
        const body = { simulationId: args.simulationId, type: "troubleshoot", issue: args.issue };
        if (args.beginnerMode !== void 0) body.beginnerMode = args.beginnerMode;
        const result = await ctx.apiCall("POST", "/api/ai-jobs", body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "ai.analyze",
    {
      title: "AI Analyze Bottlenecks",
      description: "Submit an async AI bottleneck detection job for the simulation. Returns a jobId immediately (no 502 timeout). Poll ai.status until completed, then call ai.results to retrieve the ranked bottleneck list and remediation suggestions. Requires CWM_API_KEY.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to analyze for bottlenecks"),
        beginnerMode: z8.boolean().optional().describe("Set to true for simplified, beginner-friendly explanations (default false)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("AI job ID \u2014 use with ai.status and ai.results"),
        status: z8.string().optional().describe("Initial job status (pending)"),
        createdAt: z8.string().optional().describe("ISO timestamp when the job was created"),
        message: z8.string().optional().describe("Instructions for polling")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (args) => {
      try {
        const body = { simulationId: args.simulationId, type: "analyze_bottlenecks" };
        if (args.beginnerMode !== void 0) body.beginnerMode = args.beginnerMode;
        const result = await ctx.apiCall("POST", "/api/ai-jobs", body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "ai.status",
    {
      title: "AI Job Status",
      description: "Poll the status of an async AI analysis job (explain, troubleshoot, analyze_bottlenecks, or optimize). Status lifecycle: pending \u2192 running \u2192 completed | failed | cancelled. When completed, call ai.results to retrieve the full output. Requires CWM_API_KEY.",
      inputSchema: {
        jobId: z8.string().describe("AI job ID returned by ai.explain, ai.troubleshoot, ai.analyze, or ai.optimize")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Job ID"),
        status: z8.string().optional().describe("Current status: pending | running | completed | failed | cancelled"),
        jobType: z8.string().optional().describe("Type of analysis: explain | troubleshoot | analyze_bottlenecks | optimize"),
        simulationId: z8.string().optional().describe("Simulation that was analyzed"),
        createdAt: z8.string().optional().describe("ISO timestamp when the job was created"),
        completedAt: z8.string().optional().describe("ISO timestamp when the job completed (if done)"),
        error: z8.string().optional().describe("Error message if the job failed")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/ai-jobs/${args.jobId}`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "ai.results",
    {
      title: "AI Job Results",
      description: "Retrieve the full results of a completed AI analysis job. Call ai.status first to confirm the job is completed. Results vary by job type: explain returns explanation string; troubleshoot returns guidance string; analyze_bottlenecks returns analysis string + doRecommendation object; optimize returns suggestions string array. Requires CWM_API_KEY.",
      inputSchema: {
        jobId: z8.string().describe("AI job ID returned by ai.explain, ai.troubleshoot, ai.analyze, or ai.optimize")
      },
      outputSchema: z8.object({
        explanation: z8.string().optional().describe("Natural-language explanation (explain jobs)"),
        guidance: z8.string().optional().describe("Troubleshooting guidance (troubleshoot jobs)"),
        analysis: z8.string().optional().describe("Bottleneck analysis (analyze_bottlenecks jobs)"),
        doRecommendation: z8.object({
          suggestedDropletSize: z8.string().optional(),
          estimatedHourlyRate: z8.number().optional(),
          estimatedMonthlyCost: z8.number().optional(),
          currentHourlyCost: z8.number().optional(),
          estimatedHourlySavings: z8.number().optional(),
          estimatedMonthlySavings: z8.number().optional(),
          savingsPercent: z8.number().optional(),
          savingsIsComputed: z8.boolean().optional(),
          reason: z8.string().optional(),
          numDroplets: z8.number().optional()
        }).passthrough().nullable().optional().describe("DigitalOcean-specific recommendation object (analyze_bottlenecks jobs)"),
        suggestions: z8.array(z8.string()).optional().describe("Optimization suggestions string array (optimize jobs)")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const statusResult = await ctx.apiCall("GET", `/api/ai-jobs/${args.jobId}`, void 0, true);
        const s = statusResult;
        if (s.status !== "completed") {
          return notReadyResult(
            "job_not_complete",
            `AI job is not completed yet (status: ${s.status}). Poll ai.status until completed before calling this tool.`,
            "ai.status"
          );
        }
        const result = await ctx.apiCall("GET", `/api/ai-jobs/${args.jobId}/results`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.list",
    {
      title: "List RL Environments",
      description: "List all RL training environments owned by the API key. Returns environment IDs, linked simulation IDs, active/completed status, episode progress, cumulative reward, and idle-expiry timestamps. Use rl.create to start a new one. Requires CWM_API_KEY with read scope.",
      inputSchema: {},
      outputSchema: z8.object({
        environments: z8.array(
          z8.object({
            id: z8.string().optional().describe("Environment ID"),
            simulationId: z8.string().optional().describe("Linked simulation ID"),
            status: z8.string().optional().describe("active | completed"),
            episodeNumber: z8.number().optional().describe("Current episode number"),
            cumulativeReward: z8.number().optional().describe("Total accumulated reward")
          }).passthrough()
        ).optional().describe("RL environments owned by this API key")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (_args) => {
      try {
        const result = await ctx.apiCall("GET", "/api/rl/environments", void 0, true);
        const r = result;
        const environments = Array.isArray(r) ? r : r.environments ?? r;
        return structuredResult({ environments });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.observation",
    {
      title: "Get RL Observation",
      description: "Manually poll the current observation vector for an RL environment without advancing the episode. Returns the obs struct (rps, cpu_util, instances, traffic, tick_seconds, warmup_factor) and metrics struct (cost_usd_hr, latency_p95, error_rate, uptime, sla_violations). Useful for inspecting state between rl.step calls. The likely next tool is rl.step to take the next action. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        environmentId: z8.string().describe("RL environment ID returned by rl.create")
      },
      outputSchema: z8.object({
        obs: z8.object({
          rps: z8.number().optional().describe("Current requests per second"),
          cpu_util: z8.number().optional().describe("CPU utilization (0\u20131)"),
          instances: z8.number().optional().describe("Current number of compute instances"),
          traffic: z8.number().optional().describe("Traffic in RPS"),
          tick_seconds: z8.number().optional().describe("Seconds per tick"),
          warmup_factor: z8.number().optional().describe("Warm-up ramp factor (0\u20131)")
        }).passthrough().optional().describe("Observation vector"),
        metrics: z8.object({
          cost_usd_hr: z8.number().optional().describe("Cost in USD per hour"),
          latency_p95: z8.number().optional().describe("P95 latency in ms"),
          error_rate: z8.number().optional().describe("Error rate (%)"),
          uptime: z8.number().optional().describe("Uptime fraction (0\u20131)"),
          sla_violations: z8.number().optional().describe("Number of SLA violations")
        }).passthrough().optional().describe("Current environment metrics")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/rl/environments/${args.environmentId}/observation`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.eval",
    {
      title: "Evaluate RL Episodes",
      description: "Run one or more deterministic evaluation episodes against an RL environment by replaying ordered action sequences. Each episode resets to the baseline state and then executes the provided actions in order, recording per-step rewards and a final cumulative score. Use this to benchmark a trained policy without modifying the live environment state. Returns a job ID immediately for async mode; poll rl.eval_status for the result. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        environmentId: z8.string().describe("RL environment ID to evaluate against"),
        episodes: z8.array(
          z8.array(
            z8.object({
              actionType: z8.enum(["scale_out", "scale_in", "add_resource", "remove_resource", "adjust_threshold", "set_recovery_policy", "no_op"]).describe("Action to execute"),
              resourceId: z8.string().optional().describe("Target resource ID"),
              instanceCount: z8.number().int().optional().describe("Number of instances to add or remove"),
              cpuThreshold: z8.number().optional().describe("New CPU scale-out threshold (for adjust_threshold)"),
              latencyThreshold: z8.number().optional().describe("New latency threshold in ms (for adjust_threshold)")
            })
          )
        ).min(1).max(10).describe("Array of episodes; each episode is an ordered list of actions to replay"),
        collapseThreshold: z8.number().min(0).max(1).optional().describe("Fraction drop in reward that triggers reward_collapse detection (default 0.20)")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Eval job ID \u2014 pass to rl.eval_status to poll progress"),
        status: z8.string().optional().describe("Initial job status (pending)")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const actions = args.episodes.map(
          (episode) => episode.map((a) => {
            const parameters = {};
            if (a.resourceId !== void 0) parameters.resourceId = a.resourceId;
            if (a.instanceCount !== void 0) parameters.instanceCount = a.instanceCount;
            if (a.cpuThreshold !== void 0) parameters.cpuThreshold = a.cpuThreshold;
            if (a.latencyThreshold !== void 0) parameters.latencyThreshold = a.latencyThreshold;
            return { type: a.actionType, parameters };
          })
        );
        const body = { actions };
        if (args.collapseThreshold !== void 0) body.collapseThreshold = args.collapseThreshold;
        const result = await ctx.apiCall(
          "POST",
          `/api/rl/environments/${args.environmentId}/eval-episodes`,
          body,
          true
        );
        const r = result;
        return structuredResult({ ...r, id: r.id ?? r.jobId });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.eval_status",
    {
      title: "RL Eval Job Status",
      description: "Poll the status of an async RL evaluation job. Status lifecycle: pending \u2192 running \u2192 completed | failed. When completed, call rl.eval_results to retrieve the full per-episode scores. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        environmentId: z8.string().describe("RL environment ID the eval job belongs to"),
        jobId: z8.string().describe("Eval job ID returned by rl.eval")
      },
      outputSchema: z8.object({
        status: z8.string().optional().describe("Current status: pending | running | completed | failed"),
        jobId: z8.string().optional().describe("Job ID"),
        createdAt: z8.string().optional().describe("ISO timestamp when the job was created"),
        completedAt: z8.string().optional().describe("ISO timestamp when the job completed (if done)"),
        error: z8.string().optional().describe("Error message if the job failed")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall(
          "GET",
          `/api/rl/environments/${args.environmentId}/eval-episodes/${args.jobId}`,
          void 0,
          true
        );
        const r = result;
        return structuredResult({ status: r.status, jobId: r.id, createdAt: r.createdAt, completedAt: r.completedAt, error: r.error });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "rl.eval_results",
    {
      title: "RL Eval Job Results",
      description: "Retrieve the full results of a completed RL eval job. Returns per-episode cumulative rewards, per-step reward breakdowns, and reward_collapse flags. Call rl.eval_status first to confirm the job has completed. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        environmentId: z8.string().describe("RL environment ID the eval job belongs to"),
        jobId: z8.string().describe("Eval job ID returned by rl.eval")
      },
      outputSchema: z8.object({
        episodes: z8.array(
          z8.object({
            cumulativeReward: z8.number().optional().describe("Total reward for this episode"),
            rewards: z8.array(z8.number()).optional().describe("Per-step reward breakdown"),
            rewardCollapse: z8.boolean().optional().describe("True if reward collapse was detected")
          }).passthrough()
        ).optional().describe("Per-episode evaluation results")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall(
          "GET",
          `/api/rl/environments/${args.environmentId}/eval-episodes/${args.jobId}`,
          void 0,
          true
        );
        const r = result;
        if (r.status !== "completed") {
          return notReadyResult(
            "job_not_complete",
            `Job is not completed yet (status: ${r.status}). Poll rl.eval_status until completed before calling this tool.`,
            "rl.eval_status"
          );
        }
        return structuredResult(r.result ?? result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "ai.optimize",
    {
      title: "AI Optimize",
      description: "Submit an async AI optimization job for the simulation. Returns a jobId immediately (no 502 timeout). Poll ai.status until completed, then call ai.results to retrieve ranked infrastructure recommendations. Set beginnerMode for simplified explanations. Requires CWM_API_KEY.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to optimize"),
        beginnerMode: z8.boolean().optional().describe("Set to true for simplified, beginner-friendly suggestions (default false)")
      },
      outputSchema: z8.object({
        jobId: z8.string().optional().describe("AI job ID \u2014 use with ai.status and ai.results"),
        status: z8.string().optional().describe("Initial job status (pending)"),
        createdAt: z8.string().optional().describe("ISO timestamp when the job was created"),
        message: z8.string().optional().describe("Instructions for polling")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (args) => {
      try {
        const body = { simulationId: args.simulationId, type: "optimize" };
        if (args.beginnerMode !== void 0) body.beginnerMode = args.beginnerMode;
        const result = await ctx.apiCall("POST", "/api/ai-jobs", body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "traffic.create",
    {
      title: "Create Traffic Pattern",
      description: "Create a persistent traffic pattern for a simulation (ramp, burst, step, wave, or spike). Unlike simulation.inject_traffic, this creates a named, manageable pattern that persists across steps and can be updated or deleted via traffic.update/traffic.delete. Returns the created pattern with its patternId. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to add the pattern to"),
        type: z8.enum(["ramp", "burst", "step", "wave", "custom"]).describe("Traffic pattern type"),
        name: z8.string().optional().describe("Human-readable name for the pattern (required by the API; defaults to '<type>-<timestamp>' if omitted)"),
        startTime: z8.number().optional().describe("Simulation step at which the pattern begins (default 0)"),
        rpsTarget: z8.number().min(0).optional().describe(
          "Target RPS for the pattern. Mapped per type: ramp/step \u2192 parameters.endTraffic; burst \u2192 parameters.peakTraffic; wave \u2192 parameters.amplitude. Ignored when the explicit 'parameters' field already contains the canonical key."
        ),
        durationSteps: z8.number().int().min(1).optional().describe("Number of simulation steps for this pattern to run"),
        endTime: z8.number().nonnegative().optional().describe("Simulation step at which the pattern stops being active; preserved independently of durationSteps"),
        parameters: z8.record(z8.unknown()).optional().describe("Additional pattern-specific parameters (e.g. { rampRate: 100, peakRPS: 5000 })")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Pattern ID \u2014 use with traffic.update and traffic.delete"),
        type: z8.string().optional().describe("Pattern type"),
        name: z8.string().optional().describe("Pattern name"),
        startTime: z8.number().optional().describe("Simulation step at which the pattern starts"),
        endTime: z8.number().optional().describe("Simulation step at which the pattern stops being active"),
        parameters: z8.record(z8.unknown()).optional().describe("Persisted pattern parameters"),
        isActive: z8.boolean().optional().describe("Whether the pattern is currently active")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {
          type: args.type,
          name: args.name ?? `${args.type}-${Date.now()}`,
          startTime: args.startTime ?? 0
        };
        if (args.durationSteps !== void 0) body.durationSteps = args.durationSteps;
        if (args.endTime !== void 0) body.endTime = args.endTime;
        const merged = { ...args.parameters };
        if (args.rpsTarget !== void 0) {
          if (args.type === "burst") {
            if (merged.peakTraffic === void 0) merged.peakTraffic = args.rpsTarget;
          } else if (args.type === "wave") {
            if (merged.amplitude === void 0) merged.amplitude = args.rpsTarget;
          } else {
            if (merged.endTraffic === void 0) merged.endTraffic = args.rpsTarget;
          }
        }
        if (Object.keys(merged).length > 0) body.parameters = merged;
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/patterns`, body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "traffic.update",
    {
      title: "Update Traffic Pattern",
      description: "Update an existing traffic pattern by its patternId. Supports partial updates \u2014 only the fields you provide are changed. The likely next tool is simulation.step to observe the updated pattern driving traffic. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        patternId: z8.string().describe("Pattern ID returned by traffic.create"),
        rpsTarget: z8.number().min(0).optional().describe("New target RPS"),
        durationSteps: z8.number().int().min(1).optional().describe("New step duration"),
        parameters: z8.record(z8.unknown()).optional().describe("Pattern-specific parameters to merge/update"),
        isActive: z8.boolean().optional().describe("Set to false to deactivate the pattern without deleting it")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Pattern ID"),
        isActive: z8.boolean().optional().describe("Whether the pattern is currently active"),
        rpsTarget: z8.number().optional().describe("Updated target RPS")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {};
        if (args.rpsTarget !== void 0) body.rpsTarget = args.rpsTarget;
        if (args.durationSteps !== void 0) body.durationSteps = args.durationSteps;
        if (args.parameters !== void 0) body.parameters = args.parameters;
        if (args.isActive !== void 0) body.isActive = args.isActive;
        const result = await ctx.apiCall("PATCH", `/api/patterns/${args.patternId}`, body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "traffic.delete",
    {
      title: "Delete Traffic Pattern",
      description: "Delete a traffic pattern by its patternId. The pattern is removed permanently from the simulation. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        patternId: z8.string().describe("Pattern ID returned by traffic.create")
      },
      outputSchema: z8.object({
        deleted: z8.boolean().optional().describe("True if the pattern was successfully deleted"),
        patternId: z8.string().optional().describe("ID of the deleted pattern")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        await ctx.apiCall("DELETE", `/api/patterns/${args.patternId}`, void 0, true);
        return structuredResult({ deleted: true, patternId: args.patternId });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "failure.create",
    {
      title: "Create Failure Injection",
      description: "Inject a persistent, typed failure into a simulation via the lifecycle API. Supports instance_kill, instance_down, az_outage, database_overload, network_latency, and bounded AWS EKS spot_interruption failures. IMPORTANT: instance_kill PERMANENTLY removes the instance from the simulation \u2014 deleting the failure afterwards does NOT restore it. To inject a reversible single-node outage use instance_down instead: it marks the node critical/unresponsive without removing it, and failure.update (isActive: false) or failure.delete restores the node to healthy. For database_overload set top-level severity (minor, moderate, severe; default moderate) OR intensity (0\u20131, mapped to severity); the modeled impact increases with offered database load, and the returned severity is the effective setting. Do not place either field inside parameters. Requires a simulationId from simulation.create. Returns the created failure record with its id consumed by failure.update/delete. The likely next tool is simulation.step. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to inject the failure into"),
        type: z8.enum(["instance_kill", "instance_down", "az_outage", "region_outage", "permanent_data_loss", "database_overload", "network_latency", "spot_interruption"]).describe("Type of failure to inject. instance_kill removes an instance; permanent_data_loss destroys original data irreversibly; region_outage affects service availability; spot_interruption models the bounded AWS EKS notice and migration lifecycle"),
        name: z8.string().optional().describe("Human-readable label for this failure injection (required by the API; defaults to '<type>-<timestamp>' if omitted)"),
        startTime: z8.number().optional().describe("Simulation step at which the failure begins (default 0)"),
        targetResourceId: z8.string().optional().describe("ID of the specific resource to target (required for instance_kill; optional for others)"),
        targetRegion: z8.string().optional().describe("Canonical region key; region_outage requires this and targetProvider"),
        targetZone: z8.string().optional().describe("Canonical zone key; permanent_data_loss zone scopes require targetProvider"),
        targetProvider: z8.enum(["aws", "gcp", "azure", "oci", "digitalocean"]).optional().describe("Cloud provider qualifying a regional or zonal failure scope"),
        severity: z8.enum(["minor", "moderate", "severe"]).optional().describe("Top-level database_overload severity (default moderate); mutually exclusive with intensity"),
        intensity: z8.number().min(0).max(1).optional().describe("Alternative database_overload control: 0\u2013<0.34 minor, 0.34\u2013<0.67 moderate, 0.67\u20131 severe. Do not combine with severity"),
        parameters: z8.record(z8.unknown()).optional().describe("Type-specific parameters (e.g. { azId: 'us-east-1a' } for az_outage, { latencyMs: 200 } for network_latency, or { spotInterruption: { workloadReplicas, imageSizeMiB, pullBandwidthMiBPerSecond, schedulingCapacity, startupSeconds, interruptionHandling } } for EKS Spot)"),
        isActive: z8.boolean().optional().describe("Whether the failure should be active immediately (default true)")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Failure ID \u2014 use with failure.update and failure.delete"),
        type: z8.string().optional().describe("Failure type"),
        isActive: z8.boolean().optional().describe("Whether the failure is currently active"),
        severity: z8.enum(["minor", "moderate", "severe"]).optional().describe("Effective severity, including when intensity was supplied")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {
          type: args.type,
          name: args.name ?? `${args.type}-${Date.now()}`,
          startTime: args.startTime ?? 0
        };
        if (args.targetResourceId !== void 0) body.targetResourceId = args.targetResourceId;
        if (args.targetRegion !== void 0) body.targetRegion = args.targetRegion;
        if (args.targetZone !== void 0) body.targetZone = args.targetZone;
        if (args.targetProvider !== void 0) body.targetProvider = args.targetProvider;
        if (args.severity !== void 0) body.severity = args.severity;
        if (args.intensity !== void 0) body.intensity = args.intensity;
        if (args.parameters !== void 0) body.parameters = args.parameters;
        if (args.isActive !== void 0) body.isActive = args.isActive;
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/failures`, body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "failure.update",
    {
      title: "Update Failure Injection",
      description: "Update an existing failure injection by its failureId. Use isActive: false to deactivate/resolve the failure without deleting it. For instance_down and database_overload failures, setting isActive: false restores snapshotted capacity but leaves health recovery to subsequent qualifying simulation steps; one deactivation event records the failure id and step. instance_kill cannot be reversed this way (the instance was permanently removed). The likely next tool is simulation.step to observe the resource recovering. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        failureId: z8.string().describe("Failure ID returned by failure.create"),
        isActive: z8.boolean().optional().describe("Set to false to resolve/deactivate the failure"),
        parameters: z8.record(z8.unknown()).optional().describe("Updated failure parameters to merge")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Failure ID"),
        isActive: z8.boolean().optional().describe("Whether the failure is still active")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {};
        if (args.isActive !== void 0) body.isActive = args.isActive;
        if (args.parameters !== void 0) body.parameters = args.parameters;
        const result = await ctx.apiCall("PATCH", `/api/failures/${args.failureId}`, body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "failure.delete",
    {
      title: "Delete Failure Injection",
      description: "Permanently delete a failure injection by its failureId. For instance_down and database_overload failures the target resource is restored to healthy status. For instance_kill failures this removes only the record \u2014 it does NOT restore the deleted instance (the kill is permanent); use instance_down when you need a reversible outage. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        failureId: z8.string().describe("Failure ID returned by failure.create")
      },
      outputSchema: z8.object({
        deleted: z8.boolean().optional().describe("True if the failure was successfully deleted"),
        failureId: z8.string().optional().describe("ID of the deleted failure")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        await ctx.apiCall("DELETE", `/api/failures/${args.failureId}`, void 0, true);
        return structuredResult({ deleted: true, failureId: args.failureId });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.resize",
    {
      title: "Bulk Resize Compute",
      description: "Resize all compute resources in a DigitalOcean simulation to a new droplet size in one call. DIGITALOCEAN-ONLY: returns a 400 PROVIDER_MISMATCH error (with no mutation) when the simulation's compute resources use any other provider (AWS, GCP, Azure, OCI) \u2014 it never changes a resource's provider. Do NOT use this tool for failure recovery on any provider; use simulation.recover_resource instead. Applies the new size tier (hourly rate, throughput cap) to every compute node simultaneously. Use simulation.list to find the simulationId. The likely next tool is simulation.step to observe the resized fleet under load. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the DigitalOcean simulation to resize"),
        dropletSize: z8.string().describe("Target droplet size label (e.g. 's-1vcpu-1gb', 's-2vcpu-4gb', 's-4vcpu-8gb', 's-8vcpu-16gb', 'c-4'). Must be a valid DigitalOcean droplet size supported by the platform.")
      },
      outputSchema: z8.object({
        resized: z8.number().optional().describe("Number of compute resources resized"),
        dropletSize: z8.string().optional().describe("Applied droplet size")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/bulk-resize`, { dropletSize: args.dropletSize }, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.recover_resource",
    {
      title: "Recover Failed Resource",
      description: "Recover a single failed resource in a simulation (any provider). Before calling this tool, lower traffic to a serviceable level so recovery is not blocked by the failure park window or idle CPU floor. Clears the resource's failure state: deactivates in-effect REVERSIBLE failure injections targeting it (instance_down, database_overload), restores snapshotted characteristics, and resets its health counters to zero so the engine counts only subsequent qualifying steps. STRICTLY SCOPED to the targeted resource \u2014 other resources that remain failed are NOT affected, so after recovery you can call simulation.get and assert the recovered resource is healthy while other failed resources stay failed. The response echoes the applied outcome, including stepsToHealthy: a lower-bound estimate of the simulation.step calls needed before the resource reads healthy again under the current recovery policy (default lower bound: 7 from critical). The response also sets stepsToHealthyIsLowerBound: true because an explicitly failed resource may need an additional failure-park transition before cooldown resumes, and any CPU threshold breach resets cooldown. Step at least stepsToHealthy times, then poll simulation.get until the resource is healthy. Provide resourceName OR resourceId. Errors (400) when the resource is not found or already healthy. NOT for instance_kill: that failure type permanently REMOVES the resource from the simulation, so it cannot be recovered (400 RESOURCE_KILLED) \u2014 re-add the resource via simulation.update, or prefer inject_failure type instance_down when you want a reversible outage. The likely next tool is simulation.step to advance the simulation and let the recovery progress. Requires CWM_API_KEY with write scope. The response also includes recoveryProgress immediately after recovery starts: state is parked, blocked, cooling_down, or healthy; parkWindow and cooldown report the current completed and remaining steps. Poll simulation.get or simulation.step and stop only when recoveryProgress.state is healthy. ",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation containing the failed resource"),
        resourceName: z8.string().optional().describe("Name of the failed resource to recover (case-insensitive exact match). Provide this or resourceId."),
        resourceId: z8.string().optional().describe("ID of the failed resource to recover. Provide this or resourceName.")
      },
      outputSchema: z8.object({
        resolvedResourceId: z8.string().optional().describe("ID of the resource that was recovered"),
        resolvedResourceName: z8.string().optional().describe("Name of the resource that was recovered"),
        previousHealth: z8.string().optional().describe("Resource status before recovery (e.g. 'critical', 'warning')"),
        recoveryState: z8.string().optional().describe("Always 'recovering' on success"),
        stepsToHealthy: z8.number().optional().describe("Lower-bound number of simulation.step calls before the resource may be healthy; step at least this many, then poll simulation.get"),
        stepsToHealthyIsLowerBound: z8.boolean().optional().describe("Always true: failure-park transitions or CPU threshold breaches can require more steps than stepsToHealthy"),
        recoveryProgress: z8.object({
          state: z8.enum(["parked", "blocked", "cooling_down", "healthy"]),
          parkWindow: z8.object({
            totalSteps: z8.number(),
            completedSteps: z8.number(),
            remainingSteps: z8.number()
          }),
          cooldown: z8.object({
            target: z8.enum(["warning", "healthy"]).nullable(),
            completedSteps: z8.number(),
            requiredSteps: z8.number(),
            remainingSteps: z8.number()
          })
        }).optional().describe("Current recovery stage; poll simulation.get or simulation.step until state is healthy"),
        deactivatedFailureIds: z8.array(z8.string()).optional().describe("Failure injections deactivated as part of the recovery")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) => {
      try {
        const body = {};
        if (args.resourceName) body.resourceName = args.resourceName;
        if (args.resourceId) body.resourceId = args.resourceId;
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/recover-resource`, body, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.claim",
    {
      title: "Claim Simulation",
      description: "Claim ownership of a simulation using the current API key. Useful when a simulation was created anonymously (via the UI) and you want to associate it with your API key for persistent access and multi-step automation. Returns the updated simulation. The likely next tool is simulation.step or simulation.metrics to continue driving the simulation. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the unclaimed simulation to claim")
      },
      outputSchema: z8.object({
        id: z8.string().optional().describe("Simulation ID"),
        name: z8.string().optional().describe("Simulation name"),
        claimed: z8.boolean().optional().describe("True if the simulation is now owned by this API key")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("POST", `/api/simulations/${args.simulationId}/claim`, {}, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "benchmark.validate",
    {
      title: "Validate Accuracy",
      description: "Validate the cost and performance accuracy of a simulation against real-world provider reference data. Returns cost accuracy (\xB110% threshold) and performance accuracy (\xB115% threshold) scores, plus an overallValid flag. Use this to verify your simulation is within acceptable drift before using its output for production decisions. Requires CWM_API_KEY.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to validate")
      },
      outputSchema: z8.object({
        costAccuracy: z8.number().optional().describe("Cost accuracy score (0\u20131; \u22650.9 means within 10% of real-world cost)"),
        performanceAccuracy: z8.number().optional().describe("Performance accuracy score (0\u20131; \u22650.85 means within 15% of real-world perf)"),
        overallValid: z8.boolean().optional().describe("True when both cost and performance accuracy are within thresholds")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/simulations/${args.simulationId}/validate-accuracy`, void 0, true);
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "benchmark.list",
    {
      title: "List Benchmarks",
      description: "List accuracy benchmark results for all supported AWS 6th-generation instance types (m6i, c6i, r6i families). Returns per-instance overall score, cost score, latency score, and performance score \u2014 useful for comparing which instance tier simulates most accurately for your workload. No authentication required.",
      inputSchema: {},
      outputSchema: z8.object({
        instances: z8.array(
          z8.object({
            instanceType: z8.string().optional().describe("AWS instance type (e.g. m6i.large)"),
            overallScore: z8.number().optional().describe("Overall simulation accuracy score (0\u2013100)"),
            costScore: z8.number().optional().describe("Cost accuracy score (0\u2013100)"),
            latencyScore: z8.number().optional().describe("Latency accuracy score (0\u2013100)"),
            performanceScore: z8.number().optional().describe("Performance accuracy score (0\u2013100)")
          }).passthrough()
        ).optional().describe("Per-instance benchmark accuracy results")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (_args) => {
      try {
        const result = await ctx.apiCall("GET", "/api/accuracy-benchmark/instances");
        const r = result;
        const instances = Array.isArray(r) ? r : r.instances ?? r;
        return structuredResult({ instances });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.right_sizing_hint",
    {
      title: "Get Right-Sizing Hint",
      description: "Fetch right-sizing recommendations for an existing simulation after 3 or more steps have been run. Returns hints for over-provisioned or under-provisioned resources \u2014 compute downsizes when CPU has been low, GPU node-count adjustments when GPU utilization is sustained under 40% or above 90%, and a managed-API cost comparison when self-hosted inference cost-per-million-tokens exceeds the breakeven threshold. Prerequisites: a simulationId from simulation.create or simulation.list, and at least 3 steps completed via simulation.step (GPU inference hints additionally require 3 steps with gpuUtilization present in metrics). Returns no identifiers consumed by other tools \u2014 use affectedResourceId + recommendedSlug with simulation.apply_right_sizing to apply a hint in one call. The likely next tool is simulation.apply_right_sizing to act on the recommendation, or simulation.step to gather more data first. Output fields: hasHint (boolean), hints[] \u2014 each with resourceType, reason (low_cpu_util | scale_in | both | low_cpu | gpu-underutilized | gpu-saturated | gpu-api-breakeven), affectedResourceId, affectedResourceName, recommendedSlug, hourlyRate, estimatedSavingsPct, tradeOffNote, currentUtilization. Requires CWM_API_KEY with read scope, or x402 payment (right_sizing_hint, $0.0030).",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to analyze. Obtain from simulation.create or simulation.list.")
      },
      outputSchema: z8.object({
        hasHint: z8.boolean().describe("True when at least one right-sizing recommendation is available"),
        hints: z8.array(
          z8.object({
            resourceType: z8.string().optional().describe("Resource category the hint applies to (compute | kubernetes | database | network | storage)"),
            reason: z8.string().optional().describe(
              "Hint trigger code: low_cpu_util, scale_in, both, low_cpu (compute downsizes); gpu-underutilized, gpu-saturated (node-count); gpu-api-breakeven (cost crossover)"
            ),
            affectedResourceId: z8.string().nullable().optional().describe("Resource ID of the affected resource"),
            affectedResourceName: z8.string().nullable().optional().describe("Display name of the affected resource"),
            recommendedSlug: z8.string().optional().describe("Recommended size label or configuration slug (e.g. 't3.small', '2\xD7 A100 nodes', 'Managed model API @ $X/M tokens')"),
            hourlyRate: z8.number().optional().describe("Estimated hourly cost in USD after applying the recommendation"),
            estimatedSavingsPct: z8.number().optional().describe("Estimated cost reduction as a percentage (0 for scale-out reliability hints)"),
            tradeOffNote: z8.string().optional().describe("Human-readable explanation of the trade-off and breakeven conditions"),
            currentUtilization: z8.number().nullable().optional().describe("Latest utilization reading that triggered this hint (CPU % or GPU %)")
          }).passthrough()
        ).optional().describe("Right-sizing recommendations \u2014 absent when hasHint is false")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall(
          "GET",
          `/api/simulations/${args.simulationId}/right-sizing-hint`,
          void 0,
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.apply_right_sizing",
    {
      title: "Apply Right-Sizing Hint",
      description: "Apply a right-sizing recommendation from simulation.right_sizing_hint directly to the targeted resource in one call. Pass the affectedResourceId and recommendedSlug from the hint; the server validates the slug against the resource's available sizes before mutating anything \u2014 it returns a 400 UNKNOWN_SIZE error (with a list of valid slugs) instead of silently applying an unsupported size. Supported resource types: compute, database, storage (any provider). GPU node-count hints (reason: gpu-underutilized, gpu-saturated) and managed-API breakeven hints (reason: gpu-api-breakeven) produce non-slug recommendedSlugs and cannot be applied via this tool \u2014 act on them through simulation.update instead. Cross-provider DigitalOcean alternatives (a DO slug on a non-DO resource) are accepted; the resource's cost characteristics are updated to the DO tier without changing the provider. Prerequisites: a simulationId from simulation.create or simulation.list, a resourceId and recommendedSlug from simulation.right_sizing_hint. The likely next tool is simulation.step to observe the resized resource under load. Requires CWM_API_KEY with write scope.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation containing the resource to resize"),
        resourceId: z8.string().describe("ID of the resource to resize \u2014 use affectedResourceId from simulation.right_sizing_hint"),
        recommendedSlug: z8.string().describe("Size slug to apply \u2014 use recommendedSlug from simulation.right_sizing_hint (e.g. 't3.small', 'n1-standard-1', 's-1vcpu-2gb')")
      },
      outputSchema: z8.object({
        resourceId: z8.string().optional().describe("ID of the resized resource"),
        resourceName: z8.string().optional().describe("Display name of the resized resource"),
        appliedSlug: z8.string().optional().describe("The size slug that was applied"),
        costMultiplier: z8.number().optional().describe("Cost multiplier for the new size tier"),
        isDoAlternative: z8.boolean().optional().describe("True when the applied slug is a DigitalOcean cross-provider alternative for a non-DO resource")
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall(
          "POST",
          `/api/simulations/${args.simulationId}/apply-right-sizing`,
          { resourceId: args.resourceId, recommendedSlug: args.recommendedSlug },
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "scenario.list",
    {
      title: "List Scenarios",
      description: "List the built-in demo scenarios as compact catalog cards \u2014 stable IDs, title/name, description, difficulty, tags, category, duration, provider summary, resource/connection counts, named active/optional traffic phases, and retry-workload disclosure. Use it as the first call when you want a ready-made architecture instead of designing one; the cards intentionally omit resource, connection, traffic-pattern, and failure-injection graphs. No prerequisites. Optionally narrow discovery with provider, category, and/or difficulty filters; omit them to receive the complete catalog. Pass a returned id as scenarioId to simulation.create for server-side expansion, or pass it to scenario.get when you need to inspect or customize the full graph. Returns named activeFailurePhases and optionalFailurePhases with type, resource/zone target, severity, and step range. No API key required. The likely next tool is scenario.get.",
      inputSchema: scenarioListInputSchema,
      outputSchema: z8.object({
        scenarios: z8.array(scenarioCardSchema).describe("Available demo scenarios")
      }).passthrough(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", scenarioListPath(args));
        const scenarios = (Array.isArray(result) ? result : []).map(toCompactScenarioCard);
        return structuredResult({ scenarios });
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "scenario.get",
    {
      title: "Get Scenario",
      description: "Hydrate one built-in scenario from the live Cloud World Model scenario library. Prerequisite: a scenario id returned by scenario.list. Returns the complete selected scenario graph, including resources and connections plus optional seed, resilienceConfig, protectedResilienceConfig, traffic/failure presets, named traffic-phase summaries, activeFailurePhases and optionalFailurePhases (type, resource/zone target, severity, step range), retry-workload disclosure, and real-world incident metadata. The response includes both title and name for compatibility; pass resources and connections, and optionally seed/resilienceConfig, to simulation.create when you need to edit or inspect the graph. For the shorter handoff, pass the id as scenarioId instead. The likely next tool is simulation.create. Requires CWM_API_KEY with read scope.",
      inputSchema: {
        scenarioId: z8.string().min(1).describe("Scenario identifier returned by scenario.list")
      },
      outputSchema: scenarioGetOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const result = await ctx.apiCall("GET", `/api/scenarios/${encodeURIComponent(args.scenarioId)}`);
        return structuredResult(hydrateScenario(result));
      } catch (err) {
        if (err.status === 404) {
          return structuredResult({
            status: "not_found",
            message: `Scenario '${args.scenarioId}' was not found in the live scenario library.`
          });
        }
        return errorResult(err.message);
      }
    }
  );
  server2.registerTool(
    "simulation.compare_resilience",
    {
      title: "Compare Resilience Configurations",
      description: "Replay the simulation's current traffic profile under two resilience configurations \u2014 a baseline and a mitigated config \u2014 and return side-by-side metrics so you can quantify the improvement from a resilience change. Use it after running simulation.step with resilienceConfig enabled to compare 'before and after' scenarios: e.g. enabling a circuit breaker, tightening retry budgets, or adding load-shedding. The complete agent workflow: (1) configure via simulation.create or simulation.update with resilienceConfig, (2) step the simulation several times to establish a traffic baseline, (3) call this tool to compare baseline vs mitigated config \u2014 the delta.retryAmplificationFactor and delta.errorRate fields are the key headline metrics, (4) if delta is positive (worse), tighten circuitBreaker.failureRateThreshold or lower retryBudgetRatio, (5) if the outcome is 'cascading' or 'degraded', add load-shedding or reduce maxCascadeDepth, (6) replay with the improved config as the new mitigatedConfig until the delta is negative (better). Prerequisites: a simulationId from simulation.create or simulation.list, with a resilienceConfig already attached (or provide an explicit baselineConfig in the request). Each run includes a machine-readable incidentOutcome with the root trigger, retry amplification, peak original/attempted RPS, retry-path error rate, affected dependency IDs, activated controls, recovery time, containment, and replay metadata. Returns a ResilienceComparison id-less object (no persistent artifact). The likely next tool is simulation.step to continue the experiment or simulation.update to persist the improved resilienceConfig. Requires CWM_API_KEY with write scope. Wallet-session callers (JWT from x402-session) are also supported \u2014 no additional x402 payment required.",
      inputSchema: {
        simulationId: z8.string().describe("ID of the simulation to compare resilience for. Required \u2014 obtain from simulation.create or simulation.list."),
        steps: z8.number().int().min(1).max(120).default(20).optional().describe("Number of simulation steps to replay for both runs (1\u2013120; default 20). More steps = more representative peak metrics."),
        baselineConfig: z8.object({
          enabled: z8.boolean().optional(),
          dependencies: z8.array(z8.record(z8.unknown())).max(64).optional(),
          scheduledFaults: z8.array(z8.record(z8.unknown())).max(32).optional(),
          maxCascadeDepth: z8.number().int().min(1).max(8).optional(),
          maxGeneratedRps: z8.number().positive().max(5e5).optional(),
          maxStepWork: z8.number().int().min(1).max(2048).optional(),
          retryGeneratedTrafficAffectsCost: z8.boolean().optional()
        }).passthrough().optional().describe("Explicit baseline resilience config. When omitted, the simulation's current resilienceConfig is used. Returns 400 when both are absent."),
        mitigatedConfig: z8.object({
          enabled: z8.boolean().optional().default(true),
          dependencies: z8.array(z8.record(z8.unknown())).max(64).optional().describe("Dependency edges for the mitigated run"),
          scheduledFaults: z8.array(z8.record(z8.unknown())).max(32).optional().describe("Scheduled faults for the mitigated run"),
          maxCascadeDepth: z8.number().int().min(1).max(8).optional(),
          maxGeneratedRps: z8.number().positive().max(5e5).optional(),
          maxStepWork: z8.number().int().min(1).max(2048).optional(),
          retryGeneratedTrafficAffectsCost: z8.boolean().optional()
        }).passthrough().describe("Required: the mitigated resilience config to evaluate against the baseline. Typically the same as baselineConfig but with improved settings (e.g. circuitBreaker.enabled: true)."),
        mitigatedResources: z8.array(z8.record(z8.unknown())).max(256).optional().describe("Optional complete resource array for the mitigated run, used to compare capacity or topology changes against the unchanged baseline resources."),
        mitigatedAutoscalingConfig: z8.object({
          scaleOutCpuThreshold: z8.number().optional(),
          scaleInCpuThreshold: z8.number().optional(),
          scaleOutThroughputThreshold: z8.number().optional(),
          scaleInThroughputThreshold: z8.number().optional(),
          scaleOutLatencyThreshold: z8.number().optional(),
          cooldownSeconds: z8.number().optional(),
          minInstances: z8.number().int().positive().optional(),
          maxInstances: z8.number().int().positive().optional()
        }).passthrough().optional().describe("Optional autoscaling override for the mitigated run, enabling a fair comparison of autoscaling corrections from the identical baseline state.")
      },
      outputSchema: z8.object({
        seed: z8.number().optional().describe("RNG seed used for both replay runs"),
        startStep: z8.number().optional().describe("Simulation step at which both runs began"),
        traffic: z8.number().optional().describe("Traffic level (RPS) at the start of the replay window"),
        steps: z8.number().optional().describe("Number of steps replayed"),
        baseline: z8.object({
          peakRetryAmplificationFactor: z8.number().nullable().optional().describe("Peak retry amplification factor in the baseline run"),
          peakErrorRate: z8.number().optional().describe("Peak error rate (%) in the baseline run"),
          peakLatencyP95: z8.number().optional().describe("Peak P95 latency (ms) in the baseline run"),
          totalServedRequests: z8.number().optional().describe("Total served requests across all baseline steps"),
          totalShedRequests: z8.number().optional().describe("Total shed requests across all baseline steps"),
          finalOutcome: z8.string().optional().describe("Incident outcome at the last baseline step: stable | degraded | cascading | protected | recovered"),
          incidentOutcome: z8.object({
            rootTrigger: z8.object({
              faultIds: z8.array(z8.string()),
              faultTypes: z8.array(z8.string()),
              targetResourceIds: z8.array(z8.string()),
              dependencyIds: z8.array(z8.string()),
              firstActiveStep: z8.number().nullable()
            }).describe("Scheduled fault or faults that initiated the replayed incident"),
            retryAmplificationFactor: z8.number().nullable(),
            peakOriginalRps: z8.number(),
            peakAttemptedRps: z8.number(),
            peakErrorRate: z8.number(),
            affectedDependencyIds: z8.array(z8.string()),
            protectiveControlsActivated: z8.array(z8.string()),
            timeToRecoverySteps: z8.number().nullable(),
            cascadeContained: z8.boolean(),
            runMetadata: z8.object({
              seed: z8.number(),
              startStep: z8.number(),
              endStep: z8.number(),
              steps: z8.number(),
              trafficRps: z8.number(),
              configVersion: z8.number(),
              faultIds: z8.array(z8.string())
            }).passthrough()
          }).passthrough().optional().describe("Generic, machine-readable baseline incident result")
        }).passthrough().optional().describe("Baseline run summary"),
        mitigated: z8.object({
          peakRetryAmplificationFactor: z8.number().nullable().optional().describe("Peak retry amplification factor in the mitigated run"),
          peakErrorRate: z8.number().optional().describe("Peak error rate (%) in the mitigated run"),
          peakLatencyP95: z8.number().optional().describe("Peak P95 latency (ms) in the mitigated run"),
          totalServedRequests: z8.number().optional().describe("Total served requests across all mitigated steps"),
          totalShedRequests: z8.number().optional().describe("Total shed requests across all mitigated steps"),
          finalOutcome: z8.string().optional().describe("Incident outcome at the last mitigated step: stable | degraded | cascading | protected | recovered"),
          incidentOutcome: z8.object({
            rootTrigger: z8.object({
              faultIds: z8.array(z8.string()),
              faultTypes: z8.array(z8.string()),
              targetResourceIds: z8.array(z8.string()),
              dependencyIds: z8.array(z8.string()),
              firstActiveStep: z8.number().nullable()
            }).describe("Scheduled fault or faults that initiated the replayed incident"),
            retryAmplificationFactor: z8.number().nullable(),
            peakOriginalRps: z8.number(),
            peakAttemptedRps: z8.number(),
            peakErrorRate: z8.number(),
            affectedDependencyIds: z8.array(z8.string()),
            protectiveControlsActivated: z8.array(z8.string()),
            timeToRecoverySteps: z8.number().nullable(),
            cascadeContained: z8.boolean(),
            runMetadata: z8.object({
              seed: z8.number(),
              startStep: z8.number(),
              endStep: z8.number(),
              steps: z8.number(),
              trafficRps: z8.number(),
              configVersion: z8.number(),
              faultIds: z8.array(z8.string())
            }).passthrough()
          }).passthrough().optional().describe("Generic, machine-readable mitigated incident result")
        }).passthrough().optional().describe("Mitigated run summary"),
        delta: z8.object({
          retryAmplificationFactor: z8.number().nullable().optional().describe("Change in peak retry amplification (mitigated \u2212 baseline). Negative = improvement."),
          errorRate: z8.number().optional().describe("Change in peak error rate in pp (mitigated \u2212 baseline). Negative = fewer errors."),
          latencyP95: z8.number().optional().describe("Change in peak P95 latency in ms (mitigated \u2212 baseline). Negative = lower latency."),
          shedRequests: z8.number().optional().describe("Change in total shed requests (mitigated \u2212 baseline). Negative = fewer shed requests.")
        }).passthrough().optional().describe("Difference (mitigated \u2212 baseline). Negative values indicate improvement.")
      }).passthrough().describe("Side-by-side resilience comparison result. Inspect each run's incidentOutcome for diagnosis and containment, then use delta.retryAmplificationFactor and delta.errorRate as headline differences."),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) => {
      try {
        const { simulationId, ...body } = args;
        const result = await ctx.apiCall(
          "POST",
          `/api/simulations/${simulationId}/resilience/compare`,
          body,
          true
        );
        return structuredResult(result);
      } catch (err) {
        return errorResult(err.message);
      }
    }
  );
}
var compactFailureTelemetrySchema = {
  failureLifecycle: z8.enum(["quick_injection_parked", "quick_injection_rejoined", "instance_down", "instance_kill"]).optional().describe("Read-only failure lifecycle marker when the backend identifies a quick injection or typed instance failure"),
  routingState: z8.enum(["unavailable", "serving"]).optional().describe("Read-only current routing state for a resource with failure lifecycle telemetry")
};
var seededEksFieldProvenanceSchema = z8.discriminatedUnion("kind", [
  z8.object({ kind: z8.literal("recorded") }).strict(),
  z8.object({
    kind: z8.literal("derived"),
    sourceFields: z8.array(z8.string().min(1)).min(1)
  }).strict(),
  z8.object({
    kind: z8.literal("unavailable"),
    reason: z8.string().min(1)
  }).strict()
]);
var seededEksEvaluationReasonSchema = z8.object({
  code: z8.enum([
    "no_reschedule",
    "scheduling_capacity_exhausted",
    "image_pull_incomplete",
    "startup_incomplete",
    "unclassified_runtime_work_remaining"
  ]),
  workloadCount: z8.number().int().nonnegative(),
  pendingWorkloadCount: z8.number().int().nonnegative(),
  pullingWorkloadCount: z8.number().int().nonnegative(),
  startingWorkloadCount: z8.number().int().nonnegative(),
  residualPullSeconds: z8.number().nonnegative(),
  residualStartupSeconds: z8.number().nonnegative(),
  schedulingCapacity: z8.number().int().nonnegative(),
  interruptionHandling: z8.enum(["reschedule", "drain-only", "fail-fast"]),
  provenance: z8.literal("recorded")
}).strict();
var seededEksMigrationEvaluationSchema = z8.object({
  status: z8.enum(["not_started", "in_progress", "completed"]),
  interruptionNoticeAtSimulationSeconds: z8.number().nonnegative().nullable(),
  deadlineAtSimulationSeconds: z8.number().nonnegative().nullable(),
  migrationStartedAtSimulationSeconds: z8.number().nonnegative().nullable(),
  allAffectedWorkloadsReadyAtSimulationSeconds: z8.number().nonnegative().nullable(),
  migrationDurationSeconds: z8.number().nonnegative().nullable(),
  deadlineSeconds: z8.literal(120),
  deadlineMet: z8.boolean().nullable(),
  affectedWorkloadCount: z8.number().int().nonnegative().nullable(),
  readyWorkloadCountAtDeadline: z8.number().int().nonnegative().nullable(),
  missedDeadlineWorkloadCount: z8.number().int().nonnegative().nullable(),
  evaluatedAtSimulationSeconds: z8.number().nonnegative().nullable(),
  limitingReasons: z8.array(seededEksEvaluationReasonSchema).max(5),
  fieldProvenance: z8.object({
    status: seededEksFieldProvenanceSchema,
    interruptionNoticeAtSimulationSeconds: seededEksFieldProvenanceSchema,
    deadlineAtSimulationSeconds: seededEksFieldProvenanceSchema,
    migrationStartedAtSimulationSeconds: seededEksFieldProvenanceSchema,
    allAffectedWorkloadsReadyAtSimulationSeconds: seededEksFieldProvenanceSchema,
    migrationDurationSeconds: seededEksFieldProvenanceSchema,
    deadlineSeconds: seededEksFieldProvenanceSchema,
    deadlineMet: seededEksFieldProvenanceSchema,
    affectedWorkloadCount: seededEksFieldProvenanceSchema,
    readyWorkloadCountAtDeadline: seededEksFieldProvenanceSchema,
    missedDeadlineWorkloadCount: seededEksFieldProvenanceSchema,
    evaluatedAtSimulationSeconds: seededEksFieldProvenanceSchema,
    limitingReasons: seededEksFieldProvenanceSchema
  }).strict()
}).strict().describe(
  "Authoritative additive seeded EKS interruption evaluation. Field values carry recorded/derived/unavailable provenance; deadline verdict/counts/reasons are frozen once status is completed and do not describe later service health."
);
var seededEksInterruptionCheckpointEvidenceSchema = z8.object({
  engineInputStepIndex: z8.number().int().nonnegative(),
  simulationSeconds: z8.number().nonnegative(),
  tickDurationSeconds: z8.number().positive(),
  pointRateSemantics: z8.literal("post_step_point_rate"),
  intervalAttribution: goodputIntervalAttributionSchema.nullable(),
  fieldProvenance: z8.object({
    engineInputStepIndex: seededEksFieldProvenanceSchema,
    simulationSeconds: seededEksFieldProvenanceSchema,
    tickDurationSeconds: seededEksFieldProvenanceSchema,
    pointRateSemantics: seededEksFieldProvenanceSchema,
    intervalAttribution: seededEksFieldProvenanceSchema
  }).strict(),
  trafficFieldProvenance: z8.object({
    throughputRps: seededEksFieldProvenanceSchema,
    offeredRps: seededEksFieldProvenanceSchema,
    errorRatePercent: seededEksFieldProvenanceSchema,
    latencyP50Ms: seededEksFieldProvenanceSchema
  }).strict()
}).strict().describe(
  "Persisted seeded-EKS checkpoint captured with its interruption JSONB record. engineInputStepIndex is an engine input-step index, simulationSeconds is derived from that index and the recorded tick, and traffic provenance points to outer metric fields rather than duplicating float values."
);
var seededEksInterruptionTelemetrySchema = z8.object({
  resourceId: z8.string().optional(),
  name: z8.string().optional(),
  migrationEvaluation: seededEksMigrationEvaluationSchema.optional(),
  checkpointEvidence: seededEksInterruptionCheckpointEvidenceSchema.optional()
}).passthrough();
var replayIdentitySchema = z8.object({
  scenarioHash: z8.string().length(64).describe("Canonical SHA-256 of the persisted scenario graph and attached traffic-pattern order"),
  effectiveConfigHash: z8.string().length(64).describe("Original replay-only SHA-256 of the effective six-control startup configuration; top-level effectiveConfigHash is the versioned prediction identity.")
}).strict();
var calibrationEvidenceOutputSchema = z8.object({
  kind: z8.enum(["owned", "owned-scaled", "modeled"]).describe("owned for the exact AWS CRUD fit; owned-scaled when derived from that fit outside its exact fleet size; modeled when the gate fails or another generic model applies."),
  latencyBasis: z8.string().describe("General modeled latency path, such as in-VPC ALB rather than end-to-end; see latencyP99Basis for percentile-specific P99 provenance."),
  latencyP99Basis: z8.string().optional().describe("Percentile-specific P99 basis: owned in-VPC internal-ALB fit, scaled from that fit (not directly measured), or uncalibrated generic model."),
  calibrationId: z8.string().optional().describe("Versioned owned calibration identifier; present only when that calibration applies."),
  note: z8.string().describe("Names the fit scope and limitations. For canonical workload inference, states it is a modeling assumption. For modeled fallback, names all actual failed checks in stable order with resource IDs and safe expected/actual values; never only a generic 'not applied'.")
}).strict();
var auroraFailoverOutputSchema = z8.object({
  failedResourceId: z8.string(),
  standbyResourceId: z8.string(),
  succeeded: z8.boolean(),
  phase: z8.enum(["promoting", "serving", "unavailable"])
});
var poolSaturationDetailOutputSchema = z8.object({
  resourceId: z8.string().describe("Database resource ID whose modeled demand exceeds its usable limit."),
  name: z8.string().describe("Human-readable database resource name."),
  cause: z8.literal("connection_limit_exceeded").optional().describe("Why this database's modeled connection demand exceeded its usable pool limit."),
  modeledConnections: z8.number().nonnegative().describe("Modeled demand/assumption, not observed live sessions."),
  usableConnectionLimit: z8.number().nonnegative().describe("This database's effective usable connection limit."),
  demandBasis: z8.literal("modeled connection demand; not observed live sessions")
}).strict();
var databasePressureDetailOutputSchema = z8.object({
  resourceId: z8.string().describe("Database resource ID contributing to modeled under-limit connection pressure."),
  name: z8.string().describe("Human-readable database resource name."),
  cause: z8.enum([
    "connection_pressure",
    "cpu_pressure",
    "connection_and_cpu_pressure",
    "provider_reference_fit"
  ]).describe("Modeled source of this database's under-limit pressure contribution."),
  modeledConnections: z8.number().nonnegative(),
  usableConnectionLimit: z8.number().nonnegative(),
  connectionUtilization: z8.number().nonnegative(),
  cpuUtilization: z8.number().nonnegative(),
  contributionPct: z8.number().nonnegative()
}).strict();
var errorBreakdownOutputSchema = z8.object({
  databasePressure: z8.number().optional(),
  benchmarkReferenceFit: z8.number().optional(),
  databasePressureDetails: z8.array(databasePressureDetailOutputSchema).optional().describe("Per-database causes contributing to pressure below the usable connection limit."),
  poolSaturation: z8.number(),
  poolSaturationDetails: z8.array(poolSaturationDetailOutputSchema).optional().describe("Per-database pool exhaustion details, including the cause when available. Modeled demand is not observed live sessions."),
  dbFailure: z8.number(),
  computeFailure: z8.number(),
  capacityOverload: z8.number(),
  cpuOverload: z8.number(),
  ociStorage: z8.number(),
  queueAbsorption: z8.number(),
  dependencyFailure: z8.number().optional(),
  runtimeMemory: z8.number().optional(),
  startupBackpressure: z8.number().optional(),
  sessionAffinity: z8.number().optional()
});
var resilienceCapacityAttributionOutputSchema = z8.object({
  resourceId: z8.string().describe("Logical resource ID used by one or more resilience dependency paths"),
  role: z8.enum(["source", "target", "source_and_target"]).describe("Whether this resource is a dependency source, target, or both"),
  routableCapacityRps: z8.number().finite().nonnegative().nullable().describe("Aggregate capacity available to this logical resource after modeled warm-up and member health; null means no finite capacity ceiling is known"),
  nominalCapacityRps: z8.number().finite().nonnegative().nullable().optional().describe("Aggregate capacity before warm-up and member-health reductions; null means no finite capacity ceiling is known"),
  warmupCapacityLossRps: z8.number().finite().nonnegative().nullable().optional().describe("Aggregate capacity lost because fleet members are still warming up; zero means no modeled warm-up loss"),
  healthCapacityLossRps: z8.number().finite().nonnegative().nullable().optional().describe("Aggregate capacity lost because members are unavailable or degraded; zero means no modeled member-health loss")
});
var stepOutputSchema = z8.object({
  simulationId: z8.string().optional().describe("ID of the stepped simulation"),
  scenarioHash: z8.string().length(64).optional().describe("Canonical SHA-256 of the persisted scenario graph and attached traffic-pattern order"),
  effectiveConfigHash: z8.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity; see replayIdentity.effectiveConfigHash for the original replay-only hash."),
  predictionEffectiveConfigHash: z8.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
  engineVersion: z8.string().optional().describe("Simulation engine version used for this prediction."),
  calibrationEvidence: calibrationEvidenceOutputSchema.optional().describe("Owned-versus-modeled evidence and latency boundary."),
  predictionEvidence: storedPredictionEvidenceSchema.optional(),
  appWeight: z8.enum(["lean", "typical", "heavy"]).optional(),
  appWeightDefaulted: z8.boolean().optional(),
  replayIdentity: replayIdentitySchema.optional(),
  currentStep: z8.number().optional().describe("New simulation time step index"),
  traffic: z8.number().optional().describe("Current traffic level in RPS"),
  latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
  latencyP50: z8.number().nullable().optional().describe("50th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
  latencyP95: z8.number().nullable().optional().describe("95th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
  latencyP99: z8.number().nullable().optional().describe("Modeled 99th-percentile latency in ms; null when workload-specific latency evidence is unavailable. Interpret with latencyP99Basis and predictionEvidence.latencyP99."),
  latencyP99Basis: z8.string().optional().describe("Percentile-specific P99 basis: owned fit, scaled-from-fit (not directly measured), or uncalibrated generic model."),
  latencyBasis: z8.string().optional().describe("General modeled latency path/boundary; see latencyP99Basis for P99-specific provenance."),
  errorRate: z8.number().optional().describe("Client-level error rate (%) against original offered RPS. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; non-autoscaled targets use their resolved resource capacity, including any declared fixed-instance count."),
  throughput: z8.number().optional().describe("Effective requests per second"),
  goodputRps: z8.number().optional().describe("Modeled client-level successful requests per second; a post-step point rate sourced from metrics.throughput. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; non-autoscaled targets use their resolved resource capacity, including any declared fixed-instance count."),
  goodputSemantics: z8.literal("post_step_point_rate").optional().describe("Goodput is a point rate, not an interval total"),
  goodputProvenance: seededEksFieldProvenanceSchema.optional().describe("Provenance for the modeled goodput field"),
  goodputWindow: goodputWindowSchema.optional().describe(
    "Interval goodput aggregate when every point has persisted simulation-clock bounds; otherwise status=unavailable. Never derive this from retrieval time or currentStep."
  ),
  offeredRps: z8.number().optional().describe("Aggregate offered requests per second represented by metrics.offeredRps provenance"),
  modeledShedRps: z8.number().optional().describe("Aggregate modeled requests per second shed by bounded capacity"),
  costPerHour: z8.number().optional().describe("Estimated cost in USD/hr"),
  residualCostPerHour: z8.number().optional().describe("Subtotal of unavailable, parked, or stopped resource costs; healthy/degraded idle resources, including ALBs, are excluded."),
  residualCostDefinition: z8.string().optional().describe("Definition of residual cost; total cost remains the complete billed total."),
  requestServing: z8.array(z8.object({
    resourceId: z8.string(),
    activeInstances: z8.number().int().nonnegative(),
    desiredTaskCount: z8.number().int().nonnegative().optional(),
    provisionedInstances: z8.number().int().nonnegative().optional(),
    drainingTasks: z8.number().int().nonnegative().optional().describe("Excess running Fargate tasks still serving and billing during scale-down."),
    aggregateCapacityRps: z8.number().nonnegative().optional().describe("Capacity includes active tasks, including tasks draining during scale-down."),
    scalingState: z8.string()
  }).passthrough()).optional(),
  metricId: z8.string().optional().describe("Storage-assigned persisted metric ID when available"),
  loadBalancers: z8.array(
    z8.object({
      resourceId: z8.string().optional().describe("ID of the load balancer"),
      routedRps: z8.number().optional().describe("Requests per second routed through this load balancer this step")
    }).passthrough()
  ).optional().describe("Per-load-balancer routed traffic, including CDN-origin-matched ALB RPS for comparison with cdnFlow.originRps"),
  eksSpotInterruptions: z8.array(seededEksInterruptionTelemetrySchema).optional().describe("Seeded EKS interruption telemetry, including the authoritative additive migrationEvaluation when recorded."),
  metrics: z8.object({
    latencyP50: z8.number().nullable().optional().describe("50th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
    latencyP95: z8.number().nullable().optional().describe("95th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
    latencyP99: z8.number().nullable().optional().describe("Modeled 99th-percentile latency in ms; null when workload-specific latency evidence is unavailable. Interpret with this metric's latencyP99Basis and predictionEvidence.latencyP99."),
    latencyP99Basis: z8.string().optional().describe("Percentile-specific P99 basis for this metric checkpoint."),
    latencyBasis: z8.string().optional().describe("General modeled latency path/boundary; see latencyP99Basis for P99-specific provenance."),
    eksSpotInterruptions: z8.array(seededEksInterruptionTelemetrySchema).optional(),
    errorBreakdown: errorBreakdownOutputSchema.optional().describe("Full-mode error contributors, including cause-attributed pool-saturation details.")
  }).passthrough().optional().describe("Full-mode backend metric record; migrationEvaluation is exact-typed when a seeded interruption is present."),
  resources: z8.array(
    z8.object({
      id: z8.string().optional().describe("Resource ID"),
      name: z8.string().optional().describe("Resource display name"),
      status: z8.string().optional().describe("Health status (healthy/warning/critical/failed)"),
      cpuPercent: z8.number().optional().describe("CPU utilization (%)"),
      routedRps: z8.number().optional().describe("Requests per second routed to this resource this step (compute/kubernetes only)"),
      availabilityState: z8.enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"]).optional().describe("Availability derived from lifecycle and routed traffic: available = serving normally, degraded = critical/warning but still serving, unavailable = failed/parked, scaled_to_zero and cold_start = Fargate no-task states"),
      isRoutable: z8.boolean().optional().describe("Whether this compute/Kubernetes resource can receive traffic in this step; false distinguishes a failed/parked node from a critical node still serving"),
      recoveryBlockedReason: z8.string().optional().describe("Engine recovery guard currently preventing cooldown progress, when present (for example failure_park_window or idle_cpu_floor)"),
      recoveryProgress: z8.object({
        state: z8.enum(["parked", "blocked", "cooling_down", "healthy"]),
        parkWindow: z8.object({
          totalSteps: z8.number(),
          completedSteps: z8.number(),
          remainingSteps: z8.number()
        }),
        cooldown: z8.object({
          target: z8.enum(["warning", "healthy"]).nullable(),
          completedSteps: z8.number(),
          requiredSteps: z8.number(),
          remainingSteps: z8.number()
        })
      }).optional().describe("Read-only recovery progress; poll simulation.step until state is healthy, then use simulation.metrics to inspect the result"),
      ...compactFailureTelemetrySchema
    }).passthrough()
  ).optional().describe("Per-resource status summary (compact mode)"),
  events: z8.array(z8.object({
    type: z8.string().min(1).describe("Canonical event type")
  }).passthrough()).optional().describe("Events generated during this step; every event has a non-empty canonical type"),
  kubernetesCpuHpa: z8.array(kubernetesCpuHpaTelemetrySchema).optional().describe(
    "Per-workload CPU request, observed millicores per pod, target calculations, bounded replica recommendation, scale-down stabilization, and provenance/errors. Utilization without a CPU request has no recommendation; this is not Kubernetes controller parity."
  ),
  errorBreakdown: errorBreakdownOutputSchema.optional().describe("Validated additive error contributors in percentage-point units; separates database connection pressure below the usable pool limit from pool saturation after exhaustion, plus DB, compute, capacity, CPU, storage, runtime-memory, and queue absorption effects"),
  auroraFailovers: z8.array(auroraFailoverOutputSchema).optional().describe("Compact per-writer Aurora failover state; promoting has no serving writer, serving means the explicitly related standby took over."),
  // GPU / inference metrics — present only when the simulation has a GPU
  // kubernetes resource with inferenceMode: true; absent otherwise.
  gpuUtilization: z8.number().optional().describe("GPU utilization (%) \u2014 present only on simulations with a GPU inference kubernetes resource"),
  tokensPerSecond: z8.number().optional().describe("Inference throughput in tokens/second \u2014 present only on GPU inference simulations"),
  costPerMillionTokens: z8.number().nullable().optional().describe("Self-hosted inference cost in USD per million tokens (null when no tokens are being processed) \u2014 present only on GPU inference simulations"),
  idleGpuCostPerHour: z8.number().optional().describe("USD/hr of GPU spend funding idle/standby capacity (HA overhead) \u2014 present only on GPU inference simulations"),
  idleGpuFraction: z8.number().optional().describe("Share (0-1) of the GPU bill that is idle/standby capacity \u2014 present only on GPU inference simulations; values above 0.5 mean over half the GPU spend is HA overhead"),
  // Resilience telemetry — present only when resilienceConfig.enabled is true.
  retryAmplificationFactor: z8.number().nullable().optional().describe("(Original offered RPS + generated retry RPS) / original offered RPS; an amplification measure, not capacity or goodput. Values > 1.0 = amplification risk. null = model ran but no traffic. Absent = resilience model disabled."),
  externalMetrics: externalMetricsTelemetrySchema.optional().describe(
    "Latest deterministic external-metric recommendation telemetry, including each trigger's sample status/outcome/value/desired capacity and the combined capacity decision. It never actuates simulated or provider resources."
  ),
  resilienceDiagnostics: z8.object({
    incidentOutcome: z8.string().optional().describe("Incident outcome: stable | degraded | cascading | protected | recovered"),
    pathCount: z8.number().optional().describe("Number of dependency paths evaluated this step"),
    bounded: z8.boolean().optional().describe("True when a generated-traffic, traversal-work, or cascade-depth bound truncated model work"),
    capacityByResource: z8.array(resilienceCapacityAttributionOutputSchema).optional().describe("Unique logical dependency resources; each appears once even when several paths reference it. When values are finite, nominalCapacityRps minus warmupCapacityLossRps (members still warming) and healthCapacityLossRps (unavailable or degraded members) equals routableCapacityRps, within rounding.")
  }).passthrough().optional().describe("Bounded resilience diagnostics summary (compact mode). Absent when the resilience model did not run. Use simulation.compare_resilience for full per-path detail.")
}).passthrough().describe(
  "Compact step summary by default (principal metrics + per-resource status). With responseMode 'full', the complete backend step response (simulation, metrics, events) is passed through instead."
);
var metricsOutputSchema = z8.object({
  simulationId: z8.string().optional().describe("ID of the queried simulation"),
  scenarioHash: z8.string().length(64).optional().describe("Canonical replay scenario graph hash."),
  effectiveConfigHash: z8.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
  replayIdentity: replayIdentitySchema.optional(),
  engineVersion: z8.string().optional().describe("Simulation engine version used for this prediction."),
  predictionEffectiveConfigHash: z8.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
  calibrationEvidence: calibrationEvidenceOutputSchema.optional().describe("Owned-versus-modeled evidence and latency boundary."),
  predictionEvidence: storedPredictionEvidenceSchema.optional(),
  appWeight: z8.enum(["lean", "typical", "heavy"]).optional(),
  appWeightDefaulted: z8.boolean().optional(),
  currentStep: z8.number().optional().describe("Current simulation time step"),
  traffic: z8.number().optional().describe("Current traffic level in RPS"),
  latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
  latencyP50: z8.number().nullable().optional().describe("Latest 50th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
  latencyP95: z8.number().nullable().optional().describe("Latest 95th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
  latencyP99: z8.number().nullable().optional().describe("Latest modeled 99th-percentile latency in ms; null when workload-specific latency evidence is unavailable. Interpret with latencyP99Basis and predictionEvidence.latencyP99."),
  latencyP99Basis: z8.string().optional().describe("Latest percentile-specific P99 basis: owned fit, scaled-from-fit (not directly measured), or uncalibrated generic model."),
  latencyBasis: z8.string().optional().describe("Latest general modeled latency path/boundary; see latencyP99Basis for P99-specific provenance."),
  errorRate: z8.number().optional().describe("Latest client-level error rate (%) against original offered RPS. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; non-autoscaled targets use their resolved resource capacity, including any declared fixed-instance count."),
  throughput: z8.number().optional().describe("Latest effective requests per second"),
  goodputRps: z8.number().optional().describe("Modeled client-level successful requests per second; a post-step point rate sourced from metrics.throughput. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; non-autoscaled targets use their resolved resource capacity, including any declared fixed-instance count."),
  goodputSemantics: z8.literal("post_step_point_rate").optional().describe("Goodput is a point rate, not an interval total"),
  goodputProvenance: seededEksFieldProvenanceSchema.optional().describe("Provenance for the modeled goodput field"),
  goodputWindow: goodputWindowSchema.optional().describe(
    "Interval goodput aggregate when every point has persisted simulation-clock bounds; otherwise status=unavailable. Never derive this from retrieval time or currentStep."
  ),
  offeredRps: z8.number().optional().describe("Latest aggregate offered requests per second"),
  modeledShedRps: z8.number().optional().describe("Latest aggregate modeled shed requests per second"),
  costPerHour: z8.number().optional().describe("Latest estimated cost in USD/hr"),
  residualCostPerHour: z8.number().optional().describe("Subtotal of unavailable, parked, or stopped resource costs; healthy/degraded idle resources, including ALBs, are excluded."),
  residualCostDefinition: z8.string().optional().describe("Definition of residual cost; total cost remains the complete billed total."),
  metricId: z8.string().optional().describe("Storage-assigned ID of the latest persisted metric"),
  kubernetesCpuHpa: z8.array(kubernetesCpuHpaTelemetrySchema).optional().describe(
    "Latest per-workload bounded CPU HPA telemetry, including input provenance and missing-request errors; no Kubernetes controller parity is claimed."
  ),
  eksSpotInterruptions: z8.array(seededEksInterruptionTelemetrySchema).optional().describe("Latest seeded EKS interruption telemetry, including additive migrationEvaluation/provenance when recorded."),
  resources: z8.array(
    z8.object({
      id: z8.string().optional().describe("Resource ID"),
      name: z8.string().optional().describe("Resource display name"),
      status: z8.string().optional().describe("Health status (healthy/warning/critical/failed)"),
      cpuPercent: z8.number().optional().describe("CPU utilization (%)"),
      routedRps: z8.number().optional().describe("Requests per second routed to this resource (compute/kubernetes only)"),
      availabilityState: z8.enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"]).optional().describe("Availability derived from lifecycle and routed traffic: available = serving normally, degraded = critical/warning but still serving, unavailable = failed/parked, scaled_to_zero and cold_start = Fargate no-task states"),
      isRoutable: z8.boolean().optional().describe("Whether this compute/Kubernetes resource can receive traffic in this step; false distinguishes a failed/parked node from a critical node still serving"),
      recoveryBlockedReason: z8.string().optional().describe("Engine recovery guard currently preventing cooldown progress, when present (for example failure_park_window or idle_cpu_floor)"),
      recoveryProgress: z8.object({
        state: z8.enum(["parked", "blocked", "cooling_down", "healthy"]),
        parkWindow: z8.object({
          totalSteps: z8.number(),
          completedSteps: z8.number(),
          remainingSteps: z8.number()
        }),
        cooldown: z8.object({
          target: z8.enum(["warning", "healthy"]).nullable(),
          completedSteps: z8.number(),
          requiredSteps: z8.number(),
          remainingSteps: z8.number()
        })
      }).optional().describe("Read-only recovery progress; poll simulation.step until state is healthy, then use simulation.metrics to inspect the result"),
      ...compactFailureTelemetrySchema
    }).passthrough()
  ).optional().describe("Per-resource status summary (compact mode)"),
  errorBreakdown: errorBreakdownOutputSchema.optional().describe("Validated additive error contributors from the latest metrics entry, in percentage-point units; distinguishes database connection pressure below the usable limit from pool saturation after exhaustion"),
  auroraFailovers: z8.array(auroraFailoverOutputSchema).optional().describe("Latest compact per-writer Aurora failover state, with failed and standby IDs and phase."),
  metricsHistoryLength: z8.number().optional().describe(`Total number of metrics-history entries (compact mode returns only the last ${METRICS_HISTORY_TAIL})`),
  // GPU / inference metrics at the top level — present only when the simulation
  // has a GPU kubernetes resource with inferenceMode: true; absent otherwise.
  gpuUtilization: z8.number().optional().describe("Latest GPU utilization (%) \u2014 present only on GPU inference simulations"),
  tokensPerSecond: z8.number().optional().describe("Latest inference throughput in tokens/second \u2014 present only on GPU inference simulations"),
  costPerMillionTokens: z8.number().nullable().optional().describe("Latest self-hosted inference cost in USD per million tokens (null when no tokens are being processed) \u2014 present only on GPU inference simulations"),
  idleGpuCostPerHour: z8.number().optional().describe("Latest USD/hr of GPU spend funding idle/standby capacity (HA overhead) \u2014 present only on GPU inference simulations"),
  idleGpuFraction: z8.number().optional().describe("Latest share (0-1) of the GPU bill that is idle/standby capacity \u2014 present only on GPU inference simulations"),
  // Resilience telemetry from the latest step — present only when the resilience model ran.
  retryAmplificationFactor: z8.number().nullable().optional().describe("Latest (original offered RPS + generated retry RPS) / original offered RPS; an amplification measure, not capacity or goodput. Values > 1.0 = amplification risk. null = model ran but no traffic. Absent = resilience model disabled."),
  externalMetrics: externalMetricsTelemetrySchema.optional().describe(
    "Latest deterministic external-metric recommendation telemetry, including each trigger's sample status/outcome/value/desired capacity and the combined capacity decision. It never actuates simulated or provider resources."
  ),
  resilienceDiagnostics: z8.object({
    incidentOutcome: z8.string().optional().describe("Latest incident outcome: stable | degraded | cascading | protected | recovered"),
    pathCount: z8.number().optional().describe("Number of dependency paths evaluated in the latest step"),
    bounded: z8.boolean().optional().describe("True when a generated-traffic, traversal-work, or cascade-depth bound truncated model work"),
    capacityByResource: z8.array(resilienceCapacityAttributionOutputSchema).optional().describe("Unique logical dependency resources in the latest step; each appears once even when several paths reference it. When values are finite, nominalCapacityRps minus warmupCapacityLossRps (members still warming) and healthCapacityLossRps (unavailable or degraded members) equals routableCapacityRps, within rounding.")
  }).passthrough().optional().describe("Bounded resilience diagnostics from the latest step (compact mode). Absent when the resilience model did not run."),
  metrics: z8.array(
    z8.object({
      metricId: z8.string().optional().describe("Storage-assigned persisted metric ID, when this history entry was stored"),
      latencyAvailability: predictionLatencyAvailabilitySchema.optional(),
      latencyP50: z8.number().nullable().optional().describe("Median latency in ms; null when workload-specific latency evidence is unavailable."),
      latencyP95: z8.number().nullable().optional().describe("95th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
      latencyP99: z8.number().nullable().optional().describe("Modeled 99th-percentile latency in ms; null when workload-specific latency evidence is unavailable."),
      latencyP99Basis: z8.string().optional().describe("Percentile-specific P99 basis for this history record."),
      latencyBasis: z8.string().optional().describe("General modeled latency path/boundary; see latencyP99Basis for P99-specific provenance."),
      cpuUsage: z8.number().optional().describe("CPU utilization (%)"),
      throughput: z8.number().optional().describe("Effective RPS"),
      errorRate: z8.number().optional().describe("Client-level error rate (%) against original offered RPS. Resilience dependency targets in autoscaled compute fleets use aggregate routable-fleet capacity and health; standalone targets count once."),
      costPerHour: z8.number().optional().describe("Estimated cost in USD/hr"),
      eksSpotInterruptions: z8.array(seededEksInterruptionTelemetrySchema).optional(),
      // GPU / inference fields in history entries — present only on GPU inference simulations.
      gpuUtilization: z8.number().optional().describe("GPU utilization (%) for this step \u2014 present only on GPU inference simulations"),
      tokensPerSecond: z8.number().optional().describe("Inference throughput in tokens/second for this step \u2014 present only on GPU inference simulations"),
      costPerMillionTokens: z8.number().nullable().optional().describe("Self-hosted inference cost in USD per million tokens for this step \u2014 present only on GPU inference simulations"),
      errorBreakdown: errorBreakdownOutputSchema.optional().describe("Validated additive error contributors for this history entry"),
      // Resilience fields in history entries — present only when the resilience model ran for that step.
      retryAmplificationFactor: z8.number().nullable().optional().describe("Per-step (original offered RPS + generated retry RPS) / original offered RPS \u2014 present only when resilience is enabled; an amplification measure, not capacity or goodput."),
      resilience: z8.object({
        externalMetrics: externalMetricsTelemetrySchema.optional()
      }).passthrough().optional().describe("Per-step resilience telemetry, including external-metric trigger outcomes when configured.")
    }).passthrough()
  ).optional().describe(`Metrics history \u2014 bounded to the last ${METRICS_HISTORY_TAIL} entries in compact mode, full history in full mode`),
  simulation: z8.object({
    id: z8.string().optional().describe("Simulation ID"),
    name: z8.string().optional().describe("Simulation name"),
    currentTime: z8.number().optional().describe("Current time step"),
    traffic: z8.number().optional().describe("Current RPS"),
    resources: z8.array(z8.record(z8.unknown())).optional().describe("Resource states with health and status")
  }).passthrough().optional().describe("Complete simulation state (full mode only; absent in compact mode and when status is not_found/access_denied)")
}).passthrough().describe(
  "Compact metrics summary by default (principal current metrics, per-resource status, bounded history tail). With responseMode 'full', the complete simulation object and full metrics history are passed through instead."
);
var METRICS_RESPONSE_MODE_DESCRIBE = `Response detail level. 'compact' (default) returns principal current metrics, errorBreakdown when available, per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, recoveryBlockedReason, and failureLifecycle/routingState when provided), and only the last ${METRICS_HISTORY_TAIL} metrics-history entries \u2014 keeps polling cheap for agent loops. 'full' returns the complete simulation object (all resource characteristics and connections) plus the entire metrics history.`;
var normalizedConfigSchema = z8.object({
  resources: z8.array(
    z8.object({
      id: z8.string().optional().describe("Resource ID"),
      name: z8.string().optional().describe("Resource display name"),
      type: z8.string().optional().describe("Resource type (compute, database, kubernetes, \u2026)"),
      provider: z8.string().optional().describe("Cloud provider"),
      // Multiplier-billed resources (compute, database, network, cache, queue, storage).
      resolvedCostMultiplier: z8.number().optional().describe("Effective cost multiplier the engine applies to the base provider rate for this resource"),
      resolvedHourlyRate: z8.number().optional().describe("Resolved hourly billing rate in USD/hr (base rate \xD7 multiplier)"),
      rateProvenance: z8.object({
        basis: z8.enum(["on-demand", "spot", "estimated"]).describe("Pricing basis: published on-demand list price, spot, or a flat estimate"),
        resolution: z8.enum(RATE_PROVENANCE_RESOLUTIONS).describe("Which lookup path resolved the rate"),
        lastVerified: z8.string().nullable().describe("ISO-8601 date the constant was last cross-checked against the provider's pricing page; null when unknown"),
        region: z8.string().nullable().describe("Region the verified rate applies to; null for region-uniform pricing"),
        sku: z8.string().optional().describe("Exact catalog SKU used for this rate, when available"),
        source: z8.string().optional().describe("Official pricing source URL, when verified"),
        architecture: z8.string().optional().describe("Fargate task architecture when architecture-specific billing applies")
      }).optional().describe(
        "Trust metadata for the resolved rate: pricing basis (on-demand/spot/estimated), lookup path, and the date the constant was last verified against the provider's public pricing page. Present on compute, database, and GPU inference resources; absent on resource types where no rate is resolved."
      ),
      // Capacity.
      resolvedMaxThroughputRps: z8.number().optional().describe("Per-node RPS ceiling the engine uses for load and autoscale calculations"),
      requestServing: z8.object({
        serviceFamily: z8.string().optional(),
        desiredTaskCount: z8.number().int().nonnegative().optional(),
        minTaskCount: z8.number().int().nonnegative().optional(),
        maxTaskCount: z8.number().int().positive().optional(),
        perTaskCapacityRps: z8.number().positive().optional(),
        perTaskCapacityEvidence: z8.object({
          basis: z8.enum(["assumption", "documented", "measured", "catalog"]),
          origin: z8.enum(["caller-provided", "fargate-size-heuristic", "policy-default", "provider-catalog"]),
          source: z8.string().optional()
        }).optional(),
        aggregateCapacityRps: z8.number().nonnegative().optional(),
        maxAggregateCapacityRps: z8.number().nonnegative().optional()
      }).passthrough().optional().describe(
        "Resolved request-serving settings. For Fargate, aggregateCapacityRps is desiredTaskCount \xD7 this service's own rate, maxAggregateCapacityRps uses maxTaskCount, and perTaskCapacityEvidence distinguishes assumptions from caller-asserted documentation/measurement or provider catalog data."
      ),
      capacityProvenance: z8.enum(["absent", "capacityRps", "explicit_maxThroughput", "explicit_requestsPerSecond", "provider_catalog", "generic_fallback"]).optional().describe("Source of the effective compute capacity: explicit caller field, provider catalog, or generic fallback"),
      effectiveCpuCapacityRps: z8.number().optional().describe("CPU-curve denominator after applying the provider threshold to explicit capacityRps"),
      // Kubernetes single-pool fields.
      nodeCount: z8.number().optional().describe("Current node count"),
      minNodes: z8.number().optional().describe("Autoscale floor (scale-in stops here)"),
      maxNodes: z8.number().optional().describe("Autoscale ceiling (scale-out stops here)"),
      perNodeRatePerHour: z8.number().optional().describe("Per-node billing rate in USD/hr"),
      controlPlaneFeePerHour: z8.number().optional().describe("Cost-only cluster management fee in USD/hr; it does not represent control-plane CPU, throttling, or recovery telemetry"),
      spotFactor: z8.number().optional().describe("Spot-instance discount factor applied to the node cost (absent = 1, i.e. no discount)"),
      currentNodesCostPerHour: z8.number().optional().describe("Total cluster cost at the current node count (control plane + nodes \xD7 rate) \xD7 spotFactor in USD/hr"),
      billingFloorNodes: z8.number().optional().describe("Minimum node count the engine will ever bill \u2014 scale-in cannot go below this"),
      billingFloorCostPerHour: z8.number().optional().describe("Minimum cluster cost in USD/hr (cost at billingFloorNodes)"),
      autoscaleThreshold: z8.object({
        scaleOutCpuPercent: z8.number().describe("CPU % that triggers a scale-out event"),
        scaleInCpuPercent: z8.number().describe("CPU % below which a scale-in event fires")
      }).optional().describe("Effective autoscale thresholds (provider profile merged with any explicit config)"),
      // Kubernetes multi-pool field.
      nodePools: z8.array(
        z8.object({
          name: z8.string().optional(),
          nodeCount: z8.number(),
          minNodes: z8.number(),
          maxNodes: z8.number(),
          perNodeRatePerHour: z8.number(),
          perNodeMaxThroughputRps: z8.number().optional()
        }).passthrough()
      ).optional().describe("Per-pool billing details for multi-pool clusters (absent on single-pool clusters)"),
      // GPU / inference fields (present only on kubernetes resources with inferenceMode: true).
      resolvedGpuRatePerNode: z8.number().optional().describe("Resolved GPU node billing rate in USD/hr \u2014 present only on inference-mode kubernetes resources"),
      resolvedSkuLabel: z8.string().optional().describe("The GPU SKU that was matched (e.g. 'a100-80gb') or a fallback label naming the provider default \u2014 present only on inference-mode kubernetes resources"),
      perNodeTokensPerSec: z8.number().optional().describe("Modelled per-node token throughput at full utilisation (tokens/sec) \u2014 present only on inference-mode kubernetes resources"),
      // Database fields.
      resolvedStorageTier: z8.string().optional().describe("Storage tier / size string used to resolve pricing (database resources)"),
      resolvedConnectionLimit: z8.number().optional().describe("Effective max-connection limit the engine uses for connection-pressure modelling (database resources)"),
      // behaviorModel — latency simulation path + GPU interconnect topology factors.
      // Present on all resource types; topology fields only populated on inferenceMode K8s clusters.
      behaviorModel: z8.object({
        latencyPath: z8.string().optional().describe(
          "Canonical latency simulation path identifier, e.g. 'gpu-inference/ttft-decode' or 'generic-kubernetes/load-saturation'. Machine-match against LATENCY_PATHS constants \u2014 do not string-parse."
        ),
        description: z8.string().optional().describe("Human-readable description of the latency model applied to this resource"),
        modelingNote: z8.string().optional().describe(
          "Provenance disclaimer for latency figures. On inferenceMode clusters states that TTFT/P95/P99 are CWM simulation-model estimates from accelerator catalog parameters, not externally measured benchmarks. When topology is omitted also notes the legacy-baseline assumption (topologyThroughputFactor=1.0)."
        ),
        acceleratorResolution: z8.enum(["catalog", "fallback"]).optional().describe(
          "'catalog' = accelerator matched ACCELERATOR_TOKENS_PER_SEC; 'fallback' = unrecognised, defaults substituted (TTFT 600 ms, decode 700 tok/s, perNodeTokens 500)"
        ),
        behaviourFidelity: z8.enum(["modeled", "estimated"]).optional().describe("'modeled' = parameters from the performance catalog; 'estimated' = defaults substituted"),
        // Topology latency fields (resolveTopologyLatencyFactors) — describe the TTFT + decode latency model.
        topologyIntraNode: z8.string().nullable().optional().describe("Raw characteristics.topology.intraNode value ('pcie', 'nvlink', 'nvlink-nvswitch', 'infiniband') or null when absent"),
        topologyInterNode: z8.string().nullable().optional().describe("Raw characteristics.topology.interNode value or null when absent"),
        topologyNodeCount: z8.number().optional().describe("Node count used when resolving topology latency factors (\u2265 1)"),
        topologyTtftFactor: z8.number().optional().describe(
          "TTFT latency scaling factor applied by the engine's GPU inference model (resolveTopologyLatencyFactors). Describes the TTFT+decode latency dimension \u2014 distinct from the throughput scaling factor."
        ),
        topologyDecodeFactor: z8.number().optional().describe(
          "Decode-rate latency scaling factor applied by the engine's GPU inference model (resolveTopologyLatencyFactors). Describes the TTFT+decode latency dimension \u2014 distinct from the throughput scaling factor."
        ),
        topologyCalibrationStatus: z8.enum(["calibrated", "estimated", "not_applicable"]).optional().describe(
          "Calibration status of the TTFT+decode latency factors (resolveTopologyLatencyFactors). Entirely separate from topologyThroughputCalibrationStatus, which covers throughput scaling."
        ),
        // Topology throughput fields (resolveTopologyScalingFactor) — describe the token capacity dimension.
        topologyThroughputFactor: z8.number().optional().describe(
          "Throughput scaling coefficient applied by resolveTopologyScalingFactor to this cluster's token capacity (nodes \xD7 perNodeTokensPerSec \xD7 factor \xD7 gpuUtil/100). 1.0 when topology.intraNode is absent or unrecognised (legacy baseline, topologyIsLegacyBaseline=true). Known fabric penalties: pcie\u22480.70, nvlink\u22480.85, nvlink-nvswitch\u22480.92, infiniband\u22481.0. Entirely separate from topologyTtftFactor/topologyDecodeFactor, which describe the TTFT+decode latency model."
        ),
        topologyThroughputCalibrationStatus: z8.enum(["calibrated", "estimated", "not_applicable"]).optional().describe(
          "Calibration status of the throughput scaling factor (resolveTopologyScalingFactor). Distinct from topologyCalibrationStatus, which covers TTFT+decode latency factors. 'estimated' for all current intraNode coefficients (engineering assumptions from bandwidth arithmetic). 'not_applicable' on non-inferenceMode resources. Reserve 'calibrated' for when a directly measured per-request throughput ratio is added."
        ),
        topologyIsLegacyBaseline: z8.boolean().optional().describe(
          "true when topology.intraNode was absent or unrecognised, meaning topologyThroughputFactor=1.0 reflects the pre-topology legacy baseline (not a fabric-specific measurement). false when an explicit, recognised intraNode value was supplied and the throughput factor is topology-modelled."
        )
      }).passthrough().optional().describe(
        "Latency simulation model and GPU interconnect topology parameters for this resource. latencyPath identifies which engine path runs at step time. Two distinct model components: (1) throughput scaling \u2014 topologyThroughputFactor (resolveTopologyScalingFactor) bounds effective token capacity; topologyThroughputCalibrationStatus and topologyIsLegacyBaseline qualify that factor. (2) latency shape \u2014 topologyTtftFactor + topologyDecodeFactor (resolveTopologyLatencyFactors) scale TTFT and decode curves; topologyCalibrationStatus qualifies those factors. Both components are present on inferenceMode Kubernetes clusters; latencyPath is present on all resource types."
      )
    }).passthrough()
  ).optional().describe("Per-resource billing parameters resolved by the engine at create time")
}).passthrough();
var mcpScenarioAttributionSchema = z8.object({
  id: z8.string().describe("Live scenario catalog ID that supplied the simulation graph"),
  version: z8.string().nullable().describe("Catalog version, when provided"),
  revision: z8.string().nullable().describe("Catalog revision, when provided"),
  source: z8.literal("scenario-catalog").describe("Trusted server-side attribution source")
}).strict();
var createOutputSchema = z8.object({
  id: z8.string().optional().describe("Unique simulation ID \u2014 use with simulation.step, simulation.metrics, etc."),
  name: z8.string().optional().describe("Simulation name"),
  engineVersion: z8.string().optional().describe("Simulation engine version used for this prediction."),
  predictionEffectiveConfigHash: z8.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity."),
  calibrationEvidence: calibrationEvidenceOutputSchema.optional().describe("Owned-versus-modeled evidence and latency boundary."),
  predictionEvidence: storedPredictionEvidenceSchema.optional(),
  appWeight: z8.enum(["lean", "typical", "heavy"]).optional(),
  appWeightDefaulted: z8.boolean().optional(),
  status: z8.string().optional().describe("Current simulation status"),
  traffic: z8.number().optional().describe("Current traffic in RPS"),
  resilienceConfig: mcpResilienceConfigSchema.optional().describe(
    "Effective resilience model returned after create; per-edge retryPolicy values include defaults for omitted fields."
  ),
  scenarioAttribution: mcpScenarioAttributionSchema.optional().describe(
    "Trusted server-side attribution copied from the live scenario catalog; absent for explicit resource-graph creates"
  ),
  scenarioHash: z8.string().length(64).optional().describe("Canonical SHA-256 of the persisted scenario graph and attached traffic-pattern order"),
  effectiveConfigHash: z8.string().length(64).optional().describe("Versioned prediction hash over replay startup inputs, engine version, and calibration identity; see replayIdentity.effectiveConfigHash for the original replay-only hash."),
  replayIdentity: replayIdentitySchema.optional(),
  resources: z8.array(
    z8.object({
      id: z8.string().optional().describe("Resource ID"),
      name: z8.string().optional().describe("Resource display name"),
      status: z8.string().optional().describe("Health status (healthy/warning/critical/failed)"),
      cpuPercent: z8.number().optional().describe("CPU utilization (%)"),
      routedRps: z8.number().optional().describe("Requests per second routed to this resource (compute/kubernetes only)"),
      availabilityState: z8.enum(["available", "degraded", "unavailable", "scaled_to_zero", "cold_start"]).optional().describe("Availability derived from lifecycle and routed traffic; degraded can still serve, unavailable is failed/parked, scaled_to_zero and cold_start are Fargate no-task states"),
      isRoutable: z8.boolean().optional().describe("Whether this compute/Kubernetes resource can receive traffic"),
      recoveryBlockedReason: z8.string().optional().describe("Engine recovery guard currently blocking cooldown progress, when present")
    }).passthrough()
  ).optional().describe("Per-resource summary (compact mode) or full resource states (full mode)"),
  effectiveMaxInstances: z8.number().optional().describe("The fleet-size ceiling the engine will enforce (autoscalingConfig.maxInstances, or the provider default when unset)"),
  effectiveMinInstances: z8.number().optional().describe("The fleet-size floor the engine will enforce (autoscalingConfig.minInstances, or the provider default when unset)"),
  autoscalingConfig: z8.object({}).passthrough().optional().describe("Effective simulation scaling config; full response also contains the ECS resource's linked CPU-only target-tracking policy."),
  normalizedConfig: normalizedConfigSchema.optional().describe(
    "Engine-resolved billing parameters for every resource: cost multipliers, hourly rates, autoscale thresholds (scaleOut/scaleIn CPU %), GPU SKU, per-node token throughput, billing floor, connection limits. Use this immediately after create to verify the simulation was set up as intended \u2014 e.g. confirm which GPU SKU was resolved, the effective billing floor, or the autoscale CPU threshold that will drive scale-out."
  ),
  hpaAudit: z8.object({
    targetSupplied: z8.boolean(),
    suppliedField: z8.string().nullable(),
    requestedTargetCpu: z8.number().nullable(),
    effectiveScaleOutCpuPercent: z8.number(),
    effectiveScaleInCpuPercent: z8.number(),
    defaulted: z8.boolean(),
    provider: z8.string(),
    resourceCategory: z8.string(),
    defaultExplanation: z8.string().optional(),
    policyExplanation: z8.string().optional()
  }).optional().describe("CPU HPA create-time audit: whether a target arrived, its accepted field, the persisted thresholds, and the provider-default explanation when omitted.")
}).passthrough().describe(
  "Compact created-simulation summary by default (id, name, status, traffic, per-resource summary, normalizedConfig). With responseMode 'full', the complete simulation object (all resource characteristics and connections) is returned instead."
);
var listOutputSchema = z8.object({
  simulations: z8.array(
    z8.object({
      id: z8.string().optional().describe("Simulation ID"),
      name: z8.string().optional().describe("Simulation name"),
      status: z8.string().optional().describe("Current simulation status"),
      resourceCount: z8.number().optional().describe("Number of resources in the simulation (compact mode)")
    }).passthrough()
  ).optional().describe("Simulations owned by this API key \u2014 compact entries (id, name, status, resourceCount) by default, complete simulation objects with responseMode 'full'")
}).passthrough();
var CREATE_RESPONSE_MODE_DESCRIBE = "Response detail level. 'compact' (default) returns id, name, status, traffic, and a per-resource summary (id, name, status, cpuPercent) \u2014 keeps the response small for agent loops. 'full' returns the complete simulation object including all resource characteristics and connections.";
var LIST_RESPONSE_MODE_DESCRIBE = "Response detail level. 'compact' (default) returns id, name, status, and resourceCount per simulation \u2014 keeps enumeration cheap for agent loops. 'full' returns the complete simulation objects including all resource characteristics and connections.";
var RESPONSE_MODE_DESCRIBE = "Response detail level. 'compact' (default) returns only principal metrics, errorBreakdown when available, per-resource status (id, name, status, cpuPercent, routedRps, availabilityState, isRoutable, recoveryBlockedReason, and failureLifecycle/routingState when provided), and this step's events \u2014 keeps observations small for agent loops. 'full' returns the complete backend step response including the entire simulation object with all resource characteristics and connections.";

// api-errors.ts
var providers = "must be one of aws, gcp, azure, oci, digitalocean";
var injectionConstraints = {
  "": "must be an object describing a chaos injection",
  "/failureType": "must be one of region_outage, permanent_data_loss, database_crash, database_slowdown, database_overload, zone_outage, instance_failure, eks_spot_interruption, network_latency, network_partition, cascading_failure, cpu_stress",
  "/targetProvider": `${providers}; required for region or zone targeting of region_outage or permanent_data_loss`,
  "/targetRegion": "must be a string; region_outage requires a non-blank targetRegion",
  "/targetResourceId": "must be a string; permanent_data_loss requires an explicit resource, region, or zone target",
  "/targetResourceName": "must be a string",
  "/targetZone": "must be a string",
  "/duration": "must be a number",
  "/intensity": "must be a number between 0 and 100",
  "/startTime": "must be a number",
  "/affectedResources": "must be an array of strings",
  "/affectedResources/*": "must be a string"
};
var workloadConstraints = {
  "": "must be an object containing only documented workload fields",
  "/computeInstances": "must be a number at least 1",
  "/databaseInstances": "must be a number at least 1",
  "/storageGB": "must be a number at least 1",
  "/trafficRPS": "must be a number at least 1",
  "/latencyRequirementMs": "must be a number at least 1",
  "/targetTokensPerSec": "must be a number at least 1",
  "/primaryRegion": "must be a string",
  "/secondaryRegions": "must be an array of strings",
  "/secondaryRegions/*": "must be a string",
  "/dataResidencyRequirements": "must be an array of strings",
  "/dataResidencyRequirements/*": "must be a string",
  "/requiresMultiRegion": "must be a boolean",
  "/sourceProvider": providers,
  "/workloadType": "must be one of standard, inference"
};
var multiCloudConstraints = {
  "": "must be a multi-cloud exploration request object",
  "/optimizationWeights": "must be an object containing only cost, latency, and vendorLockIn",
  "/optimizationWeights/cost": "must be a number between 0 and 1",
  "/optimizationWeights/latency": "must be a number between 0 and 1",
  "/optimizationWeights/vendorLockIn": "must be a number between 0 and 1",
  "/maxCostPerHour": "must be a number greater than 0",
  "/errorBudgetPct": "must be a number between 0 and 100",
  "/modifiers": "must be an object",
  "/modifiers/awsCommitment": "must be one of on-demand, 1yr, 3yr",
  "/modifiers/azureHybridBenefit": "must be a boolean",
  "/modifiers/spotEligible": "must be a boolean",
  "/modifiers/oracleLicenseHolder": "must be a boolean"
};
function constraint(path, pointer, message) {
  const normalized = pointer.replace(/\/(0|[1-9]\d{0,5})(?=\/|$)/g, "/*");
  if (path === "/api/multi-cloud/explore") {
    if (normalized === "/workloadProfile" || normalized.startsWith("/workloadProfile/")) {
      return Object.hasOwn(workloadConstraints, normalized.slice(16)) ? workloadConstraints[normalized.slice(16)] : void 0;
    }
    return Object.hasOwn(multiCloudConstraints, normalized) ? multiCloudConstraints[normalized] : void 0;
  }
  const batch = path === "/api/chaos/batch";
  if (normalized === "") return "must be a chaos job request object";
  if (normalized === "/simulationId") return "must be a string identifying a simulation";
  if (batch && normalized === "/scenarios") return "must be an array containing 1 to 10 scenarios";
  if (batch && normalized === "/webhookUrl") return "must be a valid URL";
  if (batch && normalized === "/webhookSecret") return "must be a string";
  if (batch && !normalized.startsWith("/scenarios/*")) return;
  const scenario = batch ? normalized.slice("/scenarios/*".length) : normalized;
  if (scenario === "") return "must be a scenario object";
  if (scenario === "/scenarioId") return "must be a string identifying a chaos scenario";
  if (scenario === "/duration") return `must be a number between 10 and ${batch ? 300 : 1e3}`;
  if (scenario === "/customInjections") return "must be an array of chaos injection objects";
  const isInjection = scenario.startsWith("/customInjections/*");
  const field = isInjection ? scenario.slice("/customInjections/*".length) : scenario;
  if (field === "/promotionDelaySeconds" || field === "/restartDelaySeconds") {
    const name = field.slice(1);
    const restriction = isInjection ? `${name} applies only to database_crash` : `${name} requires scenarioId database_crash without customInjections`;
    return message === restriction ? restriction : `${name} must be an integer between 0 and 86400`;
  }
  return isInjection && Object.hasOwn(injectionConstraints, field) ? injectionConstraints[field] : void 0;
}
function jobStartValidationMessage(path, data) {
  if (!["/api/chaos/run", "/api/chaos/batch", "/api/multi-cloud/explore"].includes(path)) return;
  const generic = "Validation failed";
  if (typeof data !== "object" || data === null) return generic;
  const body = data;
  if (body.error !== generic || !Array.isArray(body.details)) return generic;
  const messages = /* @__PURE__ */ new Set();
  for (const detail of body.details.slice(0, 32)) {
    if (typeof detail !== "object" || detail === null) continue;
    const { pointer, message } = detail;
    if (typeof pointer !== "string" || pointer.length > 160 || pointer.includes("*")) continue;
    const help = constraint(path, pointer, message);
    if (help) messages.add(`${pointer || "/"}: ${help}`);
    if (messages.size === 8) break;
  }
  return messages.size ? `${generic}: ${Array.from(messages).join("; ")}` : generic;
}

// index.ts
var BASE_URL = process.env.CWM_BASE_URL ?? "http://localhost:5000";
var API_KEY = process.env.CWM_API_KEY ?? "";
async function apiCall(method, path, body, requireAuth = false) {
  const headers = { "Content-Type": "application/json" };
  if (requireAuth) {
    if (!API_KEY) {
      throw new Error(
        "CWM_API_KEY environment variable is required for this tool. Set it to a valid API key obtained from POST /api/keys on your Cloud World Model instance."
      );
    }
    headers["Authorization"] = `Bearer ${API_KEY}`;
  } else if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== void 0 ? JSON.stringify(body) : void 0
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const jobValidation = res.status === 400 ? jobStartValidationMessage(path, data) : void 0;
    const errMsg = jobValidation ?? (typeof data === "object" && data !== null && "error" in data ? data.error : text);
    throw new Error(`API error ${res.status}: ${errMsg}`);
  }
  return data;
}
var server = new McpServer({
  name: "cloud-world-model",
  version: "1.1.0"
});
registerTools(server, { apiCall, baseUrl: BASE_URL });
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cloud World Model MCP server running on stdio");
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
