// ==UserScript==
// @name        JSS Caffeinate (Generic)
// @version     1.4
// @description Keeps Jamf Pro alive with a prominent red banner alert for manual re-auth.
// @match       https://*.jamfcloud.com/*
// @match       https://us.auth.jamf.com/*
// @grant       none
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // ================= CONFIGURATION =================
    // Update this suffix to match your SSO identity provider domain
    // Example: "idp-us-yourcompany.com"
    const ssoSuffix = "YOUR_SSO_IDP_SUFFIX_HERE";
    // =================================================

    const scriptName = "JSS Caffeinate";
    const scriptVersion = "1.4";
    const keepAliveDelay = 120000;
    const jamfUrl = window.location.origin;
    const ssoUrl = `${jamfUrl}/oauth2/authorization/${ssoSuffix}`;

    let currentHref = window.location.href;

    if (!window.name || !window.name.startsWith('jss_tab_')) {
        window.name = 'jss_tab_' + Math.random().toString(36).substr(2, 9);
    }
    const tabId = window.name;
    const bookmarkKey = `bookmark_${tabId}`;
    const reauthLockKey = 'jss_reauth_lock';

    const debug = (m) => { console.log(`${scriptName} [${new Date().toLocaleTimeString()}]: ${m}`); };

    const saveCurrentPage = () => {
        const url = window.location.href;
        const path = window.location.pathname;
        const isExcluded = path === '/' || path === '/dashboard' || path.includes('dashboard.html') ||
                           path.includes('index.html') || path.includes('/logout') ||
                           path.includes('/login') || url.includes('original_url=') ||
                           url.includes('auth.jamf.com');
        if (isExcluded) return;
        localStorage.setItem(bookmarkKey, url);
    };

    const restoreLastPage = () => {
        const savedUrl = localStorage.getItem(bookmarkKey);
        const isAtLanding = window.location.pathname === '/' || window.location.pathname === '/dashboard';
        if (savedUrl && isAtLanding && window.location.href !== savedUrl) {
            debug(`[RESTORE] Redirecting to bookmark: ${savedUrl}`);
            localStorage.removeItem(bookmarkKey);
            window.location.replace(savedUrl);
            return true;
        }
        return false;
    };

    const showManualAlert = () => {
        if (document.getElementById('jss-reauth-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'jss-reauth-banner';
        banner.innerHTML = `<strong>⚠️ ${scriptName} Action Required:</strong> SSO re-auth failed. Please enter your email to sign in manually.`;
        banner.style = `
            position: fixed; top: 0; left: 0; width: 100%; z-index: 10000;
            background: #d93025; color: white; text-align: center;
            padding: 15px; font-family: sans-serif; font-size: 16px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        document.body.prepend(banner);

        const el = document.getElementById('jss-caffeinate-indicator');
        if (el) el.style.filter = 'grayscale(0%) sepia(100%) hue-rotate(-50deg) saturate(600%)';
    };

    const checkStatus = () => {
        if (!document.body) return false;
        const url = window.location.href;
        const bodyText = document.body.innerText;

        const isAuthPage = url.includes('/login') || url.includes('auth.jamf.com');
        const hasError = url.includes('error=') || url.includes('forbidden') || bodyText.includes("something went wrong");

        if (isAuthPage && hasError) {
            debug("[STATUS] Manual intervention required. Showing alert banner.");
            showManualAlert();
            return false;
        }

        const isLogout = url.includes('/logout') || bodyText.includes("successfully logged out");
        const isLogin = url.includes('/login') || url.includes('original_url=');
        const isDenied = bodyText.includes("Access denied") && bodyText.includes("identity provider");

        if (isLogout || isLogin || isDenied) {
            const lock = localStorage.getItem(reauthLockKey);
            if (lock && (Date.now() - parseInt(lock)) < 45000) {
                if (!window.lockMonitorActive) {
                    window.lockMonitorActive = true;
                    const lockWatcher = setInterval(() => {
                        if (!localStorage.getItem(reauthLockKey)) {
                            clearInterval(lockWatcher);
                            window.location.href = jamfUrl;
                        }
                    }, 2000);
                }
                return true;
            }
            localStorage.setItem(reauthLockKey, Date.now().toString());
            location.href = ssoUrl;
            return true;
        }
        return false;
    };

    const initUI = () => {
        if (document.getElementById('jss-caffeinate-indicator')) return;
        const el = document.createElement('div');
        el.id = 'jss-caffeinate-indicator';
        el.innerHTML = '☕';
        el.style = `position: fixed; bottom: 10px; right: 10px; z-index: 9999; font-size: 24px; cursor: pointer; opacity: 0.6; filter: grayscale(100%);`;
        el.title = `JSS Caffeinate v${scriptVersion}`;
        el.onclick = () => { document.dispatchEvent(new MouseEvent('mousedown', {bubbles:true})); saveCurrentPage(); debug("Manual boost."); };
        document.body.appendChild(el);
    };

    const startApp = () => {
        if (window.location.href.includes('jamfcloud.com') && !window.location.pathname.includes('login')) {
            localStorage.removeItem(reauthLockKey);
        }

        let attempts = 0;
        const restorer = setInterval(() => {
            if (restoreLastPage() || attempts > 40) clearInterval(restorer);
            attempts++;
        }, 500);

        // UI Initialization - Wait for sidebar OR the login card OR error text
        const stabInterval = setInterval(() => {
            const hasSidebar = document.querySelector('jamf-pro-sidebar');
            const hasCard = document.querySelector('.card') || document.querySelector('jamf-pro-card');
            const hasLogin = window.location.pathname.includes('login');

            if (hasSidebar || hasCard || hasLogin) {
                clearInterval(stabInterval);
                initUI();
                checkStatus();
            }
        }, 1000);

        setInterval(checkStatus, 5000);
        setInterval(saveCurrentPage, 5000);

        setTimeout(() => {
            setInterval(() => {
                if (window.location.href.includes('jamfcloud.com') && !checkStatus()) {
                    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    debug("[KEEPALIVE] Event sent.");
                }
            }, keepAliveDelay);
        }, 45000);
    };

    console.log(`[${scriptName} v${scriptVersion}] Script loaded.`);
    if (document.readyState === 'complete') { startApp(); } else { window.addEventListener('load', startApp); }
})();