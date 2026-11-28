package com.allitcare.android

import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset

internal val koreaTime = ZoneOffset.ofHours(9)
internal const val TEST_ID = "native-alarm-diagnostic"

internal data class Occurrence(val id: String, val date: String, val due: Long, val title: String) {
    val key: String get() = "$id:$due"
}

internal class AlarmPlan(val raw: JSONObject) {
    val id = raw.getString("id").also { require(it.matches(Regex("[A-Za-z0-9_-]{1,120}")) && it != TEST_ID) }
    private val title = raw.getString("title").also { require(it.isNotBlank() && it.length <= 80) }
    private val time = LocalTime.of(raw.getInt("hour"), raw.getInt("minute"))
    private val rule = raw.getJSONObject("recurrence")
    private val mode = rule.getString("mode").also { require(it in setOf("once", "weekly", "range")) }
    private val start = LocalDate.parse(rule.getString(if (mode == "once") "date" else "startDate"))
    private val end = when (mode) {
        "once" -> start
        "range" -> LocalDate.parse(rule.getString("endDate")).also { require(it >= start) }
        else -> null
    }
    private val weekdays = if (mode == "weekly") rule.getJSONArray("weekdays").let { days ->
        (0 until days.length()).map { days.getInt(it) }.toSet().also { require(it.isNotEmpty() && it.all { day -> day in 1..7 }) }
    } else emptySet()
    private val completed = raw.getJSONArray("completedDates").let { dates ->
        (0 until dates.length()).map { LocalDate.parse(dates.getString(it)) }.toSet()
    }

    fun next(after: Long): Occurrence? {
        val today = Instant.ofEpochMilli(after).atOffset(koreaTime).toLocalDate()
        var day = maxOf(start, today)
        // At most a week between eligible weekdays, plus occurrences already completed.
        repeat((completed.size + 2) * 7) {
            if (end != null && day > end) return null
            val due = day.atTime(time).toInstant(koreaTime).toEpochMilli()
            if (due > after && day !in completed && (mode != "weekly" || day.dayOfWeek.value in weekdays)) {
                return Occurrence(id, day.toString(), due, title)
            }
            day = day.plusDays(1)
        }
        return null
    }
}
