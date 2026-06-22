// ==UserScript==
// @name         Pluelus
// @namespace    https://caelus.lol
// @version      1.4
// @description  Tuff Extension -- Made by Plutomaster
// @author       Plutomaster
// @match        *://*.caelus.lol/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Storage shim replacing chrome.storage.local
    const storage = {
        get: (keys, callback) => {
            const result = {};
            if (Array.isArray(keys)) {
                keys.forEach(k => { result[k] = GM_getValue(k, undefined); });
            } else if (typeof keys === 'object') {
                Object.keys(keys).forEach(k => { result[k] = GM_getValue(k, keys[k]); });
            }
            callback(result);
        },
        set: (obj) => {
            Object.keys(obj).forEach(k => GM_setValue(k, obj[k]));
        }
    };

    let apiBuyObserver = null;
    let settingsObserver = null;

    const applyApiBuy = (enable) => {
        const match = window.location.pathname.match(/^\/catalog\/(\d+)/);
        if (apiBuyObserver) { apiBuyObserver.disconnect(); apiBuyObserver = null; }
        const existingBtn = document.getElementById('pluelus-api-buy-btn');
        if (!match || !enable) { if (existingBtn) existingBtn.remove(); return; }
        const itemId = match[1];

        const injectButton = () => {
            if (document.getElementById('pluelus-api-buy-btn')) return;
            const nativeBuyBtn = document.querySelector('button[class*="buyButton-"]');
            if (!nativeBuyBtn) return;
            const btnText = nativeBuyBtn.textContent.toLowerCase();
            const isUnavailable = btnText.includes('owned') || btnText.includes('inventory') || btnText.includes('offsale') || nativeBuyBtn.disabled;
            let unavailableText = 'Item Owned';
            if (btnText.includes('offsale') || btnText.includes('off sale')) unavailableText = 'Offsale';
            const apiBuyBtn = document.createElement('button');
            apiBuyBtn.id = 'pluelus-api-buy-btn';
            apiBuyBtn.innerHTML = isUnavailable ? unavailableText : 'API Buy';
            apiBuyBtn.className = nativeBuyBtn.className;
            apiBuyBtn.style.marginTop = '10px';
            apiBuyBtn.style.width = '100%';
            if (isUnavailable) {
                apiBuyBtn.style.pointerEvents = 'none';
                apiBuyBtn.style.opacity = '0.6';
                apiBuyBtn.disabled = true;
                nativeBuyBtn.parentNode.insertBefore(apiBuyBtn, nativeBuyBtn.nextSibling);
                return;
            }
            apiBuyBtn.onclick = async () => {
                apiBuyBtn.innerHTML = 'Processing...';
                apiBuyBtn.style.pointerEvents = 'none';
                let expectedPrice = 0;
                const amountSpans = document.querySelectorAll('span[class*="amount-"]');
                if (amountSpans.length > 0) {
                    const parsed = parseInt(amountSpans[amountSpans.length - 1].textContent.replace(/,/g, ''), 10);
                    if (!isNaN(parsed)) expectedPrice = parsed;
                }
                let expectedSellerId = 1;
                const links = document.querySelectorAll('a[href*="/users/"], a[href*="/groups"]');
                for (const link of links) {
                    if (link.closest('nav') || link.closest('.sidebar') || link.closest('[class*="nav"]') || link.closest('.pluelus-sidebar')) continue;
                    const href = link.getAttribute('href');
                    if (!href) continue;
                    const userMatch = href.match(/\/users\/(\d+)/);
                    if (userMatch) { expectedSellerId = parseInt(userMatch[1], 10); break; }
                    const groupMatch = href.match(/\/groups.*(?:gid=|\/)(\d+)/);
                    if (groupMatch) { expectedSellerId = parseInt(groupMatch[1], 10); break; }
                }
                let csrfToken = '';
                const csrfMeta = document.querySelector('meta[name="csrf-token"]');
                if (csrfMeta) csrfToken = csrfMeta.getAttribute('content');
                try {
                    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
                    if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;
                    const payload = { expectedPrice, expectedSellerId, expectedCurrency: 1 };
                    let response = await fetch(`https://www.caelus.lol/apisite/economy/v1/purchases/products/${itemId}`, { method: 'POST', headers, body: JSON.stringify(payload) });
                    let respText = await response.text();
                    if (response.status === 403 && response.headers.has('x-csrf-token')) {
                        headers['X-CSRF-TOKEN'] = response.headers.get('x-csrf-token');
                        response = await fetch(`https://www.caelus.lol/apisite/economy/v1/purchases/products/${itemId}`, { method: 'POST', headers, body: JSON.stringify(payload) });
                        respText = await response.text();
                    }
                    if (response.ok) {
                        apiBuyBtn.innerHTML = 'Purchased Successfully';
                        apiBuyBtn.style.backgroundColor = '#10b981';
                        apiBuyBtn.style.borderColor = '#059669';
                        apiBuyBtn.style.color = '#ffffff';
                    } else {
                        const responseGet = await fetch(`https://www.caelus.lol/apisite/economy/v1/purchases/products/${itemId}`, { headers });
                        if (responseGet.ok) {
                            apiBuyBtn.innerHTML = 'Purchased Successfully';
                            apiBuyBtn.style.backgroundColor = '#10b981';
                            apiBuyBtn.style.borderColor = '#059669';
                            apiBuyBtn.style.color = '#ffffff';
                        } else {
                            apiBuyBtn.innerHTML = `Failed (${response.status})`;
                            apiBuyBtn.style.backgroundColor = '#ef4444';
                            apiBuyBtn.style.borderColor = '#b91c1c';
                            apiBuyBtn.style.color = '#ffffff';
                            alert(`[Pluelus API Buy Failed]\n\nStatus: ${response.status}\nBody: ${respText}`);
                        }
                    }
                } catch (e) {
                    apiBuyBtn.innerHTML = 'Network Error';
                    apiBuyBtn.style.backgroundColor = '#ef4444';
                    apiBuyBtn.style.borderColor = '#b91c1c';
                    apiBuyBtn.style.color = '#ffffff';
                }
                setTimeout(() => {
                    apiBuyBtn.innerHTML = 'API Buy';
                    apiBuyBtn.style.backgroundColor = '';
                    apiBuyBtn.style.borderColor = '';
                    apiBuyBtn.style.color = '';
                    apiBuyBtn.style.pointerEvents = 'auto';
                }, 5000);
            };
            nativeBuyBtn.parentNode.insertBefore(apiBuyBtn, nativeBuyBtn.nextSibling);
        };

        injectButton();
        apiBuyObserver = new MutationObserver(() => injectButton());
        apiBuyObserver.observe(document.body, { childList: true, subtree: true });
    };

    const applyCustomBackground = (bgData, affectSidebar, affectTopBar) => {
        let styleEl = document.getElementById('pluelus-custom-bg-style');
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'pluelus-custom-bg-style'; document.head.appendChild(styleEl); }
        if (bgData) {
            let css = `
                body, html, #root, #app { background-image: url("${bgData}") !important; background-size: cover !important; background-position: center !important; background-attachment: fixed !important; background-repeat: no-repeat !important; background-color: transparent !important; }
                .rbx-body, .caelus-my-settings-root, .content, #user-account, #settings-container, .left-navigation, .tab-content, .rbx-tab-content { background: transparent !important; background-color: transparent !important; }
                ::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
                ::-webkit-scrollbar-track { background: transparent !important; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2) !important; border-radius: 10px !important; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4) !important; }
                ::-webkit-scrollbar-button { display: none !important; }
                .popover, .dropdown-menu, .settings-menu { background: rgba(20,20,20,0.8) !important; backdrop-filter: blur(24px) !important; -webkit-backdrop-filter: blur(24px) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 8px !important; }
            `;
            if (affectSidebar) css += `div[class^="card-"] { background: rgba(15,15,15,0.5) !important; background-color: rgba(15,15,15,0.5) !important; backdrop-filter: blur(16px) !important; -webkit-backdrop-filter: blur(16px) !important; border: 1px solid rgba(255,255,255,0.05) !important; }`;
            if (affectTopBar) css += `nav[class^="navbar"] { background-color: rgba(15,15,15,0.5) !important; backdrop-filter: blur(16px) !important; -webkit-backdrop-filter: blur(16px) !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; } div[class^="logo-"], div[class^="top-"], div[class^="navlinksRow-"] { background-color: transparent !important; }`;
            styleEl.textContent = css;
        } else {
            styleEl.textContent = '';
        }
    };

    const applyAdBlocker = (enable) => {
        let styleEl = document.getElementById('pluelus-adblock-style');
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'pluelus-adblock-style'; document.head.appendChild(styleEl); }
        styleEl.textContent = enable ? `div[class^="adWrapper-"], div[class^="adColumn-"], a[href*="/userads/redirect"], iframe[src*="ads"] { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }` : '';
    };

    const applyAnimations = (enable) => {
        let styleEl = document.getElementById('pluelus-animations-style');
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'pluelus-animations-style'; document.head.appendChild(styleEl); }
        styleEl.textContent = enable ? `
            @keyframes pluelusEntrance { 0% { opacity:0; transform:translateY(12px) scale(0.998); filter:blur(4px); } 100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0); } }
            @keyframes pluelusChatIn { from { opacity:0; transform:translateX(20px) scale(0.98); filter:blur(5px); } to { opacity:1; transform:translateX(0) scale(1); filter:blur(0); } }
            .content, .container-main, .rbx-tab-content, .item-card, .game-card, .pluelus-setting-card, .section-content, .item-details, .profile-header, .group-card { animation: pluelusEntrance 0.6s cubic-bezier(0.16,1,0.3,1) forwards; }
            div[class*="chatMenu_chatMenuHeader__"] + div, div[class*="chat-container"], #chat-container, .chat-main { transition: all 0.4s cubic-bezier(0.16,1,0.3,1) !important; animation: pluelusChatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
            .sidebar .menu-option, .left-navigation .menu-option, #vertical-menu li { transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), background-color 0.2s ease !important; }
            .sidebar .menu-option:hover, .left-navigation .menu-option:hover, #vertical-menu li:hover { transform: translateX(6px) !important; }
            * { transition: background-color 0.3s ease, border-color 0.3s ease, opacity 0.3s ease !important; }
            .item-card:hover, .game-card:hover, .pluelus-setting-card:hover, .catalog-item-card:hover, .profile-card:hover, .asset-card:hover, .friend-card:hover, div[class*="card-"]:not([style*="padding-top: 72px"]):not([class*="card-d0-"]):hover { transform: translateY(-10px) scale(1.03) !important; box-shadow: 0 25px 50px rgba(0,0,0,0.5) !important; filter: contrast(1.05) brightness(1.05); z-index: 10; }
            div[class*="card-"][style*="padding-top: 72px"], div[class*="card-d0-"], [class*="sidebarAvatarImg-"] { transform: none !important; transition: none !important; box-shadow: none !important; }
            div[class*="card-"][style*="padding-top: 72px"]:hover, div[class*="card-d0-"]:hover { transform: none !important; box-shadow: none !important; }
            [class*="hover-icon-nav-"]:hover [class*="icon-nav-"] { transform: scale(1.25) rotate(10deg) !important; filter: brightness(1.4) drop-shadow(0 0 8px rgba(255,255,255,0.4)) !important; transition: all 0.3s cubic-bezier(0.16,1,0.3,1) !important; }
            [class*="icon-nav-"] { transition: all 0.3s cubic-bezier(0.16,1,0.3,1) !important; }
            button:hover, .pluelus-btn:hover { transform: translateY(-2px) scale(1.02); filter: brightness(1.15); }
            button:active, a:active { transform: scale(0.95) !important; }
            .dropdown-menu, .modal-content { animation: pluelusEntrance 0.3s cubic-bezier(0.16,1,0.3,1) forwards; backdrop-filter: blur(20px) !important; }
        ` : '';
    };

    const applyHideChat = (enable) => {
        let styleEl = document.getElementById('pluelus-hide-chat-style');
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'pluelus-hide-chat-style'; document.head.appendChild(styleEl); }
        styleEl.textContent = enable ? `div[class*="chatMenu_chatMenuHeader__"], .chat-container, #chat-container { display: none !important; }` : '';
    };

    const injectStyles = () => {
        if (document.getElementById('pluelus-ui-style')) return;
        const style = document.createElement('style');
        style.id = 'pluelus-ui-style';
        style.textContent = `
            :root { --pluelus-text-main:#ffffff; --pluelus-text-muted:rgba(255,255,255,0.6); --pluelus-primary:#ff2a5f; --pluelus-primary-hover:#ff4d79; --pluelus-radius:20px; --pluelus-transition:all 0.3s cubic-bezier(0.2,0.8,0.2,1); }
            @keyframes pluelusRootFadeIn { to { opacity:1; } }
            @keyframes pluelusSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
            @keyframes pluelusPopIn { 0% { opacity:0; transform:scale(0.9) translateY(10px); } 100% { opacity:1; transform:scale(1) translateY(0); } }
            .pluelus-tab-panel { display:none; animation:pluelusSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
            .pluelus-tab-panel.active { display:block; }
            .pluelus-tab-panel-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(380px,1fr)); gap:2rem; align-items:start; }
            .pluelus-card-full { grid-column:1/-1; }
            .pluelus-setting-card { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:var(--pluelus-radius); padding:2.5rem; box-shadow:0 15px 35px rgba(0,0,0,0.2); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); transition:var(--pluelus-transition); height:100%; box-sizing:border-box; animation:pluelusPopIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
            .pluelus-setting-card:hover { border-color:rgba(255,255,255,0.2); transform:translateY(-2px); }
            .pluelus-setting-card h3 { margin:0 0 0.5rem 0; font-size:1.25rem; font-weight:600; color:#fff; }
            .pluelus-setting-card p { color:var(--pluelus-text-muted); margin:0 0 2rem 0; line-height:1.5; font-size:0.95rem; }
            .pluelus-bg-configurator { display:flex; gap:2.5rem; margin-bottom:2rem; }
            .pluelus-bg-inputs { flex:1; display:flex; flex-direction:column; }
            .pluelus-bg-preview-wrapper { width:260px; flex-shrink:0; display:flex; flex-direction:column; }
            .pluelus-preview-area { width:100%; flex:1; min-height:160px; border-radius:16px; background-size:contain; background-position:center; background-repeat:no-repeat; display:none; border:1px solid rgba(255,255,255,0.1); background-color:rgba(0,0,0,0.5); box-shadow:inset 0 0 20px rgba(0,0,0,0.5); }
            .pluelus-quality-row { display:none; justify-content:space-between; align-items:center; margin-top:1rem; background:rgba(0,0,0,0.4); padding:1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.1); animation:pluelusRootFadeIn 0.3s ease forwards; }
            .pluelus-quality-text { font-size:0.9rem; color:var(--pluelus-text-main); font-weight:500; }
            .pluelus-quality-btns { display:flex; gap:0.5rem; }
            .pluelus-btn-small { padding:0.5rem 0.8rem; font-size:0.8rem; border-radius:8px; background:rgba(255,255,255,0.1); color:#fff; border:none; cursor:pointer; transition:var(--pluelus-transition); }
            .pluelus-btn-small:hover { background:rgba(255,255,255,0.2); }
            .pluelus-btn-small.active { background:var(--pluelus-primary); font-weight:bold; }
            .pluelus-input-group { margin-bottom:1.5rem; }
            .pluelus-input-group input { width:100%; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:1rem 1.25rem; border-radius:12px; font-size:1rem; font-family:inherit; box-sizing:border-box; transition:var(--pluelus-transition); }
            .pluelus-input-group input:focus { outline:none; border-color:var(--pluelus-primary); background:rgba(0,0,0,0.6); box-shadow:0 0 0 3px rgba(255,42,95,0.2); }
            .pluelus-file-upload { position:relative; display:flex; align-items:center; justify-content:center; }
            .pluelus-file-upload input[type="file"] { display:none; }
            .pluelus-file-upload label { background:rgba(0,0,0,0.2); border:2px dashed rgba(255,255,255,0.2); padding:1.25rem; width:100%; border-radius:12px; text-align:center; cursor:pointer; transition:var(--pluelus-transition); font-weight:600; font-size:0.95rem; color:var(--pluelus-text-muted); box-sizing:border-box; }
            .pluelus-file-upload label:hover { background:rgba(255,255,255,0.05); border-color:var(--pluelus-primary); color:#fff; }
            .pluelus-toggle-group { display:flex; flex-direction:column; gap:1.25rem; background:rgba(0,0,0,0.2); padding:1.5rem; border-radius:16px; border:1px solid rgba(255,255,255,0.05); }
            .pluelus-toggle-wrap { display:flex; justify-content:space-between; align-items:center; }
            .pluelus-toggle-label { font-size:1rem; font-weight:500; color:#fff; cursor:pointer; }
            .pluelus-toggle { position:relative; display:inline-block; width:48px; height:26px; }
            .pluelus-toggle input { opacity:0; width:0; height:0; }
            .pluelus-toggle-slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:rgba(255,255,255,0.1); transition:var(--pluelus-transition); border-radius:30px; }
            .pluelus-toggle-slider:before { position:absolute; content:""; height:20px; width:20px; left:3px; bottom:3px; background-color:#fff; transition:var(--pluelus-transition); border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.3); }
            .pluelus-toggle input:checked + .pluelus-toggle-slider { background-color:var(--pluelus-primary); }
            .pluelus-toggle input:checked + .pluelus-toggle-slider:before { transform:translateX(22px); }
            .pluelus-grid-section { margin-top:2.5rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:2rem; }
            .pluelus-grid-section h4 { font-size:0.9rem; font-weight:700; margin:0 0 1.25rem 0; color:var(--pluelus-text-muted); text-transform:uppercase; letter-spacing:0.05em; }
            .pluelus-bg-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:1.25rem; }
            .pluelus-grid-item { position:relative; width:100%; aspect-ratio:16/9; border-radius:12px; background-size:contain; background-position:center; background-repeat:no-repeat; border:1px solid rgba(255,255,255,0.1); cursor:pointer; transition:var(--pluelus-transition); overflow:hidden; background-color:rgba(0,0,0,0.6); }
            .pluelus-grid-item:hover { border-color:var(--pluelus-primary); transform:translateY(-4px); box-shadow:0 10px 20px rgba(0,0,0,0.3); }
            .pluelus-grid-item-star { position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); border-radius:8px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:14px; color:rgba(255,255,255,0.4); transition:var(--pluelus-transition); opacity:0; user-select:none; }
            .pluelus-grid-item:hover .pluelus-grid-item-star, .pluelus-grid-item-star.active { opacity:1; }
            .pluelus-grid-item-star.active { color:#fbbf24; text-shadow:0 0 10px rgba(251,191,36,0.5); }
            .pluelus-grid-item-star:hover { background:rgba(0,0,0,0.9); color:#fbbf24; transform:scale(1.1); }
            .pluelus-grid-item-remove { position:absolute; top:6px; left:6px; background:rgba(239,68,68,0.2); backdrop-filter:blur(4px); border:1px solid rgba(239,68,68,0.4); border-radius:8px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:18px; line-height:1; color:#ef4444; transition:var(--pluelus-transition); opacity:0; user-select:none; font-weight:bold; }
            .pluelus-grid-item:hover .pluelus-grid-item-remove { opacity:1; }
            .pluelus-grid-item-remove:hover { background:#ef4444; color:#fff; transform:scale(1.1); }
            .pluelus-subtabs { display:flex; gap:1.5rem; margin-bottom:2.5rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:1rem; }
            .pluelus-subtab { background:transparent; border:none; color:var(--pluelus-text-muted); font-size:1rem; font-weight:600; cursor:pointer; padding:0.5rem 0; position:relative; transition:var(--pluelus-transition); }
            .pluelus-subtab:hover { color:#fff; }
            .pluelus-subtab.active { color:var(--pluelus-primary); }
            .pluelus-subtab.active::after { content:''; position:absolute; bottom:-1rem; left:0; right:0; height:2px; background:var(--pluelus-primary); box-shadow:0 0 10px var(--pluelus-primary); }
            .pluelus-pane { display:none; }
            .pluelus-pane.active { display:block; }
            .pluelus-btn { padding:1rem 1.5rem; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer; transition:var(--pluelus-transition); border:none; outline:none; }
            .pluelus-btn-primary { background:var(--pluelus-primary); color:#fff; }
            .pluelus-btn-primary:hover { background:var(--pluelus-primary-hover); box-shadow:0 5px 15px rgba(255,42,95,0.4); }
            .pluelus-btn-danger { background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); width:100%; margin-top:1rem; }
            .pluelus-btn-danger:hover { background:rgba(239,68,68,0.2); border-color:#ef4444; transform:translateY(-2px); box-shadow:0 5px 15px rgba(239,68,68,0.2); }
        `;
        document.head.appendChild(style);
    };

    storage.get(['pluelusCustomBg', 'pluelusAffectSidebar', 'pluelusAffectTopBar', 'pluelusNoAds', 'pluelusApiBuy', 'pluelusAnimations', 'pluelusHideChat'], (result) => {
        const runTheme = () => {
            applyCustomBackground(result.pluelusCustomBg, result.pluelusAffectSidebar !== false, result.pluelusAffectTopBar !== false);
            applyAdBlocker(result.pluelusNoAds || false);
            applyApiBuy(result.pluelusApiBuy || false);
            applyAnimations(result.pluelusAnimations || false);
            applyHideChat(result.pluelusHideChat || false);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runTheme);
        } else {
            runTheme();
        }
    });

    const renderPluelusNativeUi = (container) => {
        container.innerHTML = '';
        const tabNav = document.createElement('div');
        tabNav.className = 'pluelus-subtabs';
        const generalTabBtn = document.createElement('button');
        generalTabBtn.className = 'pluelus-subtab active';
        generalTabBtn.textContent = 'General';
        const customizeTabBtn = document.createElement('button');
        customizeTabBtn.className = 'pluelus-subtab';
        customizeTabBtn.textContent = 'Customize';
        tabNav.appendChild(generalTabBtn);
        tabNav.appendChild(customizeTabBtn);
        container.appendChild(tabNav);
        const generalPane = document.createElement('div');
        generalPane.className = 'pluelus-pane active';
        const customizePane = document.createElement('div');
        customizePane.className = 'pluelus-pane';
        customizePane.style.display = 'none';
        generalTabBtn.onclick = () => { generalTabBtn.classList.add('active'); customizeTabBtn.classList.remove('active'); generalPane.style.display = 'block'; customizePane.style.display = 'none'; };
        customizeTabBtn.onclick = () => { customizeTabBtn.classList.add('active'); generalTabBtn.classList.remove('active'); customizePane.style.display = 'block'; generalPane.style.display = 'none'; };
        const generalGrid = document.createElement('div');
        generalGrid.className = 'pluelus-tab-panel-grid';
        const customizeGrid = document.createElement('div');
        customizeGrid.className = 'pluelus-tab-panel-grid';
        const bgCard = document.createElement('div');
        bgCard.className = 'pluelus-setting-card pluelus-card-full';
        const bgCardTitle = document.createElement('h3');
        bgCardTitle.textContent = 'Custom Background';
        const bgCardDesc = document.createElement('p');
        bgCardDesc.textContent = 'Set a custom image or GIF as your background.';
        const bgConfigurator = document.createElement('div');
        bgConfigurator.className = 'pluelus-bg-configurator';
        const bgInputs = document.createElement('div');
        bgInputs.className = 'pluelus-bg-inputs';
        const inputGroup = document.createElement('div');
        inputGroup.className = 'pluelus-input-group';
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'Paste image/GIF URL here...';
        inputGroup.appendChild(urlInput);
        const fileUpload = document.createElement('div');
        fileUpload.className = 'pluelus-file-upload';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'pluelus-bg-file';
        fileInput.accept = 'image/*';
        const fileLabel = document.createElement('label');
        fileLabel.htmlFor = 'pluelus-bg-file';
        fileLabel.textContent = 'Browse Local Files';
        fileUpload.appendChild(fileInput);
        fileUpload.appendChild(fileLabel);
        const resetBtn = document.createElement('button');
        resetBtn.className = 'pluelus-btn pluelus-btn-danger';
        resetBtn.textContent = 'Reset Background';
        bgInputs.appendChild(inputGroup);
        bgInputs.appendChild(fileUpload);
        bgInputs.appendChild(resetBtn);
        const bgPreviewWrapper = document.createElement('div');
        bgPreviewWrapper.className = 'pluelus-bg-preview-wrapper';
        const previewArea = document.createElement('div');
        previewArea.className = 'pluelus-preview-area';
        const qualityRow = document.createElement('div');
        qualityRow.className = 'pluelus-quality-row';
        const qualityText = document.createElement('div');
        qualityText.className = 'pluelus-quality-text';
        const qualityBtns = document.createElement('div');
        qualityBtns.className = 'pluelus-quality-btns';
        qualityRow.appendChild(qualityText);
        qualityRow.appendChild(qualityBtns);
        bgPreviewWrapper.appendChild(previewArea);
        bgPreviewWrapper.appendChild(qualityRow);
        bgConfigurator.appendChild(bgInputs);
        bgConfigurator.appendChild(bgPreviewWrapper);
        let selectedBgData = '', selectedAffectSidebar = true, selectedAffectTopBar = true;
        let selectedNoAds = false, selectedApiBuy = false, selectedAnimations = false, selectedHideChat = false;
        let bgHistory = [], bgFavorites = [];
        const favoritesSection = document.createElement('div');
        favoritesSection.className = 'pluelus-grid-section';
        const favoritesGrid = document.createElement('div');
        favoritesGrid.className = 'pluelus-bg-grid';
        favoritesSection.appendChild(favoritesGrid);
        const historySection = document.createElement('div');
        historySection.className = 'pluelus-grid-section';
        const historyGrid = document.createElement('div');
        historyGrid.className = 'pluelus-bg-grid';
        historySection.appendChild(historyGrid);
        const autoSave = () => {
            if (selectedBgData) { bgHistory = bgHistory.filter(bg => bg !== selectedBgData); bgHistory.unshift(selectedBgData); if (bgHistory.length > 15) bgHistory.pop(); }
            storage.set({ pluelusCustomBg: selectedBgData, pluelusAffectSidebar: selectedAffectSidebar, pluelusAffectTopBar: selectedAffectTopBar, pluelusHistory: bgHistory });
            applyCustomBackground(selectedBgData, selectedAffectSidebar, selectedAffectTopBar);
            renderGrids();
        };
        resetBtn.onclick = () => { selectedBgData = ''; urlInput.value = ''; previewArea.style.display = 'none'; qualityRow.style.display = 'none'; autoSave(); };
        let currentOriginalUrl = '', currentWidth = 0, currentHeight = 0;
        const applyQuality = (scale, btnElem) => {
            document.querySelectorAll('.pluelus-btn-small').forEach(b => b.classList.remove('active'));
            if (btnElem) btnElem.classList.add('active');
            if (scale === 1 || currentOriginalUrl.toLowerCase().includes('.gif')) { selectedBgData = currentOriginalUrl; autoSave(); return; }
            try {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = currentWidth * scale; canvas.height = currentHeight * scale; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); selectedBgData = canvas.toDataURL('image/jpeg', 0.8); autoSave(); };
                img.src = currentOriginalUrl;
            } catch(e) { selectedBgData = currentOriginalUrl; autoSave(); }
        };
        const validateAndSaveImage = (url) => {
            const img = new Image();
            img.onload = () => {
                currentOriginalUrl = url; currentWidth = img.naturalWidth; currentHeight = img.naturalHeight; selectedBgData = url;
                previewArea.style.display = 'block'; previewArea.style.backgroundImage = `url("${url}")`;
                qualityRow.style.display = 'flex'; qualityText.textContent = `${currentWidth}x${currentHeight}`; qualityBtns.innerHTML = '';
                const isGif = url.toLowerCase().includes('.gif');
                const btnHigh = document.createElement('button'); btnHigh.className = 'pluelus-btn-small active'; btnHigh.textContent = isGif ? 'Original GIF' : 'High'; btnHigh.onclick = () => applyQuality(1, btnHigh); qualityBtns.appendChild(btnHigh);
                if (!isGif) {
                    const btnMed = document.createElement('button'); btnMed.className = 'pluelus-btn-small'; btnMed.textContent = 'Medium'; btnMed.onclick = () => applyQuality(0.5, btnMed); qualityBtns.appendChild(btnMed);
                    const btnLow = document.createElement('button'); btnLow.className = 'pluelus-btn-small'; btnLow.textContent = 'Low'; btnLow.onclick = () => applyQuality(0.25, btnLow); qualityBtns.appendChild(btnLow);
                }
                autoSave();
            };
            img.onerror = () => { previewArea.style.display = 'none'; qualityRow.style.display = 'none'; };
            img.src = url;
        };
        urlInput.addEventListener('input', (e) => { const url = e.target.value.trim(); if (url) validateAndSaveImage(url); });
        fileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => validateAndSaveImage(event.target.result); reader.readAsDataURL(file); } });
        const toggleFavorite = (bg, e) => { e.stopPropagation(); if (bgFavorites.includes(bg)) { bgFavorites = bgFavorites.filter(f => f !== bg); } else { bgFavorites.unshift(bg); } storage.set({ pluelusFavorites: bgFavorites }); renderGrids(); };
        const removeHistoryItem = (bg, e) => {
            e.stopPropagation();
            if (confirm("Remove background?")) {
                bgHistory = bgHistory.filter(i => i !== bg); bgFavorites = bgFavorites.filter(i => i !== bg);
                storage.set({ pluelusHistory: bgHistory, pluelusFavorites: bgFavorites });
                if (selectedBgData === bg) { selectedBgData = ''; urlInput.value = ''; previewArea.style.display = 'none'; autoSave(); } else { renderGrids(); }
            }
        };
        const renderGrids = () => {
            favoritesGrid.innerHTML = ''; historyGrid.innerHTML = '';
            if (bgFavorites.length === 0) favoritesGrid.innerHTML = '<p style="color:var(--pluelus-text-muted);">No favorites yet.</p>';
            bgFavorites.forEach(bg => { const item = document.createElement('div'); item.className = 'pluelus-grid-item'; item.style.backgroundImage = `url("${bg}")`; const star = document.createElement('div'); star.className = 'pluelus-grid-item-star active'; star.textContent = '★'; star.onclick = (e) => toggleFavorite(bg, e); const removeBtn = document.createElement('div'); removeBtn.className = 'pluelus-grid-item-remove'; removeBtn.textContent = '×'; removeBtn.onclick = (e) => removeHistoryItem(bg, e); item.onclick = () => validateAndSaveImage(bg); item.appendChild(removeBtn); item.appendChild(star); favoritesGrid.appendChild(item); });
            if (bgHistory.length === 0) historyGrid.innerHTML = '<p style="color:var(--pluelus-text-muted);">No history yet.</p>';
            bgHistory.forEach(bg => { const item = document.createElement('div'); item.className = 'pluelus-grid-item'; item.style.backgroundImage = `url("${bg}")`; const isFav = bgFavorites.includes(bg); const star = document.createElement('div'); star.className = `pluelus-grid-item-star ${isFav ? 'active' : ''}`; star.textContent = isFav ? '★' : '☆'; star.onclick = (e) => toggleFavorite(bg, e); const removeBtn = document.createElement('div'); removeBtn.className = 'pluelus-grid-item-remove'; removeBtn.textContent = '×'; removeBtn.onclick = (e) => removeHistoryItem(bg, e); item.onclick = () => validateAndSaveImage(bg); item.appendChild(removeBtn); item.appendChild(star); historyGrid.appendChild(item); });
        };
        const toggleGroup = document.createElement('div');
        toggleGroup.className = 'pluelus-toggle-group';
        const createToggle = (id, labelText, defaultState, callback) => {
            const wrap = document.createElement('div'); wrap.className = 'pluelus-toggle-wrap';
            const label = document.createElement('label'); label.className = 'pluelus-toggle-label'; label.htmlFor = id; label.textContent = labelText;
            const toggle = document.createElement('label'); toggle.className = 'pluelus-toggle'; toggle.htmlFor = id;
            const input = document.createElement('input'); input.type = 'checkbox'; input.id = id; input.checked = defaultState;
            const slider = document.createElement('span'); slider.className = 'pluelus-toggle-slider';
            input.addEventListener('change', (e) => callback(e.target.checked));
            toggle.appendChild(input); toggle.appendChild(slider); wrap.appendChild(label); wrap.appendChild(toggle);
            return wrap;
        };
        bgCard.appendChild(bgCardTitle); bgCard.appendChild(bgCardDesc); bgCard.appendChild(bgConfigurator); bgCard.appendChild(toggleGroup); bgCard.appendChild(favoritesSection); bgCard.appendChild(historySection);
        const adCard = document.createElement('div'); adCard.className = 'pluelus-setting-card';
        const adCardTitle = document.createElement('h3'); adCardTitle.textContent = 'Ad Blocker';
        const adCardDesc = document.createElement('p'); adCardDesc.textContent = 'Remove all advertisements across the website.';
        const animCard = document.createElement('div'); animCard.className = 'pluelus-setting-card';
        const animCardTitle = document.createElement('h3'); animCardTitle.textContent = 'Website Animations';
        const animCardDesc = document.createElement('p'); animCardDesc.textContent = 'Adds cool animations to pages, cards, and buttons.';
        const hideChatCard = document.createElement('div'); hideChatCard.className = 'pluelus-setting-card';
        const hideChatTitle = document.createElement('h3'); hideChatTitle.textContent = 'Hide Chat';
        const hideChatDesc = document.createElement('p'); hideChatDesc.textContent = 'Hide the chat menu and interface completely.';
        const apiBuyCard = document.createElement('div'); apiBuyCard.className = 'pluelus-setting-card';
        const apiBuyTitle = document.createElement('h3'); apiBuyTitle.textContent = 'Platform Features';
        const apiBuyDesc = document.createElement('p'); apiBuyDesc.textContent = 'Enable API Buy button on item pages.';
        storage.get({ pluelusCustomBg: null, pluelusAffectSidebar: true, pluelusAffectTopBar: true, pluelusHistory: [], pluelusFavorites: [], pluelusNoAds: false, pluelusApiBuy: false, pluelusAnimations: false, pluelusHideChat: false }, (result) => {
            if (result.pluelusHistory) bgHistory = result.pluelusHistory;
            if (result.pluelusFavorites) bgFavorites = result.pluelusFavorites;
            if (result.pluelusCustomBg) { selectedBgData = result.pluelusCustomBg; if (selectedBgData.startsWith('http')) urlInput.value = selectedBgData; previewArea.style.display = 'block'; previewArea.style.backgroundImage = `url("${selectedBgData}")`; }
            selectedAffectSidebar = result.pluelusAffectSidebar !== false;
            selectedAffectTopBar = result.pluelusAffectTopBar !== false;
            selectedNoAds = result.pluelusNoAds || false;
            selectedApiBuy = result.pluelusApiBuy || false;
            selectedAnimations = result.pluelusAnimations || false;
            selectedHideChat = result.pluelusHideChat || false;
            toggleGroup.appendChild(createToggle('pluelus-sidebar', 'Affect Sidebar', selectedAffectSidebar, (val) => { selectedAffectSidebar = val; autoSave(); }));
            toggleGroup.appendChild(createToggle('pluelus-topbar', 'Affect Top Bar', selectedAffectTopBar, (val) => { selectedAffectTopBar = val; autoSave(); }));
            adCard.appendChild(adCardTitle); adCard.appendChild(adCardDesc);
            adCard.appendChild(createToggle('pluelus-ads', 'Enable Ad Blocker', selectedNoAds, (val) => { selectedNoAds = val; storage.set({ pluelusNoAds: val }); applyAdBlocker(val); }));
            animCard.appendChild(animCardTitle); animCard.appendChild(animCardDesc);
            animCard.appendChild(createToggle('pluelus-animations', 'Website Animations', selectedAnimations, (val) => { selectedAnimations = val; storage.set({ pluelusAnimations: val }); applyAnimations(val); }));
            hideChatCard.appendChild(hideChatTitle); hideChatCard.appendChild(hideChatDesc);
            hideChatCard.appendChild(createToggle('pluelus-hidechat', 'Hide Chat', selectedHideChat, (val) => { selectedHideChat = val; storage.set({ pluelusHideChat: val }); applyHideChat(val); }));
            apiBuyCard.appendChild(apiBuyTitle); apiBuyCard.appendChild(apiBuyDesc);
            apiBuyCard.appendChild(createToggle('pluelus-apibuy', 'API Buy Button', selectedApiBuy, (val) => { selectedApiBuy = val; storage.set({ pluelusApiBuy: val }); applyApiBuy(val); }));
            renderGrids();
        });
        customizeGrid.appendChild(bgCard);
        generalGrid.appendChild(adCard); generalGrid.appendChild(animCard); generalGrid.appendChild(hideChatCard); generalGrid.appendChild(apiBuyCard);
        generalPane.appendChild(generalGrid);
        customizePane.appendChild(customizeGrid);
        container.appendChild(generalPane);
        container.appendChild(customizePane);
    };

    const watchForNativeTabs = () => {
        if (settingsObserver) return;
        const injectNativeTab = () => {
            if (!window.location.pathname.startsWith('/my/account')) return;
            const verticalMenu = document.getElementById('vertical-menu');
            if (!verticalMenu) return;
            let pluelusTab = document.getElementById('pluelus-settings-tab');
            if (!pluelusTab) {
                pluelusTab = document.createElement('a');
                pluelusTab.href = '#'; pluelusTab.role = 'tab'; pluelusTab.className = 'rbx-tab-heading'; pluelusTab.id = 'pluelus-settings-tab';
                pluelusTab.innerHTML = '<span class="font-caption-header">Pluelus</span>';
                const li = document.createElement('li'); li.className = 'menu-option'; li.role = 'presentation'; li.appendChild(pluelusTab);
                verticalMenu.appendChild(li);
            }
            let tabContentContainer = document.querySelector('.tab-content, .rbx-tab-content, [class*="tab-content"]');
            if (!tabContentContainer) { const activePane = document.querySelector('.tab-pane.active') || document.querySelector('.tab-pane'); if (activePane) tabContentContainer = activePane.parentElement; }
            if (!tabContentContainer) return;
            let pluelusPane = document.getElementById('pluelus-settings-pane');
            if (!pluelusPane) {
                pluelusPane = document.createElement('div');
                pluelusPane.id = 'pluelus-settings-pane'; pluelusPane.className = 'tab-pane pluelus-tab-panel'; pluelusPane.style.display = 'none'; pluelusPane.style.padding = '20px';
                renderPluelusNativeUi(pluelusPane);
                tabContentContainer.appendChild(pluelusPane);
            }
            pluelusTab.onclick = (e) => {
                e.preventDefault();
                if (!document.getElementById('pluelus-settings-pane')) tabContentContainer.appendChild(pluelusPane);
                Array.from(tabContentContainer.children).forEach(child => { if (child.id !== 'pluelus-settings-pane') child.style.display = 'none'; });
                document.querySelectorAll('.rbx-tab-heading').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('li.active').forEach(li => li.classList.remove('active'));
                pluelusTab.parentElement.classList.add('active'); pluelusTab.classList.add('active'); pluelusPane.style.display = 'block';
            };
            const tabs = verticalMenu.querySelectorAll('.rbx-tab-heading');
            tabs.forEach(t => {
                if (t.id === 'pluelus-settings-tab') return;
                if (!t.dataset.pluelusBound) {
                    t.dataset.pluelusBound = 'true';
                    t.addEventListener('click', () => {
                        if (pluelusPane) pluelusPane.style.display = 'none';
                        if (pluelusTab) { pluelusTab.classList.remove('active'); if (pluelusTab.parentElement) pluelusTab.parentElement.classList.remove('active'); }
                        Array.from(tabContentContainer.children).forEach(child => { if (child.id !== 'pluelus-settings-pane') child.style.display = ''; });
                    });
                }
            });
        };
        injectNativeTab();
        settingsObserver = new MutationObserver(() => injectNativeTab());
        settingsObserver.observe(document.body, { childList: true, subtree: true });
    };

    const initPluelus = () => { injectStyles(); watchForNativeTabs(); };

    window.addEventListener('popstate', initPluelus);
    const originalPushState = history.pushState;
    history.pushState = function () { originalPushState.apply(this, arguments); initPluelus(); };
    const originalReplaceState = history.replaceState;
    history.replaceState = function () { originalReplaceState.apply(this, arguments); initPluelus(); };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPluelus);
    } else {
        initPluelus();
    }
})();
