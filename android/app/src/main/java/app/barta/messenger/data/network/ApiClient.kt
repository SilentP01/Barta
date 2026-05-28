package app.barta.messenger.data.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

val json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    encodeDefaults = false
    explicitNulls = false
}
val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

class MemoryCookieJar : CookieJar {
    private val store = mutableMapOf<String, MutableList<Cookie>>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        store.getOrPut(url.host) { mutableListOf() }.apply {
            removeAll { c -> cookies.any { it.name == c.name } }
            addAll(cookies)
        }
    }
    override fun loadForRequest(url: HttpUrl): List<Cookie> = store[url.host] ?: emptyList()
    fun clear() = store.clear()
}

object ApiClient {
    const val BASE_URL = "https://barta.up.railway.app"
    val cookieJar = MemoryCookieJar()

    val http: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    suspend fun post(path: String, body: String): okhttp3.Response = withContext(Dispatchers.IO) {
        http.newCall(
            Request.Builder().url("$BASE_URL$path").post(body.toRequestBody(JSON_MEDIA)).build()
        ).execute()
    }

    suspend fun get(path: String): okhttp3.Response = withContext(Dispatchers.IO) {
        http.newCall(Request.Builder().url("$BASE_URL$path").get().build()).execute()
    }
}
