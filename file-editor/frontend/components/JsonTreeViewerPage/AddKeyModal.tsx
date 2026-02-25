import { useState, useMemo } from 'react';
import { Info, X, Save, Edit3 } from 'lucide-react';
import clsx from 'clsx';
import { Typeahead, Menu, MenuItem } from 'react-bootstrap-typeahead';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import { useEditorConfig } from '../FileSystemPage/hooks/EditorConfigContext';
import { JsonNode } from './types';
import { joinPaths, escapeKey, unescapePath, splitPath } from '@/lib/pathUtils';

// Helper to flatten valid parents
const getValidParents = (nodes: JsonNode[], parentPath: string = ''): string[] => {
    let parents: string[] = [];

    // If at top level (parentPath is empty), 'root' is a valid parent
    if (parentPath === '') {
        parents.push('root');
    }

    for (const node of nodes) {
        const currentPath = joinPaths(parentPath, escapeKey(node.key));

        // Check if this node can be a parent (Object or List of Objects)
        const isObject = node.multi_type?.includes('object');
        const isListOfObjects = node.multi_type?.includes('list') && node.item_multi_type?.includes('object');

        if (isObject || isListOfObjects) {
            parents.push(currentPath); // Push relative path e.g "ntp" or "ntp.servers"
            if (node.children) {
                parents = parents.concat(getValidParents(node.children, currentPath));
            }
        }
    }
    return parents;
};

// Info Label Component
const InfoLabel = ({ label, tooltip, placement = 'right' }: { label: string, tooltip: string, placement?: 'top' | 'bottom' | 'right' }) => (
    <div className="flex items-center mb-1">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mr-1.5">{label}</span>
        <div className="relative group cursor-help z-50"> {/* Ensure tooltip icon isn't hidden */}
            <Info className="w-3 h-3 text-zinc-400 hover:text-blue-500" />
            <div className={clsx(
                "absolute hidden group-hover:block z-[100] w-max max-w-xs pointer-events-none",
                placement === 'top' && "left-1/2 -translate-x-1/2 bottom-full mb-2",
                placement === 'bottom' && "left-1/2 -translate-x-1/2 top-full mt-2",
                placement === 'right' && "left-full top-1/2 -translate-y-1/2 ml-2"
            )}>
                <div className="bg-zinc-800 text-white text-[10px] rounded px-2 py-1 shadow-lg border border-zinc-700 relative">
                    {tooltip}
                    {placement === 'top' && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                    )}
                    {placement === 'bottom' && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-4 border-transparent border-b-zinc-800"></div>
                    )}
                    {placement === 'right' && (
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-4 border-transparent border-r-zinc-800"></div>
                    )}
                </div>
            </div>
        </div>
    </div>
);

