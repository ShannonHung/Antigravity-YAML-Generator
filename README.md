# Antigravity Arsenal: YAML Generator & File Editor

This repository contains two main components:
1. **YAML Generator Tool**: Generates Ansible YAML files from structured JSON templates.
2. **File Editor**: A Web UI to visually edit and manage the JSON templates.

---

# 1. YAML Generator

This tool generates Ansible YAML (or INI) files from JSON templates and raw files. It supports environment variable substitution, complex schema definitions, conditional generation, and strict formatting.

## Getting Started

### Prerequisites
1. **Python 3**: Ensure Python 3.x is installed on your system.
2. **PyYAML**: The python script depends on the `pyyaml` package. Install it via pip:
   ```bash
   pip3 install pyyaml
   ```

### Usage (Make Commands)

The easiest way to generate files is using the interactive `make` command. It will prompt you for the required environment variables based on the selected scenario.

- **Interactive Generation**:
  ```bash
  make gen
  ```
  *This will execute `./generate.sh`, asking for required inputs dynamically.*

- **Manual Execution**:
  If you prefer to bypass the prompts, export the required environment variables and run it directly:
  ```bash
  export SCENARIO_TYPE=fab200mm
  export CLUSTER_NAME=my-cluster
  export SERVICE=my-service
  python3 yaml_generator.py
  ```

## Features

### 1. `config.json` Configuration
The generator behavior is controlled by `template/scenario/config.json`.
- **`senario_env_key`**: The environment variable used to determine the scenario (default: `SCENARIO_TYPE`).
- **`default_env_vars`**: List of system-wide required environment variables (e.g., `["CLUSTER_NAME", "SERVICE"]`).
- **`top_level_spacing`**: Number of blank lines inserting between root YAML blocks (default: `2`).
- **`override_hint_style`**: Style of override comments appended to overridden keys (default: `# <=== [Override]`).
- **`senarios`**: An array defining available scenarios:
  - `value`: Scenario identifier (e.g., `"fab200mm"`).
  - `path`: Directory containing templates for this scenario.
  - `priority`: Determines override order (lower number = higher priority; applied last to overwrite lower priorities).
  - `trigger`: Controls when the scenario is activated.

### 2. Output File Logic

- **Direct Copying**: If a file in the template directory does **not** end with `.yml.json` or `.ini.json`, it is treated as a raw file. The generator will copy it directly to the output path, applying environment variable substitution to the contents.
- **Template Processing**: Files ending with `.yml.json` or `.ini.json` are parsed against the internal schema rules and emitted as pristine `.yml` or `.ini` files.

### 3. Scenario Trigger Logic (`trigger.source`)
- **`user`**: Active when the user explicitly species it (e.g., `SCENARIO_TYPE=fab200mm`). The generation merges the `default` scenario base with the target `user` scenario.
- **`env`**: Active automatically if specific environment variables regex patterns match. Even if the user doesn't explicitly select this scenario, the generator will inherit these parameters. If parameters overlap with the base or other active scenarios, the one with the highest priority (lowest number) wins.

### 4. Generation & Skipping Rules
- **Skip if Deprecated/Missing**: If a key's `required` attribute is explicitly set to `null` (deprecated) or is an empty string `""` (or missing completely), the generator will skip outputting this field entirely.
- **`override_strategy` Mechanism**: When merging a scenario over a base (e.g., `default` + `fab200mm`):
  - **`"merge"` (Default)**: Deeply merges objects and lists. Child keys from the override scenario are appended or update matching keys in the parent.
  - **`"replace"`**: Completely overwrites the parent's data structure at that node. The inherited default data is discarded in favor of the override.

### 5. Value Resolution Strategy
When the generator determines the final value of a key, it prioritizes the `default_value`. However, if the `default_value` is missing, empty (`{}` / `[]`), or an empty string (`""`), it will fall back to using the `regex` attribute as the value.

### 6. Value Quoting Formatting
The generator enforces strict quoting rules when emitting YAML:
- **Unquoted**: Booleans (`true`/`false`), bare numbers, and simple alphanumeric strings without special characters (e.g., `region: tw`).
- **Quoted (`"..."`)**: Strings containing special characters (like IP addresses `192.168.1.1` or CIDR `10.0.0.0/8`), or strings that could be misinterpreted by a YAML parser as numbers/booleans (e.g., `"1.0"`, `"true"`).

## Validation Logic
The JSON templates are strictly validated before generation starts:
1. Cannot mix legacy `type` with new `multi_type`.
2. Must use `multi_type` array for types.
3. If `multi_type` contains `"list"`, then `item_multi_type` **must not be empty**.
4. **List Object Constraint**: If `multi_type` contains `"list"` AND the node has `children` (is not empty array `[]`), `item_multi_type` **must contain `"object"`**.

---

# 2. File Editor (Web UI)

A customized, schema-aware Next.js frontend and FastAPI backend used to maintain the `.yml.json` schema templates comfortably without manual JSON editing.

## Launching the Editor (Make Commands)

You can launch the editor in three different modes depending on your needs:

### 1. Direct Code Execution
Starts the backend via `uvicorn` and frontend via `npm run dev` directly on your host machine.
```bash
make web         # Start both frontend and backend
make web-down    # Kill processes on ports 3000 and 8000
```

### 2. Development Docker Mode
Builds local Docker images and runs them using `docker-compose.yml`. Ideal for testing the containerized environment.
```bash
make web-dev     # Build and start via docker-compose up -d
make web-dev-down# Stop via docker-compose down
```

### 3. Production Docker Mode
Starts the application using `docker-compose-prod.yml`, which pulls pre-built images from Docker Hub instead of building locally.
```bash
make web-prod     # Start production stack
make web-prod-down# Stop production stack
```

## Docker Compose Configurations

### Modifying the Backend Mount Path
The File Editor works by mounting your local template directory into the backend container so the API can read and write the JSON files.

If you inspect `docker-compose.yml` (or `docker-compose-prod.yml`), you will find the volume mount for the backend:
```yaml
services:
  backend:
    volumes:
      - ./template:/app/template
```

**What happens if you change this?**
- **Symptom**: If you change the host path (e.g., `- /my/custom/path:/app/template`), the web UI will display and edit files from `/my/custom/path` instead of the local `./template` folder.
- **Usage**: This is useful if you want to deploy the editor centrally and point it to a completely different ansible inventory directory on your server. Ensure the target directory maintains the expected `scenario/` structure.
