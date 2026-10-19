package com.tecnofusion.payalert.notifications

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PayAlertNotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PayAlertNotificationListener")
    Events("notification")

    Function("isEnabled") {
      val context = appContext.reactContext ?: return@Function false
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    Function("openSettings") {
      val context = appContext.reactContext ?: return@Function
      context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Function("drainQueue") {
      val context = appContext.reactContext ?: return@Function emptyList<Map<String, Any>>()
      val preferences = context.getSharedPreferences(PayAlertNotificationListenerService.PREFERENCES, 0)
      synchronized(PayAlertNotificationListenerService.queueLock()) {
        val entries = PayAlertNotificationListenerService.readQueued(preferences)
        preferences.edit().remove(PayAlertNotificationListenerService.QUEUE_KEY).commit()
        entries
      }
    }
  }
}
