// GENERATED FILE - localisation strings.
class AppStrings {
  static const Map<String, Map<String, String>> values = {
    'en': {
      'appName': 'touchtosteer',
      'offlineTitle': 'You are offline',
      'offlineMessage': 'Check your internet connection and try again.',
      'retry': 'Retry',
      'exitTitle': 'Leave app?',
      'exitMessage': 'Do you want to close the app?',
    },
  };

  static String t(String locale, String key) {
    final table = values[locale] ?? values['en'] ?? const {};
    return table[key] ?? key;
  }
}
