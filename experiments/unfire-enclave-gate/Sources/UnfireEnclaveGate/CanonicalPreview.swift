import Foundation
import CryptoKit

public enum EnclaveReviewError: Error, Equatable {
    case invalidChallenge
    case unsupportedScope
    case expired
    case clockRollback
    case alreadyFinalized
    case wrongAttempt
    case invalidSignature
}

/// Strict, exact UTF-8 bytes of an externally issued synthetic preview challenge.
/// No model-generated text is parsed or executed by this package.
public struct CanonicalPreviewChallenge: Sendable, Equatable {
    public let bytes: Data
    public let proposalID: String
    public let proposalDigest: String
    public let nonce: String
    public let expiresAtMs: Int64
    public let decision: String

    public init(bytes: Data) throws {
        guard bytes.count <= 1024, bytes.count > 100,
              let text=String(data:bytes,encoding:.utf8),
              text.utf8.elementsEqual(bytes),
              text.unicodeScalars.allSatisfy({ $0.isASCII }) else {
            throw EnclaveReviewError.invalidChallenge
        }
        let lines=text.components(separatedBy:"\n")
        guard lines.count==9, lines[0]=="UNFIRE-P256-V1",
              lines[1]=="algorithm=ECDSA-P256-SHA256",
              lines[2]=="operation=synthetic.preview",
              lines[8].isEmpty else { throw EnclaveReviewError.unsupportedScope }

        func part(_ index:Int,_ prefix:String)->String? {
            guard lines[index].hasPrefix(prefix) else{return nil}
            return String(lines[index].dropFirst(prefix.count))
        }
        guard let id=part(3,"proposalId="),
              let digest=part(4,"proposalDigest="),
              let nonce=part(5,"nonce="),
              let expiry=part(6,"expiresAt="),
              let decision=part(7,"decision=") else {
            throw EnclaveReviewError.invalidChallenge
        }
        let idBytes=Array(id.utf8)
        guard idBytes.count>=1, idBytes.count<=32,
              (97...122).contains(Int(idBytes[0])),
              idBytes.dropFirst().allSatisfy({
                  (97...122).contains(Int($0)) ||
                  (48...57).contains(Int($0)) || $0==45 || $0==95
              }),
              digest.utf8.count==64,
              digest.utf8.allSatisfy({
                  (48...57).contains(Int($0))||(97...102).contains(Int($0))
              }),
              nonce.utf8.count==48,
              nonce.utf8.allSatisfy({
                  (48...57).contains(Int($0))||(97...102).contains(Int($0))
              }),
              expiry.utf8.count>=1,
              expiry.utf8.allSatisfy({(48...57).contains(Int($0))}),
              (expiry=="0" || !expiry.hasPrefix("0")),
              let expiryMs=Int64(expiry),expiryMs>=0,
              decision=="APPROVE" || decision=="DENY" else {
            throw EnclaveReviewError.invalidChallenge
        }
        self.bytes=bytes
        self.proposalID=id
        self.proposalDigest=digest
        self.nonce=nonce
        self.expiresAtMs=expiryMs
        self.decision=decision
    }

    /// This research signer is intentionally limited to the no-effect operation.
    public var externalActionAllowed: Bool { false }
}

/// Demonstrates verification of the *exact* Node canonical message and P-256
/// signature using a host-pinned public key. Does not prove human consent.
public struct PreviewReviewSession {
    public enum Phase: Equatable {
        case pending
        case signing(UUID)
        case previewOnly
        case denied
        case expired
        case stopped
    }
    public let challenge: CanonicalPreviewChallenge
    public private(set) var phase: Phase = .pending
    private let pinnedPublicKey: P256.Signing.PublicKey
    private var lastSeenMs: Int64

    public init(challenge:CanonicalPreviewChallenge,
                pinnedPublicKeyDER:Data,createdAtMs:Int64) throws {
        guard createdAtMs>=0,createdAtMs<challenge.expiresAtMs else {
            throw EnclaveReviewError.expired
        }
        self.challenge=challenge
        self.pinnedPublicKey=try P256.Signing.PublicKey(derRepresentation:pinnedPublicKeyDER)
        self.lastSeenMs=createdAtMs
    }
    private mutating func validateClock(_ now:Int64) throws {
        guard now>=lastSeenMs else{
            phase = .denied
            throw EnclaveReviewError.clockRollback
        }
        lastSeenMs=now
        guard now<challenge.expiresAtMs else {
            phase = .expired
            throw EnclaveReviewError.expired
        }
    }
    /// ONLY a real user click on the trusted UI should call this method.
    public mutating func beginAfterUserClick(nowMs:Int64) throws -> UUID {
        guard phase == .pending else{throw EnclaveReviewError.alreadyFinalized}
        try validateClock(nowMs)
        guard challenge.decision=="APPROVE" else{
            phase = .denied
            throw EnclaveReviewError.unsupportedScope
        }
        let attempt=UUID()
        phase = .signing(attempt)
        return attempt
    }
    /// A valid signature can mark *only* an inert preview for the fixed no-effect scope.
    public mutating func finish(attempt:UUID,signatureDER:Data,nowMs:Int64) throws {
        guard phase == .signing(attempt) else{
            throw EnclaveReviewError.wrongAttempt
        }
        try validateClock(nowMs)
        guard let signature=try? P256.Signing.ECDSASignature(derRepresentation:signatureDER),
              pinnedPublicKey.isValidSignature(signature,for:challenge.bytes) else {
            phase = .denied
            throw EnclaveReviewError.invalidSignature
        }
        phase = .previewOnly
    }
    public mutating func deny() {
        if case .pending=phase{phase = .denied}
        if case .signing=phase{phase = .denied}
    }
    public mutating func stop() {
        phase = .stopped
    }
    public var externalActionAllowed:Bool { false }
    public var humanConsentCryptographicallyProven:Bool { false }
}
