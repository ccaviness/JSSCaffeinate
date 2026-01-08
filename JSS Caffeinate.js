// ==UserScript==
// @name        JSS Caffeinate (SSO Optimized)
// @version     1.2
// @description Improved Deep Linking and more robust session restoration.
// @match       https://hrt.jamfcloud.com/*
// @grant       none
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    const scriptName = (typeof GM_info !== 'undefined') ? GM_info.script.name : "JSS Caffeinate";
    const scriptVersion = (typeof GM_info !== 'undefined') ? GM_info.script.version : "1.2";
    const ssoUrl = "https://hrt.jamfcloud.com/oauth2/authorization/idp-us-hudson-trading.com";
    const delay = 120000; 
    const jssCaffeinateDebug = true;

    const debug = (m) => {
        if (jssCaffeinateDebug) {
            console.log(`${scriptName} [${new Date().toLocaleTimeString()}]: ${m}`);
        }
    };

    // --- Deep Linking Logic ---
    const saveCurrentPage = () => {
        const url = window.location.href;
        const path = window.location.pathname;
        
        // Don't bookmark the dashboard, login, or logout pages
        const isExcluded = path === '/' || path === '/dashboard' || path.includes('/logout') || path.includes('/login');
        
        if (!isExcluded) {
            sessionStorage.setItem('jss_last_good_url', url);
            debug(`Bookmarked current page: ${url}`);
        }
    };

    const restoreLastPage = () => {
        const savedUrl = sessionStorage.getItem('jss_last_good_url');
        const currentUrl = window.location.href;
        const isAtLanding = window.location.pathname === '/' || window.location.pathname === '/dashboard';

        debug(`Restoration check: Saved=[${savedUrl ? 'YES' : 'NONE'}], AtLanding=[${isAtLanding}]`);

        if (savedUrl && savedUrl !== currentUrl && isAtLanding) {
            debug(`Success! Restoring deep link to: ${savedUrl}`);
            sessionStorage.removeItem('jss_last_good_url');
            window.location.href = savedUrl;
            return true;
        }
        return false;
    };

    const login = () => {
        debug("Redirecting to SSO for re-auth...");
        location.href = ssoUrl;
    };

    const pulseIndicator = () => {
        const el = document.getElementById('jss-caffeinate-indicator');
        if (!el) return;
        el.style.filter = 'grayscale(0%)';
        el.style.transform = 'scale(1.3)';
        el.style.opacity = '1';
        setTimeout(() => {
            el.style.filter = 'grayscale(100%)';
            el.style.transform = 'scale(1)';
            el.style.opacity = '0.6';
        }, 1000);
    };

    const triggerKeepAlive = () => {
        const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
        document.dispatchEvent(mousedown);
        pulseIndicator();
        saveCurrentPage(); // Update bookmark whenever we caffeinate
        debug("Keep-alive triggered and page bookmarked.");
    };

    const createIndicator = () => {
        if (document.getElementById('jss-caffeinate-indicator')) return;
        const el = document.createElement('div');
        el.id = 'jss-caffeinate-indicator';
        el.innerHTML = '☕';
        el.style = `position: fixed; bottom: 10px; right: 10px; z-index: 9999; font-size: 24px; cursor: pointer; opacity: 0.6; transition: all 0.5s ease; filter: grayscale(100%); user-select: none;`;
        el.title = `Click to force refresh session\n${scriptName} v${scriptVersion}`;
        el.onclick = triggerKeepAlive;
        document.body.appendChild(el);
    };

    const checkStatus = () => {
        if (location.pathname.includes('/logout') || document.body.innerText.includes("successfully logged out")) {
            debug("Logout detected. Redirecting...");
            login();
            return true;
        }
        return false;
    };

    // --- Main Execution Flow ---
    console.log(`[${scriptName} v${scriptVersion}] Script loaded.`);
    
    // Check Status immediately on load
    checkStatus();

    // Setup monitoring after page load
    window.addEventListener('load', () => {
        // 1. Try to restore the sub-page
        if (!restoreLastPage()) {
            // 2. If not restoring, set up the UI and monitoring
            setTimeout(createIndicator, 1000);
            debug("Status monitor (Interval mode) active.");
        }
        
        // Background check for logout text every 5s
        setInterval(checkStatus, 5000);
    });

    // Caffeinate Interval
    setInterval(() => {
        const isAuthPage = location.pathname.includes('/login') || location.pathname.includes('/oauth2');
        if (checkStatus() || isAuthPage) return;

        triggerKeepAlive();
        
        try {
            if (localStorage.authToken) {
                const remaining = JSON.parse(localStorage.authToken).expires - Date.now();
                if (remaining < 1) login();
            }
        } catch (e) {}
    }, delay);

})();