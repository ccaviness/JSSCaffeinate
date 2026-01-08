// ==UserScript==
// @name        JSS Caffeinate (SSO Optimized)
// @version     0.5
// @description Keeps Jamf Pro sessions alive and uses direct SSO URL for re-authentication.
// @match       https://hrt.jamfcloud.com/*
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // CONFIGURATION
    const ssoUrl = "https://hrt.jamfcloud.com/oauth2/authorization/idp-us-hudson-trading.com";
    const delay = 120000; // 2 minutes between keep-alive events
    const jssCaffeinateDebug = true; // Keep true initially to verify it works
    const name = "JSS Caffeinate";
    let last = Date.now();

    const debug = (m) => {
        if (jssCaffeinateDebug) {
            console.log(`${name} [${new Date().toLocaleTimeString()}]: ${m}`);
        }
    };

    const login = () => {
        debug("Session expired or logout detected. Redirecting to SSO...");
        // Redirect directly to the OIDC launch URL for automated login
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

    const getDelay = (max) => Math.random() * (max - 2000) + 2000;

    // Detect if we are on the logout page
    if (location.pathname.includes('/logout.html')) {
        debug("Logout page detected. Re-authenticating via SSO in a few seconds...");
        setTimeout(login, getDelay(5000));
        return;
    }

    // Main keep-alive interval
    const café = setInterval(() => {
        const start = Date.now();
        
        // Dispatch event to Jamf's activity listener
        const mousedown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        document.dispatchEvent(mousedown);

        const remaining = authExpiration();
        if (remaining !== null) {
            debug(`Keep-alive sent. Token expires in ${Math.round(remaining / 1000)}s`);
            // If the token is already expired, trigger the SSO redirect
            if (remaining < 1) login();
        } else {
            debug("Keep-alive sent (Token info unavailable).");
        }

        last = start;
    }, delay);

})();
