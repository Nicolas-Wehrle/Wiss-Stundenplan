//! WISS Stundenplan – desktop shell (Windows, macOS, Linux).
//!
//! Same idea as the Android app: the UI and logic are the add-on's own files (web/, built by
//! build-desktop-web.py). web/desktop-shim.js gives them the `chrome.*` APIs they expect and
//! talks to this file:
//!  - storage → one JSON file (store.rs)
//!  - tabs → extra webview windows, normally hidden (silent Microsoft sign-in, teacher names,
//!    and a "bridge" page on wiss.tocco.ch through which the school's API is called, so the
//!    requests carry the sign-in cookies exactly like in a browser)
//!  - notifications, reminders, tray icon, start with the computer, updates
//!
//! The app never sees or types a password: Microsoft's own page does the sign-in.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod store;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

const ORIGIN: &str = "https://wiss.tocco.ch";
/// content.js of the add-on, run in the extranet pages (presses the "WISS Office 365" button etc.)
const CONTENT_JS: &str = include_str!("../../web/content.js");

/// In every tab window: the way back to the app (only allowed on wiss.tocco.ch, see capabilities/).
const TAB_INIT: &str = r#"
window.__wissTab = {
  result: function (id, json) { try { window.__TAURI_INTERNALS__.invoke('tab_result', { call: id, json: json }); } catch (e) {} },
  message: function (json) { try { window.__TAURI_INTERNALS__.invoke('tab_message', { json: json }); } catch (e) {} }
};
"#;

struct Tab {
    url: String,
    status: &'static str,
    visible: bool,
    internal: bool,
}

#[derive(Deserialize, Clone)]
struct Reminder {
    id: String,
    at: f64,
    #[serde(default)]
    title: String,
    #[serde(default)]
    body: String,
}

struct TrayItems {
    next: MenuItem<tauri::Wry>,
    open: MenuItem<tauri::Wry>,
    refresh: MenuItem<tauri::Wry>,
    mini: CheckMenuItem<tauri::Wry>,
    auto: CheckMenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
}

struct Host {
    store: store::Store,
    tabs: Mutex<HashMap<u32, Tab>>,
    next_tab: AtomicU32,
    lang: Mutex<String>,
    widget: Mutex<Value>,
    plan: Mutex<Vec<Reminder>>,
    fired: Mutex<HashSet<String>>,
    plan_path: std::path::PathBuf,
    win_path: std::path::PathBuf,
    quitting: AtomicBool,
    start_hidden: bool,
    has_tray: AtomicBool,
    tray: Mutex<Option<TrayItems>>,
    http: reqwest::Client,
    zoom: Mutex<f64>,
}

fn now_ms() -> f64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as f64).unwrap_or(0.0)
}

fn en(h: &Host) -> bool {
    h.lang.lock().unwrap().as_str() == "en"
}

/// Runs JavaScript in the app page.
fn to_main(app: &AppHandle, js: &str) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval(js);
    }
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        let _ = w.eval("window.__appResume && window.__appResume()");
    }
}

fn hide_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval("window.__appFlush && window.__appFlush()");
        save_window(app, &w);
        let _ = w.hide();
    }
}

// ------------------------------------------------------------------ storage

#[tauri::command]
fn store_load(h: State<Host>) -> Value {
    h.store.snapshot()
}

#[tauri::command]
fn store_set(h: State<Host>, patch: Map<String, Value>) {
    h.store.merge(patch);
}

#[tauri::command]
fn store_replace(h: State<Host>, data: Map<String, Value>) {
    h.store.replace(data);
}

// ------------------------------------------------------------------ tabs (extra webviews)

fn tab_id(label: &str) -> Option<u32> {
    label.strip_prefix("tab-").and_then(|s| s.parse().ok())
}

