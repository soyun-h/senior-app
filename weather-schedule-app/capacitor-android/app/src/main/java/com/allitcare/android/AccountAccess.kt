package com.allitcare.android

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal object AccountAccess {
    private const val ALIAS = "allit.auth.aes.v1"
    private const val LEGACY = "legacy"
    private const val SIGNED_OUT = "signed-out"
    private val userId = Regex("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}")
    private val authKeys = setOf(
        "allit-auth", "allit-auth-user", "allit-auth-pending", "allit-auth-callback",
        "allit-auth-code-verifier", "allit-auth-flows-code-verifier"
    )
    private val flowVerifierKey = Regex("allit-auth-flow-[A-Za-z0-9_-]{8,64}-code-verifier")
    private val project = Regex("[a-z0-9]+\\.supabase\\.co")

    private fun storage(context: Context) = context.getSharedPreferences("allit-encrypted-auth-v1", Context.MODE_PRIVATE)
    private fun scope(context: Context) = context.getSharedPreferences("allit-account-scope-v1", Context.MODE_PRIVATE)
    fun owner(context: Context) = scope(context).getString("owner", LEGACY) ?: LEGACY
    fun isLegacy(context: Context) = owner(context) == LEGACY
    fun validUser(value: String) = userId.matches(value)
    fun checkScope(context: Context, accountId: String?) {
        check(if (accountId == null) isLegacy(context) else validUser(accountId) && owner(context) == accountId) {
            "현재 로그인 계정에서 다시 시도해 주세요."
        }
    }
    fun callbackScheme(context: Context) = "${context.packageName}.oauth"
    fun callbackUrl(context: Context) = "${callbackScheme(context)}://auth/callback"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    @Synchronized
    fun get(context: Context, name: String): String? {
        require(name in authKeys || flowVerifierKey.matches(name))
        val sealed = storage(context).getString(name, null) ?: return null
        val raw = Base64.decode(sealed, Base64.DEFAULT)
        return Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, raw.copyOfRange(0, 12)))
            updateAAD(name.toByteArray(Charsets.UTF_8))
        }.doFinal(raw, 12, raw.size - 12).toString(Charsets.UTF_8)
    }

    @Synchronized
    fun put(context: Context, name: String, value: String?) {
        require(name in authKeys || flowVerifierKey.matches(name))
        val editor = storage(context).edit()
        if (value == null) editor.remove(name) else {
            require(value.length <= 65536)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.ENCRYPT_MODE, key())
                updateAAD(name.toByteArray(Charsets.UTF_8))
            }
            editor.putString(name, Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
        }
        check(editor.commit())
    }

    @Synchronized
    fun takeCallback(context: Context): String? {
        val callback = get(context, "allit-auth-callback") ?: return null
        put(context, "allit-auth-callback", null)
        return callback
    }

    @Synchronized
    fun receiveCallback(context: Context, uri: Uri): Boolean {
        if (!uri.isHierarchical || uri.scheme != callbackScheme(context) || uri.encodedAuthority != "auth" ||
            uri.encodedPath != "/callback" || uri.fragment != null || uri.toString().length > 2500 ||
            uri.queryParameterNames.any { it !in setOf("code", "error", "error_code", "error_description") }) return false
        val codes = uri.getQueryParameters("code")
        val errors = uri.getQueryParameters("error")
        if (!((codes.size == 1 && codes[0].matches(Regex("[A-Za-z0-9_-]{1,1024}")) && errors.isEmpty()) ||
              (codes.isEmpty() && errors.size == 1 && errors[0].isNotBlank()))) return false
        if (get(context, "allit-auth-pending") == null || get(context, "allit-auth-callback") != null) return false
        put(context, "allit-auth-callback", uri.toString())
        return true
    }

    fun openBrowser(activity: Activity, url: String) {
        val uri = Uri.parse(url)
        require(uri.scheme == "https" && uri.userInfo == null && uri.port == -1 &&
            uri.host?.matches(project) == true && uri.path == "/auth/v1/authorize" && uri.fragment == null &&
            uri.getQueryParameter("redirect_to") == callbackUrl(activity) &&
            uri.getQueryParameter("code_challenge_method")?.lowercase() == "s256" &&
            uri.getQueryParameter("provider") in setOf("google", "kakao"))
        activity.startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
    }

    @Synchronized
    fun changeScope(context: Context, next: String?) {
        require(next == null || validUser(next))
        val previous = owner(context)
        val destination = next ?: SIGNED_OUT
        if (previous == destination) return
        AlarmScheduler.replace(context, "[]")
        if (BuildConfig.DEBUG) AlarmScheduler.test(context, cancelOnly = true)
        AlarmActions.clear(context)
        val editor = scope(context).edit().putString("owner", destination)
        if (destination == SIGNED_OUT && validUser(previous)) editor.putString("retired", previous)
        else editor.remove("retired")
        check(editor.commit())
    }

    @Synchronized
    fun purge(context: Context, id: String) {
        val active = owner(context)
        require(validUser(id) && (active == id || active == SIGNED_OUT && scope(context).getString("retired", null) == id))
        for (path in listOfNotNull(File(context.filesDir, "account-proofs/$id"), File(context.cacheDir, "account-drafts/$id"),
            context.externalCacheDir?.let { File(it, "account-drafts/$id") })) {
            check(!path.exists() || path.deleteRecursively())
        }
        if (active == SIGNED_OUT) check(scope(context).edit().remove("retired").commit())
    }
}

class OAuthCallbackActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val callback = intent.data
        if (callback != null && runCatching { AccountAccess.receiveCallback(this, callback) }.getOrDefault(false)) {
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
        }
        finish()
    }
}
