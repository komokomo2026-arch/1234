<!DOCTYPE html>
<!--
  EKAMBANI POS — single-file, offline-first app (IndexedDB).
  - No Google Apps Script, no Google Sheets, no server code required.
  - Works as a static page: GitHub Pages, any static host, localhost, or an Android WebView.
  - ORIGIN NOTES (comments only, no UI):
      * IndexedDB works on https://, http://localhost and most WebViews (enable DOM storage / setJavaScriptEnabled
        and loadUrl an https:// or http://localhost origin). On file:// support varies by browser/WebView.
      * Google Drive sign-in (OAuth) only works on https:// or http://localhost, and the exact origin must be
        listed under "Authorized JavaScript origins" for your OAuth client. It is NOT available on file://
        and is not reliable in embedded WebViews (Google blocks OAuth in many of them). When unavailable,
        only the Back Up page is affected; everything else keeps working.
      * A service worker cannot be registered from an inline/blob script (browsers require a real same-origin
        script URL), so this single file does not register one. The CDN libraries below load from the network
        the first time and are then served from the browser's HTTP cache where the browser allows it. For
        guaranteed offline start-up inside an Android WebView, bundle those libraries as local assets.
-->
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#09874a">
  <title>Ekambani POS</title>
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script>
    /* Graceful fallbacks when an optional CDN library could not be loaded (e.g. offline first run).
       Core features keep working; only the enhanced widget is simplified. */
    (function () {
      if (window.jQuery && !jQuery.fn.select2) { jQuery.fn.select2 = function () { return this; }; }
      if (typeof window.Swal === 'undefined') {
        window.Swal = {
          fire: function (a, b, c) {
            var o = (a && typeof a === 'object') ? a : { title: a, text: b, icon: c };
            if (o.didOpen) { return Promise.resolve({}); }
            if (o.showCancelButton) { return Promise.resolve({ isConfirmed: window.confirm((o.title || '') + (o.text ? '\n' + o.text : '')) }); }
            window.alert((o.title || '') + (o.text ? '\n' + o.text : ''));
            return Promise.resolve({ isConfirmed: true });
          },
          close: function () {}, showLoading: function () {}
        };
      }
    })();
  </script>

  <style>
    /* ════════ RESET & BASE ════════ */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #f1f5f9; color: #1e293b; }

    input, select, button, textarea {
      width: 100%; padding: 10px 12px; margin-top: 6px;
      border-radius: 8px; border: 1px solid #e2e8f0;
      font-size: 14px; font-family: inherit; box-sizing: border-box;
    }
    input:focus, select:focus, textarea:focus {
      outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
    }
    button {
      border: none; background: #2563eb; color: white;
      font-weight: 600; cursor: pointer; transition: background .2s, transform .1s, opacity .2s;
    }
    button:hover:not(:disabled) { background: #1d4ed8; }
    button:active:not(:disabled) { transform: scale(0.98); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }

    .card { background: white; padding: 16px; border-radius: 14px; margin-bottom: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .flex { display: flex; gap: 10px; margin-bottom: 10px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 14px; }
    .stat-card { color: white; padding: 15px; border-radius: 12px; text-align: center; font-size: 13px; }
    .blue  { background: linear-gradient(135deg,#2563eb,#1d4ed8); }
    .green { background: linear-gradient(135deg,#16a34a,#15803d); }
    .orange{ background: linear-gradient(135deg,#ea580c,#c2410c); }

    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th, td { padding: 9px 8px; border-bottom: 1px solid #f1f5f9; text-align: left; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    tr:hover td { background: #f8fafc; }

    .view { display: none; }
    .view.active { display: block; }
    .low-stock { color: #dc2626 !important; font-weight: bold; }
    .action-icons i { cursor: pointer; margin-right: 8px; font-size: 13px; }
    .btn-remove { color: #ef4444; cursor: pointer; }
    #repDownloadBtn { display: none; background: #1e293b; margin-top: 8px; }
    .rep-section-title { font-weight: 700; margin: 14px 0 4px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .select2-container { margin-top: 6px !important; }
    label.lbl { font-size: 12px; font-weight: 600; color: #334155; display: block; margin-top: 10px; }

    /* ════════ LAYOUT — MOBILE ════════ */
    #appShell { display: block; }
    .header {
      background: #0f172a; color: white; padding: 14px 16px;
      font-size: 18px; font-weight: 700; position: sticky; top: 0; z-index: 900;
      display: flex; align-items: center; justify-content: center;
    }
    .header-title { text-align: center; letter-spacing: .5px; }
    .main-content { padding: 14px; padding-bottom: 90px; max-width: 1000px; margin: 0 auto; }
    .sidebar { display: none; }
    .desktop-topbar { display: none; }

    .bottom-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: white; display: flex; justify-content: space-around;
      padding: 8px 0 10px; border-top: 1px solid #e2e8f0; z-index: 800;
    }
    .nav-item { text-align: center; cursor: pointer; color: #94a3b8; font-size: 10px; flex: 1; transition: color .15s; }
    .nav-item i { display: block; font-size: 20px; margin-bottom: 2px; }
    .nav-item.active, .nav-item.active i { color: #2563eb; }

    /* ════════ LAYOUT — TABLET / DESKTOP ════════ */
    @media (min-width: 768px) {
      html, body { height: 100%; overflow: hidden; }
      #appShell { display: flex; flex-direction: row; width: 100vw; height: 100vh; overflow: hidden; }
      .header { display: none; }
      .sidebar {
        display: flex; flex-direction: column;
        width: 220px; min-width: 220px; flex-shrink: 0;
        background: #0f172a; color: white; height: 100vh; z-index: 800;
      }
      .sidebar-logo { padding: 20px 18px 16px; font-size: 15px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08); letter-spacing: .4px; flex-shrink: 0; }
      .sidebar-logo span { color: #38bdf8; }
      .sidebar-nav { flex: 1; padding: 10px 0; overflow-y: auto; }
      .sidebar-nav-item {
        display: flex; align-items: center; gap: 12px;
        padding: 13px 20px; color: #94a3b8;
        cursor: pointer; font-size: 14px; font-weight: 500;
        transition: background .15s, color .15s;
        border-left: 3px solid transparent; white-space: nowrap;
      }
      .sidebar-nav-item i { font-size: 16px; width: 18px; text-align: center; }
      .sidebar-nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
      .sidebar-nav-item.active { background: rgba(37,99,235,0.18); color: #60a5fa; border-left-color: #2563eb; }
      .sidebar-footer { padding: 14px 18px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #64748b; flex-shrink: 0; }
      .main-wrapper { flex: 1; min-width: 0; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; background: #f1f5f9; }
      .desktop-topbar { display: flex; align-items: center; justify-content: flex-end; padding: 12px 24px; background: white; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; flex-shrink: 0; }
      .main-content { flex: 1; padding: 24px; padding-bottom: 24px; max-width: none; width: 100%; margin: 0; }
      .bottom-nav { display: none; }
      .grid-3 { gap: 16px; }
      .stat-card { padding: 22px 16px; font-size: 14px; }
      .stat-card strong { font-size: 18px; }
      table { font-size: 13px; }
      th, td { padding: 10px 12px; }
      .card { padding: 22px 24px; border-radius: 16px; }
      .flex { gap: 14px; }
      #reportView .card:first-child .flex,
      #homeView .card:first-child .flex { max-width: 480px; }
    }
    @media (min-width: 1280px) {
      .sidebar { width: 240px; min-width: 240px; }
      #salesView { display: none; }
      #salesView.active { display: grid; grid-template-columns: 420px 1fr; gap: 20px; align-items: start; }
      #homeView .card:last-child { grid-column: 1 / -1; }
    }

    /* ════════ MORE DROPDOWN ════════ */
    #moreBackdrop { display: none; position: fixed; inset: 0; z-index: 1900; background: transparent; }
    #moreBackdrop.open { display: block; }
    #moreMenu {
      display: none; position: fixed; z-index: 1950; min-width: 220px;
      background: white; border-radius: 12px; padding: 6px 0;
      box-shadow: 0 10px 40px rgba(0,0,0,0.25); border: 1px solid #e2e8f0;
    }
    #moreMenu.open { display: block; }
    .more-item { display: flex; align-items: center; gap: 12px; padding: 12px 18px; font-size: 14px; color: #1e293b; cursor: pointer; font-weight: 500; }
    .more-item i { width: 18px; text-align: center; color: #2563eb; font-size: 15px; }
    .more-item:hover { background: #f1f5f9; }
    .more-item.static { cursor: default; color: #64748b; font-size: 12px; border-top: 1px solid #f1f5f9; margin-top: 4px; }
    .more-item.static:hover { background: transparent; }
    .more-item.static i { color: #94a3b8; }

    /* ════════ MODALS ════════ */
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; overflow-y: auto; }
    .modal-content { background: white; width: 90%; max-width: 460px; margin: 5% auto; padding: 22px; border-radius: 14px; }
    .modal-content h3 { margin-bottom: 10px; }
    .modal-content label { font-size: 12px; font-weight: 600; color: #334155; display: block; margin-top: 10px; }

    /* ════════ TOAST ════════ */
    #toastContainer { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 9990; display: flex; flex-direction: column-reverse; align-items: center; gap: 8px; pointer-events: none; }
    @media (min-width: 768px) { #toastContainer { bottom: 20px; } }
    .toast { background: #1e293b; color: white; padding: 11px 20px; border-radius: 10px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 16px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 8px; animation: slideUp .3s ease; min-width: 220px; max-width: 340px; pointer-events: auto; }
    .toast.success { background: #15803d; }
    .toast.error   { background: #dc2626; }
    .toast.warning { background: #d97706; }
    @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes slideDown { to { opacity:0; transform:translateY(16px); } }
    .toast.hiding { animation: slideDown .3s ease forwards; }

    /* ════════ VIEW ITEM ════════ */
    .view-item-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .view-item-row:last-child { border-bottom: none; }
    .view-item-label { color: #64748b; font-weight: 600; font-size: 12px; }
    .view-item-value { color: #1e293b; font-weight: 500; text-align: right; word-break: break-all; }
    .view-item-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .badge-ok  { background: #dcfce7; color: #15803d; }
    .badge-low { background: #fef2f2; color: #dc2626; }

    /* ════════ SCANNER ════════ */
    .imei-row { display: flex; gap: 6px; align-items: flex-end; margin-top: 6px; }
    .imei-row input { margin-top: 0; flex: 1; }
    .scan-btn { width: 42px; min-width: 42px; height: 42px; padding: 0; background: #0f172a; border-radius: 8px; margin-top: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .scan-btn:hover:not(:disabled) { background: #1e293b; }
    #scannerOverlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 3000; flex-direction: column; align-items: center; justify-content: center; }
    #scannerOverlay.open { display: flex; }
    #scannerBox { position: relative; width: min(92vw, 420px); background: #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.5); }
    #scannerHeader { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    #scannerHeader h3 { color: white; font-size: 15px; }
    #scannerCloseBtn { background: rgba(255,255,255,0.1); color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; padding: 0; min-width: unset; margin-top: 0; }
    #scannerCloseBtn:hover { background: rgba(255,255,255,0.2); }
    #scannerViewport video { width: 100% !important; display: block; }
    #scannerViewport { overflow: hidden; }
    #scannerManualRow { padding: 0 16px 14px; display: flex; gap: 8px; }
    #scannerManualInput { flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; margin-top: 0; }
    #scannerManualInput::placeholder { color: #64748b; }
    #scannerManualInput:focus { border-color: #38bdf8; box-shadow: none; }
    #scannerConfirmBtn { width: auto; padding: 10px 18px; background: #2563eb; margin-top: 0; white-space: nowrap; }

    /* ════════ SETTINGS / INFO PAGES ════════ */
    .page-title { font-size: 18px; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
    .page-title i { color: #2563eb; }
    .page-sub { color: #64748b; font-size: 13px; margin-bottom: 14px; }
    .info-p { font-size: 14px; line-height: 1.7; color: #334155; margin-bottom: 12px; }
    .info-h { font-size: 14px; font-weight: 700; color: #0f172a; margin: 18px 0 6px; }
    .info-list { margin: 0 0 12px 20px; font-size: 14px; line-height: 1.8; color: #334155; }
    .wa-btn { background: #16a34a; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px; font-size: 15px; border-radius: 10px; }
    .wa-btn:hover:not(:disabled) { background: #15803d; }
    .up-hero { background: linear-gradient(135deg,#0f172a,#1e3a5f); color: white; border-radius: 14px; padding: 22px 18px; margin-bottom: 16px; }
    .up-hero h3 { font-size: 20px; margin-bottom: 6px; }
    .up-hero p { font-size: 13px; color: #cbd5e1; line-height: 1.6; }
    .up-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-bottom: 16px; }
    .up-feat { display: flex; align-items: flex-start; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; font-size: 13px; color: #334155; }
    .up-feat i { color: #059669; font-size: 16px; margin-top: 2px; }
    .up-feat b { display: block; color: #0f172a; margin-bottom: 2px; }

    /* ════════ GROUPED SALES ════════ */
    .grouped-sales-block { border: 1px solid #f1f5f9; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
    .grouped-sales-header { background: #f8fafc; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; }
    .grouped-sales-header strong { font-size: 13px; color: #0f172a; }
    .grouped-sales-block table { margin-top: 0; }
    .grouped-sales-block th, .grouped-sales-block td { font-size: 11px; }
    .grouped-date-block { margin-bottom: 18px; }
    .grouped-date-header {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 6px 16px; padding: 10px 14px; border-radius: 8px; background: #f0fdf4; margin-bottom: 8px;
      border: 1px solid #bbf7d0;
    }
    .grouped-date-title { color: #15803d; font-weight: 700; font-size: 14px; }
    .grouped-date-stats { display: flex; gap: 14px; font-size: 12px; font-weight: 700; flex-wrap: wrap; }
    .grouped-date-sales { color: #ca8a04; }
    .grouped-date-profit { color: #000000; }

    /* ════════ FINTECH THEME — visual layer only (appended; overrides earlier rules) ════════ */
    :root { --primary:#09874a; --primary-dark:#06683a; --primary-soft:#e8f5ee; --ink:#10231a; --muted:#5f7068; --line:#e3e9e5; --bg:#f3f6f4; --shadow:0 1px 2px rgba(16,35,26,.05),0 8px 24px rgba(16,35,26,.07); }
    html { -webkit-text-size-adjust:100%; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background:var(--bg); color:var(--ink); line-height:1.45; -webkit-tap-highlight-color:transparent; }
    input, select, textarea { border:1px solid var(--line); border-radius:12px; padding:12px 14px; background:#fff; color:var(--ink); }
    input::placeholder, textarea::placeholder { color:#8a9a92; }
    input:focus, select:focus, textarea:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(9,135,74,.15); }
    button { background:var(--primary); border-radius:12px; min-height:46px; letter-spacing:.2px; }
    button:hover:not(:disabled) { background:var(--primary-dark); }
    .scan-btn { min-height:46px; height:46px; width:46px; min-width:46px; border-radius:12px; }
    #scannerCloseBtn { min-height:32px; }
    #scannerConfirmBtn { min-height:46px; }
    [style*="color:#2563eb"] { color:var(--primary) !important; }
    .card { border-radius:18px; box-shadow:var(--shadow); }
    .card h3 { font-size:16px; font-weight:700; color:var(--ink); }
    label.lbl, .modal-content label { color:var(--muted); font-weight:600; }
    .header { background:linear-gradient(135deg,var(--primary),var(--primary-dark)); padding:12px 16px; padding-top:calc(12px + env(safe-area-inset-top)); font-size:16px; letter-spacing:.8px; box-shadow:0 2px 12px rgba(6,104,58,.25); }
    .main-content { padding-bottom:100px; }
    .bottom-nav { border-top:none; border-radius:20px 20px 0 0; box-shadow:0 -6px 24px rgba(16,35,26,.10); padding:8px 0 calc(10px + env(safe-area-inset-bottom)); }
    .nav-item { color:#7b8a83; font-weight:500; }
    .nav-item i { width:48px; margin:0 auto 2px; padding:5px 0; border-radius:14px; font-size:19px; transition:background .2s,color .2s; }
    .nav-item.active { font-weight:700; }
    .nav-item.active, .nav-item.active i { color:var(--primary); }
    .nav-item.active i { background:var(--primary-soft); }
    .nav-item:active i { transform:scale(.94); }
    .grid-3 { grid-template-columns:1fr 1fr; }
    .grid-3 .stat-card:first-child { grid-column:1 / -1; }
    .stat-card { text-align:left; padding:16px; border-radius:16px; font-size:12px; font-weight:500; opacity:.98; }
    .stat-card strong { display:block; font-size:20px; margin-top:4px; word-break:break-word; }
    .blue   { background:linear-gradient(135deg,#09874a,#06683a); }
    .green  { background:linear-gradient(135deg,#0f8f83,#0b6e66); }
    .orange { background:linear-gradient(135deg,#27453a,#10231a); }
    .qa-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
    .qa-item { display:flex; flex-direction:column; align-items:center; gap:7px; padding:12px 4px; border-radius:14px; background:var(--primary-soft); color:var(--ink); font-size:11px; font-weight:600; text-align:center; cursor:pointer; transition:transform .1s,background .2s; user-select:none; }
    .qa-item i { width:38px; height:38px; display:flex; align-items:center; justify-content:center; border-radius:12px; background:#fff; color:var(--primary); font-size:16px; box-shadow:0 1px 3px rgba(16,35,26,.08); }
    .qa-item:active { transform:scale(.96); background:#d6eee1; }
    table { font-size:13px; }
    th { background:#f6f9f7; color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.4px; font-weight:700; }
    th, td { border-bottom:1px solid var(--line); }
    tr:hover td { background:#f8fbf9; }
    #reportPrintArea { overflow-x:auto; }
    @media (max-width:767px) { #repSalesTable th, #repSalesTable td, #repPurchaseTable th, #repPurchaseTable td { font-size:10.5px; padding:6px 4px; } }
    .grouped-sales-block { border-color:var(--line); border-radius:12px; }
    .grouped-sales-header { background:#f6f9f7; }
    .grouped-date-header { background:var(--primary-soft); border-color:#c6e6d4; }
    .grouped-date-title { color:var(--primary-dark); }
    .page-title { color:var(--ink); }
    .page-title i { width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px; background:var(--primary-soft); color:var(--primary); font-size:15px; }
    .page-sub { color:var(--muted); }
    .info-p, .info-list { color:#33463c; }
    .up-hero { background:linear-gradient(135deg,var(--primary-dark),#0b2a1d); border-radius:18px; }
    .up-feat { background:#f6f9f7; border-color:var(--line); border-radius:14px; }
    .up-feat i { color:var(--primary); }
    .modal { background:rgba(10,25,18,.5); }
    .modal-content { width:92%; border-radius:20px; margin:6vh auto; box-shadow:0 20px 50px rgba(0,0,0,.25); }
    #moreMenu { border-radius:16px; border-color:var(--line); box-shadow:0 12px 40px rgba(16,35,26,.22); }
    .more-item { padding:13px 18px; }
    .more-item i { color:var(--primary); }
    .more-item:hover { background:var(--primary-soft); }
    .more-item:active { background:#d6eee1; }
    .more-item.static, .more-item.static:hover { background:transparent; }
    .toast { background:var(--ink); border-radius:12px; }
    .toast.success { background:var(--primary-dark); }
    .view-item-label { color:var(--muted); }
    .badge-ok { background:var(--primary-soft); color:var(--primary-dark); }
    .select2-container--default .select2-selection--single { height:46px; border:1px solid var(--line); border-radius:12px; }
    .select2-container--default .select2-selection--single .select2-selection__rendered { line-height:44px; padding-left:14px; color:var(--ink); }
    .select2-container--default .select2-selection--single .select2-selection__arrow { height:44px; }
    .select2-dropdown { border-color:var(--line); border-radius:12px; overflow:hidden; }
    .select2-container--default .select2-results__option--highlighted[aria-selected], .select2-container--default .select2-results__option--highlighted.select2-results__option--selectable { background:var(--primary); }
    .sidebar { background:#0b1f17; }
    .sidebar-logo span { color:#4ade9a; }
    .sidebar-nav-item.active { background:rgba(9,135,74,.28); color:#7ee0ab; border-left-color:#22c97a; }
    .desktop-topbar { border-bottom-color:var(--line); }
    @media (min-width:560px) { .grid-3 { grid-template-columns:repeat(3,1fr); } .grid-3 .stat-card:first-child { grid-column:auto; } }
    @media (min-width:768px) {
      .card { padding:22px 24px; border-radius:20px; }
      .stat-card { padding:22px 20px; font-size:13px; }
      .stat-card strong { font-size:22px; }
      .qa-grid { max-width:520px; }
      .modal-content { margin:8vh auto; }
    }
    .bk-auto { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:600; color:var(--muted); white-space:nowrap; margin-top:3px; }
    .bk-sw { position:relative; width:42px; height:24px; border-radius:999px; background:#c3cdc8; cursor:pointer; transition:background .2s; flex-shrink:0; }
    .bk-sw::after { content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,.25); }
    .bk-sw.on { background:var(--primary); }
    .bk-sw.on::after { transform:translateX(18px); }
    .bk-sw.busy { opacity:.6; pointer-events:none; }
    .bk-sw:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
    button, .qa-item, .nav-item, .more-item, .sidebar-nav-item { touch-action:manipulation; }
    @media (prefers-reduced-motion:reduce) { * { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
  </style>
</head>
<body>

<div id="toastContainer"></div>

<!-- ══════════ MAIN APP SHELL ══════════ -->
<div id="appShell">

  <!-- Sidebar (tablet/desktop) -->
  <div class="sidebar" id="sidebar">
    <div class="sidebar-logo">⬡ <span id="sidebarBizName">Ekambani</span></div>
    <div class="sidebar-nav" id="sidebarNav">
      <div class="sidebar-nav-item active" data-view="homeView"     onclick="showView('homeView')">     <i class="fas fa-home"></i> Home</div>
      <div class="sidebar-nav-item"        data-view="purchaseView" onclick="showView('purchaseView')"> <i class="fas fa-box"></i> Purchase</div>
      <div class="sidebar-nav-item"        data-view="salesView"    onclick="showView('salesView')">    <i class="fas fa-cart-shopping"></i> Sales</div>
      <div class="sidebar-nav-item"        data-view="reportView"   onclick="showView('reportView')">   <i class="fas fa-file-invoice"></i> Reports</div>
      <div class="sidebar-nav-item"        data-view="more"         onclick="toggleMore(this)">         <i class="fas fa-ellipsis"></i> More</div>
    </div>
    <div class="sidebar-footer">Data is stored on this device</div>
  </div>

  <!-- Main wrapper -->
  <div class="main-wrapper">
    <div class="header">
      <div class="header-title" id="mobileHeaderTitle">EKAMBANI</div>
    </div>
    <div class="desktop-topbar" id="desktopTopbar">
      <span id="desktopViewTitle" style="font-weight:600;color:#1e293b;margin-right:auto;font-size:15px">Home</span>
      <span style="font-size:12px;margin-left:12px">
        <i class="fas fa-circle" style="color:#22c55e;font-size:8px;margin-right:4px"></i>
        Ready
      </span>
    </div>

    <div class="main-content">

      <!-- HOME -->
      <div id="homeView" class="view active">
        <div class="card">
          <div class="flex">
            <select id="dashMonth" onchange="runDashReport()"></select>
            <select id="dashYear"  onchange="runDashReport()"></select>
          </div>
        </div>
        <div id="dashStatsWrapper">
          <div class="grid-3">
            <div class="stat-card blue">Sales<br><strong>KSH <span id="dashSales">0</span></strong></div>
            <div class="stat-card green">Profit<br><strong>KSH <span id="dashProfit">0</span></strong></div>
            <div class="stat-card orange">Stock Val<br><strong>KSH <span id="dashStock">0</span></strong></div>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom:10px">Quick Actions</h3>
          <div class="qa-grid">
            <div class="qa-item" onclick="openModal()"><i class="fas fa-plus"></i>Add Item</div>
            <div class="qa-item" onclick="showView('purchaseView')"><i class="fas fa-box"></i>Stock</div>
            <div class="qa-item" onclick="showView('reportView')"><i class="fas fa-chart-pie"></i>Reports</div>
            <div class="qa-item" onclick="showView('backupView')"><i class="fas fa-cloud-arrow-up"></i>Back Up</div>
          </div>
          <button onclick="showView('salesView')">
            <i class="fas fa-plus"></i> New Sale
          </button>
          <h3 style="margin-top:20px;margin-bottom:6px">Filtered Sales Summary</h3>
          <div style="overflow-x:auto">
            <table>
              <thead><tr><th>Item</th><th>Selling Price</th><th class="profit-col">Profit</th><th>Total</th></tr></thead>
              <tbody id="dashSummaryTable"></tbody>
              <tfoot id="dashSummaryFoot" style="font-weight:bold;background:#f8fafc;"></tfoot>
            </table>
          </div>
        </div>
        <div class="card" id="groupedSalesCard">
          <h3 style="margin-bottom:2px">Sales by Date &amp; Person</h3>
          <p style="color:#64748b;font-size:12px;margin-bottom:10px">Grouped by date, then by who made the sale, with daily profit tracking.</p>
          <div id="groupedSalesContainer"></div>
        </div>
      </div>

      <!-- PURCHASE -->
      <div id="purchaseView" class="view">
        <div class="card">
          <button onclick="openModal()"><i class="fas fa-plus"></i> Add New Item</button>
          <input type="text" id="purSearch" placeholder="Search Item, Category or Barcode..." onkeyup="filterPurchase()" style="margin-top:12px">
          <div style="overflow-x:auto">
            <table>
              <thead><tr><th>Date</th><th>Item</th><th>Barcode</th><th>Cost</th><th>Stock</th><th>Action</th></tr></thead>
              <tbody id="purchaseTable"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SALES -->
      <div id="salesView" class="view">
        <div class="card">
          <h3 id="salesFormTitle" style="margin-bottom:10px">New Sale</h3>
          <input type="date" id="saleDate">
          <div class="imei-row" style="align-items:center;margin-top:0">
            <div style="flex:1;min-width:0">
              <select id="saleItem" style="width:100%;margin-top:6px;"><option value="">Select Item...</option></select>
            </div>
            <button class="scan-btn" style="margin-top:6px" onclick="openScanner(null,'sale')" title="Scan barcode / QR code"><i class="fas fa-qrcode"></i></button>
          </div>
          <div class="flex" style="margin-top:0">
            <input type="number" id="saleQty"   placeholder="Qty"   min="1">
            <input type="number" id="salePrice" placeholder="Price" min="0">
          </div>
          <button onclick="addToCart()" style="background:#64748b"><i class="fas fa-cart-plus"></i> Add to Cart</button>
          <div style="margin-top:14px;border-top:1px solid #f1f5f9;padding-top:10px">
            <strong>Cart Items:</strong>
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead>
              <tbody id="cartTable"></tbody>
            </table>
            <h3 style="text-align:right;margin-top:8px">Total: KSH <span id="grandTotal">0</span></h3>
          </div>
          <div class="flex">
            <input type="text" id="custName" placeholder="Customer Name">
            <button onclick="$('#moreModal').show()" style="width:80px;background:#64748b">More</button>
          </div>
          <input type="text" id="custPhone" placeholder="Phone">
          <button onclick="completeSale()" id="btnCompleteSale" style="margin-top:12px">
            <i class="fas fa-check-circle"></i> Complete Sale &amp; Print
          </button>
          <button onclick="resetSalesForm()" id="btnCancelEdit" style="margin-top:6px;background:#94a3b8;display:none;">
            <i class="fas fa-times"></i> Cancel Edit
          </button>
        </div>
        <div class="card">
          <h3 style="margin-bottom:8px">Sales Records</h3>
          <input type="text" id="saleSearch" placeholder="Search Invoice, Item, Customer..." onkeyup="filterSales()">
          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr><th>Date</th><th>Invoice</th><th>Items</th><th>Total</th><th>Customer</th><th>Phone</th><th>Method</th><th>Actions</th></tr>
              </thead>
              <tbody id="salesTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- REPORTS -->
      <div id="reportView" class="view">
        <div class="card">
          <div class="flex">
            <select id="repMonth"></select>
            <select id="repYear"></select>
          </div>
          <select id="repItem" style="width:100%;margin-top:6px;"><option value="">All Items</option></select>
          <select id="repPayFilter" style="margin-top:6px;">
            <option value="">All Payment Methods</option>
            <option value="KSH">KSH</option>
            <option value="M-Pesa">M-Pesa</option>
            <option value="Till">Till</option>
          </select>
          <div class="flex" style="margin-top:10px">
            <button id="btnRunReport" onclick="runReport()"><i class="fas fa-chart-bar"></i> Preview Report</button>
            <button id="repDownloadBtn" onclick="downloadPDF()"><i class="fas fa-download"></i> Download PDF</button>
          </div>
        </div>
        <div id="reportPrintArea" class="card">
          <div id="reportHeader" style="text-align:center;display:none;"><h2>EKAMBANI INVENTORY REPORT</h2><hr></div>
          <h4>Summary</h4>
          <p style="margin-top:6px">Total Sales: KSH <span id="repTotalSales">0</span></p>
          <p>Total Profit: KSH <span id="repTotalProfit">0</span></p>
          <p>Total Purchases Value: KSH <span id="repTotalPurchases">0</span></p>
          <div class="rep-section-title">Sales Transactions</div>
          <table id="repSalesTable">
            <thead><tr><th>Date</th><th>Invoice</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th>Profit</th><th>Customer</th><th>Method</th></tr></thead>
            <tbody></tbody>
          </table>
          <div class="rep-section-title">Purchases / Stock Updates</div>
          <table id="repPurchaseTable">
            <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Cost Price</th><th>Stock Qty</th><th>Stock Value</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- BUSINESS SETTINGS (More → Business Settings) -->
      <div id="bizView" class="view">
        <div class="card">
          <h3 style="margin-bottom:10px">Business Settings</h3>
          <label class="lbl" style="margin-top:0">Logo URL</label><input type="text" id="bizLogo" placeholder="https://...">
          <label class="lbl">Business Name</label><input type="text" id="bizName" placeholder="Business Name">
          <label class="lbl">Name (Sold by)</label><input type="text" id="bizSoldBy" placeholder="Your name — shown as who made the sale">
          <label class="lbl">Phone</label><input type="text" id="bizPhone" placeholder="Phone">
          <label class="lbl">Address</label><input type="text" id="bizAddr" placeholder="Address">
          <label class="lbl">Description</label><textarea id="bizDesc" placeholder="Description" style="height:70px;resize:vertical;"></textarea>
          <button id="btnSaveBiz" onclick="saveBizSettings()" style="margin-top:10px">
            <i class="fas fa-save"></i> Save Settings
          </button>
        </div>
      </div>

      <!-- ABOUT US -->
      <div id="aboutView" class="view">
        <div class="card">
          <div class="page-title"><i class="fas fa-circle-info"></i> About Us</div>
          <p class="page-sub">Simple sales and stock management for your business.</p>
          <p class="info-p">EKAMBANI POS helps businesses manage their daily sales and products in an easy and organized way.</p>
          <div class="info-h">What you can do</div>
          <ul class="info-list">
            <li>Add and manage your products, with prices and stock levels</li>
            <li>Record sales quickly, search for an item or scan its barcode</li>
            <li>Print invoices and keep track of who made each sale</li>
            <li>See daily sales, profit and stock value on your Home page</li>
            <li>Create reports by month, year, item or payment method</li>
          </ul>
          <p class="info-p">Your information is saved on your own device, so the app is quick and simple to use. We built EKAMBANI POS to make everyday record-keeping less stressful for small and growing businesses.</p>
        </div>
      </div>

      <!-- PRIVACY POLICY -->
      <div id="privacyView" class="view">
        <div class="card">
          <div class="page-title"><i class="fas fa-shield-halved"></i> Privacy Policy</div>
          <p class="page-sub">Short, clear and honest.</p>
          <div class="info-h">Your data stays with you</div>
          <p class="info-p">EKAMBANI POS saves your products, barcodes, sales, customer details, receipts and business settings on your own device, inside your browser's local storage (IndexedDB). We do not upload this information to a server.</p>
          <div class="info-h">What is stored</div>
          <ul class="info-list">
            <li>Product details, prices, stock and optional barcodes</li>
            <li>Sales records, including customer name and phone number if you type them in</li>
            <li>Your business name, contact details and the name shown as "Sold by"</li>
          </ul>
          <div class="info-h">You are in control</div>
          <p class="info-p">You can view, edit or delete your records inside the app at any time. Clearing your browser's site data will also remove everything stored by the app on that device, so keep that in mind before you do it.</p>
          <div class="info-h">Camera</div>
          <p class="info-p">The camera is used only when you tap a scanner icon to read a barcode or QR code. Images are not saved or sent anywhere. If you decline camera access, the app keeps working and you can type codes by hand.</p>
          <div class="info-h">Contact information</div>
          <p class="info-p">If you choose to contact us or request an upgrade through WhatsApp, the details you enter (such as your business name and phone number) are shared only through that WhatsApp message, and only because you sent them.</p>
          <div class="info-h">No unnecessary collection</div>
          <p class="info-p">We do not ask you to create an account and we do not collect personal information we do not need.</p>
          <div class="info-h">Updates</div>
          <p class="info-p">We may update this policy from time to time. Any changes will appear on this page.</p>
        </div>
      </div>

      <!-- CONTACT US -->
      <div id="contactView" class="view">
        <div class="card">
          <div class="page-title"><i class="fas fa-headset"></i> Contact Us</div>
          <p class="page-sub">Questions, help or feedback? We would love to hear from you.</p>
          <p class="info-p">Tap the button below to chat with us directly on WhatsApp.</p>
          <button class="wa-btn" onclick="contactWhatsApp()"><i class="fab fa-whatsapp" style="font-size:22px"></i> WhatsApp</button>
        </div>
      </div>

      <!-- UPGRADE -->
      <div id="upgradeView" class="view">
        <div class="card">
          <div class="up-hero">
            <h3><i class="fas fa-rocket" style="margin-right:8px;color:#38bdf8"></i>Upgrade to POS + Finance</h3>
            <p>The paid version gives you the complete POS and Finance System, built for businesses that want more control and more peace of mind.</p>
          </div>
          <div class="up-grid">
            <div class="up-feat"><i class="fas fa-user-shield"></i><div><b>Admin control</b>Stay in charge of your business.</div></div>
            <div class="up-feat"><i class="fas fa-users-gear"></i><div><b>Roles</b>Give each person the right level of access.</div></div>
            <div class="up-feat"><i class="fas fa-user-tag"></i><div><b>Sales by</b>See exactly who made each sale.</div></div>
            <div class="up-feat"><i class="fas fa-right-to-bracket"></i><div><b>Login</b>Secure sign-in for you and your team.</div></div>
            <div class="up-feat"><i class="fas fa-lock"></i><div><b>Data protection</b>Safer, better-managed business data.</div></div>
            <div class="up-feat"><i class="fas fa-chart-pie"></i><div><b>Finance system</b>Track income and expenses together with your POS.</div></div>
            <div class="up-feat"><i class="fas fa-ban"></i><div><b>No ads</b>A clean, distraction-free experience.</div></div>
            <div class="up-feat"><i class="fas fa-star"></i><div><b>More advanced features</b>And more tools as we keep growing.</div></div>
          </div>
          <h3 style="margin-bottom:4px">Ready to upgrade?</h3>
          <p class="page-sub" style="margin-bottom:6px">Fill in your details and we will continue on WhatsApp.</p>
          <label class="lbl" style="margin-top:0">Business Name</label>
          <input type="text" id="upBizName" placeholder="e.g. ABC Electronics Shop">
          <label class="lbl">Phone Number</label>
          <input type="tel" id="upPhone" placeholder="e.g. 07XX XXX XXX">
          <button class="wa-btn" style="margin-top:14px" onclick="upgradeWhatsApp()"><i class="fab fa-whatsapp" style="font-size:22px"></i> WhatsApp Direct</button>
          <button type="button" style="margin-top:10px;background:#0f172a" onclick="openSubscriptionRenewal()"><i class="fas fa-rotate"></i> Renew Subscription</button>
        </div>
      </div>

      <!-- BACK UP (More → Back Up) — optional Google Drive backup -->
      <div id="backupView" class="view">
        <div class="card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div class="page-title"><i class="fas fa-cloud-arrow-up"></i> Back Up</div>
            <div class="bk-auto"><span>Automatic Backup</span><div id="bkAutoSwitch" class="bk-sw" role="switch" aria-checked="false" aria-label="Automatic Backup" tabindex="0" onclick="bkToggleAuto()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();bkToggleAuto();}"></div></div>
          </div>
          <p class="page-sub">Optional Google Drive backup. The app works fully without it.</p>
          <div id="bkStatus" class="info-p"></div>
          <button id="btnBkConnect" onclick="bkConnect()" style="display:none"><i class="fab fa-google"></i> Connect Google Account</button>
          <div id="bkFolderLocked" style="display:none">
            <label class="lbl">Backup folder (saved permanently)</label>
            <div class="info-p" style="background:#f6f9f7;border:1px solid #e3e9e5;border-radius:12px;padding:12px 14px;margin:6px 0 0;word-break:break-word"><i class="fas fa-lock" style="color:#09874a;margin-right:8px"></i><strong id="bkFolderNameText"></strong></div>
          </div>
          <div id="bkFolderBox" style="display:none">
            <label class="lbl">Backup folder name</label>
            <input type="text" id="bkFolderName" placeholder="e.g. My Business Backup">
            <button id="btnBkFolder" onclick="bkSetFolder()" style="margin-top:8px"><i class="fas fa-folder-plus"></i> Save Folder</button>
          </div>
          <div id="bkActions" style="display:none">
            <div id="bkAutoHint" class="page-sub" style="display:none;margin:10px 0 0"><i class="fas fa-circle-info"></i> Automatic backup is ON. Tapping Manual Backup turns it OFF first, then backs up once.</div>
            <button id="btnBkManual" onclick="bkManual()" style="margin-top:12px"><i class="fas fa-cloud-arrow-up"></i> Manual Backup</button>
            <button id="btnBkRestore" onclick="bkRestore()" style="margin-top:8px;background:#0f172a"><i class="fas fa-cloud-arrow-down"></i> Restore</button>
          </div>
          <button id="btnBkDisc" onclick="bkDisconnect()" style="margin-top:8px;background:#94a3b8;display:none"><i class="fas fa-link-slash"></i> Disconnect</button>
        </div>
      </div>

    </div><!-- /main-content -->
  </div><!-- /main-wrapper -->

  <!-- Mobile bottom nav -->
  <div class="bottom-nav" id="mainBottomNav">
    <div class="nav-item active" data-view="homeView"     onclick="showView('homeView')">     <i class="fas fa-home"></i>Home</div>
    <div class="nav-item"        data-view="purchaseView" onclick="showView('purchaseView')"> <i class="fas fa-box"></i>Purchase</div>
    <div class="nav-item"        data-view="salesView"    onclick="showView('salesView')">    <i class="fas fa-cart-shopping"></i>Sales</div>
    <div class="nav-item"        data-view="reportView"   onclick="showView('reportView')">   <i class="fas fa-file-invoice"></i>Reports</div>
    <div class="nav-item"        data-view="more"         onclick="toggleMore(this)">         <i class="fas fa-ellipsis"></i>More</div>
  </div>
</div><!-- /appShell -->

<!-- ══════════ MORE DROPDOWN ══════════ -->
<div id="moreBackdrop" onclick="closeMore()"></div>
<div id="moreMenu">
  <div class="more-item" onclick="moreGo('bizView')">      <i class="fas fa-store"></i> Business Settings</div>
  <div class="more-item" onclick="moreGo('aboutView')">    <i class="fas fa-circle-info"></i> About Us</div>
  <div class="more-item" onclick="moreGo('privacyView')">  <i class="fas fa-shield-halved"></i> Privacy Policy</div>
  <div class="more-item" onclick="openVideoGuide()">       <i class="fab fa-youtube"></i> Video Guide</div>
  <div class="more-item" onclick="moreGo('contactView')">  <i class="fas fa-headset"></i> Contact Us</div>
  <div class="more-item" onclick="moreGo('upgradeView')">  <i class="fas fa-rocket"></i> Upgrade</div>
  <div class="more-item" onclick="moreGo('backupView')">   <i class="fas fa-cloud-arrow-up"></i> Back Up</div>
  <div class="more-item static"><i class="fas fa-bolt"></i> Power by Ekambani</div>
</div>

<!-- ══════════ MODALS ══════════ -->
<div class="modal" id="itemModal">
  <div class="modal-content">
    <h3 id="modalTitle">Item Details</h3>
    <input type="hidden" id="itemId">
    <label>Item Name *</label><input type="text" id="itemName" placeholder="Item Name">
    <label>Category *</label><input type="text" id="itemCat" placeholder="Category">
    <label>Barcode <span style="color:#64748b;font-weight:400;font-size:11px">(optional)</span></label>
    <div class="imei-row">
      <input type="text" id="itemBarcode" placeholder="Type or scan barcode">
      <button class="scan-btn" onclick="openScanner('itemBarcode','field')" title="Scan barcode"><i class="fas fa-barcode"></i></button>
    </div>
    <div class="flex">
      <div style="flex:1"><label>Cost Price *</label><input type="number" id="costPrice" placeholder="Cost"></div>
      <div style="flex:1"><label>Sell Price *</label><input type="number" id="sellPrice" placeholder="Sell"></div>
    </div>
    <div class="flex">
      <div style="flex:1"><label>New Cost Price <span style="color:#64748b;font-weight:400;font-size:11px">(optional — replaces Cost Price)</span></label><input type="number" id="newCostPrice" placeholder="Enter to update cost price"></div>
    </div>
    <div class="flex">
      <div style="flex:1"><label>Stock Qty *</label><input type="number" id="stockQty" placeholder="Stock"></div>
      <div style="flex:1"><label>Min Stock</label><input type="number" id="minStock" placeholder="Min Stock"></div>
    </div>
    <button id="btnSaveItem" onclick="saveItem()" style="margin-top:10px"><i class="fas fa-save"></i> Save</button>
    <button onclick="closeModal()" style="background:#ef4444;margin-top:6px"><i class="fas fa-times"></i> Cancel</button>
  </div>
</div>

<div class="modal" id="moreModal">
  <div class="modal-content">
    <h3>IMEI &amp; Payment</h3>
    <label>IMEI 1</label>
    <div class="imei-row">
      <input type="text" id="imei1" placeholder="IMEI 1">
      <button class="scan-btn" onclick="openScanner('imei1','field')" title="Scan IMEI 1"><i class="fas fa-barcode"></i></button>
    </div>
    <label>IMEI 2</label>
    <div class="imei-row">
      <input type="text" id="imei2" placeholder="IMEI 2">
      <button class="scan-btn" onclick="openScanner('imei2','field')" title="Scan IMEI 2"><i class="fas fa-barcode"></i></button>
    </div>
    <label>IMEI 3</label>
    <div class="imei-row">
      <input type="text" id="imei3" placeholder="IMEI 3">
      <button class="scan-btn" onclick="openScanner('imei3','field')" title="Scan IMEI 3"><i class="fas fa-barcode"></i></button>
    </div>
    <label>Payment Method</label>
    <select id="payMethod">
      <option value="KSH">KSH</option>
      <option value="M-Pesa">M-Pesa</option>
      <option value="Till">Till</option>
    </select>
    <button onclick="$('#moreModal').hide()" style="margin-top:10px">Done</button>
  </div>
</div>

<div class="modal" id="viewItemModal">
  <div class="modal-content">
    <h3 style="margin-bottom:14px"><i class="fas fa-box-open" style="color:#2563eb;margin-right:8px"></i>Item Details</h3>
    <div id="viewItemBody"></div>
    <button onclick="$('#viewItemModal').hide()" style="background:#0f172a;margin-top:16px">
      <i class="fas fa-times"></i> Close
    </button>
  </div>
</div>

<!-- Scanner overlay (barcode / QR / IMEI) -->
<div id="scannerOverlay">
  <div id="scannerBox">
    <div id="scannerHeader">
      <h3><i class="fas fa-barcode" style="color:#38bdf8;margin-right:8px"></i><span id="scannerTitle">Scan Barcode</span></h3>
      <button id="scannerCloseBtn" onclick="closeScanner()"><i class="fas fa-times"></i></button>
    </div>
    <div id="scannerViewport" style="width:100%;background:#000;min-height:240px;"></div>
    <div id="scannerStatus" style="padding:10px 16px;text-align:center;font-size:12px;color:#94a3b8;">Starting camera…</div>
    <div id="scannerManualRow">
      <input type="text" id="scannerManualInput" placeholder="Or type the code here…">
      <button id="scannerConfirmBtn" onclick="confirmManualScan()"><i class="fas fa-check"></i> Use</button>
    </div>
  </div>
</div>

<script>
/* ═══════════════════════════════════════════════════════
   ★★★  CONFIGURATION — REPLACE THESE VALUES  ★★★
   ═══════════════════════════════════════════════════════ */
// Full YouTube link for the Video Guide (More → Video Guide)
var VIDEO_GUIDE_URL = '';   // e.g. 'https://www.youtube.com/watch?v=XXXXXXXXXXX'

// WhatsApp numbers: country code + number, digits only, no "+" or spaces
var CONTACT_WHATSAPP_NUMBER = '';   // Contact Us button,  e.g. '254712345678'
var UPGRADE_WHATSAPP_NUMBER = '';   // Upgrade form button, e.g. '254712345678'

// Google Apps Script Subscription Renewal Web App URL (paste the deployed /exec URL here).
var SUBSCRIPTION_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbygf28HmWEkahhistu9uuRh9qrSW6bULqEsBaUWlxm6jtJvtjsfBRVK0nS8IwTdvsiUMg/exec';
/* ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   ★★★  GOOGLE DRIVE API CONFIGURATION — REPLACE LATER  ★★★
   This is a PLACEHOLDER. While CLIENT_ID still contains "YOUR_",
   only the Back Up page reports "not configured"; the rest of the
   app is not affected.

   How to get real values (Google Cloud Console):
     1. Create/choose a project and ENABLE the "Google Drive API".
     2. Configure the OAuth consent screen.
     3. Create credentials → "OAuth client ID" → type "Web application".
     4. Under "Authorized JavaScript origins" add the exact origin(s) you
        use, e.g. https://YOURNAME.github.io  and  http://localhost:8080
     5. Paste the Client ID below.
   Do NOT put a client secret here — this flow does not need one, and a
   secret must never be placed in frontend code.
   Scope "drive.file" only lets the app see files/folders it created itself.
   (Use the SAME Client ID on every device so a backup made on one device
   can be found on another.)
   ═══════════════════════════════════════════════════════ */
var GDRIVE_CONFIG = {
  CLIENT_ID: '91062929087-i8mhcncd17gg6fbfrfkuqidepga9j2eo.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.file',
  BACKUP_FILE_NAME: 'ekambani-pos-backup.json',
  GIS_SCRIPT_URL: 'https://accounts.google.com/gsi/client',   // loaded only when needed
  DRIVE_API: 'https://www.googleapis.com/drive/v3',
  DRIVE_UPLOAD_API: 'https://www.googleapis.com/upload/drive/v3',
  AUTO_BACKUP_DELAY_MS: 15000      // wait this long after the last change before auto backup
};
/* ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
let inventory          = [];
let allSalesRecords    = [];
let cart               = [];
let editMode           = false;
let currentEditInvoice = null;
let bizSettings        = { key:'business', name:'', phone:'', address:'', desc:'', logo:'', soldBy:'' };

/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */
function toast(msg, type='success', duration=3200) {
  const icons = { success:'fas fa-check-circle', error:'fas fa-circle-exclamation', warning:'fas fa-triangle-exclamation', info:'fas fa-info-circle' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<i class="${icons[type]||icons.info}"></i> ${esc(msg)}`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => { t.classList.add('hiding'); setTimeout(() => t.remove(), 350); }, duration);
}
function btnLoad(id, text) {
  const b = document.getElementById(id); if (!b) return;
  b._originalHTML = b.innerHTML; b.disabled = true;
  b.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
}
function btnReset(id) {
  const b = document.getElementById(id); if (!b) return;
  b.disabled = false; if (b._originalHTML) b.innerHTML = b._originalHTML;
}
function esc(str) {
  return (str === undefined || str === null ? '' : str).toString()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/* Subscription identity: one automatically generated ID per browser profile.
   This is a browser ID, not a guaranteed hardware/IMEI identifier. */
const EKAMBANI_DEVICE_ID_KEY = 'ekambani_pos_device_id_v1';
function getEkambaniDeviceId() {
  try {
    let id = localStorage.getItem(EKAMBANI_DEVICE_ID_KEY);
    if (!id) {
      id = 'EK-' + uuid().replace(/-/g, '').toUpperCase();
      localStorage.setItem(EKAMBANI_DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) {
    // Do not silently create a changing ID: renewal must be unavailable if storage is blocked.
    console.error('Device ID storage is unavailable:', e);
    return '';
  }
}
function openSubscriptionRenewal() {
  const base = (SUBSCRIPTION_WEB_APP_URL || '').trim();
  if (!base || base.indexOf('PASTE_YOUR_') !== -1) {
    toast('Subscription renewal is not configured yet. Add the Apps Script Web App URL.', 'warning', 6000);
    return;
  }
  const deviceId = getEkambaniDeviceId();
  if (!deviceId) {
    toast('Could not read or save this browser Device ID. Enable site storage and reload.', 'error', 6000);
    return;
  }
  const url = new URL(base);
  url.searchParams.set('deviceId', deviceId);
  window.open(url.toString(), '_blank', 'noopener');
}
function getLocalDateStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function parseYMDLocal(s) {
  if (!s) return null;
  const p = String(s).split('-');
  if (p.length !== 3) return null;
  const y = parseInt(p[0],10), m = parseInt(p[1],10), d = parseInt(p[2],10);
  if (isNaN(y)||isNaN(m)||isNaN(d)) return null;
  return new Date(y, m-1, d);
}
function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString() : ''; }

/* ═══════════════════════════════════════
   INDEXEDDB LAYER
═══════════════════════════════════════ */
const DB_NAME = 'EkambaniPOS';
const DB_VERSION = 1;
const DB_STORES = ['items', 'sales', 'customers', 'settings'];
let db = null;
let _dbInit = null;                 // single shared init promise (prevents duplicate/racing init)
let _saleBusy = false, _itemBusy = false;   // double-click / retry guards

function createStores(d) {
  if (!d.objectStoreNames.contains('items')) {
    const s = d.createObjectStore('items', { keyPath: 'id' });
    s.createIndex('barcode', 'barcode', { unique: false });
    s.createIndex('itemName', 'itemName', { unique: false });
  }
  if (!d.objectStoreNames.contains('sales')) {
    const s = d.createObjectStore('sales', { keyPath: 'id' });
    s.createIndex('invoice', 'invoice', { unique: false });
    s.createIndex('date', 'date', { unique: false });
    s.createIndex('itemId', 'itemId', { unique: false });
  }
  if (!d.objectStoreNames.contains('customers')) {
    const s = d.createObjectStore('customers', { keyPath: 'id' });
    s.createIndex('phone', 'phone', { unique: false });
  }
  if (!d.objectStoreNames.contains('settings')) {
    d.createObjectStore('settings', { keyPath: 'key' });
  }
}

function openDBVersion(version) {
  return new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IndexedDB is not supported in this browser.')); return; }
    let r;
    try { r = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME); }
    catch (e) { reject(e); return; }
    // createStores only ADDS missing stores/indexes; it never clears or deletes existing data.
    r.onupgradeneeded = function() { createStores(r.result); };
    r.onsuccess = function() {
      const d = r.result;
      // Another tab is upgrading the database: close our connection so it is not blocked.
      d.onversionchange = function() {
        d.close(); if (db === d) db = null; _dbInit = null;
        toast('The database was updated in another tab. Please reload this page.', 'warning', 9000);
      };
      d.onclose = function() { if (db === d) db = null; _dbInit = null; };
      resolve(d);
    };
    r.onerror = function() { reject(r.error || new Error('Could not open the database.')); };
    // Blocked by another tab holding an older connection: keep waiting (it resolves once that tab closes/reloads).
    r.onblocked = function() { toast('Database update is waiting for other open Ekambani tabs. Please close them.', 'warning', 9000); };
  });
}

function initDB() {
  if (_dbInit) return _dbInit;
  _dbInit = (async function() {
    // Open at the database's CURRENT version (never force a lower one, which would fail with VersionError
    // after a self-heal upgrade). A brand-new database is created at DB_VERSION via onupgradeneeded.
    let d = await openDBVersion();
    // Self-heal: if any object store is missing, upgrade the database to create it (existing data is kept).
    if (DB_STORES.some(n => !d.objectStoreNames.contains(n))) {
      const next = d.version + 1;
      d.close();
      d = await openDBVersion(next);
    }
    db = d;
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch(e) {} }
    return db;
  })().catch(function(e) { _dbInit = null; throw e; });
  return _dbInit;
}

/* Friendly, honest messages for storage failures. */
function dbErrMsg(err, fallback) {
  const n = (err && err.name) || '', m = (err && err.message) || '';
  if (n === 'QuotaExceededError' || /quota/i.test(m)) return 'Device storage is full. Free some space, then try again.';
  if (n === 'InvalidStateError' || /not open|clos(ed|ing)/i.test(m)) return 'The database connection was closed. Please reload the page.';
  if (n === 'SecurityError') return 'This browser is blocking local storage. Check privacy / site-data settings.';
  if (n === 'VersionError') return 'The local database was created by a newer version. Please reload the page.';
  return fallback;
}

function reqP(r) {
  return new Promise(function(res, rej) { r.onsuccess = function() { res(r.result); }; r.onerror = function() { rej(r.error); }; });
}
function txDone(tx) {
  return new Promise(function(res, rej) {
    tx.oncomplete = function() { res(true); };
    tx.onerror = function() { rej(tx.error); };
    tx.onabort = function() { rej(tx.error || new Error('Transaction aborted')); };
  });
}
function dbTx(store, mode) {
  if (!db) throw new Error('The database is not open. Please reload the page.');
  return db.transaction(store, mode);
}
function dbAll(store)       { try { return reqP(dbTx(store, 'readonly').objectStore(store).getAll()); } catch (e) { return Promise.reject(e); } }
function dbGet(store, key)  { try { return reqP(dbTx(store, 'readonly').objectStore(store).get(key)); } catch (e) { return Promise.reject(e); } }
// Writes resolve only AFTER the transaction has committed (oncomplete), so "saved" is never reported early.
function dbPut(store, val)  { try { const tx = dbTx(store, 'readwrite'); tx.objectStore(store).put(val); return txDone(tx); } catch (e) { return Promise.reject(e); } }
function dbDelete(store, key) { try { const tx = dbTx(store, 'readwrite'); tx.objectStore(store).delete(key); return txDone(tx); } catch (e) { return Promise.reject(e); } }

/* ── Settings ── */
async function loadBizSettings() {
  try {
    const s = await dbGet('settings', 'business');
    if (s) bizSettings = Object.assign({ key:'business', name:'', phone:'', address:'', desc:'', logo:'', soldBy:'' }, s);
  } catch(e) { console.error(e); }
  applyBizName();
}
async function dbSaveSettings(obj) {
  bizSettings = Object.assign({}, bizSettings, obj, { key: 'business' });
  await dbPut('settings', bizSettings);
  applyBizName();
}
function applyBizName() {
  const n = bizSettings.name || 'Ekambani';
  $('#sidebarBizName').text(n);
  $('#mobileHeaderTitle').text(n.toUpperCase().substring(0, 20));
}

/* ── Items ── */
async function dbGetItems() {
  const items = await dbAll('items');
  items.sort((a, b) => (a.created || a.date || 0) - (b.created || b.date || 0));
  return items;
}
function dbSaveItem(d) {
  return new Promise(function(resolve, reject) {
    let result = { success: true };
    const tx = dbTx('items', 'readwrite'), st = tx.objectStore('items');
    tx.oncomplete = function() { resolve(result); };
    tx.onerror    = function() { reject(tx.error); };
    tx.onabort    = function() { if (result && result.error) resolve(result); else reject(tx.error || new Error('Transaction aborted')); };
    st.getAll().onsuccess = function(ev) {
      const items = ev.target.result;
      const barcode = (d.barcode || '').trim();
      if (barcode) {
        const dup = items.find(i => (i.barcode || '') === barcode && i.id !== d.id);
        if (dup) { result = { error: true, message: 'Barcode already used by "' + dup.itemName + '".' }; try { tx.abort(); } catch(e) {} return; }
      }
      const existing = d.id ? items.find(i => i.id === d.id) : null;
      let cost = Number(d.costPrice);
      if (d.newCostPrice !== undefined && d.newCostPrice !== null && d.newCostPrice !== '') {
        const ncp = Number(d.newCostPrice);
        if (!isNaN(ncp) && ncp > 0) cost = ncp;
      }
      st.put({
        id: d.id || uuid(),
        itemName: d.itemName, category: d.category, barcode: barcode,
        costPrice: cost, sellPrice: Number(d.sellPrice),
        stock: Number(d.stock), minStock: Number(d.minStock) || 0,
        date: Date.now(), created: existing ? (existing.created || existing.date) : Date.now(),
        newCostPrice: ''
      });
    };
  });
}

/* ── Sales (flat lines, one row per item sold) ── */
function dbSaveSale(d) {
  return new Promise(function(resolve, reject) {
    let result = null;
    const tx = dbTx(['items', 'sales', 'customers'], 'readwrite');
    const itemsS = tx.objectStore('items'), salesS = tx.objectStore('sales'), custS = tx.objectStore('customers');
    tx.oncomplete = function() { resolve(result); };
    tx.onerror    = function() { reject(tx.error); };
    tx.onabort    = function() {
      if (result && result.error) resolve(result);
      else reject(tx.error || new Error('Transaction aborted'));
    };
    function fail(msg) { result = { error: true, message: msg }; try { tx.abort(); } catch(e) {} }

    itemsS.getAll().onsuccess = function(ev) {
      const inv = {}, touched = {};
      ev.target.result.forEach(function(i) { inv[i.id] = i; });

      function proceed() {
        const qtyReq = {};
        d.items.forEach(function(it) { qtyReq[it.id] = (qtyReq[it.id] || 0) + Number(it.qty); });
        for (const id in qtyReq) {
          const rec = inv[id];
          if (!rec) return fail('Item not found. Please refresh.');
          const live = Number(rec.stock);
          if (live <= 0) return fail('Item "' + rec.itemName + '" is out of stock.');
          if (qtyReq[id] > live) return fail('Insufficient stock for "' + rec.itemName + '". Available: ' + live + ', Requested: ' + qtyReq[id] + '.');
        }
        const invoice = d.invoice || ('EK-' + Date.now());
        const saleDate = d.saleDate || getLocalDateStr(new Date());
        const lines = [];
        d.items.forEach(function(it) {
          const rec = inv[it.id];
          rec.stock = Number(rec.stock) - Number(it.qty);
          touched[it.id] = true;
          lines.push({
            id: uuid(), invoice: invoice, itemId: it.id, itemName: it.itemName,
            qty: Number(it.qty), price: Number(it.price), total: Number(it.total),
            profit: Number(it.total) - Number(rec.costPrice) * Number(it.qty),
            customerName: d.customerName || '', customerPhone: d.customerPhone || '',
            date: saleDate, imei1: d.imei1 || '', imei2: d.imei2 || '', imei3: d.imei3 || '',
            paymentMethod: d.paymentMethod || 'KSH', salesBy: d.salesBy || ''
          });
        });
        Object.keys(touched).forEach(function(id) { itemsS.put(inv[id]); });
        lines.forEach(function(l) { salesS.put(l); });
        const cn = (d.customerName || '').trim(), cp = (d.customerPhone || '').trim();
        if (cn || cp) {
          custS.put({ id: cp ? ('p:' + cp) : ('n:' + cn.toLowerCase()), name: cn, phone: cp, lastSale: saleDate });
        }
        const updatedInventory = Object.keys(inv).map(function(k) { return inv[k]; });
        result = { invoice: invoice, data: d, updatedInventory: updatedInventory };
      }

      if (d.isUpdate && d.invoice) {
        salesS.index('invoice').getAll(d.invoice).onsuccess = function(e2) {
          e2.target.result.forEach(function(l) {
            if (inv[l.itemId]) { inv[l.itemId].stock = Number(inv[l.itemId].stock) + Number(l.qty); touched[l.itemId] = true; }
            salesS.delete(l.id);
          });
          proceed();
        };
      } else {
        proceed();
      }
    };
  });
}

function dbDeleteInvoice(invoice) {
  return new Promise(function(resolve, reject) {
    const tx = dbTx(['items', 'sales'], 'readwrite');
    const itemsS = tx.objectStore('items'), salesS = tx.objectStore('sales');
    tx.oncomplete = function() { resolve(true); };
    tx.onerror = tx.onabort = function() { reject(tx.error || new Error('Delete failed')); };
    salesS.index('invoice').getAll(invoice).onsuccess = function(ev) {
      const lines = ev.target.result;
      const restore = {};
      lines.forEach(function(l) { restore[l.itemId] = (restore[l.itemId] || 0) + Number(l.qty); salesS.delete(l.id); });
      const ids = Object.keys(restore);
      ids.forEach(function(id) {
        itemsS.get(id).onsuccess = function(e2) {
          const rec = e2.target.result;
          if (rec) { rec.stock = Number(rec.stock) + restore[id]; itemsS.put(rec); }
        };
      });
    };
  });
}

/* ── Reports ── */
async function dbReport(month, year, itemId, salesByFilter) {
  const [lines, items] = await Promise.all([dbAll('sales'), dbAll('items')]);
  const totals = { sales: 0, profit: 0, stockVal: 0 };
  const sales = [], purchases = [];
  const sb = (salesByFilter || '').toString().trim().toLowerCase();
  lines.forEach(function(r) {
    const d = parseYMDLocal(r.date); if (!d) return;
    const okItem = !itemId || r.itemId === itemId;
    const okDate = (month == -1 || d.getMonth() == month) && d.getFullYear() == year;
    const okBy = !sb || (r.salesBy || '').toString().trim().toLowerCase() === sb;
    if (okItem && okDate && okBy) {
      totals.sales += Number(r.total); totals.profit += Number(r.profit);
      sales.push({
        id: r.id, invoice: r.invoice, itemId: r.itemId, item: r.itemName, qty: r.qty, price: r.price,
        total: r.total, profit: r.profit, customer: r.customerName, phone: r.customerPhone, date: r.date,
        imei1: r.imei1, imei2: r.imei2, imei3: r.imei3, payment: r.paymentMethod, salesBy: r.salesBy || ''
      });
    }
  });
  items.forEach(function(r) {
    totals.stockVal += Number(r.costPrice) * Number(r.stock);
    const d = new Date(r.date);
    if ((month == -1 || d.getMonth() == month) && d.getFullYear() == year) {
      purchases.push({ date: d.toLocaleDateString(), item: r.itemName, category: r.category, qty: r.stock, cost: r.costPrice });
    }
  });
  return { sales: sales, purchases: purchases, totals: totals };
}

/* ═══════════════════════════════════════
   LAYOUT / NAVIGATION
═══════════════════════════════════════ */
const VIEW_TITLES = {
  homeView:'Home', purchaseView:'Purchase', salesView:'Sales', reportView:'Reports',
  bizView:'Business Settings', aboutView:'About Us', privacyView:'Privacy Policy',
  contactView:'Contact Us', upgradeView:'Upgrade', backupView:'Back Up'
};
const MORE_VIEWS = ['bizView','aboutView','privacyView','contactView','upgradeView','backupView'];

function showView(id) {
  closeMore();
  $('.view').removeClass('active');
  $('#' + id).addClass('active');
  const navKey = MORE_VIEWS.indexOf(id) !== -1 ? 'more' : id;
  $('.nav-item,.sidebar-nav-item').removeClass('active');
  $('[data-view="' + navKey + '"]').addClass('active');
  $('#desktopViewTitle').text(VIEW_TITLES[id] || '');
  if (id === 'bizView') fillBizForm();
  if (id === 'backupView') { refreshBackupUI(); bkReloadState().then(function() { refreshBackupUI(); bkTrySilent(); }); }
  window.scrollTo({ top: 0 });
  $('.main-wrapper').scrollTop(0);
}

/* ── More dropdown ── */
function toggleMore(el) {
  if ($('#moreMenu').hasClass('open')) { closeMore(); return; }
  openMore(el);
}
function openMore(el) {
  const menu = $('#moreMenu');
  menu.addClass('open');
  const r = el.getBoundingClientRect();
  const mw = menu.outerWidth(), mh = menu.outerHeight();
  let left, top;
  if (window.innerWidth >= 768) {
    left = Math.min(r.right + 8, window.innerWidth - mw - 8);
    top  = Math.max(8, Math.min(r.top, window.innerHeight - mh - 8));
  } else {
    left = Math.max(8, Math.min(r.left + r.width / 2 - mw / 2, window.innerWidth - mw - 8));
    top  = Math.max(8, r.top - mh - 8);
  }
  menu.css({ left: left + 'px', top: top + 'px' });
  $('#moreBackdrop').addClass('open');
}
function closeMore() {
  $('#moreMenu').removeClass('open');
  $('#moreBackdrop').removeClass('open');
}
function moreGo(viewId) { showView(viewId); }
$(window).on('resize', closeMore);

/* ── Video Guide / WhatsApp ── */
function openVideoGuide() {
  closeMore();
  const url = (VIDEO_GUIDE_URL || '').trim();
  if (!url) { toast('Video guide coming soon.', 'info'); return; }
  window.open(url, '_blank', 'noopener');
}
function openWhatsApp(number, text) {
  const n = String(number || '').replace(/\D/g, '');
  if (!n) { toast('WhatsApp number has not been set yet.', 'warning'); return; }
  window.open('https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : ''), '_blank', 'noopener');
}
function contactWhatsApp() {
  openWhatsApp(0748949444, 'Hello, I need help with Ekambani POS.');
}
function upgradeWhatsApp() {
  const biz = $('#upBizName').val().trim(), phone = $('#upPhone').val().trim();
  if (!biz || !phone) { toast('Please enter your business name and phone number.', 'warning'); return; }
  openWhatsApp(0748949444,
    'Hello, I would like to upgrade to the POS + Finance System.\nBusiness Name: ' + biz + '\nPhone: ' + phone);
}

/* ═══════════════════════════════════════
   BOOT
═══════════════════════════════════════ */
function setupFilters() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const cm = new Date().getMonth(), cy = new Date().getFullYear();
  $('#dashMonth,#repMonth,#dashYear,#repYear').html('');
  months.forEach((m,i) => {
    $('#dashMonth').append(`<option value="${i}" ${i===cm?'selected':''}>${m}</option>`);
    $('#repMonth').append(`<option value="${i}">${m}</option>`);
  });
  $('#repMonth').prepend('<option value="-1">All Time</option>');
  for (let y = cy; y >= 2024; y--) {
    $('#dashYear,#repYear').append(`<option value="${y}" ${y===cy?'selected':''}>${y}</option>`);
  }
}

async function bootApp() {
  // Create and persist the browser Device ID before the app continues.
  // It is used only for the subscription renewal link; POS data remains in IndexedDB.
  getEkambaniDeviceId();
  try {
    await initDB();
  } catch (err) {
    console.error(err);
    Swal.fire('Storage unavailable', dbErrMsg(err, 'This browser could not open the local database: ' + (err && err.message ? err.message : err)) + ' Your saved data has not been changed. Try reloading; in private/incognito mode, use a normal window.', 'error');
    return;
  }
  await loadBizSettings();
  try { await bkInit(); } catch (e) { console.warn('Backup module init skipped:', e); }
  $('#saleItem').select2({ width:'100%', placeholder:'Select Item...' });
  $('#repItem').select2({ width:'100%', placeholder:'All Items' });
  document.getElementById('saleDate').value = getLocalDateStr(new Date());
  setupFilters();
  await loadInventory();
  runDashReport();
  fetchSalesRecords();
  $('#saleItem').on('change', function() {
    const itm = inventory.find(x => x.id === $(this).val());
    if (itm) { $('#salePrice').val(itm.sellPrice); $('#saleQty').val(1); }
  });
}
$(document).ready(bootApp);

/* ═══════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════ */
function formatGroupDateLabel(dateKey) {
  const dd = parseYMDLocal(dateKey);
  if (!dd) return dateKey;
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(yest.getDate()-1);
  if (dd.getTime() === today.getTime()) return 'Today';
  if (dd.getTime() === yest.getTime()) return 'Yesterday';
  return dd.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
}

function renderGroupedSales(salesArr) {
  const container = $('#groupedSalesContainer');
  if (!salesArr || !salesArr.length) {
    container.html('<p style="color:#94a3b8;padding:8px 0;font-size:12px;">No sales found for this period.</p>');
    return;
  }
  const dateGroups = {};
  salesArr.forEach(function(s) {
    const dateKey = s.date || 'Unknown';
    const person  = s.salesBy && s.salesBy.trim() ? s.salesBy.trim() : 'Unknown';
    if (!dateGroups[dateKey]) dateGroups[dateKey] = { sales:0, profit:0, persons:{} };
    dateGroups[dateKey].sales  += Number(s.total);
    dateGroups[dateKey].profit += Number(s.profit);
    if (!dateGroups[dateKey].persons[person]) dateGroups[dateKey].persons[person] = [];
    dateGroups[dateKey].persons[person].push(s);
  });
  const dateKeys = Object.keys(dateGroups).sort((a,b) => (parseYMDLocal(b) || 0) - (parseYMDLocal(a) || 0));
  let html = '';
  dateKeys.forEach(function(dateKey) {
    const g = dateGroups[dateKey];
    html += `<div class="grouped-date-block">
      <div class="grouped-date-header">
        <span class="grouped-date-title">${esc(formatGroupDateLabel(dateKey))}</span>
        <span class="grouped-date-stats">
          <span class="grouped-date-sales">Sales Amount: ${g.sales.toLocaleString()}</span>
          <span class="grouped-date-profit">Profit Amount: ${g.profit.toLocaleString()}</span>
        </span>
      </div>`;
    Object.keys(g.persons).forEach(function(person) {
      const items = g.persons[person];
      let subtotal = 0, subtotalProfit = 0, rows = '';
      items.forEach(function(it) {
        subtotal += Number(it.total); subtotalProfit += Number(it.profit);
        rows += `<tr><td>${esc(it.item)}</td><td>${Number(it.price).toLocaleString()}</td><td>${Number(it.profit).toLocaleString()}</td><td>${Number(it.total).toLocaleString()}</td></tr>`;
      });
      html += `<div class="grouped-sales-block">
        <div class="grouped-sales-header"><strong>${esc(person)}</strong></div>
        <table><thead><tr><th>Item</th><th>Selling Price</th><th>Profit</th><th>Total</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr style="font-weight:bold;background:#f8fafc;"><td colspan="2">Subtotal</td><td>${subtotalProfit.toLocaleString()}</td><td>${subtotal.toLocaleString()}</td></tr></tfoot></table>
      </div>`;
    });
    html += `</div>`;
  });
  container.html(html);
}

function runDashReport() {
  const m = $('#dashMonth').val(), y = $('#dashYear').val();
  dbReport(m, y, '', '').then(data => {
    $('#dashSales').text(data.totals.sales.toLocaleString());
    $('#dashProfit').text(data.totals.profit.toLocaleString());
    $('#dashStock').text(data.totals.stockVal.toLocaleString());
    let h = '', ts = 0, tp = 0;
    data.sales.forEach(s => {
      ts += Number(s.price); tp += Number(s.profit);
      h += `<tr><td>${esc(s.item)}</td><td>${Number(s.price).toLocaleString()}</td><td class="profit-col">${Number(s.profit).toLocaleString()}</td><td>${Number(s.total).toLocaleString()}</td></tr>`;
    });
    $('#dashSummaryTable').html(h);
    $('#dashSummaryFoot').html(`<tr><td>TOTAL</td><td>${ts.toLocaleString()}</td><td class="profit-col">${tp.toLocaleString()}</td><td>${data.totals.sales.toLocaleString()}</td></tr>`);
    renderGroupedSales(data.sales);
  }).catch(err => { console.error(err); toast('Could not load dashboard', 'error'); });
}

/* ═══════════════════════════════════════
   INVENTORY
═══════════════════════════════════════ */
function loadInventory() {
  return dbGetItems().then(data => {
    data.forEach(i => { i._searchKey = ((i.itemName||'') + ' ' + (i.category||'') + ' ' + (i.barcode||'')).toLowerCase(); });
    inventory = data;
    renderPurchaseTable(data);
    updateDropdowns(data);
  }).catch(err => { console.error(err); toast('Could not load items', 'error'); });
}

function updateDropdowns(data) {
  let so = '<option value="">Select Item...</option>';
  data.forEach(i => { if (Number(i.stock) > 0) so += `<option value="${esc(i.id)}">${esc(i.itemName)} (Stock: ${i.stock})</option>`; });
  if ($('#saleItem').data('select2')) $('#saleItem').select2('destroy');
  $('#saleItem').html(so).select2({ width:'100%', placeholder:'Select Item...' });
  let ro = '<option value="">All Items</option>';
  data.forEach(i => ro += `<option value="${esc(i.id)}">${esc(i.itemName)} (Stock: ${i.stock})</option>`);
  if ($('#repItem').data('select2')) $('#repItem').select2('destroy');
  $('#repItem').html(ro).select2({ width:'100%', placeholder:'All Items' });
}

function renderPurchaseTable(data) {
  let h = '';
  data.forEach(i => {
    const cls = Number(i.stock) <= Number(i.minStock) ? 'low-stock' : '';
    h += `<tr><td>${fmtDate(i.date)}</td>
    <td>${esc(i.itemName)}<br><small style="color:#94a3b8">${esc(i.category)}</small></td>
    <td>${i.barcode ? esc(i.barcode) : '<span style="color:#cbd5e1">—</span>'}</td>
    <td>${Number(i.costPrice).toLocaleString()}</td><td class="${cls}">${i.stock}</td>
    <td class="action-icons"><i class="fas fa-eye" style="color:#0891b2" title="View" onclick="viewItem('${esc(i.id)}')"></i>
        <i class="fas fa-edit" style="color:#2563eb" onclick="editItem('${esc(i.id)}')"></i>
        <i class="fas fa-trash" style="color:#ef4444" onclick="confirmDelete('${esc(i.id)}')"></i></td></tr>`;
  });
  $('#purchaseTable').html(h || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">No items found</td></tr>');
}

let _purSearchTimer = null;
function filterPurchase() {
  clearTimeout(_purSearchTimer);
  _purSearchTimer = setTimeout(_runPurchaseFilter, 120);
}
function _runPurchaseFilter() {
  const raw = ($('#purSearch').val() || '').toLowerCase().trim();
  if (!raw) { renderPurchaseTable(inventory); return; }
  const tokens = raw.split(/\s+/).filter(Boolean);
  renderPurchaseTable(inventory.filter(i => tokens.every(t => i._searchKey.indexOf(t) !== -1)));
}

/* ═══════════════════════════════════════
   SALES
═══════════════════════════════════════ */
function fetchSalesRecords() {
  dbReport(-1, new Date().getFullYear(), '', '').then(data => {
    allSalesRecords = data.sales; renderSalesTable(data.sales);
  }).catch(err => { console.error(err); toast('Could not load sales', 'error'); });
}

function renderSalesTable(data) {
  const grouped = data.reduce((acc, sale) => {
    if (!acc[sale.invoice]) acc[sale.invoice] = { ...sale, items: [], totalAmount: 0 };
    acc[sale.invoice].items.push(`${esc(sale.item)} (x${sale.qty})`);
    acc[sale.invoice].totalAmount += Number(sale.total);
    return acc;
  }, {});
  let h = '';
  Object.values(grouped).sort((a,b) => (parseYMDLocal(b.date) || 0) - (parseYMDLocal(a.date) || 0)).forEach(s => {
    h += `<tr>
      <td>${esc(s.date)}</td><td>${esc(s.invoice)}</td><td>${s.items.join('<br>')}</td>
      <td>${s.totalAmount.toLocaleString()}</td><td>${esc(s.customer)}</td><td>${esc(s.phone)}</td><td>${esc(s.payment)}</td>
      <td class="action-icons">
        <i class="fas fa-print" title="Print" onclick="reprint('${esc(s.invoice)}')"></i>
        <i class="fas fa-edit" title="Edit" style="color:#2563eb" onclick="editSaleByInvoice('${esc(s.invoice)}')"></i>
        <i class="fas fa-trash" title="Delete" style="color:#ef4444" onclick="confirmDeleteSale('${esc(s.id)}')"></i>
      </td></tr>`;
  });
  $('#salesTableBody').html(h || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px">No sales records</td></tr>');
}

function filterSales() {
  const v = $('#saleSearch').val().toLowerCase();
  renderSalesTable(allSalesRecords.filter(s =>
    (s.invoice||'').toLowerCase().includes(v) || (s.item||'').toLowerCase().includes(v) ||
    (s.customer && s.customer.toLowerCase().includes(v))
  ));
}

function addToCart() {
  const id = $('#saleItem').val(), qty = parseInt($('#saleQty').val()), pr = parseFloat($('#salePrice').val());
  if (!id) { toast('Please select an item first','warning'); return; }
  if (!qty || qty < 1) { toast('Enter a valid quantity','warning'); return; }
  if (isNaN(pr) || pr < 0) { toast('Enter a valid price','warning'); return; }
  const itm = inventory.find(x => x.id === id);
  if (!itm) { toast('Item not found','error'); return; }
  const inCart = cart.filter(c => c.id === id).reduce((a,b) => a + b.qty, 0);
  const avail = Number(itm.stock);
  if (avail <= 0) { toast(`"${itm.itemName}" is out of stock`,'error'); return; }
  if ((qty + inCart) > avail) { toast(`Only ${avail - inCart} unit(s) available for "${itm.itemName}"`,'warning'); return; }
  cart.push({ id: itm.id, itemName: itm.itemName, qty, price: pr, total: qty * pr });
  renderCart(); toast('Added to cart','success',1800);
  $('#saleItem').val(null).trigger('change');
  $('#saleQty,#salePrice').val('');
}

function renderCart() {
  let h = '', t = 0;
  cart.forEach((c,i) => {
    t += c.total;
    h += `<tr><td>${esc(c.itemName)}</td><td>${c.qty}</td><td>${c.price.toLocaleString()}</td><td>${c.total.toLocaleString()}</td>
    <td onclick="cart.splice(${i},1);renderCart()" style="cursor:pointer;color:#ef4444"><i class="fas fa-times"></i></td></tr>`;
  });
  $('#cartTable').html(h); $('#grandTotal').text(t.toLocaleString());
}

function completeSale() {
  if (!cart.length) { toast('Please add items to cart first','warning'); return; }
  for (const c of cart) {
    const itm = inventory.find(x => x.id === c.id);
    if (!itm) { toast(`Item "${c.itemName}" not found`,'error'); return; }
    // When editing, the invoice's own quantities are restored inside the save, so only the final check there is authoritative.
    if (!editMode) {
      if (Number(itm.stock) <= 0) { toast(`"${c.itemName}" is out of stock`,'error'); return; }
      const tq = cart.filter(x => x.id === c.id).reduce((a,b) => a + b.qty, 0);
      if (tq > Number(itm.stock)) { toast(`Only ${itm.stock} unit(s) available for "${c.itemName}"`,'warning'); return; }
    }
  }
  const wasEdit = editMode;
  const d = {
    customerName: $('#custName').val(), customerPhone: $('#custPhone').val(),
    saleDate: $('#saleDate').val() || getLocalDateStr(new Date()),
    imei1: $('#imei1').val(), imei2: $('#imei2').val(), imei3: $('#imei3').val(),
    paymentMethod: $('#payMethod').val(),
    items: cart.map(c => ({ ...c })), isUpdate: editMode, invoice: currentEditInvoice,
    salesBy: bizSettings.soldBy || ''
  };
  if (_saleBusy) return; _saleBusy = true;
  btnLoad('btnCompleteSale', 'Processing...');
  Swal.fire({ title:'Processing...', allowOutsideClick:false, didOpen:() => Swal.showLoading() });
  dbSaveSale(d).then(res => {
    _saleBusy = false; btnReset('btnCompleteSale');
    if (res && res.error) { Swal.close(); toast(res.message, 'error', 5000); loadInventory(); return; }
    Swal.fire(wasEdit ? 'Updated!' : 'Sale Complete!', 'Invoice: ' + res.invoice, 'success');
    toast(wasEdit ? 'Sale updated successfully' : 'Sale completed & invoice ready', 'success');
    printInvoice(res); resetSalesForm();
    loadInventory(); runDashReport(); fetchSalesRecords();
  }).catch(err => {
    _saleBusy = false; btnReset('btnCompleteSale'); Swal.close();
    toast(dbErrMsg(err, 'Sale could not be saved. Please try again.'), 'error', 6000); console.error(err);
  });
}

function editSaleByInvoice(invoiceNo) {
  const items = allSalesRecords.filter(s => s.invoice === invoiceNo);
  if (!items.length) return;
  const main = items[0];
  editMode = true; currentEditInvoice = invoiceNo;
  showView('salesView');
  $('#salesFormTitle').text('Edit Sale: ' + invoiceNo);
  $('#saleDate').val(main.date); $('#custName').val(main.customer); $('#custPhone').val(main.phone);
  $('#imei1').val(main.imei1); $('#imei2').val(main.imei2); $('#imei3').val(main.imei3);
  $('#payMethod').val(main.payment || 'KSH'); $('#btnCancelEdit').show();
  cart = items.map(i => ({ id: i.itemId, itemName: i.item, qty: Number(i.qty), price: Number(i.price), total: Number(i.total) }));
  renderCart(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetSalesForm() {
  editMode = false; currentEditInvoice = null;
  $('#salesFormTitle').text('New Sale');
  $('#saleDate').val(getLocalDateStr(new Date()));
  $('#imei1,#imei2,#imei3,#custName,#custPhone,#saleQty,#salePrice').val('');
  $('#payMethod').val('KSH'); $('#btnCancelEdit').hide();
  cart = []; renderCart();
}

function confirmDeleteSale(saleId) {
  const rec = allSalesRecords.find(s => s.id === saleId);
  if (!rec) return;
  Swal.fire({ title:'Delete this invoice?', text:'Stock will be restored.', icon:'warning', showCancelButton:true, confirmButtonColor:'#d33' })
  .then(r => {
    if (r.isConfirmed) dbDeleteInvoice(rec.invoice).then(() => {
      toast('Invoice deleted and stock restored', 'success');
      loadInventory(); fetchSalesRecords(); runDashReport();
    }).catch(err => { console.error(err); toast(dbErrMsg(err, 'Could not delete invoice'), 'error', 6000); });
  });
}

function reprint(invoice) {
  const items = allSalesRecords.filter(s => s.invoice === invoice);
  if (!items.length) return;
  const main = items[0];
  printInvoice({ invoice, data: {
    customerName: main.customer, customerPhone: main.phone, paymentMethod: main.payment,
    imei1: main.imei1, imei2: main.imei2, imei3: main.imei3, salesBy: main.salesBy,
    items: items.map(i => ({ itemName: i.item, qty: i.qty, price: i.price, total: i.total }))
  }});
  toast('Invoice printed', 'info', 2000);
}

/* ═══════════════════════════════════════
   REPORTS
═══════════════════════════════════════ */
function runReport() {
  const m = $('#repMonth').val(), y = $('#repYear').val();
  const itm = $('#repItem').val(), pf = $('#repPayFilter').val();
  btnLoad('btnRunReport', 'Loading...');
  dbReport(m, y, itm || '', '').then(data => {
    btnReset('btnRunReport');
    let sales = data.sales;
    if (pf) sales = sales.filter(s => s.payment === pf);
    let ts = 0, tp = 0;
    sales.forEach(s => { ts += Number(s.total); tp += Number(s.profit); });
    $('#repTotalSales').text(ts.toLocaleString());
    $('#repTotalProfit').text(tp.toLocaleString());
    let pv = 0; data.purchases.forEach(p => { pv += Number(p.cost) * Number(p.qty); });
    $('#repTotalPurchases').text(pv.toLocaleString());
    const bd = {};
    sales.forEach(s => { if (!bd[s.date]) bd[s.date] = []; bd[s.date].push(s); });
    let sh = '';
    Object.keys(bd).sort((a,b) => (parseYMDLocal(b) || 0) - (parseYMDLocal(a) || 0)).forEach(d => {
      bd[d].forEach(s => {
        sh += `<tr><td>${esc(s.date)}</td><td>${esc(s.invoice)}</td><td>${esc(s.item)}</td><td>${s.qty}</td>
        <td>${Number(s.price).toLocaleString()}</td><td>${Number(s.total).toLocaleString()}</td>
        <td>${Number(s.profit).toLocaleString()}</td><td>${esc(s.customer) || '-'}</td><td>${esc(s.payment) || '-'}</td></tr>`;
      });
    });
    if (!sh) sh = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">No sales records found</td></tr>';
    $('#repSalesTable tbody').html(sh);
    let ph = '';
    data.purchases.forEach(p => {
      ph += `<tr><td>${esc(p.date)}</td><td>${esc(p.item)}</td><td>${esc(p.category) || '-'}</td>
      <td>${Number(p.cost).toLocaleString()}</td><td>${p.qty}</td>
      <td>${(Number(p.cost) * Number(p.qty)).toLocaleString()}</td></tr>`;
    });
    if (!ph) ph = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">No purchase records found</td></tr>';
    $('#repPurchaseTable tbody').html(ph);
    $('#repDownloadBtn').show();
    toast('Report generated', 'success');
  }).catch(err => { btnReset('btnRunReport'); console.error(err); toast('Could not generate report', 'error'); });
}

function downloadPDF() {
  // Fallback when the PDF library could not be loaded (e.g. offline first run): use the browser's print dialog.
  if (typeof html2pdf === 'undefined') { window.print(); return; }
  $('#reportHeader').show();
  html2pdf().set({ margin:10, filename:'Ekambani_Report.pdf', html2canvas:{ scale:2 }, jsPDF:{ unit:'mm', format:'a4', orientation:'portrait' } })
    .from(document.getElementById('reportPrintArea')).save()
    .then(() => { $('#reportHeader').hide(); toast('PDF downloaded', 'success'); });
}

/* ═══════════════════════════════════════
   BUSINESS SETTINGS  (includes Name / Sold by)
═══════════════════════════════════════ */
function fillBizForm() {
  $('#bizLogo').val(bizSettings.logo || '');
  $('#bizName').val(bizSettings.name || '');
  $('#bizSoldBy').val(bizSettings.soldBy || '');
  $('#bizPhone').val(bizSettings.phone || '');
  $('#bizAddr').val(bizSettings.address || '');
  $('#bizDesc').val(bizSettings.desc || '');
}
function saveBizSettings() {
  const obj = {
    name: $('#bizName').val().trim(), phone: $('#bizPhone').val().trim(),
    address: $('#bizAddr').val().trim(), desc: $('#bizDesc').val().trim(),
    logo: $('#bizLogo').val().trim(), soldBy: $('#bizSoldBy').val().trim()
  };
  btnLoad('btnSaveBiz', 'Saving...');
  dbSaveSettings(obj).then(() => {
    btnReset('btnSaveBiz'); toast('Business settings saved', 'success');
  }).catch(err => { btnReset('btnSaveBiz'); console.error(err); toast(dbErrMsg(err, 'Could not save settings'), 'error', 6000); });
}

/* ═══════════════════════════════════════
   PRINT INVOICE
═══════════════════════════════════════ */
function printInvoice(res) {
  const s = bizSettings;
  const ih = res.data.items.map(i => `<tr><td>${esc(i.itemName)}</td><td>${i.qty}</td><td>${Number(i.price).toLocaleString()}</td><td>${Number(i.total).toLocaleString()}</td></tr>`).join('');
  const total = res.data.items.reduce((a,b) => a + Number(b.total), 0);
  const imei = [res.data.imei1, res.data.imei2, res.data.imei3].filter(Boolean).map(esc).join(' | ');
  const descHtml = s.desc
    ? `<div style="margin-top:18px;padding-top:12px;border-top:1px dashed #ccc;text-align:center;font-size:12px;color:#555;">${esc(s.desc)}</div>` : '';
  const soldBy = res.data.salesBy !== undefined && res.data.salesBy !== null ? res.data.salesBy : s.soldBy;
  const w = window.open('', '', 'width=800,height=600');
  if (!w) { toast('Allow pop-ups to print the invoice', 'warning', 5000); return; }
  w.document.write(`<html><head><style>body{font-family:sans-serif;padding:20px}.header{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}</style></head><body>
    <div class="header">${s.logo ? `<img src="${esc(s.logo)}" style="max-width:80px"><br>` : ''}<h2>${esc(s.name || 'Ekambani')}</h2><p>${esc(s.address)}<br>${esc(s.phone)}</p><hr>
    <h3>INVOICE: ${esc(res.invoice)}</h3>
    <p>Customer: ${esc(res.data.customerName) || '-'} &nbsp;|&nbsp; Phone: ${esc(res.data.customerPhone) || '-'}</p></div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${ih}</tbody></table>
    <h3 style="text-align:right">Total: KSH ${total.toLocaleString()}</h3>
    ${imei ? `<p><strong>IMEI:</strong> ${imei}</p>` : ''}
    <p><strong>Payment:</strong> ${esc(res.data.paymentMethod) || '-'}</p>
    <p style="margin-top:14px"><strong>Sales By:</strong> ${esc(soldBy) || '-'}</p>
    ${descHtml}
  </body></html>`);
  w.document.close(); setTimeout(() => w.print(), 500);
}

/* ═══════════════════════════════════════
   ITEM MODAL
═══════════════════════════════════════ */
function openModal() {
  $('#itemModal input:not([type=hidden])').val(''); $('#itemId').val('');
  $('#modalTitle').text('Add Item'); $('#itemModal').show();
}
function closeModal() { $('#itemModal').hide(); }
function saveItem() {
  const name = $('#itemName').val().trim(), cat = $('#itemCat').val().trim(),
        cost = $('#costPrice').val(), sell = $('#sellPrice').val(), stock = $('#stockQty').val();
  if (!name || !cat || !cost || !sell || !stock) { toast('Please fill all required fields','warning'); return; }
  const d = { id: $('#itemId').val(), itemName: name, category: cat, barcode: $('#itemBarcode').val().trim(),
    costPrice: cost, sellPrice: sell, stock: stock, minStock: $('#minStock').val() || 0,
    newCostPrice: $('#newCostPrice').val().trim() };
  if (_itemBusy) return; _itemBusy = true;
  btnLoad('btnSaveItem', 'Saving...');
  dbSaveItem(d).then(res => {
    _itemBusy = false; btnReset('btnSaveItem');
    if (res.error) { toast(res.message, 'error', 4500); return; }
    toast('Item saved successfully', 'success');
    closeModal(); loadInventory(); runDashReport();
  }).catch(err => { _itemBusy = false; btnReset('btnSaveItem'); console.error(err); toast(dbErrMsg(err, 'Could not save item'), 'error', 6000); });
}
function editItem(id) {
  const i = inventory.find(x => x.id === id); if (!i) return;
  $('#itemId').val(i.id); $('#itemName').val(i.itemName); $('#itemCat').val(i.category);
  $('#itemBarcode').val(i.barcode || '');
  $('#costPrice').val(i.costPrice); $('#sellPrice').val(i.sellPrice);
  $('#stockQty').val(i.stock); $('#minStock').val(i.minStock);
  $('#newCostPrice').val('');
  $('#modalTitle').text('Edit Item'); $('#itemModal').show();
}
function confirmDelete(id) {
  Swal.fire({ title:'Delete item?', showCancelButton:true, confirmButtonColor:'#d33' })
  .then(r => {
    if (r.isConfirmed) dbDelete('items', id).then(() => {
      toast('Item deleted', 'success'); loadInventory(); runDashReport();
    }).catch(err => { console.error(err); toast(dbErrMsg(err, 'Could not delete item'), 'error', 6000); });
  });
}

function viewItem(id) {
  const i = inventory.find(x => x.id === id); if (!i) return;
  const stockNum = Number(i.stock), minNum = Number(i.minStock) || 0;
  const stockBadge = stockNum <= minNum
    ? `<span class="view-item-badge badge-low"><i class="fas fa-triangle-exclamation"></i> Low Stock</span>`
    : `<span class="view-item-badge badge-ok"><i class="fas fa-check-circle"></i> In Stock</span>`;
  const margin = i.costPrice > 0 ? Math.round(((i.sellPrice - i.costPrice) / i.costPrice) * 100) : 0;
  const rows = [
    { label:'Item Name',     value: esc(i.itemName) },
    { label:'Category',      value: esc(i.category) || '—' },
    { label:'Barcode',       value: i.barcode ? esc(i.barcode) : '—' },
    { label:'Cost Price',    value: 'KSH ' + Number(i.costPrice).toLocaleString() },
    { label:'Sell Price',    value: 'KSH ' + Number(i.sellPrice).toLocaleString() },
    { label:'Profit Margin', value: margin + '%' },
    { label:'Stock Qty',     value: stockNum + ' units &nbsp;' + stockBadge },
    { label:'Min Stock',     value: minNum + ' units' },
    { label:'Date Added',    value: fmtDate(i.date) || '—' }
  ];
  $('#viewItemBody').html(rows.map(r => `<div class="view-item-row"><span class="view-item-label">${r.label}</span><span class="view-item-value">${r.value}</span></div>`).join(''));
  $('#viewItemModal').show();
}

/* ═══════════════════════════════════════
   SCANNER  (barcode + QR + IMEI)
   mode 'field' → fills the input with id targetId
   mode 'sale'  → finds the item by barcode and selects it
═══════════════════════════════════════ */
let _scanTargetId = null;
let _scanMode = 'field';
let _html5Scanner = null;
let _scanLock = false;

function openScanner(targetInputId, mode) {
  _scanTargetId = targetInputId || null;
  _scanMode = mode || 'field';
  _scanLock = false;
  $('#scannerTitle').text(_scanMode === 'sale' ? 'Scan Barcode / QR Code' : 'Scan Barcode');
  $('#scannerManualInput').val('');
  $('#scannerStatus').text('Starting camera…');
  $('#scannerViewport').html('');
  $('#scannerOverlay').addClass('open');
  setTimeout(startHtml5Scanner, 100);
}

function startHtml5Scanner() {
  if (typeof Html5Qrcode === 'undefined') {
    $('#scannerStatus').text('Scanner not available. Please type the code below.');
    return;
  }
  stopHtml5Scanner();
  try {
    _html5Scanner = new Html5Qrcode('scannerViewport', { useBarCodeDetectorIfSupported: true, verbose: false });
  } catch (e) {
    _html5Scanner = new Html5Qrcode('scannerViewport');
  }
  const config = { fps: 15, qrbox: { width: 280, height: 140 } };
  const onOk = function(text) {
    if (_scanLock) return;
    _scanLock = true;
    $('#scannerStatus').html('<span style="color:#38bdf8"><i class="fas fa-check-circle"></i> Scanned!</span>');
    applyScannedValue(text);
  };
  _html5Scanner.start({ facingMode: 'environment' }, config, onOk, function() {})
    .then(function() { $('#scannerStatus').text('Align the code within the frame…'); })
    .catch(function() {
      $('#scannerStatus').text('Camera not available or permission denied. Please type the code below.');
    });
}

function stopHtml5Scanner() {
  const s = _html5Scanner;
  _html5Scanner = null;
  if (s) {
    try { s.stop().then(function() { try { s.clear(); } catch(e) {} }).catch(function() {}); } catch(e) {}
  }
}

function closeScanner() {
  stopHtml5Scanner();
  $('#scannerOverlay').removeClass('open');
  setTimeout(function() { $('#scannerViewport').html(''); }, 300);
}

function applyScannedValue(text) {
  text = (text || '').toString().trim();
  const mode = _scanMode, target = _scanTargetId;
  closeScanner();
  if (!text) return;
  if (mode === 'sale') { handleSaleScan(text); return; }
  if (target) {
    $('#' + target).val(text);
    toast(target === 'itemBarcode' ? 'Barcode added' : 'Code scanned into field', 'success', 2000);
  }
}

function confirmManualScan() {
  const val = $('#scannerManualInput').val().trim();
  if (!val) { toast('Please enter a code', 'warning'); return; }
  _scanLock = true;
  applyScannedValue(val);
}
$(document).on('keydown', '#scannerManualInput', function(e) { if (e.key === 'Enter') confirmManualScan(); });

function handleSaleScan(code) {
  // Look up in IndexedDB by barcode index (falls back to in-memory list)
  let tx; try { tx = dbTx('items', 'readonly'); } catch (e) { toast('Could not search items', 'error'); return; }
  const req = tx.objectStore('items').index('barcode').getAll(code);
  req.onsuccess = function() {
    const found = (req.result && req.result[0]) || inventory.find(i => (i.barcode || '') === code);
    if (!found) { toast('No item found with barcode "' + code + '"', 'warning', 4500); return; }
    if (Number(found.stock) <= 0) { toast('"' + found.itemName + '" is out of stock', 'error', 4000); return; }
    const live = inventory.find(i => i.id === found.id) || found;
    $('#saleItem').val(live.id).trigger('change');
    toast('Selected: ' + live.itemName, 'success', 2000);
  };
  req.onerror = function() { toast('Could not search items', 'error'); };
}

/* ═══════════════════════════════════════════════════════════════
   OPTIONAL GOOGLE DRIVE BACKUP / RESTORE
   - IndexedDB stays the primary data source; Drive is an extra safety copy.
   - Nothing here runs at start-up except reading a small local record.
     Google's sign-in script is loaded only when the user taps Connect
     (or when auto backup needs it), and only if configured + online.
   - Any failure here is caught and never touches local data.
   - Connection info lives in the 'settings' store under key 'drive'
     (no schema change). It is excluded from backups and never overwritten
     by a restore.
═══════════════════════════════════════════════════════════════ */
const BK_APP_ID = 'EkambaniPOS';
let driveState = { key: 'drive', connected: false, autoBackup: false, folderId: '', folderName: '', fileId: '', syncedFileId: '', accountEmail: '', lastBackup: 0, dirty: false, dirtyAt: 0 };
let gdToken = { value: '', exp: 0 };
let _gisPromise = null, _bkBusy = false, _bkTimer = null, _bkFails = 0, _dirtySeq = 0;
let _bkNote = '', _bkError = '', _needsAuth = false, _silentBusy = false, _silentAt = 0, _folderBusy = false, _bkChain = Promise.resolve();

function gdConfigured() {
  const id = (GDRIVE_CONFIG.CLIENT_ID || '').trim();
  return !!id && !/YOUR_|REPLACE|XXXX/i.test(id);
}
function gdEnvOk() { return location.protocol === 'https:' || (location.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)); }
function gdTokenValid() { return !!gdToken.value && Date.now() < gdToken.exp - 60000; }
function bkReady() { return gdConfigured() && gdEnvOk() && !!driveState.folderId; }
/* Automatic backup is really enabled only when ALL of these hold (the toggle mirrors exactly this). */
function bkAutoReady() { return bkReady() && !!driveState.connected && !!driveState.autoBackup; }
function bkRefreshIfOpen() { if ($('#backupView').hasClass('active')) refreshBackupUI(); }

async function bkInit() {
  const s = await dbGet('settings', 'drive');
  if (s) {
    driveState = Object.assign(driveState, s, { key: 'drive' });
    // Records saved before the "connected" flag existed: treat a known account as connected (the token is re-checked honestly below).
    if (s.connected === undefined && s.accountEmail) driveState.connected = true;
  }
  window.addEventListener('online', function() {
    if (driveState.dirty && bkAutoReady()) bkSchedule(3000);
    if (driveState.connected) bkTrySilent();
  });
  if (driveState.dirty && bkAutoReady()) bkSchedule(5000);
  if (driveState.connected && gdConfigured() && gdEnvOk()) setTimeout(bkTrySilent, 2500);
}
function saveDriveState() { return dbPut('settings', driveState); }
/* Re-read the saved connection record (another tab may have changed it). Never loses a pending-change flag. */
async function bkReloadState() {
  try {
    const cur = await dbGet('settings', 'drive');
    if (cur) {
      const dirty = !!(cur.dirty || driveState.dirty);
      const dirtyAt = Math.max(cur.dirtyAt || 0, driveState.dirtyAt || 0);
      driveState = Object.assign(driveState, cur, { key: 'drive', dirty: dirty, dirtyAt: dirtyAt });
    }
  } catch (e) {}
}

/* Mark local data as changed since the last successful backup; schedule an auto backup only if it is really ON. */
function markDirty() {
  _dirtySeq++;
  if (!driveState.folderId) return;
  driveState.dirty = true; driveState.dirtyAt = Date.now();
  saveDriveState().catch(function() {});
  if (bkAutoReady()) bkSchedule();
}
function bkSchedule(delay) {
  clearTimeout(_bkTimer);
  if (!bkAutoReady()) return;
  _bkTimer = setTimeout(bkAuto, delay == null ? GDRIVE_CONFIG.AUTO_BACKUP_DELAY_MS : delay);
}
async function bkAuto() {
  if (!bkAutoReady() || !driveState.dirty || !navigator.onLine) return;
  try {
    const r = await bkRun(false);
    if (r === 'ok') _bkFails = 0;
    // Changes made while the upload was running keep the flag set: back up again shortly.
    if (r === 'ok' && driveState.dirty && bkAutoReady()) bkSchedule(2000);
  } catch (e) {
    console.warn('Auto backup failed (local data is safe):', e && e.message);
    _bkFails++;
    // Needs the user to renew Google access: do not loop; retry on reconnect/online/renew instead.
    if (!(e && e.needsAuth) && navigator.onLine && bkAutoReady()) bkSchedule(Math.min(120000 * Math.pow(2, _bkFails - 1), 1800000));
  } finally { bkRefreshIfOpen(); }
}
/* Quietly renew the access token (no popup unless Google needs it; browsers may block popups without a tap). */
async function bkTrySilent() {
  if (!driveState.connected || gdTokenValid() || _silentBusy || !navigator.onLine || !gdConfigured() || !gdEnvOk()) return;
  if (Date.now() - _silentAt < 30000) return;
  _silentBusy = true; _silentAt = Date.now();
  try {
    await gdRequestToken('');
    if (driveState.dirty && bkAutoReady()) bkSchedule(1500);
  } catch (e) { if (e && e.needsAuth) _needsAuth = true; }
  finally { _silentBusy = false; bkRefreshIfOpen(); }
}

/* ── Google sign-in (Google Identity Services, token flow) ── */
function gdLoadGIS() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  if (_gisPromise) return _gisPromise;
  _gisPromise = new Promise(function(resolve, reject) {
    const sc = document.createElement('script');
    sc.src = GDRIVE_CONFIG.GIS_SCRIPT_URL; sc.async = true;
    sc.onload = function() { resolve(); };
    sc.onerror = function() { _gisPromise = null; reject(new Error('Could not load Google sign-in. Check your internet connection.')); };
    document.head.appendChild(sc);
  });
  return _gisPromise;
}
function gdRequestToken(prompt) {
  if (!gdConfigured()) return Promise.reject(new Error('Google Drive is not configured.'));
  if (!gdEnvOk()) return Promise.reject(new Error('Google sign-in needs https:// or localhost.'));
  if (!navigator.onLine) return Promise.reject(new Error('No internet connection.'));
  const authErr = function(m) { const e = new Error(m); e.needsAuth = true; return e; };
  return gdLoadGIS().then(function() {
    return new Promise(function(resolve, reject) {
      const timer = setTimeout(function() { reject(authErr('Sign-in timed out.')); }, 60000);
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CONFIG.CLIENT_ID.trim(),
        scope: GDRIVE_CONFIG.SCOPES,
        hint: driveState.accountEmail || undefined,
        callback: function(r) {
          clearTimeout(timer);
          if (!r || r.error || !r.access_token) { reject(authErr((r && (r.error_description || r.error)) || 'Sign-in failed.')); return; }
          // Access token is kept in memory only (never written to storage); it is renewed on demand.
          gdToken = { value: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
          _needsAuth = false;
          resolve(gdToken.value);
        },
        error_callback: function(e) { clearTimeout(timer); reject(authErr('Sign-in cancelled' + (e && e.type ? ' (' + e.type + ')' : '') + '.')); }
      });
      client.requestAccessToken({ prompt: prompt });
    });
  });
}
async function bkEnsureToken(interactive) {
  if (gdTokenValid()) return;
  await gdRequestToken(interactive && !driveState.connected ? 'select_account' : '');
}

/* ── Drive REST helpers ── */
async function gdFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + gdToken.value });
  let r;
  try { r = await fetch(url, opts); }
  catch (err) { const e = new Error('Network problem. Check your internet connection.'); e.network = true; throw e; }
  if (!r.ok) {
    let m = 'Google Drive error ' + r.status + '.';
    const e = new Error(m); e.status = r.status;
    if (r.status === 401) { gdToken = { value: '', exp: 0 }; e.needsAuth = true; e.message = 'Google session expired. Please renew the connection.'; }
    else if (r.status === 403) e.message = 'Google Drive refused the request (permission or storage quota). Try again later.';
    else if (r.status === 404) e.message = 'Item not found in Google Drive.';
    else if (r.status === 429) e.message = 'Google Drive rate limit reached. It will be retried later.';
    else if (r.status >= 500) e.message = 'Google Drive is temporarily unavailable. It will be retried later.';
    throw e;
  }
  return r;
}
function gdQ(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
async function gdAccountEmail() {
  try {
    const r = await gdFetch(GDRIVE_CONFIG.DRIVE_API + '/about?fields=user(emailAddress)');
    const j = await r.json();
    return (j && j.user && j.user.emailAddress) || '';
  } catch (e) { return ''; }
}
async function gdFindFolderByName(name) {
  const q = "mimeType='application/vnd.google-apps.folder' and name='" + gdQ(name) + "' and trashed=false";
  const r = await gdFetch(GDRIVE_CONFIG.DRIVE_API + '/files?fields=files(id,name)&orderBy=createdTime&pageSize=10&q=' + encodeURIComponent(q));
  const j = await r.json();
  return (j.files && j.files[0]) || null;
}
async function gdCreateFolder(name) {
  const r = await gdFetch(GDRIVE_CONFIG.DRIVE_API + '/files?fields=id,name', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.folder' })
  });
  return r.json();
}
/* Verifies the SAVED folder ID. It never creates a new folder and never changes the saved ID/name. */
async function gdEnsureFolder() {
  if (!driveState.folderId) throw new Error('Save a backup folder first.');
  try {
    const r = await gdFetch(GDRIVE_CONFIG.DRIVE_API + '/files/' + encodeURIComponent(driveState.folderId) + '?fields=id,trashed');
    const j = await r.json();
    if (j && !j.trashed) return driveState.folderId;
  } catch (e) { if (e.status !== 404 && e.status !== 403) throw e; }
  throw new Error('Your backup folder "' + (driveState.folderName || 'saved folder') + '" is not available (it may be in the Bin, or this Google account cannot access it). Nothing was changed.');
}
async function gdFindBackupFile() {
  const q = "'" + gdQ(driveState.folderId) + "' in parents and name='" + gdQ(GDRIVE_CONFIG.BACKUP_FILE_NAME) + "' and trashed=false";
  const r = await gdFetch(GDRIVE_CONFIG.DRIVE_API + '/files?fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1&q=' + encodeURIComponent(q));
  const j = await r.json();
  return (j.files && j.files[0] && j.files[0].id) || '';
}
async function gdUpload(text, existingId) {
  const boundary = 'ekb' + Date.now().toString(36);
  const meta = { name: GDRIVE_CONFIG.BACKUP_FILE_NAME, mimeType: 'application/json' };
  let url = GDRIVE_CONFIG.DRIVE_UPLOAD_API + '/files?uploadType=multipart&fields=id', method = 'POST';
  if (existingId) { url = GDRIVE_CONFIG.DRIVE_UPLOAD_API + '/files/' + encodeURIComponent(existingId) + '?uploadType=multipart&fields=id'; method = 'PATCH'; }
  else { meta.parents = [driveState.folderId]; }
  const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
               '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + text + '\r\n--' + boundary + '--';
  const r = await gdFetch(url, { method: method, headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: body });
  return (await r.json()).id;
}

/* ── Snapshot / validate / apply ── */
async function bkSnapshot() {
  const stores = {};
  for (const n of DB_STORES) stores[n] = await dbAll(n);
  stores.settings = stores.settings.filter(function(r) { return r && r.key !== 'drive'; });
  return { app: BK_APP_ID, format: 1, dbVersion: db.version, createdAt: new Date().toISOString(), stores: stores };
}
function bkValidate(snap) {
  if (!snap || typeof snap !== 'object' || snap.app !== BK_APP_ID || !snap.stores) throw new Error('This is not a valid Ekambani backup.');
  DB_STORES.forEach(function(n) { if (!Array.isArray(snap.stores[n])) throw new Error('Backup is incomplete (missing "' + n + '").'); });
  ['items', 'sales', 'customers'].forEach(function(n) {
    snap.stores[n].forEach(function(r) { if (!r || typeof r.id !== 'string' || !r.id) throw new Error('Backup contains a damaged record in "' + n + '".'); });
  });
  snap.stores.settings.forEach(function(r) { if (!r || typeof r.key !== 'string' || !r.key) throw new Error('Backup contains a damaged settings record.'); });
  return true;
}
/* One atomic transaction: if anything fails, IndexedDB rolls back and local data stays untouched. */
function bkApply(snap) {
  return new Promise(function(resolve, reject) {
    const tx = db.transaction(DB_STORES, 'readwrite');
    tx.oncomplete = function() { resolve(true); };
    tx.onerror = tx.onabort = function() { reject(tx.error || new Error('Restore failed; local data was not changed.')); };
    ['items', 'sales', 'customers'].forEach(function(n) {
      const s = tx.objectStore(n); s.clear();
      snap.stores[n].forEach(function(r) { s.put(r); });
    });
    const ss = tx.objectStore('settings');
    ss.getAllKeys().onsuccess = function(e) {
      e.target.result.forEach(function(k) { if (k !== 'drive') ss.delete(k); });
      snap.stores.settings.forEach(function(r) { if (r.key !== 'drive') ss.put(r); });
    };
  });
}

/* ── Backup run (auto + manual) ──
   All uploads go through ONE queue (and a cross-tab Web Lock when available), so two backups can never run at the same time. */
function bkRun(interactive) {
  const job = function() { return bkRunInner(interactive); };
  const exec = function() { return (navigator.locks && navigator.locks.request) ? navigator.locks.request('ekambani-drive-backup', job) : job(); };
  const p = _bkChain.then(exec);
  _bkChain = p.catch(function() {});
  return p;
}
async function bkRunInner(interactive) {
  await bkReloadState();
  if (!interactive && !driveState.autoBackup) return 'off';     // switched OFF while this job was waiting
  if (!driveState.connected) throw new Error('Google account is not connected.');
  _bkBusy = true; _bkError = ''; _bkNote = ''; bkRefreshIfOpen();
  try {
    await bkEnsureToken(interactive);
    await gdEnsureFolder();
    const fileId = driveState.fileId || await gdFindBackupFile();
    // Safety: never silently overwrite a cloud backup this device has not synced with
    // (e.g. a new, empty device connected to an account that already has a backup).
    if (fileId && driveState.syncedFileId !== fileId) {
      if (!interactive) { _bkNote = 'A backup already exists in the folder. Use Restore, or run one Manual Backup, to sync this device before automatic backups continue.'; return 'skipped'; }
      const ok = await Swal.fire({ title: 'Replace existing cloud backup?', text: 'A backup already exists in this folder and this device has not restored it. If this device is new, use Restore first. Replace it with this device\'s data?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
      if (!ok.isConfirmed) return 'cancelled';
    }
    const t0 = Date.now(), seq = _dirtySeq;
    const text = JSON.stringify(await bkSnapshot());       // same full-snapshot format for manual and automatic backups
    let newId;
    try { newId = await gdUpload(text, fileId); }
    catch (e) { if (fileId && e.status === 404) newId = await gdUpload(text, ''); else throw e; }
    // Only now is the backup really in Google Drive.
    driveState.fileId = newId; driveState.syncedFileId = newId; driveState.lastBackup = Date.now();
    let cur = null; try { cur = await dbGet('settings', 'drive'); } catch (e) {}
    const changedMeanwhile = (seq !== _dirtySeq) || (cur && (cur.dirtyAt || 0) > t0);
    if (!changedMeanwhile) driveState.dirty = false;
    await saveDriveState();
    return 'ok';
  } catch (e) {
    _bkError = (e && e.message) || 'Backup failed.';
    if (e && e.needsAuth) _needsAuth = true;
    throw e;
  } finally { _bkBusy = false; bkRefreshIfOpen(); }
}

/* ── Backup page UI ── */
function bkRenderToggle() {
  const on = !!(driveState.autoBackup && driveState.connected && driveState.folderId);
  $('#bkAutoSwitch').toggleClass('on', on).attr('aria-checked', on ? 'true' : 'false');
}
function refreshBackupUI() {
  const st = $('#bkStatus');
  $('#btnBkConnect,#bkFolderBox,#bkActions,#btnBkDisc,#bkFolderLocked,#bkAutoHint').hide();
  bkRenderToggle();
  if (!gdConfigured()) {
    st.html('<i class="fas fa-circle-info" style="color:#d97706"></i> Google Drive backup is not configured yet. Your data is still saved safely on this device.'); return;
  }
  if (!gdEnvOk()) {
    st.html('<i class="fas fa-circle-info" style="color:#d97706"></i> Google sign-in is not available here (it needs https:// or localhost). Your data is still saved safely on this device.'); return;
  }
  const hasFolder = !!driveState.folderId, lines = [];
  if (hasFolder) { $('#bkFolderNameText').text(driveState.folderName || '(saved folder)'); $('#bkFolderLocked').show(); }
  if (!driveState.connected) {
    lines.push('<i class="fas fa-circle" style="color:#94a3b8;font-size:9px"></i> Not connected');
    st.html(lines.join('<br>'));
    $('#btnBkConnect').html('<i class="fab fa-google"></i> Connect Google Account').show();
    return;
  }
  lines.push('<i class="fas fa-circle" style="color:#22c55e;font-size:9px"></i> Connected' + (driveState.accountEmail ? ' as ' + esc(driveState.accountEmail) : ''));
  if (_needsAuth && !gdTokenValid()) {
    lines.push('<i class="fas fa-triangle-exclamation" style="color:#d97706"></i> Google access needs to be renewed before the next backup.');
    $('#btnBkConnect').html('<i class="fas fa-rotate"></i> Renew Google Session').show();
  }
  if (hasFolder) {
    lines.push('Automatic backup: ' + (bkAutoReady() ? 'ON' : 'OFF'));
    if (_bkBusy) lines.push('<i class="fas fa-spinner fa-spin"></i> Saving to Google Drive…');
    else if (_bkError) lines.push('<i class="fas fa-circle-exclamation" style="color:#dc2626"></i> Last attempt failed: ' + esc(_bkError));
    else if (_bkNote) lines.push(esc(_bkNote));
    lines.push('Last successful backup: ' + (driveState.lastBackup ? esc(new Date(driveState.lastBackup).toLocaleString()) : 'never'));
    if (driveState.dirty) lines.push('Changes not yet backed up' + (bkAutoReady() && !navigator.onLine ? ' — waiting for internet' : ''));
    $('#bkActions').show();
    if (bkAutoReady()) $('#bkAutoHint').show();
  } else {
    lines.push('Enter a folder name and tap Save Folder. This can only be done once.');
    $('#bkFolderBox').show();
  }
  st.html(lines.join('<br>'));
  $('#btnBkDisc').show();
}

async function bkConnect() {
  btnLoad('btnBkConnect', 'Connecting...');
  try {
    await gdRequestToken(driveState.connected ? '' : 'select_account');
    const email = await gdAccountEmail();
    if (email) driveState.accountEmail = email;
    driveState.connected = true; _bkError = '';
    await saveDriveState();
    toast('Google account connected', 'success');
    if (driveState.folderId) {
      try { await gdEnsureFolder(); } catch (e) { _bkError = e.message; toast(e.message, 'error', 7000); }
    }
    if (driveState.dirty && bkAutoReady()) bkSchedule(3000);
    if (!$('#backupView').hasClass('active')) showView('backupView');
  } catch (e) { toast(e.message || 'Could not connect', 'error', 5000); }
  btnReset('btnBkConnect'); refreshBackupUI();
}

/* One permanent folder: saved once, then locked. Guarded against double taps, refreshes and other tabs. */
async function bkSetFolder() {
  if (_folderBusy) return;
  if (driveState.folderId) { toast('The backup folder is already saved and cannot be changed.', 'info'); refreshBackupUI(); return; }
  const name = ($('#bkFolderName').val() || '').trim();
  if (!name) { toast('Enter a folder name', 'warning'); return; }
  const ok = await Swal.fire({ title: 'Save this backup folder?', text: '"' + name + '" will become your permanent backup folder. It cannot be changed later.', icon: 'question', showCancelButton: true });
  if (!ok.isConfirmed) return;
  if (_folderBusy) return;
  _folderBusy = true; btnLoad('btnBkFolder', 'Saving...');
  try {
    await bkEnsureToken(true);
    // Another tab (or an earlier tap) may already have saved a folder: reuse it, never create another.
    const cur = await dbGet('settings', 'drive');
    if (cur && cur.folderId) { driveState = Object.assign(driveState, cur, { key: 'drive' }); toast('A backup folder is already saved: ' + (cur.folderName || ''), 'info', 5000); return; }
    if (!driveState.accountEmail) { const em = await gdAccountEmail(); if (em) driveState.accountEmail = em; }
    // First save only (no stored ID yet): reuse an app-created folder of this name (e.g. when moving to a new device), else create it.
    let f = await gdFindFolderByName(name), created = false;
    if (!f) { f = await gdCreateFolder(name); created = true; }
    driveState.folderId = f.id; driveState.folderName = f.name || name; driveState.fileId = ''; driveState.syncedFileId = '';
    await saveDriveState();
    toast(created ? 'Folder saved' : 'Existing folder saved', 'success');
    try { if (!created && await gdFindBackupFile()) toast('A backup was found in this folder. Tap Restore to load it.', 'info', 5000); } catch (e) {}
  } catch (e) { toast(e.message || 'Could not save folder', 'error', 5000); }
  finally { _folderBusy = false; btnReset('btnBkFolder'); refreshBackupUI(); }
}

/* Persist the automatic-backup preference; the in-memory value is rolled back if it could not be saved. */
async function bkSetAuto(on) {
  const prev = driveState.autoBackup;
  driveState.autoBackup = !!on;
  if (on && !driveState.lastBackup) { driveState.dirty = true; driveState.dirtyAt = Date.now(); }
  if (!on) clearTimeout(_bkTimer);
  try { await saveDriveState(); }
  catch (e) { driveState.autoBackup = prev; throw e; }
}
async function bkToggleAuto() {
  const sw = $('#bkAutoSwitch'); if (sw.hasClass('busy')) return;
  const want = !(driveState.autoBackup && driveState.connected && driveState.folderId);
  if (want) {
    if (!gdConfigured() || !gdEnvOk()) { toast('Google Drive backup is not available here.', 'warning'); return; }
    if (!driveState.connected) { toast('Connect your Google account first.', 'warning'); return; }
    if (!driveState.folderId) { toast('Save a backup folder first.', 'warning'); return; }
  }
  sw.addClass('busy');
  try {
    await bkSetAuto(want);
    if (want) { toast('Automatic backup is ON', 'success'); if (driveState.dirty) bkSchedule(1500); }
    else toast('Automatic backup is OFF', 'info');
  } catch (e) { console.error(e); toast('Could not save the setting', 'error'); }
  finally { sw.removeClass('busy'); refreshBackupUI(); }
}

async function bkManual() {
  btnLoad('btnBkManual', 'Backing up...');
  try {
    // Manual and automatic never compete: switch automatic OFF first (persisted), then queue exactly one manual backup behind any running upload.
    if (driveState.autoBackup) { await bkSetAuto(false); toast('Automatic backup turned OFF', 'info', 2500); refreshBackupUI(); }
    const r = await bkRun(true);
    if (r === 'ok') toast('Backup saved to Google Drive', 'success');
  } catch (e) { console.error(e); toast('Backup failed: ' + (e.message || 'unknown error') + ' Your local data is safe.', 'error', 6000); }
  btnReset('btnBkManual'); refreshBackupUI();
}

async function bkRestore() {
  btnLoad('btnBkRestore', 'Checking backup...');
  try {
    await bkEnsureToken(true);
    await gdEnsureFolder();
    const fileId = await gdFindBackupFile();
    if (!fileId) { toast('No backup found in this folder.', 'warning', 5000); return; }
    const text = await (await gdFetch(GDRIVE_CONFIG.DRIVE_API + '/files/' + encodeURIComponent(fileId) + '?alt=media')).text();
    let snap; try { snap = JSON.parse(text); } catch (e) { throw new Error('The backup file is damaged.'); }
    bkValidate(snap);
    const c = snap.stores;
    const ok = await Swal.fire({
      title: 'Restore this backup?',
      text: 'Backup from ' + new Date(snap.createdAt || Date.now()).toLocaleString() + ': ' + c.items.length + ' items, ' + c.sales.length + ' sale lines, ' + c.customers.length + ' customers. Data on this device will be replaced by the backup.',
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33'
    });
    if (!ok.isConfirmed) return;
    await bkApply(snap);
    driveState.fileId = fileId; driveState.syncedFileId = fileId; driveState.dirty = false;
    await saveDriveState();
    await loadBizSettings();
    await loadInventory(); runDashReport(); fetchSalesRecords();
    toast('Data restored successfully', 'success');
  } catch (e) { console.error(e); toast('Restore failed: ' + (e.message || 'unknown error') + '. Local data was not changed.', 'error', 6000); }
  finally { btnReset('btnBkRestore'); refreshBackupUI(); }
}

async function bkDisconnect() {
  const ok = await Swal.fire({ title: 'Disconnect Google account?', text: 'Automatic backup will turn OFF. Your saved backup folder and all local data are kept.', icon: 'warning', showCancelButton: true });
  if (!ok.isConfirmed) return;
  try { if (gdTokenValid() && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(gdToken.value, function() {}); } catch (e) {}
  gdToken = { value: '', exp: 0 };
  clearTimeout(_bkTimer);
  const prev = Object.assign({}, driveState);
  driveState.connected = false; driveState.autoBackup = false; driveState.accountEmail = '';
  _needsAuth = false; _bkError = ''; _bkNote = '';
  try { await saveDriveState(); }
  catch (e) { driveState = prev; toast('Could not disconnect. Please try again.', 'error'); refreshBackupUI(); return; }
  toast('Disconnected. Your local data and saved folder are unchanged.', 'info');
  refreshBackupUI();
}

/* Hook data-changing operations so auto backup knows when something changed.
   The wrappers return the original promise untouched; they never alter behavior or results. */
(function() {
  const _put = dbPut, _del = dbDelete, _sale = dbSaveSale, _inv = dbDeleteInvoice, _item = dbSaveItem;
  dbPut = function(store, val) {
    const p = _put(store, val);
    if (!(store === 'settings' && val && val.key === 'drive')) p.then(markDirty, function() {});
    return p;
  };
  dbDelete = function(store, key) { const p = _del(store, key); p.then(markDirty, function() {}); return p; };
  dbSaveItem = function(d) { const p = _item(d); p.then(function(r) { if (r && !r.error) markDirty(); }, function() {}); return p; };
  dbSaveSale = function(d) { const p = _sale(d); p.then(function(r) { if (r && !r.error) markDirty(); }, function() {}); return p; };
  dbDeleteInvoice = function(inv) { const p = _inv(inv); p.then(markDirty, function() {}); return p; };
})();
</script>
</body>
</html>
