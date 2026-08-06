// ==UserScript==
// @name        JSS Caffeinate (Generic)
// @version     1.9
// @description Keeps Jamf Pro sessions alive and restores tabs after SSO re-authentication.
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
    // Account chooser entry to select automatically, but only when marked "last used"
    const preferredIdpName = "OktaProd";
    // =================================================

    const scriptName = "JSS Caffeinate";
    const scriptVersion = "1.9";
    const keepAliveDelay = 120000;
    const jamfUrl = window.location.origin;
    const ssoUrl = `${jamfUrl}/oauth2/authorization/${ssoSuffix}`;

    const tabIdKey = 'jss_caffeinate_tab_id';
    const initialUrl = new URL(window.location.href);
    const initialWasOidcCallback = window.location.hostname.endsWith('.jamfcloud.com') &&
                                   initialUrl.pathname === '/' &&
                                   initialUrl.searchParams.has('oidcToken');
    let tabId = sessionStorage.getItem(tabIdKey);
    if (!tabId) {
        tabId = window.name && window.name.startsWith('jss_tab_')
            ? window.name
            : 'jss_tab_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem(tabIdKey, tabId);
    }
    window.name = tabId;
    const bookmarkKey = `bookmark_${tabId}`;
    const tabBookmarkKey = 'jss_caffeinate_tab_bookmark';
    const reauthLockKey = 'jss_reauth_lock';
    const reauthCompletedKey = 'jss_reauth_completed';
    const waitingCycleKey = 'jss_caffeinate_waiting_cycle';
    const reauthLockMaxAge = 120000;

    const debug = (m) => { console.log(`${scriptName} [${new Date().toLocaleTimeString()}]: ${m}`); };

    const getAccountChooserButton = () => [...document.querySelectorAll('button.idp-connection-container')]
        .find((button) => {
            const text = button.innerText.replace(/\s+/g, ' ').trim();
            return text.includes(preferredIdpName) && text.toLowerCase().includes('last used');
        });

    const readReauthLock = () => {
        const raw = localStorage.getItem(reauthLockKey);
        if (!raw) return null;
        try {
            const lock = JSON.parse(raw);
            return lock && lock.owner && lock.cycle && Number.isFinite(lock.createdAt) ? lock : null;
        } catch (_) {
            return null;
        }
    };

    const ownsReauthLock = () => {
        const lock = readReauthLock();
        return Boolean(lock && lock.owner === tabId);
    };

    const claimReauthLock = () => {
        const lock = readReauthLock();
        if (lock && Date.now() - lock.createdAt < reauthLockMaxAge) {
            if (lock.owner !== tabId) sessionStorage.setItem(waitingCycleKey, lock.cycle);
            return lock.owner === tabId;
        }
        const cycle = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
        localStorage.setItem(reauthLockKey, JSON.stringify({ owner: tabId, cycle, createdAt: Date.now() }));
        debug('[AUTH] This tab claimed the re-authentication lock.');
        return true;
    };

    const markReauthComplete = () => {
        const lock = readReauthLock();
        if (!lock || lock.owner !== tabId) return false;
        localStorage.setItem(reauthCompletedKey, JSON.stringify({ cycle: lock.cycle, completedAt: Date.now() }));
        localStorage.removeItem(reauthLockKey);
        return true;
    };

    const completedWaitingCycle = () => {
        const waitingCycle = sessionStorage.getItem(waitingCycleKey);
        if (!waitingCycle) return false;
        try {
            const completed = JSON.parse(localStorage.getItem(reauthCompletedKey));
            return completed && completed.cycle === waitingCycle;
        } catch (_) {
            return false;
        }
    };

    const resumeCompletedCycle = () => {
        if (!completedWaitingCycle()) return false;
        sessionStorage.removeItem(waitingCycleKey);
        debug('[AUTH] The shared SSO cycle completed; resuming this tab.');
        if (!restoreSavedPage('SSO completed in another tab')) window.location.href = jamfUrl;
        return true;
    };

    const saveCurrentPage = () => {
        const url = window.location.href;
        const path = window.location.pathname;
        const isExcluded = path === '/' || path === '/dashboard' || path.includes('dashboard.html') ||
                           path.includes('index.html') || path.includes('/logout') ||
                           path.includes('/login') || url.includes('original_url=') ||
                           url.includes('auth.jamf.com');
        if (isExcluded) return;
        sessionStorage.setItem(tabBookmarkKey, url);
        localStorage.setItem(bookmarkKey, url);
    };

    const getSavedPage = () => sessionStorage.getItem(tabBookmarkKey) || localStorage.getItem(bookmarkKey);

    const restoreSavedPage = (reason) => {
        const savedUrl = getSavedPage();
        if (!savedUrl || window.location.href === savedUrl) return false;
        debug(`[RESTORE] ${reason}; returning to saved page.`);
        window.location.replace(savedUrl);
        return true;
    };

    const restoreLastPage = () => {
        const savedUrl = getSavedPage();
        const isAtLanding = window.location.pathname === '/' || window.location.pathname === '/dashboard';
        const isAuthenticated = Boolean(document.querySelector('jamf-pro-sidebar'));
        if (savedUrl && isAtLanding && isAuthenticated && window.location.href !== savedUrl) {
            debug(`[RESTORE] Redirecting to bookmark: ${savedUrl}`);
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

        const chooserButton = getAccountChooserButton();
        const isOidcCallback = initialWasOidcCallback || (
            window.location.hostname.endsWith('.jamfcloud.com') &&
            window.location.pathname === '/' &&
            new URLSearchParams(window.location.search).has('oidcToken')
        );
        const isAuthPage = url.includes('/login') || url.includes('auth.jamf.com') || Boolean(chooserButton);
        const hasError = url.includes('error=') || url.includes('forbidden') || bodyText.includes("something went wrong");

        if (isAuthPage && hasError) {
            debug("[STATUS] Manual intervention required. Showing alert banner.");
            showManualAlert();
            return false;
        }

        // Jamf's central auth service owns this part of the redirect chain. Its
        // localStorage and origin differ from the tenant, so do not start a new flow here.
        if (url.includes('auth.jamf.com')) return true;

        if (isOidcCallback) {
            if (markReauthComplete()) {
                debug('[AUTH] OIDC callback received; released the re-authentication lock.');
            }
            restoreSavedPage('Authentication complete');
            return true;
        }

        const isLogout = url.includes('/logout') || bodyText.toLowerCase().includes('successfully logged out');
        const isLogin = url.includes('/login') || url.includes('original_url=');
        const isDenied = bodyText.includes("Access denied") && bodyText.includes("identity provider");

        if (isLogout || isLogin || isDenied || chooserButton) {
            if (resumeCompletedCycle()) return true;
            if (!claimReauthLock()) {
                if (!window.lockMonitorActive) {
                    window.lockMonitorActive = true;
                    debug('[AUTH] Another tab is handling SSO; waiting.');
                    const resumeAfterSso = () => {
                        if (!completedWaitingCycle()) return;
                        clearInterval(lockWatcher);
                        window.removeEventListener('storage', storageWatcher);
                        document.removeEventListener('visibilitychange', visibilityWatcher);
                        resumeCompletedCycle();
                    };
                    const storageWatcher = (event) => {
                        if (event.key === reauthCompletedKey) resumeAfterSso();
                    };
                    const visibilityWatcher = () => {
                        if (document.visibilityState === 'visible') resumeAfterSso();
                    };
                    const lockWatcher = setInterval(() => {
                        resumeAfterSso();
                    }, 2000);
                    window.addEventListener('storage', storageWatcher);
                    document.addEventListener('visibilitychange', visibilityWatcher);
                }
                return true;
            }

            if (chooserButton) {
                if (!window.preferredIdpClicked) {
                    window.preferredIdpClicked = true;
                    debug(`[AUTH] Selecting last-used identity provider: ${preferredIdpName}`);
                    chooserButton.click();
                }
                return true;
            }

            if (!window.ssoRedirectStarted) {
                window.ssoRedirectStarted = true;
                debug('[AUTH] Starting SSO authentication.');
                location.href = ssoUrl;
            }
            return true;
        }

        const isAuthenticated = Boolean(document.querySelector('jamf-pro-sidebar'));
        if (isAuthenticated && ownsReauthLock()) {
            markReauthComplete();
            debug('[AUTH] Authentication complete; released the re-authentication lock.');
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
        let attempts = 0;
        const restorer = setInterval(() => {
            const authenticationInProgress = checkStatus();
            if ((!authenticationInProgress && restoreLastPage()) || attempts > 120) clearInterval(restorer);
            attempts++;
        }, 500);

        // UI Initialization - Wait for sidebar OR the login card OR error text
        const stabInterval = setInterval(() => {
            const hasSidebar = document.querySelector('jamf-pro-sidebar');
            const hasCard = document.querySelector('.card') || document.querySelector('jamf-pro-card') || getAccountChooserButton();
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
