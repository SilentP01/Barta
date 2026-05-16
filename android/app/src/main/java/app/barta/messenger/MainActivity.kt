package app.barta.messenger

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val APP_VERSION = "v22" // Matches current web version
    private val BASE_URL = "https://barta.up.railway.app/"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // NATIVE PRIVACY: This blocks screenshots and screen recording globally in the app
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        webView = WebView(this)
        setContentView(webView)

        setupWebView()
        checkPermissions()
        checkForUpdates()
    }

    private fun setupWebView() {
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

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return if (url.startsWith(BASE_URL)) {
                    false
                } else {
                    // Open external links in browser
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
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

        webView.loadUrl(BASE_URL)
    }

    private fun checkPermissions() {
        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS
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
                val response = URL("${BASE_URL}api/version").readText()
                val json = JSONObject(response)
                val serverId = json.optString("SERVER_RUN_ID", "")
                
                // In a real scenario, you'd compare a numeric version code.
                // For now, we alert if the server hash is different from a cached one.
                // Or simply check if a new update is available.
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