export default function AddKeyModal({ nodes, onClose, onSave, initialParentPath, initialTypes }: any) {
    const { DATA_TYPES, ITEM_DATA_TYPES } = useEditorConfig();
    const [parentPath, setParentPath] = useState<string[]>(initialParentPath ? [initialParentPath] : []);
    const [keyName, setKeyName] = useState('');
    const [types, setTypes] = useState<string[]>(initialTypes && initialTypes.length > 0 ? initialTypes : []);
    const [itemTypes, setItemTypes] = useState<string[]>([]);
    const [desc, setDesc] = useState('');
    const [req, setReq] = useState<boolean | null>(true);
    const [defaultValue, setDefaultValue] = useState('');
    const [uniqueness, setUniqueness] = useState('cluster');
    const [overrideHint, setOverrideHint] = useState(true);

    const [isDefaultValueModalOpen, setIsDefaultValueModalOpen] = useState(false);
    const [tempDefaultValue, setTempDefaultValue] = useState('');

    // Validation States
    const [parentError, setParentError] = useState<string | null>(null);
    const [keyError, setKeyError] = useState<string | null>(null);
    const [typeError, setTypeError] = useState<string | null>(null);

    // Flatten valid parents
    const validParents = useMemo(() => getValidParents(nodes), [nodes]);

    const handleSave = () => {
        // Reset errors
        setParentError(null);
        setKeyError(null);
        setTypeError(null);

        let isValid = true;

        // validate Parent
        const parentPathString = parentPath.length > 0 ? parentPath[0] : '';
        if (parentPathString && !validParents.includes(parentPathString)) {
            setParentError("Selected parent does not exist");
            isValid = false;
        }

        // validate Key Name
        if (!keyName.trim()) {
            setKeyError("Key name is required");
            isValid = false;
        } else {
            // Duplicate Key Check
            let siblingNodes = nodes;
            if (parentPathString && parentPathString !== 'root') {
                const pathParts = splitPath(parentPathString).filter((p: string) => p !== 'root');

                // Traverse exactly to the parent
                let currentNodes = nodes;
                let foundParent = true;
                for (const part of pathParts) {
                    const found = currentNodes.find((n: JsonNode) => n.key === part);
                    if (found) {
                        currentNodes = found.children || [];
                    } else {
                        foundParent = false;
                        break;
                    }
                }
                if (foundParent) {
                    siblingNodes = currentNodes;
                }
            }

            if (siblingNodes.some((n: JsonNode) => n.key === keyName.trim())) {
                setKeyError(`A key named "${keyName.trim()}" already exists at this level`);
                isValid = false;
            }
        }

        // validate Type
        if (types.length === 0) {
            setTypeError("At least one type is required");
            isValid = false;
        } else {
            // Ensure all selected types are in the allowed list
            const invalidTypes = types.filter(t => !DATA_TYPES.includes(t));
            if (invalidTypes.length > 0) {
                setTypeError(`Invalid type(s): ${invalidTypes.join(', ')}`);
                isValid = false;
            }
        }

        // validate Item Types (if list)
        if (types.includes('list')) {
            const invalidItemTypes = itemTypes.filter(t => !ITEM_DATA_TYPES.includes(t));
            if (invalidItemTypes.length > 0) {
                // We'll show this as a type error for simplicity or alert
                alert(`Invalid item type(s): ${invalidItemTypes.join(', ')}`);
                isValid = false;
            }
        }

        if (isValid) {
            onSave({
                parentPathString,
                key: keyName,
                types,
                itemTypes,
                desc,
                required: req,
                eitherRequired: false,
                defaultValue,
                uniqueness,
                overrideHint
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Add New Key</h3>
                    <button onClick={onClose}><X className="w-4 h-4 text-zinc-400 hover:text-zinc-600" /></button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar relative">
                    {/* Parent Selector (Single Typeahead) - HIGH Z-INDEX */}
                    <div className="relative z-20 hover:z-[60]">
                        <InfoLabel label="Parent" tooltip="The location in the JSON structure where this key will be added." placement="right" />
                        {initialParentPath ? (
                            <div className="flex items-center space-x-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-md">
                                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex-1 truncate">{unescapePath(initialParentPath)}</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-[2px] rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex-shrink-0">Auto</span>
                            </div>
                        ) : (
                            <Typeahead
                                id="parent-select"
                                options={validParents}
                                selected={parentPath}
                                onChange={(s) => {
                                    setParentPath(s as string[]);
                                    if (parentError) setParentError(null);
                                }}
                                placeholder="Root (leave empty) or search path..."
                                inputProps={{
                                    className: clsx(
                                        'w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-colors',
                                        parentError ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-700'
                                    )
                                }}
                                renderMenuItemChildren={(option) => (
                                    <div className="text-xs font-mono text-zinc-700 dark:text-zinc-200 px-2 py-1">{unescapePath(option as string)}</div>
                                )}
                                emptyLabel={
                                    <span className="text-red-500 text-xs font-medium px-2">No matches found</span>
                                }
                                renderMenu={(results, { newSelectionPrefix, paginationText, renderMenuItemChildren, ...menuProps }: any) => (
                                    <Menu {...menuProps} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {results.map((result, index) => (
                                            <MenuItem key={index} option={result} position={index}>
                                                <div className="text-xs font-mono text-zinc-700 dark:text-zinc-200 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer">
                                                    {unescapePath(result as string)}
                                                </div>
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                )}
                            />
                        )}
                        {parentError && <p className="text-[10px] text-red-500 mt-1">{parentError}</p>}
                    </div>

                    {/* Key Name */}
                    <div className="relative z-0 hover:z-[60]">
                        <InfoLabel label="Key Name" tooltip="The unique identifier for this field." placement="right" />
                        <input
                            type="text"
                            value={keyName}
                            onChange={e => {
                                setKeyName(e.target.value);
                                if (keyError) setKeyError(null);
                            }}
                            className={clsx(
                                "w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-colors",
                                keyError ? "border-red-500 focus:ring-red-500" : "border-zinc-200 dark:border-zinc-700"
                            )}
                            placeholder="e.g. server_port"
                        />
                        {keyError && <p className="text-[10px] text-red-500 mt-1">{keyError}</p>}
                    </div>

                    {/* Redesigned Type Selector (Typeahead) */}
                    <div className="relative z-10">
                        <InfoLabel label="Type" tooltip="The data type(s) allowed for this key." placement="right" />
                        <div className={clsx(
                            "transition-all bg-white dark:bg-zinc-800 border rounded-md flex items-center flex-wrap px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500",
                            typeError ? "border-red-500" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                        )}>
                            <Typeahead
                                id="type-select"
                                multiple
                                options={DATA_TYPES}
                                selected={types}
                                onChange={(s) => {
                                    const selected = s as string[];
                                    if (selected.includes('enum')) {
                                        setTypes(['enum']);
                                    } else {
                                        setTypes(selected);
                                    }
                                    if (typeError) setTypeError(null);
                                }}
                                placeholder={types.length === 0 ? "Search types..." : ""}
                                className="flex-1"
                                inputProps={{
                                    className: 'bg-transparent border-none outline-none text-[13px] py-1 px-2 w-full text-zinc-900 dark:text-zinc-100 min-w-[100px]',
                                }}
                                renderToken={(option, props, index) => (
                                    <div key={index} className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[11px] px-2.5 py-1 rounded-md flex items-center font-mono border border-blue-100 dark:border-blue-500/20 m-1 shadow-sm">
                                        {option as string}
                                        <button onClick={(e) => { e.stopPropagation(); props.onRemove && props.onRemove(option); }} className="ml-2 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                )}
                                renderMenuItemChildren={(option) => (
                                    <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-2 py-0.5">{option as string}</div>
                                )}
                                emptyLabel={<span className="text-red-500 text-xs font-medium px-2">No matches found</span>}
                                renderMenu={(results, { newSelectionPrefix, paginationText, renderMenuItemChildren, ...menuProps }: any) => (
                                    <Menu {...menuProps} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xl max-h-48 overflow-y-auto py-1 mt-1 z-[100]">
                                        {results.map((result, index) => (
                                            <MenuItem key={index} option={result} position={index}>
                                                <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 cursor-pointer border-l-2 border-transparent hover:border-blue-500 transition-all">
                                                    {result as string}
                                                </div>
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                )}
                            />
                        </div>
                        {typeError && <p className="text-[10px] text-red-500 mt-1">{typeError}</p>}
                    </div>

                    {/* Redesigned Item Type (if list) (Typeahead) */}
                    {types.includes('list') && (
                        <div className="pl-3 border-l-2 border-blue-500/20 py-1 relative z-0 hover:z-[60]">
                            <InfoLabel label="List Item Type" tooltip="The data type(s) allowed for items within this list." placement="right" />
                            <div className="min-h-[38px] transition-all bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md flex items-center flex-wrap px-2 py-1 hover:border-zinc-300 dark:hover:border-zinc-600 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500">
                                <Typeahead
                                    id="item-type-select"
                                    multiple
                                    options={ITEM_DATA_TYPES}
                                    selected={itemTypes}
                                    onChange={(s) => setItemTypes(s as string[])}
                                    placeholder={itemTypes.length === 0 ? "Search item types..." : ""}
                                    className="flex-1"
                                    inputProps={{
                                        className: 'bg-transparent border-none outline-none text-[13px] py-1 px-2 w-full text-zinc-900 dark:text-zinc-100 min-w-[100px]',
                                    }}
                                    renderToken={(option, props, index) => (
                                        <div key={index} className="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[11px] px-2.5 py-1 rounded-md flex items-center font-mono border border-purple-100 dark:border-purple-500/20 m-1 shadow-sm">
                                            {option as string}
                                            <button onClick={(e) => { e.stopPropagation(); props.onRemove && props.onRemove(option); }} className="ml-2 hover:text-purple-900 dark:hover:text-purple-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    )}
                                    renderMenuItemChildren={(option) => (
                                        <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-2 py-0.5">{option as string}</div>
                                    )}
                                    emptyLabel={<span className="text-red-500 text-xs font-medium px-2">No matches found</span>}
                                    renderMenu={(results, { newSelectionPrefix, paginationText, renderMenuItemChildren, ...menuProps }: any) => (
                                        <Menu {...menuProps} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xl max-h-40 overflow-y-auto py-1 mt-1 z-[100]">
                                            {results.map((result, index) => (
                                                <MenuItem key={index} option={result} position={index}>
                                                    <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer border-l-2 border-transparent hover:border-blue-500 transition-all">
                                                        {result as string}
                                                    </div>
                                                </MenuItem>
                                            ))}
                                        </Menu>
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {/* Desc */}
                    <div className="relative z-0 hover:z-[60]">
                        <InfoLabel label="Description" tooltip="A brief explanation of what this key is used for." placement="right" />
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none text-xs min-h-[60px]" placeholder="..." />
                    </div>

                    {/* Default Value */}
                    <div className="relative z-0 hover:z-[60]">
                        <div className="flex items-center justify-between mb-1">
                            <InfoLabel label="Default Value" tooltip="The default value assigned if none is provided." placement="right" />
                            <button
                                onClick={() => {
                                    setTempDefaultValue(defaultValue);
                                    setIsDefaultValueModalOpen(true);
                                }}
                                className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center mb-1"
                            >
                                <Edit3 className="w-3 h-3 mr-1" />
                                Edit in Modal
                            </button>
                        </div>
                        <div
                            onClick={() => {
                                setTempDefaultValue(defaultValue);
                                setIsDefaultValueModalOpen(true);
                            }}
                            className="w-full px-3 py-2 rounded-md border bg-zinc-50 dark:bg-zinc-800 text-xs font-mono min-h-[42px] cursor-pointer hover:border-blue-400 transition-all border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 overflow-hidden text-ellipsis whitespace-nowrap"
                        >
                            {defaultValue || <span className="text-zinc-400 italic">No default value set...</span>}
                        </div>
                    </div>

                    {/* Uniqueness Selector */}
                    <div className="relative z-0 hover:z-[60]">
                        <InfoLabel label="Uniqueness" tooltip="The scoping level at which this key must be unique." placement="right" />
                        <select
                            value={uniqueness}
                            onChange={(e) => setUniqueness(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-colors appearance-none cursor-pointer"
                        >
                            <option value="cluster">Cluster</option>
                            <option value="region">Region</option>
                            <option value="fab">FAB</option>
                        </select>
                        {/* Custom Select Arrow */}
                        <div className="absolute right-3 top-[34px] pointer-events-none text-zinc-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    {/* Checkboxes Row */}
                    <div className="pt-3 pb-1 flex flex-wrap gap-4">
                        {/* Override Hint */}
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={overrideHint}
                                    onChange={(e) => setOverrideHint(e.target.checked)}
                                />
                                <div className="w-8 h-4 bg-zinc-200 dark:bg-zinc-700 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                                <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full peer-checked:translate-x-4 transition-transform"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-blue-500 transition-colors">Show Override Hint</span>
                                <span className="text-[10px] text-zinc-500">Display override indicators in UI</span>
                            </div>
                        </label>
                    </div>

                    {/* Required Status Selector (Moved to Bottom) */}
                    <div className="w-full pt-2 mt-4 border-t border-zinc-200 dark:border-zinc-800 relative z-0">
                        <InfoLabel label="Field Status" tooltip="Define the requirement status of this field." placement="right" />
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                            <button
                                onClick={() => setReq(true)}
                                className={clsx(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center",
                                    req === true
                                        ? "bg-white dark:bg-zinc-700 shadow text-green-600 dark:text-green-400"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Required
                            </button>
                            <button
                                onClick={() => setReq(false)}
                                className={clsx(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center",
                                    req === false
                                        ? "bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Optional
                            </button>
                            <button
                                onClick={() => setReq(null)}
                                className={clsx(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center",
                                    req === null
                                        ? "bg-white dark:bg-zinc-700 shadow text-red-600 dark:text-red-400"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Deprecated
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-end space-x-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-xs font-medium transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium flex items-center shadow-sm transition-colors">
                        <Save className="w-3.5 h-3.5 mr-1.5" /> Save Key
                    </button>
                </div>
            </div>

            {/* Default Value Secondary Modal Overlay */}
            {isDefaultValueModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl h-[60vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Edit Default Value</h3>
                            <button onClick={() => setIsDefaultValueModalOpen(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                <X className="w-4 h-4 text-zinc-500" />
                            </button>
                        </div>
                        <div className="flex-1 p-4 overflow-hidden relative">
                            <textarea
                                value={tempDefaultValue}
                                onChange={e => setTempDefaultValue(e.target.value)}
                                className="w-full h-full bg-zinc-50 dark:bg-zinc-950 font-mono text-sm p-4 rounded-lg resize-none outline-none focus:ring-2 focus:ring-blue-500/20 border border-zinc-200 dark:border-zinc-800"
                                placeholder="Enter JSON or string value..."
                            />
                            <div className="absolute bottom-6 right-6 flex space-x-2">
                                <button
                                    onClick={() => {
                                        try {
                                            const parsed = JSON.parse(tempDefaultValue);
                                            setTempDefaultValue(JSON.stringify(parsed, null, 4));
                                        } catch (e) { /* ignore */ }
                                    }}
                                    className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-xs font-medium rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                                >
                                    Format JSON
                                </button>
                            </div>
                        </div>
                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end space-x-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-xl">
                            <button
                                onClick={() => setIsDefaultValueModalOpen(false)}
                                className="px-5 py-2 text-zinc-600 dark:text-zinc-400 text-xs font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setDefaultValue(tempDefaultValue);
                                    setIsDefaultValueModalOpen(false);
                                }}
                                className="px-5 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-blue-500/20 transition"
                            >
                                Apply Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
