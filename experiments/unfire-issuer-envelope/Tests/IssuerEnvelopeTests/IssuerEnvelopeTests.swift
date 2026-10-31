import XCTest
import Foundation
import CryptoKit
import ReviewBindingCore
@testable import IssuerEnvelopeCore

final class IssuerEnvelopeTests:XCTestCase {
    private func challenge(
        id:String="task_a",digest:String?=nil,
        decision:String="APPROVE",expires:Int64=60100
    ) throws -> Data {
        let m=try ReviewManifest.arithmetic(id:id)
        let payload=[
            "UNFIRE-P256-V1","algorithm=ECDSA-P256-SHA256",
            "operation=synthetic.preview","proposalId="+id,
            "proposalDigest="+(try digest ?? m.digestForNode()),
            "nonce="+String(repeating:"c",count:48),
            "expiresAt="+String(expires),"decision="+decision,""
        ].joined(separator:"\n")
        return Data(payload.utf8)
    }
    private func envelope(
        key:P256.Signing.PrivateKey,nonce:String=String(repeating:"d",count:48),
        body:Data?=nil,expiry:Int64=60000
    ) throws -> Data {
        let request=try body ?? challenge()
        let lines=[
            "UNFIRE-ISSUER-ENVELOPE-V1","algorithm=ECDSA-P256-SHA256",
            "issuerId=unfire-local-controller","nonce="+nonce,
            "expiresAt="+String(expiry),
            "challengeB64="+request.base64EncodedString(),""
        ]
        let unsigned=Data(lines.joined(separator:"\n").utf8)
        let sig=try key.signature(for:unsigned)
        return unsigned+Data(("signatureDER="+sig.derRepresentation.base64EncodedString()+"\n").utf8)
    }
    private func tempPath() throws ->String {
        let path=FileManager.default.temporaryDirectory
            .appendingPathComponent("unfire-issuer-unit-"+UUID().uuidString)
        try FileManager.default.createDirectory(at:path,withIntermediateDirectories:true)
        return path.appendingPathComponent("journal.sqlite").path
    }
    private func remove(_ path:String) {
        try? FileManager.default.removeItem(
            at:URL(fileURLWithPath:path).deletingLastPathComponent()
        )
    }

