import CryptoKit
import Foundation
import Security

enum PlanError: String, Error, LocalizedError {
  case invalidIdentity = "invalid_chatgpt_identity"
  case invalidCallback = "invalid_oauth_callback"
  case cancelled = "authorization_cancelled"
  case timeout = "authorization_timeout"
  var errorDescription: String? { rawValue }
}

enum PlanIdentity {
  static let issuer = "https://auth.openai.com"

  static func decode(_ value: String) throws -> Data {
    let base64 = value.replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    guard let result = Data(base64Encoded: base64 + String(repeating: "=", count: (4 - base64.count % 4) % 4)) else {
      throw PlanError.invalidIdentity
    }
    return result
  }

  static func verify(_ token: String, clientID: String, nonce: String, priorSubject: String,
                     keys: [[String: Any]], now: TimeInterval = Date().timeIntervalSince1970) throws -> [String: String] {
    guard token.utf8.count < 64000 else { throw PlanError.invalidIdentity }
    let pieces = token.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
    guard pieces.count == 3,
          let header = try JSONSerialization.jsonObject(with: decode(pieces[0])) as? [String: Any],
          let claims = try JSONSerialization.jsonObject(with: decode(pieces[1])) as? [String: Any],
          let algorithm = header["alg"] as? String, ["RS256", "ES256"].contains(algorithm),
          header["crit"] == nil, header["b64"] == nil,
          let kid = header["kid"] as? String,
          let key = keys.first(where: { ($0["kid"] as? String) == kid }),
          key["use"] == nil || (key["use"] as? String) == "sig",
          key["alg"] == nil || (key["alg"] as? String) == algorithm else { throw PlanError.invalidIdentity }
    let message = Data("\(pieces[0]).\(pieces[1])".utf8)
    let signature = try decode(pieces[2])
    if algorithm == "ES256" {
      guard key["kty"] as? String == "EC", key["crv"] as? String == "P-256",
            let x = key["x"] as? String, let y = key["y"] as? String else { throw PlanError.invalidIdentity }
      let publicKey = try P256.Signing.PublicKey(x963Representation: Data([4]) + decode(x) + decode(y))
      let sig = try P256.Signing.ECDSASignature(rawRepresentation: signature)
      guard publicKey.isValidSignature(sig, for: message) else { throw PlanError.invalidIdentity }
    } else {
      guard key["kty"] as? String == "RSA", let n = key["n"] as? String, let e = key["e"] as? String else {
        throw PlanError.invalidIdentity
      }
      let modulus = try decode(n)
      guard modulus.count >= 256, modulus.count <= 1024 else { throw PlanError.invalidIdentity }
      let integers = derInteger(modulus) + derInteger(try decode(e))
      let bytes = Data([0x30]) + derLength(integers.count) + integers
      let attributes: [String: Any] = [kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
        kSecAttrKeyClass as String: kSecAttrKeyClassPublic]
      guard let publicKey = SecKeyCreateWithData(bytes as CFData, attributes as CFDictionary, nil),
            SecKeyVerifySignature(publicKey, .rsaSignatureMessagePKCS1v15SHA256,
                                  message as CFData, signature as CFData, nil) else { throw PlanError.invalidIdentity }
    }
    let audiences = (claims["aud"] as? [String]) ?? (claims["aud"] as? String).map { [$0] } ?? []
    guard claims["iss"] as? String == issuer, audiences.contains(clientID),
          let expiry = number(claims["exp"]), expiry > now,
          let issued = number(claims["iat"]), issued <= now + 60,
          let subject = claims["sub"] as? String, !subject.isEmpty,
          priorSubject.isEmpty || subject == priorSubject else { throw PlanError.invalidIdentity }
    if let nbf = claims["nbf"], number(nbf) == nil || number(nbf)! > now + 60 { throw PlanError.invalidIdentity }
    if audiences.count > 1 && claims["azp"] as? String != clientID { throw PlanError.invalidIdentity }
    if !nonce.isEmpty && !equal(claims["nonce"] as? String ?? "", nonce) { throw PlanError.invalidIdentity }
    return ["iss": issuer, "sub": subject]
  }

  static func fetchAndVerify(_ token: String, clientID: String, nonce: String, priorSubject: String) async throws -> [String: String] {
    let url = URL(string: "\(issuer)/.well-known/jwks.json")!
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 15
    config.httpCookieStorage = nil
    let session = URLSession(configuration: config)
    defer { session.invalidateAndCancel() }
    let (data, response) = try await session.data(from: url)
    guard let http = response as? HTTPURLResponse, http.statusCode == 200, http.url == url,
          data.count < 1024 * 1024,
          let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          let keys = json["keys"] as? [[String: Any]] else { throw PlanError.invalidIdentity }
    return try verify(token, clientID: clientID, nonce: nonce, priorSubject: priorSubject, keys: keys)
  }

  static func equal(_ a: String, _ b: String) -> Bool {
    let lhs = Array(a.utf8), rhs = Array(b.utf8)
    guard lhs.count == rhs.count else { return false }
    return zip(lhs, rhs).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
  }

  private static func number(_ value: Any?) -> Double? {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
    let value = number.doubleValue
    return value.isFinite ? value : nil
  }

  private static func derLength(_ length: Int) -> Data {
    if length < 128 { return Data([UInt8(length)]) }
    var value = length, bytes: [UInt8] = []
    while value > 0 { bytes.insert(UInt8(value & 255), at: 0); value >>= 8 }
    return Data([0x80 | UInt8(bytes.count)] + bytes)
  }

  private static func derInteger(_ input: Data) -> Data {
    var bytes = input
    while bytes.count > 1 && bytes.first == 0 { bytes.removeFirst() }
    if let first = bytes.first, first & 0x80 != 0 { bytes.insert(0, at: 0) }
    return Data([0x02]) + derLength(bytes.count) + bytes
  }
}
