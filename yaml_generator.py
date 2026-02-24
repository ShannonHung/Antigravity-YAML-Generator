import os
import sys
import json
import re
import shutil
import yaml
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

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
            "override_hint": self.override_hint,
            "regex_enable": self.regex_enable,
            "regex": self.regex,
            "children": [c.to_dict() for c in self.children]
        }

# Ensure consistent ordering in output if possible, though PyYAML handles dicts well.
# We are [INFO] Generating text manually for the complex schema-based JSONs to support comments.

def load_env():
    """Load environment variables into a dictionary."""
    return dict(os.environ)

def resolve_path_vars(path_template, env):
    """Substitute {VAR} in path_template with values from env (for file paths)."""
    for key, value in env.items():
        placeholder = f"{{{key}}}"
        if placeholder in path_template:
            path_template = path_template.replace(placeholder, value)
    
    # Check if any placeholders remain
    if re.search(r"\{[A-Z0-9_]+\}", path_template):
        print(f"\033[93m[WARNING] Unresolved placeholders in path: {path_template}\033[0m")
    return path_template

def resolve_content_vars(content, env):
    """Substitute ${VAR} in content with values from env (for file content)."""
    for key, value in env.items():
        placeholder = f"${{{key}}}"
        if placeholder in content:
            content = content.replace(placeholder, str(value))
            
    if re.search(r"\$\{[A-Z0-9_]+\}", content):
        unresolve_content = re.search(r"\$\{[A-Z0-9_]+\}", content).group(0)
        print(f"\033[93m[WARNING] Unresolved variable placeholders in content {unresolve_content}.\033[0m")
    return content

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

def substitute_env_in_default_values(nodes: List[SchemaNode], env):
    """
    Recursively substitute environment variables explicitly targeting `default_value` nodes.
    This preserves explicit literal values from `regex` attributes which avoids unintended substitution.
    """
    for node in nodes:
        # Only substitute if default_value exists
        default_val = node.default_value
        if default_val is not None:
            if isinstance(default_val, str):
                node.default_value = resolve_content_vars(default_val, env)
            elif isinstance(default_val, dict):
                # We need to deeply resolve dict string values
                node.default_value = resolve_dict_strings(default_val, env)
            elif isinstance(default_val, list):
                node.default_value = resolve_list_strings(default_val, env)
        
        # Recurse through children
        if node.children:
            substitute_env_in_default_values(node.children, env)

def resolve_dict_strings(d, env):
    new_d = {}
    for k, v in d.items():
        if isinstance(v, str):
            new_d[k] = resolve_content_vars(v, env)
        elif isinstance(v, dict):
            new_d[k] = resolve_dict_strings(v, env)
        elif isinstance(v, list):
            new_d[k] = resolve_list_strings(v, env)
        else:
            new_d[k] = v
    return new_d

def resolve_list_strings(lst, env):
    new_l = []
    for v in lst:
        if isinstance(v, str):
            new_l.append(resolve_content_vars(v, env))
        elif isinstance(v, dict):
            new_l.append(resolve_dict_strings(v, env))
        elif isinstance(v, list):
            new_l.append(resolve_list_strings(v, env))
        else:
            new_l.append(v)
    return new_l

def load_json_nodes(path) -> List[SchemaNode]:
    with open(path, 'r') as f:
        data = json.load(f)
    if isinstance(data, list):
        return [SchemaNode.from_dict(n) for n in data]
    return [SchemaNode.from_dict(data)]

def save_file(path, content):
    if os.path.exists(path):
        print(f"\033[93m[WARNING] File {path} already exists. Skipping.\033[0m")
        return

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)

def merge_nodes(source_nodes, override_nodes):
    """
    Merge override_nodes into source_nodes.
    source_nodes: list of dicts (schema definitions)
    override_nodes: list of dicts OR single dict
    """
    # Ensure source_nodes are objects
    processed_source = []
    for s in source_nodes:
        if isinstance(s, dict):
            processed_source.append(SchemaNode.from_dict(s))
        else:
            processed_source.append(s)
    
    source_map = {item.key: item for item in processed_source}
    
    if isinstance(override_nodes, dict):
        override_nodes = [override_nodes]
        
    for override in override_nodes:
        key = override.get('key')
        if not key:
            continue
            
        if key in source_map:
            # Update existing
            source_node = source_map[key]
            
            # Handle children specially to support deep merge
            override_children = override.get('children')
            source_children = source_node.get('children')
            
            # Prepare override data excluding children (to avoid overwriting list with update)
            ov_data = override.copy()
            if 'children' in ov_data:
                del ov_data['children']
                
            source_node.update(ov_data)
            
            if override_children is not None:
                strategy = override.get('override_strategy', 'merge')
                if strategy == 'replace':
                    source_node['children'] = override_children
                else:
                    if source_children:
                        # Recursive merge
                        source_node['children'] = merge_nodes(source_children, override_children)
                    else:
                        source_node['children'] = override_children
        else:
            # Append new
            source_nodes.append(override)
            source_map[key] = override
            
    return source_nodes

