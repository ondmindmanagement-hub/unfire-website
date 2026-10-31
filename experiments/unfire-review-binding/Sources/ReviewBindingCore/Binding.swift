import Foundation
import CryptoKit
import UnfireEnclaveGate

public enum ReviewBindingError: Error, Equatable {
    case untrustedDisplay
    case mismatchedRequest
    case expired
    case alreadyDecided
    case rollback
}

/// Public synthetic fixture only. Neither arbitrary model data nor side effects
/// can create a review item through this initializer.
public struct ReviewManifest: Sendable, Equatable {
    public let id: String
    public let fixture: String
    public let operation: String
    public let modelOutput: String
    public let description: String
    public let effect: String

    public static func arithmetic(id:String) throws -> ReviewManifest {
        guard id.range(of:#"^[a-z][a-z0-9_-]{0,31}$"#,
                       options:.regularExpression) != nil else {
            throw ReviewBindingError.untrustedDisplay
        }
        return ReviewManifest(
            id:id, fixture:"arithmetic",
            operation:"synthetic.preview", modelOutput:"42",
            description:"Verify the public fixture: 17 + 25 = 42.",
            effect:"Local preview only. No app, file, account, network or payment changes."
        )
    }

    /// Mirror the exact Node JSON.stringify([
    ///   DOMAIN, proposal.id, fixture.id, OPERATION, proposal.modelOutput
    /// ]) for this strict, ASCII-only synthetic fixture.
    public func digestForNode() throws -> String {
        let fields = ["UNFIRE-P256-V1",id,fixture,operation,modelOutput]
        let canonical = try JSONSerialization.data(
            withJSONObject:fields, options:[.fragmentsAllowed]
        )
        return SHA256.hash(data:canonical)
            .map{String(format:"%02x",$0)}.joined()
    }
}

public struct BoundReview: Sendable {
    public let challenge: CanonicalPreviewChallenge
    public let manifest: ReviewManifest
    public let challengeFingerprint: String

    public init(challengeBytes:Data,manifest:ReviewManifest,nowMs:Int64) throws {
        let canonical=try CanonicalPreviewChallenge(bytes:challengeBytes)
        guard nowMs>=0,nowMs<canonical.expiresAtMs else {
            throw ReviewBindingError.expired
        }
        guard canonical.decision=="APPROVE",
              canonical.proposalID==manifest.id,
              canonical.proposalDigest==(try manifest.digestForNode()),
              manifest.operation=="synthetic.preview",
              manifest.fixture=="arithmetic",
              manifest.modelOutput=="42",
              manifest.description=="Verify the public fixture: 17 + 25 = 42.",
              manifest.effect=="Local preview only. No app, file, account, network or payment changes."
        else { throw ReviewBindingError.mismatchedRequest }
        self.challenge=canonical
        self.manifest=manifest
        self.challengeFingerprint=SHA256.hash(data:challengeBytes)
            .map{String(format:"%02x",$0)}.joined()
    }

    public var externalActionAllowed:Bool {false}
    public var signedHumanConsentProven:Bool {false}
    public var trustedIssuerAuthenticated:Bool {false}
}

public struct ReviewAcknowledgement {
    public enum Phase: Equatable {
        case pending
        case acknowledged
        case denied
        case stopped
        case expired
    }
    public let request: BoundReview
    public private(set) var phase: Phase = .pending
    private var lastSeenMs:Int64

    public init(request:BoundReview,nowMs:Int64) throws {
        guard nowMs>=0,nowMs<request.challenge.expiresAtMs else {
            throw ReviewBindingError.expired
        }
        self.request=request
        self.lastSeenMs=nowMs
    }

    /// Called only by the visible "Confirm preview" button. Produces no
    /// cryptographic human approval and never permits a tool operation.
    public mutating func acknowledgeAfterClick(nowMs:Int64) throws {
        guard phase == .pending else{throw ReviewBindingError.alreadyDecided}
        guard nowMs>=lastSeenMs else{
            phase = .denied
            throw ReviewBindingError.rollback
        }
        lastSeenMs=nowMs
        guard nowMs<request.challenge.expiresAtMs else{
            phase = .expired
            throw ReviewBindingError.expired
        }
        phase = .acknowledged
    }

    public mutating func deny() {
        guard phase == .pending else{return}
        phase = .denied
    }
    public mutating func stop() {
        phase = .stopped
    }

    public var externalActionAllowed:Bool {false}
    public var signedHumanConsentProven:Bool {false}
    public var deviceAuthenticationRequested:Bool {false}
}

/// Construct a local **untrusted mock** challenge for visible UI testing.
/// No Node journal, server, key or remote issuer is used.
public enum LocalDemo {
    public static func make(nowMs:Int64) throws -> BoundReview {
        guard nowMs>=0,nowMs<Int64.max-60000 else{throw ReviewBindingError.expired}
        let manifest=try ReviewManifest.arithmetic(id:"demo_preview")
        var generator=SystemRandomNumberGenerator()
        let nonce=(0..<24).map{_ in
            String(format:"%02x",UInt8.random(in:0...255,using:&generator))
        }.joined()
        let text=[
            "UNFIRE-P256-V1","algorithm=ECDSA-P256-SHA256",
            "operation=synthetic.preview",
            "proposalId="+manifest.id,
            "proposalDigest="+(try manifest.digestForNode()),
            "nonce="+nonce,
            "expiresAt="+String(nowMs+60000),
            "decision=APPROVE",
            ""
        ].joined(separator:"\n")
        return try BoundReview(
            challengeBytes:Data(text.utf8),manifest:manifest,nowMs:nowMs
        )
    }
}
