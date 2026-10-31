import Foundation
import CryptoKit
import SQLite3
import ReviewBindingCore

public enum IssuerEnvelopeError: Error, Equatable {
    case malformedEnvelope
    case untrustedIssuerSignature
    case expired
    case invalidBoundReview
    case persistentStop
    case keyPinMismatch
    case replay
    case clockRollback
    case sqliteFailure
}

public struct VerifiedIssuerEnvelope {
    public let challengeBytes: Data
    public let nonce: String
    public let expiresAtMs: Int64
    public let issuerID: String
    public let issuerFingerprint: String
    public let signedBytesFingerprint: String

    public init(bytes: Data, pinnedPublicKeyDER: Data) throws {
        guard bytes.count > 160, bytes.count <= 4096,
              let utf8=String(data:bytes,encoding:.utf8),
              Data(utf8.utf8)==bytes,
              utf8.unicodeScalars.allSatisfy({$0.isASCII}) else {
            throw IssuerEnvelopeError.malformedEnvelope
        }
        let lines=utf8.components(separatedBy:"\n")
        guard lines.count==8, lines[0]=="UNFIRE-ISSUER-ENVELOPE-V1",
              lines[1]=="algorithm=ECDSA-P256-SHA256",
              lines[2]=="issuerId=unfire-local-controller",
              lines[3].hasPrefix("nonce="),
              lines[4].hasPrefix("expiresAt="),
              lines[5].hasPrefix("challengeB64="),
              lines[6].hasPrefix("signatureDER="),
              lines[7].isEmpty else {
            throw IssuerEnvelopeError.malformedEnvelope
        }
        let nonce=String(lines[3].dropFirst("nonce=".count))
        let expiry=String(lines[4].dropFirst("expiresAt=".count))
        let challenge64=String(lines[5].dropFirst("challengeB64=".count))
        let signature64=String(lines[6].dropFirst("signatureDER=".count))
        guard nonce.utf8.count==48,
              nonce.utf8.allSatisfy({
                  (48...57).contains(Int($0)) || (97...102).contains(Int($0))
              }),
              expiry.count>0, expiry.count<=16,
              expiry.utf8.allSatisfy({(48...57).contains(Int($0))}),
              (expiry=="0" || !expiry.hasPrefix("0")),
              let expiresAt=Int64(expiry), expiresAt>=0,
              let challenge=Data(base64Encoded:challenge64),
              challenge.base64EncodedString()==challenge64,
              challenge.count>100, challenge.count<=1024,
              let signatureData=Data(base64Encoded:signature64),
              signatureData.base64EncodedString()==signature64,
              signatureData.count>=68, signatureData.count<=74,
              let signature=try? P256.Signing.ECDSASignature(
                derRepresentation:signatureData
              ),
              let issuerKey=try? P256.Signing.PublicKey(
                derRepresentation:pinnedPublicKeyDER
              ) else {
            throw IssuerEnvelopeError.malformedEnvelope
        }
        let signedBody=lines.prefix(6).joined(separator:"\n")+"\n"
        guard issuerKey.isValidSignature(signature,for:Data(signedBody.utf8)) else {
            throw IssuerEnvelopeError.untrustedIssuerSignature
        }
        self.nonce=nonce
        self.expiresAtMs=expiresAt
        self.challengeBytes=challenge
        self.issuerID="unfire-local-controller"
        self.issuerFingerprint=Self.digest(pinnedPublicKeyDER)
        self.signedBytesFingerprint=Self.digest(Data(signedBody.utf8))
    }

    private static func digest(_ bytes:Data)->String {
        SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined()
    }
}

public struct InertIssuerReceipt {
    public let proposalID:String
    public let challengeFingerprint:String
    public let envelopeFingerprint:String
    public let replayConsumed:Bool
    public let externalActionAllowed:Bool=false
    public let humanConsentProven:Bool=false
    public let trustedProductionIdentityProven:Bool=false
}

