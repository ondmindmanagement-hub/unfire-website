import XCTest
import Foundation
import CryptoKit
import IssuerEnvelopeCore
import ReviewBindingCore
@testable import ConsentSessionCore

@MainActor
final class SyntheticConsentSessionTests: XCTestCase {
    private let now:Int64 = 100

    private struct Case {
        let dir:URL
        let issuer:P256.Signing.PrivateKey
        let reviewer:P256.Signing.PrivateKey
        let envelope:Data
        let challenge:Data
        let sqlitePath:String

        func session(now:Int64=100,
                     reviewerDER:Data?=nil,
                     issuerDER:Data?=nil) throws -> SyntheticConsentSession {
            try SyntheticConsentSession(
                envelopeData:envelope,
                pinnedIssuerPublicDER:issuerDER ?? issuer.publicKey.derRepresentation,
                pinnedReviewerPublicDER:reviewerDER ?? reviewer.publicKey.derRepresentation,
                journalPath:sqlitePath,
                nowMs:now
            )
        }
        func clean(){try? FileManager.default.removeItem(at:dir)}
    }

    private func makeCase(
        output:String="42",nonce:String=String(repeating:"c",count:48),
        expiry:Int64=60000,decision:String="APPROVE",
        wrongOperation:Bool=false
    ) throws -> Case {
        let issuer=P256.Signing.PrivateKey()
        let reviewer=P256.Signing.PrivateKey()
        let dir=FileManager.default.temporaryDirectory
            .appendingPathComponent("unfire-consent-test-"+UUID().uuidString)
        try FileManager.default.createDirectory(at:dir,
            withIntermediateDirectories:true)
        let manifest=try ReviewManifest.arithmetic(id:"task_a")
        let challengeText=[
            "UNFIRE-P256-V1",
            "algorithm=ECDSA-P256-SHA256",
            "operation="+(wrongOperation ? "email.send":"synthetic.preview"),
            "proposalId=task_a",
            "proposalDigest="+(try manifest.digestForNode()),
            "nonce="+String(repeating:"b",count:48),
            "expiresAt=60100",
            "decision="+decision,
            ""
        ].joined(separator:"\n")
        let challenge=Data(challengeText.utf8)
        let body=[
            "UNFIRE-ISSUER-ENVELOPE-V1",
            "algorithm=ECDSA-P256-SHA256",
            "issuerId=unfire-local-controller",
            "nonce="+nonce,
            "expiresAt="+String(expiry),
            "challengeB64="+challenge.base64EncodedString(),
            ""
        ].joined(separator:"\n")
        let signature=try issuer.signature(for:Data(body.utf8))
        let data=Data((body+"signatureDER="+signature.derRepresentation
            .base64EncodedString()+"\n").utf8)
        return Case(dir:dir,issuer:issuer,reviewer:reviewer,
            envelope:data,challenge:challenge,
            sqlitePath:dir.appendingPathComponent("inbox.sqlite").path)
    }

