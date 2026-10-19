package com.tecnofusion.payalert.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.events.EventEmitter
import org.json.JSONArray
import org.json.JSONObject

class PayAlertNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName !in ALLOWED_PACKAGES) return
    val extras = sbn.notification.extras
    val notice = mapOf(
      "packageName" to sbn.packageName,
      "title" to extras.getCharSequence("android.title")?.toString().orEmpty(),
      "text" to (extras.getCharSequence("android.text")?.toString()
        ?: extras.getCharSequence("android.bigText")?.toString().orEmpty()),
      "postTime" to sbn.postTime,
      "key" to sbn.key,
    )
    val context = applicationContext
    val preferences = context.getSharedPreferences(PREFERENCES, 0)
    synchronized(QUEUE_LOCK) {
      val queue = readQueued(preferences).toMutableList()
      if (queue.none { it["key"] == sbn.key }) {
        queue.add(notice)
        val json = JSONArray()
        queue.takeLast(MAX_QUEUE_SIZE).forEach { item ->
          json.put(JSONObject().apply { item.forEach { (key, value) -> put(key, value) } })
        }
        preferences.edit().putString(QUEUE_KEY, json.toString()).apply()
      }
    }
    appContext?.emitEvent("notification", notice)
  }

  companion object {
    const val PREFERENCES = "payalert_notification_listener"
    const val QUEUE_KEY = "pending_notifications"
    private const val MAX_QUEUE_SIZE = 100
    private val ALLOWED_PACKAGES = setOf("com.mercadopago.wallet")
    private val QUEUE_LOCK = Any()
    fun queueLock(): Any = QUEUE_LOCK

    fun readQueued(preferences: android.content.SharedPreferences): List<Map<String, Any>> {
      val serialized = preferences.getString(QUEUE_KEY, null) ?: return emptyList()
      val array = try { JSONArray(serialized) } catch (_: Exception) { return emptyList() }
      return (0 until array.length()).mapNotNull { index ->
        val item = array.optJSONObject(index) ?: return@mapNotNull null
        val packageName = item.optString("packageName")
        if (packageName !in ALLOWED_PACKAGES) return@mapNotNull null
        mapOf(
          "packageName" to packageName,
          "title" to item.optString("title"),
          "text" to item.optString("text"),
          "postTime" to item.optLong("postTime"),
          "key" to item.optString("key"),
        )
      }
    }
  }
}
