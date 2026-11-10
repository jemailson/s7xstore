Android app (Kotlin) for key verification against S7X Store `/CheckLogin.php` endpoint.

Setup:
1. Open this folder in Android Studio: `android-app`
2. If your site runs locally, set `LoginActivity.BASE_URL` to `http://10.0.2.2:3333` (emulator) or to your machine IP (e.g., `http://192.168.0.10:3333`).
3. Build and run on an emulator or device.

Notes:
- The app performs a GET to `/CheckLogin.php?user=[KEY]&uid=[DEVICE_ID]`.
- The server returns HTTP 200 with device id on success; otherwise 403 with error text.
- Do not embed database credentials in the APK; the app uses the server endpoint as requested.
