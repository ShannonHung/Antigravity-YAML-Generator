下面是 **已整合 Environment 設定說明** 的完整 README。
你可以直接整段複製覆蓋原本檔案使用。

---

# Antigravity Arsenal: YAML Generator & File Editor

This repository contains two main components:

1. **YAML Generator Tool**: Generates Ansible YAML files from structured JSON templates.
2. **File Editor**: A Web UI to visually edit and manage the JSON templates.

---

# 1. YAML Generator

This tool generates Ansible YAML (or INI) files from JSON templates and raw files. It supports environment variable substitution, complex schema definitions, conditional generation, and strict formatting.

---

## Getting Started

### Prerequisites

1. **Python 3**: Ensure Python 3.x is installed on your system.
2. **PyYAML**: The python script depends on the `pyyaml` package. Install it via pip:

```bash
pip3 install pyyaml
```

---

## Usage (Make Commands)

The easiest way to generate files is using the interactive `make` command. It will prompt you for the required environment variables based on the selected scenario.

### Interactive Generation

```bash
make gen
```

This will execute `./generate.sh`, asking for required inputs dynamically.

---

### Manual Execution

If you prefer to bypass the prompts, export the required environment variables and run it directly:

```bash
export SCENARIO_TYPE=fab200mm
export CLUSTER_NAME=my-cluster
export SERVICE=my-service

# or using one line
export SCENARIO_TYPE=default; export SERVICE=myservice; export CLUSTER_NAME=mycluster; export FAB=f1;

python3 yaml_generator.py
```

---

## Features

### 1. `config.json` Configuration

The generator behavior is controlled by:

```
template/scenario/config.json
```

* **`senario_env_key`**: The environment variable used to determine the scenario (default: `SCENARIO_TYPE`).
* **`default_env_vars`**: List of system-wide required environment variables (e.g., `["CLUSTER_NAME", "SERVICE"]`).
* **`top_level_spacing`**: Number of blank lines inserted between root YAML blocks (default: `2`).
* **`override_hint_style`**: Style of override comments appended to overridden keys (default: `# <=== [Override]`).
* **`senarios`**:

  * `value`: Scenario identifier (e.g., `"fab200mm"`).
  * `path`: Directory containing templates for this scenario.
  * `priority`: Determines override order (lower number = higher priority; applied last to overwrite lower priorities).
  * `trigger`: Controls when the scenario is activated.

---

### 2. Output File Logic

* **Direct Copying**: Files that do NOT end with `.yml.json` or `.ini.json` are treated as raw files and copied directly with environment variable substitution applied.
* **Template Processing**: Files ending with `.yml.json` or `.ini.json` are parsed against schema rules and emitted as pristine `.yml` or `.ini` files.

---

### 3. Scenario Trigger Logic (`trigger.source`)

* **`user`**: Activated when explicitly specified (e.g., `SCENARIO_TYPE=fab200mm`).
* **`env`**: Activated automatically if environment variable regex conditions match.

Priority rules apply if multiple scenarios overlap.

---

### 4. Generation & Skipping Rules

* Skip output if:

  * `required` is `null` (deprecated)
  * `required` is `""`
  * key missing entirely

* **override_strategy**

  * `"merge"` (default)
  * `"replace"`

---

### 5. Value Resolution Strategy

Priority order:

1. `default_value`
2. fallback to `regex` if default is empty

---

### 6. YAML Quoting Rules

* **Unquoted**:

  * `true`, `false`
  * numbers
  * simple alphanumeric strings

* **Quoted**:

  * IP addresses
  * CIDR
  * version numbers like `"1.0"`
  * strings that may be misinterpreted

---

## Validation Logic

Strict validation rules are enforced across all templates to ensure data integrity:

### 1. General Structural Rules

*   **Missing Attributes**: Every node MUST have a `key` and a `multi_type` array.
*   **Legacy Fields**: Mixing legacy `type` or `item_type` with `multi_type` is forbidden.
*   **List Consistency**:
    *   If `multi_type` contains `"list"`, `item_multi_type` is mandatory.
    *   If a list-type node has `children`, `item_multi_type` must contain `"object"`.
