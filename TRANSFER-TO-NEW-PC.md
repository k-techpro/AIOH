# AIOH: clone and restore local configuration

This project keeps credentials and machine-specific configuration outside Git in `C:\AIOH-private`. Never copy that folder into the repository, commit its contents, or upload it to GitHub. This guide is safe to keep in the repository.

## First: prepare this PC before deleting the checkout

Run PowerShell from `C:\AIOH\AIOH`:

```powershell
$repo = (Get-Location).Path
$private = 'C:\AIOH-private'
New-Item -ItemType Directory -Force "$private\backend", "$private\frontend", "$private\frontend\android\app" | Out-Null

# Copy only files that exist. No secret contents are printed.
if (Test-Path "$repo\backend\.env") { Copy-Item "$repo\backend\.env" "$private\backend\.env" }
if (Test-Path "$repo\development.env.json") { Copy-Item "$repo\development.env.json" "$private\development.env.json" }
if (Test-Path "$repo\aioh-retailprime-firebase-adminsdk-fbsvc-b83720d31a.json") {
  Copy-Item "$repo\aioh-retailprime-firebase-adminsdk-fbsvc-b83720d31a.json" "$private\"
}
if (Test-Path "$repo\frontend\google-services.json") { Copy-Item "$repo\frontend\google-services.json" "$private\frontend\google-services.json" }
if (Test-Path "$repo\frontend\android\app\google-services.json") {
  Copy-Item "$repo\frontend\android\app\google-services.json" "$private\frontend\android\app\google-services.json"
}
if (Test-Path "$repo\frontend\android\app\debug.keystore") {
  Copy-Item "$repo\frontend\android\app\debug.keystore" "$private\frontend\android\app\debug.keystore"
}
```

Back up `C:\AIOH-private` securely to a location you control before deleting the PC's copy. It contains credentials. Do not send it by email or put it in cloud storage unless that storage is approved for these client secrets. Confirm the backup has each file you need before deleting the original checkout.

The repository's former local ignore file may have hidden additional files from Git status. Review `git status --short --ignored` before removing the old checkout. Do not force-add ignored files.

## On the new PC: clone and restore

```powershell
git clone https://github.com/k-techpro/AIOH.git C:\AIOH\AIOH
$repo = 'C:\AIOH\AIOH'
$private = 'C:\AIOH-private'

if (Test-Path "$private\backend\.env") { Copy-Item "$private\backend\.env" "$repo\backend\.env" }
if (Test-Path "$private\development.env.json") { Copy-Item "$private\development.env.json" "$repo\development.env.json" }
if (Test-Path "$private\aioh-retailprime-firebase-adminsdk-fbsvc-b83720d31a.json") {
  Copy-Item "$private\aioh-retailprime-firebase-adminsdk-fbsvc-b83720d31a.json" "$repo\"
}
if (Test-Path "$private\frontend\google-services.json") {
  Copy-Item "$private\frontend\google-services.json" "$repo\frontend\google-services.json"
}
if (Test-Path "$private\frontend\android\app\google-services.json") {
  Copy-Item "$private\frontend\android\app\google-services.json" "$repo\frontend\android\app\google-services.json"
}
if (Test-Path "$private\frontend\android\app\debug.keystore") {
  Copy-Item "$private\frontend\android\app\debug.keystore" "$repo\frontend\android\app\debug.keystore"
}
```

Install dependencies using the commands in `README.md`. Create `frontend/android/local.properties` on the new PC with its own Android SDK path; never copy that file from the old PC. If a private file is unavailable, use `backend/env.template` for local backend defaults and ask the project owner to provision any required Firebase or production credentials. Do not substitute guessed production secrets.

## Files kept outside Git

- `backend/.env` — backend database configuration and credentials
- `development.env.json` — local API endpoint/build configuration
- `aioh-retailprime-firebase-adminsdk-*.json` — Firebase service account private key
- `frontend/google-services.json` and `frontend/android/app/google-services.json` — Firebase app configuration
- `frontend/android/app/debug.keystore`, release keystores, and signing credentials
- `frontend/android/local.properties` — machine-specific Android SDK path

The ignore rules for these patterns are in the repository `.gitignore`, so they apply on every clone. Verify with `git check-ignore -v <path>` before adding any local configuration. If a credential was ever committed or pushed, removing it from the current tree is not enough: revoke/rotate it in the issuing service and remove it from Git history.
