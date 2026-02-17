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

def resolve_path(path_template, env):
    """Substitute {VAR} in path_template with values from env."""
    for key, value in env.items():
        placeholder = f"{{{key}}}"
        if placeholder in path_template:
            path_template = path_template.replace(placeholder, value)
    
    # Check if any placeholders remain
    if re.search(r"\{[A-Z0-9_]+\}", path_template):
        print(f"Warning: Unresolved placeholders in path: {path_template}")
    return path_template

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
            # Recursively merge if children exist?
            # The propmt example shows overriding "trident_ssd_object_ids"
            # referencing a value list.
            # If the override provides a 'value', it probably replaces the default value.
            # If the override provides 'children', we might need deep merge options.
            # For now, we'll do a shallow merge of properties, but if 'value' is present, it overwrites.
            source_node.update(override)
        else:
            # Append new
            source_nodes.append(override)
            source_map[key] = override # Update map for subsequent lookups
            
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

def generate_yaml_from_schema(nodes, indent=0, config=None):
    """
    Generate YAML content strings from the schema list.
    """
    lines = []
    prefix = "  " * indent
    
    override_hint_marker = ""
    override_hint_enabled = False
    
    top_level_spacing = 2
    if config:
        top_level_spacing = config.get("top_level_spacing", 2)
        
        # Prompt says style is "<=== [Override]", but output shows "# <=== [Override]"
        # We ensure it acts as a comment.
        style = config.get("override_hint_style", "<=== [Override]")
        if not style.strip().startswith("#"):
            style = f"# {style}"
        override_hint_marker = style
    
    is_first = True
    for node in nodes:
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
            
        override_hint = node.get('override_hint', False)
        
        # Logic: use default_value, fallback to regex if empty
        default_value = node.get('default_value')
        if default_value is None or default_value == "":
            value = node.get('regex')
        else:
            value = default_value

        children = node.get('children', [])
        
        # 1. Output Description
        if description:
            if indent == 0:
                if not is_first:
                    for _ in range(top_level_spacing):
                        lines.append("")
                
                banner_line = f"{prefix}# {'=' * 42}"
                lines.append(banner_line)
                lines.append(f"{prefix}# {description}")
                lines.append(banner_line)
            else:
                lines.append(f"{prefix}# {description}")
        
        if indent == 0:
            is_first = False
            
        # 2. Output Key-Value
        line_content = f"{prefix}{key}:"
        
        # Determine value to print
        current_hint = ""
        if override_hint:
             current_hint = f" {override_hint_marker}"

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

