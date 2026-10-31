import Foundation
import IssuerEnvelopeCore

// Lab process IPC: signed envelope arrives through stdin, not over a network.
// The trusted test harness provides the pinned issuer verification key and
// the SQLite journal path. These are NOT derived from model output.
func require(_ expression:Bool)throws {
    if !expression { throw IssuerEnvelopeError.malformedEnvelope }
}
do {
    let args=CommandLine.arguments
    try require(args.count==5)
    try require(args[1]=="--consume" || args[1]=="--stop")
    guard let publicDER=Data(base64Encoded:args[2]),
          publicDER.count>=80,publicDER.count<=150,
          let now=Int64(args[4]),now>=0 else{
        throw IssuerEnvelopeError.malformedEnvelope
    }
    let inbox=try SyntheticIssuerInbox(
        databasePath:args[3],pinnedPublicKeyDER:publicDER
    )
    if args[1]=="--stop" {
        try inbox.stop(nowMs:now)
        print(#"{"stopped":true,"externalActionAllowed":false}"#)
    } else {
        let input=FileHandle.standardInput.readDataToEndOfFile()
        let result=try inbox.inspectAndConsume(
            envelopeData:input,pinnedIssuerPublicKeyDER:publicDER,nowMs:now
        )
        let report:[String:Any]=[
            "proposalId":result.proposalID,
            "signedIssuerVerified":true,
            "replayConsumed":result.replayConsumed,
            "externalActionAllowed":result.externalActionAllowed,
            "humanConsentProven":result.humanConsentProven,
            "trustedProductionIdentityProven":result.trustedProductionIdentityProven
        ]
        let payload=try JSONSerialization.data(
            withJSONObject:report,options:[.sortedKeys]
        )
        print(String(decoding:payload,as:UTF8.self))
    }
} catch {
    fputs("ISSUER_ENVELOPE_REJECTED: invalid, expired or previously consumed synthetic request\n",stderr)
    exit(2)
}
