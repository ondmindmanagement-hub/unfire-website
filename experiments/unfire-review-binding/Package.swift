// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "UnfireReviewBinding",
    platforms: [.macOS(.v14)],
    products: [
        .library(name:"UnfireReviewBindingCore",targets:["ReviewBindingCore"]),
        .executable(name:"UnfireReviewBinding",targets:["UnfireReviewBinding"]),
        .executable(name:"UnfireReviewBindingCLI",targets:["UnfireReviewBindingCLI"])
    ],
    dependencies: [.package(path:"../unfire-enclave-gate")],
    targets: [
        .target(name:"ReviewBindingCore",dependencies:[
            .product(name:"UnfireEnclaveGate",package:"unfire-enclave-gate")
        ]),
        .executableTarget(name:"UnfireReviewBinding",dependencies:["ReviewBindingCore"]),
        .executableTarget(name:"UnfireReviewBindingCLI",dependencies:["ReviewBindingCore"]),
        .testTarget(name:"UnfireReviewBindingTests",dependencies:["ReviewBindingCore"])
    ]
)
