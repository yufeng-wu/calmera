import Foundation
import Network

// Temporary 127.0.0.1-only OAuth listener; no LAN endpoint, message access or disk writes.
final class PlanLoopback {
  private let queue = DispatchQueue(label: "calmera.oauth.loopback")
  private var listener: NWListener?
  private var waiter: ((Result<String, Error>) -> Void)?
  private var result: Result<String, Error>?
  private var state = ""
  private var port: UInt16 = 0
  private var generation = UUID()
  private var accepted = false
  private var connections: [UUID: NWConnection] = [:]

  func start(state: String, ready: @escaping (Result<String, Error>) -> Void) {
    queue.async {
      self.stopOnQueue()
      guard state.count >= 32 && state.count <= 256 else { ready(.failure(PlanError.invalidCallback)); return }
      self.state = state
      self.result = nil
      self.accepted = false
      self.generation = UUID()
      let generation = self.generation
      do {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        var readySent = false
        listener.stateUpdateHandler = { status in
          guard generation == self.generation else { return }
          switch status {
          case .ready:
            guard !readySent, let port = listener.port else { return }
            readySent = true
            self.port = port.rawValue
            ready(.success("http://127.0.0.1:\(port.rawValue)/auth/callback"))
          case .failed:
            if !readySent { readySent = true; ready(.failure(PlanError.invalidCallback)) }
            self.finish(.failure(PlanError.invalidCallback))
          default: break
          }
        }
        listener.newConnectionHandler = { connection in
          guard generation == self.generation, self.connections.count < 8 else { connection.cancel(); return }
          let id = UUID()
          self.connections[id] = connection
          connection.start(queue: self.queue)
          self.receive(connection, id: id, generation: generation, bytes: Data())
          self.queue.asyncAfter(deadline: .now() + 10) {
            self.connections.removeValue(forKey: id)?.cancel()
          }
        }
        listener.start(queue: self.queue)
        self.queue.asyncAfter(deadline: .now() + 600) {
          guard generation == self.generation else { return }
          self.finish(.failure(PlanError.timeout))
          self.listener?.cancel()
        }
      } catch { ready(.failure(PlanError.invalidCallback)) }
    }
  }

  func wait(_ completion: @escaping (Result<String, Error>) -> Void) {
    queue.async {
      if let result = self.result { completion(result) }
      else if self.waiter == nil && self.listener != nil { self.waiter = completion }
      else { completion(.failure(PlanError.cancelled)) }
    }
  }

  func stop() { queue.async { self.stopOnQueue() } }

  private func stopOnQueue() {
    generation = UUID()
    listener?.stateUpdateHandler = nil
    listener?.newConnectionHandler = nil
    listener?.cancel()
    listener = nil
    connections.values.forEach { $0.cancel() }
    connections.removeAll()
    finish(.failure(PlanError.cancelled))
    state = ""
  }

  private func finish(_ value: Result<String, Error>) {
    guard result == nil else { return }
    result = value
    let completion = waiter
    waiter = nil
    completion?(value)
  }

  private func receive(_ connection: NWConnection, id: UUID, generation: UUID, bytes: Data) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { data, _, done, error in
      guard generation == self.generation else { connection.cancel(); return }
      let bytes = bytes + (data ?? Data())
      if bytes.count > 16384 { self.respond(connection, id: id, ok: false); return }
      guard bytes.range(of: Data("\r\n\r\n".utf8)) != nil else {
        if done || error != nil { self.respond(connection, id: id, ok: false) }
        else { self.receive(connection, id: id, generation: generation, bytes: bytes) }
        return
      }
      guard !self.accepted,
            let request = String(data: bytes, encoding: .utf8),
            let first = request.components(separatedBy: "\r\n").first else { self.respond(connection, id: id, ok: false); return }
      let parts = first.split(separator: " ")
      guard parts.count == 3, parts[0] == "GET", parts[1].hasPrefix("/"),
            let url = URLComponents(string: "http://127.0.0.1:\(self.port)\(parts[1])"),
            url.path == "/auth/callback", url.fragment == nil else { self.respond(connection, id: id, ok: false); return }
      let items = url.queryItems ?? []
      guard items.filter({ $0.name == "state" }).count == 1,
            PlanIdentity.equal(items.first(where: { $0.name == "state" })?.value ?? "", self.state),
            let callback = url.url?.absoluteString else { self.respond(connection, id: id, ok: false); return }
      self.accepted = true
      self.respond(connection, id: id, ok: true)
      self.finish(.success(callback))
    }
  }

  private func respond(_ connection: NWConnection, id: UUID, ok: Bool) {
    let body = ok ? "foodwrap authorization received. Return to the app." : "Invalid foodwrap callback."
    let response = "HTTP/1.1 \(ok ? "200 OK" : "400 Bad Request")\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: \(body.utf8.count)\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n\(body)"
    connection.send(content: Data(response.utf8), completion: .contentProcessed { _ in
      connection.cancel()
      self.connections.removeValue(forKey: id)
    })
  }
}
