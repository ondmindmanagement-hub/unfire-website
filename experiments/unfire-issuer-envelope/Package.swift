// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name:"UnfireIssuerEnvelope",
    platforms:[.macOS(.v14)],
    products:[
      .library(name:"IssuerEnvelopeCore",targets:["IssuerEnvelopeCore"]),
      .executable(name:"IssuerEnvelopeCLI",targets:["IssuerEnvelopeCLI"])
    ],
    dependencies:[.package(path:"../unfire-review-binding")],
    targets:[
      .target(name:"IssuerEnvelopeCore",dependencies:[
        .product(name:"UnfireReviewBindingCore",package:"unfire-review-binding")
      ]),
      .executableTarget(name:"IssuerEnvelopeCLI",dependencies:["IssuerEnvelopeCore"]),
      .testTarget(name:"IssuerEnvelopeTests",dependencies:["IssuerEnvelopeCore"])
    ]
)
