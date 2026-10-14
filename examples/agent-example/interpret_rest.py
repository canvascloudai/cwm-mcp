#!/usr/bin/env python3
"""One REST stateless result or three MCP full steps. Example thresholds only.
Malformed input (null, wrong types, missing phases) is inconclusive with evidence gaps, never a traceback."""
import json, math, sys
SLO = {'errorRatePct': 1, 'p95Ms': 200, 'costPerHour': 5}
WARN = ('warning', 'critical', 'error')

def valid(v, hi=None):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0 and (hi is None or v <= hi)

def blank(msg):
    return {'verdict': 'inconclusive', 'mergeAuthorized': False, 'evidenceGaps': [msg]}

def object_field(parent, key, label, gaps):
    """Dict field. Missing, null, and non-objects are gaps and return None."""
    if not isinstance(parent, dict) or key not in parent or not isinstance(parent.get(key), dict):
        gaps.append(f'{label} must be an object.')
        return None
    return parent[key]

def warning_events(decisions, gaps):
    if not isinstance(decisions, dict):
        return []
    if 'events' not in decisions:
        return []
    events = decisions.get('events')
    if not isinstance(events, list):
        gaps.append('decisions.events must be a list.')
        return []
    warnings = []
    bad = False
    for event in events:
        if not isinstance(event, dict):
            bad = True
            continue
        if event.get('severity') in WARN:
            warnings.append(event)
    if bad:
        gaps.append('decisions.events entries must be objects.')
    return warnings

def diagnostics_for(result, gaps):
    if not isinstance(result, dict) or not isinstance(result.get('performance'), dict):
        return None
    if 'decisions' not in result:
        decisions = {}
    elif isinstance(result.get('decisions'), dict):
        decisions = result['decisions']
    else:
        gaps.append('decisions must be an object.')
        decisions = {}
    settlement = result.get('settlement')
    if settlement is not None and not isinstance(settlement, dict):
        gaps.append('settlement must be an object.')
        settlement = None
    p99 = result['performance'].get('latencyP99Ms')
    if p99 is not None and not valid(p99):
        gaps.append('latencyP99Ms must be a number.')
        p99 = None
    return {'latencyP99Ms': p99, 'p99Note': 'Diagnostic only, not gated (P99 uncalibrated).',
            'warningEvents': warning_events(decisions, gaps), 'settlement': settlement}

def metric_map(raw):
    if not isinstance(raw, dict):
        return {'errorRatePct': None, 'p95Ms': None, 'costPerHour': None}
    return {'errorRatePct': raw.get('errorRate'), 'p95Ms': raw.get('latencyP95'), 'costPerHour': raw.get('costPerHour')}

def rest_metrics(s, gaps, label):
    error = object_field(s, 'error', f'{label}: error', gaps)
    performance = object_field(s, 'performance', f'{label}: performance', gaps)
    cost = object_field(s, 'cost', f'{label}: cost', gaps)
    execution = object_field(s, 'execution', f'{label}: execution', gaps)
    m = {'errorRatePct': error.get('ratePercent') if error else None,
         'p95Ms': performance.get('latencyP95Ms') if performance else None,
         'costPerHour': cost.get('finalPerHourUsd') if cost else None}
    if not performance or performance.get('latencyPercentileStatus') != 'modeled':
        gaps.append('Latency unavailable or not identified as modeled.')
    if not execution or execution.get('steps') != 3:
        gaps.append('Expected three executed steps.')
    coverage = s.get('coverage') if isinstance(s, dict) else None
    if not isinstance(coverage, dict) or coverage.get('level') != 'full':
        gaps.append('Coverage missing or less than full; review details.')
    return m

def mcp_metrics(s, gaps, label):
    if not isinstance(s, dict):
        gaps.append(f'{label}: unsupported result shape.')
        return metric_map(None)
    if 'metrics' in s and not isinstance(s.get('metrics'), dict):
        gaps.append(f'{label}: metrics must be an object.')
        raw = {}
    elif isinstance(s.get('metrics'), dict):
        raw = s['metrics']
    else:
        raw = s
    m = metric_map(raw)
    if 'databases' not in raw:
        dbs = None
    elif not isinstance(raw.get('databases'), list):
        gaps.append(f'{label}: databases must be a list.')
        dbs = None
    else:
        dbs = raw['databases']
    if not isinstance(dbs, list) or not dbs:
        gaps.append(f'{label}: missing database CPU evidence.')
    else:
        cpus = []
        bad = False
        for db in dbs:
            if not isinstance(db, dict):
                bad = True
                continue
            cpus.append(db.get('cpuUtil'))
        if bad or not cpus or not all(valid(v, 100) for v in cpus):
            gaps.append(f'{label}: invalid database CPU.')
        elif max(cpus) > 85:
            return m, f'{label}: database CPU exceeds 85%.'
    return m, None

def finish(results, phases, blockers, gaps, rest, diagnostics):
    coverage = results[0].get('coverage') if rest and results and isinstance(results[0], dict) else None
    return {'schemaVersion': 2, 'evidence': 'modeled',
            'verdict': 'inconclusive' if gaps else ('modeled_fail' if blockers else 'modeled_pass'),
            'mergeAuthorized': False, 'slo': SLO, 'phases': phases, 'blockingReasons': blockers, 'evidenceGaps': gaps,
            'coverage': coverage, 'diagnostics': diagnostics,
            'scope': 'REST final aggregate only; not every intermediate step' if rest else 'Supplied MCP phases only',
            'recommendation': 'Review thresholds and evidence limits. Test proposed remedies separately.'}

def interpret(results):
    if not isinstance(results, list):
        return blank('Expected a list of results.')
    phases, blockers, gaps = [], [], []
    rest = len(results) == 1 and isinstance(results[0], dict) and 'execution' in results[0]
    if not rest and len(results) != 3:
        gaps.append('Expected three MCP phases or one REST stateless result.')
    for i, s in enumerate(results):
        label = f'Phase {i+1}'
        try:
            if rest:
                m = rest_metrics(s, gaps, label)
                blocker = None
            else:
                m, blocker = mcp_metrics(s, gaps, label)
            phases.append(m)
            if blocker:
                blockers.append(blocker)
            for key, limit in SLO.items():
                value = m.get(key) if isinstance(m, dict) else None
                if not valid(value) or (key == 'errorRatePct' and value > 100):
                    gaps.append(f'{label}: missing/invalid {key}.')
                    if isinstance(m, dict):
                        m[key] = None
                elif value > limit:
                    blockers.append(f'{label}: {key} {value} exceeds {limit}.')
        except Exception:
            gaps.append(f'{label}: unsupported result shape.')
    diagnostics = diagnostics_for(results[0], gaps) if rest else None
    return finish(results, phases, blockers, gaps, rest, diagnostics)

if __name__ == '__main__':
    try:
        loaded = []
        for p in sys.argv[1:]:
            with open(p, encoding='utf-8') as handle:
                loaded.append(json.load(handle))
        report = interpret(loaded)
    except Exception as exc:
        report = blank(f'{exc.__class__.__name__}: {exc}')
    try:
        print(json.dumps(report, indent=2, allow_nan=False))
    except (TypeError, ValueError) as exc:
        print(json.dumps(blank(f'unserializable report: {exc}'), indent=2))
        sys.exit(1)
    sys.exit(0 if report.get('verdict') == 'modeled_pass' else 1)
