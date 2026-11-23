//
//  StundenplanWebViewController.swift
//  Wiss_Stundenplan
//
//  Works like the original iPhone version (Safari + Userscripts), just as a real app:
//  it opens https://wiss.tocco.ch/extranet/?stundenplan and injects the project's iPhone bundle
//  at document start. That bundle stops the school page and builds the Stundenplan in its place.
//
//  Sign-in is the WISS one: the app sends you to the WISS extranet / Microsoft sign-in in this same
//  web view and returns to the timetable by itself once you're signed in. Cookies and data stay
//  in this app's own storage on the phone.
//

import UIKit
import WebKit
import SafariServices

final class StundenplanWebViewController: UIViewController {
    static let appURL = URL(string: "https://wiss.tocco.ch/extranet/?stundenplan")!
    static let schoolHost = "wiss.tocco.ch"

    /// Matches the add-on's `--bg` (light #f5f2ed / dark #0f0e13), so there's no white flash on start.
    static let backgroundColor = UIColor { t in
        t.userInterfaceStyle == .dark
            ? UIColor(red: 0x0f / 255, green: 0x0e / 255, blue: 0x13 / 255, alpha: 1)
            : UIColor(red: 0xf5 / 255, green: 0xf2 / 255, blue: 0xed / 255, alpha: 1)
    }

    private var webView: WKWebView!
    private let bridge = NativeBridge()
    private var pendingTab: String?
    private var loadedOnce = false
    private var pendingDownloads: [WKDownload: URL] = [:]
    private var showedOffline = false
    /// Own content world, like the userscript's `@inject-into content`: the school's scripts
    /// can't see the app code or the native bridge.
    private let world = WKContentWorld.world(name: "WissStundenplan")

