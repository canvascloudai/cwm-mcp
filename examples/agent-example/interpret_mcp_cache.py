#!/usr/bin/env python3
"""Interpret exactly three CWM MCP simulation.step outputs (responseMode "full"), in order:
baseline, peak, cache-failure.
Usage: python3 interpret_mcp_cache.py baseline.json peak.json cache_failed.json > sim-report.json
Verdicts match interpret_rest.py: modeled_pass | modeled_fail | inconclusive. Only modeled_pass exits 0.
SLOs are EXAMPLE thresholds chosen by the builder, not CWM defaults. No verdict authorizes a merge."""
import json, math, sys

SLO = {"errorRatePct": 1.0, "p95Ms": 200, "dbCpuPct": 85, "costPerHour": 5.0}
PHASES = ["baseline", "peak", "cache_failure"]

def num(v, hi=None):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0 and (hi is None or v <= hi)

def load(p):
    t = open(p, encoding="utf-8").read()
    return json.loads(t[t.index("{"):t.rindex("}") + 1])

def phase(name, s, gaps):
    m = s.get("metrics", s) if isinstance(s, dict) else {}
    rf = m.get("requestFlow") or {}
    cache = rf.get("cache") or {}
    dbs = m.get("databases") or []
    cpus = [d.get("cpuUtil") for d in dbs if isinstance(d, dict)]
    ph = {"phase": name, "offeredRps": m.get("offeredRps"), "goodputRps": m.get("throughput"),
          "errorRatePct": m.get("errorRate"), "p95Ms": m.get("latencyP95"), "costPerHour": m.get("costPerHour"),
          "dbCpuPct": max(cpus) if cpus and all(num(c, 100) for c in cpus) else None,
          "cacheHitRps": cache.get("hitRps"), "cacheMissRps": cache.get("missRps")}
    for k, hi in (("errorRatePct", 100), ("p95Ms", None), ("costPerHour", None), ("dbCpuPct", 100)):
        if not num(ph[k], hi):
            gaps.append(f"{name}: missing/invalid {k}"); ph[k] = None
    if not cache:
        gaps.append(f"{name}: metrics.requestFlow.cache missing (cache not in request path, or responseMode not 'full')")
    return ph

def interpret(paths):
    gaps, blockers, phases = [], [], []
    if len(paths) != 3:
        gaps.append(f"Expected 3 phase files ({', '.join(PHASES)}); got {len(paths)}.")
    for name, p in zip(PHASES, paths):
        try:
            phases.append(phase(name, load(p), gaps))
        except (OSError, ValueError) as e:
            gaps.append(f"{name}: unreadable ({e.__class__.__name__})")
    for ph in phases:
        for k, lim in SLO.items():
            if ph.get(k) is not None and ph[k] > lim:
                blockers.append(f"{ph['phase']}: {k} {ph[k]} exceeds {lim}")
    verdict = "inconclusive" if gaps else ("modeled_fail" if blockers else "modeled_pass")
    failed = sorted({b.split(":")[0] for b in blockers})
    if verdict == "modeled_fail" and failed == ["cache_failure"]:
        rec = ("Healthy at baseline and peak, but losing the cache breaches SLOs. Candidate remedies to TEST in a follow-up "
               "simulation (not confirmed fixes): more DB headroom, a read replica, serve-stale or a circuit breaker on cache loss.")
    elif verdict == "modeled_fail":
        rec = "SLO breach outside the cache-failure phase; fix the failing phases and re-simulate."
    elif verdict == "modeled_pass":
        rec = "All three phases within the example SLOs."
    else:
        rec = "Evidence incomplete; supply all three full step outputs."
    return {"schemaVersion": 2, "evidence": "modeled", "verdict": verdict, "mergeAuthorized": False, "slo": SLO,
            "phases": phases, "failedPhases": failed, "blockingReasons": blockers, "evidenceGaps": gaps,
            "changeRecommendation": rec, "scope": "Supplied MCP phases only; p99 not gated (uncalibrated)."}

if __name__ == "__main__":
    r = interpret(sys.argv[1:])
    print(json.dumps(r, indent=2, allow_nan=False))
    sys.exit(0 if r["verdict"] == "modeled_pass" else 1)