#[tauri::command]
async fn tab_create(app: AppHandle, h: State<'_, Host>, url: String, active: bool, internal: Option<bool>) -> Result<u32, String> {
    let target: Url = url.parse().map_err(|_| "bad url".to_string())?;
    if target.scheme() != "https" {
        return Err("https only".into());
    }
    let id = h.next_tab.fetch_add(1, Ordering::SeqCst);
    h.tabs.lock().unwrap().insert(id, Tab { url: url.clone(), status: "loading", visible: active, internal: internal.unwrap_or(false) });
    let title = if en(&h) { "Sign in with your WISS account" } else { "Mit WISS-Konto anmelden" };
    let handle = app.clone();
    let built = WebviewWindowBuilder::new(&app, format!("tab-{id}"), WebviewUrl::External(target))
        .title(title)
        .inner_size(500.0, 720.0)
        .center()
        .visible(active)
        .focused(active)
        .skip_taskbar(!active)
        .initialization_script(TAB_INIT)
        .on_navigation(|u| matches!(u.scheme(), "https" | "http" | "about" | "blob" | "data"))
        .on_page_load(move |w, p| on_tab_load(&handle, id, &w, p.event(), p.url().as_str()))
        .build();
    match built {
        Ok(_) => Ok(id),
        Err(e) => {
            h.tabs.lock().unwrap().remove(&id);
            Err(e.to_string())
        }
    }
}

fn on_tab_load(app: &AppHandle, id: u32, w: &WebviewWindow, ev: PageLoadEvent, url: &str) {
    #[cfg(debug_assertions)]
    eprintln!("tab {id} {ev:?} {url}");
    let h = app.state::<Host>();
    let visible = {
        let mut tabs = h.tabs.lock().unwrap();
        let Some(t) = tabs.get_mut(&id) else { return };
        t.url = url.to_string();
        t.status = if matches!(ev, PageLoadEvent::Finished) { "complete" } else { "loading" };
        t.visible
    };
    if !matches!(ev, PageLoadEvent::Finished) || !url.starts_with(&format!("{ORIGIN}/extranet")) {
        return;
    }
    // the add-on's content script, once per page
    let _ = w.eval(format!(
        "if(!window.__wissInjected){{window.__wissInjected=1;window.chrome=Object.assign(window.chrome||{{}},{{runtime:{{sendMessage:function(m){{try{{window.__wissTab.message(JSON.stringify(m))}}catch(e){{}}return Promise.resolve();}}}}}});\n{CONTENT_JS}\n}}"
    ));
    // first sign-in finished in the visible window → back to the app
    if visible && url.contains("openidStatus=successful") {
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(1500));
            close_tab(&app, id);
        });
    }
}

fn close_tab(app: &AppHandle, id: u32) {
    match app.get_webview_window(&format!("tab-{id}")) {
        Some(w) => {
            let _ = w.destroy(); // → WindowEvent::Destroyed does the rest
        }
        None => {
            tab_gone(app, id);
        }
    }
}

fn tab_gone(app: &AppHandle, id: u32) {
    let h = app.state::<Host>();
    let removed = h.tabs.lock().unwrap().remove(&id);
    if let Some(t) = removed {
        if !t.internal {
            to_main(app, &format!("window.__appTabClosed && window.__appTabClosed({id})"));
        }
    }
}

#[tauri::command]
fn tab_info(h: State<Host>, id: u32) -> Option<Value> {
    h.tabs.lock().unwrap().get(&id).map(|t| json!({ "id": id, "url": t.url, "status": t.status }))
}

