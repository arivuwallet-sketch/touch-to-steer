# TouchToSteer Native Android Build

Flutter stable 3.47.2
Android compile/target SDK 36 (Android 16)
Android Gradle Plugin 9.4.1
Gradle 9.6.0
Flutter built-in Kotlin support
Java 17

The project uses Flutter's current AGP 9 build path with explicit Kotlin 2.4.20 and AndroidX and compile/target SDK 36. Android 17/API 37 is still in beta, so the production build targets stable Android 16/API 36.

Release build: `flutter build apk --release`

GitHub Actions builds the release APK automatically on pushes to `main` and uploads `app-release.apk` as the `touch-to-steer-android-release` artifact.
