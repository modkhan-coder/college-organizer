import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Default to 'default' (light/university blue) or load from localStorage
    const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'default');

    useEffect(() => {
        // Apply theme to document root
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    const themes = [
        { id: 'default', name: 'University Blue' },
        { id: 'midnight', name: 'Midnight Pro' },
        { id: 'sunset', name: 'Sunset Vibes' },
        { id: 'ocean', name: 'Ocean Breeze' },
        { id: 'forest', name: 'Forest Focus' }
    ];

    return (
        <ThemeContext.Provider value={{ theme, setTheme, themes }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
