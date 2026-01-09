// ==UserScript==
// @name        JSS Caffeinate (SSO Optimized)
// @version     2.5
// @description Multi-tab lock synchronization for seamless SSO restoration.
// @match       https://hrt.jamfcloud.com/*
// @match       https://us.auth.jamf.com/*
// @grant       none
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    const scriptName = "JSS Caffeinate";
    const scriptVersion = "2.5";
    const ssoUrl = "https://hrt.jamfcloud.com/oauth2/authorization/idp-us-hudson-trading.com";
    const keepAliveDelay = 120000; 
    let currentHref = window.location.href;

    if (!window.name || !window.name.startsWith('jss_tab_')) {
        window.name = 'jss_tab_' + Math.random().toString(36).substr(2, 9);
    }
    const tabId = window.name;
    const bookmarkKey = `bookmark_${tabId}`;
    const reauthLockKey = 'jss_reauth_lock';

    const debug = (m) => {
        console.log(`${scriptName} [${new Date().toLocaleTimeString()}]: ${m}`);
    };

    // --- Persistence Engine ---
    const saveCurrentPage = (source) => {
        const url = window.location.href;
        const path = window.location.pathname;
        const isExcluded = path === '/' || path === '/dashboard' || path.includes('dashboard.html') || 
                           path.includes('index.html') || path.includes('/logout') || 
                           path.includes('/login') || url.includes('original_url=') || 
                           url.includes('auth.jamf.com');

        if (isExcluded) return;
        localStorage.setItem(bookmarkKey, url);
        debug(`[SAVE] ${source} | URL: ${url}`);
    };

    const restoreLastPage = () => {
        const savedUrl = localStorage.getItem(bookmarkKey);
        const path = window.location.pathname;
        const isAtLanding = path === '/' || path === '/dashboard' || 
                            path.includes('dashboard.html') || path.includes('index.html');

        if (savedUrl) {
            if (window.location.href.split('?')[0] === savedUrl.split('?')[0]) {
                debug("[RESTORE] Destination reached. Clearing bookmark.");
                localStorage.removeItem(bookmarkKey);
                return true;
            }
            if (isAtLanding) {
                debug(`[RESTORE] Landing page detected. Redirecting to unique bookmark: ${savedUrl}`);
                window.location.replace(savedUrl);
                return true;
            }
        }
        return false;
    };

    // --- Enhanced SSO Logic ---
    const checkStatus = () => {
        if (!document.body) return false;
        const url = window.location.href;
        const bodyText = document.body.innerText;
        
        const isLogoutPage = url.includes('/logout') || bodyText.includes("successfully logged out");
        const isLoginPage = url.includes('/login') || url.includes('original_url=') || url.includes('authorize/resume');

        if (isLogoutPage || isLoginPage) {
            const lock = localStorage.getItem(reauthLockKey);
            if (lock && (Date.now() - parseInt(lock)) < 45000) {
                // LOCK IS ACTIVE: Monitor the lock to see when it's safe to refresh
                if (!window.lockMonitorActive) {
                    window.lockMonitorActive = true;
                    debug("[STATUS] Another tab is handling SSO. Waiting for lock release...");
                    const lockWatcher = setInterval(() => {
                        if (!localStorage.getItem(reauthLockKey)) {
                            debug("[STATUS] Lock released! Refreshing this tab to restore session...");
                            clearInterval(lockWatcher);
                            window.location.href = location.origin;
                        }
                    }, 2000);
                }
                return true;
            }
            // NO LOCK: Acquire it and start SSO
            debug("[STATUS] Session invalid. Starting SSO handshake...");
            localStorage.setItem(reauthLockKey, Date.now().toString());
            location.href = ssoUrl;
            return true;
        }
        return false;
    };

    // --- Start Execution ---
    console.log(`[${scriptName} v${scriptVersion}] Script loaded. Tab ID: ${tabId}`);

    const startApp = () => {
        // If we are on a valid functional page, release the lock for all other tabs
        if (window.location.href.includes('jamfcloud.com') && !window.location.pathname.includes('login')) {
            if (localStorage.getItem(reauthLockKey)) {
                debug("[INIT] Session valid. Releasing lock for other tabs.");
                localStorage.removeItem(reauthLockKey);
            }
        }

        // 1. URL Change Watcher
        setInterval(() => {
            if (window.location.href !== currentHref) {
                currentHref = window.location.href;
                saveCurrentPage("Watcher");
            }
        }, 2000);

        // 2. Restoration Watcher (Checks for 30s)
        let restoreAttempts = 0;
        const restoreInterval = setInterval(() => {
            if (restoreLastPage() || restoreAttempts > 60) {
                clearInterval(restoreInterval);
            }
            restoreAttempts++;
        }, 500);

        // 3. UI and Session Stability
        const initUI = () => {
            if (!checkStatus()) {
                saveCurrentPage("Init");
                if (!document.getElementById('jss-caffeinate-indicator')) {
                    const el = document.createElement('div');
                    el.id = 'jss-caffeinate-indicator';
                    el.innerHTML = '☕';
                    el.style = `position: fixed; bottom: 10px; right: 10px; z-index: 9999; font-size: 24px; cursor: pointer; opacity: 0.6; filter: grayscale(100%);`;
                    el.onclick = () => { saveCurrentPage("Manual"); debug("[UI] Manual boost."); };
                    document.body.appendChild(el);
                    debug("[INIT] Stability achieved.");
                }
            }
        };

        const stabilityInterval = setInterval(() => {
            if (document.querySelector('jamf-pro-sidebar') || document.querySelector('.sidebar')) {
                clearInterval(stabilityInterval);
                initUI();
            }
        }, 1000);

        setInterval(checkStatus, 5000);

        // Keepalive
        setTimeout(() => {
            setInterval(() => {
                if (window.location.href.includes('hrt.jamfcloud.com') && !checkStatus()) {
                    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    debug("[KEEPALIVE] Event sent.");
                }
            }, keepAliveDelay);
        }, 60000);
    };

    if (document.readyState === 'complete') { startApp(); } 
    else { window.addEventListener('load', startApp); }

})();