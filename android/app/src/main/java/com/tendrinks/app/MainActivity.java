package com.tendrinks.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.tendrinks.app.reminder.ReminderIntents;
import com.tendrinks.app.reminder.ReminderNotifier;
import com.tendrinks.app.backup.BackupExportPlugin;
import com.tendrinks.app.reminder.ReminderPlugin;
import com.tendrinks.app.reminder.ReminderPrefs;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReminderPlugin.class);
        registerPlugin(BackupExportPlugin.class);
        if (savedInstanceState == null) {
            captureLogAction(getIntent());
        }
        super.onCreate(savedInstanceState);
        stripLogExtra(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        captureLogAction(intent);
        super.onNewIntent(intent);
        stripLogExtra(intent);
        setIntent(intent);
    }

    private void captureLogAction(Intent intent) {
        String kind = ReminderIntents.logKind(intent);
        if (kind == null) return;
        ReminderPrefs.setPendingLog(this, kind);
        ReminderNotifier.cancel(this);
    }

    private void stripLogExtra(Intent intent) {
        if (intent != null) {
            intent.removeExtra(ReminderIntents.EXTRA_LOG);
        }
    }
}
