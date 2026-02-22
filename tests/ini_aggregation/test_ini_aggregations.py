import unittest
import os
import json
import yaml_generator
from yaml_generator import AppConfig

class TestIniAggregations(unittest.TestCase):
    def setUp(self):
        # Set paths relative to this file
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(self.test_dir, 'data')
        self.config_path = os.path.join(self.test_dir, 'config_ini.json')
        
        # Load app config
        self.app_config = yaml_generator.parse_config(yaml_generator.load_json(self.config_path))
        self.raw_config = self.app_config.raw_config

    def load_answer_file(self, filename):
        with open(os.path.join(self.data_dir, filename), 'r') as f:
            return f.read()

    def _generate_and_compare(self, schema_file, ans_file):
        nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, schema_file))
        
        # Simulating standard text substitution
        yaml_generator.substitute_env_in_default_values(nodes, {})
        
        # Note we are asserting against the explicit INI generator
        output_lines = yaml_generator.generate_ini_from_schema(nodes, config=self.raw_config)
        content = "\n".join(output_lines).strip() + "\n"
        
        expected_content = self.load_answer_file(ans_file)
        self.assertEqual(content, expected_content)

    def test_ini_multiple_children_iteration(self):
        # Verify the generator does not return immediately after encountering the first aggregation child group
        self._generate_and_compare('aggregations.ini.json', 'aggregations.ini')

    def test_global_vars(self):
        # Verify output structure and simple substitution when block is global_vars
        self._generate_and_compare('global_vars.ini.json', 'global_vars.ini')

    def test_groups_with_defaults(self):
        # Verify group lists print using defined explicit default_values
        self._generate_and_compare('groups_defaults.ini.json', 'groups_defaults.ini')
        
    def test_groups_fallback_children(self):
        # Verify group lists print mapping to nested children nodes explicitly merging regex or defaults when absent
        self._generate_and_compare('groups_fallback.ini.json', 'groups_fallback.ini')

if __name__ == '__main__':
    unittest.main()
