import Foundation
import CryptoKit
import IssuerEnvelopeCore
import ReviewBindingCore
import UnfireEnclaveGate

public enum ConsentSessionError: Error, Equatable {
    case invalidSignedRequest
    case expired
    case invalidClock
    case alreadyFinalized
    case staleAttempt
    case incorrectSignature
    case noProtectedKey
}

/// Research-only decision controller. The signed envelope and exact human-visible
/// description are checked before presenting any review option.
///
/// Opening consumes NO approval. A direct button interaction reserves the issuer
/// nonce in the shared SQLite receiver BEFORE invoking a signing adapter.
/// The display and signature are still only for "synthetic.preview".
@MainActor
public final class SyntheticConsentSession {
    public enum Phase: Equatable {
        case pending
        case signing(UUID)
        case verifiedPreview
        case denied
        case expired
        case stopped
    }

    public let envelope: VerifiedIssuerEnvelope
    public let review: BoundReview
    public private(set) var phase: Phase = .pending

    private let inbox: SyntheticIssuerInbox
    private let envelopeData: Data
    private let issuerPublicDER: Data
    private var lastSeenMs: Int64

    public init(
        envelopeData: Data,
        pinnedIssuerPublicDER: Data,
        journalPath: String,
        nowMs: Int64
    ) throws {
        let verified = try VerifiedIssuerEnvelope(
            bytes: envelopeData,
            pinnedPublicKeyDER: pinnedIssuerPublicDER
        )
        guard nowMs >= 0, nowMs < verified.expiresAtMs else {
            throw ConsentSessionError.expired
        }
        let bound: BoundReview
        do {
            bound = try BoundReview(
                challengeBytes: verified.challengeBytes,
                manifest: ReviewManifest.arithmetic(id: "task_a"),
                nowMs: nowMs
            )
        } catch {
            throw ConsentSessionError.invalidSignedRequest
        }
        guard verified.expiresAtMs <= bound.challenge.expiresAtMs else {
            throw ConsentSessionError.invalidSignedRequest
        }
        let receiver = try SyntheticIssuerInbox(
            databasePath: journalPath,
            pinnedPublicKeyDER: pinnedIssuerPublicDER
        )
        guard !receiver.stopped else {
            throw IssuerEnvelopeError.persistentStop
        }
        self.envelope = verified
        self.review = bound
        self.inbox = receiver
        self.envelopeData = envelopeData
        self.issuerPublicDER = pinnedIssuerPublicDER
        self.lastSeenMs = nowMs
    }

    private func validateTime(_ now: Int64) throws {
        guard now >= lastSeenMs else {
            phase = .denied
            throw ConsentSessionError.invalidClock
        }
        lastSeenMs = now
        guard now < envelope.expiresAtMs,
              now < review.challenge.expiresAtMs else {
            phase = .expired
            throw ConsentSessionError.expired
        }
        guard !inbox.stopped else {
            phase = .stopped
            throw IssuerEnvelopeError.persistentStop
        }
    }

    /// ONLY the actual visible Confirm button may call this method.
    /// Once this succeeds, the nonce has been durably consumed, even if the
    /// later signing attempt fails or is cancelled. No automatic retry.
    public func beginAfterUserClick(nowMs: Int64) throws -> UUID {
        guard phase == .pending else {
            throw ConsentSessionError.alreadyFinalized
        }
        try validateTime(nowMs)
        _ = try inbox.inspectAndConsume(
            envelopeData: envelopeData,
            pinnedIssuerPublicKeyDER: issuerPublicDER,
            nowMs: nowMs
        )
        let ticket = UUID()
        phase = .signing(ticket)
        return ticket
    }

    /// This verifies the P-256 signature only. Even an apparently valid
    /// signature does NOT prove the key came from Secure Enclave or a person.
    /// Real identity enrollment/consent claims deliberately remain FALSE.
    public func finish(
        ticket: UUID,
        publicKeyDER: Data,
        signatureDER: Data,
        nowMs: Int64
    ) throws {
        guard phase == .signing(ticket) else {
            throw ConsentSessionError.staleAttempt
        }
        try validateTime(nowMs)
        guard let key = try? P256.Signing.PublicKey(
            derRepresentation: publicKeyDER
        ),
        let signature = try? P256.Signing.ECDSASignature(
            derRepresentation: signatureDER
        ),
        key.isValidSignature(signature, for: review.challenge.bytes) else {
            phase = .denied
            throw ConsentSessionError.incorrectSignature
        }
        phase = .verifiedPreview
    }

    /// Deny is final and attempts to burn the issued nonce, so another
    /// UI session cannot treat this rejected request as fresh.
    public func deny(nowMs: Int64) {
        guard phase == .pending || isSigning else { return }
        if phase == .pending {
            try? inbox.inspectAndConsume(
                envelopeData: envelopeData,
                pinnedIssuerPublicKeyDER: issuerPublicDER,
                nowMs: nowMs
            )
        }
        phase = .denied
    }

    /// STOP is persisted in the receiver SQLite journal and immediately
    /// invalidates any pending asynchronous signing callback.
    public func stop(nowMs: Int64) throws {
        phase = .stopped
        try inbox.stop(nowMs: nowMs)
    }

    private var isSigning: Bool {
        if case .signing = phase { return true }
        return false
    }

    public var canConfirm: Bool { phase == .pending && !inbox.stopped }
    public var externalActionAllowed: Bool { false }
    public var productionIdentityVerified: Bool { false }
    public var authenticatedHumanConsentProven: Bool { false }
    public var actualToolExecuted: Bool { false }
}
