import unittest
import os
import sys
import json

# Add parent directory to sys.path so we can import yaml_generator
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import yaml_generator

class TestConfigFeatures(unittest.TestCase):
    def setUp(self):
        self.config_path = os.path.join(os.path.dirname(__file__), 'config_features.json')
        self.raw_config = yaml_generator.load_json(self.config_path)
        self.app_config = yaml_generator.parse_config(self.raw_config)
        self.data_dir = os.path.join(os.path.dirname(__file__), 'data')

    def load_answer_file(self, filename):
        with open(os.path.join(self.data_dir, filename), 'r') as f:
            return f.read().strip() + "\n"

    def test_override_hint_style(self):
        # Load input mock data
        nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, 'override_hint.yml.json'))
        
        # Call the generator logic
        output_lines = yaml_generator.generate_yaml_from_schema(nodes, config=self.raw_config)
        content = "\n".join(output_lines).strip() + "\n"
        
        # Load correct answer
        expected_content = self.load_answer_file('override_hint.yml')
        self.assertEqual(content, expected_content, "Override hint style generation failed.")

    def test_top_level_spacing(self):
        # Load input mock data for top level spacing tests
        nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, 'top_level_spacing.yml.json'))
        
        # Test generation with top_level_spacing configured to 3 via config
        output_lines = yaml_generator.generate_yaml_from_schema(nodes, config=self.raw_config)
        content = "\n".join(output_lines).strip() + "\n"
        
        expected_content = self.load_answer_file('top_level_spacing.yml')
        self.assertEqual(content, expected_content, "Top level spacing logic failed.")

    def test_senario_env_key(self):
        # Test how environment variables dictate scenario triggering
        
        # Case 1: Base trigger mechanism
        env_base = {self.app_config.scenario_env_key: "base"}
        active_scenarios = yaml_generator.determine_active_scenarios(self.app_config, env_base)
        active_names = [sc.value for sc in active_scenarios]
        
        # 'base' has source 'default', so it is always active (priority 9999). 
        # But 'custom' is source 'user' meaning it must be selected explicitly. So only base triggers.
        self.assertIn("base", active_names)
        self.assertNotIn("custom", active_names)

        # Case 2: Custom user trigger mechanism
        env_custom = {self.app_config.scenario_env_key: "custom"} # "TEST_ENV": "custom"
        active_scenarios = yaml_generator.determine_active_scenarios(self.app_config, env_custom)
        active_names = [sc.value for sc in active_scenarios]
        
        # Default is still active, but now user selection triggered custom.
        self.assertIn("base", active_names)
        self.assertIn("custom", active_names)

    def test_default_env_vars(self):
        # Test that proper runtime environments validate while missing ones throw SystemExit
        mock_env_valid = {
            self.app_config.scenario_env_key: "base",
            "REQUIRED_VAR": "foo"
        }
        active_scenarios = yaml_generator.determine_active_scenarios(self.app_config, mock_env_valid)
        
        # This shouldn't throw anything
        yaml_generator.validate_required_env_vars(self.app_config, active_scenarios, mock_env_valid)
        
        # This should trigger an exit code 1 because REQUIRED_VAR is missing
        mock_env_invalid = {
             self.app_config.scenario_env_key: "base"
        }
        with self.assertRaises(yaml_generator.ConfigGeneratorError) as cm:
            yaml_generator.validate_required_env_vars(self.app_config, active_scenarios, mock_env_invalid)
            
        self.assertIn("Missing required environment variables", str(cm.exception))

if __name__ == '__main__':
    unittest.main()
