# PayAlert Android (Expo)

F1 is an Android-only native-app skeleton. This repo does not implement or distribute an iOS app. `com.tecnofusion.payalert` is an inferred Android application ID from the Tecnofusión identity in the project; confirm ownership before a public release.

## Prerequisites

- Node.js 22.13+ (React Native 0.88) and npm.
- An Expo account (the free tier is sufficient for development builds) and EAS CLI (`npm install -g eas-cli`).
- A Supabase project with Email/Password auth enabled and an API deployment with F0 Bearer support.
- For remote Android push: a free Firebase project with an Android app whose package is `com.tecnofusion.payalert`.

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and the public `EXPO_PUBLIC_SUPABASE_ANON_KEY`. These are public client settings; never put service-role credentials here.

## Run locally

```sh
npm install
npx expo start
```

Use a custom development build for Android push; remote push is not available in Expo Go for current Android SDKs. A physical Android phone is required to get an actual Expo push token.

## Development/preview APK distribution (current scope)

No Google Play upload or store release is part of this phase. Install the development/preview APK directly on Android phones through EAS Build, or build locally:

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

`eas.json` sets `preview.android.buildType` to `apk` and internal distribution so the resulting APK can be downloaded and installed directly. A local Android SDK/Java toolchain can be used with `npx expo run:android` after Android native files are generated. Store publishing is a future phase, not now; Google Play Console's one-time fee applies only when that future store publication is pursued.

## Configure Firebase Cloud Messaging (FCM)

1. Create a Firebase project and register an Android application with the exact package ID above.
2. In Firebase Console → Project settings → Service accounts, generate an FCM V1 service-account private key JSON. Treat it as a secret.
3. Upload that JSON to EAS credentials; do not commit it or paste it into this repo. Follow Expo's official [FCM credentials guide](https://docs.expo.dev/push-notifications/fcm-credentials/).
4. Download `google-services.json` if needed for native FCM client configuration. This repo intentionally does not include a real file; keep it ignored locally and never publish secret service-account JSON. Configure `expo.android.googleServicesFile` only when the owner provisions it.
5. Set the EAS project ID in `app.json` (or configure via EAS), then use an EAS Android development/preview APK to test remote push. Expo Go is not the verification environment for remote Android push.

## F1 screens and behavior

- Login: Supabase email/password; session tokens persist with Expo SecureStore.
- Inicio: typed client calls `GET /api/reports/movements`, `/api/expected-payments`, and `/api/integrations` with `Authorization: Bearer <access_token>` and displays server-returned data.
- Notificaciones: asks Android permission, registers the Expo token at `POST /api/push/devices` as `platform: "android"`, supports authenticated `DELETE` revocation, and schedules a local test notification.
- No company selector: the current session resolves one `users.business_id` per user; server determines authorization/scope.

## Validation

```sh
npx tsc --noEmit
npm test
npx expo-doctor
npx expo export --platform android
```

The app only presents API results; it does not reimplement financial or authorization logic. No phone/emulator validation is included in F1.
