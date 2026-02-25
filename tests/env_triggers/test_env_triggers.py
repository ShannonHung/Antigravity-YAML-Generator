import unittest
import os
import sys

# Add parent directory to sys.path so we can import yaml_generator
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import yaml_generator

class TestEnvTriggers(unittest.TestCase):
    def setUp(self):
        self.config_path = os.path.join(os.path.dirname(__file__), 'config_env_triggers.json')
        self.raw_config = yaml_generator.load_json(self.config_path)
        self.app_config = yaml_generator.parse_config(self.raw_config)

    def test_env_trigger_priority(self):
        # We supply 'TEST_TRIGGER: active'. 
        # This triggers BOTH p1_scenario (priority=1) and p5_scenario (priority=5)
        # We also need P5_REQUIRED to satisfy p5_scenario so it doesn't fail early.
        mock_env = {
            "TEST_TRIGGER": "active",
            "P5_REQUIRED": "present"
            # Note scenario base is Priority 9999 by default.
        }
        
        active_scenarios = yaml_generator.determine_active_scenarios(self.app_config, mock_env)
        active_names = [sc.value for sc in active_scenarios]
        active_priorities = [sc.priority for sc in active_scenarios]
        
        # 'base' is default, plus the two triggered ones.
        self.assertEqual(len(active_scenarios), 3)
        self.assertIn("base", active_names)
        self.assertIn("p1_scenario", active_names)
        self.assertIn("p5_scenario", active_names)
        
        # Priorities should be sorted descending (highest number wins, applies LAST? Wait.
        # User requested: "priority: 數字越小，優先序越大" -> small number = High priority.
        # Our generator sorts descending (9999, 100, 2, 1). So when applied in order (0 to len-1):
        # 1st: base (9999)
        # 2nd: p5 (5)
        # 3rd: p1 (1) -> Smallest priority number is applied LAST, overwriting everything before it.
        # Therefore, the list should physically look like [9999, 5, 1].
        
        self.assertEqual(active_priorities, [9999, 5, 1], "Active scenarios did not sort priority in Correct Base -> P5 -> P1 Override order.")

    def test_env_trigger_priority_merge(self):
        # We simulate a scenario where base, p5, and p1 are active.
        # We want to verify that nodes with the same 'key' are overridden by the scenario with the smallest priority number.
        mock_env = {
            "TEST_TRIGGER": "active",
            "P5_REQUIRED": "present"
        }
        active_scenarios = yaml_generator.determine_active_scenarios(self.app_config, mock_env)
        
        # active_scenarios should be ordered: base (9999), p5 (5), p1 (1)
        
        # Mock node structures for each scenario having the SAME key
        mock_file_data = {
            "base": [{"key": "shared_key", "default_value": "from_base"}],
            "p5_scenario": [{"key": "shared_key", "default_value": "from_p5", "override_strategy": "merge"}],
            "p1_scenario": [{"key": "shared_key", "default_value": "from_p1", "override_strategy": "merge"}]
        }
        
        # Simulate `generate_output_files` sequential merge loop behavior
        merged_nodes = []
        for sc in active_scenarios:
            nodes = mock_file_data.get(sc.value, [])
            merged_nodes = yaml_generator.merge_nodes(merged_nodes, nodes)
            
        # The final merged_nodes should have 'shared_key' with value 'from_p1' because p1 has the smallest priority number (1)
        self.assertEqual(len(merged_nodes), 1)
        self.assertEqual(merged_nodes[0]['default_value'], "from_p1", "Priority merge failed: smallest priority number did not override the base value.")


    def test_env_trigger_required_vars(self):
        # We supply 'TEST_TRIGGER: active' triggering p5_scenario
        # but DELIBERATELY omit 'P5_REQUIRED' which is required by p5_scenario.
        mock_env = {
            "TEST_TRIGGER": "active"
        }
        active_scenarios = yaml_generator.determine_active_scenarios(self.app_config, mock_env)
        
        with self.assertRaises(yaml_generator.ConfigGeneratorError) as cm:
            yaml_generator.validate_required_env_vars(self.app_config, active_scenarios, mock_env)
            
        self.assertIn("Missing required environment variables", str(cm.exception))

    def test_env_trigger_logic_and(self):
        # Case 1: Partial match (should NOT trigger)
        mock_env_partial = {
            "COND_A": "foo",
            "COND_B": "miss"
        }
        active_scenarios_partial = yaml_generator.determine_active_scenarios(self.app_config, mock_env_partial)
        active_names_partial = [sc.value for sc in active_scenarios_partial]
        self.assertNotIn("and_logic_scenario", active_names_partial)

        # Case 2: Full match (SHOULD trigger)
        mock_env_full = {
            "COND_A": "foo",
            "COND_B": "bar"
        }
        active_scenarios_full = yaml_generator.determine_active_scenarios(self.app_config, mock_env_full)
        active_names_full = [sc.value for sc in active_scenarios_full]
        self.assertIn("and_logic_scenario", active_names_full)

    def test_env_trigger_logic_or(self):
        # Case 1: No match (should NOT trigger)
        mock_env_none = {
            "COND_C": "miss",
            "COND_D": "miss"
        }
        active_scenarios_none = yaml_generator.determine_active_scenarios(self.app_config, mock_env_none)
        active_names_none = [sc.value for sc in active_scenarios_none]
        self.assertNotIn("or_logic_scenario", active_names_none)

        # Case 2: Partial match on C (SHOULD trigger)
        mock_env_match_c = {
            "COND_C": "baz",
            "COND_D": "miss"
        }
        active_scenarios_c = yaml_generator.determine_active_scenarios(self.app_config, mock_env_match_c)
        active_names_c = [sc.value for sc in active_scenarios_c]
        self.assertIn("or_logic_scenario", active_names_c)

        # Case 3: Partial match on D (SHOULD trigger)
        mock_env_match_d = {
            "COND_C": "miss",
            "COND_D": "qux"
        }
        active_scenarios_d = yaml_generator.determine_active_scenarios(self.app_config, mock_env_match_d)
        active_names_d = [sc.value for sc in active_scenarios_d]
        self.assertIn("or_logic_scenario", active_names_d)

if __name__ == '__main__':
    unittest.main()
