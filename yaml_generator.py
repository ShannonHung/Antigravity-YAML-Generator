import os
import sys
import json
import re
import shutil
import yaml

# Ensure consistent ordering in output if possible, though PyYAML handles dicts well.
# We are generating text manually for the complex schema-based JSONs to support comments.

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
        print(f"Warning: Unresolved placeholders in path: {path_template}")
    return path_template

def resolve_content_vars(content, env):
    """Substitute ${VAR} in content with values from env (for file content)."""
    # Use Regex to find ${VAR}
    # We iterate env keys to avoid complex regex logic, or use re.sub with callback.
    # Iteration is safer for known env vars, but strict user request "requires $".
    
    # Strategy 1: Iterate env vars
    for key, value in env.items():
        placeholder = f"${{{key}}}"
        if placeholder in content:
            content = content.replace(placeholder, str(value))
            
    # Strategy 2: Warn on unresolved ${...}
    if re.search(r"\$\{[A-Z0-9_]+\}", content):
        print(f"Warning: Unresolved variable placeholders in content.")
        
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
            
            if override_children:
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
        
        # 1. Output Description
        if description:
            if indent == 0:
                if not is_first:
                    for _ in range(top_level_spacing):
                        lines.append("")
                
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
                for group_name, hosts in groups_val.items():
                    # Get schema info
                    g_schema = schema_map.get(group_name, {})
                    
                    # Check deprecation for the group node
                    if not is_node_enabled(g_schema):
                        continue
                        
                    desc = g_schema.get('description', f"{group_name} nodes")
                    hint = get_override_hint(g_schema, override_hint_marker)
                    
                    lines.extend(generate_banner(desc, width=42))
                    lines.append(f"[{group_name}]{hint}")
                    
                    if isinstance(hosts, list):
                        for host in hosts:
                            if isinstance(host, dict):
                                # Determine primary key (first one?) or strictly 'hostname'?
                                # Prompt example: hostname is first, then other vars.
                                # Let's assume 'hostname' is the key, or the first key.
                                
                                # Use list(host.keys())[0] if 'hostname' not present?
                                # Prefer 'hostname' if exists.
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

