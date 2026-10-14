#!/usr/bin/env python3
"""Null, wrong-type, empty, missing-phase, and saved-sample checks for both interpreters."""
import json, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import interpret_mcp_cache
import interpret_rest

CACHE_FILES = [
    ROOT / "sample_run" / "1_step_600rps.json",
    ROOT / "sample_run" / "2_step_900rps.json",
    ROOT / "sample_run" / "3_step_cache_failed.json",
]
PAID = ROOT / "sample_run_rest_paid" / "response.json"


def inconclusive(report):
    assert isinstance(report, dict), report
    assert report.get("verdict") == "inconclusive", report
    assert report.get("evidenceGaps"), report
    assert report.get("mergeAuthorized") is False


class Interpreters(unittest.TestCase):
    def test_mcp_null_and_wrong_types(self):
        cases = [
            {"metrics": None},
            {"metrics": []},
            {"metrics": "nope"},
            {"metrics": {"requestFlow": None, "databases": None, "errorRate": None}},
            {"metrics": {"requestFlow": "bad", "databases": 5, "errorRate": True, "latencyP95": "slow", "costPerHour": {}}},
            {"metrics": {"requestFlow": {"cache": None}, "databases": [None, "x"], "errorRate": 0, "latencyP95": 1, "costPerHour": 1}},
            {"metrics": {"requestFlow": {"cache": []}, "databases": {"cpuUtil": 1}}},
            {},
        ]
        for case in cases:
            with self.subTest(case=case):
                report = self.mcp(case, case, case)
                inconclusive(report)
                self.assertNotIn("Traceback", json.dumps(report))

    def test_mcp_empty_object_and_missing_phase(self):
        inconclusive(self.mcp({}, {}, {}))
        inconclusive(self.mcp({}))
        inconclusive(interpret_mcp_cache.interpret([]))
        inconclusive(self.mcp({"metrics": {"errorRate": 0}}, {}))

    def test_rest_null_and_wrong_types(self):
        paid = json.loads(PAID.read_text(encoding="utf-8"))
        events_null = json.loads(json.dumps(paid))
        events_null["decisions"]["events"] = None
        events_string = json.loads(json.dumps(paid))
        events_string["decisions"]["events"] = "warning"
        events_bad_entry = json.loads(json.dumps(paid))
        events_bad_entry["decisions"]["events"] = [None, "x", {"severity": "warning"}]
        decisions_null = json.loads(json.dumps(paid))
        decisions_null["decisions"] = None
        cases = [
            {},
            {"execution": None},
            {"execution": [], "error": None, "performance": None, "cost": None, "decisions": {"events": None}},
            {"metrics": None},
            {"metrics": {"databases": None, "errorRate": "high", "latencyP95": True, "costPerHour": []}},
            {"metrics": {"databases": [None], "errorRate": 0, "latencyP95": 1, "costPerHour": 1}},
            events_null,
            events_string,
            events_bad_entry,
            decisions_null,
            {"execution": {"steps": 3}, "error": {"ratePercent": "0"}, "performance": {"latencyP95Ms": None, "latencyPercentileStatus": "modeled"},
             "cost": {"finalPerHourUsd": 1}, "coverage": {"level": "full"}, "decisions": {"events": []}},
        ]
        for case in cases:
            with self.subTest(case=list(case)[:6] if isinstance(case, dict) else case):
                report = interpret_rest.interpret([case])
                inconclusive(report)

    def test_rest_empty_object_and_missing_phase(self):
        inconclusive(interpret_rest.interpret([{}]))
        inconclusive(interpret_rest.interpret([]))
        inconclusive(interpret_rest.interpret([{"metrics": {"errorRate": 0}}]))
        inconclusive(interpret_rest.interpret([{"metrics": None}, {"metrics": {}}]))

    def test_saved_samples(self):
        cache = interpret_mcp_cache.interpret([str(p) for p in CACHE_FILES])
        self.assertEqual(cache["verdict"], "modeled_fail")
        self.assertEqual(cache["failedPhases"], ["cache_failure"])
        self.assertEqual(cache["evidenceGaps"], [])
        saved_cache = json.loads((ROOT / "sample_run" / "sim-report.json").read_text(encoding="utf-8"))
        self.assertEqual(cache, saved_cache)

        paid = interpret_rest.interpret([json.loads(PAID.read_text(encoding="utf-8"))])
        self.assertEqual(paid["verdict"], "modeled_pass")
        self.assertEqual(paid["evidenceGaps"], [])
        saved_paid = json.loads((ROOT / "sample_run_rest_paid" / "sim-report.json").read_text(encoding="utf-8"))
        self.assertEqual(paid, saved_paid)

        rest_on_cache = interpret_rest.interpret([json.loads(p.read_text(encoding="utf-8")) for p in CACHE_FILES])
        self.assertEqual(rest_on_cache["verdict"], "modeled_fail")
        self.assertTrue(rest_on_cache["blockingReasons"])

    def test_cli_malformed_has_no_traceback(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text('{"metrics": null, "decisions": {"events": null}}', encoding="utf-8")
            for script in ("interpret_mcp_cache.py", "interpret_rest.py"):
                with self.subTest(script=script):
                    args = [sys.executable, str(ROOT / script)]
                    if script.startswith("interpret_mcp"):
                        args.extend([str(path), str(path), str(path)])
                    else:
                        args.append(str(path))
                    proc = subprocess.run(args, capture_output=True, text=True, check=False)
                    self.assertNotIn("Traceback", proc.stderr)
                    self.assertNotIn("Traceback", proc.stdout)
                    report = json.loads(proc.stdout)
                    inconclusive(report)
                    self.assertNotEqual(proc.returncode, 0)

    def mcp(self, *objects):
        with tempfile.TemporaryDirectory() as directory:
            paths = []
            for i, obj in enumerate(objects):
                path = Path(directory) / f"{i}.json"
                path.write_text(json.dumps(obj), encoding="utf-8")
                paths.append(str(path))
            return interpret_mcp_cache.interpret(paths)


if __name__ == "__main__":
    unittest.main(verbosity=2)
