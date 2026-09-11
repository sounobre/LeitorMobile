package expo.modules.immersivemode

import android.app.Activity
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoImmersiveModeModule : Module() {
  private var systemBarsHidden = false

  private fun applySystemBarVisibility(activity: Activity, hidden: Boolean) {
    val window = activity.window
    val decorView = window.decorView

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(false)
      window.insetsController?.let { controller ->
        controller.systemBarsBehavior =
          WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (hidden) {
          controller.hide(WindowInsets.Type.systemBars())
        } else {
          controller.show(WindowInsets.Type.systemBars())
        }
      }
    } else {
      val immersiveFlags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      val flagsToClear = View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY

      decorView.systemUiVisibility = if (hidden) {
        decorView.systemUiVisibility or immersiveFlags
      } else {
        decorView.systemUiVisibility and flagsToClear.inv()
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoImmersiveMode")

    OnActivityEntersForeground {
      if (systemBarsHidden) {
        appContext?.currentActivity?.let { activity ->
          activity.runOnUiThread {
            applySystemBarVisibility(activity, hidden = true)
          }
        }
      }
    }

    AsyncFunction("setNavigationBarHidden") { hidden: Boolean ->
      systemBarsHidden = hidden
      val activity = appContext?.currentActivity ?: return@AsyncFunction

      activity.runOnUiThread {
        applySystemBarVisibility(activity, hidden)
      }
    }
  }
}
