package ch.wisstools.stundenplan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms are cleared on reboot / app update → schedule reminders and the widget again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Notifs.reschedule(c);
        NextLessonWidget.updateAll(c);
    }
}
