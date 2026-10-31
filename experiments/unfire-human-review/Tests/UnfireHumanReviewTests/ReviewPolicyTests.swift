import XCTest
import Foundation
@testable import UnfireHumanReview

final class ReviewPolicyTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)
    private func makePolicy() -> ReviewPolicy {
        ReviewPolicy(request: .synthetic(at: start))
    }

    func testExactPublicSyntheticRequestOnly() {
        let good = ReviewRequest.synthetic(at: start)
        XCTAssertTrue(good.isFixedPublicDemo)
        XCTAssertEqual(good.operation, "synthetic.preview")
        XCTAssertEqual(good.fingerprint.count, 64)
        let altered = ReviewRequest(
            id: good.id, operation: "email.send", target: good.target,
            description: good.description, effect: good.effect,
            fingerprint: good.fingerprint, createdAt: good.createdAt,
            expiresAt: good.expiresAt
        )
        XCTAssertFalse(altered.isFixedPublicDemo)
        XCTAssertEqual(ReviewPolicy(request: altered).phase, .denied)
    }

    func testDefaultRequiresHumanInteraction() {
        let gate = makePolicy()
        XCTAssertEqual(gate.phase, .pending)
        XCTAssertFalse(gate.externalActionAllowed)
        XCTAssertFalse(gate.signedAuthorizationProduced)
        XCTAssertTrue(gate.isSimulation)
    }

    func testAuthenticationCannotCompleteWithoutUserClickTicket() {
        var gate = makePolicy()
        gate.completeAuthentication(ticket: UUID(), granted: true, now: start)
        XCTAssertEqual(gate.phase, .pending)
        XCTAssertFalse(gate.externalActionAllowed)
    }

    func testVerifiedDeviceCallbackYieldsOnlyInertPreview() {
        var gate = makePolicy()
        let ticket = gate.beginAuthentication(now: start)!
        gate.completeAuthentication(ticket: ticket, granted: true, now: start.addingTimeInterval(1))
        XCTAssertEqual(gate.phase, .approvedPreview)
        XCTAssertFalse(gate.externalActionAllowed)
        XCTAssertFalse(gate.signedAuthorizationProduced)
        XCTAssertNil(gate.beginAuthentication(now: start.addingTimeInterval(2)))
    }

    func testWrongOrStaleCallbackIsRejected() {
        var gate = makePolicy()
        _ = gate.beginAuthentication(now: start)
        gate.completeAuthentication(ticket: UUID(), granted: true, now: start.addingTimeInterval(1))
        XCTAssertEqual(gate.phase, .authenticating)
        gate.stop()
        XCTAssertEqual(gate.phase, .cancelled)
        gate.completeAuthentication(ticket: UUID(), granted: true, now: start.addingTimeInterval(2))
        XCTAssertEqual(gate.phase, .cancelled)
    }

    func testDeviceAuthenticationDenialStopsPreview() {
        var gate = makePolicy()
        let ticket = gate.beginAuthentication(now: start)!
        gate.completeAuthentication(ticket: ticket, granted: false, now: start.addingTimeInterval(1))
        XCTAssertEqual(gate.phase, .denied)
        XCTAssertNil(gate.beginAuthentication(now: start.addingTimeInterval(2)))
    }

    func testHumanDenyPreventsDelayedCallbackFromApproving() {
        var gate = makePolicy()
        let ticket = gate.beginAuthentication(now: start)!
        gate.deny()
        gate.completeAuthentication(ticket: ticket, granted: true, now: start.addingTimeInterval(1))
        XCTAssertEqual(gate.phase, .denied)
    }

    func testStopBeforeConfirmationBlocksEverything() {
        var gate = makePolicy()
        gate.stop()
        XCTAssertEqual(gate.phase, .cancelled)
        XCTAssertNil(gate.beginAuthentication(now: start))
    }

    func testStopAfterSuccessRevokesLocalPreviewStatus() {
        var gate = makePolicy()
        let ticket = gate.beginAuthentication(now: start)!
        gate.completeAuthentication(ticket: ticket, granted: true, now: start.addingTimeInterval(1))
        gate.stop()
        XCTAssertEqual(gate.phase, .cancelled)
        XCTAssertFalse(gate.externalActionAllowed)
    }

    func testExpiredRequestCannotStartAuthentication() {
        var gate = makePolicy()
        let ticket = gate.beginAuthentication(now: start.addingTimeInterval(60))
        XCTAssertNil(ticket)
        XCTAssertEqual(gate.phase, .expired)
    }

    func testExpiryDuringAuthenticationBlocksStaleApproval() {
        var gate = makePolicy()
        let ticket = gate.beginAuthentication(now: start)!
        gate.completeAuthentication(ticket: ticket, granted: true, now: start.addingTimeInterval(61))
        XCTAssertEqual(gate.phase, .expired)
    }

    func testClockRollbackFailsClosed() {
        var gate = makePolicy()
        let ticket = gate.beginAuthentication(now: start.addingTimeInterval(15))!
        gate.completeAuthentication(ticket: ticket, granted: true, now: start.addingTimeInterval(14))
        XCTAssertEqual(gate.phase, .denied)
        XCTAssertFalse(gate.externalActionAllowed)
    }

    func testSecondStartCannotReplaceLiveTicket() {
        var gate = makePolicy()
        let first = gate.beginAuthentication(now: start)!
        XCTAssertNil(gate.beginAuthentication(now: start.addingTimeInterval(1)))
        gate.completeAuthentication(ticket: first, granted: true, now: start.addingTimeInterval(2))
        XCTAssertEqual(gate.phase, .approvedPreview)
    }

    func testArbitraryToolScopesAreNotPermitted() {
        let original = ReviewRequest.synthetic(at: start)
        for scope in ["github.release", "filesystem.write", "email.send", "payment.create"] {
            let malicious = ReviewRequest(
                id: original.id, operation: scope,
                target: original.target, description: original.description,
                effect: original.effect, fingerprint: original.fingerprint,
                createdAt: original.createdAt, expiresAt: original.expiresAt
            )
            var gate = ReviewPolicy(request: malicious)
            XCTAssertEqual(gate.phase, .denied)
            XCTAssertNil(gate.beginAuthentication(now: start))
        }
    }

    func testFingerprintChangesWithTimeIndependentOfModelOutput() {
        let a = ReviewRequest.synthetic(at: start)
        let b = ReviewRequest.synthetic(at: start.addingTimeInterval(1))
        XCTAssertEqual(a.fingerprint, b.fingerprint)
        XCTAssertNotEqual(a.expiresAt, b.expiresAt)
        // Deliberate limitation: displayed illustrative digest is NOT a signed
        // challenge and therefore does not cryptographically bind expiry.
    }
}
