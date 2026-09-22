// GENERATED FILE - website overrides injected into the web view.
class WebOverrides {
  static const String css = '';
  static const String js = 'document.querySelectorAll(\'a[target=\\"_blank\\"]\').forEach(function(a){a.removeAttribute(\'target\');});';

  static String script() => scriptFor(css, js);

  /// Builds the injection script for the given css/js. Live-synced overrides
  /// pass the freshly downloaded values here.
  static String scriptFor(String cssIn, String jsIn) {
    final buffer = StringBuffer();
    if (cssIn.isNotEmpty) {
      final safe = cssIn.replaceAll('"', '\\"').replaceAll('\n', ' ');
      buffer.writeln("(function(){var s=document.createElement('style');"
          "s.type='text/css';s.appendChild(document.createTextNode(\"" +
          safe +
          "\"));document.head.appendChild(s);})();");
    }
    if (jsIn.isNotEmpty) {
      buffer.writeln(jsIn);
    }
    return buffer.toString();
  }
}
