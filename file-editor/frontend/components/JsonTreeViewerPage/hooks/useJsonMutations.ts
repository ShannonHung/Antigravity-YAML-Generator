import { api } from '@/lib/api';
import { JsonNode } from '../types';

export function useJsonMutations(
    filePath: string,
    nodes: JsonNode[],
    setNodes: (nodes: JsonNode[]) => void,
    setDeleteTarget: (target: null) => void,
    setIsAddKeyModalOpen: (open: boolean) => void
) {
    const handleDelete = async (target: { node: JsonNode, parentPath: string }) => {
        if (!target) return;
        try {
            const newNodes = JSON.parse(JSON.stringify(nodes));
            const removeRecursive = (list: JsonNode[], parentP: string): boolean => {
                for (let i = 0; i < list.length; i++) {
                    const n = list[i];
                    const p = parentP ? `${parentP}.${n.key}` : n.key;
                    if (p === (target.parentPath ? `${target.parentPath}.${target.node.key}` : target.node.key)) {
                        list.splice(i, 1);
                        return true;
                    }
                    if (n.children && removeRecursive(n.children, p)) return true;
                }
                return false;
            };

            if (!target.parentPath) {
                const idx = newNodes.findIndex((n: JsonNode) => n.key === target.node.key);
                if (idx !== -1) newNodes.splice(idx, 1);
            } else {
                removeRecursive(newNodes, '');
            }

            await api.createFile(filePath, JSON.stringify(newNodes, null, 4));
            setNodes(newNodes);
            setDeleteTarget(null);

        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
    };

    const handleSaveNewKey = async (data: any) => {
        // Data contains: { parentPathString: "root.ntp", key, types, itemTypes, desc, required }
        const newNodes = JSON.parse(JSON.stringify(nodes));
        const newNode: JsonNode = {
            key: data.key,
            description: data.desc,
            multi_type: data.types,
            item_multi_type: data.types.includes('list') ? data.itemTypes : undefined,
            required: data.required,
            override_hint: data.overrideHint,
            children: []
        };

        const targetPath = data.parentPathString === 'root' ? [] : data.parentPathString.split('.').filter((p: string) => p !== 'root');

        if (targetPath.length === 0) {
            // Add to root
            newNodes.push(newNode);
        } else {
            // Traverse
            const findAndPush = (list: JsonNode[], path: string[]): boolean => {
                const [head, ...tail] = path;
                for (const n of list) {
                    if (n.key === head) {
                        if (tail.length === 0) {
                            if (!n.children) n.children = [];
                            n.children.push(newNode);
                            return true;
                        }
                        if (n.children && findAndPush(n.children, tail)) return true;
                    }
                }
                return false;
            };
            findAndPush(newNodes, targetPath);
        }

        try {
            await api.createFile(filePath, JSON.stringify(newNodes, null, 4));
            setNodes(newNodes);
            setIsAddKeyModalOpen(false);
        } catch (e: any) {
            alert("Failed to save: " + e.message);
        }
    };

    return { handleDelete, handleSaveNewKey };
}
