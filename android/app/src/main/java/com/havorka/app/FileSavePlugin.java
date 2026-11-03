package com.havorka.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "FileSave")
public class FileSavePlugin extends Plugin {

    @PluginMethod
    public void initTempFile(PluginCall call) {
        String filename = call.getString("filename", "export_" + System.currentTimeMillis() + ".dat");
        try {
            // Sanitize filename to prevent directory traversal
            String safeName = new File(filename).getName();
            File cacheDir = new File(getContext().getCacheDir(), "exports");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File tempFile = new File(cacheDir, safeName);
            if (tempFile.exists()) {
                tempFile.delete();
            }
            tempFile.createNewFile();

            JSObject res = new JSObject();
            res.put("tempFilePath", tempFile.getAbsolutePath());
            call.resolve(res);
        } catch (Exception ex) {
            call.reject("INIT_TEMP_FAILED", "Failed to initialize temp file: " + ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void appendTempChunk(PluginCall call) {
        String tempFilePath = call.getString("tempFilePath");
        String chunkBase64 = call.getString("chunkBase64");

        if (tempFilePath == null || chunkBase64 == null) {
            call.reject("MISSING_ARGS", "tempFilePath and chunkBase64 are required");
            return;
        }

        try {
            File file = new File(tempFilePath);
            if (!file.exists()) {
                call.reject("FILE_NOT_FOUND", "Temp file does not exist: " + tempFilePath);
                return;
            }

            byte[] bytes = Base64.decode(chunkBase64, Base64.NO_WRAP);
            try (FileOutputStream fos = new FileOutputStream(file, true)) {
                fos.write(bytes);
                fos.flush();
            }

            JSObject res = new JSObject();
            res.put("bytesWritten", bytes.length);
            res.put("totalSize", file.length());
            call.resolve(res);
        } catch (Exception ex) {
            call.reject("APPEND_CHUNK_FAILED", "Failed to append chunk: " + ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void saveWithSAF(PluginCall call) {
        String tempFilePath = call.getString("tempFilePath");
        String suggestedName = call.getString("suggestedName");
        String mimeType = call.getString("mimeType", "*/*");

        if (tempFilePath == null) {
            call.reject("MISSING_ARGS", "tempFilePath is required");
            return;
        }

        File tempFile = new File(tempFilePath);
        if (!tempFile.exists()) {
            call.reject("FILE_NOT_FOUND", "Temporary file does not exist: " + tempFilePath);
            return;
        }

        if (suggestedName == null || suggestedName.isEmpty()) {
            suggestedName = tempFile.getName();
        }

        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "*/*");
            intent.putExtra(Intent.EXTRA_TITLE, suggestedName);

            startActivityForResult(call, intent, "handleSAFResult");
        } catch (Exception ex) {
            call.reject("SAF_LAUNCH_FAILED", "Failed to launch Storage Access Framework: " + ex.getMessage(), ex);
        }
    }

    @ActivityCallback
    private void handleSAFResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null && result.getData().getData() != null) {
            Uri targetUri = result.getData().getData();
            String tempFilePath = call.getString("tempFilePath");

            if (tempFilePath == null) {
                call.reject("INVALID_STATE", "tempFilePath missing from call context");
                return;
            }

            // Perform stream copy in a background thread to prevent any UI freezing
            getBridge().execute(() -> {
                File tempFile = new File(tempFilePath);
                try (InputStream in = new FileInputStream(tempFile);
                     OutputStream out = getContext().getContentResolver().openOutputStream(targetUri)) {
                    if (out == null) {
                        call.reject("OPEN_STREAM_FAILED", "Failed to open output stream for chosen URI");
                        return;
                    }

                    byte[] buffer = new byte[65536]; // 64 KB buffer
                    int read;
                    long totalBytes = 0;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        totalBytes += read;
                    }
                    out.flush();

                    // Query display name of the saved file
                    String displayName = null;
                    try (Cursor cursor = getContext().getContentResolver().query(targetUri, null, null, null, null)) {
                        if (cursor != null && cursor.moveToFirst()) {
                            int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                            if (nameIndex >= 0) {
                                displayName = cursor.getString(nameIndex);
                            }
                        }
                    } catch (Exception ignored) {}

                    // Clean up temp file
                    tempFile.delete();

                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("uri", targetUri.toString());
                    res.put("displayName", displayName != null ? displayName : targetUri.getLastPathSegment());
                    res.put("bytesWritten", totalBytes);
                    call.resolve(res);
                } catch (Exception ex) {
                    call.reject("STREAM_FAILED", "Failed streaming file to SAF URI: " + ex.getMessage(), ex);
                }
            });
        } else {
            // User cancelled folder/filename selection dialog
            JSObject res = new JSObject();
            res.put("cancelled", true);
            call.resolve(res);
        }
    }

    @PluginMethod
    public void shareTempFile(PluginCall call) {
        String tempFilePath = call.getString("tempFilePath");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType", "*/*");
        String dialogTitle = call.getString("dialogTitle", "Поделиться файлом");

        if (tempFilePath == null) {
            call.reject("MISSING_ARGS", "tempFilePath is required");
            return;
        }

        File tempFile = new File(tempFilePath);
        if (!tempFile.exists()) {
            call.reject("FILE_NOT_FOUND", "Temporary file does not exist: " + tempFilePath);
            return;
        }

        try {
            Context context = getContext();
            Uri contentUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                tempFile
            );

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "*/*");
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            if (filename != null) {
                intent.putExtra(Intent.EXTRA_SUBJECT, filename);
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(intent, dialogTitle);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);

            JSObject res = new JSObject();
            res.put("shared", true);
            call.resolve(res);
        } catch (Exception ex) {
            call.reject("SHARE_FAILED", "Failed to share file: " + ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void cleanTempFile(PluginCall call) {
        String tempFilePath = call.getString("tempFilePath");
        if (tempFilePath != null) {
            File file = new File(tempFilePath);
            if (file.exists()) {
                file.delete();
            }
        }
        JSObject res = new JSObject();
        res.put("cleaned", true);
        call.resolve(res);
    }
}
