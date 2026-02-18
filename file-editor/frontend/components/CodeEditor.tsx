import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CodeEditorProps {
    content: string;
    filePath: string;
    onChange: (newContent: string) => void;
}

export default function CodeEditor({ content, filePath, onChange }: CodeEditorProps) {
    const [text, setText] = useState(content);
    const [lineCount, setLineCount] = useState(1);
    const [errorLine, setErrorLine] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setText(content);
        setLineCount(content.split('\n').length);
        validateJson(content);
    }, [content]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);
        setLineCount(newText.split('\n').length);
        onChange(newText);
        validateJson(newText);
    };

    const validateJson = (jsonText: string) => {
        try {
            JSON.parse(jsonText);
            setErrorLine(null);
            setErrorMsg(null);
        } catch (e: any) {
            setErrorMsg(e.message);
            // V8 Error format: "Unexpected token X in JSON at position Y"
            // or "Unexpected end of JSON input"
            const match = e.message.match(/at position (\d+)/);
            if (match) {
                const pos = parseInt(match[1]);
                const lines = jsonText.substring(0, pos).split('\n');
                setErrorLine(lines.length);
            } else if (e.message.includes('end of JSON input')) {
                // Usually means issue at the end
                setErrorLine(jsonText.split('\n').length);
            } else {
                setErrorLine(1); // Default to first line if unknown
            }
        }
    };

    const handleScroll = () => {
        if (textareaRef.current) {
            // Sync scroll if we had a separate line number div, but here we might use a flex row
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 font-mono text-sm">
            {/* Status Bar */}
            <div className={`h-10 flex items-center px-4 border-b ${errorMsg ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
                {errorMsg ? (
                    <div className="flex items-center text-red-600 dark:text-red-400 text-xs">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        <span>Invalid JSON: {errorMsg} {errorLine ? `(Line ${errorLine})` : ''}</span>
                    </div>
                ) : (
                    <div className="flex items-center text-green-600 dark:text-green-400 text-xs">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        <span>Valid JSON</span>
                    </div>
                )}
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative flex overflow-hidden">
                {/* Line Numbers */}
                <div className="w-12 bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-right py-4 pr-2 text-zinc-400 select-none overflow-hidden">
                    {Array.from({ length: lineCount }).map((_, i) => (
                        <div key={i} className={`h-6 leading-6 text-xs ${errorLine === i + 1 ? 'text-red-500 font-bold' : ''}`}>
                            {i + 1}
                        </div>
                    ))}
                </div>

                {/* Text Area */}
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleInput}
                    onScroll={(e) => {
                        // Sync line numbers scroll if needed
                        const target = e.target as HTMLTextAreaElement;
                        const lineNums = target.previousElementSibling;
                        if (lineNums) lineNums.scrollTop = target.scrollTop;
                    }}
                    className="flex-1 w-full h-full p-4 bg-transparent outline-none resize-none text-zinc-800 dark:text-zinc-200 leading-6 whitespace-pre"
                    spellCheck={false}
                />
            </div>
        </div>
    );
}
