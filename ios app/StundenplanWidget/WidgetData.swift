//
//  WidgetData.swift
//  StundenplanWidget
//
//  What the widget shows — a port of the Android widget's content logic (NextLessonWidget.content).
//  The app hands over the upcoming lessons after every sync (Web/gm-bridge.js → NativeBridge).
//

import Foundation

enum SharedData {
    static let appGroup = "group.dandev.Wiss-Stundenplan"
    static let widgetKey = "widgetData"
}

struct WidgetLesson: Codable, Hashable {
    let s: Double      // start, ms since 1970
    let e: Double      // end
    let t: String      // module
    let r: String      // room
    let p: String      // teacher
    var start: Date { Date(timeIntervalSince1970: s / 1000) }
    var end: Date { Date(timeIntervalSince1970: e / 1000) }
}

struct WidgetPayload: Codable {
    var lang: String = "de"
    var accent: String = ""
    var style: String = "standard"
    var lessons: [WidgetLesson] = []

    static func load() -> WidgetPayload? {
        guard let data = UserDefaults(suiteName: SharedData.appGroup)?.data(forKey: SharedData.widgetKey) else { return nil }
        return try? JSONDecoder().decode(WidgetPayload.self, from: data)
    }
}

struct WidgetContent {
    var en = false, empty = false, running = false
    var kicker = "", title = "", meta = "", after = "", time = ""
    var start: Date?, end: Date?, room = ""

    static let zurich = TimeZone(identifier: "Europe/Zurich")!

    init(_ payload: WidgetPayload?, at now: Date) {
        let en = payload?.lang == "en"
        self.en = en
        let t = { (de: String, eng: String) in en ? eng : de }
        let upcoming = (payload?.lessons ?? []).filter { $0.end > now }
        guard let cur = upcoming.first else {
            empty = true
            kicker = payload == nil ? t("STUNDENPLAN", "TIMETABLE") : t("NICHTS GEPLANT", "NOTHING PLANNED")
            title = payload == nil ? t("App einmal öffnen", "Open the app once") : t("Keine Lektionen", "No lessons")
            return
        }
        running = cur.start <= now
        start = cur.start
        end = cur.end
        room = cur.r
        kicker = running ? t("JETZT · BIS ", "NOW · UNTIL ") + Self.hm(cur.end)
                         : Self.dayLabel(cur.start, now: now, en: en) + " · " + Self.hm(cur.start) + "–" + Self.hm(cur.end)
        time = Self.hm(cur.start) + "–" + Self.hm(cur.end)
        title = cur.t
        meta = [cur.r, cur.p].filter { !$0.isEmpty }.joined(separator: " · ")
        if upcoming.count > 1 {
            let a = upcoming[1]
            let day = Self.dayLabel(a.start, now: now, en: en)
            after = t("Danach: ", "Then: ") + a.t + " · " + day.prefix(1) + day.dropFirst().lowercased() + " " + Self.hm(a.start)
                + (a.r.isEmpty ? "" : " · " + a.r)
        }
    }

    static var calendar: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = zurich; return c }

    static func hm(_ d: Date) -> String {
        let f = DateFormatter()
        f.timeZone = zurich
        f.dateFormat = "HH:mm"
        return f.string(from: d)
    }

    static func dayLabel(_ d: Date, now: Date, en: Bool) -> String {
        let cal = calendar
        if cal.isDate(d, inSameDayAs: now) { return en ? "TODAY" : "HEUTE" }
        if let tomorrow = cal.date(byAdding: .day, value: 1, to: now), cal.isDate(d, inSameDayAs: tomorrow) { return en ? "TOMORROW" : "MORGEN" }
        let de = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"], enD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        let wd = (cal.component(.weekday, from: d) + 5) % 7          // Monday = 0
        return (en ? enD : de)[wd] + " \(cal.component(.day, from: d)).\(cal.component(.month, from: d))."
    }

    /// When the widget has to change: lesson starts/ends and midnight (for HEUTE/MORGEN).
    static func changes(_ payload: WidgetPayload?, from now: Date) -> [Date] {
        var out = Set<Date>()
        for l in (payload?.lessons ?? []).prefix(12) {
            if l.start > now { out.insert(l.start) }
            if l.end > now { out.insert(l.end) }
        }
        // running lesson: every 5 minutes, so the lock-screen ring fills up
        if let cur = (payload?.lessons ?? []).first(where: { $0.end > now }), cur.start <= now {
            var t = now.addingTimeInterval(300)
            while t < cur.end { out.insert(t); t = t.addingTimeInterval(300) }
        }
        let cal = calendar
        var day = cal.startOfDay(for: now)
        for _ in 0..<3 {
            day = cal.date(byAdding: .day, value: 1, to: day)!
            out.insert(day)
        }
        return out.sorted().filter { $0.timeIntervalSince(now) < 3 * 86400 }
    }
}
