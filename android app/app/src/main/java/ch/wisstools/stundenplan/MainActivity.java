package ch.wisstools.stundenplan;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * WISS Stundenplan – Android shell.
 *
 * The UI and logic are the same files as the browser add-on (assets/web). They are served
 * under https://wiss.tocco.ch/__wissapp/ so that the page is "same-origin" with Tocco and
 * its API calls automatically carry the WebView's login cookies.
 *
 * Instead of browser tabs/windows, the add-on code gets:
 *  - hidden WebViews (silent Microsoft re-login, reading teacher names), and
 *  - a visible login screen (first sign-in).
 * See assets/web/app-shim.js for the JavaScript side of this bridge.
 */
public class MainActivity extends Activity {

    static final String ORIGIN = "https://wiss.tocco.ch";
    static final String APP = ORIGIN + "/__wissapp/";
    static final String START = APP + "popup.html";
    static final Set<String> PROXY_HOSTS = Set.of("www.modulbaukasten.ch", "ictbb.crm17.dynamics.com");

    final Handler ui = new Handler(Looper.getMainLooper());
    final Map<Integer, Tab> tabs = new ConcurrentHashMap<>();
    final AtomicInteger nextId = new AtomicInteger(1);

    FrameLayout root;
    WebView main;
    Store store;
    String contentJs = "";

    static class Tab {
        int id;
        WebView view;
        View container;          // what was added to root (view itself, or bar+view for login)
        boolean visible;
        volatile String url = "";
        volatile String status = "loading";
    }

