import { useState, useEffect } from 'react';

export function useTheme() {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        // Check localStorage first
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            if (savedTheme === 'dark') {
                setDarkMode(true);
                document.documentElement.classList.add('dark');
            } else {
                setDarkMode(false);
                document.documentElement.classList.remove('dark');
            }
        } else {
            // Fallback to system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setDarkMode(true);
                document.documentElement.classList.add('dark');
            }
        }
    }, []);

    const toggleDarkMode = () => {
        const newDarkMode = !darkMode;
        setDarkMode(newDarkMode);
        if (newDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    return { darkMode, toggleDarkMode };
}
