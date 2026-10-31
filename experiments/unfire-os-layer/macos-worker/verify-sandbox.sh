#!/usr/bin/env bash
# Run only on an ephemeral macOS CI host.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d /tmp/unfire-macos-worker.XXXXXX)"
private=""
listener=""
cleanup() {
  if [[ -n "$listener" ]]; then kill "$listener" 2>/dev/null || true; fi
  if [[ -n "$private" ]]; then rm -f "$private"; fi
  rm -rf "$tmp"
}
trap cleanup EXIT

xcrun swiftc "$here/Worker.swift" -o "$tmp/worker-unsigned"
app="$tmp/UnfireResearchWorker.app"
mkdir -p "$app/Contents/MacOS"
cp "$here/Worker.Info.plist" "$app/Contents/Info.plist"
cp "$tmp/worker-unsigned" "$app/Contents/MacOS/UnfireResearchWorker"
worker="$app/Contents/MacOS/UnfireResearchWorker"
codesign --force --sign - --options runtime \
  --entitlements "$here/Worker.entitlements" "$app"
codesign --verify --strict --deep "$app"
codesign --display --entitlements :- "$worker" > "$tmp/effective.plist" 2>/dev/null
python3 - "$tmp/effective.plist" <<'PY'
import plistlib,sys
with open(sys.argv[1],"rb") as handle:
    entitlements=plistlib.load(handle)
assert entitlements == {"com.apple.security.app-sandbox":True}, entitlements
print("ENTITLEMENTS_CHECK_PASS")
PY

private="$(mktemp "$HOME/.unfire-os-test-denied.XXXXXX")"
printf 'Synthetic denial probe, no personal data\n' > "$private"
test -r "$private"

python3 - "$tmp/listener-port" <<'PY' &
import pathlib,socket,sys
sock=socket.socket()
sock.bind(("127.0.0.1",0))
sock.listen(4)
pathlib.Path(sys.argv[1]).write_text(str(sock.getsockname()[1]))
sock.settimeout(12)
try:
    while True:
        client,addr=sock.accept()
        client.close()
except (TimeoutError,OSError):
    pass
finally:
    sock.close()
PY
listener="$!"
for _ in {1..80}; do
  [[ -s "$tmp/listener-port" ]] && break
  sleep 0.1
done
test -s "$tmp/listener-port"
port="$(cat "$tmp/listener-port")"

unsandboxed_read="$("$tmp/worker-unsigned" probe-file "$private")"
unsandboxed_net="$("$tmp/worker-unsigned" probe-network "$port")"
echo "MACOS_PROBE_FILE_START"
sandboxed_read="$("$worker" probe-file "$private")"
echo "MACOS_PROBE_NETWORK_START"
sandboxed_net="$("$worker" probe-network "$port")"
python3 - "$unsandboxed_read" "$unsandboxed_net" "$sandboxed_read" "$sandboxed_net" <<'PY'
import json,sys
baseline_file,baseline_net,sandbox_file,sandbox_net=map(json.loads,sys.argv[1:])
assert baseline_file["allowed"] is True, baseline_file
assert baseline_net["allowed"] is True, baseline_net
assert sandbox_file["allowed"] is False, sandbox_file
assert sandbox_net["allowed"] is False, sandbox_net
print("MACOS_SANDBOX_DENIAL_PASS",json.dumps({
  "baseline_file_allowed": True,
  "baseline_network_allowed": True,
  "sandbox_file_denied": sandbox_file["errorNumber"],
  "sandbox_network_denied": sandbox_net["errorNumber"]}))
PY

transformed="$(printf '%s' '{"operation":"uppercase","input":"unfire os"}' | "$worker" transform)"
hash_result="$(printf '%s' '{"operation":"sha256","input":"abc"}' | "$worker" transform)"
count_result="$(printf '%s' '{"operation":"word_count","input":"one two three"}' | "$worker" transform)"
python3 - "$transformed" "$hash_result" "$count_result" <<'PY'
import hashlib,json,sys
values=list(map(json.loads,sys.argv[1:]))
assert values[0]=={"ok":True,"value":"UNFIRE OS"}, values[0]
assert values[1]=={"ok":True,"value":hashlib.sha256(b"abc").hexdigest()}, values[1]
assert values[2]=={"ok":True,"value":3}, values[2]
print("MACOS_PURE_WORKER_PASS")
PY
limits="$("$worker" probe-limits)"
python3 - "$limits" <<'PY'
import json,sys
resource_limits=json.loads(sys.argv[1])
assert resource_limits == {
    "cpuSeconds":2, "fileHandles":32, "fileBytes":65536
}, resource_limits
print("MACOS_WORKER_KERNEL_LIMITS_PASS")
PY
echo "MACOS_RESEARCH_WORKER_QA_PASS"
# Trusted CI only: never expose worker selection through task JSON.
export UNFIRE_SIGNED_TEST_APP
UNFIRE_SIGNED_TEST_APP="$(cd "$app" && pwd -P)"
node --test "$here/../secure-broker.test.mjs"
echo "MACOS_SECURE_BROKER_QA_PASS"