def process_scenario(config_path, base_path, output_root=None):
    # 1. Load configuration
    try:
        config = load_json(config_path)
    except Exception as e:
        print(f"Error loading config {config_path}: {e}")
        return

    scenario_env_key = config.get("senario_env_key", "SCENARIO_TYPE")
    env = load_env()
    current_scenario_name = env.get(scenario_env_key)

    # Validation: Check if SCENARIO_TYPE is provided
    if not current_scenario_name:
        print(f"\033[91m[ERROR] Environment variable {scenario_env_key} is missing.\033[0m")
        sys.exit(1)
    
    # Resolve scenario path and validate scenario existence
    scenario_path = None
    scenario_config = None
    if current_scenario_name:
        for s in config.get("senarios", []):
            if s["value"] == current_scenario_name:
                scenario_path = s["path"]
                scenario_config = s
                break
    
    if not scenario_config:
        print(f"\033[91m[ERROR] Scenario '{current_scenario_name}' not found in configuration.\033[0m")
        sys.exit(1)

    # Validation: Check default environment variables
    missing_vars = []
    for item in config.get("default_env_vars", []):
        var_name = item.get("key") if isinstance(item, dict) else item
        if var_name and var_name not in env:
            missing_vars.append(var_name)
    
    # Validation: Check scenario-specific environment variables
    if scenario_config:
        for item in scenario_config.get("required_env_vars", []):
            var_name = item.get("key") if isinstance(item, dict) else item
            if var_name and var_name not in env:
                missing_vars.append(var_name)
    
    if missing_vars:
        print(f"\033[91m[ERROR] Missing required environment variables: {', '.join(missing_vars)}\033[0m")
        sys.exit(1)
    
    print(f"Scenario: {current_scenario_name}, Path: {scenario_path}")

    # 1.5 Validate templates
    default_dir = os.path.join(os.path.dirname(config_path), "default")
    # Use a set to avoid duplicates if scenario_path == default_dir
    validation_dirs = {default_dir}
    if scenario_path and os.path.exists(scenario_path):
        validation_dirs.add(scenario_path)
    
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

    # 2. Collect files
    # Base templates
    # default_dir already defined above
    
    # We need to preserve relative paths but Resolve {VAR} in them?
    # Actually, we should collect paths as "templates/relative/path" strings
    # But later replace {VAR} in the output path.
    
    # Let's map: relative_path_template -> { 'default': abs_path, 'scenario': abs_path }
    file_map = {}
    
    def walk_dir(root, source_type):
        if not os.path.exists(root):
            return
        for dirpath, _, filenames in os.walk(root):
            rel_dir = os.path.relpath(dirpath, root)
            if rel_dir == ".": rel_dir = ""
            
            for f in filenames:
                rel_path = os.path.join(rel_dir, f)
                if rel_path not in file_map:
                    file_map[rel_path] = {}
                file_map[rel_path][source_type] = os.path.join(dirpath, f)

    walk_dir(default_dir, 'default')
    if scenario_path:
        # Resolve scenario_path relative to cwd? Or relative to config?
        # config says "templates/scenario/tvm" which is relative to CWD usually.
        # Let's assume relative to CWD.
        if not os.path.exists(scenario_path):
            print(f"Warning: Scenario path {scenario_path} not found.")
        else:
            walk_dir(scenario_path, 'scenario')

    # 3. Process files
    # Regroup by output_path_template to handle collisions (e.g. host.ini.json vs host.ini)
    output_map = {}
    
    for rel_path, sources in file_map.items():
        if rel_path.endswith('.json'):
            out_tpl = rel_path[:-5]
        else:
            out_tpl = rel_path
            
        if out_tpl not in output_map:
            output_map[out_tpl] = {'default': None, 'scenario': None}
            
        if sources.get('default'):
            # If we already have a default for this output?
            # e.g. default has host.ini AND host.ini.json?
            # Prefer .json or raw?
            # If both exist in default, it's ambiguous. Assume likely only one exists.
            # But if collision, we update.
            # Storing the SOURCE path
            output_map[out_tpl]['default'] = sources['default']
            
        if sources.get('scenario'):
            output_map[out_tpl]['scenario'] = sources['scenario']

    for final_rel_path_tpl, sources in output_map.items():
        # Resolve vars in the path

        # Resolve vars in the path
        # Example: templates/scenario/default/{CLUSTER_NAME}/...
        # rel_path is "{CLUSTER_NAME}/group_vars/trident.yml.json"
        
        final_rel_path = resolve_path(final_rel_path_tpl, env)
        
        # Output path (relative to CWD or specific root?)
        # Step 2.1 example output: "f12-k8s1-c1/group_vars/trident.yml"
        # Since `default` is `templates/sample/default` (in example 2.1)
        # But here we are at `templates/scenario/default`.
        # The prompt examples imply the CWD is the root for output?
        # "produces corresponding folder ... f12-k8s1-c1/..."
        # So yes, output is relative to CWD.
        
        output_file = final_rel_path
        
        # Decide process logic
        source_default = sources.get('default')
        source_scenario = sources.get('scenario')
        
        # Case 1: Scenario exists and is NOT json (and overrides default entirely)
        # Or Just Scenario exists (new file)
        
        target_source = source_default
        override_source = None
        
        if source_scenario:
            if not source_scenario.endswith('.json'):
                # Direct replacement/copy
                # Even if default exists? Yes: "cover original"
                print(f"Generating {output_file} from scenario (copy/template)")
                # Just copy? Or substitute vars in content?
                # Prompt doesn't explicitly say replace vars in content for raw files, 
                # but "Dynamic Context Injection ... in output path, descriptions, NUMERIC CONTENT".
                # So we should probably read and replace {VAR} in content too?
                # "2. ... auto grab ... and in ... numerical content perform {VAR} replacement"
                
                content = ""
                with open(source_scenario, 'r') as f:
                    content = f.read()
                
                # Simple replacement
                # (Might be risky for binary, but these are text files)
                content = resolve_path(content, env)
                save_file(output_file, content)
                continue
                
            else:
                # Scenario is JSON.
                override_source = source_scenario
                # If default has a JSON source:
                if source_default and source_default.endswith('.json'):
                    target_source = source_default
                # If default is raw?
                elif source_default:
                     # Raw default, JSON scenario override?
                     # "network.yml.json indicates only covering some keys".
                     # This implies we parse the raw default? No, usually we generate from json.
                     # If raw default exists, we probably can't 'merge' a json schema into it easily without parsing YAML.
                     # But prompts implies the templates ARE json definitions. 
                     # "scan ... .json definition file convert to entity".
                     # So likely the 'default' files are usually .json.
                     pass 
        
        if not target_source:
             # Scenario only, and it is JSON?
             # Treat as new definition.
             target_source = override_source
             override_source = None
        
        # If we are here, we are processing a JSON definition (target_source) with optional json override (override_source).
        if target_source and target_source.endswith('.json'):
            print(f"Generating {output_file} from JSON schema")
            
            nodes = load_json(target_source)
            if isinstance(nodes, dict):
                nodes = [nodes]

            if override_source:
                overrides = load_json(override_source)
                # Overrides might be a List (schema items) or Dict (single item override wrapper?)
                # Example 6: trident.json is a DICT {"key":..., "value":...}
                # Example merged list implies it supports merging.
                nodes = merge_nodes(nodes, overrides)
            
            # Generate YAML
            yaml_lines = generate_yaml_from_schema(nodes, config=config)
            content = "\n".join(yaml_lines) + "\n"
            
            # Post-process content for VAR replacement?
            content = resolve_path(content, env)
            
            save_file(output_file, content)

if __name__ == "__main__":
    # Ensure config path is flexible
    config_path = "templates/scenario/config.json"
    process_scenario(config_path, "templates/scenario/default")
