/* ═══════════════════════════════════════════════════════════════════════════
   main.js — 36. INITIALIZE APPLICATION
   All modules are loaded (deferred); start the boot sequence.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  App.boot();
});

/* safety net: surface unexpected errors as toasts instead of silent death */
window.addEventListener('error', (e) => {
  if (window.App && App.state && App.state.booted) {
    App.toast({
      type: 'error',
      title: 'Unexpected error',
      message: (e.message || 'Unknown script error') + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''),
      timeout: 8000,
    });
  }
});