#[tauri::command]
fn tab_update(app: AppHandle, h: State<Host>, id: u32, url: String) -> Result<(), String> {
    let target: Url = url.parse().map_err(|_| "bad url".to_string())?;
    if let Some(t) = h.tabs.lock().unwrap().get_mut(&id) {
        t.url = url.clone();
        t.status = "loading";
    }
    if let Some(w) = app.get_webview_window(&format!("tab-{id}")) {
        w.navigate(target).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Microsoft needs you: bring the (so far hidden) sign-in window to the front.
#[tauri::command]
fn tab_show(app: AppHandle, h: State<Host>, id: u32) {
    if let Some(t) = h.tabs.lock().unwrap().get_mut(&id) {
        t.visible = true;
    }
    if let Some(w) = app.get_webview_window(&format!("tab-{id}")) {
        let _ = w.set_skip_taskbar(false);
        let _ = w.center();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[tauri::command]
fn tab_remove(app: AppHandle, id: u32) {
    close_tab(&app, id);
}

#[tauri::command]
fn tab_exec(app: AppHandle, id: u32, call: u32, code: String) {
    match app.get_webview_window(&format!("tab-{id}")) {
        Some(w) if w.eval(&code).is_ok() => {}
        _ => to_main(&app, &format!("window.__hostResult({call},{})", json!(r#"{"error":"tab closed"}"#))),
    }
}

/// Result of a script run in a tab (only callable from wiss.tocco.ch pages).
#[tauri::command]
fn tab_result(app: AppHandle, call: u32, json: String) {
    #[cfg(debug_assertions)]
    eprintln!("result {call}: {}", json.chars().take(120).collect::<String>());
    to_main(&app, &format!("window.__hostResult({call},{})", Value::String(json)));
}

/// Message from the add-on's content script (only callable from wiss.tocco.ch pages).
#[tauri::command]
fn tab_message(app: AppHandle, webview: tauri::Webview, json: String) {
    let Some(id) = tab_id(webview.label()) else { return };
    #[cfg(debug_assertions)]
    eprintln!("message from tab {id}: {json}");
    let ok = webview.url().map(|u| u.as_str().starts_with(&format!("{ORIGIN}/"))).unwrap_or(false);
    if ok {
        to_main(&app, &format!("window.__hostMessage({},{id})", Value::String(json)));
    }
}

// ------------------------------------------------------------------ requests that a page can't make (CORS)

#[derive(Deserialize)]
struct HttpReq {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
}

#[derive(Serialize)]
struct HttpRes {
    status: u16,
    status_text: String,
    headers: Vec<(String, String)>,
    body: String,
}

/// Module catalog, the sync server and GitHub. Fixed list of hosts, https only, no cookies.
fn allowed_host(u: &Url) -> bool {
    let host = u.host_str().unwrap_or("");
    u.scheme() == "https"
        && (matches!(host, "www.modulbaukasten.ch" | "ictbb.crm17.dynamics.com" | "api.github.com") || host.ends_with(".onrender.com"))
}

#[tauri::command]
async fn http(h: State<'_, Host>, req: HttpReq) -> Result<HttpRes, String> {
    let url: Url = req.url.parse().map_err(|_| "bad url".to_string())?;
    if !allowed_host(&url) {
        return Err("host not allowed".into());
    }
    let method = reqwest::Method::from_bytes(req.method.to_uppercase().as_bytes()).map_err(|_| "bad method".to_string())?;
    let mut rb = h.http.request(method, url).timeout(Duration::from_secs(30));
    for (k, v) in req.headers {
        let lk = k.to_ascii_lowercase();
        if matches!(lk.as_str(), "origin" | "cookie" | "host" | "content-length" | "referer" | "user-agent") {
            continue;
        }
        rb = rb.header(k, v);
    }
    if let Some(b) = req.body {
        rb = rb.body(b);
    }
    let r = rb.send().await.map_err(|e| {
        #[cfg(debug_assertions)]
        eprintln!("http failed: {e:?}");
        e.to_string()
    })?;
    #[cfg(debug_assertions)]
    eprintln!("http {} {}", r.status(), r.url());
    let status = r.status();
    let headers = r.headers().iter().filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string()))).collect();
    let body = r.text().await.map_err(|e| e.to_string())?;
    Ok(HttpRes { status: status.as_u16(), status_text: status.canonical_reason().unwrap_or("").to_string(), headers, body })
}

// ------------------------------------------------------------------ notifications and reminders

fn show_notification(app: &AppHandle, title: &str, body: &str) {
    let mut n = app.notification().builder().title(title);
    if !body.is_empty() {
        n = n.body(body);
    }
    let _ = n.show();
}

#[tauri::command]
fn notify(app: AppHandle, title: String, body: Option<String>) {
    show_notification(&app, &title, body.as_deref().unwrap_or(""));
}

/// Replaces all upcoming reminders (lessons, absence deadlines). They fire while the app runs,
/// also with the window closed (it stays in the tray).
#[tauri::command]
fn schedule(h: State<Host>, plan: Vec<Reminder>) {
    let raw: Vec<Value> = plan.iter().map(|r| json!({ "id": r.id, "at": r.at, "title": r.title, "body": r.body })).collect();
    let _ = std::fs::write(&h.plan_path, serde_json::to_vec(&raw).unwrap_or_default());
    let ids: HashSet<String> = plan.iter().map(|r| r.id.clone()).collect();
    h.fired.lock().unwrap().retain(|id| ids.contains(id));
    *h.plan.lock().unwrap() = plan;
}

fn fire_due(app: &AppHandle) {
    let h = app.state::<Host>();
    let now = now_ms();
    let due: Vec<Reminder> = {
        let plan = h.plan.lock().unwrap();
        let mut fired = h.fired.lock().unwrap();
        plan.iter()
            .filter(|r| r.at <= now && r.at > now - 120_000.0 && fired.insert(r.id.clone()))
            .cloned()
            .collect()
    };
    for r in due {
        show_notification(app, &r.title, &r.body);
    }
}

#[tauri::command]
fn set_lang(app: AppHandle, h: State<Host>, lang: String) {
    *h.lang.lock().unwrap() = if lang == "en" { "en".into() } else { "de".into() };
    update_tray(&app);
}

/// Next lessons for the tray and the mini window (same data as the Android widget).
#[tauri::command]
fn widget(app: AppHandle, h: State<Host>, data: Value) {
    *h.widget.lock().unwrap() = data.clone();
    update_tray(&app);
    let _ = app.emit_to("mini", "widget", data);
}

#[tauri::command]
fn mini_data(h: State<Host>) -> Value {
    h.widget.lock().unwrap().clone()
}

#[tauri::command]
fn mini_close(app: AppHandle) {
    set_mini(&app, false);
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) {
    if let Ok(u) = url.parse::<Url>() {
        if matches!(u.scheme(), "https" | "http" | "mailto") {
            let _ = app.opener().open_url(u.as_str(), None::<&str>);
        }
    }
}

/// Downloads the new version from the GitHub release (signed), installs it and restarts.
#[tauri::command]
async fn install_update(app: AppHandle) {
    let res: Result<bool, String> = async {
        let up = app.updater().map_err(|e| e.to_string())?;
        match up.check().await.map_err(|e| e.to_string())? {
            Some(u) => {
                u.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
                Ok(true)
            }
            None => Ok(false),
        }
    }
    .await;
    match res {
        Ok(true) => {
            app.state::<Host>().store.save();
            app.restart();
        }
        _ => to_main(&app, "window.__appUpdateFailed && window.__appUpdateFailed()"),
    }
}

/// The page has drawn itself → show the window (no white flash on start).
#[tauri::command]
fn app_ready(app: AppHandle, h: State<Host>) {
    if !h.start_hidden {
        if let Some(w) = app.get_webview_window("main") {
            if !w.is_visible().unwrap_or(false) {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
    }
}

// ------------------------------------------------------------------ tray and mini window

fn labels(en: bool) -> [&'static str; 6] {
    if en {
        ["No more lessons", "Open", "Refresh", "Mini window", "Start with the computer", "Quit"]
    } else {
        ["Keine Lektionen mehr", "Öffnen", "Aktualisieren", "Mini-Fenster", "Mit dem Computer starten", "Beenden"]
    }
}

/// "Jetzt: Datenbanken · ZH-404 · bis 12:00" / "13:00 Englisch · ZH-206"
fn next_lesson_text(h: &Host) -> Option<String> {
    let en = en(h);
    let w = h.widget.lock().unwrap();
    let now = now_ms();
    let l = w.get("lessons")?.as_array()?.iter().find(|l| l.get("e").and_then(Value::as_f64).unwrap_or(0.0) > now)?;
    let s = l.get("s").and_then(Value::as_f64).unwrap_or(0.0);
    let str_of = |k: &str| l.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    let (t, r) = (str_of("t"), str_of("r"));
    let room = if r.is_empty() { String::new() } else { format!(" · {r}") };
    Some(if s <= now {
        format!("{} {t}{room} · {} {}", if en { "Now:" } else { "Jetzt:" }, if en { "until" } else { "bis" }, str_of("eh"))
    } else if s - now < 12.0 * 3600e3 {
        format!("{} {t}{room}", str_of("sh"))
    } else {
        format!("{} {} {t}{room}", str_of("dl"), str_of("sh"))
    })
}

fn update_tray(app: &AppHandle) {
    let h = app.state::<Host>();
    let l = labels(en(&h));
    let next = next_lesson_text(&h);
    if let Some(items) = h.tray.lock().unwrap().as_ref() {
        let _ = items.next.set_text(next.clone().unwrap_or_else(|| l[0].to_string()));
        let _ = items.open.set_text(l[1]);
        let _ = items.refresh.set_text(l[2]);
        let _ = items.mini.set_text(l[3]);
        let _ = items.auto.set_text(l[4]);
        let _ = items.quit.set_text(l[5]);
    }
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(match next {
            Some(n) => format!("WISS Stundenplan\n{n}"),
            None => "WISS Stundenplan".to_string(),
        }));
    }
}

const MINI_W: f64 = 340.0;
const MINI_H: f64 = 100.0;

fn set_mini(app: &AppHandle, on: bool) {
    let h = app.state::<Host>();
    if let Some(items) = h.tray.lock().unwrap().as_ref() {
        let _ = items.mini.set_checked(on);
    }
    match (on, app.get_webview_window("mini")) {
        (true, Some(w)) => {
            let _ = w.show();
        }
        (true, None) => {
            let mut b = WebviewWindowBuilder::new(app, "mini", WebviewUrl::App("mini.html".into()))
                .title("WISS Stundenplan")
                .inner_size(MINI_W, MINI_H)
                // fixed size via min = max: with resizable(false), GTK grows the window to the web view's
                // natural height (200 px) after it appears
                .min_inner_size(MINI_W, MINI_H)
                .max_inner_size(MINI_W, MINI_H)
                .maximizable(false)
                .minimizable(false)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .focused(false);
            // bottom right of the screen, above the taskbar (on Wayland the system decides)
            if let Ok(Some(m)) = app.primary_monitor() {
                let area = m.work_area();
                let sc = m.scale_factor();
                let x = (area.position.x as f64 + area.size.width as f64) / sc - MINI_W - 16.0;
                let y = (area.position.y as f64 + area.size.height as f64) / sc - MINI_H - 16.0;
                b = b.position(x, y);
            }
            let _ = b.build();
        }
        (false, Some(w)) => {
            let _ = w.destroy();
        }
        (false, None) => {}
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let h = app.state::<Host>();
    let l = labels(en(&h));
    let auto_on = app.autolaunch().is_enabled().unwrap_or(false);
    let items = TrayItems {
        next: MenuItem::with_id(app, "next", l[0], false, None::<&str>)?,
        open: MenuItem::with_id(app, "open", l[1], true, None::<&str>)?,
        refresh: MenuItem::with_id(app, "refresh", l[2], true, None::<&str>)?,
        mini: CheckMenuItem::with_id(app, "mini", l[3], true, false, None::<&str>)?,
        auto: CheckMenuItem::with_id(app, "auto", l[4], true, auto_on, None::<&str>)?,
        quit: MenuItem::with_id(app, "quit", l[5], true, None::<&str>)?,
    };
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&items.next, &sep1, &items.open, &items.refresh, &items.mini, &items.auto, &sep2, &items.quit])?;
    let mut tb = TrayIconBuilder::with_id("main")
        .tooltip("WISS Stundenplan")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, ev| match ev.id().as_ref() {
            "open" => show_main(app),
            "refresh" => to_main(app, "chrome.runtime.sendMessage({ type: 'refresh', force: true }).catch(() => {})"),
            "mini" => {
                let on = app.get_webview_window("mini").is_none();
                set_mini(app, on);
            }
            "auto" => {
                let al = app.autolaunch();
                let on = !al.is_enabled().unwrap_or(false);
                let _ = if on { al.enable() } else { al.disable() };
                if let Some(items) = app.state::<Host>().tray.lock().unwrap().as_ref() {
                    let _ = items.auto.set_checked(al.is_enabled().unwrap_or(on));
                }
            }
            "quit" => quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                let app = tray.app_handle();
                let visible = app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(false);
                if visible {
                    hide_main(app);
                } else {
                    show_main(app);
                }
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tb = tb.icon(icon.clone());
    }
    tb.build(app)?;
    *h.tray.lock().unwrap() = Some(items);
    h.has_tray.store(true, Ordering::SeqCst);
    Ok(())
}

fn quit(app: &AppHandle) {
    let h = app.state::<Host>();
    h.quitting.store(true, Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval("window.__appFlush && window.__appFlush()");
        save_window(app, &w);
    }
    let app = app.clone();
    // give the page a moment to hand over its last changes
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(300));
        app.state::<Host>().store.save();
        app.exit(0);
    });
}

