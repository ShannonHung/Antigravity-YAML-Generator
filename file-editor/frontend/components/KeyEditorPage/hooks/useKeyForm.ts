import { useState, useEffect } from 'react';
import { ConditionGroup } from '@/lib/conditions';

export function useKeyForm(initialData: any) {
    // Identity
    const [keyName, setKeyName] = useState('');
    const [description, setDescription] = useState('');
    const [required, setRequired] = useState<boolean | null>(false);
    const [overrideHint, setOverrideHint] = useState(false);
    const [overrideStrategy, setOverrideStrategy] = useState<'merge' | 'replace'>('merge');
    const [plugins, setPlugins] = useState<string[]>([]);
    const [types, setTypes] = useState<string[]>([]);
    const [itemTypes, setItemTypes] = useState<string[]>([]);

    // Constraints / Validation
    const [regexEnable, setRegexEnable] = useState(false);
    const [regexPattern, setRegexPattern] = useState('');
    const [enumValues, setEnumValues] = useState<string[]>([]);
    const [defaultValue, setDefaultValue] = useState('');

    // Condition
    const [condition, setCondition] = useState<ConditionGroup | null>(null);

    useEffect(() => {
        if (!initialData) return;

        setKeyName(initialData.key);
        setDescription(initialData.description || '');
        if (initialData.required === null) {
            setRequired(null);
        } else {
            setRequired(!!initialData.required);
        }
        setOverrideHint(!!initialData.override_hint);
        setOverrideStrategy(initialData.override_strategy || 'merge');
        setPlugins(initialData.plugins || []);
        setTypes(initialData.multi_type || (initialData.type ? [initialData.type] : []));
        setItemTypes(initialData.item_multi_type || []);

        setRegexEnable(!!initialData.regex_enable);
        setRegexPattern(initialData.regex || '');

        // Enum logic
        if ((initialData.multi_type || []).includes('enum') && initialData.regex) {
            try {
                const cleaned = initialData.regex.replace(/^\[|\]$/g, '');
                if (cleaned) {
                    setEnumValues(cleaned.split(',').map((s: string) => s.trim()));
                } else {
                    setEnumValues([]);
                }
            } catch (e) {
                setEnumValues([]);
            }
        } else {
            setEnumValues([]);
        }

        // Default Value
        if (initialData.default_value !== undefined) {
            if (typeof initialData.default_value === 'object') {
                setDefaultValue(JSON.stringify(initialData.default_value, null, 4));
            } else {
                setDefaultValue(String(initialData.default_value));
            }
        } else {
            setDefaultValue('');
        }

        if (initialData.condition) {
            setCondition(initialData.condition);
        } else {
            setCondition(null);
        }

    }, [initialData]);

    return {
        keyName, setKeyName,
        description, setDescription,
        required, setRequired,
        overrideHint, setOverrideHint,
        overrideStrategy, setOverrideStrategy,
        types, setTypes,
        itemTypes, setItemTypes,
        regexEnable, setRegexEnable,
        regexPattern, setRegexPattern,
        enumValues, setEnumValues,
        defaultValue, setDefaultValue,
        condition, setCondition,
        plugins, setPlugins
    };
}
