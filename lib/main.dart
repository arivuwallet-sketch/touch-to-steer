import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:file_selector/file_selector.dart';

import 'package:share_plus/share_plus.dart';
import 'app_config.dart';
import 'live_config.dart';
import 'web_overrides.dart';
import 'strings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Live.load();
  if (AppConfig.orientation == 'portrait') {
    await SystemChrome.setPreferredOrientations(
      [DeviceOrientation.portraitUp, DeviceOrientation.portraitDown],
    );
  } else if (AppConfig.orientation == 'landscape') {
    await SystemChrome.setPreferredOrientations(
      [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight],
    );
  }
  if (AppConfig.fullscreen) {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }
  SystemChrome.setSystemUIOverlayStyle(
    AppConfig.lightStatusBarIcons
        ? SystemUiOverlayStyle.light
        : SystemUiOverlayStyle.dark,
  );
  runApp(const WebApp());
}

class WebApp extends StatelessWidget {
  const WebApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Live.accentColor,
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: Live.themeColor,
      ),
      home: AppConfig.splashEnabled ? const SplashScreen() : const WebHome(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Timer(Duration(milliseconds: Live.splashDurationMs), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => const WebHome()),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Live.splashBackground,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset('assets/splash.png', width: 140, height: 140),
            const SizedBox(height: 24),
            if (Live.splashTagline.isNotEmpty)
              Text(
                Live.splashTagline,
                style: const TextStyle(color: Colors.white70, fontSize: 14),
              ),
            const SizedBox(height: 20),
            if (AppConfig.splashSpinner)
              CircularProgressIndicator(color: AppConfig.splashSpinnerColor),
          ],
        ),
      ),
    );
  }
}

class WebHome extends StatefulWidget {
  const WebHome({super.key});

  @override
  State<WebHome> createState() => _WebHomeState();
}

