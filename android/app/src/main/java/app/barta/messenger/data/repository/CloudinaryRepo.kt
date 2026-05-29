package app.barta.messenger.data.repository

import android.content.Context
import android.net.Uri
import app.barta.messenger.data.local.SecurePrefs
import app.barta.messenger.data.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.jsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

object CloudinaryRepo {
    // Cloud name confirmed by user
    private const val CLOUD_NAME   = "dkinmtlgh"
    // TODO: Create an unsigned upload preset in Cloudinary → Settings → Upload Presets → Add preset (Unsigned)
    // Then set UPLOAD_PRESET to the preset name you create
    private const val UPLOAD_PRESET = "barta_avatars"  // Update when user creates the preset

    private val uploadUrl = "https://api.cloudinary.com/v1_1/$CLOUD_NAME/image/upload"

    /**
     * Upload a photo from a content URI to Cloudinary.
     * Returns the secure URL of the uploaded image.
     */
    suspend fun uploadAvatar(context: Context, imageUri: Uri): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val stream  = context.contentResolver.openInputStream(imageUri)!!
                val bytes   = stream.readBytes()
                stream.close()

                val mimeType = context.contentResolver.getType(imageUri) ?: "image/jpeg"
                val requestBody = bytes.toRequestBody(mimeType.toMediaType())

                val body = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", "avatar.jpg", requestBody)
                    .addFormDataPart("upload_preset", UPLOAD_PRESET)
                    .addFormDataPart("folder", "barta/avatars")
                    .build()

                val request = Request.Builder()
                    .url(uploadUrl)
                    .post(body)
                    .build()

                val response = ApiClient.http.newCall(request).execute()
                val text = response.body?.string() ?: throw Exception("Empty response")

                if (!response.isSuccessful) throw Exception("Upload failed: ${response.code}")

                // Parse the secure_url from Cloudinary JSON response
                val jsonEl = kotlinx.serialization.json.Json.parseToJsonElement(text)
                val url = jsonEl.jsonObject["secure_url"]?.toString()?.trim('"')
                    ?: throw Exception("No secure_url in response")

                // Save locally
                SecurePrefs.saveAvatarUrl(context, url)
                url
            }
        }
}