    // MARK: - Setup

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.backgroundColor

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()                       // keeps the WISS sign-in + data
        config.applicationNameForUserAgent = "Version/26.0 Mobile/15E148 Safari/604.1"
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        let ucc = config.userContentController
        ucc.addScriptMessageHandler(bridge, contentWorld: world, name: "wissGM")
        #if DEBUG
        // Debug builds: JS errors/warnings of the app code → Xcode console
        ucc.add(ConsoleLog(), contentWorld: world, name: "wissLog")
        ucc.addUserScript(WKUserScript(source: """
            (() => { const post = (l, a) => { try { window.webkit.messageHandlers.wissLog.postMessage(l + ' ' + a.map(x => x && x.stack ? x.stack : (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ')); } catch (e) {} };
              for (const l of ['log', 'warn', 'error']) { const o = console[l].bind(console); console[l] = (...a) => { post(l, a); o(...a); }; }
              window.addEventListener('error', (e) => post('uncaught', [e.message, e.filename + ':' + e.lineno]));
              window.addEventListener('unhandledrejection', (e) => post('rejection', [e.reason]));
              post('boot', [location.href]); })();
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: world))
        #endif
        for name in ["gm-bridge", "wiss-stundenplan.user"] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "js"),
                  let src = try? String(contentsOf: url, encoding: .utf8) else {
                assertionFailure("missing \(name).js"); continue
            }
            // `@noframes` + `@run-at document-start`
            ucc.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: world))
        }

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.isOpaque = false
        webView.backgroundColor = Self.backgroundColor
        webView.scrollView.backgroundColor = Self.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never   // page uses viewport-fit=cover
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        view.addSubview(webView)

        webView.load(URLRequest(url: Self.appURL))

        bridge.openExternal = { [weak self] url in self?.openExternally(url) }

        for name in [UIApplication.willResignActiveNotification, UIApplication.didEnterBackgroundNotification] {
            NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in await self?.flushStorage() }
            }
        }
        // back in front: permission may have changed in Settings, reminders may have been shown
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in await self?.runInApp("globalThis.__wissNativeResume && globalThis.__wissNativeResume()") }
        }
        // a tapped notification (new grade → Noten, absence → Absenzen)
        NotificationCenter.default.addObserver(forName: AppDelegate.openTab, object: nil, queue: .main) { [weak self] n in
            let tab = n.object as? String
            MainActor.assumeIsolated { AppDelegate.launchTab = nil; self?.openTab(tab) }   // queue: .main
        }
        if let tab = AppDelegate.launchTab { AppDelegate.launchTab = nil; pendingTab = tab }
    }

    private func runInApp(_ js: String, _ args: [String: Any] = [:]) async {
        guard isSchool(webView?.url) else { return }
        _ = try? await webView.callAsyncJavaScript(js, arguments: args, in: nil, contentWorld: world)
    }

    private func openTab(_ tab: String?) {
        guard let tab else { return }
        if loadedOnce {
            Task { await runInApp("globalThis.__wissNativeOpenTab && globalThis.__wissNativeOpenTab(tab)", ["tab": tab]) }
        } else {
            pendingTab = tab
        }
    }

    /// The bundle batches its writes and saves them on `pagehide` / when the page gets hidden.
    /// WKWebView doesn't reliably deliver those events to a script world before a reload or when
    /// the app goes to the background, so the app fires the same `pagehide` itself first.
    private func flushStorage() async {
        guard isSchool(webView?.url) else { return }
        _ = try? await webView.callAsyncJavaScript("window.dispatchEvent(new Event('pagehide'))",
                                                  arguments: [:], in: nil, contentWorld: world)
    }

    /// Offline (or the school server is down): show the app with the data saved on the phone.
    /// The document gets the wiss.tocco.ch origin, so the bundle finds its stored data as usual.
    private func loadOffline() {
        guard !showedOffline else { return }
        showedOffline = true
        webView.loadHTMLString("<!doctype html><html><head></head><body></body></html>", baseURL: Self.appURL)
    }

    private func isSchool(_ url: URL?) -> Bool { url?.host == Self.schoolHost }

    private func openExternally(_ url: URL) {
        if url.scheme == "http" || url.scheme == "https" {
            let safari = SFSafariViewController(url: url)
            safari.preferredControlTintColor = UIColor(red: 0xb5 / 255, green: 0x2a / 255, blue: 0x33 / 255, alpha: 1)
            present(safari, animated: true)
        } else {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Navigation

extension StundenplanWebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 preferences: WKWebpagePreferences) async -> (WKNavigationActionPolicy, WKWebpagePreferences) {
        if action.shouldPerformDownload { return (.download, preferences) }
        guard let url = action.request.url, let scheme = url.scheme?.lowercased() else { return (.allow, preferences) }

        // leaving / reloading the timetable page → save pending data first
        if action.targetFrame?.isMainFrame == true, isSchool(webView.url) { await flushStorage() }

        switch scheme {
        case "http", "https", "about", "blob", "data":
            // Main frame: the timetable, WISS extranet and the Microsoft sign-in all stay in the app.
            // A link the user taps that leads away from the school site opens in Safari instead.
            if action.targetFrame?.isMainFrame == true, action.navigationType == .linkActivated,
               !isSchool(url), isSchool(webView.url) {
                openExternally(url)
                return (.cancel, preferences)
            }
            return (.allow, preferences)
        default:
            // msauth://, tel:, mailto:, itms-apps:// … → the matching app (e.g. Microsoft Authenticator)
            await UIApplication.shared.open(url)
            return (.cancel, preferences)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        response.canShowMIMEType ? .allow : .download
    }

    /// The Stundenplan page draws under the notch itself (viewport-fit=cover + safe-area insets).
    /// Other pages (WISS extranet, Microsoft sign-in) don't, so they get normal safe-area insets.
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        let isApp = isSchool(webView.url) && (webView.url?.query?.contains("stundenplan") ?? false)
        webView.scrollView.contentInsetAdjustmentBehavior = isApp ? .never : .automatic
        view.backgroundColor = isApp ? Self.backgroundColor : .systemBackground
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if isSchool(webView.url) { showedOffline = false }
        if isSchool(webView.url), webView.url?.query?.contains("stundenplan") == true {
            loadedOnce = true
            if let tab = pendingTab {
                pendingTab = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in self?.openTab(tab) }
            }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handle(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handle(error)
    }

    private func handle(_ error: Error) {
        let e = error as NSError
        // window.stop() by the bundle and redirects cancel loads on purpose
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return }   // frame load interrupted
        let offline: Set<Int> = [NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost,
                                 NSURLErrorTimedOut, NSURLErrorCannotFindHost, NSURLErrorCannotConnectToHost,
                                 NSURLErrorDNSLookupFailed, NSURLErrorDataNotAllowed, NSURLErrorInternationalRoamingOff]
        if e.domain == NSURLErrorDomain && offline.contains(e.code) {
            let failing = (e.userInfo[NSURLErrorFailingURLErrorKey] as? URL)
            if failing == nil || isSchool(failing) || webView.url == nil || isSchool(webView.url) { loadOffline() }
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: Self.appURL))
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }
}

// MARK: - Windows & dialogs

extension StundenplanWebViewController: WKUIDelegate {
    /// `window.open(url, '_blank')` — the add-on uses it on iPhone for outside links (GitHub, updates…).
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if isSchool(url) || url.host?.hasSuffix("microsoftonline.com") == true { webView.load(action.request) }
            else { openExternally(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo) async {
        await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in c.resume() })
            present(a, animated: true)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo) async -> Bool {
        await withCheckedContinuation { c in
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in c.resume(returning: false) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in c.resume(returning: true) })
            present(a, animated: true)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo) async -> String? {
        await withCheckedContinuation { c in
            let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            a.addTextField { $0.text = defaultText }
            a.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in c.resume(returning: nil) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in c.resume(returning: a.textFields?.first?.text) })
            present(a, animated: true)
        }
    }
}

// MARK: - Downloads (e.g. "Notizen exportieren") → share sheet

extension StundenplanWebViewController: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String) async -> URL? {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(suggestedFilename.isEmpty ? "download" : suggestedFilename)
        pendingDownloads[download] = url
        return url
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = pendingDownloads.removeValue(forKey: download) else { return }
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = view
        share.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        present(share, animated: true)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        pendingDownloads.removeValue(forKey: download)
    }
}
