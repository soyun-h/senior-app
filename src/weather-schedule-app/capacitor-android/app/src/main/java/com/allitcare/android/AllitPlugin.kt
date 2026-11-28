package com.allitcare.android

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract.CommonDataKinds.Phone
import android.provider.MediaStore
import android.provider.Settings
import android.provider.Telephony
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray
import java.util.Locale
import java.util.UUID

@CapacitorPlugin(name = "Allit", permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])])
class AllitPlugin : Plugin() {
    private val ringerModes = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (!isVoicePlaybackAllowed()) {
                voice?.stop()
                endSpeech()
            }
            notifyListeners("voiceOutputChanged", JSObject())
        }
    }
    private var observingRinger = false

    override fun load() {
        ContextCompat.registerReceiver(context, ringerModes, IntentFilter(AudioManager.RINGER_MODE_CHANGED_ACTION),
            ContextCompat.RECEIVER_EXPORTED)
        observingRinger = true
        if (BuildConfig.DEBUG) android.util.Log.i("AllitBridge", "PLUGIN_LOADED")
    }

    private fun checkedScope(call: PluginCall, run: () -> Unit) = checked(call) {
        try {
            AccountAccess.checkScope(context, call.getString("accountId"))
        } catch (_: IllegalStateException) {
            if (BuildConfig.DEBUG) android.util.Log.w("AllitBridge", "${call.methodName}: ACCOUNT_SCOPE_MISMATCH")
            call.reject("Android 계정 정보가 일치하지 않아요. 다시 로그인해 주세요.", "ACCOUNT_SCOPE_MISMATCH")
            return@checked
        }
        run()
    }

    private fun checked(call: PluginCall, run: () -> Unit) {
        activity.runOnUiThread {
            val page = bridge.webView.url?.let(Uri::parse)
            if (page == null || (activity as? MainActivity)?.allowedPage(page) != true) {
                if (BuildConfig.DEBUG) android.util.Log.w("AllitBridge", "${call.methodName}: ORIGIN_REJECTED")
                call.reject("허용된 올잇 화면에서만 사용할 수 있어요.", "ORIGIN_REJECTED")
                return@runOnUiThread
            }
            try { run() }
            catch (error: Exception) {
                if (BuildConfig.DEBUG) android.util.Log.w("AllitBridge", "${call.methodName}: ${error.javaClass.simpleName}")
                if (error is IllegalStateException && !error.message.isNullOrBlank()) call.reject(error.message)
                else call.reject("휴대전화 기능을 실행하지 못했어요. 설정을 확인해 주세요.", error)
            }
        }
    }

    private fun state(): JSObject {
        val scheduled = AlarmScheduler.scheduledTimes(context)
        return JSObject().put("notifications", AlarmScheduler.permitted(context)).put("exact", AlarmScheduler.exact(context))
            .put("fullScreen", Build.VERSION.SDK_INT < 34 || context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent())
            .put("debug", BuildConfig.DEBUG).put("scheduled", scheduled.size).put("nextAlarmAt", scheduled.minOrNull())
            .put("chooseSmsRecipient", Telephony.Sms.getDefaultSmsPackage(context) == AOSP_MESSAGING)
    }

    @PluginMethod fun status(call: PluginCall) = checked(call) { call.resolve(state()) }

    @PluginMethod fun diagnostics(call: PluginCall) = checked(call) {
        check(BuildConfig.DEBUG)
        val matches = runCatching { AccountAccess.checkScope(context, call.getString("accountId")) }.isSuccess
        android.util.Log.i("AllitBridge", "DIAGNOSTICS: originAllowed=true accountMatches=$matches")
        call.resolve(JSObject().put("originAllowed", true).put("accountMatches", matches))
    }

    @PluginMethod fun authGet(call: PluginCall) = checked(call) {
        call.resolve(JSObject().put("value", AccountAccess.get(context, call.getString("key").orEmpty())))
    }

    @PluginMethod fun authSet(call: PluginCall) = checked(call) {
        AccountAccess.put(context, call.getString("key").orEmpty(), call.getString("value"))
        call.resolve()
    }

    @PluginMethod fun authLaunch(call: PluginCall) = checked(call) {
        AccountAccess.openBrowser(activity, call.getString("url").orEmpty())
        call.resolve()
    }

    @PluginMethod fun authRedirect(call: PluginCall) = checked(call) {
        call.resolve(JSObject().put("redirect", AccountAccess.callbackUrl(context)))
    }

    @PluginMethod fun authCallback(call: PluginCall) = checked(call) {
        call.resolve(JSObject().put("url", AccountAccess.takeCallback(context)))
    }

    @PluginMethod fun accountScope(call: PluginCall) = checked(call) {
        AccountAccess.changeScope(context, call.getString("id"))
        call.resolve()
    }

    @PluginMethod fun purgeAccountFiles(call: PluginCall) = checked(call) {
        AccountAccess.purge(context, call.getString("id").orEmpty())
        call.resolve()
    }

    @PluginMethod fun sync(call: PluginCall) = checkedScope(call) {
        val plans = call.getArray("schedules") ?: error("일정 예약 정보가 없어요.")
        val enabled = JSONArray()
        for (index in 0 until plans.length()) {
            val schedule = plans.getJSONObject(index)
            if (schedule.getBoolean("notificationsEnabled") && schedule.getString("notificationMethod") in setOf("alarm", "video-call")) {
                enabled.put(schedule)
            }
        }
        val reservations = JSONArray()
        for ((occurrence, outcome) in AlarmScheduler.replace(context, enabled.toString(), force = call.getBoolean("force", false) == true)) {
            reservations.put(JSObject().put("id", occurrence.id).put("date", occurrence.date)
                .put("due", occurrence.due).put("outcome", outcome))
        }
        call.resolve(state().put("reservations", reservations))
    }

    @PluginMethod fun requestNotifications(call: PluginCall) = checked(call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermission")
        } else call.resolve(state())
    }

    @PermissionCallback private fun notificationPermission(call: PluginCall) = checked(call) {
        call.resolve(state())
    }

    @PluginMethod fun openSettings(call: PluginCall) = checked(call) {
        val app = Uri.fromParts("package", context.packageName, null)
        val intent = when (call.getString("kind")) {
            "exact" -> if (Build.VERSION.SDK_INT >= 31) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, app) else null
            "fullScreen" -> if (Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, app) else null
            "notifications" -> if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName) else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, app)
            else -> error("열 수 없는 설정이에요.")
        }
        if (intent != null) activity.startActivity(intent)
        call.resolve()
    }

    @PluginMethod fun actions(call: PluginCall) = checkedScope(call) { call.resolve(JSObject().put("items", AlarmActions.all(context))) }
    @PluginMethod fun acknowledge(call: PluginCall) = checkedScope(call) {
        AlarmActions.remove(context, call.getString("key").orEmpty()); call.resolve()
    }
    @PluginMethod fun testAlarm(call: PluginCall) = checked(call) {
        check(BuildConfig.DEBUG) { "테스트용 빌드에서만 사용할 수 있어요." }
        check(call.getBoolean("cancel", false) == true || AlarmScheduler.exact(context) && AlarmScheduler.permitted(context)) {
            "알림과 정확한 알람을 먼저 허용해 주세요."
        }
        AlarmScheduler.test(context, call.getBoolean("cancel", false) == true)
        call.resolve(state())
    }

    override fun handleOnNewIntent(intent: Intent) { notifyListeners("changed", JSObject()) }
    override fun handleOnResume() { notifyListeners("changed", JSObject()) }

    @PluginMethod fun pickContact(call: PluginCall) = checkedScope(call) {
        // The provider grants temporary access to the selected phone row, including the selected number.
        startActivityForResult(call, Intent(Intent.ACTION_PICK, Phone.CONTENT_URI).setType(Phone.CONTENT_TYPE), "contactPicked")
    }

    @ActivityCallback private fun contactPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        checkedScope(call) {
            val row = result.data?.data
            if (result.resultCode != Activity.RESULT_OK || row == null) { call.resolve(JSObject()); return@checkedScope }
            check(row.scheme == "content" && row.authority == "com.android.contacts") { "연락처 주소를 확인하지 못했어요." }
            val contact = context.contentResolver.query(row, arrayOf(Phone.DISPLAY_NAME, Phone.NUMBER), null, null, null)?.use {
                if (it.moveToFirst()) JSObject().put("name", it.getString(0)).put("phone", it.getString(1)) else null
            } ?: error("선택한 연락처의 번호를 읽을 수 없어요.")
            call.resolve(contact)
        }
    }

    @PluginMethod fun takePhoto(call: PluginCall) = checkedScope(call) {
        val file = PhotoFiles.create(context)
        val uri = PhotoFiles.shareUri(context, file)
        val front = call.getString("facing") == "front"
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            putExtra("android.intent.extras.CAMERA_FACING", if (front) 1 else 0)
            clipData = ClipData.newRawUri("사진 촬영", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
        call.data.put("photoId", file.nameWithoutExtension)
        call.data.put("photoOwner", AccountAccess.owner(context))
        try { startActivityForResult(call, intent, "pictureTaken") }
        catch (error: Exception) { file.delete(); error("사용할 수 있는 카메라 앱이 없어요.") }
    }

    @ActivityCallback private fun pictureTaken(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        checked(call) {
            check(call.getString("photoOwner") == AccountAccess.owner(context)) { "계정이 변경됐어요." }
            val file = PhotoFiles.file(context, call.getString("photoId").orEmpty())
            context.revokeUriPermission(PhotoFiles.shareUri(context, file), Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            if (result.resultCode != Activity.RESULT_OK || file.length() == 0L) {
                file.delete()
                if (result.resultCode == Activity.RESULT_OK) call.reject("카메라에서 촬영 파일을 받지 못했어요.") else call.resolve(JSObject())
            } else {
                val capturedAt = file.lastModified()
                try { PhotoFiles.optimize(file) } catch (error: Exception) { file.delete(); throw error }
                call.resolve(JSObject().put("id", file.nameWithoutExtension).put("uri", Uri.fromFile(file).toString()).put("capturedAt", capturedAt))
            }
        }
    }

    @PluginMethod fun photo(call: PluginCall) = checkedScope(call) {
        val file = PhotoFiles.checked(context, call.getString("id").orEmpty())
        call.resolve(JSObject().put("id", file.nameWithoutExtension).put("uri", Uri.fromFile(file).toString()))
    }

    @PluginMethod fun importLegacyPhoto(call: PluginCall) = checkedScope(call) {
        call.resolve(JSObject().put("copied", PhotoFiles.importLegacy(context, call.getString("sourceId").orEmpty(), call.getString("id").orEmpty())))
    }

    @PluginMethod fun restorePhoto(call: PluginCall) = checkedScope(call) {
        val encoded = call.getString("base64").orEmpty()
        require(encoded.length <= 1_398_104 && AccountAccess.validUser(AccountAccess.owner(context)))
        val file = PhotoFiles.restore(context, call.getString("id").orEmpty(), Base64.decode(encoded, Base64.NO_WRAP))
        call.resolve(JSObject().put("id", file.nameWithoutExtension).put("uri", Uri.fromFile(file).toString()))
    }

    @PluginMethod fun removePhoto(call: PluginCall) = checkedScope(call) {
        val file = PhotoFiles.file(context, call.getString("id").orEmpty())
        if (file.exists()) {
            context.revokeUriPermission(PhotoFiles.shareUri(context, file), Intent.FLAG_GRANT_READ_URI_PERMISSION)
            check(file.delete()) { "사진을 지우지 못했어요." }
        }
        call.resolve()
    }

    private fun attachment(call: PluginCall, aosp: Boolean = false): Intent {
        val photo = PhotoFiles.checked(context, call.getString("id").orEmpty())
        val body = call.getString("body").orEmpty()
        require(body.length <= 1000)
        val uri = PhotoFiles.shareUri(context, if (aosp) PhotoFiles.messagingCopy(context, photo) else photo)
        // AOSP Messaging imports both parts only through its multi-item share flow.
        // Supplying an address there routes to a text-only draft.
        if (aosp && body.isNotBlank()) {
            val text = PhotoFiles.shareUri(context, PhotoFiles.messageDraft(context, body))
            return Intent(Intent.ACTION_SEND_MULTIPLE).setType("image/jpeg")
                .putParcelableArrayListExtra(Intent.EXTRA_STREAM, arrayListOf(uri, text)).apply {
                    clipData = ClipData.newRawUri("올잇 인증 사진", uri).apply { addItem(ClipData.Item(text)) }
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
        }
        return Intent(Intent.ACTION_SEND).setType("image/jpeg").putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_TEXT, body).putExtra("sms_body", body).apply {
                clipData = ClipData.newRawUri("올잇 인증 사진", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
    }

    @PluginMethod fun compose(call: PluginCall) = checkedScope(call) {
        val phone = call.getString("phone").orEmpty()
        require(phone.matches(Regex("\\+?[0-9]{8,15}")))
        val sms = Telephony.Sms.getDefaultSmsPackage(context)
        if (sms == null) { call.resolve(JSObject().put("opened", false)); return@checkedScope }
        val aosp = sms == AOSP_MESSAGING
        if (aosp && (Build.VERSION.SDK_INT < 30 || context.externalCacheDir == null)) {
            call.resolve(JSObject().put("opened", false))
            return@checkedScope
        }
        val intent = attachment(call, aosp).setPackage(sms)
        if (!aosp) intent.putExtra("address", phone)
        if (intent.resolveActivity(context.packageManager) == null) { call.resolve(JSObject().put("opened", false)); return@checkedScope }
        val photoUri = intent.clipData?.getItemAt(0)?.uri
        // AOSP opens the composer in a new task after the share picker finishes.
        // Its asynchronous photo import must still be able to read this one URI.
        if (aosp && photoUri != null) context.grantUriPermission(sms, photoUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try { startActivityForResult(call, intent, "composerClosed") }
        catch (error: android.content.ActivityNotFoundException) {
            if (aosp && photoUri != null) context.revokeUriPermission(photoUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            call.resolve(JSObject().put("opened", false))
        }
    }

    @ActivityCallback private fun composerClosed(call: PluginCall?, result: ActivityResult) {
        // The result describes returning from the composer, never delivery of a message.
        call?.resolve(JSObject().put("opened", true))
    }

    @PluginMethod fun share(call: PluginCall) = checkedScope(call) {
        activity.startActivity(Intent.createChooser(attachment(call), "받을 사람을 확인하고 사진 공유"))
        call.resolve()
    }

    private var voice: TextToSpeech? = null
    private var voiceReady = false
    private var speech: Pair<String, PluginCall>? = null

    private fun isVoicePlaybackAllowed(): Boolean {
        val audio = context.getSystemService(AudioManager::class.java)
        return audio.ringerMode == AudioManager.RINGER_MODE_NORMAL &&
            !audio.isStreamMute(AudioManager.STREAM_MUSIC) && audio.getStreamVolume(AudioManager.STREAM_MUSIC) > 0
    }

    @PluginMethod fun voicePlaybackAllowed(call: PluginCall) = checked(call) {
        call.resolve(JSObject().put("allowed", isVoicePlaybackAllowed()))
    }

    @PluginMethod fun recognize(call: PluginCall) = checked(call) {
        check(speech == null) { "캐릭터가 말을 마친 뒤 녹음할 수 있어요." }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
            putExtra(RecognizerIntent.EXTRA_PROMPT, "올잇에게 말해 주세요")
        }
        check(intent.resolveActivity(context.packageManager) != null) { "설치된 한국어 음성 인식 앱을 찾지 못했어요." }
        startActivityForResult(call, intent, "recognized")
    }

    @ActivityCallback private fun recognized(call: PluginCall?, result: ActivityResult) {
        val text = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        call?.resolve(if (result.resultCode == Activity.RESULT_OK && text != null) JSObject().put("text", text) else JSObject())
    }

    @PluginMethod fun speak(call: PluginCall) = checked(call) {
        val text = call.getString("text").orEmpty()
        require(text.isNotBlank() && text.length <= TextToSpeech.getMaxSpeechInputLength())
        if (!isVoicePlaybackAllowed()) { call.resolve(); return@checked }
        endSpeech()
        val id = UUID.randomUUID().toString()
        speech = id to call
        if (voiceReady) startSpeech(text, id) else {
            voice?.shutdown()
            voice = TextToSpeech(context) { result -> activity.runOnUiThread {
                if (speech?.first != id) return@runOnUiThread
                voiceReady = result == TextToSpeech.SUCCESS && (voice?.setLanguage(Locale.KOREA) ?: -1) >= 0
                if (!voiceReady) endSpeech("한국어 음성 합성을 사용할 수 없어요.") else startSpeech(text, id)
            } }
        }
    }

    private fun startSpeech(text: String, id: String) {
        if (!isVoicePlaybackAllowed()) { endSpeech(); return }
        voice?.setAudioAttributes(AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        voice?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) {}
            override fun onDone(utteranceId: String) = finish(utteranceId, null)
            @Suppress("OVERRIDE_DEPRECATION") override fun onError(utteranceId: String) = finish(utteranceId, "음성 재생에 실패했어요.")
            private fun finish(id: String, error: String?) { activity.runOnUiThread { if (speech?.first == id) endSpeech(error) } }
        })
        if (voice?.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) endSpeech("음성 재생에 실패했어요.")
    }

    private fun endSpeech(error: String? = null) {
        val call = speech?.second ?: return
        speech = null
        if (error == null) call.resolve() else call.reject(error)
    }

    @PluginMethod fun stopVoice(call: PluginCall) = checked(call) { voice?.stop(); endSpeech(); call.resolve() }
    override fun handleOnDestroy() {
        if (observingRinger) context.unregisterReceiver(ringerModes)
        observingRinger = false
        endSpeech()
        voice?.shutdown()
        voice = null
        voiceReady = false
    }

    companion object { private const val AOSP_MESSAGING = "com.android.messaging" }
}
