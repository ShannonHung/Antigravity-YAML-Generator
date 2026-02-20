export enum FieldType {
    BOOL = 'boolean',
    STR = 'string',
    NUM = 'number',
    EMAIL = 'email',
    IP = 'ip',
    OBJ = 'object',
    LIST = 'list',
    ENUM = 'enum'
}

export enum OperationTypes {
    EQ = 'eq',
    NE = 'neq',
    GT = 'gt',
    LT = 'lt',
    GE = 'ge',
    LE = 'le',
    NOT_EMPTY = 'not_empty',
    EMPTY = 'empty',
}

export const TYPE_OPERATORS: Record<string, string[]> = {
    [FieldType.BOOL]: [OperationTypes.EQ, OperationTypes.NE],
    [FieldType.STR]: [OperationTypes.EQ, OperationTypes.NE, OperationTypes.NOT_EMPTY, OperationTypes.EMPTY],
    [FieldType.NUM]: [OperationTypes.EQ, OperationTypes.NE, OperationTypes.GT, OperationTypes.LT, OperationTypes.GE, OperationTypes.LE],
    [FieldType.EMAIL]: [OperationTypes.EQ, OperationTypes.NE, OperationTypes.NOT_EMPTY, OperationTypes.EMPTY],
    [FieldType.IP]: [OperationTypes.EQ, OperationTypes.NE, OperationTypes.NOT_EMPTY, OperationTypes.EMPTY],
    [FieldType.OBJ]: [OperationTypes.NOT_EMPTY, OperationTypes.EMPTY],
    [FieldType.LIST]: [OperationTypes.NOT_EMPTY, OperationTypes.EMPTY],
    [FieldType.ENUM]: [OperationTypes.EQ, OperationTypes.NE, OperationTypes.NOT_EMPTY, OperationTypes.EMPTY],
};

export interface ConditionItem {
    key: string;
    operator: string;
    value: string;
}

export interface ConditionGroup {
    logical: 'and' | 'or';
    conditions: ConditionItem[];
}

export const OPERATOR_LABELS: Record<string, string> = {
    [OperationTypes.EQ]: '=',
    [OperationTypes.NE]: '!=',
    [OperationTypes.GT]: '>',
    [OperationTypes.LT]: '<',
    [OperationTypes.GE]: '>=',
    [OperationTypes.LE]: '<=',
    [OperationTypes.NOT_EMPTY]: 'not empty',
    [OperationTypes.EMPTY]: 'empty',
};
