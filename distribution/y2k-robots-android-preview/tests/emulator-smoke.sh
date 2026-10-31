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
# A TWA launcher is not a usable web game without a compatible browser.
adb shell pm path com.android.chrome | grep -F 'package:' >/dev/null || {
  echo 'BLOCKED: compatible Chrome browser is not installed in test emulator'; exit 6;
}
adb shell pm dump "$PACKAGE" | grep -E 'targetSdk=36|targetSdkVersion=36' >/dev/null || {
  echo 'BLOCKED: exact package/API36 install not confirmed'; exit 3;
}

# Multiple independent cold app starts on one disposable emulator. A single
# success cannot rule out the intermittent native crash seen on this image.
for attempt in 1 2 3; do
  echo "ANDROID_COLD_START_ATTEMPT=${attempt}/3"
  adb shell am force-stop "$PACKAGE" || true
  adb logcat -c
  adb shell am start -W -n "$PACKAGE/$ACTIVITY" > /tmp/y2k-launch-observed.txt
  cat /tmp/y2k-launch-observed.txt
  grep -q 'Status: ok' /tmp/y2k-launch-observed.txt || {
    echo "BLOCKED: Android launcher intent failed on cold start ${attempt}"; exit 4;
  }
  sleep 6
  adb logcat -d -v time -t 3000 > /tmp/y2k-runtime-observed.txt
  if grep -Eq 'Process: technology\\.unfire\\.y2krobots|FATAL EXCEPTION.*technology\\.unfire\\.y2krobots' /tmp/y2k-runtime-observed.txt; then
    echo "BLOCKED: AndroidRuntime native crash on cold start ${attempt}. AndroidRuntime error-tag excerpt:"
    adb logcat -d -v tag -s AndroidRuntime:E '*:S' | head -c 9500 || true
    rm -f /tmp/y2k-launch-observed.txt /tmp/y2k-runtime-observed.txt
    exit 5
  fi
  echo "ANDROID_COLD_START_ATTEMPT_${attempt}_NO_CRASH"
done

# Inspect only Android activity/window management after launch, not browser content.
# Chrome is required in this virtual image; native launcher should hand off
# to the browser. This is NOT proof that the WebGL game has finished loading.
activity_state="$(adb shell dumpsys activity activities | grep -E 'topResumedActivity=|mResumedActivity:' | head -n 5 || true)"
window_state="$(adb shell dumpsys window windows | grep -E 'mCurrentFocus=|mFocusedApp=' | head -n 5 || true)"
printf 'EMULATOR_ACTIVITY_FOREGROUND=%s\\n' "$activity_state"
printf 'EMULATOR_WINDOW_FOCUS=%s\\n' "$window_state"
if ! printf '%s\\n%s\\n' "$activity_state" "$window_state" | grep -q 'com.android.chrome'; then
  echo 'BLOCKED: Chrome is installed but was not verified in foreground after Y2K app launch.'
  exit 7
fi
echo 'ANDROID_BROWSER_FOREGROUND_VERIFIED. Content/game is not yet certified.'

# No screenshots or log files exported: avoid publishing any browser/session data.
rm -f /tmp/y2k-launch-observed.txt /tmp/y2k-runtime-observed.txt
echo 'ANDROID_EMULATOR_3_COLD_STARTS_WITH_BROWSER_PASS. Chrome present; 3 Android launcher activations with no observed native AndroidRuntime crash. Actual web game rendering, fullscreen, P2P, missions, physical Android NOT CERTIFIED.'
