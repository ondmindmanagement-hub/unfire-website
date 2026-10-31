// Cross-language cryptographic test vector generator ONLY.
// Uses an EPHEMERAL SOFTWARE P-256 key. No Secure Enclave, Keychain, LAContext,
// production identity, human approval, network or persistent credentials.
import Foundation
import CryptoKit

enum TestVectorError: Error {
    case invalidInput
}

guard CommandLine.arguments.count == 2,
      let input = Data(base64Encoded: CommandLine.arguments[1]),
      let text = String(data: input, encoding: .utf8) else {
    throw TestVectorError.invalidInput
}
let lines = text.components(separatedBy: "\n")
guard lines.count == 9,
      lines[0] == "UNFIRE-P256-V1",
      lines[1] == "algorithm=ECDSA-P256-SHA256",
      lines[2] == "operation=synthetic.preview",
      lines[3].range(of: #"^proposalId=[a-z][a-z0-9_-]{0,31}$"#,
                     options: .regularExpression) != nil,
      lines[4].range(of: #"^proposalDigest=[0-9a-f]{64}$"#,
                     options: .regularExpression) != nil,
      lines[5].range(of: #"^nonce=[0-9a-f]{48}$"#,
                     options: .regularExpression) != nil,
      lines[6].range(of: #"^expiresAt=[0-9]+$"#,
                     options: .regularExpression) != nil,
      lines[7] == "decision=APPROVE" || lines[7] == "decision=DENY",
      lines[8].isEmpty else {
    throw TestVectorError.invalidInput
}
let key = P256.Signing.PrivateKey()
let signature = try key.signature(for: input)
guard key.publicKey.isValidSignature(signature, for: input) else {
    throw TestVectorError.invalidInput
}
let response: [String: Any] = [
    "publicKeyPem": key.publicKey.pemRepresentation,
    "signatureDerBase64": signature.derRepresentation.base64EncodedString(),
    "messageBase64": input.base64EncodedString(),
    "testKeyType": "ephemeral-software-P256",
    "humanAuthenticated": false,
    "secureEnclaveKey": false
]
let data = try JSONSerialization.data(withJSONObject: response,
                                      options: [.sortedKeys, .fragmentsAllowed])
guard let json = String(data: data, encoding: .utf8) else {
    throw TestVectorError.invalidInput
}
print(json)