def process_scenarios(config_path):
    # 1. Load config
    try:
        config = load_json(config_path)
    except Exception as e:
        print(f"Error loading config {config_path}: {e}")
        return
    
    # ---------------------------------------------------------
    # NEW: Config Validation & Active Scenario Logic
    # ---------------------------------------------------------
    scenario_env_key = config.get("senario_env_key", "SCENARIO_TYPE")
    env = load_env()
    
    # Validate Config Scenarios
    scenarios_config = config.get("senarios", [])
    for sc in scenarios_config:
        name = sc.get("value")
        trigger = sc.get("trigger", {})
        source = trigger.get("source")
        
        # Validation Rule: source is user/default -> no conditions
        if source in ["user", "default"]:
            if trigger.get("conditions") or trigger.get("vars_trigger"): 
                 print(f"\033[91m[ERROR] Config Error in scenario '{name}': source '{source}' must not have 'conditions'.\033[0m")
                 sys.exit(1)
        
        # Validation Rule: source is env -> must have conditions
        if source == "env":
             if not trigger.get("conditions"):
                 print(f"\033[91m[ERROR] Config Error in scenario '{name}': source 'env' must have 'conditions'.\033[0m")
                 sys.exit(1)

    # Determine Active Scenarios
    active_scenarios = []
    user_selection = env.get(scenario_env_key)
    
    for sc in scenarios_config:
        is_active = False
        trigger = sc.get("trigger", {})
        source = trigger.get("source")
        
        if source == "default":
            is_active = True
        elif source == "user":
            if user_selection == sc.get("value"):
                is_active = True
        elif source == "env":
            logic = trigger.get("logic", "and")
            conditions = trigger.get("conditions", [])
            
            if not conditions:
                is_active = False
            else:
                matches = []
                for cond in conditions:
                    key = cond.get("key")
                    regex = cond.get("regex")
                    val = env.get(key, "")
                    if re.search(regex, val):
                        matches.append(True)
                    else:
                        matches.append(False)
                
                if logic == "and":
                    is_active = all(matches)
                elif logic == "or":
                    is_active = any(matches)
        
        if is_active:
            # Sort by Priority Descending?
            # User: "priority: 數字越小，優先序越大" -> Small number = High Priority = Wins last.
            # So we apply logic: Base -> P2 -> P1.
            # Sort Key: Priority Descending (Big number first).
            # Default handling: source=default -> Priority 9999.
            
            p = sc.get("priority", 999)
            if source == "default":
                 p = 9999
            
            active_scenarios.append({
                "name": sc.get("value"),
                "path": sc.get("path"),
                "priority": p,
                "config": sc
            })

    # Sort Scenarios: Descending Priority (9999 -> 100 -> 2 -> 1)
    # This implies we apply 9999 first, then 100, then... 1 last.
    active_scenarios.sort(key=lambda x: x["priority"], reverse=True)
    
    if not active_scenarios:
         print(f"\033[93m[WARNING] No active scenarios found.\033[0m")
    
    print("Active Scenarios (in order of application):")
    for sc in active_scenarios:
        print(f" - {sc['name']} (Priority: {sc['priority']})")

    # Validate Required Env Vars for ALL active scenarios
    missing_vars = []
    # Default globals
    for item in config.get("default_env_vars", []):
        var_name = item.get("key") if isinstance(item, dict) else item
        if var_name and var_name not in env:
            missing_vars.append(var_name)
            
    # Scenario specifics
    for sc in active_scenarios:
        s_conf = sc.get("config", {})
        for item in s_conf.get("required_env_vars", []):
            var_name = item.get("key") if isinstance(item, dict) else item
            if var_name and var_name not in env:
                missing_vars.append(var_name)
    
    missing_vars = list(set(missing_vars))
    
    if missing_vars:
        print(f"\033[91m[ERROR] Missing required environment variables: {', '.join(missing_vars)}\033[0m")
        sys.exit(1)

    # 1.5 Validate templates
    validation_dirs = set()
    
    # Always include default? Or only if active? 
    # Logic: Validate all paths that WILL be used.
    for sc in active_scenarios:
        p = sc.get("path")
        if p and os.path.exists(p):
            validation_dirs.add(p)
    
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
                 
                 # list validation
                 if "list" in multi_type:
                     if not item_multi_type:
                         validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' contains 'list' but 'item_multi_type' is empty.")
                     # Rule: If list has children, items must be objects
                     if node.get('children') and "object" not in item_multi_type:
                          validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' contains 'list' and has children, so 'item_multi_type' must contain 'object'.")
                 
                 # object validation
                 if "object" in multi_type:
                     if item_multi_type:
                         validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' contains 'object' but 'item_multi_type' is not empty.")
                         
                 # non-list validation (general cleanup)
                 if "list" not in multi_type and item_multi_type:
                      validation_errors.append(f"{file_path} [{path_context}]: 'multi_type' does not contain 'list' but 'item_multi_type' is set.")

        if 'item_multi_type' in node:
            if not isinstance(node['item_multi_type'], list):
                validation_errors.append(f"{file_path} [{path_context}]: 'item_multi_type' must be a list.")

        # Recursive check
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
                            
                        nodes_to_check = []
                        if isinstance(data, list):
                            nodes_to_check = data
                        elif isinstance(data, dict):
                            nodes_to_check = [data]
                            
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
        
    print(f"Validation successful for {len(validation_dirs)} directories.")

    # 2. Collect files from ALL active scenarios
    # We iterate active_scenarios which are sorted by PRIORITY DESCENDING (Base -> P2 -> P1)
    
    file_map = {} 
    
    for sc in active_scenarios:
        sc_path = sc.get("path")
        if not sc_path or not os.path.exists(sc_path): continue
        
        for dirpath, _, filenames in os.walk(sc_path):
            for f in filenames:
                if f.startswith('.'): continue
                full_path = os.path.join(dirpath, f)
                rel_path_from_sc = os.path.relpath(full_path, sc_path)
                
                # Determine output relative path template
                if f.endswith('.ini.json'):
                    out_rel = rel_path_from_sc[:-9] # remove .ini.json, keep base name
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
                    "scenario": sc["name"]
                })

    # 3. Process files
    for final_rel_path_tpl, sources in file_map.items():
        # Resolve vars in the path template
        try:
            final_rel_path = resolve_path_vars(final_rel_path_tpl, env)
        except Exception as e:
             print(f"Skipping {final_rel_path_tpl}: {e}")
             continue
             
        final_output_path = os.path.join(os.getcwd(), final_rel_path)
        
        # Determine strategy
        last_raw_index = -1
        for i, s in enumerate(sources):
            if s['type'] == 'raw':
                last_raw_index = i
        
        if last_raw_index != -1 and last_raw_index < len(sources) - 1:
             print(f"\033[91m[ERROR] Conflict for {final_rel_path}: Scenario '{sources[last_raw_index]['scenario']}' provides a RAW file, but higher priority scenario '{sources[-1]['scenario']}' provides a JSON schema. Cannot merge Schema onto Raw.\033[0m")
             continue
        
        if last_raw_index == len(sources) - 1:
             last_source = sources[-1]
             print(f"Generating {final_rel_path} from scenario (copy/template) - Source: {last_source['scenario']}")
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
             start_index = 0
             if last_raw_index != -1:
                 # This case shouldn't happen due to check above, unless logic error.
                 pass
             
             merged_nodes = []
             
             # Detect if we should use INI generator based on input sources
             # If ANY source ends with .ini.json, use INI generator
             is_ini = False
             for s in sources:
                 if s['path'].endswith('.ini.json'):
                     is_ini = True
                     break
             
             if is_ini or final_rel_path.endswith('.ini'):
                 print(f"Generating {final_rel_path} from INI schema")
                 schema_func = generate_ini_from_schema
             else:
                 print(f"Generating {final_rel_path} from YAML schema")
                 schema_func = generate_yaml_from_schema
             
             if os.path.exists(final_output_path):
                print(f"\033[93m[WARNING] File {final_rel_path} already exists. Skipping.\033[0m")
                continue

             for i in range(start_index, len(sources)):
                 s = sources[i]
                 try:
                     nodes = load_json_nodes(s['path'])
                     merged_nodes = merge_nodes(merged_nodes, nodes)
                 except Exception as e:
                     print(f"Error loading/merging {s['path']}: {e}")
            
             output_lines = schema_func(merged_nodes, config=config)
             content = "\n".join(output_lines)
             # Basic trim or ensure single newline at end
             content = content.strip() + "\n"
             
             content = resolve_content_vars(content, env)
             save_file(final_output_path, content)

if __name__ == "__main__":
    # Ensure config path is flexible
    if len(sys.argv) > 1:
        config_path = sys.argv[1]
    else:
        config_path = "template/scenario/config.json"
    process_scenarios(config_path)
