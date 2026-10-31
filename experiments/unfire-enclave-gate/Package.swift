// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "UnfireEnclaveGate",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "UnfireEnclaveGate", targets: ["UnfireEnclaveGate"])
    ],
    targets: [
        .target(name: "UnfireEnclaveGate"),
        .testTarget(name: "UnfireEnclaveGateTests", dependencies: ["UnfireEnclaveGate"])
    ]
)
