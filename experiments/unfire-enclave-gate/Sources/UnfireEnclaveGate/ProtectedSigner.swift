import Foundation
import CryptoKit
import LocalAuthentication
import Security

public enum ProtectedSignerError: Error {
    case explicitUserActionRequired
    case secureEnclaveUnavailable
    case userPresenceAccessControlUnavailable
    case keyAlreadyEnrolled
    case keyNotEnrolled
    case keychainFailure(OSStatus)
    case expiredChallenge
}

public struct ProtectedPreviewSignature {
    public let publicKeyDER: Data
    public let signatureDER: Data
    public let externalActionAllowed: Bool = false
    public let authenticatedHumanConsentProven: Bool = false
}

/// Compile-only capability adapter. DO NOT call from unattended tests or a model.
/// The Secure Enclave / Keychain path is intentionally not exercised in CI.
/// The trusted UI and journal are not connected to this adapter yet.
@MainActor
public final class ProtectedP256SigningService {
    private let service = "technology.unfire.research.synthetic-p256-v1"
    private let account = "device-review-test-key"

    public init() {}

    public var hardwareAvailable: Bool {
        SecureEnclave.isAvailable
    }

    private func keyQuery(returnData: Bool) -> [String:Any] {
        var query:[String:Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        if returnData {
            query[kSecReturnData as String] = kCFBooleanTrue
        } else {
            query[kSecReturnAttributes as String] = kCFBooleanTrue
        }
        return query
    }

    /// User-driven enrollment only. Never invoke automatically at app launch.
    /// This stores an opaque Secure Enclave key reference in this device's Keychain.
    /// The actual private signing key is NOT exported to Swift or to GitHub.
    @discardableResult
    public func enrollAfterExplicitUserAction(
        context: LAContext, explicitlyConfirmed: Bool
    ) throws -> Data {
        guard explicitlyConfirmed else {
            throw ProtectedSignerError.explicitUserActionRequired
        }
        guard SecureEnclave.isAvailable else {
            throw ProtectedSignerError.secureEnclaveUnavailable
        }
        let existing = SecItemCopyMatching(keyQuery(returnData:false) as CFDictionary,nil)
        guard existing == errSecItemNotFound else {
            if existing == errSecSuccess { throw ProtectedSignerError.keyAlreadyEnrolled }
            throw ProtectedSignerError.keychainFailure(existing)
        }

        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .userPresence], &error
        ) else {
            throw ProtectedSignerError.userPresenceAccessControlUnavailable
        }

        // This is the ONLY key-generation path and is never reached by tests.
        let protectedKey = try SecureEnclave.P256.Signing.PrivateKey(
            compactRepresentable:false,
            accessControl:access,
            authenticationContext:context
        )
        let reference = protectedKey.dataRepresentation
        let addQuery:[String:Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: reference,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any
        ]
        let status=SecItemAdd(addQuery as CFDictionary,nil)
        guard status == errSecSuccess else {
            throw ProtectedSignerError.keychainFailure(status)
        }
        return protectedKey.publicKey.derRepresentation
    }

    /// Even a successful signature is only for the fixed, inert synthetic preview.
    /// The protected key's user-presence access control is the hardware-level gate,
    /// not the boolean argument or an untrusted LAContext result.
    public func signAfterExplicitUserAction(
        challenge:CanonicalPreviewChallenge,
        context:LAContext,
        explicitlyConfirmed:Bool,
        nowMs:Int64
    ) throws -> ProtectedPreviewSignature {
        guard explicitlyConfirmed else {
            throw ProtectedSignerError.explicitUserActionRequired
        }
        guard challenge.decision=="APPROVE",
              nowMs>=0,nowMs<challenge.expiresAtMs else {
            throw ProtectedSignerError.expiredChallenge
        }
        guard SecureEnclave.isAvailable else {
            throw ProtectedSignerError.secureEnclaveUnavailable
        }
        var result:CFTypeRef?
        let status=SecItemCopyMatching(keyQuery(returnData:true) as CFDictionary,&result)
        guard status==errSecSuccess,let reference=result as? Data else {
            if status == errSecItemNotFound { throw ProtectedSignerError.keyNotEnrolled }
            throw ProtectedSignerError.keychainFailure(status)
        }
        let key=try SecureEnclave.P256.Signing.PrivateKey(
            dataRepresentation:reference,authenticationContext:context)
        let signed=try key.signature(for:challenge.bytes)
        return ProtectedPreviewSignature(
            publicKeyDER:key.publicKey.derRepresentation,
            signatureDER:signed.derRepresentation
        )
    }
}
