//! Replaces chrome.storage.local: one JSON file in the app's data folder.
//! The page sends every change right away; the file is written at most every 0.7 s
//! (and once more when the app quits), always via a temp file so it is never half-written.

use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

pub struct Store {
    path: PathBuf,
    data: Mutex<Map<String, Value>>,
    dirty: AtomicBool,
}

impl Store {
    pub fn open(path: PathBuf) -> Self {
        let data = fs::read(&path)
            .ok()
            .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
            .and_then(|v| match v {
                Value::Object(m) => Some(m),
                _ => None,
            })
            .unwrap_or_default();
        Store { path, data: Mutex::new(data), dirty: AtomicBool::new(false) }
    }

    pub fn snapshot(&self) -> Value {
        Value::Object(self.data.lock().unwrap().clone())
    }

    pub fn merge(&self, patch: Map<String, Value>) {
        self.data.lock().unwrap().extend(patch);
        self.dirty.store(true, Ordering::SeqCst);
    }

    pub fn replace(&self, all: Map<String, Value>) {
        *self.data.lock().unwrap() = all;
        self.dirty.store(true, Ordering::SeqCst);
    }

    pub fn save(&self) {
        if !self.dirty.swap(false, Ordering::SeqCst) {
            return;
        }
        let bytes = match serde_json::to_vec(&*self.data.lock().unwrap()) {
            Ok(b) => b,
            Err(_) => return,
        };
        if let Some(dir) = self.path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let tmp = self.path.with_extension("json.tmp");
        if fs::write(&tmp, &bytes).and_then(|_| fs::rename(&tmp, &self.path)).is_err() {
            self.dirty.store(true, Ordering::SeqCst); // try again next round
        }
    }
}
