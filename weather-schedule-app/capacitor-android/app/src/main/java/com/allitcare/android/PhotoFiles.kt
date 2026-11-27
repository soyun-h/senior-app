package com.allitcare.android

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID

internal object PhotoFiles {
    private val identifier = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
    fun directory(context: Context) = if (AccountAccess.isLegacy(context)) File(context.filesDir, "proofs")
        else File(context.filesDir, "account-proofs/${AccountAccess.owner(context)}")
    fun validName(name: String) = name.endsWith(".jpg") && identifier.matches(name.removeSuffix(".jpg"))

    fun file(context: Context, id: String): File {
        require(identifier.matches(id))
        return File(directory(context), "$id.jpg")
    }

    fun create(context: Context): File {
        val folder = directory(context)
        check(folder.isDirectory || folder.mkdirs())
        return file(context, UUID.randomUUID().toString()).apply { check(createNewFile()) }
    }

    fun checked(context: Context, id: String) = file(context, id).apply {
        check(isFile && length() > 0) { "저장된 사진을 찾을 수 없어요." }
    }

    fun importLegacy(context: Context, sourceId: String, id: String): Boolean {
        require(identifier.matches(sourceId) && AccountAccess.validUser(AccountAccess.owner(context)))
        val source = File(context.filesDir, "proofs/$sourceId.jpg")
        if (!source.isFile || source.length() == 0L) return false
        val target = file(context, id)
        if (target.isFile && target.length() > 0L) return true
        val directory = directory(context)
        check(directory.isDirectory || directory.mkdirs())
        val staged = File.createTempFile("legacy-", ".jpg", directory)
        try {
            source.copyTo(staged, overwrite = true)
            optimize(staged)
            check(staged.renameTo(target)) { "기존 사진을 복사하지 못했어요." }
            return true
        } finally { staged.delete() }
    }

    fun optimize(file: File) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        val largest = maxOf(bounds.outWidth, bounds.outHeight)
        check(largest > 0) { "촬영한 이미지의 형식을 확인할 수 없어요." }
        var sample = 1
        while (largest / sample > 2560) sample *= 2
        val decoded = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: error("촬영한 파일을 열 수 없어요.")
        val orientation = runCatching { ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) }.getOrDefault(1)
        val scale = minOf(1f, 1280f / maxOf(decoded.width, decoded.height))
        val transform = Matrix().apply {
            when (orientation) {
                2 -> setScale(-1f, 1f)
                3 -> setRotate(180f)
                4 -> setScale(1f, -1f)
                5 -> { setRotate(90f); postScale(-1f, 1f) }
                6 -> setRotate(90f)
                7 -> { setRotate(-90f); postScale(-1f, 1f) }
                8 -> setRotate(-90f)
            }
            postScale(scale, scale)
        }
        val image = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, transform, true)
        val output = File.createTempFile("opt-", ".jpg", file.parentFile)
        try {
            for (quality in listOf(86, 78, 70, 62)) {
                output.outputStream().use { check(image.compress(Bitmap.CompressFormat.JPEG, quality, it)) }
                if (output.length() <= 300 * 1024) break
            }
            check(output.length() in 1..1_048_576 && output.renameTo(file)) { "인증 사진을 저장하지 못했어요." }
        } finally {
            output.delete()
            if (image !== decoded) image.recycle()
            decoded.recycle()
        }
    }

    fun restore(context: Context, id: String, bytes: ByteArray): File {
        require(bytes.size in 4..1_048_576 && bytes[0].toInt() == -1 && bytes[1].toInt() == -40)
        val folder = directory(context)
        check(folder.isDirectory || folder.mkdirs())
        val target = file(context, id)
        val temporary = File.createTempFile("download-", ".jpg", folder)
        try { temporary.writeBytes(bytes); check(temporary.renameTo(target)) }
        finally { temporary.delete() }
        return target
    }

    fun messagingCopy(context: Context, photo: File): File {
        val cache = context.externalCacheDir ?: error("메시지에 첨부할 임시 사진을 만들 수 없어요.")
        return draftFile(draftDirectory(context, cache), ".jpg").also { photo.copyTo(it, overwrite = true) }
    }

    fun messageDraft(context: Context, text: String): File = draftFile(draftDirectory(context, context.cacheDir), ".txt").apply { writeText(text) }

    private fun draftDirectory(context: Context, cache: File) = if (AccountAccess.isLegacy(context)) File(cache, "message-drafts")
        else File(cache, "account-drafts/${AccountAccess.owner(context)}")

    private fun draftFile(folder: File, extension: String): File {
        check(folder.isDirectory || folder.mkdirs())
        val expiry = System.currentTimeMillis() - 86_400_000L
        folder.listFiles()?.filter { it.lastModified() < expiry }?.forEach { it.delete() }
        return File.createTempFile("message-", extension, folder)
    }

    fun shareUri(context: Context, file: File) = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}
