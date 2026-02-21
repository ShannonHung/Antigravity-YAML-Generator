import os
import sys
import json
import re
import shutil
import yaml
from dataclasses import dataclass, field
from typing import List, Dict, Any

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

def substitute_env_in_default_values(nodes, env):
    """
    Recursively substitute environment variables explicitly targeting `default_value` nodes.
    This preserves explicit literal values from `regex` attributes which avoids unintended substitution.
    """
    for node in nodes:
        # Only substitute if default_value exists
        default_val = node.get('default_value')
        if default_val is not None:
            if isinstance(default_val, str):
                node['default_value'] = resolve_content_vars(default_val, env)
            elif isinstance(default_val, dict):
                # We need to deeply resolve dict string values
                node['default_value'] = resolve_dict_strings(default_val, env)
            elif isinstance(default_val, list):
                node['default_value'] = resolve_list_strings(default_val, env)
        
        # Recurse through children
        children = node.get('children')
        if children and isinstance(children, list):
            substitute_env_in_default_values(children, env)

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
    return content

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

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
    # Convert source to dict for easier access: key -> node
    # Since it's a list of definitions, we assume 'key' property is unique at this level.
    source_map = {item.get('key'): item for item in source_nodes}
    
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
    prefix = "  " * indent_level
    
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
    
    if isinstance(value, (list, dict)):
        s = yaml.dump(value, default_flow_style=False, width=1000)
        lines = s.splitlines()
        indented_lines = []
        for line in lines:
            indented_lines.append(line)
        return "\n" + "\n".join([f"{prefix}{line}" for line in indented_lines])

    # 4. Handle Scala String directly using our logic to avoid yaml.dump overhead for simple strings?
    # Actually, let's use the same logic pattern for consistency, or just call the logic directly.
    # calling yaml.dump for a simple string adds a newline and "..." etc.
    
    # Re-use the representer logic for simple return? 
    # Or just duplicate the logic here for performance/simplicity? 
    # Let's duplicate logic for scalar string return to avoid yaml.dump artifacts.
    
    s_val = str(value)
    
    needs_quotes = False
    if not s_val: needs_quotes = True
    elif re.match(r'^(true|false|yes|no|on|off)$', s_val, re.IGNORECASE): needs_quotes = True
    elif re.match(r'^[\d\.]+$', s_val): needs_quotes = True
    elif any(c in s_val for c in ":#[]{}/"): needs_quotes = True
    
    if needs_quotes:
        escaped = s_val.replace('"', '\\"')
        return f'"{escaped}"'
    else:
        if re.match(r'^[a-zA-Z0-9_\-\.]+$', s_val):
            return s_val
        else:
            escaped = s_val.replace('"', '\\"')
            return f'"{escaped}"'
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

def get_override_hint(node, style_marker):
    """
    Return the formatted override hint string if enabled in the node.
    """
    if node.get('override_hint', False):
        return f" {style_marker}"
    return ""

def generate_banner(description, indent=0, width=42, comment_char="#"):
    """
    Generate a standard banner with description.
    """
    prefix = "  " * indent
    lines = []
    lines.append(f"{prefix}{comment_char} {'=' * width}")
    lines.append(f"{prefix}{comment_char} {description}")
    lines.append(f"{prefix}{comment_char} {'=' * width}")
    return lines

def resolve_node_value(node):
    """
    Resolve the value to print: default_value (if present/not empty) OR regex.
    """
    default_value = node.get('default_value')
    # If default_value is explicitly set (even False or 0), use it.
    # If it's None or empty string, fallback to regex.
    if default_value is not None and default_value != "":
        return default_value
    return node.get('regex')
def is_node_enabled(node):
    """
    Check if node is enabled based on 'required' field.
    Deprecated if required is None, empty string, or missing.
    """
    req = node.get('required')
    if req is None or req == "":
        return False
    return True

