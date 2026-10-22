package ch.wisstools.stundenplan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires a scheduled reminder (lesson / absence deadline). */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String id = i.getStringExtra("id");
        if (id == null) return;
        Notifs.show(c, id, i.getStringExtra("title"), i.getStringExtra("body"));
        Notifs.markFired(c, id);
    }
}
