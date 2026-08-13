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

# Validation Only Mode (Check mode)
# Validates all templates defined in config.json across all scenarios
python3 yaml_generator.py --check
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

### 3.1 Base / Overlay Model

Scenarios are split into **bases** and **overlays**. Exactly one base is active per run; overlays stack on top of it.

* **`is_base: true`** marks a scenario as a *base* (a standalone root template — e.g. `general_cluster` or `tvm`). A base never stacks onto another scenario.
* **`base: "<value>"`** on an overlay declares which base chain it stacks onto. The referenced value must be a scenario with `is_base: true`.
* Omitting `base` on an overlay means it inherits **`default_base`** (a top-level config field naming the base used when the user selects none).

**Selection rules:**

1. If the user selects an `is_base` scenario (e.g. `SCENARIO_TYPE=tvm`), that scenario becomes the base and any other base (including `default_base`) is **not** activated.
2. If no base is selected, `default_base` is activated as the base.
3. An overlay joins the merge **only if** its resolved base equals the active base. A triggered overlay whose base differs (e.g. an `env`-triggered overlay bound to `general_cluster` while `tvm` is the active base) is **silently excluded**.
4. The active base is applied first (lowest layer); overlays merge on top in priority order.

This lets a scenario like `tvm` act as an alternative default template that fully replaces `general_cluster`, while other scenarios opt in to a specific base via `base`.

> **Backward compatibility**: a legacy `trigger.source: "default"` scenario is still treated as a base, and overlays without a `base` field still stack onto the active base as before.

**Validation**: `base` must reference an existing `is_base` scenario; a scenario cannot be both `is_base` and declare `base`; and `default_base` must reference an `is_base` scenario.

---

### 4. Generation & Skipping Rules

* **Deprecated (`required: null`)**: A node whose `required` is exactly `null` is treated as *deprecated* and produces **no output whatsoever** — not its value, not its description/comment, not a commented-out placeholder — and any `children` are dropped with it. This applies to both `.yml` and `.ini` output.

* Skip output if:

  * `required` is `null` (deprecated — see above)
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

### 7. Description & Banner Comments

The generator supports both concise comments and decorative banners for documentation.

*   **Standard Comments**: Descriptions without a prefix are rendered as simple single-line comments.
    *   **YAML**: `# comment`
    *   **INI**: `# comment`
*   **Optional Banners**: Triggered by starting the `description` with a `#` (e.g., `"description": "# My Section"`).
    *   Creates a boxed banner:
        ```yaml
        # ==========================================
        # My Section
        # ==========================================
        ```
*   **Multi-line Support**: Use `\n` in the description field to create multi-line comments or multi-line banners.

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

To ensure compatibility with the INI generator, `.ini.json` files follow additional constraints before generating the file:

1.  **Root Key Restriction**: The first layer (root `key`) cannot have any parameters other than `group_vars`, `global_vars`, `groups`, and `aggregations`.
2.  **Type Constraints**:
    *   `group_vars`, `groups`, and `aggregations` must all have `multi_type: ["object"]`.
    *   The `children` under `group_vars` must have `multi_type: ["object"]`.
    *   The `children` under `groups` must have `multi_type: ["list"]` and `item_multi_type: ["object"]`.
    *   The `children` under `aggregations` must have `multi_type: ["list"]` and `item_multi_type: ["object"]`.
    *   Additionally, the `children` of `children` under `aggregations` must also have `multi_type: ["object"]`.
3.  **Mandatory hostname**: Any node under `groups` that contains `children` MUST include a child with `key: "hostname"`. This ensures each host in the INI has a primary identifier.

### 3. Config Validation (`config.json`)

Before any files are generated, `config.json` itself is validated. This runs on **both** `make gen` (generation) and `make check` (validation only), *before* any output is produced. It is **fail-fast**: the first error found prints a red `[ERROR]` message and aborts the run with exit code `1` — no files are written. Fix one error and re-run to surface the next.

**Trigger rules:**

| Condition | Error message |
| --- | --- |
| A `user` or `default` scenario declares `conditions` | `Config Error in scenario '<value>': source '<source>' must not have 'conditions'.` |
| An `env` scenario has no `conditions` | `Config Error in scenario '<value>': source 'env' must have 'conditions'.` |

**Base / overlay rules:**

| Condition | Error message |
| --- | --- |
| A scenario sets `is_base: true` **and** declares `base` | `Config Error in scenario '<value>': a scenario with 'is_base: true' must not also declare 'base'.` |
| An overlay's `base` points to a value that is not an `is_base` scenario (missing or not a base) | `Config Error in scenario '<value>': 'base' points to '<base>', which is not a scenario with 'is_base: true'.` |
| `default_base` points to a value that is not an `is_base` scenario | `Config Error: 'default_base' points to '<value>', which is not a scenario with 'is_base: true'.` |

> **Note**: validation catches *structural / reference* errors, not *semantic* ones. A `base` that references the **wrong but valid** base passes validation — it simply merges onto a different chain than intended. Inspect the `Active Scenarios (in order of application)` output that `make` prints to confirm the resolved layering. Because an overlay's `base` may only point to an `is_base` scenario (and a base can never itself declare `base`), base chains are only one level deep, so circular references are structurally impossible.

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