class _WebHomeState extends State<WebHome> with WidgetsBindingObserver {
  late final WebViewController _controller;
  bool _offline = false;
  bool _loading = true;
  int _navIndex = 0;
  String _locale = AppConfig.defaultLocale;
  Timer? _syncTimer;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  bool _syncing = false;
  bool _pageError = false;
  bool _unlocked = !AppConfig.biometricLock;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setupLocale();
    _setupController();
    _setupConnectivity();
    _startLiveSync();
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    _connectivitySubscription?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_syncLive());
    }
  }

  /// Pulls the newest settings published from the web console and applies them
  /// immediately - no reinstall, no store update.
  void _startLiveSync() {
    if (!AppConfig.liveSync) return;
    _syncLive();
    _syncTimer = Timer.periodic(const Duration(seconds: 60), (_) => _syncLive());
  }

  Future<void> _syncLive() async {
    if (!AppConfig.liveSync || !_unlocked || _syncing ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.paused) return;
    _syncing = true;
    final previousUrl = Live.startUrl;
    try {
      final changed = await Live.refresh();
      if (!changed || !mounted) return;
      setState(() { _navIndex = 0; });
      if (previousUrl != Live.startUrl) {
        await _controller.loadRequest(Uri.parse(Live.startUrl));
      } else {
        _inject();
      }
    } finally {
      _syncing = false;
    }
  }


  void _setupLocale() {
    if (!AppConfig.followSystemLocale) return;
    final system =
        WidgetsBinding.instance.platformDispatcher.locale.languageCode;
    if (AppConfig.supportedLocales.contains(system)) {
      _locale = system;
    }
  }

  Future<void> _setupConnectivity() async {
    void update(List<ConnectivityResult> result) {
      if (!mounted) return;
      final off = result.contains(ConnectivityResult.none);
      final reconnecting = _offline && !off;
      setState(() => _offline = off);
      if (reconnecting && _unlocked) _controller.reload();
    }
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen(update);
    update(await Connectivity().checkConnectivity());
  }

  void _setupController() {
    _controller = WebViewController()
      ..setJavaScriptMode(
        AppConfig.javascriptEnabled
            ? JavaScriptMode.unrestricted
            : JavaScriptMode.disabled,
      )
      ..setBackgroundColor(Live.themeColor)
      ..enableZoom(AppConfig.zoomEnabled)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() { _loading = true; _pageError = false; });
            if (AppConfig.injectTiming == 'documentStart') _inject();
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
            if (AppConfig.injectTiming == 'documentEnd') _inject();
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame == true && mounted) {
              setState(() { _loading = false; _pageError = true; });
            }
          },
          onNavigationRequest: _handleNavigation,
        ),
      );
    if (_controller.platform is AndroidWebViewController) {
      final android = _controller.platform as AndroidWebViewController;
      final cookies = WebViewCookieManager();
      if (cookies.platform is AndroidWebViewCookieManager) {
        (cookies.platform as AndroidWebViewCookieManager)
            .setAcceptThirdPartyCookies(android, AppConfig.thirdPartyCookies);
      }
      android.setOnShowFileSelector((params) async {
        try {
          final files = params.mode == FileSelectorMode.openMultiple
              ? await openFiles()
              : [if (await openFile() case final file?) file];
          return files.map((file) => Uri.file(file.path).toString()).toList();
        } catch (_) {
          return <String>[];
        }
      });
    }
    unawaited(_configureUserAgent());
    if (_unlocked) _controller.loadRequest(Uri.parse(Live.startUrl));
  }

  Future<void> _configureUserAgent() async {
    final base = await _controller.getUserAgent() ?? '';
    final ua = AppConfig.desktopMode
        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
        : base;
    if (ua.isNotEmpty) {
      await _controller.setUserAgent((ua + ' ' + AppConfig.userAgentSuffix).trim());
    }
  }

  void _inject() {
    final script = WebOverrides.scriptFor(Live.customCss, Live.customJs);
    if (AppConfig.javascriptEnabled && script.isNotEmpty) {
      _controller.runJavaScript(script);
    }
  }

  bool _isInternal(Uri uri) {
    if (Live.internalDomains.isEmpty) return true;
    return Live.internalDomains
        .any((d) => uri.host == d || uri.host.endsWith('.' + d));
  }

  Future<NavigationDecision> _handleNavigation(NavigationRequest request) async {
    if (!request.isMainFrame) return NavigationDecision.navigate;
    final uri = Uri.tryParse(request.url);
    if (uri == null) return NavigationDecision.prevent;

    for (final pattern in Live.blockedUrlPatterns) {
      if (pattern.isNotEmpty && request.url.contains(pattern)) {
        return NavigationDecision.prevent;
      }
    }

    if (AppConfig.handleMailto && uri.scheme == 'mailto') {
      await launchUrl(uri);
      return NavigationDecision.prevent;
    }
    if (AppConfig.handleTel && (uri.scheme == 'tel' || uri.scheme == 'sms')) {
      await launchUrl(uri);
      return NavigationDecision.prevent;
    }
    if (AppConfig.handleWhatsapp && (uri.host == 'wa.me' || uri.scheme == 'whatsapp')) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return NavigationDecision.prevent;
    }

    if (uri.scheme != 'https' && uri.scheme != 'http') {
      return NavigationDecision.prevent;
    }
    if (!_isInternal(uri) && AppConfig.openExternalInBrowser) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return NavigationDecision.prevent;
    }
    return NavigationDecision.navigate;
  }

  Future<bool> _onWillPop() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return false;
    }
    if (!AppConfig.confirmExit) return true;
    if (!mounted) return false;
    final leave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppStrings.t(_locale, 'exitTitle')),
        content: Text(AppStrings.t(_locale, 'exitMessage')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Exit'),
          ),
        ],
      ),
    );
    return leave ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _onWillPop() && mounted) await SystemNavigator.pop();
      },
      child: Scaffold(
        backgroundColor: Live.themeColor,
        body: SafeArea(
          top: !AppConfig.fullscreen,
          child: !_unlocked
              ? Center(child: const Text('App locked'))
              : _offline || _pageError ? _offlineView() : _webView(),
        ),
        floatingActionButton: FloatingActionButton.small(
          backgroundColor: Live.accentColor,
          onPressed: () =>
              SharePlus.instance.share(ShareParams(text: Live.startUrl)),
          child: const Icon(Icons.share),
        ),
        bottomNavigationBar: _unlocked && Live.bottomNav && Live.bottomNavItems.length >= 2
            ? BottomNavigationBar(
                currentIndex: _navIndex,
                type: BottomNavigationBarType.fixed,
                onTap: (index) {
                  setState(() => _navIndex = index);
                  _controller.loadRequest(
                    Uri.parse(Live.bottomNavItems[index]['url']!),
                  );
                },
                items: Live.bottomNavItems
                    .map(
                      (item) => BottomNavigationBarItem(
                        icon: const Icon(Icons.circle_outlined),
                        label: item['label'],
                      ),
                    )
                    .toList(),
              )
            : null,
      ),
    );
  }

  Widget _webView() {
    final view = Stack(
      children: [
        WebViewWidget(controller: _controller),
        if (_loading)
          Center(child: CircularProgressIndicator(color: Live.accentColor)),
      ],
    );
    if (!AppConfig.pullToRefresh) return view;
    return Stack(children: [
      Positioned.fill(child: view),
      Positioned(
        right: 12, top: 8,
        child: IconButton.filledTonal(
          tooltip: 'Refresh website',
          onPressed: () => _controller.reload(),
          icon: const Icon(Icons.refresh),
        ),
      ),
    ]);
  }

  Widget _offlineView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 56, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              AppStrings.t(_locale, 'offlineTitle'),
              style: const TextStyle(fontSize: 20, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              AppStrings.t(_locale, 'offlineMessage'),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () {
                setState(() { _offline = false; _pageError = false; });
                _controller.reload();
              },
              child: Text(AppStrings.t(_locale, 'retry')),
            ),
          ],
        ),
      ),
    );
  }
}
