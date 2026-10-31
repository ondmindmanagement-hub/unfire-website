import XCTest
import Foundation
import CryptoKit
@testable import UnfireEnclaveGate

final class EnclaveGateTests: XCTestCase {
    private let start: Int64 = 100
    private func source(id:String="task_a",digest:String=String(repeating:"a",count:64),
                        nonce:String=String(repeating:"b",count:48),
                        expires:String="60100",decision:String="APPROVE") -> Data {
        let lines=[
            "UNFIRE-P256-V1",
            "algorithm=ECDSA-P256-SHA256",
            "operation=synthetic.preview",
            "proposalId="+id,
            "proposalDigest="+digest,
            "nonce="+nonce,
            "expiresAt="+expires,
            "decision="+decision,
            ""
        ]
        return Data(lines.joined(separator:"\n").utf8)
    }
    private func makeSession(bytes:Data?=nil,
                             key:P256.Signing.PrivateKey) throws -> PreviewReviewSession {
        try PreviewReviewSession(
            challenge:CanonicalPreviewChallenge(bytes:bytes ?? source()),
            pinnedPublicKeyDER:key.publicKey.derRepresentation,
            createdAtMs:start
        )
    }

    func testStrictCanonicalBytesAccepted() throws {
        let c=try CanonicalPreviewChallenge(bytes:source())
        XCTAssertEqual(c.proposalID,"task_a")
        XCTAssertEqual(c.expiresAtMs,60100)
        XCTAssertEqual(c.decision,"APPROVE")
        XCTAssertFalse(c.externalActionAllowed)
        XCTAssertEqual(c.bytes,source())
    }
    func testTamperedOperationDenied() {
        let wrong=String(decoding:source(),as:UTF8.self)
            .replacingOccurrences(of:"synthetic.preview",with:"email.send")
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:Data(wrong.utf8)))
    }
    func testBadScopeOrVersionDenied() {
        let wrong=String(decoding:source(),as:UTF8.self)
            .replacingOccurrences(of:"UNFIRE-P256-V1",with:"UNFIRE-P256-V2")
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:Data(wrong.utf8)))
    }
    func testIdAndDigestInjectionDenied() {
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:source(id:"pay\nmail")))
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:source(digest:"A"+String(repeating:"a",count:63))))
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:source(nonce:"short")))
    }
    func testExpiryUntrustedEncodingDenied() {
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:source(expires:"0060100")))
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:source(expires:"-1")))
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:source(expires:"9999999999999999999999999999")))
    }
    func testTrailingFieldsAndMissingNewlineDenied() {
        var extra=source()
        extra.append(Data("action=email.send\n".utf8))
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:extra))
        var missing=source()
        missing.removeLast()
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:missing))
    }
    func testArbitraryNonASCIIOrInvalidUTF8Denied() {
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:source(id:"äbc")))
        var bad=source();bad.append(0xff)
        XCTAssertThrowsError(try CanonicalPreviewChallenge(bytes:bad))
    }
    func testCannotStartWithoutExplicitUserClick() throws {
        let key=P256.Signing.PrivateKey()
        var session=try makeSession(key:key)
        XCTAssertEqual(session.phase,.pending)
        XCTAssertFalse(session.externalActionAllowed)
        XCTAssertFalse(session.humanConsentCryptographicallyProven)
        XCTAssertThrowsError(try session.finish(attempt:UUID(),signatureDER:Data(),nowMs:101))
        XCTAssertEqual(session.phase,.pending)
    }
    func testSoftwareTestKeyCanSignExactlyMatchingCanonicalBytes() throws {
        let key=P256.Signing.PrivateKey()
        var session=try makeSession(key:key)
        let ticket=try session.beginAfterUserClick(nowMs:start)
        let signature=try key.signature(for:session.challenge.bytes)
        try session.finish(attempt:ticket,
                           signatureDER:signature.derRepresentation,nowMs:101)
        XCTAssertEqual(session.phase,.previewOnly)
        XCTAssertFalse(session.externalActionAllowed)
        XCTAssertFalse(session.humanConsentCryptographicallyProven)
        XCTAssertThrowsError(try session.beginAfterUserClick(nowMs:102))
    }
    func testWrongPinnedKeyRejected() throws {
        let authorized=P256.Signing.PrivateKey(),attacker=P256.Signing.PrivateKey()
        var session=try makeSession(key:authorized)
        let ticket=try session.beginAfterUserClick(nowMs:start)
        let forgery=try attacker.signature(for:session.challenge.bytes)
        XCTAssertThrowsError(try session.finish(attempt:ticket,
            signatureDER:forgery.derRepresentation,nowMs:101))
        XCTAssertEqual(session.phase,.denied)
    }
    func testChangedTargetOrDecisionCannotReuseSignature() throws {
        let key=P256.Signing.PrivateKey()
        var session=try makeSession(bytes:source(digest:String(repeating:"b",count:64)),key:key)
        let ticket=try session.beginAfterUserClick(nowMs:start)
        let different=try key.signature(for:source())
        XCTAssertThrowsError(try session.finish(attempt:ticket,
            signatureDER:different.derRepresentation,nowMs:101))
        XCTAssertEqual(session.phase,.denied)
    }
    func testDeniedDecisionCannotBeApproved() throws {
        let key=P256.Signing.PrivateKey()
        var session=try makeSession(bytes:source(decision:"DENY"),key:key)
        XCTAssertThrowsError(try session.beginAfterUserClick(nowMs:start))
        XCTAssertEqual(session.phase,.denied)
    }
    func testWrongAttemptAndStaleCallbackNoEffect() throws {
        let key=P256.Signing.PrivateKey()
        var session=try makeSession(key:key)
        let t=try session.beginAfterUserClick(nowMs:101)
        let signature=try key.signature(for:source())
        XCTAssertThrowsError(try session.finish(attempt:UUID(),
            signatureDER:signature.derRepresentation,nowMs:102))
        XCTAssertEqual(session.phase,.signing(t))
        session.stop()
        XCTAssertThrowsError(try session.finish(attempt:t,
            signatureDER:signature.derRepresentation,nowMs:102))
        XCTAssertEqual(session.phase,.stopped)
    }
    func testExpiryDuringReviewInvalidatesPendingTicket() throws {
        let key=P256.Signing.PrivateKey()
        var session=try makeSession(key:key)
        let ticket=try session.beginAfterUserClick(nowMs:101)
        let signature=try key.signature(for:source())
        XCTAssertThrowsError(try session.finish(attempt:ticket,
            signatureDER:signature.derRepresentation,nowMs:60100))
        XCTAssertEqual(session.phase,.expired)
    }
    func testClockRollbackFailsClosed() throws {
        let key=P256.Signing.PrivateKey()
        var session=try makeSession(key:key)
        let ticket=try session.beginAfterUserClick(nowMs:120)
        let signature=try key.signature(for:source())
        XCTAssertThrowsError(try session.finish(attempt:ticket,
            signatureDER:signature.derRepresentation,nowMs:119))
        XCTAssertEqual(session.phase,.denied)
    }
    func testDenyAndStopInvalidatePendingReview() throws {
        let key=P256.Signing.PrivateKey()
        var s=try makeSession(key:key)
        let ticket=try s.beginAfterUserClick(nowMs:100)
        s.deny()
        XCTAssertEqual(s.phase,.denied)
        let sig=try key.signature(for:source())
        XCTAssertThrowsError(try s.finish(attempt:ticket,signatureDER:sig.derRepresentation,nowMs:101))
        var other=try makeSession(key:key)
        other.stop()
        XCTAssertEqual(other.phase,.stopped)
        XCTAssertThrowsError(try other.beginAfterUserClick(nowMs:101))
    }
}
