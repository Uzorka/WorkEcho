export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "workecho-theme";

// Inline script run in <head> before first paint, to avoid a light/dark flash.
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((p!=="light")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;
