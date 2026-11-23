//
//  ConsoleLog.swift
//  Wiss_Stundenplan
//
//  Debug builds only: forwards the web app's console output to the Xcode console.
//

#if DEBUG
import WebKit
import os

final class ConsoleLog: NSObject, WKScriptMessageHandler {
    private let log = Logger(subsystem: "dandev.Wiss-Stundenplan", category: "web")

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        log.notice("\(String(describing: message.body), privacy: .public)")
    }
}
#endif
