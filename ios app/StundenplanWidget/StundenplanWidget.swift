//
//  StundenplanWidget.swift
//  StundenplanWidget
//
//  Home-screen widget: current/next lesson with room and teacher, plus the one after.
//  Same content, styles and colours as the Android widget (NextLessonWidget.java); long-press →
//  "Edit widget" to pick a style, light/dark and the background, like the Android widget settings.
//

import AppIntents
import CoreText
import SwiftUI
import WidgetKit

// MARK: - Settings (long-press → Edit widget)

enum WidgetStyleOption: String, AppEnum {
    case app, standard, apple, samsung, nothing, github, pastel, neon, paper, terminal

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Stil"
    static let caseDisplayRepresentations: [WidgetStyleOption: DisplayRepresentation] = [
        .app: "Wie in der App", .standard: "Standard", .apple: "Apple", .samsung: "Samsung",
        .nothing: "Nothing", .github: "GitHub", .pastel: "Pastell", .neon: "Neon", .paper: "Papier", .terminal: "Terminal"
    ]
}

enum WidgetModeOption: String, AppEnum {
    case system, light, dark

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Modus"
    static let caseDisplayRepresentations: [WidgetModeOption: DisplayRepresentation] = [
        .system: "System", .light: "Hell", .dark: "Dunkel"
    ]
}

struct StundenplanWidgetConfig: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Stundenplan"
    static let description = IntentDescription("Aktuelle oder nächste Lektion mit Raum und Lehrperson.")

    @Parameter(title: "Stil", default: .app) var style: WidgetStyleOption
    @Parameter(title: "Modus", default: .system) var mode: WidgetModeOption
    @Parameter(title: "Hintergrund", default: true) var background: Bool
}

// MARK: - Timeline

struct LessonEntry: TimelineEntry {
    let date: Date
    let content: WidgetContent
    let appStyle: String
    let appAccent: String
    let config: StundenplanWidgetConfig
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> LessonEntry {
        entry(WidgetPayload.sample, at: Date(), config: StundenplanWidgetConfig())
    }

    func snapshot(for configuration: StundenplanWidgetConfig, in context: Context) async -> LessonEntry {
        entry(WidgetPayload.load() ?? (context.isPreview ? .sample : nil), at: Date(), config: configuration)
    }

    func timeline(for configuration: StundenplanWidgetConfig, in context: Context) async -> Timeline<LessonEntry> {
        let payload = WidgetPayload.load()
        let now = Date()
        let dates = [now] + WidgetContent.changes(payload, from: now)
        let entries = dates.map { entry(payload, at: $0, config: configuration) }
        return Timeline(entries: entries, policy: .after(dates.last ?? now.addingTimeInterval(1800)))
    }

    private func entry(_ p: WidgetPayload?, at date: Date, config: StundenplanWidgetConfig) -> LessonEntry {
        LessonEntry(date: date, content: WidgetContent(p, at: date), appStyle: p?.style ?? "standard",
                    appAccent: p?.accent ?? "", config: config)
    }
}

extension WidgetPayload {
    static var sample: WidgetPayload {
        let now = Date().timeIntervalSince1970 * 1000
        return WidgetPayload(lang: "de", accent: "", style: "standard", lessons: [
            WidgetLesson(s: now - 1_800_000, e: now + 5_400_000, t: "M319 Applikationen entwerfen und implementieren", r: "DEMO-203", p: "Demo-Lehrperson 3"),
            WidgetLesson(s: now + 7_200_000, e: now + 18_000_000, t: "M164 Datenbanken erstellen und Daten einfügen", r: "DEMO-204", p: "Demo-Lehrperson 4")
        ])
    }
}

// MARK: - Look (colours from the Android widget)

struct Palette {
    let surface, ink, muted, faint, accent, border: Color

    static let styles = ["standard", "apple", "samsung", "nothing", "github", "pastel", "neon", "paper", "terminal"]

