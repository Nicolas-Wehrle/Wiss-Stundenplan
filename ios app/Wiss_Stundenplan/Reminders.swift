//
//  Reminders.swift
//  Wiss_Stundenplan
//
//  Notifications, like the Android app (Notifs.java):
//  - shown right away: new grades, test notification
//  - scheduled ahead: lesson reminders and absence deadlines, so they also come when the app is closed
//  The add-on plans the reminders itself (next 7 days, from your settings); the phone only schedules them.
//

import Foundation
@preconcurrency import UserNotifications
import UIKit

nonisolated enum Reminders {
    private static let planPrefix = "plan:"
    private static let scheduledKey = "reminders.scheduledAbs"   // absence id → time
    private static let firedKey = "reminders.firedAbs"           // absences already reminded (only once)
    private static var store: UserDefaults { .standard }

    // MARK: permission

    static func permission() async -> String {
        switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
        case .authorized, .provisional, .ephemeral: return "granted"
        case .denied: return "denied"
        default: return "default"
        }
    }

    /// Asks once; if it was turned off before, iOS won't ask again → open the app's settings.
    @MainActor
    static func requestPermission() async -> String {
        let current = await permission()
        if current == "denied" {
            if let url = URL(string: UIApplication.openSettingsURLString) { await UIApplication.shared.open(url) }
            return current
        }
        if current == "granted" { return current }
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        return await permission()
    }

    // MARK: show / schedule

    static func show(id: String, title: String, body: String) {
        let req = UNNotificationRequest(identifier: id, content: content(id: id, title: title, body: body), trigger: nil)
        UNUserNotificationCenter.current().add(req)
    }

    /// Replaces all scheduled reminders with the plan (array of {id, at (ms), title, body, abs}).
    static func schedule(_ plan: [[String: Any]]) {
        let center = UNUserNotificationCenter.current()
        recordFired()
        let fired = Set(store.stringArray(forKey: firedKey) ?? [])
        let now = Date()
        var scheduledAbs: [String: Double] = [:]
        var requests: [UNNotificationRequest] = []
        for r in plan {
            guard let id = r["id"] as? String, let atMs = (r["at"] as? NSNumber)?.doubleValue else { continue }
            let at = Date(timeIntervalSince1970: atMs / 1000)
            let abs = r["abs"] as? String
            if at < now.addingTimeInterval(-60) { continue }
            if let abs, fired.contains(abs) { continue }
            let when = max(at, now.addingTimeInterval(1))
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: when)
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            requests.append(UNNotificationRequest(identifier: planPrefix + id,
                                                  content: content(id: id, title: r["title"] as? String ?? "", body: r["body"] as? String ?? ""),
                                                  trigger: trigger))
            if let abs { scheduledAbs[abs] = when.timeIntervalSince1970 }
            if requests.count >= 60 { break }                     // iOS keeps at most 64 pending
        }
        store.set(scheduledAbs, forKey: scheduledKey)
        center.getPendingNotificationRequests { pending in
            let old = pending.map(\.identifier).filter { $0.hasPrefix(planPrefix) }
            center.removePendingNotificationRequests(withIdentifiers: old)
            for r in requests { center.add(r) }
        }
    }

    /// Absence reminders whose time has passed count as shown (Android: Notifs.markFired).
    static func firedAbsences() -> [String] {
        recordFired()
        return store.stringArray(forKey: firedKey) ?? []
    }

    private static func recordFired() {
        let scheduled = (store.dictionary(forKey: scheduledKey) as? [String: Double]) ?? [:]
        let now = Date().timeIntervalSince1970
        var fired = Set(store.stringArray(forKey: firedKey) ?? [])
        var rest = scheduled
        for (abs, at) in scheduled where at <= now { fired.insert(abs); rest[abs] = nil }
        store.set(Array(fired.suffix(500)), forKey: firedKey)
        store.set(rest, forKey: scheduledKey)
    }

    private static func content(id: String, title: String, body: String) -> UNMutableNotificationContent {
        let c = UNMutableNotificationContent()
        c.title = title
        c.body = body
        c.sound = .default
        // same grouping as the Android channels
        c.threadIdentifier = id.hasPrefix("abs") ? "absences" : (id.hasPrefix("grade") || id.hasPrefix("test")) ? "grades" : "lessons"
        if id.hasPrefix("grade") { c.userInfo = ["tab": "grades"] }
        else if id.hasPrefix("abs") { c.userInfo = ["tab": "absences"] }
        return c
    }
}
