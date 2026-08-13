import unittest
import os
import yaml_generator


class TestDeprecatedNull(unittest.TestCase):
    """A node whose `required` is exactly null (JSON null) is deprecated and must
    produce NO output at all -- not its value, not its description/comment, not a
    commented-out placeholder -- while `required: false` keeps its optional behavior."""

    def setUp(self):
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(self.test_dir, 'data')
        self.config_path = os.path.join(self.test_dir, 'config_deprecated.json')
        self.app_config = yaml_generator.parse_config(
            yaml_generator.load_json(self.config_path))
        self.raw_config = self.app_config.raw_config

    def load_answer_file(self, filename):
        with open(os.path.join(self.data_dir, filename), 'r') as f:
            return f.read()

    def _yaml(self, schema_file):
        nodes = yaml_generator.load_json_nodes(
            os.path.join(self.data_dir, schema_file))
        yaml_generator.substitute_env_in_default_values(nodes, {})
        lines = yaml_generator.generate_yaml_from_schema(
            nodes, config=self.raw_config)
        return "\n".join(lines).strip() + "\n"

    def _ini(self, schema_file):
        nodes = yaml_generator.load_json_nodes(
            os.path.join(self.data_dir, schema_file))
        yaml_generator.substitute_env_in_default_values(nodes, {})
        lines = yaml_generator.generate_ini_from_schema(
            nodes, config=self.raw_config)
        return "\n".join(lines).strip() + "\n"

    # --- YAML ---------------------------------------------------------------

    def test_yaml_deprecated_scalar_vanishes(self):
        content = self._yaml('deprecated.yml.json')
        # deprecated key leaves no trace: neither key, value, nor its description
        self.assertNotIn('old_key', content)
        self.assertNotIn('leftover', content)
        self.assertNotIn('this deprecated key must NOT appear', content)
        # normal key stays
        self.assertIn('keep_me: hello', content)
        # required: false path is untouched -> stays but commented out
        self.assertIn('optional_key', content)
        self.assertIn('# optional_key', content)
        # byte-for-byte
        self.assertEqual(content, self.load_answer_file('deprecated.yml'))

    def test_yaml_deprecated_object_and_nested_vanish(self):
        content = self._yaml('deprecated_object.yml.json')
        # whole deprecated object + its children gone
        self.assertNotIn('legacy_block', content)
        self.assertNotIn('inner', content)
        # deprecated nested key gone, siblings kept
        self.assertNotIn('legacy_dns', content)
        self.assertNotIn('8.8.8.8', content)
        self.assertIn('gateway: "10.0.0.1"', content)
        self.assertEqual(content, self.load_answer_file('deprecated_object.yml'))

    # --- INI ----------------------------------------------------------------

    def test_ini_deprecated_var_and_section_vanish(self):
        content = self._ini('deprecated.ini.json')
        self.assertNotIn('old_flag', content)
        self.assertNotIn('old_group', content)
        self.assertIn('l4lb_enable=true', content)
        self.assertIn('l4lb_ip=100.0.0.1', content)
        self.assertEqual(content, self.load_answer_file('deprecated.ini'))

    # --- Scenario merge (e.g. default + fab200mm) --------------------------

    def test_merge_override_deprecates_base_key(self):
        """When a higher-priority scenario overrides a normal base key with
        `required: null`, the merged key is deprecated and must not appear.
        This mirrors default's `env` being deprecated by fab200mm's `env`."""
        base = yaml_generator.load_json_nodes(
            os.path.join(self.data_dir, 'merge_base.yml.json'))
        override = yaml_generator.load_json_nodes(
            os.path.join(self.data_dir, 'merge_override.yml.json'))
        merged = yaml_generator.merge_nodes(base, override)

        env_node = next(n for n in merged if n.key == 'env')
        self.assertTrue(yaml_generator.is_node_deprecated(env_node))

        yaml_generator.substitute_env_in_default_values(merged, {})
        content = "\n".join(
            yaml_generator.generate_yaml_from_schema(
                merged, config=self.raw_config)).strip() + "\n"
        self.assertNotIn('env', content)
        self.assertIn('region: tw', content)
        self.assertEqual(content, self.load_answer_file('merge_result.yml'))


if __name__ == '__main__':
    unittest.main()
