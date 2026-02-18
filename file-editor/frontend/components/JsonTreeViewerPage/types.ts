export interface JsonNode {
    key: string;
    description?: string;
    default_value?: any;
    value?: any;
    override_hint?: boolean;
    type?: string;
    multi_type?: string[];
    item_multi_type?: string[];
    regex_enable?: boolean;
    regex?: string;
    required?: boolean | null;
    condition?: any;
    children?: JsonNode[];
    [key: string]: any;
}