def generate_yaml_from_schema(nodes, indent=0, config=None):
    """
    Generate YAML content strings from the schema list.
    """
    lines = []
    prefix = "  " * indent
    
    override_hint_marker = get_override_hint_style(config)
    
    # We still check "top_level_spacing"
    top_level_spacing = 2
    if config:
        top_level_spacing = config.get("top_level_spacing", 2)
    
    is_first = True
    for node in nodes:
        # Check deprecation/enabled status
        if not is_node_enabled(node):
            continue
            
        key = node.get('key')
        if not key: continue
        
        description = node.get('description')
        
        # Refactor: use multi_type
        # Old: val_type = node.get('type')
        multi_type = node.get('multi_type', [])
        # Handle case where multi_type might be None (from some old override?)
        if multi_type is None: multi_type = []
        
        # Validation 2: check object AND list conflict
        if "object" in multi_type and "list" in multi_type:
            print(f"\033[91m[ERROR] Invalid multi_type definition in key '{key}': 'object' and 'list' cannot simplify exist.\033[0m")
            sys.exit(1)
            
        current_hint = get_override_hint(node, override_hint_marker)
        
        # Logic: use default_value, fallback to regex if empty
        value = resolve_node_value(node)

        children = node.get('children', [])
        
        # 1. Output Top Level Spacing
        if indent == 0 and not is_first:
            for _ in range(top_level_spacing):
                lines.append("")
                
        # 2. Output Description
        if description:
            if indent == 0:
                banner_lines = generate_banner(description, indent=indent)
                lines.extend(banner_lines)
            else:
                lines.append(f"{prefix}# {description}")
        
        if indent == 0:
            is_first = False
            
        # 2. Output Key-Value
        line_content = f"{prefix}{key}:"

        # Logic for types
        # Priority: list > object > others
        # "Validation 3: ... future types ... treat as string"
        
        if "list" in multi_type:
            # It's a list
             if children:
                if value is not None and isinstance(value, list) and len(value) > 0:
                    # Pass indent to format_yaml_value
                    # It returns string starting with \n for complex types (list/dict)
                    val = format_yaml_value(value, indent, 'list')
                    if val.strip(): # if not empty
                         lines.append(f"{line_content}{current_hint}{val}")
                    else:
                         lines.append(f"{line_content} []{current_hint}")
                else:
                    # No value or empty, generate from children schema?
                    # "children" in list type means schema for items.
                    # We usually output empty list if no value provided?
                    # Or do we generate example items?
                    # In previous example, we traversed children to show structure.
                    
                    if children and not value:
                        # Generate structure from schema (example item)
                         lines.append(f"{line_content}{current_hint}")
                         child_lines = generate_yaml_from_schema(children, indent + 1, config)
                        
                         if child_lines:
                            first = True
                            for child in children:
                                c_lines = generate_yaml_from_schema([child], indent + 1, config) 
                                processed_c_lines = []
                                for j, cl in enumerate(c_lines):
                                    if first and cl.strip().startswith(child['key'] + ":"):
                                        stripped = cl.lstrip()
                                        processed_c_lines.append(f"{'  ' * indent}  - {stripped}")
                                        first = False
                                    else:
                                        if not first:
                                            processed_c_lines.append(f"{'  ' * indent}    {cl.lstrip()}")
                                        else:
                                            processed_c_lines.append(cl)
                                lines.extend(processed_c_lines)
                         else:
                            lines.append(f"{prefix}  []")
                    else:
                        lines.append(f"{line_content} []{current_hint}")
             else:
                  # List without children schema -> simple list value
                 if value is not None:
                      val = format_yaml_value(value, indent, 'list')
                      lines.append(f"{line_content}{current_hint}{val}")
                 else:
                      lines.append(f"{line_content} []{current_hint}")

        elif "object" in multi_type:
             # Object with properties
             if children:
                 lines.append(f"{line_content}{current_hint}")
                 lines.extend(generate_yaml_from_schema(children, indent + 1, config))
             else:
                 # Object but no children?
                 if value is not None:
                      val = format_yaml_value(value, indent, 'object')
                      lines.append(f"{line_content}{current_hint}{val}")
                 else:
                      lines.append(f"{line_content} {{}}{current_hint}")
            
        else:
            # Primitive / Custom Types
            # Logic 3: Treat as string (unless bool/number detected via multi_type?)
            # Valid types: bool, number, string. Others -> string
            
            effective_type = 'string'
            if "bool" in multi_type: effective_type = 'bool'
            elif "number" in multi_type: effective_type = 'number'
            
            # Value
            val_to_print = value
            if val_to_print is None:
                # Fallback defaults?
                if effective_type == 'bool': val_to_print = False
                elif effective_type == 'number': val_to_print = 0
                else: val_to_print = ""
                # But requirement says: "if number produce default_value, if no default output regex"
                # We already set value = default_value or regex above.
                if val_to_print == "" and node.get('regex'):
                     val_to_print = node.get('regex')
            
            # Format value, pass indent
            val_str = format_yaml_value(val_to_print, indent, effective_type)
            
            # Check multiline
            if '\n' in val_str:
                 lines.append(f"{line_content}{current_hint} {val_str}")
            else:
                 lines.append(f"{line_content} {val_str}{current_hint}")

    return lines

