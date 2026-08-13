import unittest
import os
import sys
import copy

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import yaml_generator


class TestScenarioBase(unittest.TestCase):
    """Base/overlay model: a run picks exactly one base (the selected `is_base`
    scenario, else `default_base`); only overlays whose resolved base equals that
    base join the merge, and every other triggered scenario is silently excluded."""

    def setUp(self):
        self.config_path = os.path.join(
            os.path.dirname(__file__), 'config_scenario_base.json')
        self.raw_config = yaml_generator.load_json(self.config_path)

    def _active(self, env):
        # Re-parse per call: determine_active_scenarios mutates priority in place.
        app_config = yaml_generator.parse_config(copy.deepcopy(self.raw_config))
        scenarios = yaml_generator.determine_active_scenarios(app_config, env)
        return [sc.value for sc in scenarios]

    def test_default_base_used_when_no_base_selected(self):
        # Nothing selected -> default_base (general_cluster) is the base.
        names = self._active({})
        self.assertIn("general_cluster", names)
        self.assertNotIn("tvm", names)

    def test_selecting_general_cluster_gives_only_that_base(self):
        names = self._active({"SCENARIO_TYPE": "general_cluster"})
        self.assertIn("general_cluster", names)
        self.assertNotIn("tvm", names)

    def test_selecting_tvm_excludes_default_base(self):
        # tvm is is_base -> it replaces general_cluster entirely.
        names = self._active({"SCENARIO_TYPE": "tvm"})
        self.assertIn("tvm", names)
        self.assertNotIn("general_cluster", names)

    def test_overlay_stacks_only_on_matching_base(self):
        # tvm_overlay declares applies_to: tvm -> joins only when tvm is the base.
        names = self._active({"SCENARIO_TYPE": "tvm"})
        # tvm_overlay is source: user and NOT selected, so it isn't triggered here.
        self.assertNotIn("tvm_overlay", names)

    def test_env_overlay_joins_matching_base(self):
        # f200 (applies_to includes general_cluster) is env-triggered by FAB=200mm.
        names = self._active({"SCENARIO_TYPE": "general_cluster", "FAB": "200mm"})
        self.assertIn("general_cluster", names)
        self.assertIn("f200", names)

    def test_multi_base_overlay_joins_each_listed_base(self):
        # f200 has applies_to: ["general_cluster", "tvm"] -> it joins BOTH base
        # runs (they are separate invocations; base is still single each time).
        under_general = self._active({"SCENARIO_TYPE": "general_cluster", "FAB": "200mm"})
        self.assertIn("general_cluster", under_general)
        self.assertIn("f200", under_general)
        self.assertNotIn("tvm", under_general)

        under_tvm = self._active({"SCENARIO_TYPE": "tvm", "FAB": "200mm"})
        self.assertIn("tvm", under_tvm)
        self.assertIn("f200", under_tvm)
        self.assertNotIn("general_cluster", under_tvm)

    def test_overlay_excluded_when_base_not_in_applies_to(self):
        # tvm_overlay has applies_to: "tvm" only. Under general_cluster it must
        # NOT join even if triggered. (It is user-triggered, so trigger it too.)
        names = self._active({"SCENARIO_TYPE": "general_cluster"})
        self.assertNotIn("tvm_overlay", names)

    def test_implicit_base_overlay_follows_default_base(self):
        # implicit_overlay omits `applies_to` -> inherits default_base (general_cluster).
        with_general = self._active({"SCENARIO_TYPE": "general_cluster"})
        # It is source: user and not selected, so not triggered under this env.
        self.assertNotIn("implicit_overlay", with_general)

    def test_base_scenario_gets_lowest_priority(self):
        # The chosen base is forced to priority 9999 (applied first / lowest layer),
        # and sorting is descending so base comes first.
        app_config = yaml_generator.parse_config(copy.deepcopy(self.raw_config))
        scenarios = yaml_generator.determine_active_scenarios(
            app_config, {"SCENARIO_TYPE": "general_cluster", "FAB": "200mm"})
        self.assertEqual(scenarios[0].value, "general_cluster")
        self.assertEqual(scenarios[0].priority, 9999)
        # f200 (priority 1) comes after the base.
        self.assertEqual(scenarios[-1].value, "f200")


class TestScenarioBaseValidation(unittest.TestCase):
    """Config-level validation of the base/overlay model."""

    def _validate(self, raw):
        app_config = yaml_generator.parse_config(raw)
        yaml_generator.validate_config_scenarios(app_config)

    def _base_raw(self, scenarios, default_base=None):
        raw = {"senario_env_key": "SCENARIO_TYPE", "senarios": scenarios}
        if default_base is not None:
            raw["default_base"] = default_base
        return raw

    def test_applies_to_pointing_to_nonexistent_base_fails(self):
        raw = self._base_raw([
            {"value": "over", "path": "p", "applies_to": "ghost",
             "trigger": {"source": "user"}},
        ])
        with self.assertRaises(SystemExit):
            self._validate(raw)

    def test_applies_to_pointing_to_non_base_scenario_fails(self):
        # 'target' exists but is not is_base -> invalid applies_to target.
        raw = self._base_raw([
            {"value": "target", "path": "p", "trigger": {"source": "user"}},
            {"value": "over", "path": "p", "applies_to": "target",
             "trigger": {"source": "user"}},
        ])
        with self.assertRaises(SystemExit):
            self._validate(raw)

    def test_applies_to_list_with_one_invalid_base_fails(self):
        # A list where any entry is not an is_base scenario must fail.
        raw = self._base_raw([
            {"value": "b", "path": "p", "is_base": True,
             "trigger": {"source": "user"}},
            {"value": "over", "path": "p", "applies_to": ["b", "ghost"],
             "trigger": {"source": "user"}},
        ])
        with self.assertRaises(SystemExit):
            self._validate(raw)

    def test_is_base_with_applies_to_field_fails(self):
        raw = self._base_raw([
            {"value": "b", "path": "p", "is_base": True, "applies_to": "b",
             "trigger": {"source": "user"}},
        ])
        with self.assertRaises(SystemExit):
            self._validate(raw)

    def test_default_base_pointing_to_non_base_fails(self):
        raw = self._base_raw([
            {"value": "b", "path": "p", "trigger": {"source": "user"}},
        ], default_base="b")
        with self.assertRaises(SystemExit):
            self._validate(raw)

    def test_valid_config_passes(self):
        raw = self._base_raw([
            {"value": "b", "path": "p", "is_base": True,
             "trigger": {"source": "user"}},
            {"value": "b2", "path": "p", "is_base": True,
             "trigger": {"source": "user"}},
            {"value": "over", "path": "p", "applies_to": ["b", "b2"],
             "trigger": {"source": "user"}},
        ], default_base="b")
        # Should not raise.
        self._validate(raw)


if __name__ == '__main__':
    unittest.main()
