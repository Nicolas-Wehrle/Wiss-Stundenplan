//
//  LockScreenWidget.swift
//  StundenplanWidget
//
//  Small widgets for the lock screen (and StandBy / Apple Watch Smart Stack where iOS offers them):
//  - round:      ring that fills up during the lesson, end time in the middle; before it: day + start time
//  - rectangle:  status line, module, room · teacher
//  - inline:     one line above the clock: time, module, room
//  The lock screen tints everything itself, so there are no styles here.
//

import SwiftUI
import WidgetKit

struct LockProvider: TimelineProvider {
    func placeholder(in context: Context) -> LessonEntry { entry(.sample, at: Date()) }

    func getSnapshot(in context: Context, completion: @escaping (LessonEntry) -> Void) {
        completion(entry(WidgetPayload.load() ?? (context.isPreview ? .sample : nil), at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LessonEntry>) -> Void) {
        let payload = WidgetPayload.load()
        let now = Date()
        let dates = [now] + WidgetContent.changes(payload, from: now)
        completion(Timeline(entries: dates.map { entry(payload, at: $0) },
                            policy: .after(dates.last ?? now.addingTimeInterval(1800))))
    }

    private func entry(_ p: WidgetPayload?, at date: Date) -> LessonEntry {
        LessonEntry(date: date, content: WidgetContent(p, at: date), appStyle: p?.style ?? "standard",
                    appAccent: p?.accent ?? "", config: StundenplanWidgetConfig())
    }
}

struct LockScreenView: View {
    let entry: LessonEntry
    @Environment(\.widgetFamily) private var family
    private var k: WidgetContent { entry.content }

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryInline: inline
        default: rectangular
        }
    }

    /// "M319 Applikationen …" → "M319"
    private var short: String {
        let first = k.title.split(separator: " ").first.map(String.init) ?? k.title
        return first.range(of: #"^[A-Za-z]{1,4}\d{2,4}$"#, options: .regularExpression) != nil ? first : k.title
    }

    // ---- round
    @ViewBuilder private var circular: some View {
        if k.empty {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "calendar").font(.title3)
            }
        } else if k.running, let s = k.start, let e = k.end {
            let total = max(1, e.timeIntervalSince(s))
            let done = min(max(entry.date.timeIntervalSince(s) / total, 0), 1)
            Gauge(value: done) {
                Text(short)
            } currentValueLabel: {
                Text(WidgetContent.hm(e)).minimumScaleFactor(0.6)
            }
            .gaugeStyle(.accessoryCircular)
            .widgetAccentable()
        } else if let s = k.start {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text(dayShort(s)).font(.system(size: 9, weight: .bold)).widgetAccentable()
                    Text(WidgetContent.hm(s)).font(.system(size: 15, weight: .bold)).minimumScaleFactor(0.7)
                    if !k.room.isEmpty {
                        Text(k.room).font(.system(size: 8, weight: .medium)).lineLimit(1).minimumScaleFactor(0.6)
                    }
                }
                .padding(.horizontal, 4)
            }
        }
    }

    private func dayShort(_ d: Date) -> String {
        let label = WidgetContent.dayLabel(d, now: entry.date, en: k.en)
        return String(label.split(separator: " ").first ?? Substring(label))
    }

    // ---- rectangle
    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(rectKicker).font(.caption2.weight(.bold)).lineLimit(1).widgetAccentable()
            Text(k.title).font(.headline).lineLimit(k.meta.isEmpty ? 2 : 1)
            if !k.meta.isEmpty { Text(k.meta).font(.caption).lineLimit(1) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// "MORGEN · 08:15–11:30" is too wide here → "MORGEN · 08:15" (running: "JETZT · BIS 16:15" stays)
    private var rectKicker: String {
        guard !k.empty, !k.running, let s = k.start else { return k.kicker }
        return WidgetContent.dayLabel(s, now: entry.date, en: k.en) + " · " + WidgetContent.hm(s)
    }

    // ---- inline (above the clock)
    private var inline: some View {
        if k.empty { return Text(k.title) }
        let when: String
        if k.running, let e = k.end { when = (k.en ? "until " : "bis ") + WidgetContent.hm(e) }
        else if let s = k.start { when = WidgetContent.hm(s) }
        else { when = "" }
        return Text([when, short, k.room].filter { !$0.isEmpty }.joined(separator: " · "))
    }
}

struct StundenplanLockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "StundenplanLockScreen", provider: LockProvider()) { entry in
            LockScreenView(entry: entry).containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("Stundenplan – Sperrbildschirm")
        .description("Nächste Lektion mit Zeit und Raum, klein für den Sperrbildschirm.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

#Preview(as: .accessoryCircular) {
    StundenplanLockWidget()
} timeline: {
    LessonEntry(date: .now, content: WidgetContent(.sample, at: .now), appStyle: "standard", appAccent: "", config: StundenplanWidgetConfig())
}
