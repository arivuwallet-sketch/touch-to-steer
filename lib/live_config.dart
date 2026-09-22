// GENERATED FILE - over-the-air settings sync.
// Downloads the latest app settings published from the web console and caches
// them on the device, so edits appear in the installed Android/iOS app without
// rebuilding or resubmitting to the stores.
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'app_config.dart';
import 'web_overrides.dart';

class Live {
  static const String _prefsKey = 'live_config_v1';
  static Map<String, dynamic> _data = <String, dynamic>{};
  static String _raw = '';

  /// Loads the last downloaded settings from disk (instant, offline safe).
  static Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString(_prefsKey);
      if (cached != null && cached.isNotEmpty) {
        _raw = cached;
        _data = jsonDecode(cached) as Map<String, dynamic>;
      }
    } catch (_) {
      _data = <String, dynamic>{};
    }
  }

  /// Fetches the newest settings. Returns true when something actually changed.
  static Future<bool> refresh() async {
    if (!AppConfig.liveSync) return false;
    try {
      final res = await http
          .get(Uri.parse(AppConfig.liveConfigUrl), headers: {
            'accept': 'application/json',
            'cache-control': 'no-cache',
          })
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return false;
      final body = res.body;
      final parsed = jsonDecode(body);
      if (parsed is! Map<String, dynamic>) return false;
      if (body == _raw) return false;
      _raw = body;
      _data = parsed;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, body);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Adds a cache-busting stamp so the web view shows the newest site content.
  static String freshUrl(String url) {
    if (url.isEmpty) return url;
    final uri = Uri.parse(url);
    final query = Map<String, String>.from(uri.queryParameters);
    query['_v'] = DateTime.now().millisecondsSinceEpoch.toString();
    return uri.replace(queryParameters: query).toString();
  }

  static String _s(String key, String fallback) {
    final value = _data[key];
    return value is String && value.isNotEmpty ? value : fallback;
  }

  static bool _b(String key, bool fallback) {
    final value = _data[key];
    return value is bool ? value : fallback;
  }

  static int _i(String key, int fallback) {
    final value = _data[key];
    return value is num ? value.toInt() : fallback;
  }

  static Color _c(String key, Color fallback) {
    final value = _data[key];
    if (value is String) {
      final hex = value.replaceAll('#', '');
      if (hex.length >= 6) {
        final parsed = int.tryParse(hex.substring(0, 6), radix: 16);
        if (parsed != null) return Color(0xFF000000 | parsed);
      }
    }
    return fallback;
  }

  static List<String> _l(String key, List<String> fallback) {
    final value = _data[key];
    if (value is List) return value.whereType<String>().toList();
    return fallback;
  }

  static String get startUrl => _s('startUrl', AppConfig.startUrl);
  static Color get themeColor => _c('themeColor', AppConfig.themeColor);
  static Color get accentColor => _c('accentColor', AppConfig.accentColor);
  static Color get splashBackground =>
      _c('splashBackground', AppConfig.splashBackground);
  static String get splashTagline => _s('splashTagline', AppConfig.splashTagline);
  static int get splashDurationMs =>
      _i('splashDurationMs', AppConfig.splashDurationMs);
  static String get customCss => _s('customCss', WebOverrides.css);
  static String get customJs => _s('customJs', WebOverrides.js);
  static List<String> get internalDomains =>
      _l('internalDomains', AppConfig.internalDomains);
  static List<String> get blockedUrlPatterns =>
      _l('blockedUrlPatterns', AppConfig.blockedUrlPatterns);
  static bool get bottomNav => _b('bottomNav', AppConfig.bottomNav);

  static List<Map<String, String>> get bottomNavItems {
    final value = _data['bottomNavItems'];
    if (value is List) {
      final items = value
          .whereType<Map>()
          .map((item) => {
                'label': (item['label'] ?? '').toString(),
                'url': (item['url'] ?? '').toString(),
                'icon': (item['icon'] ?? '').toString(),
              })
          .where((item) => item['url']!.isNotEmpty)
          .toList();
      if (items.isNotEmpty) return items;
    }
    return AppConfig.bottomNavItems
        .map((item) => Map<String, String>.from(item))
        .toList();
  }
}
