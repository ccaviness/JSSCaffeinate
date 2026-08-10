# JSS Caffeinate

JSS Caffeinate is a browser userscript that helps keep Jamf Pro sessions active. If Jamf signs out, it coordinates SSO re-authentication across multiple tabs and restores each tab to its last saved Jamf page.

## Features

- Sends a synthetic activity event every two minutes to exercise Jamf's keep-alive behavior.
- Saves a separate deep-link bookmark for each Jamf tab.
- Allows only one tab to initiate SSO while other signed-out tabs wait.
- Restores the authenticating tab and all waiting tabs to their respective pages after SSO succeeds.
- Can select a configured, last-used identity provider from Jamf's account chooser.
- Displays a red banner when Jamf reports an authentication error requiring manual intervention.
- Provides a coffee-cup control for manually sending an activity event and saving the current page.

## Requirements

- A Jamf Pro Cloud instance at `https://*.jamfcloud.com/`.
- Jamf SSO/OIDC authentication.
- A userscript extension such as [Tampermonkey](https://www.tampermonkey.net/).

Chrome must permit the extension to execute userscripts. Open `chrome://extensions`, select Tampermonkey, and enable **Allow User Scripts** and appropriate site access. If this permission is disabled, Tampermonkey may show the script as enabled while never injecting it into Jamf.

## Installation

1. Install Tampermonkey or another compatible userscript extension.
2. Create a userscript and paste the contents of `JSS Caffeinate.js` into it.
3. Configure the values described below.
4. Save the script and reload all open Jamf tabs.
5. Confirm that a coffee cup appears at the lower-right and the console contains a message such as:

   ```text
   [JSS Caffeinate v1.10] Script loaded.
   ```

## Configuration

Configuration is near the beginning of `JSS Caffeinate.js`.

### SSO identity-provider suffix (required)

```javascript
const ssoSuffix = "YOUR_SSO_IDP_SUFFIX_HERE";
```

This is the value following `/oauth2/authorization/` in the Jamf SSO URL. For example, given:

```text
https://example.jamfcloud.com/oauth2/authorization/idp-us-example.com
```

configure:

```javascript
const ssoSuffix = "idp-us-example.com";
```

### Preferred account chooser entry (optional)

```javascript
const preferredIdpName = "";
```

Some Jamf instances show an account chooser before redirecting to the company identity provider. To automatically select a particular entry, set its displayed name exactly:

```javascript
const preferredIdpName = "CompanyOkta";
```

The script clicks the matching entry only when that entry is also marked `last used`. Leave the value blank to disable automatic selection. Do not use the example value unless it is the actual label displayed by your Jamf instance.

## How it works

### Keep-alive

After a 45-second startup delay, the script dispatches a bubbling `mousedown` event every two minutes while the tab is on Jamf and not in an authentication state. The coffee cup sends the same event immediately. Console messages confirm that the event was dispatched, although Jamf ultimately determines whether it extends the server-side session.

### Per-tab bookmarks

Every usable Jamf page is saved every five seconds. Login, logout, dashboard, root, and central-authentication pages are excluded so they cannot replace a useful deep link.

- `sessionStorage` holds the authoritative bookmark and stable ID for the current tab.
- `localStorage` holds a bookmark keyed by that tab ID as a fallback across redirect behavior.
- `window.name` mirrors the tab ID for compatibility with older redirect flows.

Bookmarks are retained during authentication and are not deleted when restoration begins.

### Multi-tab SSO coordination

When Jamf logout or login state is detected, the first tab creates a re-authentication lock in `localStorage`. The lock includes the owner tab ID, a unique cycle ID, and its creation time.

The owner navigates to the configured Jamf SSO endpoint. Other tabs record that cycle and wait instead of starting competing OIDC transactions. When Jamf returns the owner through its OIDC callback, the owner publishes a completion record and releases the lock. Waiting tabs observe that completion through storage events, polling, or becoming visible, then restore their own bookmarks.

The cycle ID prevents a waiting tab from mistaking a released lock for permission to initiate a second, conflicting SSO request.

### Authentication errors

If Jamf or the central Jamf authentication service returns an error URL or an “Oops! Something went wrong” page, the script stops automatic handling on that page and displays a red manual-intervention banner.

## Current limitations

- The re-authentication lock currently expires after two minutes. Interactive SSO left unfinished longer than that, such as overnight, may allow another tab to begin a new authentication cycle. Long-lived/manual authentication handling is planned but is not yet safe to rely on.
- A successful login performed in an unrelated new tab does not currently guarantee that an existing pending cycle will be completed and its waiting tabs restored.
- Account chooser automation depends on Jamf's current `button.idp-connection-container` markup and the visible `last used` text.
- The userscript matches Jamf Cloud and `https://us.auth.jamf.com/`; other Jamf hosting regions may require another `@match` entry.

## Troubleshooting

- **No coffee cup or startup log:** Check Chrome's **Allow User Scripts** permission and Tampermonkey site access.
- **A tab remains on logout:** Open DevTools, enable **Preserve log**, and look for `[AUTH]` messages.
- **Authentication reports “Oops”:** More than one OIDC transaction may have started. Clear `jss_reauth_lock` only after the active authentication attempt has ended, then reload the tabs.
- **A tab does not restore:** Before logout, verify its bookmark with:

  ```javascript
  sessionStorage.getItem("jss_caffeinate_tab_bookmark")
  ```

Avoid sharing complete OIDC callback URLs in logs. They can contain authorization codes, state values, or tokens.

## History

The original script was created by Florin Veja in 2022. This fork adds modern Jamf SSO/OIDC handling, per-tab deep-link restoration, account chooser support, and coordinated multi-tab authentication.
