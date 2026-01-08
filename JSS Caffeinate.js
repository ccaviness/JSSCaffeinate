// ==UserScript==
// @name        JSS Caffeinate (SSO Optimized)
// @version     1.1
// @description High-stability version with light monitoring and improved logout logic.
// @match       https://hrt.jamfcloud.com/*
// @grant       none
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    const scriptName = (typeof GM_info !== 'undefined') ? GM_info.script.name : "JSS Caffeinate";
    const scriptVersion = (typeof GM_info !== 'undefined') ? GM_info.script.version : "1.1";
    const ssoUrl = "https://hrt.jamfcloud.com/oauth2/authorization/idp-us-hudson-trading.com";
    const delay = 120000; 
    const jssCaffeinateDebug = true;

    const debug = (m) => {
        if (jssCaffeinateDebug) {
            console.log(`${scriptName} [${new Date().toLocaleTimeString()}]: ${m}`);
        }
    };

    const login = () => {
        debug("Redirecting to SSO...");
        sessionStorage.setItem('jss_caffeinate_return_to', window.location.href);
        location.href = ssoUrl;
    };

    // --- Visual Indicator ---
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
        debug("Keep-alive triggered.");
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

    // --- Improved Status Logic ---
    const checkStatus = () => {
        // 1. Immediate URL match (handles manual /logout tests)
        if (location.pathname.includes('/logout')) {
            debug("Logout URL detected. Redirecting...");
            login();
            return true;
        }

        // 2. Text match (handles dynamic session timeouts)
        if (document.body.innerText.includes("successfully logged out")) {
            debug("Logout text detected. Redirecting...");
            login();
            return true;
        }
        return false;
    };

    const restoreLastPage = () => {
        const savedUrl = sessionStorage.getItem('jss_caffeinate_return_to');
        const isRoot = window.location.pathname === '/' || window.location.pathname === '/dashboard';
        if (savedUrl && savedUrl !== window.location.href && isRoot) {
            debug(`Restoring deep link: ${savedUrl}`);
            sessionStorage.removeItem('jss_caffeinate_return_to');
            window.location.href = savedUrl;
            return true;
        }
        return false;
    };

    // --- Main Execution Flow ---
    console.log(`[${scriptName} v${scriptVersion}] Script loaded.`);
    
    if (!restoreLastPage()) {
        // Instead of a MutationObserver, we check for logout state every 5 seconds.
        // This is significantly lighter on the browser and won't conflict with Angular.
        setInterval(checkStatus, 5000);

        // Wait for page to settle before adding the UI
        window.addEventListener('load', () => {
            setTimeout(createIndicator, 1000);
            checkStatus();
        });
    }

    // Keepalive Interval
    setInterval(() => {
        const isAuthPage = location.pathname.includes('/login') || location.pathname.includes('/oauth2');
        if (isAuthPage) return;

        triggerKeepAlive();
        
        try {
            if (localStorage.authToken) {
                const remaining = JSON.parse(localStorage.authToken).expires - Date.now();
                if (remaining < 1) login();
            }
        } catch (e) {}
    }, delay);

})();