import unittest
import os
import sys

# Add parent directory to sys.path so we can import yaml_generator
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import yaml_generator

class TestSchemaParams(unittest.TestCase):
    def setUp(self):
        self.config_path = os.path.join(os.path.dirname(__file__), 'config_schema_params.json')
        self.raw_config = yaml_generator.load_json(self.config_path)
        self.app_config = yaml_generator.parse_config(self.raw_config)
        self.data_dir = os.path.join(os.path.dirname(__file__), 'data')

        # Mock standard environment configuration
        self.mock_env = {
            "TEST_USER": "Alice",
            "NODE_ID": "123"
        }

    def load_answer_file(self, filename):
        with open(os.path.join(self.data_dir, filename), 'r') as f:
            return f.read().strip() + "\n"

    def _generate_and_compare(self, schema_file, ans_file):
        nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, schema_file))
        
        # Merge logic (to simulate full run logic)
        yaml_generator.substitute_env_in_default_values(nodes, self.mock_env)
        
        output_lines = yaml_generator.generate_yaml_from_schema(nodes, config=self.raw_config)
        content = "\n".join(output_lines).strip() + "\n"
        
        expected_content = self.load_answer_file(ans_file)
        self.assertEqual(content, expected_content)

    def _merge_and_compare(self, base_file, override_file, ans_file):
        base_nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, base_file))
        override_nodes = yaml_generator.load_json_nodes(os.path.join(self.data_dir, override_file))
        
        merged_nodes = yaml_generator.merge_nodes(base_nodes, override_nodes)
        
        yaml_generator.substitute_env_in_default_values(merged_nodes, self.mock_env)
        
        output_lines = yaml_generator.generate_yaml_from_schema(merged_nodes, config=self.raw_config)
        content = "\n".join(output_lines).strip() + "\n"
        
        expected_content = self.load_answer_file(ans_file)
        self.assertEqual(content, expected_content)

    def test_key_and_description(self):
        # 1 & 2: Tests key and description normal operation
        self._generate_and_compare('key_desc.yml.json', 'key_desc.yml')

    def test_override_strategy_merge(self):
        # 3: Tests override_strategy 'merge'. Sub-keys 'a' and 'b' should be merged with 'c'
        self._merge_and_compare('override_base.yml.json', 'override_merge.yml.json', 'override_merge.yml')

    def test_override_strategy_replace(self):
        # 4: Tests override_strategy 'replace'. Children should be discarded, only 'x' and 'y' remain
        self._merge_and_compare('override_base.yml.json', 'override_replace.yml.json', 'override_replace.yml')

    def test_default_value_vs_regex_fallback(self):
        # 5: Tests default_value triggers properly. If missing, regex pulls fallback string logic
        self._generate_and_compare('fallback.yml.json', 'fallback.yml')

    def test_env_var_substitution(self):
        # 6 & 7: default_value replaces ${VARS}, but regex ignores ${VARS}.
        self._generate_and_compare('env_sub.yml.json', 'env_sub.yml')

    def test_children_recursion(self):
        # 8: In override_base.yml.json, 'test_override' has children 'a' and 'b'. 
        # The fact that it renders nested under 'test_override:' successfully tests children recursion logic.
        self._generate_and_compare('override_base.yml.json', 'override_base.yml')

    def test_multiline_description(self):
        # 9: Ensure \n characters inside 'description' render correctly into stacked YAML comments
        self._generate_and_compare('multiline_desc.yml.json', 'multiline_desc.yml')

    def test_multi_type_conflict_validation(self):
        # 10: multi_type vs item_multi_type logic.
        # If multi_type has BOTH 'object' and 'list', yaml_generator throws an error and exits.
        
        invalid_node = [{
            "key": "bad_node",
            "required": True,
            "multi_type": ["object", "list"]
        }]
        
        with self.assertRaises(SystemExit) as cm:
            yaml_generator.generate_yaml_from_schema(invalid_node, config=self.raw_config)
            
        self.assertEqual(cm.exception.code, 1, "Failed to exit when 'object' and 'list' coexist in multi_type")

    def test_empty_containers(self):
        # 11: Ensure empty objects {} and lists [] are on the same line as the key
        self._generate_and_compare('empty_containers.yml.json', 'empty_containers.yml')

    def test_block_scalars(self):
        # 12: Ensure multi-line strings use block scalar | and correct hint placement
        self._generate_and_compare('block_scalar.yml.json', 'block_scalar.yml')

if __name__ == '__main__':
    unittest.main()
