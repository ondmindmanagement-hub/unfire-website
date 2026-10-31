import XCTest
import Foundation
import CryptoKit
import LocalAuthentication
import ConsentSessionCore
@testable import UnfireCancellableSign

final class MockDelayedWorker: SyntheticSigningWorker, @unchecked Sendable {
    private let lock=NSLock()
    private var pending: CheckedContinuation<SyntheticSignature,Error>?
    private var starter: CheckedContinuation<Void,Never>?
    private var started=false
    private var wasCancelled=false
    private var invocationCount=0

    func sign(challengeBytes:Data) async throws -> SyntheticSignature {
        try await withCheckedThrowingContinuation { continuation in
            lock.lock()
            invocationCount += 1
            pending=continuation
            started=true
            let s=starter
            starter=nil
            lock.unlock()
            s?.resume()
        }
    }

    func waitForStart() async {
        await withCheckedContinuation { continuation in
            lock.lock()
            if started {
                lock.unlock()
                continuation.resume()
            } else {
                starter=continuation
                lock.unlock()
            }
        }
    }

    func cancel() {
        lock.lock()
        wasCancelled=true
        lock.unlock()
        // Intentionally DO NOT resume the pending request here.
        // A simulated uninterruptible OS call can finish after STOP.
    }
    func release(_ signature:SyntheticSignature) {
        lock.lock()
        let c=pending
        pending=nil
        lock.unlock()
        c?.resume(returning:signature)
    }
    func releaseFailure() {
        lock.lock()
        let c=pending
        pending=nil
        lock.unlock()
        c?.resume(throwing:CancellableSigningError.signerFailed)
    }
    var cancelled:Bool {
        lock.lock();defer{lock.unlock()}
        return wasCancelled
    }
    var calls:Int {
        lock.lock();defer{lock.unlock()}
        return invocationCount
    }
}

final class TestClock: @unchecked Sendable {
    private let lock=NSLock()
    private var stored:Int64
    init(_ start:Int64=101){stored=start}
    func read()->Int64 {
        lock.lock();defer{lock.unlock()}
        return stored
    }
    func set(_ value:Int64){
        lock.lock();stored=value;lock.unlock()
    }
}

@MainActor
final class CancellableSigningTests: XCTestCase {
    private struct Fixture {
        let issuer:P256.Signing.PrivateKey
        let reviewer:P256.Signing.PrivateKey
        let envelope:Data
        let dir:URL
        let journal:String
        func clean(){try? FileManager.default.removeItem(at:dir)}
        func session(at:Int64=100) throws->SyntheticConsentSession {
            try SyntheticConsentSession(
                envelopeData:envelope,
                pinnedIssuerPublicDER:issuer.publicKey.derRepresentation,
                pinnedReviewerPublicDER:reviewer.publicKey.derRepresentation,
                journalPath:journal,
                nowMs:at
            )
        }
        func signature() throws->SyntheticSignature {
            let lines=String(decoding:envelope,as:UTF8.self)
                .components(separatedBy:"\n")
            let b64=String(lines[5].dropFirst("challengeB64=".count))
            let message=Data(base64Encoded:b64)!
            let sig=try reviewer.signature(for:message)
            return SyntheticSignature(publicKeyDER:reviewer.publicKey.derRepresentation,
                signatureDER:sig.derRepresentation)
        }
    }
    private func fixture() throws -> Fixture {
        let issuer=P256.Signing.PrivateKey()
        let reviewer=P256.Signing.PrivateKey()
        let folder=FileManager.default.temporaryDirectory
            .appendingPathComponent("unfire-cancel-test-"+UUID().uuidString)
        try FileManager.default.createDirectory(
            at:folder,withIntermediateDirectories:true
        )
        let digest=SHA256.hash(data:try JSONSerialization.data(
            withJSONObject:[
                "UNFIRE-P256-V1","task_a","arithmetic","synthetic.preview","42"
            ]
        )).map{String(format:"%02x",$0)}.joined()
        let request=[
            "UNFIRE-P256-V1","algorithm=ECDSA-P256-SHA256",
            "operation=synthetic.preview","proposalId=task_a",
            "proposalDigest="+digest,
            "nonce="+String(repeating:"b",count:48),
            "expiresAt=60100","decision=APPROVE",""
        ].joined(separator:"\n")
        let body=[
            "UNFIRE-ISSUER-ENVELOPE-V1","algorithm=ECDSA-P256-SHA256",
            "issuerId=unfire-local-controller",
            "nonce="+String(repeating:"c",count:48),
            "expiresAt=60000",
            "challengeB64="+Data(request.utf8).base64EncodedString(),""
        ].joined(separator:"\n")
        let sig=try issuer.signature(for:Data(body.utf8))
        let envelope=Data((body+"signatureDER="+sig.derRepresentation
            .base64EncodedString()+"\n").utf8)
        return Fixture(issuer:issuer,reviewer:reviewer,envelope:envelope,dir:folder,
            journal:folder.appendingPathComponent("journal.sqlite").path)
    }

