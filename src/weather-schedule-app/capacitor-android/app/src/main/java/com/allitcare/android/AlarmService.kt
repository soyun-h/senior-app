package com.allitcare.android

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

class AlarmService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val queue = ArrayDeque<Occurrence>()
    private var player: MediaPlayer? = null
    private var tone: ToneGenerator? = null
    private var vibrator: Vibrator? = null
    private val timeout = Runnable { finishCurrent() }
    private val repeatTone = object : Runnable {
        override fun run() {
            tone?.startTone(ToneGenerator.TONE_SUP_RINGTONE, 850)
            handler.postDelayed(this, 1_300)
        }
    }

    override fun onCreate() { super.onCreate(); instance = this }
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val id = intent?.getStringExtra("id")
        if (intent?.action == STOP) {
            if (current?.key == intent.getStringExtra("key")) finishCurrent()
        } else if (id != null) {
            val occurrence = Occurrence(id, intent.getStringExtra("date").orEmpty(), intent.getLongExtra("due", 0),
                intent.getStringExtra("title").orEmpty())
            if (current == null) play(occurrence)
            else if (current?.key != occurrence.key && queue.none { it.key == occurrence.key }) queue.addLast(occurrence)
        } else if (current == null) stopSelf()
        return START_NOT_STICKY
    }

    private fun play(occurrence: Occurrence) {
        current = occurrence
        val visibleActivity = MainActivity.foregroundActivity()
        startForeground(NOTIFICATION_ID, notification(occurrence, fullScreen = visibleActivity == null))
        vibrate()
        val sound = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        try {
            val audio = MediaPlayer().also { player = it }
            audio.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
            audio.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK)
            audio.setDataSource(this, sound)
            audio.isLooping = true
            audio.setOnPreparedListener { if (player === it) it.start() }
            audio.setOnErrorListener { failed, _, _ -> if (player === failed) playFallback(); true }
            audio.prepareAsync()
        } catch (error: Exception) {
            android.util.Log.w("AllitAlarm", "Default alarm sound unavailable", error)
            playFallback()
        }
        handler.postDelayed(timeout, 5 * 60_000L)
        visibleActivity?.let { it.startActivity(Intent(it, AlarmActivity::class.java)) }
    }

    private fun playFallback() {
        player?.release()
        player = null
        if (tone == null) {
            runCatching { ToneGenerator(AudioManager.STREAM_ALARM, 85) }.onSuccess {
                tone = it
                handler.post(repeatTone)
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun vibrate() {
        vibrator = if (Build.VERSION.SDK_INT >= 31) getSystemService(VibratorManager::class.java).defaultVibrator
            else getSystemService(Vibrator::class.java)
        val pattern = longArrayOf(0, 700, 600)
        if (Build.VERSION.SDK_INT >= 26) vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0),
            AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
        else vibrator?.vibrate(pattern, 0)
    }

    @Suppress("DEPRECATION")
    private fun notification(occurrence: Occurrence, fullScreen: Boolean): Notification {
        val open = PendingIntent.getActivity(this, 0, Intent(this, AlarmActivity::class.java).apply {
            data = Uri.fromParts("allit-ringing", occurrence.key, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }, PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 0, stopIntent(this, occurrence.key), PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
        val manager = getSystemService(NotificationManager::class.java)
        if (fullScreen && (Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent())) builder.setFullScreenIntent(open, true)
        if (Build.VERSION.SDK_INT >= 31) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
        return builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("올잇 알람")
            .setContentText("누르면 확인하거나 사진으로 인증할 수 있어요.")
            .setCategory(Notification.CATEGORY_ALARM).setPriority(Notification.PRIORITY_MAX)
            .setGroup("allit-ringing-only").setVisibility(Notification.VISIBILITY_PUBLIC).setOngoing(true).setContentIntent(open)
            .addAction(Notification.Action.Builder(null, "알람 끄기", stop).build()).build()
    }

    private fun stopOutput() {
        handler.removeCallbacks(timeout)
        handler.removeCallbacks(repeatTone)
        player?.release()
        player = null
        tone?.release()
        tone = null
        vibrator?.cancel()
        vibrator = null
    }

    private fun finishCurrent() {
        stopOutput()
        current = null
        val next = queue.removeFirstOrNull()
        if (next == null) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() } else play(next)
    }

    override fun onDestroy() {
        stopOutput()
        queue.clear()
        current = null
        instance = null
        super.onDestroy()
    }

    companion object {
        const val CHANNEL = "allit-alarm-due"
        private const val NOTIFICATION_ID = 2502
        private const val STOP = "com.allitcare.android.STOP_RING"
        @Volatile private var instance: AlarmService? = null
        @Volatile internal var current: Occurrence? = null
            private set

        internal fun start(context: Context, occurrence: Occurrence) {
            val intent = Intent(context, AlarmService::class.java).putExtra("id", occurrence.id)
                .putExtra("title", occurrence.title).putExtra("date", occurrence.date).putExtra("due", occurrence.due)
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
        }

        private fun stopIntent(context: Context, key: String) = Intent(context, AlarmService::class.java)
            .setAction(STOP).setData(Uri.fromParts("allit-stop", key, null)).putExtra("key", key)

        internal fun stop(context: Context, key: String) { context.startService(stopIntent(context, key)) }

        internal fun cancelSchedule(id: String) { instance?.let { service ->
            service.handler.post {
                service.queue.removeAll { it.id == id }
                if (current?.id == id) service.finishCurrent()
            }
        } }
    }
}
