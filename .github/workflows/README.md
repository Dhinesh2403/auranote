# GitHub Actions Workflows

This repo contains GitHub Actions workflows for an Ionic + Angular + Capacitor project.

## Workflows

### `ci.yml`
Runs on pushes and pull requests:
- `npm ci`
- `npm run lint`
- `npm test` in headless Chrome
- `npm run build` (outputs to `www/`)

Artifacts:
- Uploads `www/` as a build artifact.

### `android-release.yml`
Runs:
- Manually via **Actions → Android Release → Run workflow**
- Automatically on tags matching `v*`

Builds:
- Release **APK** and/or **AAB** from `android/` using Gradle.

Artifacts:
- Uploads release APK/AAB from:
  - `android/app/build/outputs/apk/release/*.apk`
  - `android/app/build/outputs/bundle/release/*.aab`

## Required GitHub Secrets (Android signing)

Add these in **Repo → Settings → Secrets and variables → Actions**.

- `ANDROID_KEYSTORE_BASE64`: base64 of your `.jks` file
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: key alias
- `ANDROID_KEY_PASSWORD`: key password

### Creating `ANDROID_KEYSTORE_BASE64`

On Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("YOUR_KEYSTORE.jks"))
```

Copy the output and save it as the secret value.

## Notes
- Workflows use **Node.js 20** and **Java 17**.
- The Android workflow passes signing settings to Gradle via `ORG_GRADLE_PROJECT_*` environment variables. Your `android/app/build.gradle` must be set up to read these (common pattern).
