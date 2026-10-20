package com.tendrinks.app.reminder;

import android.content.Context;
import android.content.Intent;
import com.tendrinks.app.MainActivity;

public final class ReminderIntents {
    public static final String EXTRA_LOG = "ten_drinks_log";
    static final String ACTION_STRONG = "com.tendrinks.app.LOG_SOBER";
    static final String ACTION_SLIP = "com.tendrinks.app.LOG_DRINK";

    private ReminderIntents() {}

    static Intent openApp(Context context) {
        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return launch;
    }

    static Intent logAction(Context context, String kind) {
        Intent intent = openApp(context);
        boolean strong = "sober".equals(kind);
        intent.setAction(strong ? ACTION_STRONG : ACTION_SLIP);
        intent.putExtra(EXTRA_LOG, strong ? "sober" : "drink");
        return intent;
    }

    public static String logKind(Intent intent) {
        if (intent == null) return null;
        String extra = intent.getStringExtra(EXTRA_LOG);
        if ("sober".equals(extra) || "drink".equals(extra)) return extra;
        String action = intent.getAction();
        if (ACTION_STRONG.equals(action)) return "sober";
        if (ACTION_SLIP.equals(action)) return "drink";
        return null;
    }
}