/// Local SQLite inbox with atomic single-use claim. This protects the research
/// receiver from same-file process restarts, not from a malicious filesystem owner.
public final class SyntheticIssuerInbox {
    private var db:OpaquePointer?
    private let pinnedFingerprint:String

    public init(databasePath:String,pinnedPublicKeyDER:Data) throws {
        guard !databasePath.isEmpty, databasePath.utf8.count<1024 else {
            throw IssuerEnvelopeError.sqliteFailure
        }
        self.pinnedFingerprint=SHA256.hash(data:pinnedPublicKeyDER)
            .map{String(format:"%02x",$0)}.joined()
        var pointer:OpaquePointer?
        guard sqlite3_open_v2(databasePath,&pointer,
              SQLITE_OPEN_READWRITE|SQLITE_OPEN_CREATE|SQLITE_OPEN_FULLMUTEX,nil)==SQLITE_OK,
              let pointer else {
            if let pointer{sqlite3_close(pointer)}
            throw IssuerEnvelopeError.sqliteFailure
        }
        db=pointer
        do {
            try execute("PRAGMA busy_timeout=2500;")
            try execute("PRAGMA synchronous=FULL;")
            try execute("""
              CREATE TABLE IF NOT EXISTS issuer_meta (
                id INTEGER PRIMARY KEY CHECK(id=1),
                issuer_fingerprint TEXT NOT NULL,
                stopped INTEGER NOT NULL CHECK(stopped IN(0,1)),
                last_ms INTEGER NOT NULL
              );
              """)
            try execute("""
              CREATE TABLE IF NOT EXISTS issuer_seen (
                nonce TEXT PRIMARY KEY,
                challenge_digest TEXT NOT NULL
              );
              """)
            try insertInitialMeta()
            try ensurePinnedIssuer()
        } catch {
            sqlite3_close_v2(pointer)
            db=nil
            throw error
        }
    }

    deinit {
        if let db {sqlite3_close_v2(db)}
    }

    private func execute(_ sql:String) throws {
        guard sqlite3_exec(db,sql,nil,nil,nil)==SQLITE_OK else {
            throw IssuerEnvelopeError.sqliteFailure
        }
    }

    private func prepare(_ sql:String) throws ->OpaquePointer {
        var stmt:OpaquePointer?
        guard sqlite3_prepare_v2(db,sql,-1,&stmt,nil)==SQLITE_OK,
              let stmt else {
            throw IssuerEnvelopeError.sqliteFailure
        }
        return stmt
    }

    private func insertInitialMeta() throws {
        let s=try prepare("""
          INSERT OR IGNORE INTO issuer_meta(
            id,issuer_fingerprint,stopped,last_ms
          ) VALUES(1,?,0,-1)
          """)
        defer{sqlite3_finalize(s)}
        let transient=unsafeBitCast(-1,to:sqlite3_destructor_type.self)
        sqlite3_bind_text(s,1,pinnedFingerprint,-1,transient)
        guard sqlite3_step(s)==SQLITE_DONE else {
            throw IssuerEnvelopeError.sqliteFailure
        }
    }

    private func readMeta()->(fingerprint:String,stopped:Bool,last:Int64)? {
        guard let s=try? prepare(
            "SELECT issuer_fingerprint,stopped,last_ms FROM issuer_meta WHERE id=1"
        ) else{return nil}
        defer{sqlite3_finalize(s)}
        guard sqlite3_step(s)==SQLITE_ROW,
              let text=sqlite3_column_text(s,0) else{return nil}
        return (String(cString:text),sqlite3_column_int(s,1) != 0,
                sqlite3_column_int64(s,2))
    }

    private func ensurePinnedIssuer() throws {
        guard let meta=readMeta(),meta.fingerprint==pinnedFingerprint else{
            throw IssuerEnvelopeError.keyPinMismatch
        }
    }

