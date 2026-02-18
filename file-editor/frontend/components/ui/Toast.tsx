import React, { useEffect } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface ToastProps {
    message: string;
    type?: 'success' | 'error';
    onClose: () => void;
    duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className={clsx(
            "fixed bottom-6 right-6 z-[100] flex items-center p-4 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300",
            type === 'success' ? "bg-white dark:bg-zinc-800 border-green-200 dark:border-green-900" : "bg-white dark:bg-zinc-800 border-red-200 dark:border-red-900"
        )}>
            <div className={clsx(
                "p-2 rounded-full mr-3",
                type === 'success' ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            )}>
                {type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
            <div>
                <h4 className={clsx("text-sm font-semibold", type === 'success' ? "text-zinc-900 dark:text-zinc-100" : "text-red-600 dark:text-red-400")}>
                    {type === 'success' ? 'Success' : 'Error'}
                </h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{message}</p>
            </div>
            <button onClick={onClose} className="ml-6 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
