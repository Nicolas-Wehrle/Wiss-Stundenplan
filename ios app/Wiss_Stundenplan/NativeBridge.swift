//
//  NativeBridge.swift
//  Wiss_Stundenplan
//
//  Native side of Web/gm-bridge.js:
//  - the userscript-manager API (GM.*) the original iPhone bundle uses
//  - notifications and widget data, like the Android app's native side
//

import Foundation
import UIKit
import WebKit
import WidgetKit

final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    /// Same list as the userscript's `@connect` lines — the only cross-site hosts it may reach.
    static let allowedHosts: Set<String> = ["www.modulbaukasten.ch", "ictbb.crm17.dynamics.com"]

    /// Opens outside links (set by the web view controller).
    var openExternal: ((URL) -> Void)?

    private let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.httpCookieStorage = nil
        c.urlCache = nil
        return URLSession(configuration: c)
    }()

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let op = body["op"] as? String else {
            replyHandler(nil, "bad message"); return
        }
        switch op {
        // ---- GM storage → Keychain
        case "get":
            guard let key = body["key"] as? String else { return replyHandler(nil, "no key") }
            replyHandler(Keychain.get(key), nil)
        case "set":
            guard let key = body["key"] as? String, let value = body["value"] as? String else { return replyHandler(nil, "no key") }
            Keychain.set(key, value) ? replyHandler(true, nil) : replyHandler(nil, "secure-storage-unavailable")
        case "delete":
            guard let key = body["key"] as? String else { return replyHandler(nil, "no key") }
            Keychain.delete(key)
            replyHandler(true, nil)
        // ---- GM.xmlHttpRequest
        case "xhr":
            request(body, replyHandler)
        // ---- notifications
        case "notify":
            Reminders.show(id: body["id"] as? String ?? "note", title: body["title"] as? String ?? "", body: body["body"] as? String ?? "")
            replyHandler(true, nil)
        case "schedule":
            Reminders.schedule((body["plan"] as? [[String: Any]]) ?? [])
            replyHandler(true, nil)
        case "firedAbs":
            replyHandler(Reminders.firedAbsences(), nil)
        case "notifStatus":
            Task { replyHandler(await Reminders.permission(), nil) }
        case "notifRequest":
            Task { replyHandler(await Reminders.requestPermission(), nil) }
        // ---- widget
        case "widget":
            if let data = body["data"], let json = try? JSONSerialization.data(withJSONObject: data) {
                SharedData.defaults?.set(json, forKey: SharedData.widgetKey)
                WidgetCenter.shared.reloadAllTimelines()
            }
            replyHandler(true, nil)
        // ---- outside links
        case "open":
            if let s = body["url"] as? String, let url = URL(string: s), ["http", "https"].contains(url.scheme ?? "") {
                openExternal?(url)
            }
            replyHandler(true, nil)
        default:
            replyHandler(nil, "unknown op")
        }
    }

    private func request(_ body: [String: Any], _ reply: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let s = body["url"] as? String, let url = URL(string: s), url.scheme == "https",
              let host = url.host, Self.allowedHosts.contains(host) else {
            reply(nil, "Host not allowed"); return
        }
        var req = URLRequest(url: url)
        req.httpMethod = (body["method"] as? String)?.uppercased() ?? "GET"
        req.timeoutInterval = max(1, ((body["timeout"] as? Double) ?? 30000) / 1000)
        for (k, v) in (body["headers"] as? [String: Any]) ?? [:] { req.setValue("\(v)", forHTTPHeaderField: k) }
        if let b = body["body"] as? String { req.httpBody = Data(b.utf8) }

        Task {
            do {
                let (data, response) = try await session.data(for: req)
                let http = response as? HTTPURLResponse
                let headers = (http?.allHeaderFields ?? [:]).map { "\($0.key): \($0.value)" }.joined(separator: "\r\n")
                let text = String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
                reply(["status": http?.statusCode ?? 200, "text": text,
                       "url": response.url?.absoluteString ?? s, "headers": headers], nil)
            } catch let e as URLError where e.code == .timedOut {
                reply(nil, "timed out")
            } catch {
                reply(nil, error.localizedDescription)
            }
        }
    }
}
