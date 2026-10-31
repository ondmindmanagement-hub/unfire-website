import Foundation
import ConsentSessionCore

// Deliberately READ-ONLY challenge review probe. It DOES NOT call
// beginAfterUserClick, sign, LAContext, Keychain, or any real tool.
do {
    let a=CommandLine.arguments
    guard a.count==7,
          a[1]=="--inspect-research-b64",
          let envelope=Data(base64Encoded:a[2]),
          let issuer=Data(base64Encoded:a[3]),
          let reviewer=Data(base64Encoded:a[4]),
          let now=Int64(a[6]),now>=0 else {
        throw ConsentSessionError.invalidSignedRequest
    }
    let review=try SyntheticConsentSession(
        envelopeData:envelope,pinnedIssuerPublicDER:issuer,
        pinnedReviewerPublicDER:reviewer,journalPath:a[5],nowMs:now
    )
    let result:[String:Any]=[
        "exactRequestMatched":true,
        "operation":review.review.manifest.operation,
        "proposalId":review.review.challenge.proposalID,
        "issuerFingerprint":review.envelope.issuerFingerprint,
        "challengeFingerprint":review.review.challengeFingerprint,
        "pending":review.canConfirm,
        "externalActionAllowed":review.externalActionAllowed,
        "humanConsentProven":review.authenticatedHumanConsentProven,
        "productionIdentityProven":review.productionIdentityVerified,
        "actualToolExecuted":review.actualToolExecuted
    ]
    let json=try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys])
    print(String(decoding:json,as:UTF8.self))
} catch {
    fputs("CONSENT_SESSION_PROBE_REJECTED: invalid, expired, or untrusted synthetic input\n",stderr)
    exit(2)
}