    private func transaction<T>(_ body: () throws -> T) throws -> T {
        try execute("BEGIN IMMEDIATE;")
        do {
            let result=try body()
            try execute("COMMIT;")
            return result
        } catch {
            try? execute("ROLLBACK;")
            throw error
        }
    }

    private func validateTime(_ now:Int64) throws {
        guard let meta=readMeta() else{throw IssuerEnvelopeError.sqliteFailure}
        guard meta.fingerprint==pinnedFingerprint else {
            throw IssuerEnvelopeError.keyPinMismatch
        }
        guard !meta.stopped else{throw IssuerEnvelopeError.persistentStop}
        guard now>=0,now>=meta.last else{
            throw IssuerEnvelopeError.clockRollback
        }
    }

    private func markTime(_ now:Int64)throws {
        let s=try prepare("UPDATE issuer_meta SET last_ms=? WHERE id=1")
        defer{sqlite3_finalize(s)}
        sqlite3_bind_int64(s,1,now)
        guard sqlite3_step(s)==SQLITE_DONE else {
            throw IssuerEnvelopeError.sqliteFailure
        }
    }

    public func inspectAndConsume(
        envelopeData:Data,pinnedIssuerPublicKeyDER:Data,nowMs:Int64
    )throws->InertIssuerReceipt {
        let envelope=try VerifiedIssuerEnvelope(
            bytes:envelopeData,pinnedPublicKeyDER:pinnedIssuerPublicKeyDER
        )
        guard envelope.issuerFingerprint==pinnedFingerprint else{
            throw IssuerEnvelopeError.keyPinMismatch
        }
        guard nowMs>=0,nowMs<envelope.expiresAtMs else {
            throw IssuerEnvelopeError.expired
        }
        let manifest=try ReviewManifest.arithmetic(id:"task_a")
        let bound:BoundReview
        do {
            bound=try BoundReview(
                challengeBytes:envelope.challengeBytes,
                manifest:manifest,nowMs:nowMs
            )
        } catch {
            throw IssuerEnvelopeError.invalidBoundReview
        }
        guard envelope.expiresAtMs<=bound.challenge.expiresAtMs else {
            throw IssuerEnvelopeError.invalidBoundReview
        }
        let nonce=envelope.nonce
        let challengeFingerprint=bound.challengeFingerprint
        return try transaction {
            try validateTime(nowMs)
            let stmt=try prepare(
                "INSERT INTO issuer_seen(nonce,challenge_digest) VALUES(?,?)"
            )
            defer{sqlite3_finalize(stmt)}
            let transient=unsafeBitCast(-1,to:sqlite3_destructor_type.self)
            sqlite3_bind_text(stmt,1,nonce,-1,transient)
            sqlite3_bind_text(stmt,2,challengeFingerprint,-1,transient)
            guard sqlite3_step(stmt)==SQLITE_DONE else{
                if sqlite3_errcode(db)==SQLITE_CONSTRAINT ||
                   sqlite3_extended_errcode(db)==SQLITE_CONSTRAINT_PRIMARYKEY {
                    throw IssuerEnvelopeError.replay
                }
                throw IssuerEnvelopeError.sqliteFailure
            }
            try markTime(nowMs)
            return InertIssuerReceipt(
                proposalID:bound.challenge.proposalID,
                challengeFingerprint:challengeFingerprint,
                envelopeFingerprint:envelope.signedBytesFingerprint,
                replayConsumed:true
            )
        }
    }

    public func stop(nowMs:Int64)throws {
        try transaction {
            guard let meta=readMeta(),meta.fingerprint==pinnedFingerprint else {
                throw IssuerEnvelopeError.keyPinMismatch
            }
            if meta.stopped{return}
            guard nowMs>=meta.last else{
                throw IssuerEnvelopeError.clockRollback
            }
            try markTime(nowMs)
            try execute("UPDATE issuer_meta SET stopped=1 WHERE id=1;")
        }
    }

    public var stopped:Bool {readMeta()?.stopped ?? true}
}
