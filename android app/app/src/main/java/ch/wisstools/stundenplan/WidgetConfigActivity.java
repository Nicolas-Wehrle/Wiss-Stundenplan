package ch.wisstools.stundenplan;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;

/** Widget settings (shown when the widget is added, and via long-press → settings on Android 12+):
 *  style, background on/off, light/dark/phone, transparency – with a live preview. */
public class WidgetConfigActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private NextLessonWidget.Cfg cfg;
    private FrameLayout preview;
    private boolean en, dark;
    private int ink, muted, surface, line, accent;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Bundle ex = getIntent().getExtras();
        if (ex != null) widgetId = ex.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_CANCELED, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }

        cfg = NextLessonWidget.Cfg.load(this, widgetId);
        en = "en".equals(getSharedPreferences(Notifs.PREFS, MODE_PRIVATE).getString("lang", "de"));
        dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        ink = getColor(R.color.ink); muted = getColor(R.color.muted); surface = getColor(R.color.surface);
        line = dark ? 0xFF2D2D33 : 0xFFE7E5E1; accent = getColor(R.color.accent);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(getColor(R.color.bg));
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(18);
        col.setPadding(pad, dp(22), pad, dp(18));
        scroll.addView(col);

        TextView h = text(t("Widget-Einstellungen", "Widget settings"), 24, ink, true);
        col.addView(h);

        // preview on a "wallpaper"
        FrameLayout stage = new FrameLayout(this);
        GradientDrawable wall = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF4B4A55, 0xFF8C7A68, 0xFFC9B79C});
        wall.setCornerRadius(dp(28));
        stage.setBackground(wall);
        stage.setPadding(dp(16), dp(26), dp(16), dp(26));
        preview = new FrameLayout(this);
        stage.addView(preview, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(previewHeight())));
        col.addView(stage, lp(dp(16), dp(18)));

        // style
        col.addView(label(t("Stil", "Style")));
        RadioGroup styles = group(new String[]{"app", "standard", "apple", "samsung", "nothing", "github", "pastel", "neon", "paper", "terminal"},
                new String[]{t("Wie in der App", "Same as the app"), "Standard", "Apple", "Samsung", "Nothing", "GitHub", t("Pastell", "Pastel"), "Neon", t("Papier", "Paper"), "Terminal"}, cfg.style,
                (v) -> { cfg.style = v; refresh(); });
        col.addView(card(styles), lp(0, 0));

        // background on/off
        LinearLayout bgRow = new LinearLayout(this);
        bgRow.setGravity(Gravity.CENTER_VERTICAL);
        bgRow.setPadding(dp(16), dp(6), dp(12), dp(6));
        TextView bgL = text(t("Hintergrund", "Background"), 17, ink, false);
        bgRow.addView(bgL, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        Switch sw = new Switch(this);
        sw.setChecked(cfg.bg);
        bgRow.addView(sw);
        col.addView(card(bgRow), lp(dp(14), 0));

        // colour
        col.addView(label(t("Hintergrundfarbe", "Background colour")));
        RadioGroup modes = group(new String[]{"system", "light", "dark"},
                new String[]{t("Wie Telefon", "Match phone setting"), t("Hell", "Light"), t("Dunkel", "Dark")}, cfg.mode,
                (v) -> { cfg.mode = v; refresh(); });
        col.addView(card(modes), lp(0, 0));

        // transparency
        col.addView(label(t("Transparenz", "Transparency")));
        LinearLayout tr = new LinearLayout(this);
        tr.setGravity(Gravity.CENTER_VERTICAL);
        tr.setPadding(dp(10), dp(12), dp(16), dp(12));
        SeekBar seek = new SeekBar(this);
        seek.setMax(100);
        seek.setProgress(cfg.transparency);
        TextView pct = text(cfg.transparency + " %", 15, muted, false);
        pct.setMinWidth(dp(48));
        pct.setGravity(Gravity.END);
        tr.addView(seek, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        tr.addView(pct);
        col.addView(card(tr), lp(0, 0));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar s, int p, boolean u) { cfg.transparency = p; pct.setText(p + " %"); refresh(); }
            @Override public void onStartTrackingTouch(SeekBar s) { }
            @Override public void onStopTrackingTouch(SeekBar s) { }
        });
        sw.setOnCheckedChangeListener((CompoundButton x, boolean on) -> {
            cfg.bg = on;
            for (View vv : new View[]{modes, seek}) vv.setAlpha(on ? 1f : .45f);
            refresh();
        });
        modes.setAlpha(cfg.bg ? 1f : .45f); seek.setAlpha(cfg.bg ? 1f : .45f);

        TextView hint = text(t("Der Text passt sich der Farbe an. Ohne Hintergrund gilt „Hintergrundfarbe“ für den Text.",
                "Text adapts to the colour. Without a background, “Background colour” sets the text colour."), 13, muted, false);
        col.addView(hint, lp(dp(10), 0));

        // buttons
        LinearLayout btns = new LinearLayout(this);
        btns.setGravity(Gravity.CENTER);
        Button cancel = button(t("Abbrechen", "Cancel"), false);
        Button save = button(t("Speichern", "Save"), true);
        btns.addView(cancel, new LinearLayout.LayoutParams(0, dp(50), 1));
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(0, dp(50), 1);
        sp.setMarginStart(dp(12));
        btns.addView(save, sp);
        col.addView(btns, lp(dp(22), 0));
        cancel.setOnClickListener((v) -> finish());
        save.setOnClickListener((v) -> {
            cfg.save(this, widgetId);
            AppWidgetManager m = AppWidgetManager.getInstance(this);
            NextLessonWidget.render(this, m, new int[]{widgetId});
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
            finish();
        });

        setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v, in) -> {
            int top = in.getSystemWindowInsetTop(), bot = in.getSystemWindowInsetBottom();
            col.setPadding(pad, dp(22) + top, pad, dp(18) + bot);
            return in;
        });
        refresh();
    }

    private void refresh() {
        preview.removeAllViews();
        try {
            View v = NextLessonWidget.build(this, cfg, NextLessonWidget.content(this), previewHeight()).apply(this, preview);
            preview.addView(v, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        } catch (Exception e) {
            preview.addView(text(e.getMessage() == null ? "Preview" : e.getMessage(), 13, Color.WHITE, false));
        }
    }

    /** the preview has the same height as the widget on the home screen */
    private int previewHeight() {
        try { int h = AppWidgetManager.getInstance(this).getAppWidgetOptions(widgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0); if (h > 0) return h; } catch (Exception ignored) { }
        return 124;
    }

    // ---------- small UI helpers ----------
    private String t(String de, String eng) { return en ? eng : de; }
    private int dp(int v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private TextView label(String s) {
        TextView t = text(s, 14, muted, true);
        t.setPadding(dp(6), dp(20), 0, dp(8));
        return t;
    }

    private LinearLayout.LayoutParams lp(int top, int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = top; p.bottomMargin = bottom;
        return p;
    }

    private View card(View inner) {
        FrameLayout f = new FrameLayout(this);
        GradientDrawable d = new GradientDrawable();
        d.setColor(surface); d.setCornerRadius(dp(22));
        f.setBackground(d);
        f.addView(inner);
        return f;
    }

    interface Pick { void on(String v); }

    private RadioGroup group(String[] values, String[] labels, String current, Pick pick) {
        RadioGroup g = new RadioGroup(this);
        g.setPadding(dp(8), dp(4), dp(8), dp(4));
        for (int i = 0; i < values.length; i++) {
            RadioButton r = new RadioButton(this);
            r.setId(View.generateViewId());
            r.setText(labels[i]);
            r.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            r.setTextColor(ink);
            r.setPadding(dp(10), dp(14), dp(8), dp(14));
            r.setTag(values[i]);
            if (i > 0) {
                View sep = new View(this);
                sep.setBackgroundColor(line);
                RadioGroup.LayoutParams sl = new RadioGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1);
                sl.setMarginStart(dp(48));
                g.addView(sep, sl);
            }
            g.addView(r);
            if (values[i].equals(current)) r.setChecked(true);
        }
        g.setOnCheckedChangeListener((gr, id) -> { View r = gr.findViewById(id); if (r != null) pick.on((String) r.getTag()); });
        return g;
    }

    private Button button(String s, boolean primary) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(primary ? Color.WHITE : accent);
        GradientDrawable d = new GradientDrawable();
        d.setCornerRadius(dp(25));
        d.setColor(primary ? accent : surface);
        b.setBackground(d);
        b.setStateListAnimator(null);
        return b;
    }
}
