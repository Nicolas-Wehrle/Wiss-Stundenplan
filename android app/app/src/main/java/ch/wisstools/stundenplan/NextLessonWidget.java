package ch.wisstools.stundenplan;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Home-screen widget: current/next lesson with room and teacher, plus the one after.
 *  The app hands over the upcoming lessons after every sync (Host.widgetData).
 *  Each widget has its own look (WidgetConfigActivity): style, background, light/dark, transparency. */
public class NextLessonWidget extends AppWidgetProvider {
    static final String PREFS = "widget";
    static final ZoneId ZH = ZoneId.of("Europe/Zurich");

    // ---------- per-widget settings ----------
    static final class Cfg {
        String style = "app";      // app | standard | nothing | github
        boolean bg = true;
        String mode = "system";    // system | light | dark
        int transparency = 0;      // 0..100 %

        static Cfg load(Context c, int id) {
            SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            Cfg f = new Cfg();
            f.style = sp.getString("style_" + id, f.style);
            f.bg = sp.getBoolean("bg_" + id, f.bg);
            f.mode = sp.getString("mode_" + id, f.mode);
            f.transparency = sp.getInt("alpha_" + id, f.transparency);
            return f;
        }

        void save(Context c, int id) {
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString("style_" + id, style).putBoolean("bg_" + id, bg)
                    .putString("mode_" + id, mode).putInt("alpha_" + id, transparency).apply();
        }
    }

    /** What the widget shows right now (independent of the look). */
    static final class Content {
        boolean en, empty, running;
        String appStyle = "standard", appAccent = "";
        String kicker = "", title = "", meta = "", after = "", time = "";
        long nextTick;
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { render(c, m, ids); }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { render(c, m, new int[]{id}); }

    @Override
    public void onDeleted(Context c, int[] ids) {
        SharedPreferences.Editor e = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        for (int id : ids) e.remove("style_" + id).remove("bg_" + id).remove("mode_" + id).remove("alpha_" + id);
        e.apply();
    }

