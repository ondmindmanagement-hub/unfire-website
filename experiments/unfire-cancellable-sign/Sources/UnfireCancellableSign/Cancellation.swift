import Foundation
import LocalAuthentication
import ConsentSessionCore

/// Deliberately NOT a real tool permission or a human attestation.
public struct SyntheticSignature: Sendable {
    public let publicKeyDER: Data
    public let signatureDER: Data
    public init(publicKeyDER: Data, signatureDER: Data) {
        self.publicKeyDER = publicKeyDER
        self.signatureDER = signatureDER
    }
}

public enum CancellableSigningError: Error, Equatable {
    case stopped
    case alreadyStarted
    case signerCancelled
    case signerFailed
}

/// The implementation must never block the main actor while a system
/// authentication or cryptographic operation runs. Cancellation is synchronous.
public protocol SyntheticSigningWorker: Sendable {
    func sign(challengeBytes: Data) async throws -> SyntheticSignature
    func cancel()
}

/// Nonisolated STOP fence. A late result can never be promoted to consent or
/// external access even if a lower-level synchronous signer cannot be stopped.
public final class StopFence: @unchecked Sendable {
    private let lock = NSLock()
    private var closed = false

    public init() {}
    @discardableResult
    public func trip() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        let wasOpen = !closed
        closed = true
        return wasOpen
    }
    public var isStopped: Bool {
        lock.lock()
        defer { lock.unlock() }
        return closed
    }
}

/// A cancellable background executor with no signing/key implementation built in.
///
/// The host-supplied callback MAY block on LocalAuthentication; the callback is
/// always run away from MainActor. A real hardware callback would require a
/// separate security review. Automated tests provide a non-biometric mock only.
///
/// Apple documents LAContext.invalidate() stops pending policy evaluations.
/// It does NOT prove all in-flight Secure Enclave signing calls stop instantly.
public final class InterruptibleContextWorker: SyntheticSigningWorker, @unchecked Sendable {
    private let lock = NSLock()
    private let context: LAContext
    private let work: @Sendable (Data, LAContext) throws -> SyntheticSignature
    private var cancelled = false

    public init(
        work: @escaping @Sendable (Data, LAContext) throws -> SyntheticSignature
    ) throws {
        self.context = try LAContext()
        self.work = work
    }

    private var isCancelled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return cancelled
    }

    public func cancel() {
        lock.lock()
        let shouldInvalidate = !cancelled
        cancelled = true
        lock.unlock()
        if shouldInvalidate { context.invalidate() }
    }

    public func sign(challengeBytes: Data) async throws -> SyntheticSignature {
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                DispatchQueue.global(qos: .userInitiated).async {
                    guard !self.isCancelled else {
                        continuation.resume(throwing: CancellableSigningError.signerCancelled)
                        return
                    }
                    do {
                        let result = try self.work(challengeBytes, self.context)
                        guard !self.isCancelled else {
                            continuation.resume(throwing: CancellableSigningError.signerCancelled)
                            return
                        }
                        continuation.resume(returning: result)
                    } catch {
                        continuation.resume(throwing: error)
                    }
                }
            }
        } onCancel: {
            self.cancel()
        }
    }
}

@MainActor
public final class CancellableReviewFlow {
    public enum Phase: Equatable {
        case ready
        case signing
        case previewOnly
        case denied
        case stopped
    }

    public let session: SyntheticConsentSession
    public private(set) var phase: Phase = .ready
    public private(set) var stopPersisted = false
    public private(set) var lastFailure: String?

    private let worker: any SyntheticSigningWorker
    private let fence: StopFence
    private let nowMs: @Sendable () -> Int64

    public init(
        session: SyntheticConsentSession,
        worker: any SyntheticSigningWorker,
        fence: StopFence = StopFence(),
        nowMs: @escaping @Sendable () -> Int64
    ) {
        self.session = session
        self.worker = worker
        self.fence = fence
        self.nowMs = nowMs
    }

    /// Called by the visible Confirm button only. The existing session burns
    /// the signed issuer nonce transactionally BEFORE any async signing starts.
    /// No signer request is ever made by creating or displaying this flow.
    public func confirmAfterUserClick() async throws {
        guard phase == .ready, !fence.isStopped else {
            throw CancellableSigningError.alreadyStarted
        }
        let ticket = try session.beginAfterUserClick(nowMs: nowMs())
        phase = .signing
        do {
            let signed = try await worker.sign(
                challengeBytes: session.review.challenge.bytes
            )
            guard !fence.isStopped, phase == .signing else {
                throw CancellableSigningError.stopped
            }
            try session.finish(
                ticket: ticket,
                publicKeyDER: signed.publicKeyDER,
                signatureDER: signed.signatureDER,
                nowMs: nowMs()
            )
            // STOP can originate on another thread. Check a second time,
            // including after the synchronous journal/session verification.
            guard !fence.isStopped else {
                phase = .stopped
                throw CancellableSigningError.stopped
            }
            phase = .previewOnly
        } catch {
            if fence.isStopped {
                phase = .stopped
            } else {
                session.deny(nowMs: nowMs())
                phase = .denied
            }
            lastFailure = String(describing: error)
            throw error
        }
    }

    /// Independent of MainActor: can be called from another thread even if
    /// macOS authentication is in flight. The STOP fence is tripped *before*
    /// touching the OS authentication context or scheduling persistent STOP.
    nonisolated public func emergencyStop() {
        fence.trip()
        worker.cancel()
        Task { @MainActor [weak self] in
            self?.persistStopIfNeeded()
        }
    }

    /// User-facing STOP uses the same independent fence and cancellation path.
    public func stopFromUser() {
        emergencyStop()
        persistStopIfNeeded()
    }

    private func persistStopIfNeeded() {
        phase = .stopped
        guard !stopPersisted else { return }
        do {
            try session.stop(nowMs: nowMs())
            stopPersisted = true
        } catch {
            lastFailure = "Persistent STOP not verified: \(error)"
            // STOP fence remains closed even if disk persistence failed.
        }
    }

    public func denyFromUser() {
        guard phase == .ready || phase == .signing else { return }
        fence.trip()
        worker.cancel()
        session.deny(nowMs: nowMs())
        phase = .denied
    }

    public var stopFenceClosed: Bool { fence.isStopped }
    public var externalActionAllowed: Bool { false }
    public var humanConsentProven: Bool { false }
    public var productionIdentityVerified: Bool { false }
}
