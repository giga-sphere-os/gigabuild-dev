# GigaBuild Mobile Store Readiness

Status as of June 1, 2026: native shell is scaffolded, but store submission still requires signed builds, real-device QA, and final store metadata.

## Current Mobile Posture

- App ID: `io.gigasphere.gigabuild`
- App name: `GigaBuild`
- Architecture: PWA core plus Capacitor iOS and Android wrappers
- Web source copied into `dist-mobile` by `npm run mobile:prepare`
- Native sync command: `npm run mobile:sync`

## Commerce Decision

Native iOS and Android builds are configurator-only. They create the activation packet and support booking/contact actions, but they do not expose the Stripe checkout button inside the native app.

Reason: GigaBuild sells digital/service modules. Keeping payment and workspace launch outside the native app avoids shipping an in-app Stripe purchase path before Apple/Google payment policy review is complete.

## Permission Posture

- Android requests `INTERNET` only.
- iOS currently requests no camera, location, microphone, contacts, photo library, or notification permissions.
- Do not add device permissions unless a native feature requires them and a clear reviewer-facing reason is added.

## Before Apple App Store Submission

1. Run `npm run mobile:sync`.
2. Open iOS with `npm run mobile:open:ios`.
3. Set signing team and bundle ownership in Xcode.
4. Test on iPhone small, iPhone large, and iPad sizes.
5. Confirm Privacy Policy and Delete account/data links work inside the app.
6. Confirm native mode hides checkout and shows the app-store commerce note.
7. Prepare App Privacy labels from actual data collection.
8. Add reviewer note: purchases/workspace launch are handled outside the native app through Giga-Sphere onboarding.

## Before Google Play Submission

1. Run `npm run mobile:sync`.
2. Open Android with `npm run mobile:open:android`.
3. Build a signed Android App Bundle.
4. Test phone and tablet layouts.
5. Confirm Android manifest only requests `INTERNET`.
6. Complete Data Safety form from actual data collection.
7. Add reviewer note: native app is a configurator and does not process payments in-app.

## Remaining Gate

Store-ready means signed builds have passed device QA. This repo is now prepared for that work, but the actual Apple/Google submission should wait until screenshots, metadata, privacy labels, and signed builds are complete.

## Local Build Tooling Required

- Android debug/release builds require a local Java runtime and Android Studio.
- iOS simulator/archive builds require full Xcode, not only Apple Command Line Tools.
- Store submission requires Apple Developer and Google Play Console account access.