    @Override
    public void onReceive(Context c, Intent i) {
        super.onReceive(c, i);
        if ("ch.wisstools.stundenplan.WIDGET_TICK".equals(i.getAction())) updateAll(c);
    }

    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply();
        updateAll(c);
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, NextLessonWidget.class));
        if (ids.length > 0) render(c, m, ids);
    }

    static void render(Context c, AppWidgetManager m, int[] ids) {
        Content k = content(c);
        for (int id : ids) {
            // phones in portrait use the max height; 0 = unknown (older launchers)
            int h = 0;
            try { h = m.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0); } catch (Exception ignored) { }
            m.updateAppWidget(id, build(c, Cfg.load(c, id), k, h));
        }
        Intent tick = new Intent(c, NextLessonWidget.class).setAction("ch.wisstools.stundenplan.WIDGET_TICK");
        PendingIntent pi = PendingIntent.getBroadcast(c, 4711, tick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        long now = System.currentTimeMillis();
        c.getSystemService(AlarmManager.class).set(AlarmManager.RTC, Math.max(k.nextTick, now + 60000), pi);
    }

    // ---------- content ----------
    private static String t(boolean en, String de, String eng) { return en ? eng : de; }

    static Content content(Context c) {
        Content k = new Content();
        String raw = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null);
        long now = System.currentTimeMillis();
        k.nextTick = now + 30 * 60000L;
        JSONObject cur = null, after = null;
        try {
            if (raw != null) {
                JSONObject d = new JSONObject(raw);
                k.en = "en".equals(d.optString("lang"));
                k.appStyle = d.optString("style", "standard");
                k.appAccent = d.optString("accent", "");
                JSONArray ls = d.getJSONArray("lessons");
                for (int i = 0; i < ls.length(); i++) {
                    JSONObject l = ls.getJSONObject(i);
                    if (Instant.parse(l.getString("e")).toEpochMilli() <= now) continue;
                    if (cur == null) cur = l; else { after = l; break; }
                }
            }
        } catch (Exception ignored) { }
        boolean en = k.en;
        if (cur == null) {
            k.empty = true;
            k.kicker = raw == null ? t(en, "STUNDENPLAN", "TIMETABLE") : t(en, "NICHTS GEPLANT", "NOTHING PLANNED");
            k.title = raw == null ? t(en, "App einmal öffnen", "Open the app once") : t(en, "Keine Lektionen", "No lessons");
            return k;
        }
        try {
            ZonedDateTime s = Instant.parse(cur.getString("s")).atZone(ZH), e = Instant.parse(cur.getString("e")).atZone(ZH);
            long sMs = s.toInstant().toEpochMilli(), eMs = e.toInstant().toEpochMilli();
            k.running = sMs <= now;
            k.nextTick = Math.min(k.nextTick, k.running ? eMs : sMs);
            k.kicker = k.running ? t(en, "JETZT · BIS ", "NOW · UNTIL ") + hm(e) : dayLabel(s, en) + " · " + hm(s) + "–" + hm(e);
            k.time = hm(s) + "–" + hm(e);
            k.title = cur.optString("t");
            k.meta = join(cur.optString("r"), cur.optString("p"));
            if (after != null) {
                ZonedDateTime s2 = Instant.parse(after.getString("s")).atZone(ZH);
                String day = dayLabel(s2, en);
                k.after = t(en, "Danach: ", "Then: ") + after.optString("t") + " · " + day.charAt(0) + day.substring(1).toLowerCase(Locale.ROOT) + " " + hm(s2)
                        + (after.optString("r").isEmpty() ? "" : " · " + after.optString("r"));
            }
        } catch (Exception ex) { k.title = cur.optString("t"); }
        return k;
    }

    // ---------- look ----------
    /** surface, ink, muted, faint, accent, border */
    static final String[] STYLES = {"standard", "apple", "samsung", "nothing", "github", "pastel", "neon", "paper", "terminal"};

    static int[] palette(String style, boolean dark) {
        switch (style) {
            case "nothing": return dark
                    ? new int[]{0xFF000000, 0xFFFFFFFF, 0xFF8E8E8E, 0xFF5C5C5C, 0xFFE8222B, 0xFF262626}
                    : new int[]{0xFFFFFFFF, 0xFF000000, 0xFF6A6A6A, 0xFFA6A6A6, 0xFFD71921, 0xFFD9D9D9};
            case "github": return dark
                    ? new int[]{0xFF0D1117, 0xFFF0F6FC, 0xFF9198A1, 0xFF656C76, 0xFF4493F8, 0xFF3D444D}
                    : new int[]{0xFFFFFFFF, 0xFF1F2328, 0xFF59636E, 0xFF818B98, 0xFF0969DA, 0xFFD1D9E0};
            case "apple": return dark
                    ? new int[]{0xFF1C1C1E, 0xFFFFFFFF, 0xFF8D8D93, 0xFF48484A, 0xFF0A84FF, 0xFF38383A}
                    : new int[]{0xFFFFFFFF, 0xFF000000, 0xFF8A8A8E, 0xFFC4C4C6, 0xFF007AFF, 0xFFE2E2E6};
            case "samsung": return dark
                    ? new int[]{0xFF171717, 0xFFFAFAFA, 0xFF9A9A9F, 0xFF5A5A5F, 0xFF6E9CFF, 0xFF2A2A2A}
                    : new int[]{0xFFFCFCFC, 0xFF010101, 0xFF6F6F74, 0xFFA9A9AE, 0xFF3E7BFA, 0xFFE4E4E7};
            case "pastel": return dark
                    ? new int[]{0xFF201C2C, 0xFFF1EDFB, 0xFFA49CBA, 0xFF5F5876, 0xFFB49CFF, 0xFF332D47}
                    : new int[]{0xFFFFFFFF, 0xFF2F2A40, 0xFF7C7590, 0xFFB3ABC6, 0xFF8A6CF0, 0xFFEBE4F7};
            case "neon": return dark
                    ? new int[]{0xFF141027, 0xFFF3EEFF, 0xFF9A8FBF, 0xFF4F4672, 0xFFFF3CAC, 0xFF2A2348}
                    : new int[]{0xFFFFFFFF, 0xFF1D1530, 0xFF6F6488, 0xFFAB9FC4, 0xFFE0218A, 0xFFEEDFF8};
            case "paper": return dark
                    ? new int[]{0xFF23201B, 0xFFECE4D4, 0xFFA39887, 0xFF6B6255, 0xFFE08C72, 0xFF3A342B}
                    : new int[]{0xFFFBF8F1, 0xFF2B2620, 0xFF7B7164, 0xFFAAA091, 0xFF8E3523, 0xFFE0D7C6};
            case "terminal": return dark
                    ? new int[]{0xFF0B120B, 0xFFB9F6B2, 0xFF5F9A5F, 0xFF2F5530, 0xFF39FF6A, 0xFF1C321D}
                    : new int[]{0xFFF8F6EC, 0xFF1D3A1F, 0xFF5D7A5E, 0xFF9BB09B, 0xFF1F7A2E, 0xFFC9CFB8};
            default: return dark
                    ? new int[]{0xFF1C1C20, 0xFFECECEF, 0xFF9A9AA3, 0xFF6E6E78, 0xFFE5545D, 0xFF2D2D33}
                    : new int[]{0xFFFFFFFF, 0xFF17171A, 0xFF6B6B73, 0xFF9B9BA3, 0xFFB52A33, 0xFFE7E5E1};
        }
    }

    static boolean isDark(Context c, Cfg f) {
        if ("dark".equals(f.mode)) return true;
        if ("light".equals(f.mode)) return false;
        return (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    static RemoteViews build(Context c, Cfg f, Content k) { return build(c, f, k, 0); }

    /** hDp: the widget's height in dp (0 = unknown). Flat widgets (4×1) get fewer lines, so nothing is cut off. */
    static RemoteViews build(Context c, Cfg f, Content k, int hDp) {
        boolean compact = hDp > 0 && hDp < 110;              // about one row high
        boolean tall = hDp == 0 || hDp >= 165;               // room for everything
        String style = "app".equals(f.style) ? k.appStyle : f.style;
        if (!java.util.Arrays.asList(STYLES).contains(style)) style = "standard";   // new styles from a newer web part
        boolean dark = isDark(c, f);
        int[] p = palette(style, dark);
        int surface = p[0], ink = p[1], muted = p[2], faint = p[3], accent = p[4], border = p[5];
        if ("app".equals(f.style) && k.appAccent.matches("#[0-9a-fA-F]{6}")) accent = Color.parseColor(k.appAccent);
        int layout;
        switch (style) {
            case "nothing": layout = compact ? R.layout.widget_nothing_s : R.layout.widget_nothing; break;
            case "github": layout = R.layout.widget_github; break;
            case "apple": layout = R.layout.widget_apple; break;
            case "samsung": layout = R.layout.widget_samsung; break;
            case "pastel": layout = R.layout.widget_pastel; break;
            case "neon": layout = R.layout.widget_neon; break;
            case "paper": layout = R.layout.widget_paper; break;
            case "terminal": layout = R.layout.widget_terminal; break;
            default: layout = R.layout.widget_next;
        }
        RemoteViews v = new RemoteViews(c.getPackageName(), layout);

        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        // background: colour + transparency, or none at all
        int alpha = Math.round(255 * (100 - Math.max(0, Math.min(100, f.transparency))) / 100f);
        // styles with a drawn background (gradient, border, paper lines) keep their own colours
        int drawn = 0;
        if ("pastel".equals(style)) drawn = dark ? R.drawable.wbg_pastel_dark : R.drawable.wbg_pastel_light;
        else if ("neon".equals(style)) drawn = dark ? R.drawable.wbg_neon_dark : R.drawable.wbg_neon_light;
        else if ("paper".equals(style)) drawn = dark ? R.drawable.wbg_paper_dark : R.drawable.wbg_paper_light;
        if (f.bg) {
            v.setViewVisibility(R.id.w_bg, View.VISIBLE);
            if (drawn != 0) v.setImageViewResource(R.id.w_bg, drawn);
            else v.setInt(R.id.w_bg, "setColorFilter", surface);
            v.setInt(R.id.w_bg, "setImageAlpha", alpha);
        } else v.setViewVisibility(R.id.w_bg, View.GONE);
        if ("terminal".equals(style)) {
            v.setViewVisibility(R.id.w_border, f.bg ? View.VISIBLE : View.GONE);
            v.setInt(R.id.w_border, "setColorFilter", accent);
            v.setInt(R.id.w_border, "setImageAlpha", Math.max(alpha, 90));
        }
        if ("github".equals(style)) {
            v.setViewVisibility(R.id.w_border, f.bg ? View.VISIBLE : View.GONE);
            v.setInt(R.id.w_border, "setColorFilter", border);
            v.setInt(R.id.w_border, "setImageAlpha", Math.max(alpha, 60));
        }

        // texts, slightly reworded per style
        String kicker = k.kicker, meta = k.meta, after = k.after;
        switch (style) {
            case "apple":
                if (k.empty) kicker = k.kicker;
                else if (compact) kicker = (k.running ? (k.en ? "NOW" : "JETZT") : k.kicker.split(" · ")[0]) + " · " + k.time;
                else kicker = k.running ? (k.en ? "NOW" : "JETZT") : k.kicker.split(" · ")[0];
                break;
            case "samsung": case "paper": kicker = sentence(k.kicker); break;   // only the status line: German nouns stay capitalised
            case "terminal":
                kicker = "$ " + k.kicker.toLowerCase(Locale.ROOT);
                if (!meta.isEmpty()) meta = "@ " + meta;
                if (!after.isEmpty()) after = "# " + after;
                break;
        }
        v.setTextViewText(R.id.w_kicker, kicker);
        v.setTextViewText(R.id.w_title, k.title);
        v.setTextViewText(R.id.w_meta, meta);
        v.setTextViewText(R.id.w_after, after);
        int kickColor = "nothing".equals(style) ? muted : accent;
        if ("apple".equals(style) && k.running) kickColor = dark ? 0xFFFF453A : 0xFFFF3B30;
        v.setTextColor(R.id.w_kicker, kickColor);
        v.setTextColor(R.id.w_title, ink);
        v.setTextColor(R.id.w_meta, muted);
        v.setTextColor(R.id.w_after, faint);
        v.setViewVisibility(R.id.w_meta, k.meta.isEmpty() ? View.GONE : View.VISIBLE);

        // style extras: big time, calendar bar, status pill, time bubble, neon colours
        boolean hasTime = !k.empty && !k.time.isEmpty();
        switch (style) {
            case "apple":
                v.setViewVisibility(R.id.w_time, hasTime && !compact ? View.VISIBLE : View.GONE);
                v.setTextViewText(R.id.w_time, k.time);
                v.setTextColor(R.id.w_time, ink);
                v.setInt(R.id.w_bar, "setColorFilter", accent);
                break;
            case "samsung":
                v.setInt(R.id.w_chipbg, "setColorFilter", accent);
                v.setInt(R.id.w_chipbg, "setImageAlpha", dark ? 70 : 38);
                break;
            case "pastel":
                v.setViewVisibility(R.id.w_time, hasTime ? View.VISIBLE : View.GONE);
                v.setViewVisibility(R.id.w_chipbg, hasTime ? View.VISIBLE : View.GONE);
                v.setTextViewText(R.id.w_time, k.time.replace("–", "\n"));
                v.setTextColor(R.id.w_time, accent);
                v.setInt(R.id.w_chipbg, "setColorFilter", surface);
                break;
            case "neon":
                v.setTextColor(R.id.w_meta, dark ? 0xFF2DE2E6 : 0xFF00A6B8);
                break;
        }

        // ---- fit to the height: fewer lines and less padding on flat widgets
        boolean bigTop = "apple".equals(style) || "samsung".equals(style) || "nothing".equals(style);   // these have an extra line on top
        boolean showAfter = !after.isEmpty() && (hDp == 0 || hDp >= (bigTop ? 165 : 135));
        v.setViewVisibility(R.id.w_after, showAfter ? View.VISIBLE : View.GONE);
        v.setInt(R.id.w_title, "setMaxLines", tall ? 2 : 1);
        if (compact && "nothing".equals(style)) v.setViewVisibility(R.id.w_meta, View.GONE);
        if (compact && "samsung".equals(style)) v.setTextViewTextSize(R.id.w_title, android.util.TypedValue.COMPLEX_UNIT_SP, 16);
        int[] pad = padding(style);                           // left, top, right, bottom in dp
        if (compact) { pad[1] = Math.min(pad[1], 8); pad[3] = Math.min(pad[3], 8); }
        float d = c.getResources().getDisplayMetrics().density;
        v.setViewPadding(R.id.w_box, Math.round(pad[0] * d), Math.round(pad[1] * d), Math.round(pad[2] * d), Math.round(pad[3] * d));

        if ("nothing".equals(style)) {
            v.setInt(R.id.w_dot, "setColorFilter", k.running ? accent : ink);
            if (!k.empty && !k.time.isEmpty()) {
                v.setViewVisibility(R.id.w_time, View.VISIBLE);
                v.setImageViewBitmap(R.id.w_time, dotText(c, k.time, ink));
            } else v.setViewVisibility(R.id.w_time, View.GONE);
        } else if ("standard".equals(style) || "github".equals(style)) {
            v.setInt(R.id.w_bar, "setBackgroundColor", accent);
        }
        return v;
    }

    private static Typeface doto;
    /** the time in the dot-matrix font (widgets can't use custom fonts, so it is drawn as an image) */
    static Bitmap dotText(Context c, String s, int color) {
        if (doto == null) {
            try { doto = Typeface.createFromAsset(c.getAssets(), "doto.ttf"); } catch (Exception e) { doto = Typeface.MONOSPACE; }
        }
        float px = 30 * c.getResources().getDisplayMetrics().density;
        Paint pt = new Paint(Paint.ANTI_ALIAS_FLAG);
        pt.setTypeface(doto); pt.setTextSize(px); pt.setColor(color);
        Paint.FontMetrics fm = pt.getFontMetrics();
        int w = (int) Math.ceil(pt.measureText(s)) + 4, h = (int) Math.ceil(fm.descent - fm.ascent) + 2;
        Bitmap b = Bitmap.createBitmap(Math.max(1, w), Math.max(1, h), Bitmap.Config.ARGB_8888);
        new Canvas(b).drawText(s, 2, -fm.ascent + 1, pt);
        return b;
    }

    private static String hm(ZonedDateTime z) { return z.format(DateTimeFormatter.ofPattern("HH:mm")); }

    private static String dayLabel(ZonedDateTime z, boolean en) {
        LocalDate d = z.toLocalDate(), today = LocalDate.now(ZH);
        if (d.equals(today)) return en ? "TODAY" : "HEUTE";
        if (d.equals(today.plusDays(1))) return en ? "TOMORROW" : "MORGEN";
        String[] de = {"MO", "DI", "MI", "DO", "FR", "SA", "SO"}, enD = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"};
        return (en ? enD : de)[z.getDayOfWeek().getValue() - 1] + " " + d.getDayOfMonth() + "." + d.getMonthValue() + ".";
    }

    /** inner padding of each layout (dp): left, top, right, bottom */
    private static int[] padding(String style) {
        switch (style) {
            case "apple": case "neon": return new int[]{16, 16, 16, 16};
            case "samsung": return new int[]{20, 14, 20, 14};
            case "nothing": return new int[]{18, 12, 18, 12};
            case "paper": return new int[]{38, 12, 14, 12};
            default: return new int[]{14, 14, 14, 14};
        }
    }

    /** "HEUTE · 13:00" → "Heute · 13:00" (for the styles that don't shout) */
    private static String sentence(String s) {
        if (s == null || s.isEmpty()) return "";
        String low = s.toLowerCase(Locale.ROOT);
        return Character.toUpperCase(low.charAt(0)) + low.substring(1);
    }

    private static String join(String a, String b) {
        if (a.isEmpty()) return b;
        if (b.isEmpty()) return a;
        return a + " · " + b;
    }
}
