package ch.wisstools.stundenplan;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Key/value storage on the phone (same semantics as chrome.storage.local):
 * one JSON file in the app's private folder. Only this app can read it.
 * Changes are kept in memory right away and written to disk on a background thread,
 * so the page never waits for the disk.
 */
class Store {
    private final File file, tmp;
    private JSONObject data;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private boolean queued;

    Store(File dir) {
        file = new File(dir, "store.json");
        tmp = new File(dir, "store.json.tmp");
        data = load();
    }

    private JSONObject load() {
        try (FileInputStream in = new FileInputStream(file)) {
            return new JSONObject(new String(MainActivity.readAll(in), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** keysJson: null/"null" → everything, otherwise a JSON array of keys. */
    synchronized String get(String keysJson) {
        try {
            if (keysJson == null || keysJson.equals("null")) return data.toString();
            JSONArray keys = new JSONArray(keysJson);
            JSONObject out = new JSONObject();
            for (int i = 0; i < keys.length(); i++) {
                String k = keys.getString(i);
                if (data.has(k)) out.put(k, data.get(k));
            }
            return out.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    synchronized void set(String json) {
        try {
            JSONObject patch = new JSONObject(json);
            for (Iterator<String> it = patch.keys(); it.hasNext(); ) {
                String k = it.next();
                data.put(k, patch.get(k));
            }
            save();
        } catch (Exception ignored) { }
    }

    synchronized void clear() {
        data = new JSONObject();
        save();
    }

    /** Writes on the background thread. Several quick changes end up in one write. */
    private void save() {
        if (queued) return;
        queued = true;
        io.execute(this::writeNow);
    }

    /** Called when the app goes to the background: write anything pending now. */
    void flush() { io.execute(this::writeNow); }

    private void writeNow() {
        String json;
        synchronized (this) {
            queued = false;
            json = data.toString();
        }
        synchronized (file) {
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(json.getBytes(StandardCharsets.UTF_8));
                out.getFD().sync();
            } catch (Exception e) {
                return;
            }
            //noinspection ResultOfMethodCallIgnored
            tmp.renameTo(file);
        }
    }
}
