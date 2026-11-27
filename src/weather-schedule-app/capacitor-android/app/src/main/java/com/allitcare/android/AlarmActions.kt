package com.allitcare.android

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal object AlarmActions {
    private fun prefs(context: Context) = context.getSharedPreferences("allit-alarm-actions-v1", Context.MODE_PRIVATE)

    @Synchronized
    fun all(context: Context): JSONArray = JSONArray(prefs(context).getString("items", "[]") ?: "[]")

    @Synchronized
    fun add(context: Context, id: String, date: String, action: String) {
        val events = all(context)
        events.put(JSONObject().put("key", UUID.randomUUID().toString()).put("id", id).put("date", date).put("action", action))
        check(prefs(context).edit().putString("items", events.toString()).commit())
    }

    @Synchronized
    fun remove(context: Context, key: String) {
        val events = all(context)
        val remaining = JSONArray()
        for (index in 0 until events.length()) events.getJSONObject(index).takeIf { it.optString("key") != key }?.let { remaining.put(it) }
        check(prefs(context).edit().putString("items", remaining.toString()).commit())
    }

    @Synchronized
    fun clear(context: Context) { check(prefs(context).edit().remove("items").commit()) }
}