    static func of(_ style: String, dark: Bool) -> Palette {
        let p: [UInt32]
        switch style {
        case "nothing":  p = dark ? [0x000000, 0xFFFFFF, 0x8E8E8E, 0x5C5C5C, 0xE8222B, 0x262626] : [0xFFFFFF, 0x000000, 0x6A6A6A, 0xA6A6A6, 0xD71921, 0xD9D9D9]
        case "github":   p = dark ? [0x0D1117, 0xF0F6FC, 0x9198A1, 0x656C76, 0x4493F8, 0x3D444D] : [0xFFFFFF, 0x1F2328, 0x59636E, 0x818B98, 0x0969DA, 0xD1D9E0]
        case "apple":    p = dark ? [0x1C1C1E, 0xFFFFFF, 0x8D8D93, 0x48484A, 0x0A84FF, 0x38383A] : [0xFFFFFF, 0x000000, 0x8A8A8E, 0xC4C4C6, 0x007AFF, 0xE2E2E6]
        case "samsung":  p = dark ? [0x171717, 0xFAFAFA, 0x9A9A9F, 0x5A5A5F, 0x6E9CFF, 0x2A2A2A] : [0xFCFCFC, 0x010101, 0x6F6F74, 0xA9A9AE, 0x3E7BFA, 0xE4E4E7]
        case "pastel":   p = dark ? [0x201C2C, 0xF1EDFB, 0xA49CBA, 0x5F5876, 0xB49CFF, 0x332D47] : [0xFFFFFF, 0x2F2A40, 0x7C7590, 0xB3ABC6, 0x8A6CF0, 0xEBE4F7]
        case "neon":     p = dark ? [0x141027, 0xF3EEFF, 0x9A8FBF, 0x4F4672, 0xFF3CAC, 0x2A2348] : [0xFFFFFF, 0x1D1530, 0x6F6488, 0xAB9FC4, 0xE0218A, 0xEEDFF8]
        case "paper":    p = dark ? [0x23201B, 0xECE4D4, 0xA39887, 0x6B6255, 0xE08C72, 0x3A342B] : [0xFBF8F1, 0x2B2620, 0x7B7164, 0xAAA091, 0x8E3523, 0xE0D7C6]
        case "terminal": p = dark ? [0x0B120B, 0xB9F6B2, 0x5F9A5F, 0x2F5530, 0x39FF6A, 0x1C321D] : [0xF8F6EC, 0x1D3A1F, 0x5D7A5E, 0x9BB09B, 0x1F7A2E, 0xC9CFB8]
        default:         p = dark ? [0x1C1C20, 0xECECEF, 0x9A9AA3, 0x6E6E78, 0xE5545D, 0x2D2D33] : [0xFFFFFF, 0x17171A, 0x6B6B73, 0x9B9BA3, 0xB52A33, 0xE7E5E1]
        }
        return Palette(surface: Color(hex: p[0]), ink: Color(hex: p[1]), muted: Color(hex: p[2]),
                       faint: Color(hex: p[3]), accent: Color(hex: p[4]), border: Color(hex: p[5]))
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
    init?(css: String) {
        guard css.count == 7, css.hasPrefix("#"), let v = UInt32(css.dropFirst(), radix: 16) else { return nil }
        self.init(hex: v)
    }
}

enum WidgetFonts {
    /// Doto (dot matrix, "Nothing") and Space Mono ("Terminal"), the same files the Android widget uses.
    static let registered: Void = {
        for name in ["doto", "spacemono"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf")
                ?? Bundle.main.url(forResource: name, withExtension: "ttf", subdirectory: "Fonts") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }()
    static func doto(_ size: CGFloat) -> Font { _ = registered; return .custom("DotoBlack-Bold", fixedSize: size) }
    static func mono(_ size: CGFloat) -> Font { _ = registered; return .custom("SpaceMono-Regular", fixedSize: size) }
}

// MARK: - Views

struct StundenplanWidgetView: View {
    let entry: LessonEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var systemScheme

    private var style: String {
        let s = entry.config.style == .app ? entry.appStyle : entry.config.style.rawValue
        return Palette.styles.contains(s) ? s : "standard"
    }
    private var dark: Bool {
        switch entry.config.mode {
        case .dark: return true
        case .light: return false
        case .system: return systemScheme == .dark
        }
    }
    private var pal: Palette { Palette.of(style, dark: dark) }
    private var accent: Color {
        if entry.config.style == .app, let c = Color(css: entry.appAccent) { return c }
        return pal.accent
    }
    private var k: WidgetContent { entry.content }

    var body: some View {
        home.containerBackground(for: .widget) { background }
    }

    // ---- texts slightly reworded per style (same as Android)
    private var kicker: String {
        switch style {
        case "apple":
            if k.empty { return k.kicker }
            return k.running ? (k.en ? "NOW" : "JETZT") : String(k.kicker.components(separatedBy: " · ").first ?? "")
        case "samsung", "paper": return sentence(k.kicker)
        case "terminal": return "$ " + k.kicker.lowercased()
        default: return k.kicker
        }
    }
    private var meta: String { style == "terminal" && !k.meta.isEmpty ? "@ " + k.meta : k.meta }
    private var after: String { style == "terminal" && !k.after.isEmpty ? "# " + k.after : k.after }
    private func sentence(_ s: String) -> String { s.isEmpty ? s : s.prefix(1).uppercased() + s.dropFirst().lowercased() }

    private var kickColor: Color {
        if style == "nothing" { return pal.muted }
        if style == "apple" && k.running { return dark ? Color(hex: 0xFF453A) : Color(hex: 0xFF3B30) }
        return accent
    }
    private var metaColor: Color { style == "neon" ? (dark ? Color(hex: 0x2DE2E6) : Color(hex: 0x00A6B8)) : pal.muted }

    private func font(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        switch style {
        case "terminal": return WidgetFonts.mono(size - 1)
        case "paper": return .system(size: size, weight: weight, design: .serif)
        case "pastel": return .system(size: size, weight: weight, design: .rounded)
        default: return .system(size: size, weight: weight)
        }
    }
    private func monoIfNothing(_ size: CGFloat) -> Font { style == "nothing" ? .system(size: size, design: .monospaced) : font(size) }

    private var titleLines: Int { family == .systemSmall ? 3 : 2 }
    private var hasTime: Bool { !k.empty && !k.time.isEmpty }

