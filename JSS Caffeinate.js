// ==UserScript==
// @name        JSS Caffeinate (Generic)
// @version     3.0
// @description Keeps Jamf Pro sessions alive across multiple tabs with deep link restoration.
// @match       https://*.jamfcloud.com/*
// @match       https://us.auth.jamf.com/*
// @grant       none
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // ================= CONFIGURATION =================
    // Users only need to set their SSO IDP suffix here.
    // Example: "idp-us-company.com"
    const ssoSuffix = "YOUR_IDP_SUFFIX_HERE"; 
    // =================================================

    const scriptName = "JSS Caffeinate";
    const scriptVersion = "3.0";
    const keepAliveDelay = 120000;
    
    // Dynamically detect the Jamf Instance URL
    const jamfUrl = window.location.origin;
    const ssoUrl = `${jamfUrl}/oauth2/authorization/${ssoSuffix}`;
    
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
        // debug(`[SAVE] ${source} | URL: ${url}`);
    };

    const restoreLastPage = () => {
        const savedUrl = localStorage.getItem(bookmarkKey);
        const path = window.location.pathname;
        const isAtLanding = path === '/' || path === '/dashboard' || 
                            path.includes('dashboard.html') || path.includes('index.html');

        if (savedUrl) {
            if (window.location.href.split('?')[0] === savedUrl.split('?')[0]) {
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

    // --- SSO Logic ---
    const checkStatus = () => {
        if (!document.body) return false;
        const url = window.location.href;
        const bodyText = document.body.innerText;
        
        const isLogoutPage = url.includes('/logout') || bodyText.includes("successfully logged out");
        const isLoginPage = url.includes('/login') || url.includes('original_url=') || url.includes('authorize/resume');

        if (isLogoutPage || isLoginPage) {
            const lock = localStorage.getItem(reauthLockKey);
            if (lock && (Date.now() - parseInt(lock)) < 45000) {
                if (!window.lockMonitorActive) {
                    window.lockMonitorActive = true;
                    debug("[STATUS] Another tab is handling SSO. Waiting...");
                    const lockWatcher = setInterval(() => {
                        if (!localStorage.getItem(reauthLockKey)) {
                            clearInterval(lockWatcher);
                            window.location.href = jamfUrl;
                        }
                    }, 2000);
                }
                return true;
            }
            debug("[STATUS] Session invalid. Starting SSO handshake...");
            localStorage.setItem(reauthLockKey, Date.now().toString());
            location.href = ssoUrl;
            return true;
        }
        return false;
    };

    // --- Start Execution ---
    console.log(`[${scriptName} v${scriptVersion}] Script loaded. Instance: ${jamfUrl}`);

    const startApp = () => {
        if (window.location.href.includes('jamfcloud.com') && !window.location.pathname.includes('login')) {
            localStorage.removeItem(reauthLockKey);
        }

        setInterval(() => {
            if (window.location.href !== currentHref) {
                currentHref = window.location.href;
                saveCurrentPage("Watcher");
            }
        }, 2000);

        let restoreAttempts = 0;
        const restoreInterval = setInterval(() => {
            if (restoreLastPage() || restoreAttempts > 60) {
                clearInterval(restoreInterval);
            }
            restoreAttempts++;
        }, 500);

        const stabilityInterval = setInterval(() => {
            if (document.querySelector('jamf-pro-sidebar') || document.querySelector('.sidebar')) {
                clearInterval(stabilityInterval);
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
            }
        }, 1000);

        setInterval(checkStatus, 5000);

        setTimeout(() => {
            setInterval(() => {
                if (window.location.href.includes('jamfcloud.com') && !checkStatus()) {
                    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    debug("[KEEPALIVE] Event sent.");
                }
            }, keepAliveDelay);
        }, 60000);
    };

    if (document.readyState === 'complete') { startApp(); } 
    else { window.addEventListener('load', startApp); }

})();