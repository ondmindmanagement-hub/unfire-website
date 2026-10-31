#!/usr/bin/env bash
# Y2K ROBOTS, ephemeral Android emulator native-launch smoke.
# It NEVER signs with release keys, submits to Google Play or uploads artifacts.
# A successful shell exit is NOT evidence of actual 3D gameplay.
set -euo pipefail

PACKAGE='technology.unfire.y2krobots'
ACTIVITY='com.google.androidbrowserhelper.trusted.LauncherActivity'
APK='app/build/outputs/apk/debug/app-debug.apk'

test -s "$APK" || { echo 'BLOCKED: APK was not compiled'; exit 2; }
adb wait-for-device
adb shell input keyevent 82 || true

# Do not grant dangerous permissions, log into any account or interact with real users.
adb install -r "$APK"
adb shell pm path "$PACKAGE" | grep -F 'package:'
adb shell pm dump "$PACKAGE" | grep -E 'targetSdk=36|targetSdkVersion=36' >/dev/null || {
  echo 'BLOCKED: exact package/API36 install not confirmed'; exit 3;
}

# Begin with a clean buffered log; verify the launcher intent is accepted.
adb logcat -c
adb shell am start -W -n "$PACKAGE/$ACTIVITY" > /tmp/y2k-launch-observed.txt
cat /tmp/y2k-launch-observed.txt
grep -q 'Status: ok' /tmp/y2k-launch-observed.txt || {
  echo 'BLOCKED: Android did not accept native launcher activity'; exit 4;
}

sleep 6
adb logcat -d -v time -t 3000 > /tmp/y2k-runtime-observed.txt
if grep -E 'Process: technology\.unfire\.y2krobots|FATAL EXCEPTION.*technology\.unfire\.y2krobots' /tmp/y2k-runtime-observed.txt; then
  echo 'BLOCKED: observed a native application crash associated with this package'; exit 5;
fi

# No screenshots or log files exported: avoid publishing any browser/session data.
rm -f /tmp/y2k-launch-observed.txt /tmp/y2k-runtime-observed.txt
echo 'ANDROID_EMULATOR_INSTALL_LAUNCH_PASS. Scope: emulator APK install + Android native launcher only. Game content/Chrome integration, fullscreen, P2P, gameplay, and physical Android NOT CERTIFIED.'
