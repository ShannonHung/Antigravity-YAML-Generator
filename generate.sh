#!/bin/bash

# Configuration
CONFIG_FILE="template/scenario/config.json"
GENERATOR_SCRIPT="yaml_generator.py"

# Function to get JSON value using python (avoiding jq dependency if possible, but python is guaranteed here)
get_config() {
    python3 -c "import sys, json; config=json.load(open('$CONFIG_FILE')); print(json.dumps(config))"
}

check_dependencies() {
    # Colors
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    NC='\033[0m' # No Color

    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}[ERROR]: python3 is not installed. Please install Python 3 to continue.${NC}"
        exit 1
    fi

    # Check for PyYAML
    if ! python3 -c "import yaml" &> /dev/null; then
        echo -e "${YELLOW}[WARNING]: PyYAML module not found. It is required to run the generator.${NC}"
        read -p "Do you want to install it now? (y/n) " choice
        case "$choice" in 
          y|Y ) 
            echo "Installing PyYAML..."
            if ! python3 -m pip install pyyaml; then
                 echo -e "${RED}[ERROR]: Failed to install PyYAML. Please install it manually: pip3 install pyyaml${NC}"
                 exit 1
            fi
            echo "PyYAML installed successfully."
            ;;
          * ) 
            echo -e "${RED}[ERROR]: PyYAML is required. Exiting.${NC}"
            exit 1
            ;;
        esac
    fi
}

check_dependencies


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
        echo -e "${YELLOW}[WARNING] Invalid selection. Please try again.${NC}"
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
    clean_desc = desc.replace('|', '-').replace('\n', '\\\\n')
    print(f\"{key}|{clean_desc}\")
" > "$TEMP_VARS"

echo "--------------------------------------------------"
echo "Configure Environment Variables for $SCENARIO"
echo "--------------------------------------------------"

while IFS='|' read -r -u 3 VAR DESC; do
    # Clear existing variable to force re-entry
    unset $VAR

    if [ -n "$DESC" ]; then
        echo -e "Description: $DESC"
    fi
    
    while true; do
        read -p "$VAR: " USER_VAL
        
        if [ -n "$USER_VAL" ]; then
            export $VAR="$USER_VAL"
            break
        else
            echo -e "${YELLOW}[WARNING] $VAR cannot be empty. Please enter a value.${NC}"
        fi
    done
    echo "" # Newline for readability
done 3< "$TEMP_VARS"

rm "$TEMP_VARS"

echo "--------------------------------------------------"
echo "Running Generator..."
echo "--------------------------------------------------"

python3 $GENERATOR_SCRIPT "$CONFIG_FILE"
