package expo.modules.extraappicons

import android.content.pm.PackageManager
import android.content.ComponentName
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class ExpoExtraAppIconsModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("ExpoExtraAppIcons")

    Function("setAppIcon") { name: String ->
      try {
        val pkg = context.packageName
        val pm = pm

        val iconList = getIconsFromManifest()
        val mainIconName = iconList.find { it.isMainIcon }?.name
            ?: throw IllegalStateException("Main icon not found")
        val mainAlias = "$pkg.MainActivity$mainIconName"
        val aliases = iconList.map { iconData -> "$pkg.MainActivity${iconData.name}" }

        val newAlias = if (name == "DEFAULT") mainAlias else "$pkg.MainActivity$name"

        aliases.filter { it != newAlias }.forEach { alias ->
            pm.setComponentEnabledSetting(
                ComponentName(pkg, alias),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            )
        }

        pm.setComponentEnabledSetting(
            ComponentName(pkg, newAlias),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        )

        SharedObject.icon = newAlias
        return@Function name
      } catch (e: Exception) {
        e.printStackTrace()
        return@Function false
      }
    }

    Function("getAppIcon") {
      val pkg = context.packageName
      val iconList = getIconsFromManifest()
      val mainIconName = iconList.find { it.isMainIcon }?.name
          ?: throw IllegalStateException("Main icon not found")
      val mainAlias = "$pkg.MainActivity$mainIconName"

      val className = currentActivity.componentName.className
      val currentIcon = SharedObject.icon.ifEmpty { className }
      val suffix = currentIcon.substringAfter("MainActivity", "")
      return@Function if (suffix.isEmpty()) mainAlias else suffix
    }
  }

  private val context
    get() = requireNotNull(appContext.reactContext) { "React Application Context is null" }

  private val currentActivity
    get() = requireNotNull(appContext.activityProvider?.currentActivity)

  private val pm
    get() = requireNotNull(currentActivity.packageManager)

  data class IconData(val name: String, val isMainIcon: Boolean)

  private fun getIconsFromManifest(): List<IconData> {
      return try {
          val ai = context.packageManager.getApplicationInfo(
              context.packageName,
              PackageManager.GET_META_DATA
          )
          val value = ai.metaData?.getString("expo.extra_app_icons") ?: "[]"
          val jsonArray = JSONArray(value)
          List(jsonArray.length()) { i ->
              val obj = jsonArray.getJSONObject(i)
              IconData(
                  name = obj.optString("name", ""),
                  isMainIcon = obj.optBoolean("isMainIcon", false)
              )
          }
      } catch (e: Exception) {
          e.printStackTrace()
          emptyList()
      }
  }
}
