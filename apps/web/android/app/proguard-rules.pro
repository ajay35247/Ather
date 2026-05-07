# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# Capacitor-safe keep rules
#
# R8/minification is enabled for release. Capacitor reflectively loads
# plugin classes and bridges JS <-> native via @PluginMethod / @JavascriptInterface.
# Stripping or renaming these breaks the bridge at runtime.
# ---------------------------------------------------------------------------

# Capacitor core, plugin classes, and annotated members
-keep class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}
-keepclassmembers,allowobfuscation class * {
    @com.getcapacitor.annotation.* *;
}
-dontwarn com.getcapacitor.**

# Cordova plugin shim used by Capacitor
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# Anything tagged @JavascriptInterface must keep its members for the WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# androidx WebKit + browser helper (used by Custom Tabs / web auth)
-dontwarn com.google.androidbrowserhelper.**
-dontwarn androidx.webkit.**

# Generated Capacitor plugin registry (when present)
-keep class com.omniverse.app.** { *; }

