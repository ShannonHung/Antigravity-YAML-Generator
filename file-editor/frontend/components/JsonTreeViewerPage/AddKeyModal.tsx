import { useState, useMemo } from 'react';
import { Info, X, Save } from 'lucide-react';
import clsx from 'clsx';
import { Typeahead, Menu, MenuItem } from 'react-bootstrap-typeahead';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import { DATA_TYPES, ITEM_DATA_TYPES } from '../../config/editorConfig';
import { JsonNode } from './types';

// Helper to flatten valid parents
const getValidParents = (nodes: JsonNode[], parentPath: string = ''): string[] => {
    let parents: string[] = [];

    // If at top level (parentPath is empty), 'root' is a valid parent
    if (parentPath === '') {
        parents.push('root');
    }

    for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath}.${node.key}` : node.key;

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

export default function AddKeyModal({ nodes, onClose, onSave }: any) {
    const [parentPath, setParentPath] = useState<string[]>([]);
    const [keyName, setKeyName] = useState('');
    const [types, setTypes] = useState<string[]>([]);
    const [itemTypes, setItemTypes] = useState<string[]>([]);
    const [desc, setDesc] = useState('');
    const [req, setReq] = useState(false);

    // Validation States
    const [parentError, setParentError] = useState<string | null>(null);
    const [keyError, setKeyError] = useState<string | null>(null);
    const [typeError, setTypeError] = useState<string | null>(null);

    // Type dropdown state
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

    // Flatten valid parents
    const validParents = useMemo(() => getValidParents(nodes), [nodes]);

    const handleSave = () => {
        // Reset errors
        setParentError(null);
        setKeyError(null);
        setTypeError(null);

        let isValid = true;

        // validate Parent
        const parentPathString = parentPath[0];
        if (!parentPathString) {
            setParentError("Parent is required");
            isValid = false;
        } else if (!validParents.includes(parentPathString)) {
            setParentError("Selected parent does not exist");
            isValid = false;
        }

        // validate Key Name
        if (!keyName.trim()) {
            setKeyError("Key name is required");
            isValid = false;
        }

        // validate Type
        if (types.length === 0) {
            setTypeError("At least one type is required");
            isValid = false;
        }

        if (isValid) {
            onSave({ parentPathString, key: keyName, types, itemTypes, desc, required: req });
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
                        <Typeahead
                            id="parent-select"
                            options={validParents}
                            selected={parentPath}
                            onChange={(s) => {
                                setParentPath(s as string[]);
                                if (parentError) setParentError(null);
                            }}
                            placeholder="Search parent path (e.g. root.ntp)..."
                            inputProps={{
                                className: clsx(
                                    'w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-colors',
                                    parentError ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-700'
                                )
                            }}
                            renderMenuItemChildren={(option) => (
                                <div className="text-xs font-mono text-zinc-700 dark:text-zinc-200 px-2 py-1">{option as string}</div>
                            )}
                            emptyLabel={
                                <span className="text-red-500 text-xs font-medium px-2">No matches found</span>
                            }
                            renderMenu={(results, menuProps) => (
                                <Menu {...menuProps} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {results.map((result, index) => (
                                        <MenuItem key={index} option={result} position={index}>
                                            <div className="text-xs font-mono text-zinc-700 dark:text-zinc-200 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer">
                                                {result as string}
                                            </div>
                                        </MenuItem>
                                    ))}
                                </Menu>
                            )}
                        />
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

                    {/* Styled Type Selector */}
                    <div className="relative z-10">
                        <InfoLabel label="Type" tooltip="The data type(s) allowed for this key." placement="right" />
                        <div className="relative">
                            <div
                                className={clsx(
                                    "w-full min-h-[34px] p-1 bg-white dark:bg-zinc-800 border rounded-md flex flex-wrap gap-1.5 cursor-text transition-colors",
                                    typeError ? "border-red-500" : "border-zinc-200 dark:border-zinc-700"
                                )}
                                onClick={() => {
                                    setIsTypeDropdownOpen(true);
                                    if (typeError) setTypeError(null);
                                }}
                            >
                                {types.map(t => (
                                    <span key={t} className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-[10px] px-1.5 py-0.5 rounded flex items-center font-mono border border-blue-100 dark:border-blue-800">
                                        {t}
                                        <button onClick={(e) => { e.stopPropagation(); setTypes(types.filter(x => x !== t)); }} className="ml-1 hover:text-blue-800 dark:hover:text-blue-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                                <input readOnly type="text" className="flex-1 bg-transparent outline-none text-xs min-w-[60px] cursor-pointer h-6 px-1" placeholder={types.length === 0 ? "Select type..." : ""} />
                            </div>
                            {typeError && <p className="text-[10px] text-red-500 mt-1">{typeError}</p>}

                            {isTypeDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsTypeDropdownOpen(false)} />
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 max-h-40 overflow-y-auto py-1">
                                        {DATA_TYPES.filter(o => !types.includes(o)).map(opt => (
                                            <button
                                                key={opt}
                                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-mono"
                                                onClick={() => { setTypes([...types, opt]); setIsTypeDropdownOpen(false); }}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Item Type (if list) */}
                    {types.includes('list') && (
                        <div className="pl-3 border-l-2 border-blue-500/20 py-1 relative z-0 hover:z-[60]">
                            <InfoLabel label="List Item Type" tooltip="The data type(s) allowed for items within this list." placement="right" />
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                                {itemTypes.map(t => (
                                    <span key={t} className="bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[10px] px-1.5 py-0.5 rounded flex items-center font-mono border border-purple-100 dark:border-purple-800">
                                        {t}
                                        <button onClick={() => setItemTypes(itemTypes.filter(x => x !== t))} className="ml-1 hover:text-purple-800 dark:hover:text-purple-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>
                            <select
                                className="w-full px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs outline-none focus:ring-2 focus:ring-purple-500/50"
                                onChange={(e) => {
                                    if (e.target.value && !itemTypes.includes(e.target.value)) {
                                        setItemTypes([...itemTypes, e.target.value]);
                                    }
                                    e.target.value = '';
                                }}
                            >
                                <option value="">Add item type...</option>
                                {!itemTypes.includes('object') && <option value="object">object</option>}
                                {ITEM_DATA_TYPES.filter(o => !itemTypes.includes(o) && o !== 'object').map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Desc */}
                    <div className="relative z-0 hover:z-[60]">
                        <InfoLabel label="Description" tooltip="A brief explanation of what this key is used for." placement="right" />
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none text-xs min-h-[60px]" placeholder="..." />
                    </div>

                    {/* Req */}
                    <div className="flex items-center space-x-2 pt-1 relative z-0">
                        <input type="checkbox" id="req-check-3" checked={req} onChange={e => setReq(e.target.checked)} className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                        <div className="flex items-center ">
                            <label htmlFor="req-check-3" className="text-xs font-medium text-zinc-700 dark:text-zinc-300 select-none mr-1.5">Required Field</label>
                            <InfoLabel label="" tooltip="Whether this field must be present in the configuration." placement="right" />
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
        </div>
    );
}