    func testBoundSignedIssuerIsVisibleButNoActionIsAuthorized() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        XCTAssertEqual(session.phase,.pending)
        XCTAssertEqual(session.review.manifest.operation,"synthetic.preview")
        XCTAssertEqual(session.review.manifest.modelOutput,"42")
        XCTAssertTrue(session.canConfirm)
        XCTAssertFalse(session.productionIdentityVerified)
        XCTAssertFalse(session.authenticatedHumanConsentProven)
        XCTAssertFalse(session.externalActionAllowed)
        XCTAssertFalse(session.actualToolExecuted)
    }
    func testUnsignedOrForgedIssuerCannotCreateSession() throws {
        let a=try makeCase();defer{a.clean()}
        let spoof=P256.Signing.PrivateKey()
        XCTAssertThrowsError(try a.session(
            issuerDER:spoof.publicKey.derRepresentation))
        var corrupted=a.envelope
        corrupted[corrupted.count-10] = 65
        XCTAssertThrowsError(try SyntheticConsentSession(
            envelopeData:corrupted,
            pinnedIssuerPublicDER:a.issuer.publicKey.derRepresentation,
            pinnedReviewerPublicDER:a.reviewer.publicKey.derRepresentation,
            journalPath:a.sqlitePath,nowMs:100))
    }
    func testControllerAndReviewerMustUseDifferentKeys() throws {
        let a=try makeCase();defer{a.clean()}
        XCTAssertThrowsError(try a.session(
            reviewerDER:a.issuer.publicKey.derRepresentation))
    }
    func testUnrelatedSignedScopeCannotBeDisplayed() throws {
        let a=try makeCase(wrongOperation:true);defer{a.clean()}
        XCTAssertThrowsError(try a.session())
    }
    func testSignedDenialCannotEnterConfirmation() throws {
        let a=try makeCase(decision:"DENY");defer{a.clean()}
        XCTAssertThrowsError(try a.session())
    }
    func testExpiredIssuerCannotBeDisplayed() throws {
        let a=try makeCase(expiry:100);defer{a.clean()}
        XCTAssertThrowsError(try a.session())
    }
    func testClickReservesOneNonceInPersistentSQLite() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        XCTAssertEqual(session.phase,.pending)
        let ticket=try session.beginAfterUserClick(nowMs:101)
        XCTAssertEqual(session.phase,.signing(ticket))
        XCTAssertThrowsError(try session.beginAfterUserClick(nowMs:102))
        let restarted=try a.session(now:102)
        XCTAssertThrowsError(try restarted.beginAfterUserClick(nowMs:102)) {
            XCTAssertEqual($0 as? IssuerEnvelopeError,.replay)
        }
    }
    func testEphemeralSoftwareSignatureVerifiesButNeverClaimsHumanPresence() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        let ticket=try session.beginAfterUserClick(nowMs:101)
        let signature=try a.reviewer.signature(for:a.challenge)
        try session.finish(ticket:ticket,
            publicKeyDER:a.reviewer.publicKey.derRepresentation,
            signatureDER:signature.derRepresentation,nowMs:102)
        XCTAssertEqual(session.phase,.verifiedPreview)
        XCTAssertFalse(session.authenticatedHumanConsentProven)
        XCTAssertFalse(session.externalActionAllowed)
        XCTAssertFalse(session.actualToolExecuted)
    }
    func testUnpinnedReviewerKeyRejectedEvenWithValidSignature() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        let ticket=try session.beginAfterUserClick(nowMs:101)
        let other=P256.Signing.PrivateKey()
        let sig=try other.signature(for:a.challenge)
        XCTAssertThrowsError(try session.finish(ticket:ticket,
            publicKeyDER:other.publicKey.derRepresentation,
            signatureDER:sig.derRepresentation,nowMs:102))
        XCTAssertEqual(session.phase,.denied)
    }
    func testSignatureForChangedChallengeRejected() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        let ticket=try session.beginAfterUserClick(nowMs:101)
        let sig=try a.reviewer.signature(for:Data("another task".utf8))
        XCTAssertThrowsError(try session.finish(ticket:ticket,
            publicKeyDER:a.reviewer.publicKey.derRepresentation,
            signatureDER:sig.derRepresentation,nowMs:102))
        XCTAssertEqual(session.phase,.denied)
    }
    func testWrongTicketCannotCompleteAnotherReview() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        _ = try session.beginAfterUserClick(nowMs:101)
        let sig=try a.reviewer.signature(for:a.challenge)
        XCTAssertThrowsError(try session.finish(ticket:UUID(),
            publicKeyDER:a.reviewer.publicKey.derRepresentation,
            signatureDER:sig.derRepresentation,nowMs:102))
    }
    func testDenyBurnsNonceBeforeSecondSessionCanUseIt() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        session.deny(nowMs:101)
        XCTAssertEqual(session.phase,.denied)
        XCTAssertFalse(session.canConfirm)
        let other=try a.session(now:102)
        XCTAssertThrowsError(try other.beginAfterUserClick(nowMs:102)){
            XCTAssertEqual($0 as? IssuerEnvelopeError,.replay)
        }
    }
    func testStopIsPersistedAndBlocksDelayedSigningResult() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        let ticket=try session.beginAfterUserClick(nowMs:101)
        try session.stop(nowMs:102)
        let sig=try a.reviewer.signature(for:a.challenge)
        XCTAssertThrowsError(try session.finish(ticket:ticket,
            publicKeyDER:a.reviewer.publicKey.derRepresentation,
            signatureDER:sig.derRepresentation,nowMs:103))
        XCTAssertEqual(session.phase,.stopped)
        XCTAssertThrowsError(try a.session(now:103)){
            XCTAssertEqual($0 as? IssuerEnvelopeError,.persistentStop)
        }
    }
    func testLateCallbackAfterExpiryFailsClosed() throws {
        let a=try makeCase(expiry:102);defer{a.clean()}
        let session=try a.session()
        let ticket=try session.beginAfterUserClick(nowMs:101)
        let sig=try a.reviewer.signature(for:a.challenge)
        XCTAssertThrowsError(try session.finish(ticket:ticket,
            publicKeyDER:a.reviewer.publicKey.derRepresentation,
            signatureDER:sig.derRepresentation,nowMs:102))
        XCTAssertEqual(session.phase,.expired)
    }
    func testClockRollbackCannotApprove() throws {
        let a=try makeCase();defer{a.clean()}
        let session=try a.session()
        let ticket=try session.beginAfterUserClick(nowMs:105)
        let sig=try a.reviewer.signature(for:a.challenge)
        XCTAssertThrowsError(try session.finish(ticket:ticket,
            publicKeyDER:a.reviewer.publicKey.derRepresentation,
            signatureDER:sig.derRepresentation,nowMs:104))
        XCTAssertEqual(session.phase,.denied)
    }
}
