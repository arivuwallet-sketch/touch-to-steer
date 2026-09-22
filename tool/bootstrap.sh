#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
test -f pubspec.yaml || { echo "pubspec.yaml was not found; run this script from the exported project." >&2; exit 1; }

requested="${1:-both}"
case "$requested" in
  android) flutter_platforms="android" ;;
  ios) flutter_platforms="ios" ;;
  both) flutter_platforms="android,ios" ;;
  *) echo "Usage: bash tool/bootstrap.sh [android|ios|both]" >&2; exit 2 ;;
esac

backup_dir="$(mktemp -d)"
trap 'rm -rf "$backup_dir"' EXIT
if [ -f android/app/src/main/AndroidManifest.xml ]; then
  cp android/app/src/main/AndroidManifest.xml "$backup_dir/AndroidManifest.xml"
fi
if [ -f ios/Runner/Info.plist ]; then
  cp ios/Runner/Info.plist "$backup_dir/Info.plist"
fi

if [[ "$requested" == "android" || "$requested" == "both" ]]; then rm -rf android; fi
if [[ "$requested" == "ios" || "$requested" == "both" ]]; then rm -rf ios; fi

flutter create --platforms="$flutter_platforms" --project-name="touchtosteer" --org="app.lovable" .

if [[ "$requested" == "android" || "$requested" == "both" ]]; then
  if [ -f "$backup_dir/AndroidManifest.xml" ]; then
    cp "$backup_dir/AndroidManifest.xml" android/app/src/main/AndroidManifest.xml
  fi
  gradle_file="android/app/build.gradle.kts"
  if [ -f "$gradle_file" ]; then
    sed -i.bak -E 's/^([[:space:]]*)minSdk[[:space:]]*=.*$/\1minSdk = 24/' "$gradle_file"
    sed -i.bak -E 's/^([[:space:]]*)compileSdk[[:space:]]*=.*$/\1compileSdk = 36/' "$gradle_file"
    sed -i.bak -E 's/^([[:space:]]*)targetSdk[[:space:]]*=.*$/\1targetSdk = 36/' "$gradle_file"
    rm -f "$gradle_file.bak"
  fi

  # Flutter 3.47+ supports built-in Kotlin, but current plugin ecosystems
  # still contain packages that apply the legacy Kotlin Gradle Plugin. Keep
  # this compatibility mode enabled for generated apps.
  gradle_props="android/gradle.properties"
  touch "$gradle_props"
  if grep -q '^android.builtInKotlin=' "$gradle_props"; then
    sed -i.bak 's/^android.builtInKotlin=.*/android.builtInKotlin=false/' "$gradle_props"
  else
    printf '
android.builtInKotlin=false
' >> "$gradle_props"
  fi
  if grep -q '^android.newDsl=' "$gradle_props"; then
    sed -i.bak 's/^android.newDsl=.*/android.newDsl=false/' "$gradle_props"
  else
    printf 'android.newDsl=false
' >> "$gradle_props"
  fi
  rm -f "$gradle_props.bak"

  # Flutter v1 Android embedding was removed in Flutter 3.29. Fail early
  # with a clear message if an obsolete reference ever enters the tree.
  if grep -R "io\.flutter\.app\." android/app/src/main 2>/dev/null; then
    echo "ERROR: Android v1 embedding reference detected." >&2
    exit 1
  fi
  grep -R -q "io\.flutter\.embedding\.android\.FlutterActivity" android/app/src/main     || { echo "ERROR: Android embedding v2 MainActivity was not generated." >&2; exit 1; }
fi

if [[ "$requested" == "ios" || "$requested" == "both" ]]; then
  if [ -f "$backup_dir/Info.plist" ]; then cp "$backup_dir/Info.plist" ios/Runner/Info.plist; fi
  sed -i.bak 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]*/IPHONEOS_DEPLOYMENT_TARGET = 15.0/g' ios/Runner.xcodeproj/project.pbxproj
  rm -f ios/Runner.xcodeproj/project.pbxproj.bak
  if [ -f ios/Podfile ]; then
    sed -i.bak "s/^# *platform :ios.*/platform :ios, '15.0'/" ios/Podfile
    sed -i.bak "s/^platform :ios.*/platform :ios, '15.0'/" ios/Podfile
    rm -f ios/Podfile.bak
  fi
fi

echo "Modern Flutter platform files are ready for $requested."
