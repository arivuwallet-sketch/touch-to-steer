# touchtosteer — Flutter native app

Generated from https://touch-to-steer.lovable.app/

## Build the Android APK

```bash
bash tool/bootstrap.sh android
flutter pub get
dart run flutter_launcher_icons
dart run flutter_native_splash:create
bash tool/check_signing.sh  # configure CM_KEYSTORE_* and CM_KEY_* first
flutter build apk --release
# output: build/app/outputs/flutter-apk/app-release.apk
```

App bundle for Google Play:

```bash
flutter build appbundle --release
```

## Build for iOS (needs macOS + Xcode)

```bash
bash tool/bootstrap.sh ios
flutter pub get
if [ -f ios/Podfile ]; then (cd ios && pod install); fi
flutter build ios --release --no-codesign
open ios/Runner.xcworkspace   # sign with your Apple team, then Archive
```

## One-click cloud builds

- `codemagic.yaml` — select android-debug for a test APK. For android-release, upload your existing keystore with reference nativeforge_upload. For ios-release, upload a matching App Store distribution certificate and provisioning profile.
- `.github/workflows/build.yml` — GitHub Actions builds a test APK and unsigned iOS app. Store distribution requires signed release artifacts.

## Where settings live

| Area | File |
| --- | --- |
| All app settings | `lib/app_config.dart` |
| Website CSS/JS overrides | `lib/web_overrides.dart` |
| Translations | `lib/strings.dart` |
| Android permissions & deep links | `android/app/src/main/AndroidManifest.xml` |
| iOS permissions & deep links | `ios/Runner/Info.plist` |
| Environment values | `.env.example`, `assets/config/app_config.json` |

The website is loaded live from its HTTPS URL. Newly deployed pages appear on reload;
already-open pages need website realtime support or a manual refresh. Live console
settings poll every 60 seconds and on foreground without resetting navigation.
Native permissions, signing, icons and plugins require regeneration and rebuilding.
Never embed private keys: secret-marked environment values are omitted from exports.

Regenerate this project from the web console to receive generator fixes. Bootstrap
preserves native customizations; use a fresh export when changing the package ID.