def generate_ini_from_schema(nodes, config=None):
    """
    Generate INI content strings from the schema list.
    Specifically handles 'global_vars', 'groups', and 'aggregations'.
    """
    lines = []
    
    override_hint_marker = get_override_hint_style(config)
    
    # 1. global_vars -> [all:vars]
    for node in nodes:
        if not is_node_enabled(node): continue
        if node.get('key') == 'global_vars':
            # Header
            description = node.get('description', 'all:vars section')
            lines.extend(generate_banner(description, width=42))
            lines.append("[all:vars]")
            
            # Values
            default_value = resolve_node_value(node)
            # Ensure it is a dict
            if isinstance(default_value, dict):
                for k, v in default_value.items():
                    lines.append(f"{k}={v}")
            lines.append("") # Newline
            
    # 2. groups -> [group_name]
    for node in nodes:
        if not is_node_enabled(node): continue
        if node.get('key') == 'groups':
            groups_val = resolve_node_value(node) or {}
            children_schema = node.get('children', [])
            
            # Map children schema for hints/descriptions
            schema_map = {c['key']: c for c in children_schema}
            
            if isinstance(groups_val, dict):
                # Ensure we process groups in schema even if not in default_value
                ordered_group_names = [c['key'] for c in children_schema]
                for g in groups_val.keys():
                    if g not in ordered_group_names:
                        ordered_group_names.append(g)

                for group_name in ordered_group_names:
                    hosts = groups_val.get(group_name, [])
                    # Get schema info
                    g_schema = schema_map.get(group_name, {})
                    
                    # Check deprecation for the group node
                    if g_schema and not is_node_enabled(g_schema):
                        continue
                        
                    desc = g_schema.get('description', f"{group_name} nodes")
                    hint = get_override_hint(g_schema, override_hint_marker)
                    
                    lines.extend(generate_banner(desc, width=42))
                    lines.append(f"[{group_name}]{hint}")
                    
                    # Fallback to schema to generate an example host if empty
                    if not hosts and g_schema:
                        example_host = {}
                        for item_schema in g_schema.get('children', []):
                            val = item_schema.get('default_value')
                            if not val and item_schema.get('regex'):
                                v = item_schema.get('regex')
                                example_host[item_schema['key']] = f'"{v}"'
                            else:
                                example_host[item_schema['key']] = val if val is not None else ""
                        if example_host:
                            hosts = [example_host]

                    if isinstance(hosts, list):
                        for host in hosts:
                            if isinstance(host, dict):
                                primary_key = "hostname"
                                primary_val = host.get(primary_key)
                                
                                if not primary_val:
                                    # Fallback to first key
                                    if host:
                                        primary_key = list(host.keys())[0]
                                        primary_val = host[primary_key]
                                    else:
                                        continue
                                
                                line_parts = [str(primary_val)]
                                
                                for k, v in host.items():
                                    if k == primary_key: continue
                                    line_parts.append(f"{k}={v}")
                                
                                lines.append(" ".join(line_parts))
                            elif isinstance(host, str):
                                lines.append(host)
                    lines.append("")

    # 3. aggregations -> [group:children]
    for node in nodes:
        if not is_node_enabled(node): continue
        if node.get('key') == 'aggregations':
            # Parent default_value (fallback if child logic not used, but prompt says use child)
            # Actually, the structure is: aggregations -> children (list of groups)
            # We iterate children to find the group definition.
            
            children_schema = node.get('children', [])
            
            for child in children_schema:
                # Check deprecation for the child aggregation node
                if not is_node_enabled(child): continue
                
                group_name = child.get('key')
                if not group_name: continue
                
                desc = child.get('description', f"{group_name} children")
                
                # Resolve value from CHILD node
                # Expected value is a list of strings (children groups)
                child_val = resolve_node_value(child)
                
                lines.extend(generate_banner(desc, width=42))
                lines.append(f"[{group_name}:children]")
                
                if isinstance(child_val, list):
                    for item in child_val:
                         lines.append(str(item))
                lines.append("")
    
    return lines