    // ---- home screen
    private var home: some View {
        HStack(alignment: .top, spacing: 10) {
            if style == "standard" || style == "github" || style == "apple" {
                RoundedRectangle(cornerRadius: 2).fill(accent).frame(width: 4)
            }
            if style == "pastel" && hasTime && family != .systemSmall {
                Text(k.time.replacingOccurrences(of: "–", with: "\n"))
                    .font(.system(size: 14, weight: .bold, design: .rounded)).multilineTextAlignment(.center)
                    .foregroundStyle(accent).frame(width: 64).padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: 16).fill(pal.surface))
            }
            VStack(alignment: .leading, spacing: 2) {
                top
                Text(k.title)
                    .font(style == "nothing" ? .system(size: 15, weight: .bold) : font(style == "apple" ? 14 : 16, style == "apple" ? .medium : .bold))
                    .foregroundStyle(pal.ink).lineLimit(titleLines).padding(.top, 1)
                if !meta.isEmpty {
                    Text(meta).font(style == "nothing" ? monoIfNothing(12) : font(13)).foregroundStyle(metaColor).lineLimit(1)
                }
                Spacer(minLength: 4)
                if !after.isEmpty {
                    Text(after).font(style == "nothing" ? monoIfNothing(11) : font(12)).foregroundStyle(pal.faint).lineLimit(family == .systemSmall ? 2 : 1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.leading, style == "paper" ? 26 : 0)
    }

    @ViewBuilder private var top: some View {
        switch style {
        case "nothing":
            HStack(spacing: 6) {
                Circle().fill(k.running ? accent : pal.ink).frame(width: 8, height: 8)
                Text(kicker).font(.system(size: 11, design: .monospaced)).tracking(0.9).foregroundStyle(kickColor).lineLimit(1)
            }
            if hasTime { Text(k.time).font(WidgetFonts.doto(28)).foregroundStyle(pal.ink).lineLimit(1).minimumScaleFactor(0.6) }
        case "apple":
            Text(kicker).font(.system(size: 11, weight: .bold)).foregroundStyle(kickColor).lineLimit(1)
            if hasTime { Text(k.time).font(.system(size: 22, weight: .bold)).foregroundStyle(pal.ink).lineLimit(1).minimumScaleFactor(0.7) }
        case "samsung":
            Text(kicker).font(.system(size: 11, weight: .bold)).foregroundStyle(accent).lineLimit(1)
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background(Capsule().fill(accent.opacity(dark ? 0.27 : 0.15)))
        default:
            Text(kicker).font(font(11, .bold)).tracking(style == "terminal" ? 0 : 0.6).foregroundStyle(kickColor).lineLimit(1)
        }
    }

    // ---- background (colour, gradient, border or paper lines)
    @ViewBuilder private var background: some View {
        if !entry.config.background {
            Color.clear
        } else {
            switch style {
            case "pastel":
                LinearGradient(colors: dark ? [Color(hex: 0x2A2340), Color(hex: 0x201C2C)] : [Color(hex: 0xEFE9FF), Color(hex: 0xFDE5EC)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            case "neon":
                ZStack {
                    LinearGradient(colors: [Color(hex: 0xFF3CAC), Color(hex: 0x2DE2E6)], startPoint: .leading, endPoint: .trailing)
                    ContainerRelativeShape().inset(by: 1.5)
                        .fill(dark ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x1A1433), Color(hex: 0x0B0918)], startPoint: .top, endPoint: .bottom))
                                   : AnyShapeStyle(Color.white))
                }
            case "paper":
                ZStack(alignment: .leading) {
                    pal.surface
                    VStack(spacing: 17) { ForEach(0..<12, id: \.self) { _ in Rectangle().fill(pal.border.opacity(0.7)).frame(height: 0.7) } }
                        .padding(.top, 26)
                    HStack(spacing: 2) { Rectangle().frame(width: 1); Rectangle().frame(width: 1) }
                        .foregroundStyle(Color(hex: 0xA3322A).opacity(0.4)).padding(.leading, 24)
                }
            case "terminal":
                ZStack { pal.surface; ContainerRelativeShape().strokeBorder(accent.opacity(0.6), lineWidth: 1.5) }
            case "github":
                ZStack { pal.surface; ContainerRelativeShape().strokeBorder(pal.border, lineWidth: 1) }
            default:
                pal.surface
            }
        }
    }
}

// MARK: - Widget

struct StundenplanWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "StundenplanNextLesson", intent: StundenplanWidgetConfig.self, provider: Provider()) { entry in
            StundenplanWidgetView(entry: entry)
        }
        .configurationDisplayName("Stundenplan")
        .description("Aktuelle oder nächste Lektion mit Raum und Lehrperson.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct StundenplanWidgetBundle: WidgetBundle {
    var body: some Widget {
        StundenplanWidget()
        StundenplanLockWidget()
    }
}

#Preview(as: .systemMedium) {
    StundenplanWidget()
} timeline: {
    LessonEntry(date: .now, content: WidgetContent(.sample, at: .now), appStyle: "standard", appAccent: "", config: StundenplanWidgetConfig())
}