// ------------------------------------------------------------------ main window size

fn save_window(app: &AppHandle, w: &WebviewWindow) {
    let (Ok(size), Ok(scale)) = (w.inner_size(), w.scale_factor()) else { return };
    if w.is_minimized().unwrap_or(false) || size.width == 0 {
        return;
    }
    let s = size.to_logical::<f64>(scale);
    let _ = std::fs::write(&app.state::<Host>().win_path, json!({ "w": s.width, "h": s.height }).to_string());
}

/// Bigger windows get a bigger page, like pressing Ctrl + Plus: the layout is made for about
/// 1360 × 900, so a maximised window on a large screen would otherwise look small and empty.
fn fit_zoom(app: &AppHandle, w: &WebviewWindow) {
    let (Ok(size), Ok(scale)) = (w.inner_size(), w.scale_factor()) else { return };
    if size.width == 0 || w.is_minimized().unwrap_or(false) {
        return;
    }
    let s = size.to_logical::<f64>(scale);
    let z = ((s.width / 1360.0).min(s.height / 900.0).clamp(1.0, 1.75) * 20.0).floor() / 20.0;
    let host = app.state::<Host>();
    let mut cur = host.zoom.lock().unwrap();
    if (*cur - z).abs() > 0.001 {
        *cur = z;
        let _ = w.set_zoom(z);
    }
}