    func testValidPinnedIssuerAndExactSyntheticScope() throws {
        let key=P256.Signing.PrivateKey()
        let message=try envelope(key:key)
        let result=try VerifiedIssuerEnvelope(
            bytes:message,pinnedPublicKeyDER:key.publicKey.derRepresentation
        )
        XCTAssertEqual(result.issuerID,"unfire-local-controller")
        XCTAssertEqual(result.expiresAtMs,60000)
        XCTAssertEqual(result.nonce.count,48)
    }
    func testAttackerKeyCannotForgeIssuerIdentity() throws {
        let a=P256.Signing.PrivateKey(),attacker=P256.Signing.PrivateKey()
        XCTAssertThrowsError(try VerifiedIssuerEnvelope(
            bytes:envelope(key:attacker),pinnedPublicKeyDER:a.publicKey.derRepresentation
        )) {error in
            XCTAssertEqual(error as? IssuerEnvelopeError,.untrustedIssuerSignature)
        }
    }
    func testChangedSignedBytesRejectsEvenIfFormatLooksValid() throws {
        let key=P256.Signing.PrivateKey()
        let original=String(decoding:try envelope(key:key),as:UTF8.self)
        let changed=original.replacingOccurrences(
            of:"expiresAt=60000",with:"expiresAt=60001"
        )
        XCTAssertThrowsError(try VerifiedIssuerEnvelope(
            bytes:Data(changed.utf8),
            pinnedPublicKeyDER:key.publicKey.derRepresentation
        ))
    }
    func testUnknownIssuerAndAppendedOperationRejected() throws {
        let key=P256.Signing.PrivateKey()
        let original=String(decoding:try envelope(key:key),as:UTF8.self)
        let spoof=original.replacingOccurrences(
            of:"issuerId=unfire-local-controller",
            with:"issuerId=untrusted-model"
        )
        XCTAssertThrowsError(try VerifiedIssuerEnvelope(
            bytes:Data(spoof.utf8),pinnedPublicKeyDER:key.publicKey.derRepresentation
        ))
        XCTAssertThrowsError(try VerifiedIssuerEnvelope(
            bytes:Data((original+"action=mail.send\n").utf8),
            pinnedPublicKeyDER:key.publicKey.derRepresentation
        ))
    }
    func testEnvelopeCannotCarryRawPromptOrExternalToolFields() throws {
        let key=P256.Signing.PrivateKey()
        let original=String(decoding:try envelope(key:key),as:UTF8.self)
        let inserted=original.replacingOccurrences(
            of:"signatureDER=",with:"modelPrompt=exfiltrate\nsignatureDER="
        )
        XCTAssertThrowsError(try VerifiedIssuerEnvelope(
            bytes:Data(inserted.utf8),
            pinnedPublicKeyDER:key.publicKey.derRepresentation
        ))
    }
    func testSingleUseAcrossSeparateDatabaseReopen() throws {
        let key=P256.Signing.PrivateKey(),path=try tempPath()
        defer{remove(path)}
        let packet=try envelope(key:key)
        let keyDER=key.publicKey.derRepresentation
        do {
            let inbox=try SyntheticIssuerInbox(
                databasePath:path,pinnedPublicKeyDER:keyDER
            )
            let receipt=try inbox.inspectAndConsume(
                envelopeData:packet,pinnedIssuerPublicKeyDER:keyDER,nowMs:100
            )
            XCTAssertTrue(receipt.replayConsumed)
            XCTAssertFalse(receipt.externalActionAllowed)
            XCTAssertFalse(receipt.humanConsentProven)
            XCTAssertFalse(receipt.trustedProductionIdentityProven)
        }
        let restarted=try SyntheticIssuerInbox(
            databasePath:path,pinnedPublicKeyDER:keyDER
        )
        XCTAssertThrowsError(try restarted.inspectAndConsume(
            envelopeData:packet,pinnedIssuerPublicKeyDER:keyDER,nowMs:101
        )){error in
            XCTAssertEqual(error as? IssuerEnvelopeError,.replay)
        }
    }
    func testStrictManifestRejectsAlteredChallengeEvenWithValidIssuerSignature() throws {
        let issuer=P256.Signing.PrivateKey(),path=try tempPath()
        defer{remove(path)}
        let bad=try challenge(digest:String(repeating:"f",count:64))
        let packet=try envelope(key:issuer,body:bad)
        let der=issuer.publicKey.derRepresentation
        let inbox=try SyntheticIssuerInbox(databasePath:path,pinnedPublicKeyDER:der)
        XCTAssertThrowsError(try inbox.inspectAndConsume(
            envelopeData:packet,pinnedIssuerPublicKeyDER:der,nowMs:100
        )){error in
            XCTAssertEqual(error as? IssuerEnvelopeError,.invalidBoundReview)
        }
    }
    func testUnapprovedDecisionCannotPassReceiver() throws {
        let issuer=P256.Signing.PrivateKey(),path=try tempPath()
        defer{remove(path)}
        let request=try challenge(decision:"DENY")
        let packet=try envelope(key:issuer,body:request)
        let der=issuer.publicKey.derRepresentation
        let inbox=try SyntheticIssuerInbox(databasePath:path,pinnedPublicKeyDER:der)
        XCTAssertThrowsError(try inbox.inspectAndConsume(
            envelopeData:packet,pinnedIssuerPublicKeyDER:der,nowMs:100
        ))
    }
    func testExpiryAndRollbackFailClosed() throws {
        let issuer=P256.Signing.PrivateKey(),path=try tempPath()
        defer{remove(path)}
        let der=issuer.publicKey.derRepresentation
        let inbox=try SyntheticIssuerInbox(databasePath:path,pinnedPublicKeyDER:der)
        XCTAssertThrowsError(try inbox.inspectAndConsume(
            envelopeData:try envelope(key:issuer,expiry:100),
            pinnedIssuerPublicKeyDER:der,nowMs:100
        )){error in
            XCTAssertEqual(error as? IssuerEnvelopeError,.expired)
        }
        _ = try inbox.inspectAndConsume(
            envelopeData:try envelope(key:issuer),
            pinnedIssuerPublicKeyDER:der,nowMs:200
        )
        let fresh=try envelope(key:issuer,nonce:String(repeating:"a",count:48))
        XCTAssertThrowsError(try inbox.inspectAndConsume(
            envelopeData:fresh,pinnedIssuerPublicKeyDER:der,nowMs:199
        )){error in
            XCTAssertEqual(error as? IssuerEnvelopeError,.clockRollback)
        }
    }
    func testPinnedKeyCannotBeSwappedOnReopen() throws {
        let first=P256.Signing.PrivateKey(),other=P256.Signing.PrivateKey()
        let path=try tempPath();defer{remove(path)}
        _ = try SyntheticIssuerInbox(
            databasePath:path,pinnedPublicKeyDER:first.publicKey.derRepresentation
        )
        XCTAssertThrowsError(try SyntheticIssuerInbox(
            databasePath:path,pinnedPublicKeyDER:other.publicKey.derRepresentation
        )){error in
            XCTAssertEqual(error as? IssuerEnvelopeError,.keyPinMismatch)
        }
    }
    func testPersistentStopSurvivesReopen() throws {
        let key=P256.Signing.PrivateKey(),path=try tempPath()
        defer{remove(path)}
        let der=key.publicKey.derRepresentation
        do {
            let inbox=try SyntheticIssuerInbox(
                databasePath:path,pinnedPublicKeyDER:der
            )
            try inbox.stop(nowMs:100)
            XCTAssertTrue(inbox.stopped)
        }
        let again=try SyntheticIssuerInbox(
            databasePath:path,pinnedPublicKeyDER:der
        )
        XCTAssertTrue(again.stopped)
        XCTAssertThrowsError(try again.inspectAndConsume(
            envelopeData:try envelope(key:key),pinnedIssuerPublicKeyDER:der,
            nowMs:101
        )){error in
            XCTAssertEqual(error as? IssuerEnvelopeError,.persistentStop)
        }
    }
    func testLocalInboxRequiresHostProvidedPinAndHasNoExecutor() throws {
        let key=P256.Signing.PrivateKey(),path=try tempPath()
        defer{remove(path)}
        let inbox=try SyntheticIssuerInbox(
            databasePath:path,pinnedPublicKeyDER:key.publicKey.derRepresentation
        )
        XCTAssertFalse(inbox.stopped)
        XCTAssertThrowsError(try inbox.inspectAndConsume(
            envelopeData:try envelope(key:key),
            pinnedIssuerPublicKeyDER:P256.Signing.PrivateKey().publicKey.derRepresentation,
            nowMs:100
        )){error in
            XCTAssertEqual(error as? IssuerEnvelopeError,.keyPinMismatch)
        }
    }
}