def quoted_str_representer(dumper, data):
    """
    Custom representer to enforce strict quoting rules.
    """
    needs_quotes = False
    
    if not data:
        needs_quotes = True
    elif re.match(r'^(true|false|yes|no|on|off)$', data, re.IGNORECASE):
        needs_quotes = True
    elif re.match(r'^[\d\.]+$', data): # Simple number check
        needs_quotes = True
    elif any(c in data for c in ":#[]{}/"):
        needs_quotes = True
    
    if "\n" in data:
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
    
    if needs_quotes:
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='"')
    else:
        # Check if safe to print raw
        if re.match(r'^[a-zA-Z0-9_\-\.]+$', data):
             return dumper.represent_scalar('tag:yaml.org,2002:str', data)
        else:
             return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='"')

# Register the custom representer
yaml.add_representer(str, quoted_str_representer)

def format_yaml_value(value, indent_level, val_type=None):
    """
    Format a value as YAML using the custom representer.
    """
    # For block formatting (dicts/lists), we want children indented 2 spaces more than the current level
    # 1 space level = 2 spaces. So indent + 1.
    prefix = "  " * (indent_level + 1)
    
    # 1. Handle None
    if value is None:
        return ""

    # 2. Handle strict types (bool, number) -> No quotes (standard YAML behavior)
    if val_type == 'bool':
        return str(value).lower()
    if val_type == 'number':
        return str(value)

    # 3. Handle complex types (list, dict) AND Strings (via custom representer)
    # Since we registered str representer, yaml.dump will use it for top-level strings too.
    # But careful: yaml.dump adds \n... and indenting issues.
    
    if isinstance(value, dict):
        if not value:
            return "{}"
        
        # Manually format the dict to gain control over list indentation within it
        lines = []
        for k, v in value.items():
            formatted_k = format_yaml_value(k, -1, 'string').strip()
            if isinstance(v, (dict, list)):
                # render nested block
                child_val = format_yaml_value(v, indent_level + 1)
                lines.append(f"{prefix}{formatted_k}:{child_val}")
            else:
                formatted_v = format_yaml_value(v, -1, 'string').strip()
                if "\n" in formatted_v:
                     # block scalar
                     parts = formatted_v.split("\n", 1)
                     lines.append(f"{prefix}{formatted_k}: {parts[0]}")
                     for sub_line in parts[1].splitlines():
                          lines.append(f"{prefix}  {sub_line}")
                else:
                     lines.append(f"{prefix}{formatted_k}: {formatted_v}")
        
        return "\n" + "\n".join(lines)
        
    if isinstance(value, list):
        if not value:
            return "[]"
        # Manually format list to control indentation perfectly
        list_prefix = prefix
        lines = []
        for item in value:
            if isinstance(item, (dict, list)):
                # Fallback to yaml.dump for nested complex structures but strip trailing newline
                item_yaml = yaml.dump(item, default_flow_style=False, width=1000).rstrip()
                item_lines = item_yaml.splitlines()
                lines.append(f"{list_prefix}- {item_lines[0]}")
                for sub_line in item_lines[1:]:
                    lines.append(f"{list_prefix}  {sub_line}")
            else:
                formatted_item = format_yaml_value(item, -1, 'string').strip()
                if "\n" in formatted_item:
                    # block scalar inside list
                    parts = formatted_item.split("\n", 1)
                    lines.append(f"{list_prefix}- {parts[0]}")
                    for sub_line in parts[1].splitlines():
                        lines.append(f"{list_prefix}  {sub_line}")
                else:
                    lines.append(f"{list_prefix}- {formatted_item}")
        return "\n" + "\n".join(lines)

    if isinstance(value, str) and "\n" in value:
        s = yaml.dump(value, default_flow_style=False)
        lines = s.splitlines()
        if lines and lines[0].strip() in ('|', '|-', '|+', '>', '>-', '>+'):
            indicator = lines[0].strip()
            content_lines = lines[1:]
            # Use same spaces as key for content prefix, because yaml.dump already adds 2 spaces
            content_prefix = "  " * indent_level
            # Lines from yaml.dump already have 2 spaces, so this adds correct indentation
            return f" {indicator}\n" + "\n".join([f"{content_prefix}{l}" for l in content_lines])
        return "\n" + "\n".join([f"{prefix}{line}" for line in lines])

    # 4. Handle Scala String directly using our logic to avoid yaml.dump overhead for simple strings?
    # Actually, let's use the same logic pattern for consistency, or just call the logic directly.
    s_val = str(value)
    
    # Check if it already looks quoted
    if (s_val.startswith('"') and s_val.endswith('"')) or (s_val.startswith("'") and s_val.endswith("'")):
        return s_val

    # Regex to catch ${VAR} or $VAR
    has_env_sub = re.search(r'\$\{?[\w]+\}?', s_val)
    
    needs_quotes = False
    if not s_val: needs_quotes = True
    elif re.match(r'^(true|false|yes|no|on|off)$', s_val, re.IGNORECASE): needs_quotes = True
    elif re.match(r'^[\d\.]+$', s_val): needs_quotes = True
    elif any(c in s_val for c in ":#[]{}/| !") or has_env_sub: # Added space and !
        needs_quotes = True
    
    if needs_quotes:
        escaped = s_val.replace('"', '\\"')
        return f'"{escaped}"'
    return s_val
