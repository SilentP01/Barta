package app.barta.messenger

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.WindowManager
import android.webkit.*
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val baseUrl = "https://barta.up.railway.app/"
    var isCallActive = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // NATIVE PRIVACY: This blocks screenshots and screen recording globally in the app
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )

        webView = WebView(this)
        setContentView(webView)

        // BUG-10: Use modern OnBackPressedDispatcher instead of deprecated onBackPressed()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        setupWebView()
        checkPermissions()
        checkForUpdates()
    }

    class BartaBridge(val activity: MainActivity) {
        @android.webkit.JavascriptInterface
        fun setCallActive(isActive: Boolean) {
            activity.runOnUiThread {
                activity.isCallActive = isActive
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isCallActive) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                val rational = android.util.Rational(9, 16)
                val params = android.app.PictureInPictureParams.Builder()
                    .setAspectRatio(rational)
                    .build()
                enterPictureInPictureMode(params)
            } else {
                @Suppress("DEPRECATION")
                enterPictureInPictureMode()
            }
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: android.content.res.Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        webView.evaluateJavascript("javascript:if(window.onPipModeChanged){window.onPipModeChanged($isInPictureInPictureMode);}", null)
    }

    private fun setupWebView() {
        val defaultUserAgent = webView.settings.userAgentString ?: ""
        webView.settings.userAgentString = "$defaultUserAgent BartaNativeAndroid"

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            databaseEnabled = true
            // Important for WebRTC
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
        }

        webView.addJavascriptInterface(BartaBridge(this), "BartaBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return if (url.startsWith(baseUrl)) {
                    false
                } else {
                    // Open external links in browser
                    startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
                    true
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    val offlineHtml = """
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <style>
                            body {
                              background: #0f1117;
                              color: #ffffff;
                              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                              display: flex;
                              flex-direction: column;
                              align-items: center;
                              justify-content: center;
                              height: 100vh;
                              margin: 0;
                              text-align: center;
                              padding: 24px;
                              box-sizing: border-box;
                            }
                            .icon {
                              font-size: 3rem;
                              margin-bottom: 16px;
                              animation: pulse 2s infinite ease-in-out;
                            }
                            h1 {
                              font-size: 1.5rem;
                              font-weight: 700;
                              margin: 0 0 10px 0;
                              letter-spacing: -0.02em;
                            }
                            p {
                              font-size: 0.95rem;
                              color: #94a3b8;
                              margin: 0 0 28px 0;
                              line-height: 1.6;
                              max-width: 320px;
                            }
                            .btn {
                              background: #14b8a6;
                              color: #ffffff;
                              border: none;
                              padding: 14px 28px;
                              border-radius: 999px;
                              font-weight: 700;
                              font-size: 0.9rem;
                              cursor: pointer;
                              box-shadow: 0 4px 14px rgba(20, 184, 166, 0.35);
                            }
                            @keyframes pulse {
                              0%, 100% { opacity: 0.5; }
                              50% { opacity: 1; }
                            }
                          </style>
                        </head>
                        <body>
                          <div class="icon">📡</div>
                          <h1>Connection Unavailable</h1>
                          <p>Barta requires an active network to authenticate and secure your private sessions. Please check your cellular data or Wi-Fi settings.</p>
                          <button class="btn" onclick="location.href='$baseUrl'">Retry Connection</button>
                        </body>
                        </html>
                    """.trimIndent()
                    view?.loadDataWithBaseURL(null, offlineHtml, "text/html", "UTF-8", null)
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // Handle WebRTC permissions inside WebView
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }
        }

        webView.loadUrl(baseUrl)
    }

    private fun checkPermissions() {
        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS,
        )
        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missingPermissions.toTypedArray(), 101)
        }
    }

    private fun checkForUpdates() {
        thread {
            try {
                val conn = java.net.URL("${baseUrl}api/version").openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 5_000
                conn.readTimeout = 5_000
                val response = conn.inputStream.bufferedReader().readText()
                conn.disconnect()
                val json = org.json.JSONObject(response)
                val serverVersionCode = json.optInt("latestVersionCode", 1)

                val pInfo = packageManager.getPackageInfo(packageName, 0)
                val localVersionCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    pInfo.longVersionCode
                } else {
                    @Suppress("DEPRECATION")
                    pInfo.versionCode.toLong()
                }

                if (serverVersionCode > localVersionCode) {
                    runOnUiThread {
                        showUpdateDialog()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun showUpdateDialog() {
        if (isDestroyed || isFinishing) return

        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Update Available")
            .setMessage("A new, secure version of Barta is available. To ensure the highest level of privacy protection and optimal performance, please update your application.")
            .setCancelable(true)
            .setPositiveButton("Update Now") { _, _ ->
                val updateUrl = "https://github.com/SilentP01/Barta/releases/latest/download/Barta.apk"
                startActivity(Intent(Intent.ACTION_VIEW, updateUrl.toUri()))
            }
            .setNegativeButton("Later") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }
}

