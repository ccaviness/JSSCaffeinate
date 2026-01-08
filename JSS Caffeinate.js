// ==UserScript==
// @name        JSS Caffeinate (SSO Optimized)
// @version     0.6
// @description Keeps Jamf Pro sessions alive and uses direct SSO URL for re-authentication.
// @match       https://hrt.jamfcloud.com/*
// @grant       none
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // 1. Reference Metadata for Logging
    // Note: Since @grant is 'none', we access info through Tampermonkey's internal object if available
    const scriptName = (typeof GM_info !== 'undefined') ? GM_info.script.name : "JSS Caffeinate";
    const scriptVersion = (typeof GM_info !== 'undefined') ? GM_info.script.version : "0.6";

    console.log(`[${scriptName} v${scriptVersion}] Script loaded and monitoring session.`);

    const ssoUrl = "https://hrt.jamfcloud.com/oauth2/authorization/idp-us-hudson-trading.com";
    const delay = 120000; 
    const jssCaffeinateDebug = true;
    let last = Date.now();

    const debug = (m) => {
        if (jssCaffeinateDebug) {
            console.log(`${scriptName} [${new Date().toLocaleTimeString()}]: ${m}`);
        }
    };

    const login = () => {
        debug("Redirecting to SSO...");
        location.href = ssoUrl;
    };

    const authExpiration = () => {
        try {
            if (localStorage.authToken) {
                return JSON.parse(localStorage.authToken).expires - Date.now();
            }
        } catch (e) {
            debug("Could not read authToken: " + e.message);
        }
        return null;
    };

    // 2. Improved Logout Detection
    // Checks for /logout.html OR the presence of the "You have successfully logged out" text
    const isLogoutPage = location.pathname.includes('/logout') || 
                         document.body.innerText.includes("successfully logged out");

    if (isLogoutPage) {
        debug("Logout state detected via URL or Page Content. Redirecting to SSO in 5s...");
        setTimeout(login, 5000);
        return;
    }

    // Keepalive Interval
    setInterval(() => {
        const start = Date.now();
        const mousedown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        document.dispatchEvent(mousedown);

        const remaining = authExpiration();
        if (remaining !== null) {
            debug(`Keep-alive sent. Token expires in ${Math.round(remaining / 1000)}s`);
            if (remaining < 1) login();
        } else {
            debug("Keep-alive sent (Token info unavailable).");
        }
        last = start;
    }, delay);

})();
