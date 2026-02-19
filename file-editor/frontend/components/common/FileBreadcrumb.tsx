import React from 'react';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface FileBreadcrumbProps {
    path: string;
    onNavigate: (path: string) => void;
    className?: string;
    homeLabel?: string;
}

export default function FileBreadcrumb({
    path,
    onNavigate,
    className,
    homeLabel = 'Home'
}: FileBreadcrumbProps) {
    const breadcrumbs = path.split('/').filter(Boolean);

    return (
        <div className={clsx("flex items-center text-sm text-zinc-500 dark:text-zinc-400 overflow-x-auto whitespace-nowrap scrollbar-hide mask-fade-right", className)}>
            <button
                onClick={() => onNavigate('/')}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
                {homeLabel}
            </button>
            {breadcrumbs.map((segment, index) => (
                <div key={index} className="flex items-center">
                    <ChevronRight className="w-3 h-3 mx-1 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                    <button
                        onClick={() => onNavigate('/' + breadcrumbs.slice(0, index + 1).join('/'))}
                        className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1 rounded font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                    >
                        {segment}
                    </button>
                </div>
            ))}
        </div>
    );
}
