// Canonical source. scripts/install-native.py copies this into the ignored iOS project.
import Foundation
import Security
import WebKit
import UIKit
import Capacitor

private struct PNETVault: Codable {
    let gatewayUser: String
    let gatewayPassword: String
    let token: String
}

private enum PNETKeychain {
    static var query: [String: Any] { [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "dev.serdiuk.pnet.mobile.auth.v1",
        kSecAttrAccount as String: "owner",
        kSecAttrSynchronizable as String: false
    ] }
    static func read() throws -> PNETVault? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw PNETFailure.keychain }
        return try JSONDecoder().decode(PNETVault.self, from: data)
    }
    static func save(_ value: PNETVault) throws {
        let attributes: [String: Any] = [
            kSecValueData as String: try JSONEncoder().encode(value),
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var q = query
            attributes.forEach { q[$0.key] = $0.value }
            guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else { throw PNETFailure.keychain }
        } else if status != errSecSuccess { throw PNETFailure.keychain }
    }
    static func delete() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw PNETFailure.keychain }
    }
}

private enum PNETFailure: Error { case keychain }
private final class PNETNetworkPolicy: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil) // Never forward credentials to a redirect destination.
    }
}

@objc(PNETTransportPlugin)
public final class PNETTransportPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PNETTransportPlugin"
    public let jsName = "PNETTransport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "session", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]
    private let origin = "https://pnet.srv1068851.hstgr.cloud"
    private let cookieName = "__Host-pnet_session"
    private var vault: PNETVault?
    private var csrf = ""
    private var generation = 0
    private var authenticating = false
    private var tasks: [String: URLSessionDataTask] = [:]
    private let networkPolicy = PNETNetworkPolicy()
    private lazy var network: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.urlCache = nil
        config.httpCookieStorage = nil
        config.urlCredentialStorage = nil
        config.httpShouldSetCookies = false
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        return URLSession(configuration: config, delegate: networkPolicy, delegateQueue: nil)
    }()

    private func matches(_ value: String, _ pattern: String) -> Bool {
        value.range(of: pattern, options: .regularExpression) == (value.startIndex..<value.endIndex)
    }
    private func rotate() {
        generation += 1
        tasks.values.forEach { $0.cancel() }
        tasks.removeAll()
    }
    private func forget() throws {
        rotate()
        vault = nil
        csrf = ""
        try PNETKeychain.delete()
    }
    private func validCSRF(_ data: Data) -> String? {
        guard let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              body["authenticated"] as? Bool == true,
              let value = body["csrf"] as? String,
              matches(value, "^[a-f0-9]{64}$") else { return nil }
        return value
    }

    // All state and callbacks are confined to the main queue. The WebView cannot
    // choose the destination, Cookie, Authorization, Origin, or CSRF header.
    private func send(id: String, path: String, method: String, body: Data?,
                      contentType: String?, credentials: PNETVault, csrfValue: String?,
                      completion: @escaping (Data?, HTTPURLResponse?, String?) -> Void) {
        guard tasks[id] == nil, let url = URL(string: origin + path) else {
            completion(nil, nil, "Invalid request."); return
        }
        let before = generation
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.httpShouldHandleCookies = false
        request.setValue("application/json, image/*", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        let basic = Data("\(credentials.gatewayUser):\(credentials.gatewayPassword)".utf8).base64EncodedString()
        request.setValue("Basic " + basic, forHTTPHeaderField: "Authorization")
        if !credentials.token.isEmpty {
            request.setValue(cookieName + "=" + credentials.token, forHTTPHeaderField: "Cookie")
        }
        if method != "GET" {
            request.setValue(origin, forHTTPHeaderField: "Origin")
            if let value = csrfValue { request.setValue(value, forHTTPHeaderField: "X-Pnet-CSRF") }
        }
        if let value = contentType { request.setValue(value, forHTTPHeaderField: "Content-Type") }
        let task = network.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                self.tasks.removeValue(forKey: id)
                guard before == self.generation else {
                    completion(nil, nil, "Session changed. Please retry."); return
                }
                guard error == nil, let http = response as? HTTPURLResponse, let data = data else {
                    completion(nil, nil, "Connection failed. A submitted change may have reached the server; reload before retrying."); return
                }
                guard http.url == url, !(300...399).contains(http.statusCode), data.count <= 20 * 1024 * 1024 else {
                    completion(nil, nil, "Server response rejected."); return
                }
                completion(data, http, nil)
            }
        }
        tasks[id] = task
        task.resume()
    }

    @objc public func session(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.authenticating else { call.reject("Sign-in is in progress."); return }
            do {
                if self.vault == nil { self.vault = try PNETKeychain.read() }
            } catch { call.reject("Unlock your iPhone to access the saved session."); return }
            guard let credentials = self.vault else { call.resolve(["authenticated": false]); return }
            self.send(id: UUID().uuidString, path: "/api/v1/auth/session", method: "GET",
                      body: nil, contentType: nil, credentials: credentials, csrfValue: nil) { data, response, error in
                if let error = error { call.reject(error); return }
                if response?.statusCode == 401 {
                    do { try self.forget(); call.resolve(["authenticated": false]) }
                    catch { call.reject("Unable to clear the saved session. Unlock your iPhone and retry.") }
                    return
                }
                guard response?.statusCode == 200, let data = data, let csrf = self.validCSRF(data) else {
                    call.reject("Unable to verify the session."); return
                }
                self.csrf = csrf
                call.resolve(["authenticated": true])
            }
        }
    }

    @objc public func login(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.authenticating, self.vault == nil else { call.reject("Sign out before signing in again."); return }
            guard let gatewayUser = call.getString("gatewayUser"),
                  let gatewayPassword = call.getString("gatewayPassword"),
                  let login = call.getString("login"), let password = call.getString("password"),
                  let code = call.getString("code"),
                  !gatewayUser.isEmpty, gatewayUser.utf8.count <= 128,
                  !gatewayUser.contains(":"), !gatewayPassword.isEmpty, gatewayPassword.utf8.count <= 1024,
                  !gatewayUser.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }),
                  !gatewayPassword.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }),
                  self.matches(login, "^[a-z0-9][a-z0-9._-]{2,63}$"),
                  !password.isEmpty, password.count <= 128,
                  self.matches(code, "^(?:[0-9]{6}|[a-f0-9]{32})$"),
                  let body = try? JSONSerialization.data(withJSONObject: ["login": login, "password": password, "code": code]) else {
                call.reject("Check the sign-in fields."); return
            }
            self.rotate()
            self.authenticating = true
            let credentials = PNETVault(gatewayUser: gatewayUser, gatewayPassword: gatewayPassword, token: "")
            self.send(id: UUID().uuidString, path: "/api/v1/auth/login", method: "POST", body: body,
                      contentType: "application/json", credentials: credentials, csrfValue: nil) { data, response, error in
                self.authenticating = false
                if let error = error { call.reject(error); return }
                if response?.statusCode == 429 { call.reject("Too many attempts. Wait 15 minutes before trying again."); return }
                guard let response = response, response.statusCode == 200,
                      let data = data, let csrf = self.validCSRF(data), let url = response.url else {
                    call.reject("Sign-in failed. Check gateway access, owner credentials and a fresh verification code."); return
                }
                var headers: [String: String] = [:]
                for (key, value) in response.allHeaderFields { headers[String(describing: key)] = String(describing: value) }
                let cookies = HTTPCookie.cookies(withResponseHeaderFields: headers, for: url).filter { $0.name == self.cookieName }
                guard cookies.count == 1, let cookie = cookies.first,
                      cookie.isSecure, cookie.isHTTPOnly, cookie.path == "/", cookie.domain == url.host,
                      self.matches(cookie.value, "^[a-f0-9]{64}$") else {
                    call.reject("Invalid session cookie."); return
                }
                let saved = PNETVault(gatewayUser: gatewayUser, gatewayPassword: gatewayPassword, token: cookie.value)
                do { try PNETKeychain.save(saved) }
                catch {
                    // Keep the just-issued token in memory only so the next action can
                    // explicitly revoke it; never report a successful persistent login.
                    self.vault = saved; self.csrf = csrf
                    self.send(id: UUID().uuidString, path: "/api/v1/auth/logout", method: "POST", body: nil,
                              contentType: nil, credentials: saved, csrfValue: csrf) { _, _, _ in
                        self.vault = nil; self.csrf = ""
                        call.reject("Unable to save the session securely. Unlock your iPhone and sign in again.")
                    }
                    return
                }
                self.vault = saved; self.csrf = csrf
                call.resolve(["authenticated": true])
            }
        }
    }

    @objc public func logout(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.authenticating else { call.reject("Sign-in is in progress."); return }
            guard let credentials = self.vault, !self.csrf.isEmpty else { call.reject("Verify the session first."); return }
            self.rotate()
            self.send(id: UUID().uuidString, path: "/api/v1/auth/logout", method: "POST", body: nil,
                      contentType: nil, credentials: credentials, csrfValue: self.csrf) { _, response, error in
                if let error = error { call.reject(error); return }
                guard response?.statusCode == 200 || (response?.statusCode == 401 && response?.value(forHTTPHeaderField: "WWW-Authenticate") == nil) else {
                    call.reject("Sign out failed. Please retry."); return
                }
                do { try self.forget(); call.resolve(["authenticated": false]) }
                catch { call.reject("Unable to clear the saved session. Unlock your iPhone and retry.") }
            }
        }
    }

    // First connected checkpoint: all app reads; contact create/update only.
    // Other mutations (including messages and photo upload) fail before networking.
    private func allowed(_ path: String, _ method: String) -> Bool {
        let id = "[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"
        if method == "GET" {
            return matches(path, "^/api/v1/(?:people(?:/" + id + "(?:/(?:photo|contact-events|contact-channels))?)?|graph|graph-styles|analytics/network|categories|interests|relationships|relationship-styles|reminders/(?:upcoming|history))$")
        }
        return (method == "POST" && path == "/api/v1/people") ||
            (method == "PATCH" && matches(path, "^/api/v1/people/" + id + "$"))
    }
    @objc public func request(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.authenticating, let credentials = self.vault, !self.csrf.isEmpty else {
                call.reject("Authentication required.", "SESSION_EXPIRED"); return
            }
            guard let id = call.getString("id"), UUID(uuidString: id) != nil,
                  let path = call.getString("path"), let method = call.getString("method"),
                  self.allowed(path, method) else {
                call.reject("This action is not enabled in the first connected checkpoint."); return
            }
            let body = call.getString("body").map { Data($0.utf8) }
            if method == "GET" && body != nil { call.reject("Invalid request body."); return }
            if method != "GET" {
                guard let body = body, body.count <= 100 * 1024,
                      (try? JSONSerialization.jsonObject(with: body)) is [String: Any] else {
                    call.reject("Invalid JSON request."); return
                }
            }
            self.send(id: id, path: path, method: method, body: body,
                      contentType: body == nil ? nil : "application/json",
                      credentials: credentials, csrfValue: self.csrf) { data, response, error in
                if let error = error { call.reject(error); return }
                guard let response = response, let data = data else { call.reject("Invalid response."); return }
                if response.statusCode == 401 {
                    do { try self.forget() } catch { /* No secrets are exposed; backend session is unusable. */ }
                    call.reject("Session expired. Please sign in again.", "SESSION_EXPIRED"); return
                }
                call.resolve([
                    "status": response.statusCode,
                    "contentType": response.value(forHTTPHeaderField: "Content-Type") ?? "application/octet-stream",
                    "body": data.base64EncodedString()
                ])
            }
        }
    }
    @objc public func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let id = call.getString("id") { self.tasks[id]?.cancel() }
            call.resolve()
        }
    }
}

@objc(PNETViewController)
final class PNETViewController: CAPBridgeViewController {
    private var privacyCover: UIView?
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.websiteDataStore = .nonPersistent()
        return config
    }
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PNETTransportPlugin())
        webView?.isInspectable = false
        NotificationCenter.default.addObserver(self, selector: #selector(hidePrivateView), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(showPrivateView), name: UIApplication.didBecomeActiveNotification, object: nil)
    }
    @objc private func hidePrivateView() {
        guard privacyCover == nil else { return }
        let cover = UIView(frame: view.bounds)
        cover.backgroundColor = .systemBackground
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(cover); privacyCover = cover
    }
    @objc private func showPrivateView() { privacyCover?.removeFromSuperview(); privacyCover = nil }
    deinit { NotificationCenter.default.removeObserver(self) }
}
