#!/usr/bin/env python3
"""One REST stateless result or three MCP full steps. Example thresholds only."""
import json, math, sys
SLO = {'errorRatePct': 1, 'p95Ms': 200, 'costPerHour': 5}
def valid(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0
def interpret(results):
    phases, blockers, gaps = [], [], []
    rest = len(results) == 1 and isinstance(results[0], dict) and 'execution' in results[0]
    if not rest and len(results) != 3:
        gaps.append('Expected three MCP phases or one REST stateless result.')
    for i, s in enumerate(results):
        try:
            if rest:
                m = {'errorRatePct': s['error']['ratePercent'], 'p95Ms': s['performance']['latencyP95Ms'], 'costPerHour': s['cost']['finalPerHourUsd']}
                if s['performance'].get('latencyPercentileStatus') != 'modeled':
                    gaps.append('Latency unavailable or not identified as modeled.')
                if s['execution'].get('steps') != 3:
                    gaps.append('Expected three executed steps.')
                coverage = s.get('coverage')
                if not isinstance(coverage, dict) or coverage.get('level') != 'full':
                    gaps.append('Coverage missing or less than full; review details.')
            else:
                raw = s.get('metrics', s)
                m = {'errorRatePct': raw.get('errorRate'), 'p95Ms': raw.get('latencyP95'), 'costPerHour': raw.get('costPerHour')}
                dbs = raw.get('databases')
                if not isinstance(dbs, list) or not dbs:
                    gaps.append(f'Phase {i+1}: missing database CPU evidence.')
                else:
                    cpus = [d.get('cpuUtil') for d in dbs]
                    if not all(valid(v) and v <= 100 for v in cpus):
                        gaps.append(f'Phase {i+1}: invalid database CPU.')
                    elif max(cpus) > 85:
                        blockers.append(f'Phase {i+1}: database CPU exceeds 85%.')
            phases.append(m)
            for key, limit in SLO.items():
                value = m[key]
                if not valid(value) or (key == 'errorRatePct' and value > 100):
                    gaps.append(f'Phase {i+1}: missing/invalid {key}.')
                    m[key] = None
                elif value > limit:
                    blockers.append(f'Phase {i+1}: {key} {value} exceeds {limit}.')
        except (KeyError, TypeError, AttributeError):
            gaps.append(f'Phase {i+1}: unsupported result shape.')
    return {'schemaVersion': 2, 'evidence': 'modeled', 'verdict': 'inconclusive' if gaps else ('modeled_fail' if blockers else 'modeled_pass'), 'mergeAuthorized': False, 'slo': SLO, 'phases': phases, 'blockingReasons': blockers, 'evidenceGaps': gaps, 'coverage': results[0].get('coverage') if rest else None, 'diagnostics': ({'latencyP99Ms': results[0].get('performance', {}).get('latencyP99Ms'), 'p99Note': 'Diagnostic only, not gated (P99 uncalibrated).', 'warningEvents': [e for e in results[0].get('decisions', {}).get('events', []) if e.get('severity') in ('warning', 'critical', 'error')], 'settlement': results[0].get('settlement')} if rest and isinstance(results[0].get('performance'), dict) and isinstance(results[0].get('decisions', {}), dict) else None), 'scope': 'REST final aggregate only; not every intermediate step' if rest else 'Supplied MCP phases only', 'recommendation': 'Review thresholds and evidence limits. Test proposed remedies separately.'}
if __name__ == '__main__':
    try:
        report = interpret([json.load(open(p, encoding='utf-8')) for p in sys.argv[1:]])
    except (OSError, ValueError) as exc:
        report = {'verdict': 'inconclusive', 'mergeAuthorized': False, 'evidenceGaps': [str(exc)]}
    print(json.dumps(report, indent=2, allow_nan=False))
    sys.exit(0 if report['verdict'] == 'modeled_pass' else 1)