fn saved_size(path: &std::path::Path) -> (f64, f64) {
    let v: Value = std::fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or(Value::Null);
    let g = |k: &str, d: f64| v.get(k).and_then(Value::as_f64).filter(|x| *x >= 380.0 && *x <= 4000.0).unwrap_or(d);
    (g("w", 1120.0), g("h", 780.0))
}

// ------------------------------------------------------------------ start

/// Linux .deb/.rpm: installed from the app's package source, the system's own updates bring new
/// versions (the in-app updater only works for the AppImage there).
fn system_updates() -> bool {
    cfg!(target_os = "linux") && std::env::var_os("APPIMAGE").is_none()
}

fn main() {
    // WebKitGTK + NVIDIA can show a blank window with the DMA-BUF renderer; the fallback is fine there.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() && std::path::Path::new("/proc/driver/nvidia").exists() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let start_hidden = std::env::args().any(|a| a == "--hidden");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .setup(move |app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let plan_path = dir.join("reminders.json");
            let plan: Vec<Reminder> = std::fs::read(&plan_path).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
            let version = app.package_info().version.to_string();
            let host = Host {
                store: store::Store::open(dir.join("store.json")),
                tabs: Mutex::new(HashMap::new()),
                next_tab: AtomicU32::new(1),
                lang: Mutex::new("de".into()),
                widget: Mutex::new(Value::Null),
                plan: Mutex::new(plan),
                fired: Mutex::new(HashSet::new()),
                plan_path,
                win_path: dir.join("window.json"),
                quitting: AtomicBool::new(false),
                start_hidden,
                has_tray: AtomicBool::new(false),
                tray: Mutex::new(None),
                http: reqwest::Client::builder().user_agent(format!("WISS-Stundenplan-Desktop/{version}")).build()?,
                zoom: Mutex::new(1.0),
            };
            if let Some(Value::Object(p)) = host.store.snapshot().get("prefs") {
                if p.get("lang").and_then(Value::as_str) == Some("en") {
                    *host.lang.lock().unwrap() = "en".into();
                }
            }
            let (w, h) = saved_size(&host.win_path);
            app.manage(host);

            let handle = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("WISS Stundenplan")
                .inner_size(w, h)
                .min_inner_size(380.0, 560.0)
                .center()
                .visible(false)
                .initialization_script(if system_updates() { "window.__wissSystemUpdates = true;" } else { "" })
                .on_navigation(move |u: &Url| {
                    let local = u.scheme() == "tauri" || u.host_str() == Some("tauri.localhost") || u.host_str() == Some("localhost");
                    if !local && matches!(u.scheme(), "https" | "http" | "mailto") {
                        let _ = handle.opener().open_url(u.as_str(), None::<&str>); // links → real browser
                    }
                    local
                })
                .build()?;
            if let Some(w) = app.get_webview_window("main") {
                fit_zoom(app.handle(), &w);
            }

            if let Err(e) = build_tray(app.handle()) {
                eprintln!("no tray icon: {e}");
            }
            update_tray(app.handle());
            #[cfg(debug_assertions)]
            if std::env::var_os("WISS_MINI").is_some() {
                // for testing the mini window without a tray: WISS_MINI=1, optional example lessons
                let now = now_ms();
                *app.state::<Host>().widget.lock().unwrap() = json!({ "lang": "de", "accent": "", "lessons": [
                    { "s": now - 30.0 * 60e3, "e": now + 47.0 * 60e3, "t": "Datenbanken abfragen", "r": "ZH-404", "p": "B. Keller", "sh": "10:30", "eh": "12:00", "dl": "Mi" }
                ]});
                set_mini(app.handle(), true);
            }

            // safety net: show the window even if the page never says it is ready
            if !start_hidden {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(2));
                    if let Some(w) = handle.get_webview_window("main") {
                        if !w.is_visible().unwrap_or(true) {
                            let _ = w.show();
                        }
                    }
                });
            }
            // background work: save the store, fire reminders, keep the tray text current
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut tick = 0u32;
                loop {
                    std::thread::sleep(Duration::from_millis(700));
                    let h = handle.state::<Host>();
                    h.store.save();
                    tick += 1;
                    if tick % 20 == 0 {
                        fire_due(&handle);
                    }
                    if tick % 43 == 0 {
                        update_tray(&handle);
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|win, ev| {
            let app = win.app_handle();
            match ev {
                WindowEvent::CloseRequested { api, .. } if win.label() == "main" => {
                    let h = app.state::<Host>();
                    if !h.quitting.load(Ordering::SeqCst) && h.has_tray.load(Ordering::SeqCst) {
                        api.prevent_close(); // keeps running in the tray, reminders still come
                        hide_main(app);
                    } else {
                        quit(app);
                    }
                }
                WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } if win.label() == "main" => {
                    if let Some(w) = app.get_webview_window("main") {
                        fit_zoom(app, &w);
                    }
                }
                WindowEvent::Destroyed => {
                    if let Some(id) = tab_id(win.label()) {
                        tab_gone(app, id);
                    } else if win.label() == "mini" {
                        if let Some(items) = app.state::<Host>().tray.lock().unwrap().as_ref() {
                            let _ = items.mini.set_checked(false);
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            store_load, store_set, store_replace,
            tab_create, tab_info, tab_update, tab_show, tab_remove, tab_exec, tab_result, tab_message,
            http, notify, schedule, set_lang, widget, open_external, install_update, app_ready, mini_data, mini_close
        ])
        .build(tauri::generate_context!())
        .expect("error while starting WISS Stundenplan")
        .run(|app, ev| match ev {
            RunEvent::Exit => app.state::<Host>().store.save(),
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => show_main(app), // click on the Dock icon
            _ => {}
        });
}
