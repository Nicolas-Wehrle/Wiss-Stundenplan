package ch.wisstools.stundenplan;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/** Notifications for the app: shown right away (new grades) or scheduled with AlarmManager
 *  (lesson reminders, absence deadlines) so they also arrive while the app is closed. */
final class Notifs {
    private Notifs() {}

    static final String PREFS = "notifs";

    static void ensureChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        boolean en = "en".equals(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("lang", "de"));
        nm.createNotificationChannel(new NotificationChannel("lessons", en ? "Lesson reminders" : "Lektions-Erinnerungen", NotificationManager.IMPORTANCE_DEFAULT));
        nm.createNotificationChannel(new NotificationChannel("absences", en ? "Absences" : "Absenzen", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(new NotificationChannel("grades", en ? "New grades" : "Neue Noten", NotificationManager.IMPORTANCE_DEFAULT));
    }

    static String channelFor(String id) {
        if (id.startsWith("abs")) return "absences";
        if (id.startsWith("grade") || id.startsWith("test")) return "grades";
        return "lessons";
    }

    static void show(Context c, String id, String title, String body) {
        ensureChannels(c);
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (id.startsWith("grade")) open.putExtra("tab", "grades");
        else if (id.startsWith("abs")) open.putExtra("tab", "absences");
        PendingIntent pi = PendingIntent.getActivity(c, id.hashCode(), open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = new Notification.Builder(c, channelFor(id))
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(c.getColor(R.color.accent))
                .setContentTitle(title)
                .setAutoCancel(true)
                .setContentIntent(pi);
        if (body != null && !body.isEmpty()) b.setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body));
        try { c.getSystemService(NotificationManager.class).notify(id.hashCode(), b.build()); } catch (SecurityException e) { /* permission missing */ }
    }

    /** Replaces all scheduled reminders with the given plan (JSON array of {id, at, title, body}). */
    static void schedule(Context c, String planJson) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        Set<String> old = sp.getStringSet("codes", new HashSet<>());
        for (String code : old) {
            PendingIntent pi = PendingIntent.getBroadcast(c, Integer.parseInt(code), new Intent(c, ReminderReceiver.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_NO_CREATE);
            if (pi != null) { am.cancel(pi); pi.cancel(); }
        }
        Set<String> fired = sp.getStringSet("fired", new HashSet<>());
        Set<String> codes = new HashSet<>();
        long now = System.currentTimeMillis();
        try {
            JSONArray plan = new JSONArray(planJson);
            for (int i = 0; i < plan.length(); i++) {
                JSONObject r = plan.getJSONObject(i);
                String id = r.getString("id");
                long at = r.getLong("at");
                if (at < now - 60000 || fired.contains(id)) continue;
                Intent it = new Intent(c, ReminderReceiver.class)
                        .putExtra("id", id).putExtra("title", r.optString("title")).putExtra("body", r.optString("body"));
                int code = id.hashCode();
                PendingIntent pi = PendingIntent.getBroadcast(c, code, it, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, Math.max(at, now + 1000), pi);
                codes.add(String.valueOf(code));
            }
        } catch (Exception e) { /* bad plan → nothing scheduled */ }
        sp.edit().putStringSet("codes", codes).putString("plan", planJson).apply();
    }

    static void markFired(Context c, String id) {
        if (!id.startsWith("abs")) return;                       // absences: only remind once
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> fired = new HashSet<>(sp.getStringSet("fired", new HashSet<>()));
        fired.add(id);
        sp.edit().putStringSet("fired", fired).apply();
    }

    static void reschedule(Context c) {
        String plan = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("plan", null);
        if (plan != null) schedule(c, plan);
    }

    static boolean permitted(Context c) {
        if (Build.VERSION.SDK_INT < 33) return true;
        return c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }
}
