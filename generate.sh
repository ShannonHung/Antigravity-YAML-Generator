#!/bin/bash

# Configuration
CONFIG_FILE="templates/scenario/config.json"
GENERATOR_SCRIPT="yaml_generator.py"

# Function to get JSON value using python (avoiding jq dependency if possible, but python is guaranteed here)
get_config() {
    python3 -c "import sys, json; config=json.load(open('$CONFIG_FILE')); print(json.dumps(config))"
}

# 1. Parse Config
CONFIG_JSON=$(get_config)

# Get SCENARIO_ENV_KEY
SCENARIO_ENV_KEY=$(echo "$CONFIG_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('senario_env_key', 'SCENARIO_TYPE'))")

# Get Available Scenarios
SCENARIOS=$(echo "$CONFIG_JSON" | python3 -c "import sys, json; print(' '.join([s['value'] for s in json.load(sys.stdin).get('senarios', []) if s.get('trigger', {}).get('source') in ['user', 'default']]))")

echo "Select Scenario ($SCENARIO_ENV_KEY):"
select SCENARIO in $SCENARIOS; do
    if [ -n "$SCENARIO" ]; then
        break
    else
        echo "Invalid selection. Please try again."
    fi
done

export $SCENARIO_ENV_KEY=$SCENARIO

# 2. Identify Required Variables with Descriptions
TEMP_VARS=$(mktemp)

python3 -c "
import sys, json

config_path = '$CONFIG_FILE'
scenario = '$SCENARIO'

try:
    with open(config_path) as f:
        config = json.load(f)
except Exception as e:
    sys.exit(1)

vars_map = {} # Key -> Description

def add_vars(var_list):
    for v in var_list:
        if isinstance(v, dict):
            vars_map[v['key']] = v.get('description', '')
        else:
            vars_map[v] = ''

# 1. Default Vars
add_vars(config.get('default_env_vars', []))

# 2. Scenario Vars
for s in config.get('senarios', []):
    if s['value'] == scenario:
        add_vars(s.get('required_env_vars', []))
        break

for key, desc in vars_map.items():
    # Simple sanitization for pipe delimiter
    clean_desc = desc.replace('|', '-')
    print(f\"{key}|{clean_desc}\")
" > "$TEMP_VARS"

echo "--------------------------------------------------"
echo "Configure Environment Variables for $SCENARIO"
echo "--------------------------------------------------"

while IFS='|' read -r -u 3 VAR DESC; do
    # Clear existing variable to force re-entry
    unset $VAR

    if [ -n "$DESC" ]; then
        echo "Description: $DESC"
    fi
    
    read -p "$VAR: " USER_VAL
    
    if [ -n "$USER_VAL" ]; then
        export $VAR="$USER_VAL"
    else
        echo "Warning: $VAR not set."
    fi
    echo "" # Newline for readability
done 3< "$TEMP_VARS"

rm "$TEMP_VARS"

echo "--------------------------------------------------"
echo "Running Generator..."
echo "--------------------------------------------------"

python3 $GENERATOR_SCRIPT
