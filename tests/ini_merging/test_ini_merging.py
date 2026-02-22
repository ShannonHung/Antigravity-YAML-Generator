import unittest
import os
import copy
import yaml_generator

class TestIniMerging(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(self.test_dir, 'data')
        self.config_path = os.path.join(self.test_dir, 'config_ini_merging.json')
        
        self.app_config = yaml_generator.parse_config(yaml_generator.load_json(self.config_path))
        self.raw_config = self.app_config.raw_config

    def load_answer_file(self, filename):
        with open(os.path.join(self.data_dir, filename), 'r') as f:
            return f.read()

    def test_priority_merging_ini_schema(self):
        base_nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, 'base.ini.json'))
        override_nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, 'override.ini.json'))
        
        # Priority mapping: override_nodes merges into base_nodes
        # Default override_strategy in typical schemas is 'merge', but we declared 'replace' explicitly on 'worker'
        merged_nodes = copy.deepcopy(base_nodes)
        yaml_generator.merge_nodes(merged_nodes, override_nodes)
        
        yaml_generator.substitute_env_in_default_values(merged_nodes, {})
        
        output_lines = yaml_generator.generate_ini_from_schema(merged_nodes, config=self.raw_config)
        content = "\n".join(output_lines).strip() + "\n"
        
        expected_content = self.load_answer_file('expected_merge.ini')
        self.assertEqual(content, expected_content)

if __name__ == '__main__':
    unittest.main()
