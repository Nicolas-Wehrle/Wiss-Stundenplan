fn main() {
    // Each command gets an "allow-<name>" permission; capabilities/ decides which window may use which.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "store_load", "store_set", "store_replace",
        "tab_create", "tab_info", "tab_update", "tab_show", "tab_remove", "tab_exec",
        "tab_result", "tab_message",
        "http", "notify", "schedule", "set_lang", "widget", "open_external", "install_update",
        "app_ready", "mini_data", "mini_close",
    ])))
    .expect("tauri build script failed");
}
