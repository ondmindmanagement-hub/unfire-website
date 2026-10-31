// Unfire OS Layer · macOS worker research.
// A strictly bounded, pure synthetic worker. No model, shell, external API,
// project file writer, privileged entitlement or production integration.
import Foundation
import Darwin
import CryptoKit

func output(_ value: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(value),
          let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
          let text = String(data: data, encoding: .utf8) else {
        fputs("JSON serialization failed\n", stderr)
        exit(2)
    }
    print(text)
}

func reject(_ reason: String) -> Never {
    output(["ok": false, "error": reason])
    exit(2)
}

func runTransform() {
    // No input files or other application resources are opened.
    let data = FileHandle.standardInput.readData(ofLength: 8193)
    guard data.count > 0 && data.count <= 8192 else { reject("invalid_input_length") }
    guard let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          Set(value.keys) == Set(["operation", "input"]),
          let operation = value["operation"] as? String else { reject("invalid_task") }

    switch operation {
    case "uppercase":
        guard let text = value["input"] as? String, text.utf8.count <= 4096 else {
            reject("invalid_text")
        }
        output(["ok": true, "value": text.uppercased()])
    case "slow_uppercase":
        // Fixed one-second sleep exclusively for synthetic watchdog/cancel QA.
        // No user-supplied delay, network, filesystem or arbitrary execution.
        guard let text = value["input"] as? String, text.utf8.count <= 4096 else {
            reject("invalid_text")
        }
        usleep(1_000_000)
        output(["ok": true, "value": text.uppercased()])
    case "word_count":
        guard let text = value["input"] as? String, text.utf8.count <= 4096 else {
            reject("invalid_text")
        }
        output(["ok": true, "value": text.split(whereSeparator: { $0.isWhitespace }).count])
    case "sha256":
        guard let text = value["input"] as? String, text.utf8.count <= 4096 else {
            reject("invalid_text")
        }
        let digest = SHA256.hash(data: Data(text.utf8)).map {
            String(format: "%02x", $0)
        }.joined()
        output(["ok": true, "value": digest])
    default:
        reject("operation_not_allowed")
    }
}

// These two probes are ONLY used in isolated test environments.
// They expose whether a signed process can read a synthetic forbidden file
// or connect to a synthetic loopback server. Neither reads or prints contents.
func probeFile(_ path: String) {
    let descriptor = Darwin.open(path, O_RDONLY)
    if descriptor < 0 {
        output(["allowed": false, "errorNumber": Int(errno)])
    } else {
        Darwin.close(descriptor)
        output(["allowed": true, "errorNumber": 0])
    }
}
func probeNetwork(_ portText: String) {
    guard let port = UInt16(portText), port > 0 else { reject("invalid_port") }
    let descriptor = Darwin.socket(AF_INET, SOCK_STREAM, 0)
    if descriptor < 0 {
        output(["allowed": false, "errorNumber": Int(errno)])
        return
    }
    defer { Darwin.close(descriptor) }
    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = port.bigEndian
    let parseResult = "127.0.0.1".withCString {
        Darwin.inet_pton(AF_INET, $0, &address.sin_addr)
    }
    guard parseResult == 1 else { reject("invalid_test_address") }
    let result = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            Darwin.connect(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
    }
    output(["allowed": result == 0, "errorNumber": result == 0 ? 0 : Int(errno)])
}

// Explicit OS process budgets, enforced by the macOS kernel.
// Memory is NOT hard-capped by this prototype; a separate validated
// macOS memory/coalition control is required before production.
func applyProcessLimits() {
    var cpu = rlimit(rlim_cur: rlim_t(2), rlim_max: rlim_t(2))
    guard Darwin.setrlimit(RLIMIT_CPU, &cpu) == 0 else {
        reject("cpu_limit_unavailable")
    }
    var openFiles = rlimit(rlim_cur: rlim_t(32), rlim_max: rlim_t(32))
    guard Darwin.setrlimit(RLIMIT_NOFILE, &openFiles) == 0 else {
        reject("open_file_limit_unavailable")
    }
    var maxFileBytes = rlimit(rlim_cur: rlim_t(65536), rlim_max: rlim_t(65536))
    guard Darwin.setrlimit(RLIMIT_FSIZE, &maxFileBytes) == 0 else {
        reject("file_size_limit_unavailable")
    }
}

applyProcessLimits()

// Test-only introspection to confirm limits were imposed by the kernel.
// The production broker has no path to this mode.
func probeLimits() {
    var cpu = rlimit(rlim_cur: 0, rlim_max: 0)
    var handles = rlimit(rlim_cur: 0, rlim_max: 0)
    var fileBytes = rlimit(rlim_cur: 0, rlim_max: 0)
    guard Darwin.getrlimit(RLIMIT_CPU, &cpu) == 0 &&
          Darwin.getrlimit(RLIMIT_NOFILE, &handles) == 0 &&
          Darwin.getrlimit(RLIMIT_FSIZE, &fileBytes) == 0 else {
        reject("resource_limit_probe_failed")
    }
    output(["cpuSeconds": Int(cpu.rlim_cur),
            "fileHandles": Int(handles.rlim_cur),
            "fileBytes": Int(fileBytes.rlim_cur)])
}

let arguments = CommandLine.arguments
guard arguments.count >= 2 else { reject("missing_mode") }
switch arguments[1] {
case "transform" where arguments.count == 2:
    runTransform()
case "probe-file" where arguments.count == 3:
    probeFile(arguments[2])
case "probe-network" where arguments.count == 3:
    probeNetwork(arguments[2])
case "probe-limits" where arguments.count == 2:
    probeLimits()
default:
    reject("invalid_mode")
}
