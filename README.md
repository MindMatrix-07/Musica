# Musica

Musica is packaged as a web app, a Windows desktop app through Electron, and an Android app through Capacitor.

## Local Web App

1. Install dependencies:
   `npm install`
2. Add your API key in `.env.local` or in the app Settings screen.
3. Start the local server:
   `npm run dev`

## Windows PC App

Create an unpacked Windows app:

`npm run pc:pack`

Run the packaged app:

`D:/MusicaBuild/dist-electron/win-unpacked/Musica.exe`

Create a Windows installer:

`npm run pc:installer`

## Android App

The Android project lives in `android/`.

Sync web changes into Android:

`npm run android:sync`

Build a debug APK:

`npm run android:build`

If Gradle cannot find the Android SDK, update `android/local.properties` with your SDK path.