*   **Object Consistency**: If `multi_type` is `"object"`, `item_multi_type` must be empty.
*   **Type Conflicts**: `multi_type` cannot contain both `"object"` and `"list"`.

### 2. Strict INI Rules (`.ini.json`)

To ensure compatibility with the INI generator, `.ini.json` files follow additional constraints:

*   **Root Key Restriction**: The root `key` must be one of: `aggregations`, `global_vars`, or `groups`. Any other key will be rejected.
*   **Type Constraints**:
    *   All direct children of `aggregations` and `groups` must be declared as `multi_type: ["list"]`.
    *   All direct children of `groups` must additionally have `item_multi_type: ["object"]`.
*   **Mandatory hostname**: Any node under `groups` that contains `children` MUST include a child with `key: "hostname"`. This ensures each host in the INI has a primary identifier.

---

# 2. File Editor (Web UI)

Schema-aware Next.js frontend and FastAPI backend for maintaining `.yml.json` templates visually.

---

## Launching the Editor (Make Commands)

### 1. Direct Code Execution

```bash
make web
make web-down
```

---

### 2. Development Docker Mode

```bash
make web-dev
make web-dev-down
```

---

### 3. Production Docker Mode

```bash
make web-prod
make web-prod-down
```

---

# Docker Compose Configuration

Example:

```yaml
version: '3.8'

services:
  backend:
    image: my-backend
    build:
      context: ./file-editor/backend
    ports:
      - "8000:8000"
    volumes:
      - ${TEMPLATE_DIR:-./template}:/app/template
    environment:
      - ROOT_PATH=/app/template

  frontend:
    image: my-frontend
    build:
      context: ./file-editor/frontend
    ports:
      - "3000:3000"
    environment:
      - DATA_TYPES=${EDITOR_DATA_TYPES:-}
      - ITEM_DATA_TYPES=${EDITOR_ITEM_DATA_TYPES:-}
      - DEFAULT_PLUGINS=${EDITOR_DEFAULT_PLUGINS:-}
    depends_on:
      - backend
```

---

# 🔧 Environment Variables Configuration Guide

This section explains how to properly configure environment variables for Docker Compose.

---

## How Variable Substitution Works

Docker Compose supports:

```
${VARIABLE_NAME:-default_value}
```

Meaning:

* If variable exists → use it
* If not → fallback to default

Example:

```
${TEMPLATE_DIR:-./template}
```

---

# ✅ Recommended: Use a `.env` File

Create a `.env` file in the same directory as `docker-compose.yml`.

---

## Example `.env`

```env
# Backend
TEMPLATE_DIR=./template

# Frontend
EDITOR_DATA_TYPES=text,image,json
EDITOR_ITEM_DATA_TYPES=text,image
EDITOR_DEFAULT_PLUGINS=spellcheck,autosave
```

Then run:

```bash
docker compose up --build
```

Docker automatically loads `.env`.

---

# 🔎 Variable Explanation

## Backend

### TEMPLATE_DIR

Controls which local directory is mounted into:

```
/app/template
```

Default:

```
./template
```

---

## Frontend

### EDITOR_DATA_TYPES

Comma-separated list:

```
text,image,json
```

Mapped to:

```
DATA_TYPES
```

---

### EDITOR_ITEM_DATA_TYPES

Subset of supported types.

---

### EDITOR_DEFAULT_PLUGINS

Comma-separated plugin list.

---

# 📌 Recommended Format

Use comma-separated values:

Good:

```
text,image,json
```

Avoid:

```
["text","image"]
```

Reason:

* Simpler shell handling
* Cleaner parsing
* Less error-prone

---

# 🧪 Debugging

To inspect resolved config:

```bash
docker compose config
```

---

# 🚀 Production Recommendation

* Do NOT commit `.env`
* Use CI/CD environment variables
* Use `.env.production`
* Consider Docker secrets for sensitive data
