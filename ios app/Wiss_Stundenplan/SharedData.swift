//
//  SharedData.swift
//  Wiss_Stundenplan
//
//  App Group storage shared with the widget (StundenplanWidget/WidgetData.swift reads the same key).
//

import Foundation

nonisolated enum SharedData {
    static let appGroup = "group.dandev.Wiss-Stundenplan"
    static let widgetKey = "widgetData"
    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
}