def get_override_hint_style(config, default_style="<=== [Override]"):
    """
    Get the override hint style from config, ensuring it starts with a valid comment character.
    """
    if config:
        style = config.get("override_hint_style", default_style)
        if not style.strip().startswith("#") and not style.strip().startswith(";"):
            # Default to # if not specified
            return f"# {style}"
        return style
    return f"# {default_style}"

def get_override_hint(node, hint_marker):
    """
    Generate override hint string if applicable.
    Supports both SchemaNode and dict.
    """
    hint_e = getattr(node, 'override_hint', False) if not isinstance(node, dict) else node.get('override_hint', False)
    
    if not hint_e:
        return ""
    return f" {hint_marker}"

def generate_banner(description, indent=0, width=42, comment_char="#"):
    """
    Generate a standard banner with description.
    """
    prefix = "  " * indent
    lines = []
    lines.append(f"{prefix}{comment_char} {'=' * width}")
    
    # Handle multiline descriptions
    for desc_line in description.splitlines():
        lines.append(f"{prefix}{comment_char} {desc_line}")
        
    lines.append(f"{prefix}{comment_char} {'=' * width}")
    return lines

def resolve_node_value(node: Any):
    """
    Return default_value if exists, otherwise regex.
    Supports both SchemaNode and dict.
    """
    val = getattr(node, 'default_value', None) if not isinstance(node, dict) else node.get('default_value')
    if val is None:
        val = getattr(node, 'regex', None) if not isinstance(node, dict) else node.get('regex')
    return val

def is_node_enabled(node_data: Any):
    # Duck-typing to handle both SchemaNode and dict from unit tests
    required = getattr(node_data, 'required', True) if not isinstance(node_data, dict) else node_data.get('required', True)
    default_value = getattr(node_data, 'default_value', None) if not isinstance(node_data, dict) else node_data.get('default_value')
    regex = getattr(node_data, 'regex', None) if not isinstance(node_data, dict) else node_data.get('regex')
    
    if not required and default_value is None and regex is None:
        return False
    return True