def load_json_nodes(path):
    data = load_json(path)
    if isinstance(data, dict):
        return [data]
    return data

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
    
    def validate_node(node, file_path, path_context="root"):
        if 'type' in node:
            validation_errors.append(f"{file_path} [{path_context}]: legacy 'type' field found. Use 'multi_type'.")
        if 'item_type' in node:
            validation_errors.append(f"{file_path} [{path_context}]: legacy 'item_type' field found. Use 'item_multi_type'.")
            
        multi_type = node.get('multi_type')
        item_multi_type = node.get('item_multi_type', [])
        
        if multi_type is not None:
            if not isinstance(multi_type, list):
                validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' must be a list.")
            else:
                 if "object" in multi_type and "list" in multi_type:
                     validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' cannot contain both 'object' and 'list'.")
                 
                 if "list" in multi_type:
                     if not item_multi_type:
                         validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' contains 'list' but 'item_multi_type' is empty.")
                     if node.get('children') and "object" not in item_multi_type:
                          validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' contains 'list' and has children, so 'item_multi_type' must contain 'object'.")
                 
                 if "object" in multi_type:
                     if item_multi_type:
                         validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' contains 'object' but 'item_multi_type' is not empty.")
                         
                 if "list" not in multi_type and item_multi_type:
                      validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' does not contain 'list' but 'item_multi_type' is set.")

        if 'item_multi_type' in node and not isinstance(node.get('item_multi_type'), list):
            validation_errors.append(f"{file_path} [{path_context}]: 'item_multi_type' must be a list.")

        for child in node.get('children', []):
            child_key = child.get('key', 'unknown')
            validate_node(child, file_path, f"{path_context}.{child_key}")

    for search_dir in validation_dirs:
        for dirpath, _, filenames in os.walk(search_dir):
            for f in filenames:
                if f.endswith('.json') and f != "config.json":
                    path = os.path.join(dirpath, f)
                    try:
                        with open(path, 'r') as jf:
                            data = json.load(jf)
                            
                        nodes_to_check = data if isinstance(data, list) else [data]
                            
                        for node in nodes_to_check:
                            key = node.get('key', 'root')
                            validate_node(node, path, key)
                            
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

def process_scenarios(config_path):
    try:
        raw_config = load_json(config_path)
    except Exception as e:
        print(f"Error loading config {config_path}: {e}")
        return
        
    app_config = parse_config(raw_config)
    env = load_env()
    
    validate_config_scenarios(app_config)
    
    active_scenarios = determine_active_scenarios(app_config, env)
    
    if not active_scenarios:
         print(f"\033[93m[WARNING] No active scenarios found.\033[0m")
    else:
        print("Active Scenarios (in order of application):")
        for sc in active_scenarios:
            print(f" - {sc.value} (Priority: {sc.priority})")

    validate_required_env_vars(app_config, active_scenarios, env)
    validate_scenario_templates(active_scenarios)
    
    file_map = collect_scenario_files(active_scenarios)
    generate_output_files(file_map, env, app_config.raw_config)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        config_path = sys.argv[1]
    else:
        config_path = "template/scenario/config.json"
    process_scenarios(config_path)
