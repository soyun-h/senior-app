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
import org.json.JSONObject
import java.time.Instant
import java.time.format.DateTimeFormatter

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
            manager.getNotificationChannel(AlarmService.CHANNEL).importance != NotificationManager.IMPORTANCE_NONE &&
            manager.getNotificationChannel(BEFORE_CHANNEL).importance != NotificationManager.IMPORTANCE_NONE)
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
                arm(context, id, upcoming[id].takeIf { allowed }, now)
            }
        }
    }

    @Synchronized
    fun restore(context: Context) {
        replace(context, store(context).getString("plans", "[]") ?: "[]", force = true)
        val test = diagnostic(context)
        if (test != null && test.due > System.currentTimeMillis() && exact(context) && permitted(context)) {
            arm(context, TEST_ID, test, System.currentTimeMillis())
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
        arm(context, TEST_ID, diagnostic(context), now)
    }

    private fun diagnostic(context: Context): Occurrence? {
        val due = store(context).getLong("diagnostic", 0)
        return if (!BuildConfig.DEBUG || due <= 0) null else Occurrence(TEST_ID,
            Instant.ofEpochMilli(due).atOffset(koreaTime).toLocalDate().toString(), due, "올잇 시험 알람", 30_000)
    }

    @Synchronized
    fun receive(context: Context, id: String, due: Long, before: Boolean): Occurrence? {
        val now = System.currentTimeMillis()
        if (due <= 0 || store(context).getLong("armed:$id", 0) != due || (!before && due > now)) return null
        val plan = plans(context)[id]
        val entry = if (id == TEST_ID) diagnostic(context) else plan?.next(due - 1)
        if (entry?.due != due || !permitted(context)) return null
        if (before) return entry.takeIf { now < due }
        runCatching {
            arm(context, id, plan?.next(now).takeIf { exact(context) }, now)
            if (id == TEST_ID) check(store(context).edit().remove("diagnostic").commit())
        }.onFailure { Log.e("AllitAlarm", "Failed to update the next occurrence", it) }
        return entry
    }

    private fun request(context: Context, id: String, before: Boolean) = Intent(context, AlarmReceiver::class.java).apply {
        data = Uri.Builder().scheme("allit-alarm").authority(context.packageName)
            .appendPath(if (before) "before" else "due").appendPath(id).build()
    }

    private fun cancel(context: Context, id: String) {
        val alarms = context.getSystemService(AlarmManager::class.java)
        for (before in listOf(false, true)) {
            PendingIntent.getBroadcast(context, 0, request(context, id, before), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE)?.let {
                alarms.cancel(it)
                it.cancel()
            }
        }
        context.getSystemService(NotificationManager::class.java).cancel(id, BEFORE_ID)
        if (store(context).contains("armed:$id")) check(store(context).edit().remove("armed:$id").commit())
    }

    private fun arm(context: Context, id: String, occurrence: Occurrence?, now: Long) {
        cancel(context, id)
        if (occurrence == null) return
        val alarms = context.getSystemService(AlarmManager::class.java)
        fun trigger(before: Boolean) = PendingIntent.getBroadcast(context, 0,
            request(context, id, before).putExtra("due", occurrence.due), PendingIntent.FLAG_IMMUTABLE)
        val show = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        try {
            alarms.setAlarmClock(AlarmManager.AlarmClockInfo(occurrence.due, show), trigger(false))
            if (occurrence.before > now) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, occurrence.before, trigger(true))
            check(store(context).edit().putLong("armed:$id", occurrence.due).commit())
        } catch (error: Exception) {
            cancel(context, id)
            throw error
        }
    }

    private const val BEFORE_CHANNEL = "allit-upcoming"
    private const val BEFORE_ID = 2501

    private fun createChannels(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT < 26) return
        manager.createNotificationChannels(listOf(
            NotificationChannel(BEFORE_CHANNEL, "일정 사전 알림", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(AlarmService.CHANNEL, "정각 알람", NotificationManager.IMPORTANCE_HIGH).apply {
                setSound(null, null)
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            },
        ))
    }

    @Suppress("DEPRECATION")
    fun notifyBefore(context: Context, occurrence: Occurrence) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val open = Intent(context, UpcomingActivity::class.java).apply {
            data = Uri.Builder().scheme("allit-upcoming").authority(context.packageName).appendPath(occurrence.id).build()
            putExtra("date", occurrence.date)
        }
        val intent = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val at = Instant.ofEpochMilli(occurrence.due).atOffset(koreaTime).format(DateTimeFormatter.ofPattern("HH:mm"))
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, BEFORE_CHANNEL) else Notification.Builder(context)
        manager.notify(occurrence.id, BEFORE_ID, builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(occurrence.title).setContentText("$at 예정된 일정이에요.")
            .setContentIntent(intent).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build())
    }

    fun openBefore(context: Context, id: String, date: String) {
        if (!date.matches(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}"))) return
        if (id !in plans(context) && !(BuildConfig.DEBUG && id == TEST_ID)) return
        AlarmActions.add(context, id, date, "before")
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.data?.lastPathSegment ?: return
        val before = intent.data?.pathSegments?.firstOrNull() == "before"
        runCatching {
            val occurrence = AlarmScheduler.receive(context, id, intent.getLongExtra("due", 0), before) ?: return
            if (before) AlarmScheduler.notifyBefore(context, occurrence) else AlarmService.start(context, occurrence)
        }.onFailure { Log.e("AllitAlarm", "Alarm dispatch failed", it) }
    }
}

class AlarmRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        runCatching { AlarmScheduler.restore(context) }.onFailure { Log.e("AllitAlarm", "Alarm restore failed", it) }
    }
}
