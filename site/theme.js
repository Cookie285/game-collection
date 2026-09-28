// applied before first paint (separate file so the Content-Security-Policy can forbid inline scripts)
try { const t = localStorage.getItem("gc-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* storage unavailable */ }
