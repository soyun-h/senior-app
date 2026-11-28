package com.allitcare.android

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import org.json.JSONArray
import java.time.Instant

internal object AlarmScheduler {
    private fun store(context: Context) = context.getSharedPreferences("allit-alarm-schedule-v1", Context.MODE_PRIVATE)
    private fun plans(context: Context) = decode(store(context).getString("plans", "[]") ?: "[]")
    private fun decode(raw: String): Map<String, AlarmPlan> {
        val array = JSONArray(raw)
        val entries = (0 until array.length()).map { AlarmPlan(array.getJSONObject(it)) }
        return entries.associateBy { it.id }.also { require(it.size == entries.size) }
    }

    fun exact(context: Context) = Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
    fun permitted(context: Context): Boolean {
        val manager = context.getSystemService(NotificationManager::class.java)
        createChannels(manager)
        return manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 26 ||
            manager.getNotificationChannel(AlarmService.CHANNEL).importance != NotificationManager.IMPORTANCE_NONE)
    }

    fun scheduledTimes(context: Context): List<Long> {
        if (!exact(context) || !permitted(context)) return emptyList()
        val now = System.currentTimeMillis()
        return store(context).all.entries.filter { it.key.startsWith("armed:") }
            .mapNotNull { it.value as? Long }.filter { it > now }
    }

    @Synchronized
    fun replace(context: Context, raw: String, force: Boolean = false) {
        val previous = plans(context)
        // Cancel old pre-alert PendingIntents on sync and package-replacement restore.
        val notifications = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) notifications.deleteNotificationChannel(LEGACY_BEFORE_CHANNEL)
        for (id in previous.keys + TEST_ID) {
            cancelTrigger(context, id, "before")
            notifications.cancel(id, LEGACY_BEFORE_ID)
        }
        val next = decode(raw)
        val now = System.currentTimeMillis()
        val upcoming = next.mapValues { it.value.next(now) }
        val prefs = store(context)
        if (prefs.getString("plans", "[]") != raw) check(prefs.edit().putString("plans", raw).commit())
        for (id in previous.keys - next.keys) {
            cancel(context, id)
            AlarmService.cancelSchedule(id)
        }
        val allowed = exact(context) && permitted(context)
        for ((id, plan) in next) {
            if (force || !allowed || !prefs.contains("armed:$id") || previous[id]?.raw?.toString() != plan.raw.toString()) {
                arm(context, id, upcoming[id].takeIf { allowed })
            }
        }
    }

    @Synchronized
    fun restore(context: Context) {
        replace(context, store(context).getString("plans", "[]") ?: "[]", force = true)
        val test = diagnostic(context)
        if (test != null && test.due > System.currentTimeMillis() && exact(context) && permitted(context)) {
            arm(context, TEST_ID, test)
        } else {
            cancel(context, TEST_ID)
        }
    }

    @Synchronized
    fun test(context: Context, cancelOnly: Boolean) {
        check(BuildConfig.DEBUG)
        val now = System.currentTimeMillis()
        if (cancelOnly) {
            check(store(context).edit().remove("diagnostic").commit())
            cancel(context, TEST_ID)
            AlarmService.cancelSchedule(TEST_ID)
            return
        }
        check(exact(context) && permitted(context))
        val due = now + 60_000
        check(store(context).edit().putLong("diagnostic", due).commit())
        arm(context, TEST_ID, diagnostic(context))
    }

    private fun diagnostic(context: Context): Occurrence? {
        val due = store(context).getLong("diagnostic", 0)
        return if (!BuildConfig.DEBUG || due <= 0) null else Occurrence(TEST_ID,
            Instant.ofEpochMilli(due).atOffset(koreaTime).toLocalDate().toString(), due, "올잇 시험 알람")
    }

    @Synchronized
    fun receive(context: Context, id: String, due: Long): Occurrence? {
        val now = System.currentTimeMillis()
        if (due <= 0 || store(context).getLong("armed:$id", 0) != due || due > now) return null
        val plan = plans(context)[id]
        val entry = if (id == TEST_ID) diagnostic(context) else plan?.next(due - 1)
        if (entry?.due != due || !permitted(context)) return null
        runCatching {
            arm(context, id, plan?.next(now).takeIf { exact(context) })
            if (id == TEST_ID) check(store(context).edit().remove("diagnostic").commit())
        }.onFailure { Log.e("AllitAlarm", "Failed to update the next occurrence", it) }
        return entry
    }

    private fun request(context: Context, id: String, phase: String) = Intent(context, AlarmReceiver::class.java).apply {
        data = Uri.Builder().scheme("allit-alarm").authority(context.packageName)
            .appendPath(phase).appendPath(id).build()
    }

    private fun cancelTrigger(context: Context, id: String, phase: String) {
        PendingIntent.getBroadcast(context, 0, request(context, id, phase),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE)?.let {
            context.getSystemService(AlarmManager::class.java).cancel(it)
            it.cancel()
        }
    }

    private fun cancel(context: Context, id: String) {
        cancelTrigger(context, id, "due")
        if (store(context).contains("armed:$id")) check(store(context).edit().remove("armed:$id").commit())
    }

    private fun arm(context: Context, id: String, occurrence: Occurrence?) {
        cancel(context, id)
        if (occurrence == null) return
        val alarms = context.getSystemService(AlarmManager::class.java)
        val trigger = PendingIntent.getBroadcast(context, 0,
            request(context, id, "due").putExtra("due", occurrence.due), PendingIntent.FLAG_IMMUTABLE)
        val show = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        try {
            alarms.setAlarmClock(AlarmManager.AlarmClockInfo(occurrence.due, show), trigger)
            check(store(context).edit().putLong("armed:$id", occurrence.due).commit())
        } catch (error: Exception) {
            cancel(context, id)
            throw error
        }
    }

    private const val LEGACY_BEFORE_CHANNEL = "allit-upcoming"
    private const val LEGACY_BEFORE_ID = 2501

    private fun createChannels(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT < 26) return
        manager.createNotificationChannel(
            NotificationChannel(AlarmService.CHANNEL, "정각 알람", NotificationManager.IMPORTANCE_HIGH).apply {
                setSound(null, null)
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            },
        )
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val path = intent.data?.pathSegments ?: return
        if (path.size != 2 || path[0] != "due") return
        val id = path[1]
        runCatching {
            val occurrence = AlarmScheduler.receive(context, id, intent.getLongExtra("due", 0)) ?: return
            AlarmService.start(context, occurrence)
        }.onFailure { Log.e("AllitAlarm", "Alarm dispatch failed", it) }
    }
}

class AlarmRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        runCatching { AlarmScheduler.restore(context) }.onFailure { Log.e("AllitAlarm", "Alarm restore failed", it) }
    }
}