    // ------------------------------------------------------------------ lifecycle

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable);

        store = new Store(getFilesDir());
        contentJs = readAsset("web/content.js");

        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.surface));
        setContentView(root);
        applyInsets();

        CookieManager.getInstance().setAcceptCookie(true);
        restoreSessionCookies();

        main = newWebView();
        main.addJavascriptInterface(new Host(), "AndroidHost");
        main.addJavascriptInterface(new StoreBridge(), "AndroidStore");
        main.setWebViewClient(new MainClient());
        root.addView(main, match());
        main.loadUrl(START);
        ui.postDelayed(() -> openTabFrom(getIntent()), 1500);   // opened from a notification
    }

    // ---------- app update ----------
    private long updateDownload = -1;
    private android.content.BroadcastReceiver updateReceiver;

    private void downloadAndInstall(String url) {
        android.app.DownloadManager dm = getSystemService(android.app.DownloadManager.class);
        java.io.File old = new java.io.File(getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS), "update.apk");
        if (old.exists()) old.delete();
        android.app.DownloadManager.Request rq = new android.app.DownloadManager.Request(Uri.parse(url))
                .setTitle("WISS Stundenplan")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(this, android.os.Environment.DIRECTORY_DOWNLOADS, "update.apk");
        updateDownload = dm.enqueue(rq);
        if (updateReceiver == null) {
            updateReceiver = new android.content.BroadcastReceiver() {
                @Override public void onReceive(android.content.Context c, Intent i) {
                    long id = i.getLongExtra(android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id != updateDownload) return;
                    Uri apk = dm.getUriForDownloadedFile(id);
                    if (apk == null) { toMain("window.__appUpdateFailed && window.__appUpdateFailed()"); return; }
                    Intent install = new Intent(Intent.ACTION_VIEW)
                            .setDataAndType(apk, "application/vnd.android.package-archive")
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    try { startActivity(install); } catch (Exception e) { toMain("window.__appUpdateFailed && window.__appUpdateFailed()"); }
                }
            };
            android.content.IntentFilter f = new android.content.IntentFilter(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(updateReceiver, f, android.content.Context.RECEIVER_EXPORTED);
            else registerReceiver(updateReceiver, f);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (main != null) main.evaluateJavascript("window.__appPermission && window.__appPermission('" + (Notifs.permitted(this) ? "granted" : "denied") + "')", null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openTabFrom(intent);
    }

    private void openTabFrom(Intent intent) {
        String tab = intent == null ? null : intent.getStringExtra("tab");
        if (tab != null && tab.matches("[a-z]+") && main != null)
            main.evaluateJavascript("window.__appOpenTab && window.__appOpenTab('" + tab + "')", null);
    }

        @Override
    protected void onResume() {
        super.onResume();
        if (main != null) main.evaluateJavascript("window.__appResume && window.__appResume()", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        saveSessionCookies();
        CookieManager.getInstance().flush();
    }

    // Android drops session cookies when it closes the app in the background, so the school
    // login was gone after a few minutes. Keep a copy of the wiss.tocco.ch cookies and put them
    // back on the next start (the server still decides whether the session is valid).
    private void saveSessionCookies() {
        String c = CookieManager.getInstance().getCookie(ORIGIN);
        if (c != null && !c.isEmpty())
            getSharedPreferences("session", MODE_PRIVATE).edit().putString("tocco", c).putLong("at", System.currentTimeMillis()).apply();
    }

    private void restoreSessionCookies() {
        android.content.SharedPreferences sp = getSharedPreferences("session", MODE_PRIVATE);
        String saved = sp.getString("tocco", null);
        if (saved == null || System.currentTimeMillis() - sp.getLong("at", 0) > 12L * 3600 * 1000) return;
        CookieManager cm = CookieManager.getInstance();
        String now = cm.getCookie(ORIGIN);
        for (String part : saved.split(";")) {
            String kv = part.trim();
            int eq = kv.indexOf('=');
            if (eq <= 0) continue;
            String name = kv.substring(0, eq);
            if (now != null && (("; " + now).contains("; " + name + "="))) continue;   // still there
            cm.setCookie(ORIGIN, kv + "; Path=/; Secure; HttpOnly; Max-Age=43200");
        }
        cm.flush();
    }

    @Override
    protected void onDestroy() {
        if (updateReceiver != null) { try { unregisterReceiver(updateReceiver); } catch (Exception e) { } }
        for (Tab t : tabs.values()) destroyTab(t);
        if (main != null) main.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        for (Tab t : tabs.values()) {
            if (t.visible) { closeTab(t.id); return; }
        }
        main.evaluateJavascript("window.__appBack ? window.__appBack() : false", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    // Android 15 draws edge-to-edge: keep content clear of status/navigation bars and keyboard.
    private void applyInsets() {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets in = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                l = in.left; t = in.top; r = in.right; b = in.bottom;
                v.setPadding(l, t, r, b);
                return WindowInsets.CONSUMED;
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop();
                r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
                v.setPadding(l, t, r, b);
                return insets.consumeSystemWindowInsets();
            }
        });
    }

    // ------------------------------------------------------------------ web views

    private WebView newWebView() {
        WebView w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        w.setBackgroundColor(getColor(R.color.bg));
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);   // Microsoft login needs this
        return w;
    }

    private static FrameLayout.LayoutParams match() {
        return new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    /** The app's own page: serves assets and proxies modulbaukasten requests. */
    class MainClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            String url = req.getUrl().toString();
            if (!url.startsWith(APP)) return null;                       // normal Tocco request → network + cookies
            String path = req.getUrl().getPath().substring("/__wissapp/".length());
            if (path.equals("proxy")) return proxy(req);
            return asset(path);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            String url = req.getUrl().toString();
            if (url.startsWith(APP)) return false;
            openExternal(url);                                           // e.g. module PDFs → real browser
            return true;
        }
    }

    /** Hidden tabs (silent login, teacher names) and the visible login screen. */
    class TabClient extends WebViewClient {
        final Tab t;
        TabClient(Tab t) { this.t = t; }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            t.url = url; t.status = "loading";
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            t.url = url; t.status = "complete";
            if (url.startsWith(ORIGIN + "/extranet")) {
                // equivalent of the add-on's content script
                view.evaluateJavascript("if(!window.__wissInjected){window.__wissInjected=1;" +
                        "window.chrome={runtime:{sendMessage:function(m){try{AndroidTab.message(JSON.stringify(m))}catch(e){}return Promise.resolve();}}};\n" +
                        contentJs + "\n}", null);
                // first sign-in finished → back to the app
                if (t.visible && url.contains("openidStatus=successful")) ui.postDelayed(() -> closeTab(t.id), 1500);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            String scheme = req.getUrl().getScheme();
            return !("https".equals(scheme) || "http".equals(scheme));   // ignore intent:, msauth: etc.
        }
    }

    private void createTab(Tab t, String url, boolean visible) {
        WebView w = newWebView();
        t.view = w;
        t.visible = visible;
        w.addJavascriptInterface(new TabBridge(t), "AndroidTab");
        w.setWebViewClient(new TabClient(t));
        if (visible) {
            LinearLayout box = new LinearLayout(this);
            box.setOrientation(LinearLayout.VERTICAL);
            box.setBackgroundColor(getColor(R.color.surface));
            LinearLayout bar = new LinearLayout(this);
            bar.setGravity(Gravity.CENTER_VERTICAL);
            int pad = dp(12);
            bar.setPadding(pad, dp(6), dp(6), dp(6));
            TextView title = new TextView(this);
            title.setText("Mit WISS-Konto anmelden");
            title.setTextColor(getColor(R.color.ink));
            title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
            bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            Button done = new Button(this);
            done.setText("Fertig");
            done.setTextColor(Color.WHITE);
            done.setBackgroundColor(getColor(R.color.accent));
            done.setOnClickListener(v -> closeTab(t.id));
            bar.addView(done);
            box.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            box.addView(w, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
            t.container = box;
            root.addView(box, match());                                   // on top
        } else {
            t.container = w;
            root.addView(w, 0, match());                                  // behind the app – rendered, but not visible
        }
        w.loadUrl(url);
    }

    private void closeTab(int id) {
        Tab t = tabs.remove(id);
        if (t != null) destroyTab(t);
        main.evaluateJavascript("window.__appTabClosed && window.__appTabClosed(" + id + ")", null);
    }

    private void destroyTab(Tab t) {
        if (t.container != null) root.removeView(t.container);
        if (t.view != null) { t.view.stopLoading(); t.view.destroy(); }
    }

    private void toMain(String js) {
        ui.post(() -> { if (main != null) main.evaluateJavascript(js, null); });
    }

    // ------------------------------------------------------------------ JS bridges

    /** window.AndroidHost – used by app-shim.js in the app page. */
    class Host {
        @JavascriptInterface
        public int tabCreate(String url, boolean active) {
            Tab t = new Tab();
            t.id = nextId.getAndIncrement();
            t.url = url;
            tabs.put(t.id, t);
            ui.post(() -> createTab(t, url, active));
            return t.id;
        }

        @JavascriptInterface
        public void tabUpdate(int id, String url) {
            ui.post(() -> {
                Tab t = tabs.get(id);
                if (t != null && t.view != null) { t.url = url; t.status = "loading"; t.view.loadUrl(url); }
            });
        }

        @JavascriptInterface
        public void tabRemove(int id) { ui.post(() -> closeTab(id)); }

        @JavascriptInterface
        public String tabInfo(int id) {
            Tab t = tabs.get(id);
            if (t == null) return "";
            try {
                return new JSONObject().put("id", id).put("url", t.url).put("status", t.status).toString();
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void exec(int id, int callId, String code) {
            ui.post(() -> {
                Tab t = tabs.get(id);
                if (t == null || t.view == null) {
                    main.evaluateJavascript("window.__hostResult(" + callId + "," + JSONObject.quote("{\"error\":\"tab closed\"}") + ")", null);
                } else {
                    t.view.evaluateJavascript(code, null);
                }
            });
        }

        @JavascriptInterface
        public void openExternal(String url) { MainActivity.this.openExternal(url); }

        // ---- notifications + widget ----
        @JavascriptInterface
        public void notify(String id, String title, String body) { Notifs.show(MainActivity.this, id, title, body); }

        @JavascriptInterface
        public void schedule(String planJson) { Notifs.schedule(MainActivity.this, planJson); }

        @JavascriptInterface
        public void setLang(String lang) {
            getSharedPreferences(Notifs.PREFS, MODE_PRIVATE).edit().putString("lang", lang).apply();
        }

        @JavascriptInterface
        public String notifPermission() { return Notifs.permitted(MainActivity.this) ? "granted" : "denied"; }

        @JavascriptInterface
        public void requestNotifPermission() {
            if (Build.VERSION.SDK_INT >= 33 && !Notifs.permitted(MainActivity.this))
                ui.post(() -> requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 7));
        }

        @JavascriptInterface
        public void widgetData(String json) { NextLessonWidget.save(MainActivity.this, json); }

        /** Downloads the new APK from the GitHub release and opens Android's install screen. */
        @JavascriptInterface
        public void installUpdate(String url) {
            if (url == null || !url.startsWith("https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/")) return;   // only our own releases
            ui.post(() -> downloadAndInstall(url));
        }
    }

    /** window.AndroidTab – inside hidden/login WebViews. */
    class TabBridge {
        final Tab t;
        TabBridge(Tab t) { this.t = t; }

        @JavascriptInterface
        public void result(int callId, String json) {
            toMain("window.__hostResult(" + callId + "," + JSONObject.quote(json) + ")");
        }

        @JavascriptInterface
        public void message(String json) {
            if (!t.url.startsWith(ORIGIN + "/")) return;                 // only the school site may talk to the app
            toMain("window.__hostMessage(" + JSONObject.quote(json) + "," + t.id + ")");
        }
    }

    /** window.AndroidStore – persistent storage (replaces chrome.storage.local). */
    class StoreBridge {
        @JavascriptInterface public String get(String keysJson) { return store.get(keysJson); }
        @JavascriptInterface public void set(String json) { store.set(json); }
        @JavascriptInterface public void clear() { store.clear(); }
    }

    // ------------------------------------------------------------------ helpers

    private WebResourceResponse asset(String path) {
        if (path.isEmpty() || path.contains("..")) path = "popup.html";
        try {
            InputStream in = getAssets().open("web/" + path);
            WebResourceResponse r = new WebResourceResponse(mime(path), "utf-8", in);
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-store");
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(),
                    new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /** /__wissapp/proxy?u=… → fetch modulbaukasten.ch natively (no CORS in the way). */
    private WebResourceResponse proxy(WebResourceRequest req) {
        Map<String, String> outHeaders = new HashMap<>();
        outHeaders.put("Cache-Control", "no-store");
        try {
            String target = req.getUrl().getQueryParameter("u");
            Uri u = Uri.parse(target);
            if (!"https".equals(u.getScheme()) || !PROXY_HOSTS.contains(u.getHost())) throw new IOException("host not allowed");
            HttpURLConnection c = (HttpURLConnection) new URL(target).openConnection();
            c.setConnectTimeout(20000);
            c.setReadTimeout(30000);
            for (Map.Entry<String, String> e : req.getRequestHeaders().entrySet()) {
                String k = e.getKey().toLowerCase();
                if (k.equals("authorization") || k.equals("accept") || k.equals("odata-version") || k.equals("prefer"))
                    c.setRequestProperty(e.getKey(), e.getValue());
            }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            byte[] body = in != null ? readAll(in) : new byte[0];
            String ct = c.getContentType() != null ? c.getContentType().split(";")[0] : "application/json";
            String reason = c.getResponseMessage() != null && !c.getResponseMessage().isEmpty() ? c.getResponseMessage() : "OK";
            return new WebResourceResponse(ct, "utf-8", code, reason, outHeaders, new ByteArrayInputStream(body));
        } catch (Exception e) {
            byte[] msg = ("{\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}").getBytes(StandardCharsets.UTF_8);
            return new WebResourceResponse("application/json", "utf-8", 502, "Bad Gateway", outHeaders, new ByteArrayInputStream(msg));
        }
    }

    private void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        } catch (IOException e) { return ""; }
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
