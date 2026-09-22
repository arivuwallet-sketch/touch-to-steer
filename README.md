# touchtosteer — Flutter native app

Generated from https://touch-to-steer.lovable.app/

## Build the Android APK

```bash
bash tool/bootstrap.sh android
flutter pub get
dart run flutter_launcher_icons
dart run flutter_native_splash:create
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
cd ios && pod install && cd ..
flutter build ios --release --no-codesign
open ios/Runner.xcworkspace   # sign with your Apple team, then Archive
```

## One-click cloud builds

- `codemagic.yaml` — push this repo to Codemagic and both platforms build automatically.
- `.github/workflows/build.yml` — GitHub Actions builds the APK on every push and uploads it as an artifact.

## Where settings live

| Area | File |
| --- | --- |
| All app settings | `lib/app_config.dart` |
| Website CSS/JS overrides | `lib/web_overrides.dart` |
| Translations | `lib/strings.dart` |
| Android permissions & deep links | `android/app/src/main/AndroidManifest.xml` |
| iOS permissions & deep links | `ios/Runner/Info.plist` |
| Environment values | `.env.example`, `assets/config/app_config.json` |

Regenerate this project any time from the web console after changing settings.
