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

# Asset tools must only target the platforms bootstrapped on this runner.
python3 - "$requested" <<'ASSET_PLATFORMS'
import pathlib, re, sys
path = pathlib.Path('pubspec.yaml')
text = path.read_text()
for section in ('flutter_launcher_icons', 'flutter_native_splash'):
    pattern = r'(?m)^' + section + r':\n(?:[ 	].*\n|\n)*'
    match = re.search(pattern, text)
    if not match:
        raise SystemExit('Missing asset configuration: ' + section)
    block = re.sub(r'(?m)^  (android|ios|web):.*\n', '', match.group())
    flags = ''.join('  ' + platform + ': ' + str(sys.argv[1] in (platform, 'both')).lower() + '\n' for platform in ('android', 'ios'))
    block = block.replace(section + ':\n', section + ':\n' + flags + ('  web: false\n' if section == 'flutter_native_splash' else ''), 1)
    text = text[:match.start()] + block + text[match.end():]
path.write_text(text)
ASSET_PLATFORMS

backup_dir="$(mktemp -d)"
trap 'rm -rf "$backup_dir"' EXIT
if [ -f android/app/src/main/AndroidManifest.xml ]; then
  cp android/app/src/main/AndroidManifest.xml "$backup_dir/AndroidManifest.xml"
fi
if [ -f ios/Runner/Info.plist ]; then
  cp ios/Runner/Info.plist "$backup_dir/Info.plist"
fi

flutter create --no-pub --platforms="$flutter_platforms" --project-name="touchtosteer" --org="app.lovable" "$backup_dir/scaffold"
# Copy missing scaffolding only. Preserve signing, Firebase files and native edits.
python3 - "$backup_dir/scaffold" "$requested" <<'PYTHON'
import pathlib, shutil, sys
source = pathlib.Path(sys.argv[1])
platforms = ['android', 'ios'] if sys.argv[2] == 'both' else [sys.argv[2]]
for platform in platforms:
    for item in (source / platform).rglob('*'):
        target = pathlib.Path(platform) / item.relative_to(source / platform)
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif not target.exists():
            shutil.copy2(item, target)
if not pathlib.Path('.metadata').exists():
    shutil.copy2(source / '.metadata', '.metadata')
PYTHON

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
    python3 tool/configure_signing.py "$gradle_file"
    # Opting out of AGP built-in Kotlin also requires applying the Kotlin plugin.
    python3 - "$gradle_file" <<'PYTHON'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
s = p.read_text()
if 'id("org.jetbrains.kotlin.android")' not in s and 'id("kotlin-android")' not in s:
    s = s.replace('id("com.android.application")', 'id("com.android.application")\n    id("org.jetbrains.kotlin.android")', 1)
p.write_text(s)
PYTHON
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
  grep -R -q "io\.flutter\.embedding\.android\.Flutter\(Fragment\)\?Activity" android/app/src/main     || { echo "ERROR: Android embedding v2 MainActivity was not generated." >&2; exit 1; }
fi

if [[ "$requested" == "ios" || "$requested" == "both" ]]; then
  # Include current Flutter scene/launch metadata while preserving configured values.
  python3 - "$backup_dir/scaffold/ios/Runner/Info.plist" <<'PYTHON'
import pathlib, plistlib, sys
p = pathlib.Path('ios/Runner/Info.plist')
base = plistlib.loads(pathlib.Path(sys.argv[1]).read_bytes())
base.update(plistlib.loads(p.read_bytes()))
p.write_bytes(plistlib.dumps(base))
PYTHON
  sed -i.bak 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]*/IPHONEOS_DEPLOYMENT_TARGET = 15.0/g' ios/Runner.xcodeproj/project.pbxproj
  rm -f ios/Runner.xcodeproj/project.pbxproj.bak
  if [ -f ios/Podfile ]; then
    sed -i.bak "s/^# *platform :ios.*/platform :ios, '15.0'/" ios/Podfile
    sed -i.bak "s/^platform :ios.*/platform :ios, '15.0'/" ios/Podfile
    rm -f ios/Podfile.bak
  fi
fi

echo "Modern Flutter platform files are ready for $requested."
