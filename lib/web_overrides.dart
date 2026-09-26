// GENERATED FILE - website overrides injected into the web view.
import 'dart:convert';

class WebOverrides {
  static const String css = '';
  static const String js = 'document.querySelectorAll(\'a[target=\\"_blank\\"]\').forEach(function(a){a.removeAttribute(\'target\');});';

  static String script() => scriptFor(css, js);

  /// Builds the injection script for the given css/js. Live-synced overrides
  /// pass the freshly downloaded values here.
  static String scriptFor(String cssIn, String jsIn) {
    final buffer = StringBuffer();
    {
      buffer.writeln("(function(){var s=document.getElementById('nativeforge-style');"
          "if(!s){s=document.createElement('style');s.id='nativeforge-style';document.head.appendChild(s);}"
          "s.textContent=" + jsonEncode(cssIn) + ";})();");
    }
    if (jsIn.isNotEmpty) {
      buffer.writeln(jsIn);
    }
    return buffer.toString();
  }
}
