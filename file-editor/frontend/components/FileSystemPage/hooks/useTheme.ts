import { useState, useEffect } from 'react';

export function useTheme() {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        // Check system preference for dark mode initially
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setDarkMode(true);
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
        if (!darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    return { darkMode, toggleDarkMode };
}
