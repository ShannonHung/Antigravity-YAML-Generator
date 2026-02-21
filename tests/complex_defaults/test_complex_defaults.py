import unittest
import os
import json
import yaml_generator
from yaml_generator import AppConfig

class TestComplexDefaults(unittest.TestCase):
    def setUp(self):
        # Set paths relative to this file
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(self.test_dir, 'data')
        self.config_path = os.path.join(self.test_dir, 'config_complex.json')
        
        # Load app config
        self.app_config = yaml_generator.parse_config(yaml_generator.load_json(self.config_path))
        self.raw_config = self.app_config.raw_config

    def load_answer_file(self, filename):
        with open(os.path.join(self.data_dir, filename), 'r') as f:
            return f.read()

    def _generate_and_compare(self, schema_file, ans_file):
        nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, schema_file))
        
        # Merge logic (to simulate full run logic)
        yaml_generator.substitute_env_in_default_values(nodes, {})
        
        output_lines = yaml_generator.generate_yaml_from_schema(nodes, config=self.raw_config)
        content = "\n".join(output_lines).strip() + "\n"
        
        expected_content = self.load_answer_file(ans_file)
        self.assertEqual(content, expected_content)

    def test_dns_complex_default_generation(self):
        # Parses dns_scenario.yml.json ensuring complex dictionaries mapping to 'default_value' output perfectly
        self._generate_and_compare('dns_scenario.yml.json', 'dns_scenario.yml')

if __name__ == '__main__':
    unittest.main()
