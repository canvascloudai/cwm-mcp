#!/usr/bin/env python3
"""Interpret exactly three CWM MCP simulation.step outputs (responseMode "full"), in order:
baseline, peak, cache-failure.
Usage: python3 interpret_mcp_cache.py baseline.json peak.json cache_failed.json > sim-report.json
Verdicts match interpret_rest.py: modeled_pass | modeled_fail | inconclusive. Only modeled_pass exits 0.
SLOs are EXAMPLE thresholds chosen by the builder, not CWM defaults. No verdict authorizes a merge.
Malformed input (null, wrong types, missing phases) is inconclusive with evidence gaps, never a traceback."""
import json, math, sys

SLO = {"errorRatePct": 1.0, "p95Ms": 200, "dbCpuPct": 85, "costPerHour": 5.0}
PHASES = ["baseline", "peak", "cache_failure"]
CACHE_MISSING = "metrics.requestFlow.cache missing (cache not in request path, or responseMode not 'full')"

def num(v, hi=None):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0 and (hi is None or v <= hi)

def load(p):
    with open(p, encoding="utf-8") as handle:
        t = handle.read()
    return json.loads(t[t.index("{"):t.rindex("}") + 1])

def list_field(parent, key, label, name, gaps):
    """Return a list field. Missing stays an empty list. Null or a non-list is a gap."""
    if not isinstance(parent, dict) or key not in parent:
        return []
    value = parent[key]
    if isinstance(value, list):
        return value
    gaps.append(f"{name}: {label} must be a list.")
    return []

def phase(name, s, gaps):
    if not isinstance(s, dict):
        gaps.append(f"{name}: unsupported result shape.")
        s = {}
    if "metrics" in s and not isinstance(s.get("metrics"), dict):
        gaps.append(f"{name}: metrics must be an object.")
        m = {}
    elif isinstance(s.get("metrics"), dict):
        m = s["metrics"]
    else:
        m = s

    if "requestFlow" not in m:
        rf = {}
        gaps.append(f"{name}: {CACHE_MISSING}")
    elif not isinstance(m.get("requestFlow"), dict):
        rf = {}
        gaps.append(f"{name}: metrics.requestFlow must be an object.")
        gaps.append(f"{name}: {CACHE_MISSING}")
    else:
        rf = m["requestFlow"]
    if "cache" not in rf:
        cache = {}
        if isinstance(m.get("requestFlow"), dict):
            gaps.append(f"{name}: {CACHE_MISSING}")
    elif rf.get("cache") is None or not isinstance(rf.get("cache"), dict):
        cache = {}
        gaps.append(f"{name}: metrics.requestFlow.cache must be an object.")
    else:
        cache = rf["cache"]

    dbs = list_field(m, "databases", "metrics.databases", name, gaps)
    cpus = []
    bad_entry = False
    for d in dbs:
        if not isinstance(d, dict):
            bad_entry = True
            continue
        cpus.append(d.get("cpuUtil"))
    if bad_entry:
        gaps.append(f"{name}: metrics.databases entries must be objects.")
    db_cpu = max(cpus) if not bad_entry and cpus and all(num(c, 100) for c in cpus) else None

    ph = {"phase": name, "offeredRps": m.get("offeredRps"), "goodputRps": m.get("throughput"),
          "errorRatePct": m.get("errorRate"), "p95Ms": m.get("latencyP95"), "costPerHour": m.get("costPerHour"),
          "dbCpuPct": db_cpu,
          "cacheHitRps": cache.get("hitRps") if isinstance(cache, dict) else None,
          "cacheMissRps": cache.get("missRps") if isinstance(cache, dict) else None}
    for k, hi in (("errorRatePct", 100), ("p95Ms", None), ("costPerHour", None), ("dbCpuPct", 100)):
        if not num(ph[k], hi):
            gaps.append(f"{name}: missing/invalid {k}")
            ph[k] = None
    return ph

def empty_report(gaps):
    return {"schemaVersion": 2, "evidence": "modeled", "verdict": "inconclusive", "mergeAuthorized": False, "slo": SLO,
            "phases": [], "failedPhases": [], "blockingReasons": [], "evidenceGaps": gaps,
            "changeRecommendation": "Evidence incomplete; supply all three full step outputs.",
            "scope": "Supplied MCP phases only; p99 not gated (uncalibrated)."}

def interpret(paths):
    if not isinstance(paths, list):
        return empty_report(["Expected a list of three phase files."])
    gaps, blockers, phases = [], [], []
    if len(paths) != 3:
        gaps.append(f"Expected 3 phase files ({', '.join(PHASES)}); got {len(paths)}.")
    for name, p in zip(PHASES, paths):
        try:
            loaded = load(p)
        except (OSError, ValueError) as e:
            gaps.append(f"{name}: unreadable ({e.__class__.__name__})")
            continue
        except Exception as e:
            gaps.append(f"{name}: unreadable ({e.__class__.__name__})")
            continue
        try:
            phases.append(phase(name, loaded, gaps))
        except Exception as e:
            gaps.append(f"{name}: unsupported result shape ({e.__class__.__name__})")
    for ph in phases:
        if not isinstance(ph, dict):
            gaps.append("unsupported phase shape.")
            continue
        for k, lim in SLO.items():
            if ph.get(k) is not None and num(ph[k]) and ph[k] > lim:
                blockers.append(f"{ph.get('phase', '?')}: {k} {ph[k]} exceeds {lim}")
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
    try:
        r = interpret(sys.argv[1:])
    except Exception as exc:
        r = empty_report([f"{exc.__class__.__name__}: {exc}"])
    try:
        print(json.dumps(r, indent=2, allow_nan=False))
    except (TypeError, ValueError) as exc:
        print(json.dumps(empty_report([f"unserializable report: {exc}"]), indent=2))
        sys.exit(1)
    sys.exit(0 if r.get("verdict") == "modeled_pass" else 1)