    func testOpeningReviewDoesNotAskSignerOrGrantAnything() throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        XCTAssertEqual(flow.phase,.ready)
        XCTAssertEqual(worker.calls,0)
        XCTAssertFalse(flow.stopFenceClosed)
        XCTAssertFalse(flow.externalActionAllowed)
        XCTAssertFalse(flow.humanConsentProven)
        XCTAssertFalse(flow.productionIdentityVerified)
    }

    func testExplicitClickCanVerifyOnlyAnInertSoftwarePreview() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        XCTAssertEqual(flow.phase,.signing)
        XCTAssertEqual(worker.calls,1)
        worker.release(try f.signature())
        try await running.value
        XCTAssertEqual(flow.phase,.previewOnly)
        XCTAssertFalse(flow.externalActionAllowed)
        XCTAssertFalse(flow.humanConsentProven)
    }

    func testSTOPBeforeClickPreventsWorkerCall() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        flow.stopFromUser()
        XCTAssertTrue(flow.stopFenceClosed)
        XCTAssertTrue(flow.stopPersisted)
        XCTAssertEqual(flow.phase,.stopped)
        do {try await flow.confirmAfterUserClick()
            XCTFail("STOP allowed a signing attempt")
        }catch{}
        XCTAssertEqual(worker.calls,0)
    }

    func testSTOPDuringBlockedSigningReturnsWithoutWaitingForCallback() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        flow.stopFromUser()
        XCTAssertEqual(flow.phase,.stopped)
        XCTAssertTrue(flow.stopFenceClosed)
        XCTAssertTrue(flow.stopPersisted)
        XCTAssertTrue(worker.cancelled)
        // Still no callback; STOP has already taken effect.
        worker.release(try f.signature())
        do {try await running.value
            XCTFail("Late successful result was accepted after STOP")
        }catch{}
        XCTAssertEqual(flow.phase,.stopped)
        XCTAssertFalse(flow.externalActionAllowed)
    }

    func testIndependentEmergencySTOPTripsFenceOffMainActor() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        await Task.detached {
            flow.emergencyStop()
        }.value
        XCTAssertTrue(flow.stopFenceClosed)
        XCTAssertTrue(worker.cancelled)
        // Returning late, even while persistence is queued, never grants preview.
        worker.release(try f.signature())
        do {try await running.value
            XCTFail("Background STOP was bypassed")
        }catch{}
        XCTAssertNotEqual(flow.phase,.previewOnly)
        XCTAssertFalse(flow.externalActionAllowed)
    }

    func testDenyDuringBlockedSigningInvalidatesCallback() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        flow.denyFromUser()
        XCTAssertEqual(flow.phase,.denied)
        XCTAssertTrue(worker.cancelled)
        worker.release(try f.signature())
        do{try await running.value
            XCTFail("Denied callback became a preview")
        }catch{}
        XCTAssertNotEqual(flow.phase,.previewOnly)
    }

    func testWorkerErrorDoesNotBecomeAutomaticRetry() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        worker.releaseFailure()
        do{try await running.value
            XCTFail("Failed signer became success")
        }catch{}
        XCTAssertEqual(flow.phase,.denied)
        do{try await flow.confirmAfterUserClick()
            XCTFail("Signing restarted")
        }catch{}
        XCTAssertEqual(worker.calls,1)
    }

    func testTwoClicksCannotMakeTwoSigningAttempts() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        do{try await flow.confirmAfterUserClick()
            XCTFail("Second click started another worker")
        }catch{}
        XCTAssertEqual(worker.calls,1)
        worker.release(try f.signature())
        try await running.value
    }

    func testExpiryAfterSignBeginsRejectsLateValidSignature() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        clock.set(60000)
        worker.release(try f.signature())
        do{try await running.value
            XCTFail("Expired signature was accepted")
        }catch{}
        XCTAssertNotEqual(flow.phase,.previewOnly)
    }

    func testBackwardClockOnPersistentSTOPKeepsInMemoryFenceClosed() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        clock.set(99)
        flow.stopFromUser()
        XCTAssertEqual(flow.phase,.stopped)
        XCTAssertTrue(flow.stopFenceClosed)
        XCTAssertFalse(flow.stopPersisted)
        XCTAssertNotNil(flow.lastFailure)
        worker.release(try f.signature())
        do{try await running.value
            XCTFail("Unpersisted STOP let late signature through")
        }catch{}
        XCTAssertFalse(flow.externalActionAllowed)
    }

    func testSeparateSessionSeesPersistedSTOP() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        flow.stopFromUser()
        XCTAssertTrue(flow.stopPersisted)
        XCTAssertThrowsError(try f.session(at:102))
    }

    func testUnpinnedSignatureRejectedAfterBackgroundWork() async throws {
        let f=try fixture();defer{f.clean()}
        let worker=MockDelayedWorker(),clock=TestClock()
        let flow=CancellableReviewFlow(
            session:try f.session(),worker:worker,nowMs:{clock.read()}
        )
        let running=Task{try await flow.confirmAfterUserClick()}
        await worker.waitForStart()
        let wrong=P256.Signing.PrivateKey()
        let challenge=flow.session.review.challenge.bytes
        let signature=try wrong.signature(for:challenge)
        worker.release(SyntheticSignature(
            publicKeyDER:wrong.publicKey.derRepresentation,
            signatureDER:signature.derRepresentation
        ))
        do{try await running.value
            XCTFail("Wrong signer key was accepted")
        }catch{}
        XCTAssertEqual(flow.phase,.denied)
    }

    func testContextWorkerCancellationDiscardsLateMockResult() async throws {
        let started=DispatchSemaphore(value:0)
        let allowReturn=DispatchSemaphore(value:0)
        let worker=try InterruptibleContextWorker { _,_ in
            started.signal()
            _ = allowReturn.wait(timeout:.now()+5)
            return SyntheticSignature(publicKeyDER:Data([1]),
                                      signatureDER:Data([2]))
        }
        let task=Task.detached {
            try await worker.sign(challengeBytes:Data("inert".utf8))
        }
        XCTAssertEqual(started.wait(timeout:.now()+4),.success)
        worker.cancel()
        allowReturn.signal()
        do{_ = try await task.value
            XCTFail("Cancelled context worker returned success")
        }catch{}
    }

    func testStopFenceIsThreadSafeAndIrreversible() async {
        let fence=StopFence()
        let outcomes=await withTaskGroup(of:Bool.self) { group in
            for _ in 0..<16 {
                group.addTask { fence.trip() }
            }
            var values:[Bool]=[]
            for await result in group { values.append(result) }
            return values
        }
        XCTAssertEqual(outcomes.filter{$0}.count,1)
        XCTAssertTrue(fence.isStopped)
        XCTAssertFalse(fence.trip())
    }
}
