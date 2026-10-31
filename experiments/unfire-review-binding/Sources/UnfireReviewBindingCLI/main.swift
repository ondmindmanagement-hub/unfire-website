import Foundation
import ReviewBindingCore

// Read-only research interoperability probe. No signed consent, OS authentication,
// tool execution, permanent keys or side effects. Invalid input exits cleanly.
do {
    guard CommandLine.arguments.count == 4,
          CommandLine.arguments[1] == "--check-b64",
          let bytes=Data(base64Encoded:CommandLine.arguments[2]),
          let nowMs=Int64(CommandLine.arguments[3]) else {
        throw ReviewBindingError.untrustedDisplay
    }
    let manifest=try ReviewManifest.arithmetic(id:"task_a")
    let bound=try BoundReview(challengeBytes:bytes,manifest:manifest,nowMs:nowMs)
    let report:[String:Any]=[
        "verifiedBinding":true,
        "operation":bound.manifest.operation,
        "proposalId":bound.challenge.proposalID,
        "requestDigest":bound.challenge.proposalDigest,
        "challengeFingerprint":bound.challengeFingerprint,
        "externalActionAllowed":bound.externalActionAllowed,
        "humanConsentSigned":bound.signedHumanConsentProven,
        "issuerAuthenticated":bound.trustedIssuerAuthenticated
    ]
    let data=try JSONSerialization.data(withJSONObject:report,options:[.sortedKeys])
    print(String(decoding:data,as:UTF8.self))
} catch {
    fputs("REVIEW_REJECTED: invalid or expired synthetic binding\n",stderr)
    exit(2)
}
