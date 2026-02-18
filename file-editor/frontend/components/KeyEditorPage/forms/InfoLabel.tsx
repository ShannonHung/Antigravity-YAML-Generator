import React from 'react';
import { Info } from 'lucide-react';
import clsx from 'clsx';

interface InfoLabelProps {
    label: string;
    tooltip: string;
    placement?: 'top' | 'bottom' | 'right';
}

export const InfoLabel = ({ label, tooltip, placement = 'right' }: InfoLabelProps) => (
    <div className="flex items-center mb-1">
        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mr-2">{label}</span>
        <div className="relative group cursor-help z-10">
            <Info className="w-3.5 h-3.5 text-zinc-400 hover:text-blue-500" />
            <div className={clsx(
                "absolute hidden group-hover:block z-50 w-max max-w-xs pointer-events-none",
                placement === 'top' && "left-0 bottom-full mb-2",
                placement === 'right' && "left-full top-1/2 -translate-y-1/2 ml-2"
            )}>
                <div className="bg-zinc-800 text-white text-[10px] rounded px-3 py-2 shadow-xl border border-zinc-700 leading-relaxed z-50 relative">
                    {tooltip}
                    {placement === 'top' && <div className="absolute left-1 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>}
                    {placement === 'right' && <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-4 border-transparent border-r-zinc-800"></div>}
                </div>
            </div>
        </div>
    </div>
);
