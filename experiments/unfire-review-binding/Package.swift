// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "UnfireReviewBinding",
    platforms: [.macOS(.v14)],
    dependencies: [.package(path: "../unfire-enclave-gate")],
    targets: [
        .executableTarget(
            name: "UnfireReviewBinding",
            dependencies: [.product(name:"UnfireEnclaveGate",package:"unfire-enclave-gate")]
        ),
        .testTarget(
            name: "UnfireReviewBindingTests",
            dependencies: ["UnfireReviewBinding"]
        )
    ]
)
