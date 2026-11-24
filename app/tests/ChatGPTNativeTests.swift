import CryptoKit
import Foundation
import Security

@main
struct ChatGPTNativeTests {
  static var checks = 0
  static func check(_ value: Bool, _ label: String) {
    guard value else { fatalError("Synthetic check failed: \(label)") }
    checks += 1
  }
  static func rejected(_ label: String, _ action: () throws -> Void) {
    do { try action(); fatalError("Expected rejection: \(label)") }
    catch { checks += 1 }
  }
  static func base64(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  static func encoded(_ value: [String: Any]) throws -> String { base64(try JSONSerialization.data(withJSONObject: value)) }

  static func main() async throws {
    let privateKey = P256.Signing.PrivateKey()
    let publicBytes = privateKey.publicKey.x963Representation
    let jwk: [String: Any] = ["kid": "synthetic", "alg": "ES256", "kty": "EC", "crv": "P-256",
      "x": base64(publicBytes.subdata(in: 1..<33)), "y": base64(publicBytes.subdata(in: 33..<65))]
    let claims: [String: Any] = ["iss": ChatGPTIdentity.issuer, "aud": "oaiapp_synthetic", "sub": "fictional-user",
      "iat": 1000, "exp": 2000, "nonce": "fictional-nonce"]
    func token(_ claims: [String: Any]) throws -> String {
      let payload = try encoded(["alg": "ES256", "kid": "synthetic"]) + "." + encoded(claims)
      return try payload + "." + base64(privateKey.signature(for: Data(payload.utf8)).rawRepresentation)
    }
    func verify(_ token: String, nonce: String = "fictional-nonce", subject: String = "") throws -> [String: String] {
      try ChatGPTIdentity.verify(token, clientID: "oaiapp_synthetic", nonce: nonce, priorSubject: subject, keys: [jwk], now: 1500)
    }
    let valid = try token(claims)
    check(try verify(valid)["sub"] == "fictional-user", "signed identity")
    for (field, value) in [("iss", "https://example.invalid" as Any), ("aud", "other"), ("exp", 1000),
                           ("iat", 3000), ("nbf", 3000), ("exp", true), ("nonce", "other"), ("sub", "")] {
      var changed = claims; changed[field] = value
      let value = try token(changed)
      rejected(field) { _ = try verify(value) }
    }
    rejected("wrong selected identity") { _ = try verify(valid, subject: "different-user") }
    var segments = valid.split(separator: ".").map(String.init)
    var unsignedChange = claims; unsignedChange["sub"] = "forged-user"
    segments[1] = try encoded(unsignedChange)
    rejected("signature mismatch") { _ = try verify(segments.joined(separator: ".")) }
    rejected("unsigned JWT") { _ = try verify("eyJhbGciOiJub25lIn0.e30.") }

    let rsaPrivate = SecKeyCreateRandomKey([kSecAttrKeyType: kSecAttrKeyTypeRSA,
      kSecAttrKeySizeInBits: 2048] as CFDictionary, nil)!
    let rsaPublic = SecKeyCopyPublicKey(rsaPrivate)!
    let rsaBytes = SecKeyCopyExternalRepresentation(rsaPublic, nil)! as Data
    var offset = 0
    func length() -> Int {
      let first = Int(rsaBytes[offset]); offset += 1
      if first < 128 { return first }
      var result = 0
      for _ in 0..<(first & 127) { result = (result << 8) | Int(rsaBytes[offset]); offset += 1 }
      return result
    }
    check(rsaBytes[offset] == 0x30, "synthetic RSA public DER")
    offset += 1; _ = length()
    func integer() -> Data {
      precondition(rsaBytes[offset] == 2); offset += 1
      let count = length(), start = offset; offset += count
      var bytes = rsaBytes.subdata(in: start..<offset)
      while bytes.count > 1 && bytes.first == 0 { bytes.removeFirst() }
      return bytes
    }
    let modulus = integer(), exponent = integer()
    let rsaJWK: [String: Any] = ["kid": "rsa-synthetic", "kty": "RSA", "alg": "RS256",
      "n": base64(modulus), "e": base64(exponent)]
    let rsaPayload = try encoded(["alg": "RS256", "kid": "rsa-synthetic"]) + "." + encoded(claims)
    let rsaSignature = SecKeyCreateSignature(rsaPrivate, .rsaSignatureMessagePKCS1v15SHA256, Data(rsaPayload.utf8) as CFData, nil)! as Data
    let rsaToken = rsaPayload + "." + base64(rsaSignature)
    let rsaIdentity = try ChatGPTIdentity.verify(rsaToken, clientID: "oaiapp_synthetic", nonce: "fictional-nonce", priorSubject: "", keys: [rsaJWK], now: 1500)
    check(rsaIdentity["sub"] == "fictional-user", "RS256 signature verified")
    rejected("RS256 signature tampering") {
      _ = try ChatGPTIdentity.verify(rsaToken + "a", clientID: "oaiapp_synthetic", nonce: "fictional-nonce", priorSubject: "", keys: [rsaJWK], now: 1500)
    }

    let server = ChatGPTSignIn()
    let state = String(repeating: "synthetic-state-", count: 4)
    let uri = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
      server.start(state: state) { continuation.resume(with: $0) }
    }
    check(uri.hasPrefix("http://127.0.0.1:"), "loopback-only URI")
    let (_, rejectedResponse) = try await URLSession.shared.data(from: URL(string: uri + "?state=wrong")!)
    check((rejectedResponse as? HTTPURLResponse)?.statusCode == 400, "bad state rejected")
    let callbackWait = Task {
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
        server.wait { continuation.resume(with: $0) }
      }
    }
    let callback = uri + "?state=" + state + "&code=synthetic&client_id=oaiapp_synthetic"
    let (_, response) = try await URLSession.shared.data(from: URL(string: callback)!)
    check((response as? HTTPURLResponse)?.statusCode == 200, "callback accepted")
    check(try await callbackWait.value == callback, "only expected callback returned")
    let (_, replay) = try await URLSession.shared.data(from: URL(string: callback)!)
    check((replay as? HTTPURLResponse)?.statusCode == 400, "callback replay rejected")
    server.stop()
    print("Passed \(checks) synthetic native identity/loopback checks. No OpenAI, account or Messages access.")
  }
}
