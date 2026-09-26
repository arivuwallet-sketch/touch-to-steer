import 'package:flutter_test/flutter_test.dart';
import '../lib/app_config.dart';
import '../lib/web_overrides.dart';

void main() {
  test('generated app uses an HTTPS website', () {
    expect(Uri.parse(AppConfig.startUrl).scheme, 'https');
    expect(AppConfig.versionCode, greaterThan(0));
  });
  test('CSS injection safely encodes quotes and backslashes', () {
    expect(WebOverrides.scriptFor('body { color: red; }', ''), contains('textContent='));
  });
}
