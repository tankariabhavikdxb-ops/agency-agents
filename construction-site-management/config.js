/* ============================================================
   NEXORA LIMITED — Construction Site Management System
   Global configuration
   ------------------------------------------------------------
   HOW TO CONNECT GOOGLE SHEETS (backend):
   1. Follow the steps in README.md / backend/Code.gs to deploy
      the Google Apps Script web app.
   2. Copy your deployed Web App URL (ends with /exec) and paste
      it into API_URL below.
   3. Open the app -> Settings -> Connection -> Test connection.
   While API_URL is empty, the app runs in DEMO mode with a
   built-in sample database (saved in your browser).
   ============================================================ */

window.APP_CONFIG = {
  // Paste your Google Apps Script Web App URL here, e.g.:
  // "https://script.google.com/macros/s/AKfycb.../exec"
  API_URL: "",

  // Application branding (also stored in the Google Sheet Settings tab)
  COMPANY: {
    name: "Nexora Limited",
    address: "Corporate Mall, 1st Floor, Office Block B, Chilambula Road, Lilongwe, Malawi",
    phone: "+265 1 700 000",
    email: "info@nexora.mw",
    currency: "MK", // Malawi Kwacha
  },

  // UI behaviour
  DEFAULT_POLL_INTERVAL: 45,   // seconds between background sync checks (real-time sync)
  PAGE_SIZE: 25,               // default rows per page in tables
  DEFAULT_VAT_RATE: 16.5,      // % (Malawi VAT)
  DEFAULT_PIN: "1234",         // initial PIN for all seeded users — change it in Settings
  VERSION: "1.0.1",
};
