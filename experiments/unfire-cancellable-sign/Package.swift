// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "UnfireCancellableSign",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "UnfireCancellableSign", targets: ["UnfireCancellableSign"])
    ],
    dependencies: [
        .package(path: "../unfire-consent-session")
    ],
    targets: [
        .target(name: "UnfireCancellableSign", dependencies: [
            .product(name: "UnfireConsentSessionCore", package: "unfire-consent-session")
        ]),
        .testTarget(name: "UnfireCancellableSignTests", dependencies: [
            "UnfireCancellableSign",
            .product(name: "UnfireConsentSessionCore", package: "unfire-consent-session")
        ])
    ]
)
