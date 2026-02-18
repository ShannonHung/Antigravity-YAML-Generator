# YAML Generator Tool

This tool generates Ansible YAML files from JSON templates and raw files, supporting environment variable substitution, complex schema definitions, and strict output formatting.

## Usage

### Interactive Mode (Recommended)

Use the provided Makefile target to run the interactive generator script. This will prompt you for the required environment variables based on the selected scenario, displaying descriptions for each.

```bash
make gen
```

## Validation Logic
The generator enforces strict validation rules on the JSON templates before processing:

1. **Legacy Fields**: `type` and `item_type` are forbidden. Use `multi_type` and `item_multi_type` instead.
2. **List Structure**: `multi_type` and `item_multi_type` must be lists.
3. **Type Conflict**: `multi_type` cannot contain both `"object"` and `"list"`.
4. **List Consistency**: If `multi_type` contains `"list"`, `item_multi_type` **must not be empty**.
5. **Object Consistency**: If `multi_type` contains `"object"`, `item_multi_type` **must be empty**.
6. **Non-List Consistency**: If `multi_type` does **not** contain `"list"`, `item_multi_type` **must be empty**.
7. **List-Object Consistency**: If `multi_type` contains `"list"` AND the node has `children`, `item_multi_type` **must contain `"object"`**.

Or run the script directly:

```bash
./generate.sh
```

**Note:** The interactive script automatically clears environment variables before prompting to ensure a clean configuration session.

### Manual Mode

You can also run the python script directly, but you must ensure all required environment variables are set.

```bash
export SCENARIO_TYPE=tvm
export TVM_FAB=my-fab
export FAB=my-fab
export CLUSTER_NAME=my-cluster
export SERVICE=my-service

python3 yaml_generator.py
```

## Configuration Guide

The generator behavior is controlled by `templates/scenario/config.json`.

### Global Settings
- **`senario_env_key`**: The environment variable used to select the scenario (default: `SCENARIO_TYPE`).
- **`top_level_spacing`**: Number of blank lines to insert between top-level YAML blocks (default: `2`).
- **`override_hint_style`**: The style of the override hint comment (default: `# <=== [Override]`).
- **`default_env_vars`**: List of environment variables required for ALL scenarios.

### Scenarios Configuration (`senarios`)
The `senarios` array defines all available scenarios and their behaviors.

#### Fields
- **`value`**: The unique identifier for the scenario.
    - If `trigger.source` is `user`, this value matches the `SCENARIO_TYPE` environment variable.
- **`path`**: The file system path to the directory containing templates for this scenario.
- **`priority`**: Integer defining the override precedence.
    - **Lower number = Higher Priority**.
    - High priority scenarios are merged *last*, effectively overwriting values from lower priority scenarios.
- **`required_env_vars`**: List of environment variables specific to this scenario.
- **`trigger`**: An object defining when this scenario is active.

#### Trigger Logic
The `trigger` object determines activation rules:

1. **`source`**:
    - `"default"`: Always active. Checks for templates in the path but typically serves as the base.
    - `"user"`: Active if the `SCENARIO_TYPE` environment variable matches the scenario's `value`.
    - `"env"`: Active if specific environment variables match defined regex patterns.

2. **`logic`** (Optional, for `source: env`):
    - `"and"` (default): All conditions must match.
    - `"or"`: At least one condition must match.

3. **`conditions`** (Required for `source: env`):
    - List of objects with:
        - `key`: Environment variable name.
        - `regex`: Regex pattern to match against the variable's value.

#### Example Config
```json
{
    "value": "fab200mm",
    "path": "templates/scenario/fab200mm",
    "priority": 1,
    "trigger": {
        "source": "env",
        "conditions": [
            { "key": "FAB", "regex": "200mm" }
        ]
    }
}
```



## Features

### 1. Strict Validation
The tool strictly validates that all required environment variables are present. If any are missing, it exits with a red error message.

### 2. Safe Generation
The tool checks if an output file already exists. If it does, it prints a yellow warning (`[WARNING] File ... already exists. Skipping.`) and skips generation to prevent accidental overwrites.

### 3. Formatting Rules
- **Banner Comments**: Top-level keys are preceded by a banner-style comment.
- **Spacing**: Top-level blocks are separated by `top_level_spacing` blank lines (default 2) for readability.
- **Strict Quoting**: The generator enforces strict quoting rules:
    - **Booleans/Numbers**: Always unquoted (e.g., `enabled: true`, `uid: 0`).
    - **Strings**:
        - **Simple**: Unquoted if alphanumeric (e.g., `region: tw`).
        - **Complex**: Forced double quotes if they look like booleans/numbers or contain special characters (e.g., `vip: "172.16.0.0/16"`, `version: "1.0"`).

### 4. Template Logic
- **`default_value`**: The primary value used for generation. Can be complex objects or lists.
- **`regex`**: Used as a fallback if `default_value` is missing or empty.
- **Context Injection**: Supports `{VAR}` substitution in paths, keys, and string values.

## Template Structure

Templates are located in `templates/scenario/default` (base) and `templates/scenario/<scenario_name>` (overrides).

- **`.json` files**: Define a schema for generating YAML.
- **Raw files**: Copied directly (with variable substitution).
