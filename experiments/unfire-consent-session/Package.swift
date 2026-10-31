// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "UnfireConsentSession",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "UnfireConsentSessionCore", targets: ["ConsentSessionCore"]),
        .executable(name: "UnfireConsentSession", targets: ["UnfireConsentSession"]),
        .executable(name: "ConsentSessionProbe", targets: ["ConsentSessionProbe"])
    ],
    dependencies: [
        .package(path: "../unfire-issuer-envelope"),
        .package(path: "../unfire-review-binding"),
        .package(path: "../unfire-enclave-gate")
    ],
    targets: [
        .target(name: "ConsentSessionCore", dependencies: [
            .product(name: "IssuerEnvelopeCore", package: "unfire-issuer-envelope"),
            .product(name: "UnfireReviewBindingCore", package: "unfire-review-binding"),
            .product(name: "UnfireEnclaveGate", package: "unfire-enclave-gate")
        ]),
        .executableTarget(name: "UnfireConsentSession", dependencies: ["ConsentSessionCore"]),
        .executableTarget(name: "ConsentSessionProbe", dependencies: ["ConsentSessionCore"]),
        .testTarget(name: "ConsentSessionCoreTests", dependencies: ["ConsentSessionCore"])
    ]
)
