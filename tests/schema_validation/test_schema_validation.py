import unittest
import os
import yaml_generator

class TestSchemaValidation(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(self.test_dir, 'data')

    def test_missing_key(self):
        path = os.path.join(self.data_dir, 'missing_key.yml.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("missing 'key' attribute" in e for e in errors))

    def test_missing_multi_type(self):
        path = os.path.join(self.data_dir, 'missing_multi_type.yml.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("missing 'multi_type' attribute" in e for e in errors))

    def test_list_missing_item_type(self):
        path = os.path.join(self.data_dir, 'list_missing_item_type.yml.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("'multi_type' contains 'list' but 'item_multi_type' is empty" in e for e in errors))

    def test_object_with_item_type(self):
        path = os.path.join(self.data_dir, 'object_with_item_type.yml.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("'multi_type' contains 'object' but 'item_multi_type' is not empty" in e for e in errors))

    def test_conflict_list_object(self):
        path = os.path.join(self.data_dir, 'conflict_list_object.yml.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("'multi_type' cannot contain both 'object' and 'list'" in e for e in errors))

    def test_legacy_type_field(self):
        # Dynamically create a legacy node
        legacy_node = [{"key": "legacy", "type": "string", "multi_type": ["string"]}]
        errors = yaml_generator.validate_schema(legacy_node, "legacy.json")
        self.assertTrue(any("legacy 'type' field found" in e for e in errors))

    # INI Specific Tests
    def test_invalid_ini_root(self):
        path = os.path.join(self.data_dir, 'invalid_ini_root.ini.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("invalid INI root key" in e for e in errors))

    def test_groups_child_not_list(self):
        path = os.path.join(self.data_dir, 'groups_child_not_list.ini.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("node under INI 'groups' must have 'multi_type' containing 'list'" in e for e in errors))

    def test_groups_child_not_object(self):
        path = os.path.join(self.data_dir, 'groups_child_not_object.ini.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("node under INI 'groups' must have 'item_multi_type' containing 'object'" in e for e in errors))

    def test_aggregations_child_not_list(self):
        path = os.path.join(self.data_dir, 'aggregations_child_not_list.ini.json')
        data = yaml_generator.load_json(path)
        errors = yaml_generator.validate_schema(data, path)
        self.assertTrue(any("node under INI 'aggregations' must have 'multi_type' containing 'list'" in e for e in errors))

if __name__ == '__main__':
    unittest.main()
