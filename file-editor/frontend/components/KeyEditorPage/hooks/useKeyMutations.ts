import { api } from '@/lib/api';
import { splitPath } from '@/lib/pathUtils';

export function useKeyMutations(
    filePath: string,
    targetKey: string,
    fullContent: any,
    onSaveSuccess: () => void
) {

    const handleSave = async (formData: any) => {
        const {
            keyName, description, required, overrideHint, overrideStrategy, types, itemTypes,
            regexEnable, regexPattern, enumValues, defaultValue, condition, plugins
        } = formData;

        // 1. Process Default Value
        let finalDefaultValue: any = defaultValue;
        if (defaultValue) {
            const trimmed = String(defaultValue).trim();
            let parsed = false;

            // 1. Try JSON parsing if it looks like an object or array
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    finalDefaultValue = JSON.parse(trimmed);
                    parsed = true;
                } catch (e) {
                    // Let it fall through to string
                }
            }

            // 2. Try primitive casting if not parsed as JSON
            if (!parsed) {
                if (trimmed === 'true' || trimmed === 'false') {
                    finalDefaultValue = trimmed === 'true';
                } else if (!isNaN(Number(trimmed)) && trimmed !== '') {
                    finalDefaultValue = Number(trimmed);
                } else {
                    finalDefaultValue = defaultValue; // Store raw string
                }
            }
        }

        try {
            const newContent = JSON.parse(JSON.stringify(fullContent));
            const pathParts = splitPath(targetKey).filter((p: string) => p !== 'root');

            const updateNodeRecursive = (list: any[], path: string[]) => {
                const [head, ...tail] = path;
                for (const item of list) {
                    if (item.key === head) {
                        if (tail.length === 0) {
                            // Update attributes
                            item.key = keyName;
                            item.description = description;
                            item.required = required;
                            item.either_required = formData.eitherRequired;
                            item.uniqueness = formData.uniqueness;
                            item.override_hint = overrideHint;

                            if (overrideStrategy && overrideStrategy !== 'merge') {
                                item.override_strategy = overrideStrategy;
                            } else {
                                item.override_strategy = 'merge'; // Default behavior instead of deleting
                            }

                            if (plugins && plugins.length > 0) {
                                item.plugins = plugins;
                            } else {
                                delete item.plugins;
                            }

                            item.multi_type = types;

                            if (types.includes('list')) {
                                item.item_multi_type = itemTypes;
                            } else {
                                delete item.item_multi_type;
                            }

                            // Regex / Enum
                            if (types.includes('enum')) {
                                item.regex_enable = regexEnable;
                                item.regex = `[${enumValues.join(',')}]`;
                            } else {
                                item.regex_enable = regexEnable;
                                if (regexPattern) {
                                    item.regex = regexPattern;
                                } else {
                                    item.regex = ""; // Persist as empty string instead of deleting
                                }
                            }

                            // Default Value
                            if (defaultValue !== '') {
                                item.default_value = finalDefaultValue;
                            } else {
                                item.default_value = null; // Persist as null instead of deleting
                            }

                            // Condition
                            if (!required && condition && condition.conditions.length > 0) {
                                item.condition = condition;
                            } else {
                                delete item.condition;
                            }

                            return;
                        }
                        if (item.children) updateNodeRecursive(item.children, tail);
                    }
                }
            };

            updateNodeRecursive(Array.isArray(newContent) ? newContent : [newContent], pathParts);

            await api.createFile(filePath, JSON.stringify(newContent, null, 4));
            onSaveSuccess();
        } catch (e: any) {
            alert("Failed to save: " + e.message);
        }
    };

    return { handleSave };
}
