import os
import sys
import json
import re
import shutil
import yaml
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union

class ConfigGeneratorError(Exception):
    """Custom exception centralizing error handling for config generator."""
    pass

class NodeType(str, Enum):
    OBJECT = "object"
    LIST = "list"
    STRING = "string"
    BOOL = "bool"
    NUMBER = "number"

class OverrideStrategy(str, Enum):
    MERGE = "merge"
    REPLACE = "replace"

class TriggerSource(str, Enum):
    USER = "user"
    DEFAULT = "default"
    ENV = "env"

class TriggerLogic(str, Enum):
    AND = "and"
    OR = "or"

@dataclass
class SchemaNode:
    key: str
    multi_type: List[str] = field(default_factory=list)
    item_multi_type: List[str] = field(default_factory=list)
    description: str = ""
    default_value: Any = None
    required: bool = True
    override_strategy: str = "merge"
    override_hint: bool = False
    is_override: bool = False
    regex_enable: bool = False
    regex: Optional[str] = None
    condition: Optional[Dict[str, Any]] = None
    children: List['SchemaNode'] = field(default_factory=list)

    def __getitem__(self, key):
        """Temporary compatibility for tests subscripting nodes."""
        return getattr(self, key)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'SchemaNode':
        if not isinstance(d, dict):
            return d
            
        children_data = d.get("children", [])
        children = [cls.from_dict(c) for c in children_data]
        return cls(
            key=d.get("key", ""),
            multi_type=d.get("multi_type", []),
            item_multi_type=d.get("item_multi_type", []),
            description=d.get("description", ""),
            default_value=d.get("default_value"),
            required=d.get("required", True),
            override_strategy=d.get("override_strategy", "merge"),
            override_hint=d.get("override_hint", False), 
            is_override=d.get("is_override", False),
            regex_enable=d.get("regex_enable", False),
            regex=d.get("regex"),
            condition=d.get("condition"),
            children=children
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert back to dict for legacy compatibility if needed."""
        return {
            "key": self.key,
            "multi_type": self.multi_type,
            "item_multi_type": self.item_multi_type,
            "description": self.description,
            "default_value": self.default_value,
            "required": self.required,
            "override_strategy": self.override_strategy,
            "condition": self.condition,
            "override_hint": self.override_hint,
            "regex_enable": self.regex_enable,
            "regex": self.regex,
            "children": [c.to_dict() for c in self.children]
        }

# Ensure consistent ordering in output if possible, though PyYAML handles dicts well.
# We are [INFO] Generating text manually for the complex schema-based JSONs to support comments.

def load_env() -> Dict[str, str]:
    """
    Load environment variables into a detached dictionary.

    Why: We need a mutable snapshot of environment variables to perform string 
    substitution on templates without risking accidental mutation of the actual system `os.environ`.

    Returns:
        Dict[str, str]: A dictionary containing a copy of all current environment variables.
    """
    return dict(os.environ)

def resolve_path_vars(path_template: str, env: Dict[str, str]) -> str:
    """
    Substitute variables in the form of `{VAR}` within a path template.

    Why: Output configuration files often need dynamic paths based on the current scenario 
    or environment (e.g., placing configs into scenario-specific folders). We separate path 
    resolution from content resolution because paths use `{VAR}` syntax while content uses `${VAR}`.

    Args:
        path_template (str): The file path containing placeholders like `/tmp/{SCENARIO_TYPE}/config.yml`.
        env (Dict[str, str]): Environment variables to pull values from.

    Returns:
        str: The resolved absolute or relative file path.
        
    Example:
        >>> resolve_path_vars("/etc/{ENV}/config.yml", {"ENV": "prod"})
        '/etc/prod/config.yml'
    """
    for key, value in env.items():
        placeholder = f"{{{key}}}"
        if placeholder in path_template:
            path_template = path_template.replace(placeholder, value)
    
    if re.search(r"\{[A-Z0-9_]+\}", path_template):
        print(f"\033[93m[WARNING] Unresolved placeholders in path: {path_template}\033[0m")
    return path_template

def resolve_content_vars(content: str, env: Dict[str, str]) -> str:
    """
    Substitute variables in the form of `${VAR}` within file content.

    Why: Simulates `envsubst` behavior for raw configuration templates. This allows 
    interpolating system states into static text files before they are written.

    Args:
        content (str): The raw string content of a file or a value.
        env (Dict[str, str]): Environment variables mapping.

    Returns:
        str: The resolved content.
    """
    for key, value in env.items():
        placeholder = f"${{{key}}}"
        if placeholder in content:
            content = content.replace(placeholder, str(value))
            
    unresolved_match = re.search(r"\$\{[A-Z0-9_]+\}", content)
    if unresolved_match:
        print(f"\033[93m[WARNING] Unresolved variable placeholders in content {unresolved_match.group(0)}.\033[0m")
    return content

def load_json(path: str) -> Dict[str, Any]:
    """
    Load JSON content from a path into a dictionary.

    Why: Standardized JSON reading entry point to ease mocking in tests and ensure consistent file handle closure.

    Args:
        path (str): The file path.

    Returns:
        Dict[str, Any]: The loaded JSON object.
        
    Raises:
        FileNotFoundError: If the file does not exist.
        json.JSONDecodeError: If the file is not valid JSON.
    """
    with open(path, 'r') as f:
        return json.load(f)

def substitute_env_in_default_values(nodes: List[SchemaNode], env: Dict[str, str]) -> None:
    """
    Recursively mutate schema nodes to resolve environment variables in `default_value` attrs.

    Why: Schemas are static logic gates, but their default fallbacks usually depend on the environment. 
    By running this, we dynamically bridge static schemas and dynamic environments.
    Technical Limit: Recursive traversal is required because schema nodes define deep tree structures.

    Args:
        nodes (List[SchemaNode]): The schema nodes to process.
        env (Dict[str, str]): Environment variables map.
    """
    for node in nodes:
        default_val = node.default_value
        if default_val is not None and default_val != "":
            if isinstance(default_val, str):
                node.default_value = resolve_content_vars(default_val, env)
            elif isinstance(default_val, dict):
                node.default_value = _resolve_dict_strings(default_val, env)
            elif isinstance(default_val, list):
                node.default_value = _resolve_list_strings(default_val, env)
        if node.children:
            substitute_env_in_default_values(node.children, env)

def _resolve_dict_strings(d: Dict[str, Any], env: Dict[str, str]) -> Dict[str, Any]:
    """
    Internal: Deep crawl a dictionary to resolve strings. 
    Business case: Default values can be complex nested objects under `multi_type: ["object"]`.
    """
    new_d = {}
    for k, v in d.items():
        if isinstance(v, str):
            new_d[k] = resolve_content_vars(v, env)
        elif isinstance(v, dict):
            new_d[k] = _resolve_dict_strings(v, env)
        elif isinstance(v, list):
            new_d[k] = _resolve_list_strings(v, env)
        else:
            new_d[k] = v
    return new_d

def _resolve_list_strings(lst: List[Any], env: Dict[str, str]) -> List[Any]:
    """
    Internal: Deep crawl a list to resolve strings.
    """
    new_l = []
    for v in lst:
        if isinstance(v, str):
            new_l.append(resolve_content_vars(v, env))
        elif isinstance(v, dict):
            new_l.append(_resolve_dict_strings(v, env))
        elif isinstance(v, list):
            new_l.append(_resolve_list_strings(v, env))
        else:
            new_l.append(v)
    return new_l

def load_json_nodes(path: str) -> List[SchemaNode]:
    """
    Parse a JSON schema into strong typed SchemaNode objects.

    Why: Unstructured dictionaries lead to KeyError hazards. Mapping dynamically 
    loaded JSON templates into `SchemaNode` guarantees attribute existence and default values structure.

    Args:
        path (str): The file path to the JSON schema.

    Returns:
        List[SchemaNode]: A list of initialized schema nodes representing the configuration tree.
    """
    with open(path, 'r') as f:
        data = json.load(f)
    if isinstance(data, list):
        return [SchemaNode.from_dict(n) for n in data]
    return [SchemaNode.from_dict(data)]

def save_file(path: str, content: str) -> None:
    """
    Write generated content to a file safely.

    Why: Config generation is often a one-time scaffolding operation. If a user 
    has subsequently modified a generated file, we intentionally refuse to overwrite it 
    to prevent data loss and frustration.

    Args:
        path (str): Target file path.
        content (str): The raw string content to write.
    """
    if os.path.exists(path):
        print(f"\033[93m[WARNING] File {path} already exists. Skipping.\033[0m")
        return

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)

def merge_nodes(source_nodes: List[Union[Dict[str, Any], SchemaNode]], override_nodes: Union[List[Union[Dict[str, Any], SchemaNode]], Union[Dict[str, Any], SchemaNode]]) -> List[SchemaNode]:
    """
    Deep-merge configuration override scenarios into a base schema structure.
    """
    source_nodes = [SchemaNode.from_dict(s) if isinstance(s, dict) else s for s in source_nodes]
    source_map = {item.key: item for item in source_nodes if item.key}
    
    if not isinstance(override_nodes, list):
        override_nodes = [override_nodes]
        
    for override_raw in override_nodes:
        override = SchemaNode.from_dict(override_raw) if isinstance(override_raw, dict) else override_raw
        if not override.key:
            continue
            
        if override.key in source_map:
            _merge_single_node(source_map[override.key], override)
        else:
            source_nodes.append(override)
            source_map[override.key] = override
            
    return source_nodes

def _merge_single_node(base: SchemaNode, override: SchemaNode) -> None:
    """
    Merge properties from an override node into a base node inplace.
    
    Why: Handles scenario-based override cascades. When an environment dictates a change 
    to a default schema value, this method seamlessly transplants priority values and metadata 
    onto the base tree, replacing children entirely if 'replace' override strategy is specified.
    """
    # Update properties (excluding children)
    if override.multi_type: base.multi_type = override.multi_type
    if override.item_multi_type: base.item_multi_type = override.item_multi_type
    if override.description: base.description = override.description
    if override.default_value is not None: base.default_value = override.default_value
    base.required = override.required
    if override.override_strategy: base.override_strategy = override.override_strategy
    base.override_hint = override.override_hint
    base.is_override = override.is_override
    base.regex_enable = override.regex_enable
    if override.regex: base.regex = override.regex
    if override.condition: base.condition = override.condition
    
    if override.children is not None:
        if override.override_strategy == OverrideStrategy.REPLACE.value:
            base.children = override.children
        else:
            if base.children:
                base.children = merge_nodes(base.children, override.children)
            else:
                base.children = override.children

def format_smart_quoted_string(data: Any) -> str:
    """
    Format strings with minimal necessary quoting to prevent YAML/INI syntax errors.

    Why: The standard PyYAML dumper adds quotes very aggressively (e.g. around IP addresses or Unix paths). 
    We want to yield highly readable, human-like YAML/INI configs, so we selectively omit quotes 
    unless structural integrity requires it (e.g. strings containing `#`, `:`, or `{}`).

    Args:
        data (Any): The raw value to convert into a smart-quoted string.

    Returns:
        str: The safely quoted (or unquoted) string output.
    """
    if data is None: return ""
    v_str = str(data)
    
    if not v_str or not v_str.strip():
        return f'"{v_str}"'
        
    if re.match(r'^(true|false|yes|no|on|off)$', v_str, re.IGNORECASE):
        return v_str
        
    if "\n" in v_str:
        return yaml.dump(v_str, default_style='|').strip()

    restricted_start = ('"', "'", '*', '&', '!', '?', '-', '<', '>', '%', '@', '`')
    dangerous_chars = ('#', ':', '{', '}', '[', ']', ',')
    
    needs_quotes = False
    
    if v_str.startswith(restricted_start) or v_str.startswith(' ') or v_str.endswith(' '):
        needs_quotes = True
    elif any(c in v_str for c in dangerous_chars):
        needs_quotes = True
        
    if needs_quotes:
        if not (v_str.startswith('"') and v_str.endswith('"')):
            return f'"{v_str}"'
            
    return v_str

def quoted_str_representer(dumper: yaml.Dumper, data: str) -> yaml.ScalarNode:
    """
    Custom YAML dumper hook utilizing `format_smart_quoted_string`.

    Why: To ensure that any dict or list structurally offloaded back to `yaml.dump` 
    retains our smart-quoting rules globally. We register this globally so basic PyYAML 
    doesn't break our formatting convention.

    Args:
        dumper (yaml.Dumper): PyYAML dumper instance.
        data (str): The scalar string.

    Returns:
        yaml.ScalarNode: Represented YAML scalar.
    """
    if "\n" in data:
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
        
    formatted = format_smart_quoted_string(data)
    if formatted.startswith('"') and formatted.endswith('"'):
        clean_val = formatted[1:-1]
        return dumper.represent_scalar('tag:yaml.org,2002:str', clean_val, style='"')
    else:
        return dumper.represent_scalar('tag:yaml.org,2002:str', data)

# Register the custom representer
yaml.add_representer(str, quoted_str_representer)

def format_yaml_value(value: Any, indent_level: int, val_type: Optional[str] = None) -> str:
    """
    Manually format a python value into a valid YAML string recursively.

    Why: The default `yaml.dump` struggles to produce aesthetically pleasing 
    human-readable indentation for lists nested inside objects. By manually 
    assembling the output string, we gain absolute control over the character-perfect styling.

    Args:
        value (Any): The python object (dict, list, str, bool, int) to format.
        indent_level (int): Current depth in the YAML tree, where each level is 2 spaces in the parent.
        val_type (Optional[str]): The target schema type (e.g., 'string', 'bool', 'number').

    Returns:
        str: The pre-formatted multi-line or single-line YAML text representing the value.
    """
    prefix = "  " * (indent_level + 1)
    
    if value is None:
        return ""

    if val_type == 'bool':
        return str(value).lower()
    if val_type == 'number':
        return str(value)

    if isinstance(value, dict):
        return _format_yaml_dict_value(value, indent_level, prefix)
        
    if isinstance(value, list):
        return _format_yaml_list_value(value, indent_level, prefix)

    if isinstance(value, str) and "\n" in value:
        return _format_yaml_multiline_string(value, indent_level, prefix)

    return _format_yaml_scalar_string(value)

def _format_yaml_dict_value(value: dict, indent_level: int, prefix: str) -> str:
    """
    Serializes a Python dictionary payload into proper YAML object strings.
    
    Why: When nodes provide raw JSON/dict default_values instead of declarative `children` nodes, 
    this recursive method dynamically transforms those implicit sub-trees into compliant YAML,
    maintaining indentation context and preserving quoting rules identically to schema-driven nodes.
    """
    if not value:
        return "{}"
    lines = []
    for k, v in value.items():
        formatted_k = format_yaml_value(k, -1, 'string').strip()
        if isinstance(v, (dict, list)):
            child_val = format_yaml_value(v, indent_level + 1)
            if child_val.startswith("\n"):
                lines.append(f"{prefix}{formatted_k}:{child_val}")
            else:
                lines.append(f"{prefix}{formatted_k}: {child_val}")
        else:
            formatted_v = format_yaml_value(v, -1, 'string').strip()
            if "\n" in formatted_v:
                parts = formatted_v.split("\n", 1)
                lines.append(f"{prefix}{formatted_k}: {parts[0]}")
                for sub_line in parts[1].splitlines():
                    lines.append(f"{prefix}  {sub_line}")
            else:
                lines.append(f"{prefix}{formatted_k}: {formatted_v}")
    return "\n" + "\n".join(lines)

def _format_yaml_list_value(value: list, indent_level: int, prefix: str) -> str:
    """
    Serializes a Python list payload into proper YAML list strings.
    
    Why: Maps structural list defaults without predefined schema nodes into clean YAML array configurations.
    Complex list items (like dicts) are dumped via PyYAML and then manually indented to maintain 
    alignment with the handcrafted YAML document structure our generator builds.
    """
    if not value:
        return "[]"
    lines = []
    for item in value:
        if isinstance(item, (dict, list)):
            item_yaml = yaml.dump(item, default_flow_style=False, width=1000).rstrip()
            item_lines = item_yaml.splitlines()
            lines.append(f"{prefix}- {item_lines[0]}")
            for sub_line in item_lines[1:]:
                lines.append(f"{prefix}  {sub_line}")
        else:
            formatted_item = format_yaml_value(item, -1, 'string').strip()
            if "\n" in formatted_item:
                parts = formatted_item.split("\n", 1)
                lines.append(f"{prefix}- {parts[0]}")
                for sub_line in parts[1].splitlines():
                    lines.append(f"{prefix}  {sub_line}")
            else:
                lines.append(f"{prefix}- {formatted_item}")
    return "\n" + "\n".join(lines)

def _format_yaml_multiline_string(value: str, indent_level: int, prefix: str) -> str:
    """
    Formats strings with newlines into YAML block scalars (|, >).
    
    Why: Using PyYAML to infer the correct block scalar indicator preserves trailing newlines safely 
    while bypassing ugly explicit '\n' escapes in generated configuration files. The output is then
    indented perfectly to fit into the parent context.
    """
    s = yaml.dump(value, default_flow_style=False)
    lines = s.splitlines()
    if lines and lines[0].strip() in ('|', '|-', '|+', '>', '>-', '>+'):
        indicator = lines[0].strip()
        content_lines = lines[1:]
        content_prefix = "  " * indent_level
        return f" {indicator}\n" + "\n".join([f"{content_prefix}{l}" for l in content_lines])
    return "\n" + "\n".join([f"{prefix}{line}" for line in lines])

def _format_yaml_scalar_string(value: Any) -> str:
    """
    Dynamically escapes and quotes primitive string values based on strict heuristics.
    
    Why: Ansible templates and standard YAML parsers are sensitive to certain keywords (true/false) 
    and special syntax characters (: # { [). This function applies defensive quoting specifically 
    when unquoted values might collapse into native types or break YAML parsers.
    """
    s_val = str(value)
    if (s_val.startswith('"') and s_val.endswith('"')) or (s_val.startswith("'") and s_val.endswith("'")):
        return s_val

    has_env_sub = re.search(r'\$\{?[\w]+\}?', s_val)
    needs_quotes = False
    
    if not s_val: needs_quotes = True
    elif re.match(r'^(true|false|yes|no|on|off)$', s_val, re.IGNORECASE): needs_quotes = True
    elif re.match(r'^[\d\.]+$', s_val): needs_quotes = True
    elif any(c in s_val for c in ":#[]{}/| !") or has_env_sub:
        needs_quotes = True
        
    if needs_quotes:
        escaped = s_val.replace('"', '\\"')
        return f'"{escaped}"'
    return s_val
    
def get_override_hint_style(config: Optional[Dict[str, Any]], default_style: str = "<=== [Override]") -> str:
    """
    Extract the override hint string from configuration.

    Why: Allows users to optionally customize the string appended to keys that were 
    overwritten by scenarios. This drastically improves config auditability when multiple 
    scenarios are merged into one file.

    Args:
        config (Optional[Dict[str, Any]]): The raw generator configuration dictionary.
        default_style (str): The fallback string.

    Returns:
        str: The formatted override hint, safely prefixed with a comment character.
    """
    if config:
        style = config.get("override_hint_style", default_style)
        if not style.strip().startswith("#") and not style.strip().startswith(";"):
            # Default to # if not specified
            return f"# {style}"
        return style
    return f"# {default_style}"

def get_override_hint(node: Any, hint_marker: str) -> str:
    """
    Evaluate if an override hint should be yielded for a specific node.

    Why: Not all overriden nodes need hints (e.g., if `override_hint: False` is set). 
    This gracefully extracts the boolean and returns the formatted hint string if applicable.

    Args:
        node (Any): The schema node (object or dictionary).
        hint_marker (str): The fully formatted string to append.

    Returns:
        str: The hint string with a leading space, or empty string if disabled.
    """
    hint_e = getattr(node, 'override_hint', False) if not isinstance(node, dict) else node.get('override_hint', False)
    
    if not hint_e:
        return ""
    return f" {hint_marker}"

def generate_banner(description: str, indent: int = 0, width: int = 42, comment_char: str = "#") -> List[str]:
    """
    Create a highly-visible block comment banner.

    Why: Long YAML/INI files become illegible without distinct visual demarcations. 
    Banners box the description text within equal signs to provide clear section anchors.

    Args:
        description (str): The text to insert inside the banner.
        indent (int): Target indentation level (0 for top-level).
        width (int): Box width.
        comment_char (str): Standard comment character (`#` or `;`).

    Returns:
        List[str]: A list of text lines representing the banner block.
    """
    prefix = "  " * indent
    lines = []
    lines.append(f"{prefix}{comment_char} {'=' * width}")
    
    # Handle multiline descriptions
    for desc_line in description.splitlines():
        lines.append(f"{prefix}{comment_char} {desc_line}")
        
    lines.append(f"{prefix}{comment_char} {'=' * width}")
    return lines

def resolve_node_value(node: Any) -> Any:
    """
    Safely extract the resolved final value for a given node.

    Why: A default value gracefully falls back to the `regex` value if `default_value` 
    is absent. This guarantees that missing defaults still output structural string representations 
    defined by their validation rules (regex).

    Args:
        node (Any): The schema node or dictionary.

    Returns:
        Any: The extracted value.
    """
    if isinstance(node, dict):
        val = node.get('default_value')
        if val is None:
            val = node.get('regex')
    else:
        val = node.default_value
        if val is None:
            val = node.regex
    return val

def is_node_enabled(node_data: Any) -> bool:
    """
    Determine if a node should survive into the final configuration body.

    Why: The `required` flag mixed with missing values governs node emission. A node is omitted 
    if it is both NOT required and has absolutely no fallback value (`default_value` or `regex`), 
    meaning it brings no value to the output template.

    Args:
        node_data (Any): The schema node or dictionary.

    Returns:
        bool: True if it should be processed, False if it can be safely stripped.
    """
    if isinstance(node_data, dict):
        required = node_data.get('required', True)
        default_value = node_data.get('default_value')
        regex = node_data.get('regex')
    else:
        required = node_data.required
        default_value = node_data.default_value
        regex = node_data.regex
    
    if not required and default_value is None and regex is None:
        return False
    return True

def _generate_yaml_comments(desc: str, indent: int) -> List[str]:
    """
    Internal: Convert a description string into YAML comment lines.
    Business case: We rely on inline documentation. If a description starts with `#`, we escalate it to a major banner block.
    """
    lines = []
    prefix = "  " * indent
    if not desc:
        return lines
    if desc.startswith("#"):
        clean_desc = desc[1:].lstrip(" ")
        lines.extend(generate_banner(clean_desc, indent=indent))
    else:
        for desc_line in desc.splitlines():
            lines.append(f"{prefix}# {desc_line}")
    return lines

def _format_yaml_list_node(node: Any, value: Any, n_children: List[Any], indent: int, config: Any, line_content: str, current_hint: str) -> List[str]:
    """
    Formats schema nodes defined as 'list' into YAML arrays.
    
    Why: Handles the routing of list rendering. If the list has predefined schema children, 
    we iterate through them and prefix the generated objects with '- '. If the list relies entirely 
    on a literal default Python list, it triggers the array payload formatter instead.
    """
    lines = []
    if n_children:
        if value is not None and isinstance(value, list) and len(value) > 0:
            val = format_yaml_value(value, indent, NodeType.LIST.value)
            lines.append(f"{line_content}{current_hint}{val}" if val.strip() else f"{line_content} []{current_hint}")
        else:
            lines.append(f"{line_content}{current_hint}")
            child_lines = generate_yaml_from_schema(n_children, indent + 1, config)
            lines.extend(_apply_yaml_list_prefix(child_lines))
    else:
        val = format_yaml_value(value if value is not None else [], indent, NodeType.LIST.value)
        if val.startswith("\n"):
            lines.append(f"{line_content}{current_hint}{val}")
        else:
            lines.append(f"{line_content} {val}{current_hint}")
    return lines

def _apply_yaml_list_prefix(child_lines: List[str]) -> List[str]:
    """
    Injects the YAML list indicator '- ' into the first valid line of a generated block.
    
    Why: When schema children of a list node are recursively generated, they return as standard 
    objects. This function retroactively aligns them into a YAML array by replacing the starting 
    spaces of the first non-comment line with the array bullet '- '.
    """
    lines = []
    list_item_started = False
    for cl in child_lines:
        if not cl.strip(): 
            continue
        if not list_item_started and not cl.lstrip().startswith("#"):
            leading_spaces = len(cl) - len(cl.lstrip(' '))
            lines.append(cl[:leading_spaces] + "- " + cl.lstrip(' '))
            list_item_started = True
        else:
            lines.append(cl if cl.lstrip().startswith("#") and not list_item_started else f"  {cl}")
    return lines

def _format_yaml_object_node(node: Any, value: Any, n_children: List[Any], indent: int, config: Any, line_content: str, current_hint: str) -> List[str]:
    """
    Formats schema nodes defined as 'object' into nested child blocks or inline keys.
    
    Why: Handles the routing of object rendering. If the object node lacks an explicit default implementation, 
    the engine cascades execution down to its children schema definitions. If a literal dictionary default 
    is provided instead, it triggers the recursive dictionary payload formatter.
    """
    lines = []
    explicit_default = node.default_value if not isinstance(node, dict) else node.get('default_value', None)
    
    # If the explicit default is strictly None or an empty string, we render children
    is_empty_default = (explicit_default is None) or (explicit_default == "")
    
    if n_children and is_empty_default:
        lines.append(f"{line_content}{current_hint}")
        lines.extend(generate_yaml_from_schema(n_children, indent + 1, config))
    else:
        val = format_yaml_value(value if value is not None else {}, indent, NodeType.OBJECT.value)
        if val.startswith("\n"):
            lines.append(f"{line_content}{current_hint}{val}")
        else:
            lines.append(f"{line_content} {val}{current_hint}")
    return lines

def _format_yaml_scalar_node(node: Any, value: Any, n_multi_type: List[str], indent: int, line_content: str, current_hint: str) -> List[str]:
    """
    Formats primitive schema nodes (string, boolean, number) into inline YAML key-value pairs.
    
    Why: Resolves the final value's data type, triggers the defensive quoting system, 
    and handles multiline strings (using > or | indicators) cleanly alongside standard inline scalars.
    """
    lines = []
    effective_type = NodeType.STRING.value
    if NodeType.BOOL.value in n_multi_type: effective_type = NodeType.BOOL.value
    elif NodeType.NUMBER.value in n_multi_type: effective_type = NodeType.NUMBER.value
    
    val_to_print = value
    if val_to_print is None:
        val_to_print = False if effective_type == NodeType.BOOL.value else (0 if effective_type == NodeType.NUMBER.value else "")
    
    val_str = format_yaml_value(val_to_print, indent, effective_type)
    if '\n' in val_str:
        if val_str.startswith(" |") or val_str.startswith(" >"):
            parts = val_str.split("\n", 1)
            lines.append(f"{line_content}{parts[0]}{current_hint}\n{parts[1]}")
        else:
            lines.append(f"{line_content}{current_hint}{val_str}")
    else:
        lines.append(f"{line_content} {val_str}{current_hint}")
    return lines

def _apply_yaml_commenting(node_lines: List[str], is_required: bool, has_conditions: bool, desc_line_count: int) -> List[str]:
    """
    Converts active YAML blocks into disabled comments if they are not required.
    
    Why: Allows the generator to output "dead" code structures (like optional features) 
    that the user can manually uncomment later. Safely skips over banner/description blocks 
    that are already commented.
    """
    if is_required is not False or has_conditions:
        return node_lines
        
    commented_node_lines = []
    flat_node_lines = []
    for line in node_lines:
        flat_node_lines.extend(line.split("\n"))
        
    for i, line in enumerate(flat_node_lines):
        if i < desc_line_count or not line.strip():
            commented_node_lines.append(line)
        else:
            idx = len(line) - len(line.lstrip(' '))
            commented_node_lines.append(line[:idx] + "# " + line[idx:])
    return commented_node_lines

def generate_yaml_from_schema(nodes: List[Any], indent: int = 0, config: Optional[Dict[str, Any]] = None) -> List[str]:
    """
    Generates an array of text lines representing a YAML file from a list of schema nodes.
    
    Why: Modern configuration involves dynamic inputs, fallback defaults, and environment logic. 
    By compiling a schema tree directly into strings (instead of dumping a raw python `dict`), 
    we maintain absolute control over comments, banners, human-readable spacing, and inline overrides.
    """
    lines = []
    prefix = "  " * indent
    override_hint_marker = get_override_hint_style(config)
    top_level_spacing = config.get("top_level_spacing", 2) if config else 2
    
    is_first = True
    for node in nodes:
        if not is_node_enabled(node):
            continue
            
        if indent == 0 and not is_first:
            lines.extend([""] * top_level_spacing)
            
        if indent == 0:
            is_first = False
            
        node_lines = _process_yaml_node(node, indent, prefix, override_hint_marker, config)
        lines.extend(node_lines)

    return lines

def _process_yaml_node(node: Any, indent: int, prefix: str, hint_marker: str, config: Optional[Dict[str, Any]]) -> List[str]:
    """
    Core engine that processes a single SchemaNode into structural YAML syntax.
    
    Why: By isolating the interpretation of descriptions, keys, and condition blocks into this routing 
    function, we decouple the node tree parsing mechanism from the raw YAML print formats.
    """
    n_desc = node.description or ""
    n_key = node.key or ""
    n_multi_type = node.multi_type or []
    n_children = node.children or []

    if NodeType.OBJECT.value in n_multi_type and NodeType.LIST.value in n_multi_type:
        raise ConfigGeneratorError(f"Conflict: node '{n_key}' cannot be both 'object' and 'list'.")

    comment_lines = _generate_yaml_comments(n_desc, indent)
    desc_line_count = len(comment_lines)
    node_lines = list(comment_lines)

    line_content = f"{prefix}{n_key}:"
    current_hint = get_override_hint(node, hint_marker)
    value = resolve_node_value(node)
    
    if (NodeType.OBJECT.value in n_multi_type or NodeType.LIST.value in n_multi_type) and value == "":
        value = None

    if NodeType.LIST.value in n_multi_type:
        node_lines.extend(_format_yaml_list_node(node, value, n_children, indent, config, line_content, current_hint))
    elif NodeType.OBJECT.value in n_multi_type:
        node_lines.extend(_format_yaml_object_node(node, value, n_children, indent, config, line_content, current_hint))
    else:
        node_lines.extend(_format_yaml_scalar_node(node, value, n_multi_type, indent, line_content, current_hint))

    is_required = node.required
    condition_obj = node.condition
    has_conditions = bool(condition_obj and isinstance(condition_obj, dict) and condition_obj.get('conditions'))

    return _apply_yaml_commenting(node_lines, is_required, has_conditions, desc_line_count)

def _render_ini_hosts(hosts: Any, item_schemas: List[Any]) -> List[str]:
    """
    Formats the list of server hosts inside an INI group.
    
    Why: INI files represent host definitions either as simple strings (IP/hostname) or as 
    complex lines with trailing key-value parameters. If the schema specifies variables but 
    no hosts are provided, it generates a placeholder example row automatically.
    """
    host_lines = []
    if not hosts and item_schemas:
        example = {s.key: (f'"{s.regex}"' if s.default_value is None and s.regex else (s.default_value if s.default_value is not None else "")) for s in item_schemas}
        hosts = [example]
        
    for host in hosts:
        if isinstance(host, str):
            host_lines.append(format_yaml_value(host, -1, NodeType.STRING.value))
        elif isinstance(host, dict):
            primary = host.get("hostname") or (list(host.keys())[0] if host else None)
            if not primary: continue
            parts = [format_yaml_value(str(primary), -1, NodeType.STRING.value)]
            for k, v in host.items():
                if k == "hostname" or (k == primary and "hostname" not in host): continue
                q_k = format_yaml_value(str(k), -1, NodeType.STRING.value)
                q_v = format_yaml_value(str(v), -1, NodeType.STRING.value)
                parts.append(f"{q_k}={q_v}")
            host_lines.append(" ".join(parts))
    return host_lines

def _get_ini_ordered_keys(node: Any, val: Any) -> tuple:
    """
    Calculates the correct insertion order for child keys in an INI section.
    
    Why: Preserves the deterministic ordering defined by the schema's `children` array 
    while safely appending any dynamic, unrecognized keys found in the resolved value map 
    to the end of the block.
    """
    schema_map = {c.key: c for c in (node.children or [])}
    ordered_keys = list(schema_map.keys())
    for k in val: 
        if k not in ordered_keys: ordered_keys.append(k)
    return schema_map, ordered_keys

def _generate_ini_comments_from_desc(schema: Any, width: int = 42) -> List[str]:
    """
    Generates standard comments or decorative banners for INI nodes.
    
    Why: Ensures that descriptions attached to INI groups or variables are properly 
    translated into `# ` prefixed comments. If the description itself starts with `#`, 
    it delegates to the banner drawing utility for visual separation.
    """
    lines = []
    desc = schema.description if schema else None
    if desc:
        if desc.startswith("#"):
            clean_desc = desc[1:].lstrip(" ")
            lines.extend(generate_banner(clean_desc, width=width))
        else:
            for desc_line in desc.splitlines():
                lines.append(f"# {desc_line}")
    return lines

def _generate_ini_global_vars(nodes: List[Any], lines: List[str]):
    """
    Generates the [all:vars] global INI section based on the `global_vars` schema node.
    
    Why: Handles system-wide default assignments for Ansible INI inventories, ensuring 
    variables are serialized securely as key-value pairs without breaking INI formatting.
    """
    for node in nodes:
        if node.key == 'global_vars' and is_node_enabled(node):
            is_req = node.required
            c_cond = node.condition
            has_cond = bool(c_cond and isinstance(c_cond, dict) and c_cond.get('conditions'))
            if not is_req and not has_cond:
                continue

            lines.extend(_generate_ini_comments_from_desc(node))
            lines.append("[all:vars]")
            val = resolve_node_value(node)
            if isinstance(val, dict):
                for k, v in val.items(): 
                    q_v = format_yaml_value(str(v), -1, NodeType.STRING.value)
                    lines.append(f"{k}={q_v}")
            lines.append("")

def _generate_ini_groups(nodes: List[Any], override_hint_marker: str, lines: List[str]):
    """
    Generates standard INI groups and their associated host definitions.
    
    Why: Processes the `groups` schema section. Handles extracting hosts, printing 
    child group banners, injecting override hints, and recursively calling formatting 
    for inline host variables.
    """
    for node in nodes:
        if node.key == 'groups' and is_node_enabled(node):
            is_req = node.required
            c_cond = node.condition
            has_cond = bool(c_cond and isinstance(c_cond, dict) and c_cond.get('conditions'))
            if not is_req and not has_cond:
                continue

            lines.extend(_generate_ini_comments_from_desc(node))
            groups_val = resolve_node_value(node) or {}
            schema_map, ordered_keys = _get_ini_ordered_keys(node, groups_val)
                
            for gk in ordered_keys:
                g_schema = schema_map.get(gk)
                if g_schema and not is_node_enabled(g_schema): continue
                
                hosts = groups_val.get(gk, [])
                child_lines = []
                desc_lines = _generate_ini_comments_from_desc(g_schema)
                child_lines.extend(desc_lines)
                desc_count = len(desc_lines)

                hint = get_override_hint(g_schema, override_hint_marker) if g_schema else ""
                child_lines.append(f"[{gk}]{hint}")
                child_lines.extend(_render_ini_hosts(hosts, g_schema.children if g_schema else []))
                
                if g_schema:
                    c_req = g_schema.required
                    c_cond = g_schema.condition
                    c_has_cond = bool(c_cond and isinstance(c_cond, dict) and c_cond.get('conditions'))
                else:
                    c_req, c_has_cond = True, False
                    
                child_lines = _apply_yaml_commenting(child_lines, c_req, c_has_cond, desc_count)
                lines.extend(child_lines)
                lines.append("")

def _generate_ini_aggregations(nodes: List[Any], lines: List[str]):
    """
    Generates [group:children] sub-aggregation blocks for Ansible INI files.
    
    Why: Builds hierarchal groupings of servers (e.g. mapping `master` and `worker` 
    under a parent `k8s-nodes` group) by rendering lists of group names correctly.
    """
    for node in nodes:
        if node.key == 'aggregations' and is_node_enabled(node):
            is_req = node.required
            c_cond = node.condition
            has_cond = bool(c_cond and isinstance(c_cond, dict) and c_cond.get('conditions'))
            if not is_req and not has_cond:
                continue

            lines.extend(_generate_ini_comments_from_desc(node))
            aggr_val = resolve_node_value(node) or {}
            schema_map, ordered_keys = _get_ini_ordered_keys(node, aggr_val)
            
            for ak in ordered_keys:
                c_schema = schema_map.get(ak)
                if c_schema and not is_node_enabled(c_schema): continue
                
                child_lines = []
                desc_lines = _generate_ini_comments_from_desc(c_schema)
                child_lines.extend(desc_lines)
                desc_count = len(desc_lines)

                child_lines.append(f"[{ak}:children]")
                children_groups = resolve_node_value(c_schema) if c_schema else None
                if not children_groups: children_groups = aggr_val.get(ak, None)
                
                if not children_groups and c_schema and c_schema.children:
                    children_groups = [ch.key for ch in c_schema.children if ch.key]
                elif not children_groups:
                    children_groups = []
                
                if isinstance(children_groups, list):
                    child_lines.extend([str(i) for i in children_groups])
                elif children_groups:
                    child_lines.append(str(children_groups))

                if c_schema:
                    c_req = c_schema.required
                    c_cond = c_schema.condition
                    c_has_cond = bool(c_cond and isinstance(c_cond, dict) and c_cond.get('conditions'))
                else:
                    c_req, c_has_cond = True, False
                    
                child_lines = _apply_yaml_commenting(child_lines, c_req, c_has_cond, desc_count)
                lines.extend(child_lines)
                lines.append("")

def _generate_ini_group_vars(nodes: List[Any], override_hint_marker: str, lines: List[str]):
    """
    Generates [group:vars] blocks for attaching variables directly to specific groups.
    
    Why: Inherits, merges, and resolves group-specific parameters from the schema, 
    dynamically formatting and quoting values safely before appending them to the block.
    """
    for node in nodes:
        if node.key == 'group_vars' and is_node_enabled(node):
            is_req = node.required
            c_cond = node.condition
            has_cond = bool(c_cond and isinstance(c_cond, dict) and c_cond.get('conditions'))
            if not is_req and not has_cond:
                continue

            lines.extend(_generate_ini_comments_from_desc(node))
            group_vars_val = resolve_node_value(node) or {}
            schema_map, ordered_keys = _get_ini_ordered_keys(node, group_vars_val)
                
            for gk in ordered_keys:
                g_schema = schema_map.get(gk)
                if g_schema and not is_node_enabled(g_schema): continue
                
                child_lines = []
                desc_lines = _generate_ini_comments_from_desc(g_schema)
                child_lines.extend(desc_lines)
                desc_count = len(desc_lines)

                hint = get_override_hint(g_schema, override_hint_marker) if g_schema else ""
                child_lines.append(f"[{gk}:vars]{hint}")
                
                vars_val = {}
                g_schema_children = g_schema.children if g_schema else []
                if g_schema and g_schema_children:
                    for ch in g_schema_children:
                        if ch.key:
                            ch_val = resolve_node_value(ch)
                            if ch_val is not None:
                                vars_val[ch.key] = ch_val
                                
                g_val = resolve_node_value(g_schema) if g_schema else None
                if isinstance(g_val, dict):
                    vars_val.update(g_val)
                    
                parent_val = group_vars_val.get(gk, {})
                if isinstance(parent_val, dict):
                    vars_val.update(parent_val)
                
                if isinstance(vars_val, dict) and vars_val:
                    for k, v in vars_val.items():
                        v_str = str(v).lower() if isinstance(v, bool) else str(v)
                        q_v = format_smart_quoted_string(v_str)
                        child_lines.append(f"{k}={q_v}")

                if g_schema:
                    c_req = g_schema.required
                    c_cond = g_schema.condition
                    c_has_cond = bool(c_cond and isinstance(c_cond, dict) and c_cond.get('conditions'))
                else:
                    c_req, c_has_cond = True, False
                    
                child_lines = _apply_yaml_commenting(child_lines, c_req, c_has_cond, desc_count)
                lines.extend(child_lines)
                lines.append("")

def generate_ini_from_schema(nodes: List[Any], config: Optional[Dict[str, Any]] = None) -> List[str]:
    """
    Generate an array of text lines representing an INI-style file (like Ansible inventories).

    Why: INI files have strict, non-hierarchical structural requirements (`[groups]`, `[all:vars]`). 
    A JSON schema dictates relationships, but INI flattening requires specific business rules to 
    collocate keys properly. This function serves as the specialized orchestrator for those rules.

    Args:
        nodes (List[Any]): The schema nodes configured for INI output.
        config (Optional[Dict[str, Any]]): Generator tool configuration (e.g., hint styles).

    Returns:
        List[str]: A list of formatted INI lines ready to be joined by newlines.
    """
    lines = []
    override_hint_marker = get_override_hint_style(config)
    
    _generate_ini_global_vars(nodes, lines)
    _generate_ini_groups(nodes, override_hint_marker, lines)
    _generate_ini_aggregations(nodes, lines)
    _generate_ini_group_vars(nodes, override_hint_marker, lines)

    return lines



@dataclass
class EnvVarDef:
    key: str
    description: str = ""

    @classmethod
    def from_dict(cls, data: Any) -> 'EnvVarDef':
        if isinstance(data, dict):
            return cls(key=data.get("key", ""), description=data.get("description", ""))
        return cls(key=str(data))

@dataclass
class TriggerCondition:
    key: str
    regex: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TriggerCondition':
        return cls(key=data.get("key", ""), regex=data.get("regex", ""))

@dataclass
class ScenarioTrigger:
    source: TriggerSource
    logic: TriggerLogic = TriggerLogic.AND
    conditions: List[TriggerCondition] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ScenarioTrigger':
        conds = [TriggerCondition.from_dict(c) for c in data.get("conditions", [])]
        return cls(
            source=TriggerSource(data.get("source", TriggerSource.DEFAULT.value)),
            logic=TriggerLogic(data.get("logic", TriggerLogic.AND.value)),
            conditions=conds
        )

@dataclass
class ScenarioConfig:
    value: str
    path: str
    trigger: ScenarioTrigger
    required_env_vars: List[EnvVarDef] = field(default_factory=list)
    priority: int = 999
    config: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ScenarioConfig':
        trigger = ScenarioTrigger.from_dict(data.get("trigger", {}))
        req_vars = [EnvVarDef.from_dict(ev) for ev in data.get("required_env_vars", [])]
        return cls(
            value=data.get("value", ""),
            path=data.get("path", ""),
            trigger=trigger,
            required_env_vars=req_vars,
            priority=data.get("priority", 999),
            config=data
        )

@dataclass
class AppConfig:
    override_hint_style: str = "# <=== [Override]"
    scenario_env_key: str = "SCENARIO_TYPE"
    top_level_spacing: int = 2
    default_env_vars: List[EnvVarDef] = field(default_factory=list)
    scenarios: List[ScenarioConfig] = field(default_factory=list)
    raw_config: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> 'AppConfig':
        """
        Parse the raw orchestrator configuration into a strongly typed `AppConfig` dataclass.
        """
        app_cfg = cls(
            override_hint_style=raw.get("override_hint_style", "# <=== [Override]"),
            scenario_env_key=raw.get("senario_env_key", "SCENARIO_TYPE"),
            top_level_spacing=raw.get("top_level_spacing", 2),
            raw_config=raw
        )
        
        app_cfg.default_env_vars = [EnvVarDef.from_dict(ev) for ev in raw.get("default_env_vars", [])]
        app_cfg.scenarios = [ScenarioConfig.from_dict(sc) for sc in raw.get("senarios", [])]
        return app_cfg

def parse_config(raw: Dict[str, Any]) -> AppConfig:
    return AppConfig.from_dict(raw)

def validate_config_scenarios(app_config: AppConfig) -> None:
    """
    Validate that trigger rules defined in the configuration are logically sound.
    """
    for sc in app_config.scenarios:
        if sc.trigger.source in [TriggerSource.USER, TriggerSource.DEFAULT]:
            if sc.trigger.conditions:
                 print(f"\033[91m[ERROR] Config Error in scenario '{sc.value}': source '{sc.trigger.source.value}' must not have 'conditions'.\033[0m")
                 sys.exit(1)
        if sc.trigger.source == TriggerSource.ENV:
             if not sc.trigger.conditions:
                 print(f"\033[91m[ERROR] Config Error in scenario '{sc.value}': source 'env' must have 'conditions'.\033[0m")
                 sys.exit(1)

def determine_active_scenarios(app_config: AppConfig, env: Dict[str, str]) -> List[ScenarioConfig]:
    """
    Evaluate scenario triggers against system context to determine which run.
    """
    active = []
    user_selection = env.get(app_config.scenario_env_key)
    
    for sc in app_config.scenarios:
        is_active = False
        src = sc.trigger.source
        
        if src == TriggerSource.DEFAULT:
            is_active = True
        elif src == TriggerSource.USER:
            if user_selection == sc.value:
                is_active = True
        elif src == TriggerSource.ENV:
            if not sc.trigger.conditions:
                is_active = False
            else:
                matches = []
                for cond in sc.trigger.conditions:
                    val = env.get(cond.key, "")
                    matches.append(bool(re.search(cond.regex, val)))
                
                if sc.trigger.logic == TriggerLogic.AND:
                    is_active = all(matches)
                elif sc.trigger.logic == TriggerLogic.OR:
                    is_active = any(matches)
        
        if is_active:
            # Overwrite priority for default
            if src == TriggerSource.DEFAULT:
                 sc.priority = 9999
            active.append(sc)

    # Sort Descending Priority (Base -> P2 -> P1)
    active.sort(key=lambda x: x.priority, reverse=True)
    return active

def validate_required_env_vars(app_config: AppConfig, active_scenarios: List[ScenarioConfig], env: Dict[str, str]) -> None:
    """
    Assert that all environment variables declared as required are actually present.

    Why: Fallback values and path resolutions depend entirely on environment state. 
    It is safer to fail immediately than to silently generate corrupt configuration files 
    that cause services to crash later at runtime.

    Args:
        app_config (AppConfig): The application configuration model.
        active_scenarios (List[ScenarioConfig]): The scenarios currently evaluated to run.
        env (Dict[str, str]): Environment variables map.
        
    Raises:
        ConfigGeneratorError: If required variables are missing.
    """
    missing = []
    for ev in app_config.default_env_vars:
        if ev.key and ev.key not in env:
            missing.append(ev.key)
            
    for sc in active_scenarios:
        for ev in sc.required_env_vars:
            if ev.key and ev.key not in env:
                missing.append(ev.key)
    
    missing = list(set(missing))
    if missing:
        raise ConfigGeneratorError(f"Missing required environment variables: {', '.join(missing)}")

def validate_scenario_templates(active_scenarios: List[ScenarioConfig]) -> None:
    """
    Extract configuration directories mapped to active scenarios to ensure they exist.

    Why: Protects against generating configurations targeting deleted or renamed 
    schema template directories before attempting IO operations.

    Args:
        active_scenarios (List[ScenarioConfig]): The running scenarios.
    """
    validation_dirs = set()
    for sc in active_scenarios:
        if sc.path and os.path.exists(sc.path):
            validation_dirs.add(sc.path)
            
    validation_errors = []
    
def validate_node(node_data: SchemaNode, file_path: str, node_key: str, is_ini: bool = False) -> List[str]:
    """
    Recursively validate a schema node against required configuration rules.
    """
    errors = []
    
    if not node_data.key:
        errors.append(f"[{file_path}] Error: Node '{node_key}' missing 'key' attribute.")
    if not node_data.multi_type:
        errors.append(f"[{file_path}] Error: Node '{node_data.key or node_key}' missing 'multi_type' attribute.")
             
    key = node_data.key
    multi_type = node_data.multi_type
    item_multi_type = node_data.item_multi_type
    children = node_data.children

    # Conflict check
    if NodeType.OBJECT.value in multi_type and NodeType.LIST.value in multi_type:
        errors.append(f"[{file_path}] Error: Node '{key}' 'multi_type' cannot contain both 'object' and 'list'.")

    # List consistency
    if NodeType.LIST.value in multi_type and not item_multi_type:
         errors.append(f"[{file_path}] Error: Node '{key}' 'multi_type' contains 'list' but 'item_multi_type' is empty.")

    # Object consistency
    if NodeType.OBJECT.value in multi_type and item_multi_type:
         errors.append(f"[{file_path}] Error: Node '{key}' 'multi_type' contains 'object' but 'item_multi_type' is not empty.")
            
    # INI specific root key validation
    if is_ini and "." not in node_key: # node_key here is the top-level key like 'global_vars'
        allowed_ini_roots = ['aggregations', 'groups', 'global_vars', 'group_vars']
        if key not in allowed_ini_roots:
            errors.append(f"{file_path} [{node_key}]: invalid INI root key '{key}'. Must be one of {allowed_ini_roots}.")

    # INI specific child type validation
    if is_ini:
        parts = node_key.split('.')
        if len(parts) == 1:
            if key in ['aggregations', 'groups', 'group_vars', 'global_vars']:
                if not multi_type or NodeType.OBJECT.value not in multi_type:
                    errors.append(f"{file_path} [{node_key}]: INI root node '{key}' must have 'multi_type' containing 'object'.")

        if len(parts) == 2:
            if parts[0] in ['groups', 'aggregations']:
                if not multi_type or NodeType.LIST.value not in multi_type:
                    errors.append(f"{file_path} [{node_key}]: node under INI '{parts[0]}' must have 'multi_type' containing 'list'.")
                if not item_multi_type or NodeType.OBJECT.value not in item_multi_type:
                    errors.append(f"{file_path} [{node_key}]: node under INI '{parts[0]}' must have 'item_multi_type' containing 'object'.")
            elif parts[0] == 'group_vars':
                if not multi_type or NodeType.OBJECT.value not in multi_type:
                    errors.append(f"{file_path} [{node_key}]: node under INI 'group_vars' must have 'multi_type' containing 'object'.")
            
            if parts[0] == "groups":
                if children:
                    has_hostname = any(c.key == 'hostname' for c in children)
                    if not has_hostname:
                        errors.append(f"{file_path} [{node_key}]: node under INI 'groups' must contain a 'hostname' child key.")

        if len(parts) == 3 and parts[0] == 'aggregations':
            if not multi_type or NodeType.OBJECT.value not in multi_type:
                errors.append(f"{file_path} [{node_key}]: child node under INI 'aggregations' list must have 'multi_type' containing 'object'.")

    if not isinstance(item_multi_type, list):
        errors.append(f"{file_path} [{node_key}]: 'item_multi_type' must be a list.")

    for child in children:
        errors.extend(validate_node(child, file_path, f"{node_key}.{child.key}", is_ini))
    
    return errors

def validate_schema(data: Any, file_path: str) -> List[str]:
    """
    Dispatcher to validate top-level schema JSON files.
    """
    errors = []
    
    is_ini = file_path.endswith('.ini.json')
    if isinstance(data, list):
        parsed_data = [d if isinstance(d, SchemaNode) else SchemaNode.from_dict(d) for d in data]
        for node in parsed_data:
            n_key = node.key or 'UNKNOWN'
            errors.extend(validate_node(node, file_path, n_key, is_ini))
    else:
        node = data if isinstance(data, SchemaNode) else SchemaNode.from_dict(data)
        n_key = node.key or 'UNKNOWN'
        errors.extend(validate_node(node, file_path, n_key, is_ini))
        
    return errors

def validate_scenario_templates(active_scenarios: List[ScenarioConfig]):
    validation_dirs = set()
    for sc in active_scenarios:
        if sc.path and os.path.exists(sc.path):
            validation_dirs.add(sc.path)
            
    validation_errors = []

    for search_dir in validation_dirs:
        for dirpath, _, filenames in os.walk(search_dir):
            for f in filenames:
                if f.endswith('.json') and f != "config.json":
                    path = os.path.join(dirpath, f)
                    try:
                        nodes = load_json_nodes(path)
                        validation_errors.extend(validate_schema(nodes, path))
                            
                    except json.JSONDecodeError as e:
                        validation_errors.append(f"{path}: Invalid JSON - {e}")
                    except Exception as e:
                        validation_errors.append(f"{path}: Validation Error - {e}")

    if validation_errors:
        print(f"\033[91m[ERROR] Template Validation Failed:\033[0m")
        for err in validation_errors:
            print(f" - {err}")
        sys.exit(1)
        
    print(f"Validation successful for {len(validation_dirs)} directories.\n")

def collect_scenario_files(active_scenarios: List[ScenarioConfig]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Walk active scenario folders and map template files by their relative output paths.

    Why: We need to know which schemas map to the same target output file across 
    different scenario layers (e.g. `base/app.yml.json` + `prod/app.yml.json` -> `app.yml`). 
    This groups them so they can be merged sequentially.

    Args:
        active_scenarios (List[ScenarioConfig]): Active scenarios sorted by priority.

    Returns:
        Dict[str, List[Dict[str, Any]]]: A map where keys are target relative paths 
        and values are lists of source files to combine.
    """
    file_map = {} 
    
    for sc in active_scenarios:
        if not sc.path or not os.path.exists(sc.path): continue
        
        for dirpath, _, filenames in os.walk(sc.path):
            for f in filenames:
                if f.startswith('.'): continue
                full_path = os.path.join(dirpath, f)
                rel_path_from_sc = os.path.relpath(full_path, sc.path)
                
                if f.endswith('.ini.json'):
                    out_rel = rel_path_from_sc[:-9]
                    ftype = 'json'
                elif f.endswith('.yml.json'):
                    out_rel = rel_path_from_sc[:-5]
                    ftype = 'json'
                else:
                    out_rel = rel_path_from_sc
                    ftype = 'raw'
                
                if out_rel not in file_map:
                    file_map[out_rel] = []
                
                file_map[out_rel].append({
                    "path": full_path,
                    "type": ftype,
                    "scenario": sc.value
                })
    return file_map

def generate_output_files(file_map: Dict[str, List[Dict[str, Any]]], env: Dict[str, str], raw_config: Dict[str, Any]) -> None:
    """
    Parse mapped schemas, resolve overrides, and render final output files to disk.
    """
    for final_rel_path_tpl, sources in file_map.items():
        try:
            final_rel_path = resolve_path_vars(final_rel_path_tpl, env)
        except Exception as e:
             print(f"Skipping {final_rel_path_tpl}: {e}")
             continue
             
        final_output_path = os.path.join(os.getcwd(), final_rel_path)
        
        last_raw_index = -1
        for i, s in enumerate(sources):
            if s['type'] == 'raw':
                last_raw_index = i
        
        if last_raw_index != -1 and last_raw_index < len(sources) - 1:
             print(f"\033[91m[ERROR] Conflict for {final_rel_path}: Scenario '{sources[last_raw_index]['scenario']}' provides a RAW file, but higher priority scenario '{sources[-1]['scenario']}' provides a JSON schema. Cannot merge Schema onto Raw.\033[0m")
             continue
        
        if last_raw_index == len(sources) - 1:
             _process_raw_file_copy(sources[-1], final_rel_path, final_output_path, env)
        else:
             _process_schema_file(sources, final_rel_path, final_output_path, env, raw_config)

def _process_raw_file_copy(last_source: Dict[str, Any], final_rel_path: str, final_output_path: str, env: Dict[str, str]) -> None:
    print(f"[INFO] Generating {final_rel_path} from scenario (copy/template) - Source: {last_source['scenario']}")
    if os.path.exists(final_output_path):
        print(f"\033[93m[WARNING] File {final_rel_path} already exists. Skipping.\033[0m")
        return

    content = ""
    with open(last_source['path'], 'r') as f:
        content = f.read()
    
    try:
        content = resolve_content_vars(content, env)
    except KeyError as e:
        print(f"Error substituting vars in {final_rel_path}: Missing {e}")
    
    save_file(final_output_path, content)

def _process_schema_file(sources: List[Dict[str, Any]], final_rel_path: str, final_output_path: str, env: Dict[str, str], raw_config: Dict[str, Any]) -> None:
    merged_nodes = []
    is_ini = any(s['path'].endswith('.ini.json') for s in sources)
    
    if is_ini or final_rel_path.endswith('.ini'):
        print(f"[INFO] Generating {final_rel_path} from INI schema")
    else:
        print(f"[INFO] Generating {final_rel_path} from YAML schema")
    
    if os.path.exists(final_output_path):
        print(f"\033[93m[WARNING] File {final_rel_path} already exists. Skipping.\033[0m")
        return

    for s in sources:
        try:
            nodes = load_json_nodes(s['path'])
            merged_nodes = merge_nodes(merged_nodes, nodes)
        except Exception as e:
            print(f"Error loading/merging {s['path']}: {e}")

    substitute_env_in_default_values(merged_nodes, env)
    
    if is_ini:
        ini_lines = generate_ini_from_schema(merged_nodes, config=raw_config)
        content = "\n".join(ini_lines).strip() + "\n"
    else:
        yaml_lines = generate_yaml_from_schema(merged_nodes, config=raw_config)
        content = "\n".join(yaml_lines).strip() + "\n"
        
    save_file(final_output_path, content)

def process_scenarios(config_path: str, check_only: bool = False) -> None:
    """
    Main orchestrator function that bootstraps the config generation pipeline.

    Why: Provides a clean entry point coupling configuration loading, environment 
    variable acquisition, and scenario execution logic.

    Args:
        config_path (str): Path to the orchestrator JSON (e.g. `config.json`).
        check_only (bool): If True, strictly validates schema grammar without writing files.
    """
    try:
        raw_config = load_json(config_path)
    except Exception as e:
        print(f"Error loading config {config_path}: {e}")
        return
        
    app_config = parse_config(raw_config)
    env = load_env()
    
    validate_config_scenarios(app_config)
    
    if check_only:
        print(f"\033[94m[CHECK MODE] Validating all scenario templates in '{config_path}'...\033[0m")
        # In check mode, we validate ALL scenarios defined in config, not just active ones
        all_errors = validate_scenario_templates(app_config.scenarios)
        if all_errors:
            print("[ERROR] Schema validation failed:")
            for err in all_errors:
                print(f"  - {err}")
            sys.exit(1)
        print(f"\033[92m[SUCCESS] All templates in config are valid.\033[0m")
        return

    active_scenarios = determine_active_scenarios(app_config, env)
    
    if not active_scenarios:
         print(f"\033[93m[WARNING] No active scenarios found.\033[0m")
    else:
        print("Active Scenarios (in order of application):")
        for sc in active_scenarios:
            print(f" - {sc.value} (Priority: {sc.priority})")

    validate_required_env_vars(app_config, active_scenarios, env)
    # Validate scenario templates (dry-run if --check)
    all_errors = validate_scenario_templates(active_scenarios)
    if all_errors:
        print("[ERROR] Schema validation failed:")
        for err in all_errors:
            print(f"  - {err}")
        sys.exit(1)
        
    if check_only: # This block will not be reached if check_only is True due to the early return above.
                   # Assuming this is intended for a different flow or a future change.
        print("Validation successful. Exiting (check mode).")
        sys.exit(0)
        
    file_map = collect_scenario_files(active_scenarios)
    generate_output_files(file_map, env, app_config.raw_config)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="YAML/INI Generator with Scenario Overrides")
    parser.add_argument("config", nargs="?", default="template/scenario/config.json", help="Path to config.json")
    parser.add_argument("--check", action="store_true", help="Validation only mode (no file generation)")
    
    args = parser.parse_args()
    process_scenarios(args.config, check_only=args.check)
