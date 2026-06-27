import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import ai


class AiTests(unittest.TestCase):
    def test_analyze_journal_detects_triggers_and_crisis(self):
        result = ai.analyze_journal("I keep comparing myself to others and I want to hurt myself.")
        self.assertTrue(result["crisis"])
        self.assertIn("peer_comparison", result["triggers"])

    def test_generate_wellness_insight_returns_crisis_response(self):
        response = ai.generate_wellness_insight(
            mood=1,
            sleep_hours=4,
            stress_level=5,
            notes="I want to end it all.",
        )
        self.assertIn("Immediate Support", response)
        self.assertIn("iCALL", response)

    def test_build_weekly_analysis_summarizes_triggers(self):
        logs = [
            {"mood": 2, "sleep_hours": 5.5, "stress_level": 4, "notes": "Too much syllabus and no time", "created_at": "2026-06-01T10:00:00"},
            {"mood": 3, "sleep_hours": 6.0, "stress_level": 3, "notes": "Family pressure and comparison with peers", "created_at": "2026-06-02T10:00:00"},
        ]
        weekly = ai.build_weekly_analysis(logs)
        self.assertIn("Average mood", weekly["trend"])
        trigger_names = [name for name, _count in weekly["common_triggers"]]
        self.assertIn("syllabus_overload", trigger_names)
        self.assertIn("family_pressure", trigger_names)


if __name__ == "__main__":
    unittest.main()
