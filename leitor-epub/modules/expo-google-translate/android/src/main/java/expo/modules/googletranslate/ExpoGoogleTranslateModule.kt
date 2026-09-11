package expo.modules.googletranslate

import android.content.Intent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoGoogleTranslateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoGoogleTranslate")

    AsyncFunction("openTranslation") {
      text: String,
      targetLanguage: String,
      promise: Promise ->
      val activity = appContext?.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      val intent = Intent(Intent.ACTION_PROCESS_TEXT).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_PROCESS_TEXT, text)
        putExtra(Intent.EXTRA_PROCESS_TEXT_READONLY, true)
        putExtra("com.google.android.apps.translate.extra.SOURCE_LANGUAGE", "auto")
        putExtra("com.google.android.apps.translate.extra.TARGET_LANGUAGE", targetLanguage)
        setPackage("com.google.android.apps.translate")
      }

      activity.runOnUiThread {
        try {
          if (intent.resolveActivity(activity.packageManager) == null) {
            promise.resolve(false)
          } else {
            activity.startActivity(intent)
            promise.resolve(true)
          }
        } catch (_: Exception) {
          promise.resolve(false)
        }
      }
    }
  }
}
