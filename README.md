# YAML Generator Tool

This tool generates YAML files for Ansible from JSON templates and raw files, supporting environment variable substitution and complex schema definitions.

## Usage

### Interactive Mode (Recommended)

Use the provided Makefile target to run the interactive generator script. This will prompt you for the required environment variables based on the selected scenario.

```bash
make gen
```

Or run the script directly:

```bash
./generate.sh
```

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

## Configuration

The generator behavior is controlled by `templates/scenario/config.json`.

- **`senario_env_key`**: The environment variable used to select the scenario (default: `SCENARIO_TYPE`).
- **`default_env_vars`**: List of environment variables required for ALL scenarios.
- **`senarios`**: List of available scenarios.
    - **`value`**: The value to match against `SCENARIO_TYPE`.
    - **`path`**: The path to the scenario templates.
    - **`required_env_vars`**: List of environment variables specific to this scenario.

## Template Structure

Templates are located in `templates/scenario/default` (base) and `templates/scenario/<scenario_name>` (overrides).

- **`.json` files**: Define a schema for generating YAML, supporting comments and type hints.
- **Raw files**: Copied directly with environment variable substitution.
