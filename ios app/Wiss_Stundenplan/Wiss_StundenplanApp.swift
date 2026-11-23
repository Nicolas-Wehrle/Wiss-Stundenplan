//
//  Wiss_StundenplanApp.swift
//  Wiss_Stundenplan
//
//  Native iOS shell for WISS Stundenplan (https://github.com/Nicolas-Wehrle/Wiss-Stundenplan).
//  The interface, styles, data logic and the WISS sign-in are the original project's own code
//  (its iPhone build), running inside this app's web view. See README.md.
//

import SwiftUI
import UserNotifications

@main
struct Wiss_StundenplanApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// Shows reminders while the app is open too, and opens the right tab when one is tapped.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    static let openTab = Notification.Name("wissOpenTab")
    /// tab from a notification that launched the app (before the web view existed)
    static var launchTab: String?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let tab = response.notification.request.content.userInfo["tab"] as? String
        await MainActor.run {
            guard let tab else { return }
            AppDelegate.launchTab = tab
            NotificationCenter.default.post(name: AppDelegate.openTab, object: tab)
        }
    }
}
