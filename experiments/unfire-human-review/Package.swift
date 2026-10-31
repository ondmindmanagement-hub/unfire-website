// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "UnfireHumanReview",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "UnfireHumanReview", targets: ["UnfireHumanReview"])
    ],
    targets: [
        .executableTarget(name: "UnfireHumanReview"),
        .testTarget(name: "UnfireHumanReviewTests", dependencies: ["UnfireHumanReview"])
    ]
)