def generate_yaml_from_schema(nodes: List[SchemaNode], indent=0, config=None):
    """
    Generate YAML content strings from the schema list.
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
            
        node_lines = []
        desc_line_count = 0
                
        # Duck-type access
        n_desc = getattr(node, 'description', "") if not isinstance(node, dict) else node.get('description', "")
        n_key = getattr(node, 'key', "") if not isinstance(node, dict) else node.get('key', "")
        n_multi_type = getattr(node, 'multi_type', []) if not isinstance(node, dict) else node.get('multi_type', [])
        n_children = getattr(node, 'children', []) if not isinstance(node, dict) else node.get('children', [])

        if n_desc:
            is_banner_trigger = n_desc.startswith("#")
            if is_banner_trigger:
                # Strip leading '#' and one space if present
                clean_desc = n_desc[1:]
                if clean_desc.startswith(" "):
                    clean_desc = clean_desc[1:]
                banner_lines = generate_banner(clean_desc, indent=indent)
                node_lines.extend(banner_lines)
                desc_line_count = len(banner_lines)
            else:
                desc_lines = n_desc.splitlines()
                for desc_line in desc_lines:
                    node_lines.append(f"{prefix}# {desc_line}")
                desc_line_count = len(desc_lines)
        
        if indent == 0:
            is_first = False
            
        if "object" in n_multi_type and "list" in n_multi_type:
             print(f"[ERROR] Conflict: node '{n_key}' cannot be both 'object' and 'list'.")
             sys.exit(1)

        line_content = f"{prefix}{n_key}:"
        current_hint = get_override_hint(node, override_hint_marker)
        value = resolve_node_value(node)

        if "list" in n_multi_type:
            if n_children:
                if value is not None and isinstance(value, list) and len(value) > 0:
                    val = format_yaml_value(value, indent, 'list')
                    node_lines.append(f"{line_content}{current_hint}{val}" if val.strip() else f"{line_content} []{current_hint}")
                else:
                    node_lines.append(f"{line_content}{current_hint}")
                    # Render list items from children schema
                    list_item_started = False
                    for child_node in n_children:
                        child_lines = generate_yaml_from_schema([child_node], indent + 1, config)
                        for cl in child_lines:
                            if not cl.strip(): continue
                            
                            if not list_item_started:
                                if cl.lstrip().startswith("#"):
                                    # Keep initial comments aligned with the dash
                                    node_lines.append(cl)
                                else:
                                    # Insert `- ` without destroying existing internal indentation
                                    leading_spaces = len(cl) - len(cl.lstrip(' '))
                                    node_lines.append(cl[:leading_spaces] + "- " + cl.lstrip(' '))
                                    list_item_started = True
                            else:
                                # Maintain parallel indentation alignment for subsequent lines
                                node_lines.append(f"  {cl}")
            else:
                 val = format_yaml_value(value if value is not None else [], indent, 'list')
                 if val.startswith("\n"):
                     node_lines.append(f"{line_content}{current_hint}{val}")
                 else:
                     node_lines.append(f"{line_content} {val}{current_hint}")

        elif "object" in n_multi_type:
             if n_children:
                 node_lines.append(f"{line_content}{current_hint}")
                 node_lines.extend(generate_yaml_from_schema(n_children, indent + 1, config))
             else:
                  val = format_yaml_value(value if value is not None else {}, indent, 'object')
                  if val.startswith("\n"):
                      node_lines.append(f"{line_content}{current_hint}{val}")
                  else:
                      node_lines.append(f"{line_content} {val}{current_hint}")
            
        else:
            effective_type = 'string'
            if "bool" in n_multi_type: effective_type = 'bool'
            elif "number" in n_multi_type: effective_type = 'number'
            
            val_to_print = value
            if val_to_print is None:
                val_to_print = False if effective_type == 'bool' else (0 if effective_type == 'number' else "")
            
            val_str = format_yaml_value(val_to_print, indent, effective_type)
            if '\n' in val_str:
                 if val_str.startswith(" |") or val_str.startswith(" >"):
                      parts = val_str.split("\n", 1)
                      node_lines.append(f"{line_content}{parts[0]}{current_hint}\n{parts[1]}")
                 else:
                      node_lines.append(f"{line_content}{current_hint}{val_str}")
            else:
                 node_lines.append(f"{line_content} {val_str}{current_hint}")

        is_required = getattr(node, 'required', True) if not isinstance(node, dict) else node.get('required', True)
        if hasattr(node, "get") and isinstance(node, dict):
            is_required = node.get('required', True)
        elif hasattr(node, "required"):
            is_required = getattr(node, "required")
        else:
            is_required = True

        if is_required is False:
            commented_node_lines = []
            flat_node_lines = []
            for line in node_lines:
                flat_node_lines.extend(line.split("\n"))
                
            for i, line in enumerate(flat_node_lines):
                if i < desc_line_count:
                    commented_node_lines.append(line)
                    continue
                if not line.strip():
                    commented_node_lines.append(line)
                    continue
                idx = len(line) - len(line.lstrip(' '))
                commented_node_lines.append(line[:idx] + "# " + line[idx:])
            node_lines = commented_node_lines
            
        lines.extend(node_lines)

    return lines

def generate_ini_from_schema(nodes: List[SchemaNode], config=None):
    """
    Generate INI content strings from the schema list.
    """
    lines = []
    override_hint_marker = get_override_hint_style(config)
    
    # helper for host rendering
    def _render_hosts(hosts, item_schemas):
        host_lines = []
        if not hosts and item_schemas:
            # Generate example
            example = {s.key: (f'"{s.regex}"' if s.default_value is None and s.regex else (s.default_value if s.default_value is not None else "")) for s in item_schemas}
            hosts = [example]
            
        for host in hosts:
            if isinstance(host, str):
                host_lines.append(format_yaml_value(host, -1, 'string'))
            elif isinstance(host, dict):
                # prioritize hostname
                primary = host.get("hostname") or (list(host.keys())[0] if host else None)
                if not primary: continue
                # Apply YAML-style quoting to primary host
                parts = [format_yaml_value(str(primary), -1, 'string')]
                for k, v in host.items():
                    if k == "hostname" or (k == primary and "hostname" not in host): continue
                    # Apply YAML-style quoting to keys and values
                    q_k = format_yaml_value(str(k), -1, 'string')
                    q_v = format_yaml_value(str(v), -1, 'string')
                    parts.append(f"{q_k}={q_v}")
                host_lines.append(" ".join(parts))
        return host_lines

    # 1. global_vars
    for node in nodes:
        if node.key == 'global_vars' and is_node_enabled(node):
            if node.description:
                if node.description.startswith("#"):
                    clean_desc = node.description[1:]
                    if clean_desc.startswith(" "): clean_desc = clean_desc[1:]
                    lines.extend(generate_banner(clean_desc, width=42))
                else:
                    for desc_line in node.description.splitlines():
                        lines.append(f"# {desc_line}")
            lines.append("[all:vars]")
            val = resolve_node_value(node)
            if isinstance(val, dict):
                for k, v in val.items(): 
                    # Apply YAML-style quoting
                    q_v = format_yaml_value(str(v), -1, 'string')
                    lines.append(f"{k}={q_v}")
            lines.append("")

    # 2. groups
    for node in nodes:
        if node.key == 'groups' and is_node_enabled(node):
            groups_val = resolve_node_value(node) or {}
            schema_map = {c.key: c for c in node.children}
            ordered_keys = list(schema_map.keys())
            for gk in groups_val: 
                if gk not in ordered_keys: ordered_keys.append(gk)
                
            for gk in ordered_keys:
                g_schema = schema_map.get(gk)
                if g_schema and not is_node_enabled(g_schema): continue
                
                hosts = groups_val.get(gk, [])
                if g_schema and g_schema.description:
                    if g_schema.description.startswith("#"):
                        clean_desc = g_schema.description[1:]
                        if clean_desc.startswith(" "): clean_desc = clean_desc[1:]
                        lines.extend(generate_banner(clean_desc, width=42))
                    else:
                        for desc_line in g_schema.description.splitlines():
                            lines.append(f"# {desc_line}")
                hint = get_override_hint(g_schema, override_hint_marker) if g_schema else ""
                lines.append(f"[{gk}]{hint}")
                lines.extend(_render_hosts(hosts, g_schema.children if g_schema else []))
                lines.append("")

    # 3. aggregations
    for node in nodes:
        if node.key == 'aggregations' and is_node_enabled(node):
            aggr_val = resolve_node_value(node) or {}
            schema_map = {c.key: c for c in node.children}
            ordered_keys = list(schema_map.keys())
            for ak in aggr_val:
                if ak not in ordered_keys: ordered_keys.append(ak)
            
            for ak in ordered_keys:
                c_schema = schema_map.get(ak)
                if c_schema and not is_node_enabled(c_schema): continue
                
                if c_schema and c_schema.description:
                    if c_schema.description.startswith("#"):
                        clean_desc = c_schema.description[1:]
                        if clean_desc.startswith(" "): clean_desc = clean_desc[1:]
                        lines.extend(generate_banner(clean_desc, width=42))
                    else:
                        for desc_line in c_schema.description.splitlines():
                            lines.append(f"# {desc_line}")
                lines.append(f"[{ak}:children]")
                # prioritize inner schema default_value, else outer aggr_val
                children_groups = resolve_node_value(c_schema) if c_schema else None
                if children_groups is None: children_groups = aggr_val.get(ak, [])
                
                if isinstance(children_groups, list):
                    lines.extend([str(i) for i in children_groups])
                elif children_groups:
                    lines.append(str(children_groups))
                lines.append("")

    return lines

def merge_nodes(base: List[SchemaNode], override: List[SchemaNode]) -> List[SchemaNode]:
    """
    Merge two lists of SchemaNodes. 
    Nodes in 'override' with the same 'key' will replace or merge with nodes in 'base'.
    """
    base_map = {n.key: n for n in base}
    
    for o_node in override:
        # Ensure o_node is a SchemaNode
        o_obj = o_node
        if isinstance(o_node, dict):
            o_obj = SchemaNode.from_dict(o_node)
            
        if o_obj.key in base_map:
            b_node = base_map[o_obj.key]
            
            # This is an actual override
            b_node.is_override = True
            
            if o_obj.override_strategy == "replace":
                # Replace the entire node
                o_obj.is_override = True
                base_map[o_obj.key] = o_obj
            else:
                # strategy: Merge
                b_node.is_override = True
                
                # Default to showing hint unless explicitly false in override
                if isinstance(o_node, dict):
                    b_node.override_hint = o_node.get('override_hint', True)
                else:
                    # If it's a SchemaNode, it might have default False. 
                    # Use the override node's hint setting, but default to True for overrides
                    # unless it was explicitly specified as False in the origin.
                    # Since we can't easily know if it was explicit on a SchemaNode,
                    # we check if it's already True or if we want to force it.
                    b_node.override_hint = getattr(o_obj, 'override_hint', True)
                
                b_node.description = o_obj.description or b_node.description
                b_node.default_value = o_obj.default_value if o_obj.default_value is not None else b_node.default_value
                b_node.required = o_obj.required
                b_node.multi_type = o_obj.multi_type or b_node.multi_type
                b_node.item_multi_type = o_obj.item_multi_type or b_node.item_multi_type
                b_node.regex_enable = o_obj.regex_enable
                b_node.regex = o_obj.regex if o_obj.regex is not None else b_node.regex
                
                if o_obj.children:
                    b_node.children = merge_nodes(b_node.children, o_obj.children)
        else:
            base.append(o_obj)
            base_map[o_obj.key] = o_obj
            
    return list(base_map.values()) # Return the updated list of nodes

def load_json_nodes(path) -> List[SchemaNode]:
    with open(path, 'r') as f:
        data = json.load(f)
    if isinstance(data, list):
        return [SchemaNode.from_dict(n) for n in data]
    return [SchemaNode.from_dict(data)]

@dataclass
class EnvVarDef:
    key: str
    description: str = ""

@dataclass
class TriggerCondition:
    key: str
    regex: str

@dataclass
class ScenarioTrigger:
    source: str
    logic: str = "and"
    conditions: List[TriggerCondition] = field(default_factory=list)

@dataclass
class ScenarioConfig:
    value: str
    path: str
    trigger: ScenarioTrigger
    required_env_vars: List[EnvVarDef] = field(default_factory=list)
    priority: int = 999
    config: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AppConfig:
    override_hint_style: str = "# <=== [Override]"
    scenario_env_key: str = "SCENARIO_TYPE"
    top_level_spacing: int = 2
    default_env_vars: List[EnvVarDef] = field(default_factory=list)
    scenarios: List[ScenarioConfig] = field(default_factory=list)
    raw_config: Dict[str, Any] = field(default_factory=dict)

def parse_config(raw: dict) -> AppConfig:
    app_cfg = AppConfig(
        override_hint_style=raw.get("override_hint_style", "# <=== [Override]"),
        scenario_env_key=raw.get("senario_env_key", "SCENARIO_TYPE"),
        top_level_spacing=raw.get("top_level_spacing", 2),
        raw_config=raw
    )
    
    for ev in raw.get("default_env_vars", []):
        if isinstance(ev, dict):
            app_cfg.default_env_vars.append(EnvVarDef(key=ev.get("key", ""), description=ev.get("description", "")))
        else:
            app_cfg.default_env_vars.append(EnvVarDef(key=str(ev)))
            
    for sc in raw.get("senarios", []):
        t_data = sc.get("trigger", {})
        conds = []
        for c in t_data.get("conditions", []):
            conds.append(TriggerCondition(key=c.get("key", ""), regex=c.get("regex", "")))
            
        trigger = ScenarioTrigger(
            source=t_data.get("source", "default"),
            logic=t_data.get("logic", "and"),
            conditions=conds
        )
        
        req_vars = []
        for ev in sc.get("required_env_vars", []):
            if isinstance(ev, dict):
                req_vars.append(EnvVarDef(key=ev.get("key", ""), description=ev.get("description", "")))
            else:
                req_vars.append(EnvVarDef(key=str(ev)))
                
        scenario = ScenarioConfig(
            value=sc.get("value", ""),
            path=sc.get("path", ""),
            trigger=trigger,
            required_env_vars=req_vars,
            priority=sc.get("priority", 999),
            config=sc
        )
        app_cfg.scenarios.append(scenario)
        
    return app_cfg

def validate_config_scenarios(app_config: AppConfig):
    for sc in app_config.scenarios:
        if sc.trigger.source in ["user", "default"]:
            if sc.trigger.conditions:
                 print(f"\033[91m[ERROR] Config Error in scenario '{sc.value}': source '{sc.trigger.source}' must not have 'conditions'.\033[0m")
                 sys.exit(1)
        if sc.trigger.source == "env":
             if not sc.trigger.conditions:
                 print(f"\033[91m[ERROR] Config Error in scenario '{sc.value}': source 'env' must have 'conditions'.\033[0m")
                 sys.exit(1)

def determine_active_scenarios(app_config: AppConfig, env: dict) -> List[ScenarioConfig]:
    active = []
    user_selection = env.get(app_config.scenario_env_key)
    
    for sc in app_config.scenarios:
        is_active = False
        src = sc.trigger.source
        
        if src == "default":
            is_active = True
        elif src == "user":
            if user_selection == sc.value:
                is_active = True
        elif src == "env":
            if not sc.trigger.conditions:
                is_active = False
            else:
                matches = []
                for cond in sc.trigger.conditions:
                    val = env.get(cond.key, "")
                    if re.search(cond.regex, val):
                        matches.append(True)
                    else:
                        matches.append(False)
                
                if sc.trigger.logic == "and":
                    is_active = all(matches)
                elif sc.trigger.logic == "or":
                    is_active = any(matches)
        
        if is_active:
            # Overwrite priority for default
            if src == "default":
                 sc.priority = 9999
            active.append(sc)

    # Sort Descending Priority (Base -> P2 -> P1)
    active.sort(key=lambda x: x.priority, reverse=True)
    return active

def validate_required_env_vars(app_config: AppConfig, active_scenarios: List[ScenarioConfig], env: dict):
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
        print(f"\033[91m[ERROR] Missing required environment variables: {', '.join(missing)}\033[0m")
        sys.exit(1)

def validate_scenario_templates(active_scenarios: List[ScenarioConfig]):
    validation_dirs = set()
    for sc in active_scenarios:
        if sc.path and os.path.exists(sc.path):
            validation_dirs.add(sc.path)
            
    validation_errors = []
    
def validate_node(node_data: Any, file_path: str, node_key: str, is_ini: bool = False):
    """
    Validate a single node (can be dict or SchemaNode).
    """
    errors = []
    
    # Validation logic depends on raw dict for missing mandatory keys
    d = node_data
    is_obj = isinstance(node_data, SchemaNode)
    
    # 1. Mandatory attributes
    if is_obj:
        if not node_data.key:
            errors.append(f"[{file_path}] Error: Node '{node_key}' missing 'key' attribute.")
        if not node_data.multi_type:
             errors.append(f"[{file_path}] Error: Node '{node_data.key or node_key}' missing 'multi_type' attribute.")
    else:
        if "key" not in d:
             errors.append(f"[{file_path}] Error: Node '{node_key}' missing 'key' attribute.")
        if "multi_type" not in d:
             errors.append(f"[{file_path}] Error: Node '{d.get('key', node_key)}' missing 'multi_type' attribute.")
             
    key = node_data.key if is_obj else d.get("key", node_key)
    multi_type = node_data.multi_type if is_obj else d.get("multi_type", [])
    item_multi_type = node_data.item_multi_type if is_obj else d.get("item_multi_type", [])
    children = node_data.children if is_obj else d.get("children", [])

    # Legacy check (if not obj)
    if not is_obj and "type" in d:
        errors.append(f"[{file_path}] Warning: Node '{key}' legacy 'type' field found. Use 'multi_type'.")

    # Conflict check
    if "object" in multi_type and "list" in multi_type:
        errors.append(f"[{file_path}] Error: Node '{key}' 'multi_type' cannot contain both 'object' and 'list'.")

    # List consistency
    if "list" in multi_type and not item_multi_type:
         errors.append(f"[{file_path}] Error: Node '{key}' 'multi_type' contains 'list' but 'item_multi_type' is empty.")

    # Object consistency
    if "object" in multi_type and item_multi_type:
         errors.append(f"[{file_path}] Error: Node '{key}' 'multi_type' contains 'object' but 'item_multi_type' is not empty.")
            
    # INI specific root key validation
    if is_ini and "." not in node_key: # node_key here is the top-level key like 'global_vars'
        allowed_ini_roots = ['aggregations', 'global_vars', 'groups']
        if key not in allowed_ini_roots:
            errors.append(f"{file_path} [{node_key}]: invalid INI root key '{key}'. Must be one of {allowed_ini_roots}.")

    # INI specific child type validation
    if is_ini:
        parts = node_key.split('.')
        if len(parts) == 2 and parts[0] in ['aggregations', 'groups']:
            if not multi_type or "list" not in multi_type:
                errors.append(f"{file_path} [{node_key}]: node under INI '{parts[0]}' must have 'multi_type' containing 'list'.")
            
            if parts[0] == "groups":
                if not item_multi_type or "object" not in item_multi_type:
                    errors.append(f"{file_path} [{node_key}]: node under INI 'groups' must have 'item_multi_type' containing 'object'.")
                
                # Check for mandatory 'hostname' child if children exist
                if children:
                    has_hostname = any((c.key if not isinstance(c, dict) else c.get('key')) == 'hostname' for c in children)
                    if not has_hostname:
                        errors.append(f"{file_path} [{node_key}]: node under INI 'groups' must contain a 'hostname' child key.")

    if not isinstance(item_multi_type, list):
        errors.append(f"{file_path} [{node_key}]: 'item_multi_type' must be a list.")

    for child in children:
        child_key = child.key if is_obj else child.get("key", "UNKNOWN")
        errors.extend(validate_node(child, file_path, f"{node_key}.{child_key}", is_ini))
    
    return errors

def validate_schema(data, file_path):
    errors = []
    
    is_ini = file_path.endswith('.ini.json')
    if isinstance(data, list):
        for node in data:
            n_key = node.key if hasattr(node, 'key') else node.get('key', 'UNKNOWN')
            errors.extend(validate_node(node, file_path, n_key, is_ini))
    else:
        n_key = data.key if hasattr(data, 'key') else data.get('key', 'UNKNOWN')
        errors.extend(validate_node(data, file_path, n_key, is_ini))
        
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

def collect_scenario_files(active_scenarios: List[ScenarioConfig]) -> dict:
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

def generate_output_files(file_map: dict, env: dict, raw_config: dict):
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
             last_source = sources[-1]
             print(f"[INFO] Generating {final_rel_path} from scenario (copy/template) - Source: {last_source['scenario']}")
             if os.path.exists(final_output_path):
                print(f"\033[93m[WARNING] File {final_rel_path} already exists. Skipping.\033[0m")
                continue

             content = ""
             with open(last_source['path'], 'r') as f:
                 content = f.read()
             
             try:
                 content = resolve_content_vars(content, env)
             except KeyError as e:
                 print(f"Error substituting vars in {final_rel_path}: Missing {e}")
             
             save_file(final_output_path, content)
        
        else:
             merged_nodes = []
             is_ini = any(s['path'].endswith('.ini.json') for s in sources)
             
             if is_ini or final_rel_path.endswith('.ini'):
                 print(f"[INFO] Generating {final_rel_path} from INI schema")
                 schema_func = generate_ini_from_schema
             else:
                 print(f"[INFO] Generating {final_rel_path} from YAML schema")
                 schema_func = generate_yaml_from_schema
             
             if os.path.exists(final_output_path):
                print(f"\033[93m[WARNING] File {final_rel_path} already exists. Skipping.\033[0m")
                continue

             for s in sources:
                 try:
                     nodes = load_json_nodes(s['path'])
                     merged_nodes = merge_nodes(merged_nodes, nodes)
                 except Exception as e:
                     print(f"Error loading/merging {s['path']}: {e}")
            
            # Execute string substitution explicitly on original schemas and discard string replacements
             substitute_env_in_default_values(merged_nodes, env)
            
             if is_ini:
                 # It's an ini file
                 ini_lines = generate_ini_from_schema(merged_nodes, config=raw_config)
                 content = "\n".join(ini_lines).strip() + "\n"
             else:
                 yaml_lines = generate_yaml_from_schema(merged_nodes, config=raw_config)
                 content = "\n".join(yaml_lines).strip() + "\n"
                 
             save_file(final_output_path, content)

def process_scenarios(config_path, check_only=False):
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
