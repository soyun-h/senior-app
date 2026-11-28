package com.allitcare.android

import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class AlarmActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        render()
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); render() }

    private fun render() {
        val alarm = AlarmService.current ?: run { finish(); return }
        val keyguard = getSystemService(KeyguardManager::class.java)
        val stack = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val margin = (24 * resources.displayMetrics.density).toInt()
            setPadding(margin, margin, margin, margin)
            setBackgroundColor(Color.rgb(248, 252, 247))
        }
        stack.addView(TextView(this).apply {
            text = if (keyguard.isKeyguardLocked) "올잇 알람" else alarm.title
            textSize = 30f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(0, 60, 64))
        })
        fun action(label: String, action: () -> Unit) {
            stack.addView(Button(this).apply { text = label; textSize = 19f; setOnClickListener { action() } })
        }
        action("확인하기") { finishAlarm(alarm, "confirm") }
        action("사진으로 인증하기") { finishAlarm(alarm, "photo") }
        action("알람 끄기") { AlarmService.stop(this, alarm.key); finish() }
        setContentView(stack)
    }

    private fun finishAlarm(alarm: Occurrence, action: String) {
        if (AlarmService.current?.key != alarm.key) { render(); return }
        try { AlarmActions.add(this, alarm.id, alarm.date, action) }
        catch (error: Exception) { Toast.makeText(this, "확인 내용을 저장하지 못했어요.", Toast.LENGTH_LONG).show(); return }
        AlarmService.stop(this, alarm.key)
        fun open() {
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
            finish()
        }
        val keyguard = getSystemService(KeyguardManager::class.java)
        if (Build.VERSION.SDK_INT >= 26 && keyguard.isKeyguardLocked) {
            keyguard.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() = open()
                override fun onDismissCancelled() = finish()
                override fun onDismissError() = finish()
            })
        } else if (!keyguard.isKeyguardLocked) open() else finish()
    }
}
