import { useState, useEffect } from 'react';
import { JsonNode } from '../types';

export function useJsonData(content: string) {
    const [nodes, setNodes] = useState<JsonNode[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            setError(null);
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                setNodes(parsed);
            } else if (typeof parsed === 'object') {
                setNodes([parsed]);
            } else {
                setError('Content is not a valid JSON object');
            }
        } catch (e: any) {
            setError(`JSON Parse Error: ${e.message}`);
        }
    }, [content]);

    return { nodes, setNodes, error };
}
