import json
from yaml_generator import generate_ini_from_schema

node = {
    "key": "aggregations",
    "multi_type": ["object"],
    "default_value": {
        "k8s-nodes": ["master", "worker", "l4lb", "hi"],
        "worker-nodes": ["worker", "l4lb"]
    },
    "children": [
        {
            "key": "k8s-nodes",
            "description": "k8s nodes",
            "required": True,
        },
        {
            "key": "worker-nodes",
            "description": "worker nodes",
            "required": True,
        }
    ],
    "required": True
}

lines = generate_ini_from_schema([node])
print("\n".join(lines))
