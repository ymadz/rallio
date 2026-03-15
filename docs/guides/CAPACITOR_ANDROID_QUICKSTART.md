# Capacitor Android Quickstart (Web-Parity)

This guide sets up Android APK delivery using a pure web-shell approach, where the mobile app renders the existing web player experience.

## Scope

- Android first
- Player role parity only
- Pure web shell behavior (no native screen rewrites)

## 1) Prerequisites

- Node.js 18+
- Android Studio + Android SDK
- Java 17+
- Existing web environment variables for `web/`

## 2) Install dependencies

From repository root:

```bash
npm install
```

## 3) Validate Capacitor toolchain

```bash
npm run cap:doctor --workspace=web
```

## 4) Configure server URL for shell

Capacitor config reads `CAPACITOR_SERVER_URL` from environment.

Examples:

- Local network dev URL: `http://192.168.1.10:3000`
- Staging URL: `https://staging.your-domain.com`
- Production URL: `https://your-domain.com`

Run commands with env var inline:

```bash
CAPACITOR_SERVER_URL=http://192.168.1.10:3000 npm run cap:add:android --workspace=web
```

## 5) Add and open Android project

```bash
CAPACITOR_SERVER_URL=http://192.168.1.10:3000 npm run cap:add:android --workspace=web
CAPACITOR_SERVER_URL=http://192.168.1.10:3000 npm run cap:sync --workspace=web
npm run cap:open:android --workspace=web
```

## 6) Daily sync after web changes

```bash
CAPACITOR_SERVER_URL=http://192.168.1.10:3000 npm run cap:sync --workspace=web
```

## 7) Critical QA checklist

1. Auth login/logout works and session persists after app restart.
2. Booking flow opens checkout and returns correctly to app state.
3. Payment callback route works: `/mobile-payment/callback` deep-links back with status.
4. Queue join/leave flow stays consistent with web data.
5. Android back-button navigation does not unexpectedly exit mid-flow.

## 8) Known constraints

- App requires stable network connectivity (no offline support in this phase).
- Admin dashboards remain web-only for now.
- Native UI parity improvements are deferred to later phases.