import Foundation
import CryptoKit

/// An immutable, public demonstration request. It is NOT a production authorization challenge.
struct ReviewRequest: Sendable {
    let id: String
    let operation: String
    let target: String
    let description: String
    let effect: String
    let fingerprint: String
    let createdAt: Date
    let expiresAt: Date

    static func synthetic(at date: Date) -> ReviewRequest {
        let payload = "unfire-human-review-v1|demo_preview|synthetic.preview|arithmetic|42|no-external-effect"
        let hash = SHA256.hash(data: Data(payload.utf8))
            .map { String(format: "%02x", $0) }.joined()
        return ReviewRequest(
            id: "demo_preview",
            operation: "synthetic.preview",
            target: "This Mac · Isolated demonstration",
            description: "Preview the verified public arithmetic fixture: 17 + 25 = 42.",
            effect: "No file changes. No network requests. No accounts or purchases.",
            fingerprint: hash,
            createdAt: date,
            expiresAt: date.addingTimeInterval(60)
        )
    }

    var isFixedPublicDemo: Bool {
        let expected = Self.synthetic(at: createdAt)
        return id == expected.id && operation == expected.operation &&
            target == expected.target && description == expected.description &&
            effect == expected.effect && fingerprint == expected.fingerprint &&
            expiresAt == expected.expiresAt
    }
}

enum ReviewPhase: String, Sendable {
    case pending = "Awaiting review"
    case authenticating = "Device authentication"
    case approvedPreview = "Preview confirmed"
    case denied = "Denied"
    case expired = "Expired"
    case cancelled = "Stopped"
}

/// UI-only transition logic. Does not sign, persist, resume or dispatch any tool operation.
/// LocalAuthentication must be invoked ONLY from a real user's button interaction.
struct ReviewPolicy {
    let request: ReviewRequest
    private(set) var phase: ReviewPhase
    private var activeTicket: UUID?
    private var lastSeen: Date

    init(request: ReviewRequest) {
        self.request = request
        self.phase = request.isFixedPublicDemo ? .pending : .denied
        self.lastSeen = request.createdAt
    }

    /// The OS-authentication callback must present the same private ticket.
    mutating func beginAuthentication(now: Date) -> UUID? {
        guard canContinue(now: now), phase == .pending else { return nil }
        let ticket = UUID()
        activeTicket = ticket
        phase = .authenticating
        return ticket
    }

    /// Called only with the result of LocalAuthentication. Not a cryptographic signature.
    mutating func completeAuthentication(ticket: UUID, granted: Bool, now: Date) {
        guard canContinue(now: now), phase == .authenticating,
            activeTicket == ticket else { return }
        activeTicket = nil
        phase = granted ? .approvedPreview : .denied
    }

    mutating func deny() {
        guard phase == .pending || phase == .authenticating else { return }
        activeTicket = nil
        phase = .denied
    }

    mutating func stop() {
        guard phase != .cancelled else { return }
        activeTicket = nil
        phase = .cancelled
    }

    private mutating func canContinue(now: Date) -> Bool {
        guard phase == .pending || phase == .authenticating else { return false }
        if now < lastSeen {
            phase = .denied
            activeTicket = nil
            return false
        }
        lastSeen = now
        if now >= request.expiresAt {
            phase = .expired
            activeTicket = nil
            return false
        }
        return true
    }

    var isTerminal: Bool {
        [.approvedPreview, .denied, .expired, .cancelled].contains(phase)
    }

    /// Every possible state forbids real actions, including after device authentication.
    var externalActionAllowed: Bool { false }
    var signedAuthorizationProduced: Bool { false }
    var isSimulation: Bool { true }
}
