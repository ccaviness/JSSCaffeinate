# JSS Caffeinate (v1.0)

#### Automatically keeps Jamf Pro sessions alive and restores your work tabs after SSO re-authentication

## Overview

JSS Caffeinate was created to solve the frustration of being logged out of Jamf Pro when working with multiple tabs. Version 1.0 is a rewrite designed for modern Jamf Pro instances using **SSO/OIDC (Okta, Azure, etc.)**.

## Key Features

* **Multi-Tab Support**: Unlike simple keep-alive scripts, JSS Caffeinate assigns a unique ID to every tab. Each tab remembers its own specific sub-page (e.g., a specific Policy or Profile).
* **Deep Link Restoration**: If you are signed out, the script automatically re-authenticates via SSO and returns every open tab to the exact page it was on before the timeout.
* **SSO Anti-Collision**: Prevents multiple tabs from trying to log in at the exact same millisecond, which avoids the common "Oops! Something went wrong" Jamf auth error.
* **Angular-Safe**: Includes built-in stability delays to prevent interference with Jamf Pro's internal framework loading.

## How to Use

### 1. Install a Userscript Plugin

You will need a browser extension to run this script.

* [Tampermonkey](https://www.tampermonkey.net) (**Recommended**)
* [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
* [Userscripts (Safari/iOS)](https://apps.apple.com/us/app/userscripts/id1463298887)

### 2. Configuration (Required)

To enable automated re-authentication, you must provide your instance's SSO IDP suffix:

1. Open your Jamf Pro instance.
2. Manually log out or wait for a redirect to your SSO provider.
3. Look at the URL. It will look something like this: `.../oauth2/authorization/idp-your-company.com`
4. Copy the part after `/authorization/` (e.g., `idp-your-company.com`).
5. Edit the script and paste that value into the `ssoSuffix` variable at the top:

```javascript
const ssoSuffix = "idp-your-company.com";

```

### 3. Usage

Once installed and configured, you will see a small grayscale coffee cup (☕) in the bottom-right corner of your Jamf Pro tabs.

* **Automatic**: Every 2 minutes, the script simulates activity to keep your session alive.
* **Manual**: Click the ☕ icon at any time to manually "caffeinate" the session.

## How it Works

* **Persistence Engine**: The script uses `window.name` to identify tabs and `sessionStorage` to bookmark your location. Even through multiple redirects to Okta/Azure and back, the tab never loses its place.
* **The Re-auth Lock**: When a logout is detected, the first tab to notice it claims a "Re-auth Lock" in `localStorage`. Other tabs will wait patiently for that tab to finish the login before refreshing themselves.
* **Stability Monitor**: The script waits 10 seconds after a page loads before it begins monitoring. This ensures Jamf's sidebar and dashboard services are fully initialized, preventing "TypeError" crashes in the browser console.

## Change Log

* **v1.0**: Published "Generic" edition. Added automatic instance detection, `ssoSuffix` configuration, and multi-tab "Anti-Collision" logic.
* **v0.9**: Added "Safe Mode" startup to bypass Angular framework conflicts.
* **v0.8**: Introduced deep linking and visual feedback indicators.
* **v0.3**: Fixed a glitch where the debug flag was not initialized properly.

---

*Original script by Florin Veja (2022). Updated for modern SSO and Multi-tab support (2024).*
