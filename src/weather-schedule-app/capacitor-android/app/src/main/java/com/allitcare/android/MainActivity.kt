package com.allitcare.android

import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.TextView
import androidx.webkit.WebViewFeature
import com.getcapacitor.Bridge
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient
import com.getcapacitor.CapConfig
import java.io.File

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        config = CapConfig.loadDefault(this)
        registerPlugin(AllitPlugin::class.java)
        super.onCreate(savedInstanceState)
    }

    override fun onResume() {
        super.onResume()
        resumedActivity = this
    }

    override fun onPause() {
        if (resumedActivity === this) resumedActivity = null
        super.onPause()
    }

    override fun load() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) || config.isUsingLegacyBridge ||
            (config.serverUrl != null && pagesOrigin() == null && !(BuildConfig.DEBUG && config.serverUrl == LIVE))) {
            if (BuildConfig.DEBUG) android.util.Log.w("AllitBridge", "WEBVIEW_CONFIGURATION_UNSUPPORTED")
            setContentView(TextView(this).apply { text = "Android System WebView를 업데이트한 뒤 올잇을 다시 열어 주세요."; textSize = 20f })
            return
        }
        super.load()
        bridge.webView.settings.allowFileAccess = false
        bridge.webView.settings.allowContentAccess = false
        bridge.setWebViewClient(object : BridgeWebViewClient(bridge) {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                !allowedPage(request.url) || super.shouldOverrideUrlLoading(view, request)

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val path = request.url.path.orEmpty()
                if (request.isForMainFrame && !allowedPage(request.url)) return blocked()
                if (path.startsWith(Bridge.CAPACITOR_CONTENT_START)) return blocked()
                if (path.startsWith(Bridge.CAPACITOR_FILE_START)) {
                    val file = runCatching { File(path.removePrefix(Bridge.CAPACITOR_FILE_START)).canonicalFile }.getOrNull()
                    if (file?.parentFile != PhotoFiles.directory(this@MainActivity).canonicalFile || !PhotoFiles.validName(file.name)) return blocked()
                }
                return super.shouldInterceptRequest(view, request)
            }
        })
    }

    private fun blocked() = WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", emptyMap(), null)

    private fun pagesOrigin(): Uri? {
        val server = config.serverUrl?.let(Uri::parse) ?: return null
        val startPath = config.startPath ?: return null
        return server.takeIf {
            it.scheme == "https" && it.host?.matches(Regex("[A-Za-z0-9.-]+")) == true &&
                it.userInfo == null && it.port == -1 && it.path.isNullOrEmpty() &&
                it.query == null && it.fragment == null && pagesPath.matches(startPath)
        }
    }

    internal fun allowedPage(uri: Uri): Boolean {
        if (uri.userInfo != null || uri.pathSegments.any { it == "." || it == ".." || '/' in it }) return false
        fun secure(host: String) = uri.scheme == "https" && uri.host == host && uri.port in listOf(-1, 443)
        return when (config.serverUrl) {
            LIVE -> BuildConfig.DEBUG && (uri.scheme == "http" && uri.host == "127.0.0.1" && uri.port == 8090 ||
                secure("localhost") && uri.path == "/offline.html")
            null -> secure("localhost")
            else -> pagesOrigin()?.host?.let { host ->
                secure(host) && uri.path.orEmpty().startsWith(config.startPath) ||
                    secure("localhost") && uri.path == "/offline.html"
            } ?: false
        }
    }

    companion object {
        private var resumedActivity: MainActivity? = null
        internal fun foregroundActivity(): MainActivity? = resumedActivity?.takeIf { it.hasWindowFocus() }
        private val pagesPath = Regex("/(?:[A-Za-z0-9_][A-Za-z0-9_.-]*/)*")
        private const val LIVE = "http://127.0.0.1:8090"
    }
}
