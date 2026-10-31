import XCTest
import Foundation
import CryptoKit
@testable import ReviewBindingCore

final class ReviewBindingTests:XCTestCase {
    private let now:Int64=100
    private func manifest(_ id:String="task_a") throws -> ReviewManifest {
        try ReviewManifest.arithmetic(id:id)
    }
    private func challenge(id:String="task_a",digest:String?=nil,
                           expires:Int64=60100,decision:String="APPROVE",
                           nonce:String=String(repeating:"f",count:48)) throws -> Data {
        let m=try manifest(id)
        let text=[
            "UNFIRE-P256-V1",
            "algorithm=ECDSA-P256-SHA256",
            "operation=synthetic.preview",
            "proposalId="+id,
            "proposalDigest="+(try digest ?? m.digestForNode()),
            "nonce="+nonce,
            "expiresAt="+String(expires),
            "decision="+decision,
            ""
        ].joined(separator:"\n")
        return Data(text.utf8)
    }
    private func bound() throws -> BoundReview {
        try BoundReview(challengeBytes:challenge(),
                        manifest:manifest(),nowMs:now)
    }
    func testExactManifestMatchesCanonicalNodeJSON() throws {
        let m=try manifest()
        let data=try JSONSerialization.data(withJSONObject:[
            "UNFIRE-P256-V1","task_a","arithmetic","synthetic.preview","42"
        ])
        let expected=SHA256.hash(data:data).map{
            String(format:"%02x",$0)
        }.joined()
        XCTAssertEqual(try m.digestForNode(),expected)
        XCTAssertEqual(expected.count,64)
    }
    func testVerifiedExactChallengeCanBeDisplayed() throws {
        let b=try bound()
        XCTAssertEqual(b.challenge.proposalID,"task_a")
        XCTAssertEqual(b.manifest.modelOutput,"42")
        XCTAssertEqual(b.challengeFingerprint.count,64)
        XCTAssertFalse(b.externalActionAllowed)
        XCTAssertFalse(b.signedHumanConsentProven)
        XCTAssertFalse(b.trustedIssuerAuthenticated)
    }
    func testTamperedDigestDoesNotDisplayAsValid() throws {
        let bytes=try challenge(digest:String(repeating:"a",count:64))
        XCTAssertThrowsError(try BoundReview(
            challengeBytes:bytes,manifest:manifest(),nowMs:now))
    }
    func testDifferentTaskIDRejected() throws {
        XCTAssertThrowsError(try BoundReview(
            challengeBytes:challenge(id:"task_b"),
            manifest:manifest("task_a"),nowMs:now))
    }
    func testDenyDecisionCannotBecomeApprovalPreview() throws {
        XCTAssertThrowsError(try BoundReview(
            challengeBytes:challenge(decision:"DENY"),
            manifest:manifest(),nowMs:now))
    }
    func testExpiredRequestRefusedBeforeDisplay() throws {
        XCTAssertThrowsError(try BoundReview(
            challengeBytes:challenge(expires:now),
            manifest:manifest(),nowMs:now))
    }
    func testInjectedExtraFieldRejectedByExistingParser() throws {
        var bytes=try challenge()
        bytes.append(Data("target=money\n".utf8))
        XCTAssertThrowsError(try BoundReview(
            challengeBytes:bytes,manifest:manifest(),nowMs:now))
    }
    func testFakeDisplayedEffectCannotBeApproved() throws {
        let original=try manifest()
        let altered=ReviewManifest(id:original.id,fixture:original.fixture,
            operation:original.operation,modelOutput:original.modelOutput,
            description:original.description,
            effect:"Email user credentials to remote server.")
        XCTAssertThrowsError(try BoundReview(
            challengeBytes:challenge(),manifest:altered,nowMs:now))
    }
    func testFakeOutputCannotBeApprovedEvenWithRecomputedDigest() throws {
        let original=try manifest()
        let altered=ReviewManifest(id:original.id,fixture:original.fixture,
            operation:original.operation,modelOutput:"41",
            description:original.description,effect:original.effect)
        XCTAssertThrowsError(try BoundReview(
            challengeBytes:challenge(digest:try altered.digestForNode()),
            manifest:altered,nowMs:now))
    }
    func testNoClickCannotProduceApprovalOrExecution() throws {
        let b=try bound()
        let p=try ReviewAcknowledgement(request:b,nowMs:now)
        XCTAssertEqual(p.phase,.pending)
        XCTAssertFalse(p.externalActionAllowed)
        XCTAssertFalse(p.signedHumanConsentProven)
        XCTAssertFalse(p.deviceAuthenticationRequested)
    }
    func testClickAcknowledgementStillIsNotSignedConsent() throws {
        let b=try bound()
        var p=try ReviewAcknowledgement(request:b,nowMs:now)
        try p.acknowledgeAfterClick(nowMs:now+1)
        XCTAssertEqual(p.phase,.acknowledged)
        XCTAssertFalse(p.externalActionAllowed)
        XCTAssertFalse(p.signedHumanConsentProven)
        XCTAssertThrowsError(try p.acknowledgeAfterClick(nowMs:now+2))
    }
    func testStopDisablesPreviewImmediately() throws {
        var p=try ReviewAcknowledgement(request:bound(),nowMs:now)
        p.stop()
        XCTAssertEqual(p.phase,.stopped)
        XCTAssertThrowsError(try p.acknowledgeAfterClick(nowMs:now+1))
    }
    func testDenyDisablesPreview() throws {
        var p=try ReviewAcknowledgement(request:bound(),nowMs:now)
        p.deny()
        XCTAssertEqual(p.phase,.denied)
        XCTAssertThrowsError(try p.acknowledgeAfterClick(nowMs:now+1))
    }
    func testExpiryPreventsClick() throws {
        var p=try ReviewAcknowledgement(request:bound(),nowMs:now)
        XCTAssertThrowsError(try p.acknowledgeAfterClick(nowMs:60100))
        XCTAssertEqual(p.phase,.expired)
    }
    func testRollbackDuringReviewFailsClosed() throws {
        var p=try ReviewAcknowledgement(request:bound(),nowMs:now+10)
        XCTAssertThrowsError(try p.acknowledgeAfterClick(nowMs:now+9))
        XCTAssertEqual(p.phase,.denied)
    }
    func testLocalDemoAlwaysPreviewOnlyAndNeverAuthenticated() throws {
        let b=try LocalDemo.make(nowMs:now)
        XCTAssertEqual(b.challenge.proposalID,"demo_preview")
        XCTAssertEqual(b.challenge.expiresAtMs,60100)
        XCTAssertFalse(b.externalActionAllowed)
        XCTAssertFalse(b.trustedIssuerAuthenticated)
    }
    func testInvalidLocalDemoClockRejected() {
        XCTAssertThrowsError(try LocalDemo.make(nowMs:-1))
        XCTAssertThrowsError(try LocalDemo.make(nowMs:Int64.max))
    }
    func testInvalidManifestIdRejected() {
        XCTAssertThrowsError(try ReviewManifest.arithmetic(id:""))
        XCTAssertThrowsError(try ReviewManifest.arithmetic(id:"pay\nnow"))
        XCTAssertThrowsError(try ReviewManifest.arithmetic(id:"../secret"))
    }
}
