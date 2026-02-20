import { api } from '@/lib/api';

export function useKeyMutations(
    filePath: string,
    targetKey: string,
    fullContent: any,
    onSaveSuccess: () => void
) {

    const handleSave = async (formData: any) => {
        const {
            keyName, description, required, overrideHint, overrideStrategy, types, itemTypes,
            regexEnable, regexPattern, enumValues, defaultValue, condition
        } = formData;

        // 1. Process Default Value
        let finalDefaultValue: any = defaultValue;
        if (defaultValue) {
            try {
                if (types.includes('object') || types.includes('list')) {
                    finalDefaultValue = JSON.parse(defaultValue);
                } else if (types.includes('boolean')) {
                    finalDefaultValue = defaultValue === 'true';
                } else if (types.includes('number')) {
                    finalDefaultValue = parseFloat(defaultValue);
                    if (isNaN(finalDefaultValue)) throw new Error("Invalid number");
                }
            } catch (e) {
                alert("Invalid Default Value format for selected type.");
                return;
            }
        }

        try {
            const newContent = JSON.parse(JSON.stringify(fullContent));
            const pathParts = targetKey.split('.').filter((p: string) => p !== 'root');

            const updateNodeRecursive = (list: any[], path: string[]) => {
                const [head, ...tail] = path;
                for (const item of list) {
                    if (item.key === head) {
                        if (tail.length === 0) {
                            // Update attributes
                            item.key = keyName;
                            item.description = description;
                            item.required = required;
                            item.override_hint = overrideHint;

                            if (overrideStrategy && overrideStrategy !== 'merge') {
                                item.override_strategy = overrideStrategy;
                            } else {
                                delete item.override_strategy; // default is merge, so we can omit it if it's merge
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
                                    delete item.regex;
                                }
                            }

                            // Default Value
                            if (defaultValue !== '') {
                                item.default_value = finalDefaultValue;
                            } else {
                                delete item.default_value;
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
