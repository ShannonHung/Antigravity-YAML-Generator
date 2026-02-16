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

def format_yaml_value(value, indent_level):
    """
    Format a value as YAML. 
    Simple scalar implementation. Complex objects/lists use PyYAML dump to ensure correctness.
    """
    prefix = "  " * indent_level
    if isinstance(value, (bool, int, float, str)) or value is None:
        # Use yaml.dump to handle quoting, escaping, etc.
        # dump returns "value\n..." so we strip.
        s = yaml.dump(value, default_flow_style=None, width=1000).strip()
        if s.endswith('\n...'): s = s[:-4]
        
        # If multiline, indent subsequent lines
        if '\n' in s:
            lines = s.splitlines()
            # First line is attached to key, so no prefix.
            # Subsequent lines need prefix.
            # BUT yaml.dump output for | already has indentation (2 chars default).
            # We want to ADD our prefix to that.
            return "\n".join([lines[0]] + [f"{prefix}{line}" for line in lines[1:]])
        return s
    else:
        # List or Dict
        # We need it to be indented correctly relative to the parent.
        # But yaml.dump indents from 0.
        # We'll dump it, then indent lines.
        s = yaml.dump(value, default_flow_style=False, width=1000)
        lines = s.splitlines()
        indented_lines = []
        for i, line in enumerate(lines):
            # For complex types, usually starts on new line?
            indented_lines.append(line)
        
        # We prefix ALL lines with indent, assuming they are placed on new line.
        return "\n" + "\n".join([f"{prefix}{line}" for line in indented_lines])

def generate_yaml_from_schema(nodes, indent=0, config=None):
    """
    Generate YAML content strings from the schema list.
    """
    lines = []
    prefix = "  " * indent
    
    override_hint_marker = ""
    override_hint_enabled = False
    if config:
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
        val_type = node.get('type')
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
                    lines.append("")
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

        if val_type == 'list' and children:
            if value is not None:
                # Pass indent to format_yaml_value
                # It returns string starting with \n for complex types (list/dict)
                val = format_yaml_value(value, indent)
                if val.strip(): # if not empty
                     lines.append(f"{line_content}{current_hint}{val}")
                else:
                     lines.append(f"{line_content} []{current_hint}")
            else:
                if children:
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

        elif val_type == 'object' or (val_type is None and children):
            # Object with properties
            lines.append(f"{line_content}{current_hint}")
            lines.extend(generate_yaml_from_schema(children, indent + 1, config))
            
        else:
            # Primitive
            val_to_print = value
            if val_to_print is None:
                if node.get('regex'):
                    val_to_print = node.get('regex')
                else:
                    if val_type == 'bool': val_to_print = False
                    elif val_type == 'string': val_to_print = ""
                    elif val_type == 'number': val_to_print = 0
            
            # Format value, pass indent
            val_str = format_yaml_value(val_to_print, indent)
            
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

    # 2. Collect files
    # Base templates
    default_dir = os.path.join(os.path.dirname(config_path), "default")
    
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
