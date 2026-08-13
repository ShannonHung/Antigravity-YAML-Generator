# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Two coupled components that share one data model — the **template JSON schema**:

1. **YAML Generator** (`yaml_generator.py`, single file ~1600 lines) — a CLI that renders Ansible `.yml`/`.ini` files from JSON schema templates, applying environment-variable substitution, scenario-based overrides, and strict formatting/quoting rules.
2. **File Editor** (`file-editor/`) — a Next.js + FastAPI web app for visually editing those same `.yml.json` / `.ini.json` template files.

The generator is the source of truth for schema semantics; the editor is a GUI over the same files it consumes.

## Commands

Run generator/test commands from the repo root.

```bash
make gen            # Interactive generation: runs ./generate.sh, prompts for scenario + env vars
make test           # Run all tests: python -m unittest discover tests
make check          # Validate all templates across all scenarios without generating (yaml_generator.py --check)

# Run a single test module / case
python -m unittest tests.complex_defaults.test_complex_defaults
python -m unittest tests.complex_defaults.test_complex_defaults.TestComplexDefaults.test_dns_complex_default_generation

# Manual generation (bypass prompts) — export required env vars first
export SCENARIO_TYPE=default; export FAB=f1; export SERVICE=myservice; export CLUSTER_NAME=mycluster
python3 yaml_generator.py [path/to/config.json]   # defaults to template/scenario/config.json
```

### Web editor

```bash
make web            # Runs backend (uvicorn :8000) + frontend (next dev :3000) together
make web-down       # Kills processes on ports 3000 and 8000
make web-dev        # Docker compose (dev); backend published on host :5487
make web-prod       # Docker compose via docker-compose-prod.yml
```

Frontend lint: `cd file-editor/frontend && npm run lint`. The backend uses its own venv at `file-editor/backend/.venv` (the `make backend` target calls `.venv/bin/uvicorn`).

## Architecture

### The template JSON schema (`SchemaNode`)

Every template node is a `SchemaNode` (dataclass in `yaml_generator.py`). Key fields: `key`, `multi_type` (list, e.g. `["object"]`, `["list"]`, `["string"]`), `item_multi_type` (element types for lists), `default_value`, `required`, `condition`, `regex`/`regex_enable`, `override_strategy` (`merge`/`replace`), and `children`. `from_dict`/`to_dict` bridge JSON ↔ dataclass. This same structure is what the editor reads and writes.

### Generator pipeline (`process_scenarios`)

`config.json` → `parse_config` (into `AppConfig`/`ScenarioConfig`) → `determine_active_scenarios` (by trigger + env) → validation → `collect_scenario_files` → `generate_output_files`. Understanding the flow requires reading these functions together.

- **Scenarios & priority**: `template/scenario/config.json` defines scenarios, each with a `path`, `priority` (lower number = higher priority, applied last so it wins), and a `trigger`. `trigger.source` is `user` (activated by `SCENARIO_TYPE=<value>`), `env` (auto-activated when regex conditions on env vars match), or the legacy `default` (always-active baseline). Multiple active scenarios are merged in priority order via `merge_nodes` / `_merge_single_node`.
- **Base / overlay model** (`determine_active_scenarios`, `_is_base_scenario`, `_resolve_base_value`): scenarios are either *bases* (`is_base: true`, or legacy `source: default`) or *overlays*. Exactly one base is active per run — the selected `is_base` scenario, else the top-level `default_base`. Overlays declare `base: "<value>"` (omitted → inherits `default_base`) and join the merge only if their resolved base equals the active base; otherwise they are silently excluded. The active base is forced to `priority = 9999` (lowest layer). `validate_config_scenarios` enforces that `base`/`default_base` reference real `is_base` scenarios and that no scenario is both `is_base` and has `base`. This lets e.g. `tvm` fully replace `general_cluster` as the base rather than stacking on it.
- **File classification**: files ending in `.yml.json` or `.ini.json` are parsed as schemas and rendered; **all other files are copied verbatim** with env-var substitution applied to their contents.
- **Env substitution**: path templates use `{VAR}` placeholders (e.g. `{FAB}/{SERVICE}/{CLUSTER_NAME}` directory names — see `template/scenario/`); content/default values resolve env vars too. `default_env_vars` + per-scenario `required_env_vars` in config drive the interactive prompts in `generate.sh`.

### YAML vs INI generation are separate code paths

- YAML: `generate_yaml_from_schema` and its `_format_yaml_*` / `_process_yaml_node` helpers.
- INI: `generate_ini_from_schema` and `_generate_ini_global_vars` / `_generate_ini_groups` / `_generate_ini_aggregations` / `_generate_ini_group_vars`.

**INI has extra structural constraints** (enforced in `validate_node` with `is_ini=True`): the root key may only contain `group_vars`, `global_vars`, `groups`, `aggregations`; those must be `["object"]`; children of `groups`/`aggregations` must be `["list"]`+`item_multi_type:["object"]`; and any `groups` node with children must include a `hostname` child. See README "Strict INI Rules" for the full list.

### Formatting rules that tests pin exactly

Output formatting is intentionally hand-rolled (not raw PyYAML dumps) so comments and banners survive. Tests compare generated text byte-for-byte against `tests/*/data/*.yml` answer files, so formatting changes are load-bearing:

- **Quoting** (`format_smart_quoted_string`): booleans, numbers, and simple alphanumerics stay unquoted; IPs, CIDRs, version-like strings (`"1.0"`), and ambiguous strings get quoted.
- **Comments & banners** (`_generate_yaml_comments`, `generate_banner`): a `description` starting with `#` becomes a boxed banner; `\n` yields multi-line comments/banners.
- **Overrides**: overridden keys get an inline hint (default `# <=== [Override]`, configurable via `override_hint_style`).
- **Skipping**: a node is skipped when `required` is `""`/`null` or the key is absent; conditional nodes are governed by `is_node_enabled` / `condition`.

### File Editor

- **Backend** (`file-editor/backend/main.py`, FastAPI): a sandboxed file CRUD API under `/api/files*`, rooted at `ROOT_PATH` (env, default `./template`). `get_safe_path` enforces the path stays within root. On save of `.yml.json` it runs `validate_schema_node` (children require object / list-of-object types). Note: `create_file` is defined more than once in this file — the last definition (with schema validation) wins.
- **Frontend** (`file-editor/frontend/`, Next.js 16 + TypeScript + Tailwind + Bootstrap): page components grouped by feature under `components/` (`FileSystemPage`, `JsonTreeViewerPage`, `KeyEditorPage`, `CodeEditorPage`). `config/editorConfig.ts` defines the selectable `DATA_TYPES` / `ITEM_DATA_TYPES` / plugins — these are overridable at runtime via the `EDITOR_*` docker-compose env vars. Backend URL defaults to `http://localhost:8000` (compose maps `:5487`).

## Tests

Each subdirectory under `tests/` is a self-contained suite: a `test_*.py`, its own `config_*.json`, a `data/` folder with input `.yml.json`/`.ini.json` schemas, and expected `.yml`/`.ini` answer files. Tests import `yaml_generator` directly and assert generated text equals the answer file exactly. When changing generation logic, update the corresponding answer files.

## Notes

- README.md and much of the repo history/commit messages are in Traditional Chinese; comments and code are English.
- No CI config is present; validate locally with `make check` and `make test`.
