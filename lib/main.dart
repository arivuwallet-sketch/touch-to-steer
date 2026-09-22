import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'app_config.dart';
import 'live_config.dart';
import 'web_overrides.dart';
import 'strings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Live.load();
  unawaited(Live.refresh());
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setupLocale();
    _setupConnectivity();
    _setupController();
    _startLiveSync();
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_syncLive(forceWebRefresh: true));
    }
  }

  /// Pulls the newest settings published from the web console and applies them
  /// immediately - no reinstall, no store update.
  void _startLiveSync() {
    if (!AppConfig.liveSync) return;
    _syncLive();
    _syncTimer = Timer.periodic(const Duration(seconds: 60), (_) => _syncLive());
  }

  Future<void> _syncLive({bool forceWebRefresh = false}) async {
    if (!AppConfig.liveSync) {
      if (forceWebRefresh && mounted) {
        _controller.loadRequest(Uri.parse(Live.freshUrl(AppConfig.startUrl)));
      }
      return;
    }
    final changed = await Live.refresh();
    if ((!changed && !forceWebRefresh) || !mounted) return;
    setState(() {});
    _controller.loadRequest(Uri.parse(Live.freshUrl(Live.startUrl)));
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
    final result = await Connectivity().checkConnectivity();
    setState(() => _offline = result.contains(ConnectivityResult.none));
    Connectivity().onConnectivityChanged.listen((event) {
      final off = event.contains(ConnectivityResult.none);
      if (mounted) setState(() => _offline = off);
      if (!off) _controller.reload();
    });
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
            if (mounted) setState(() => _loading = true);
            if (AppConfig.injectTiming == 'documentStart') _inject();
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
            if (AppConfig.injectTiming == 'documentEnd') _inject();
          },
          onNavigationRequest: _handleNavigation,
        ),
      );
    final ua = AppConfig.userAgentSuffix;
    if (ua.isNotEmpty) {
      _controller.setUserAgent(
        (AppConfig.desktopMode
                ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/122.0 Safari/537.36 '
                : '') +
            ua,
      );
    }
    _controller.loadRequest(Uri.parse(Live.freshUrl(Live.startUrl)));
  }

  void _inject() {
    final script = WebOverrides.scriptFor(Live.customCss, Live.customJs);
    if (script.isNotEmpty) {
      _controller.runJavaScript(script);
    }
  }

  bool _isInternal(Uri uri) {
    if (Live.internalDomains.isEmpty) return true;
    return Live.internalDomains
        .any((d) => uri.host == d || uri.host.endsWith('.' + d));
  }

  Future<NavigationDecision> _handleNavigation(NavigationRequest request) async {
    final uri = Uri.parse(request.url);

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
    if (AppConfig.handleWhatsapp && uri.host.contains('wa.me')) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
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
        if (await _onWillPop() && mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        backgroundColor: Live.themeColor,
        body: SafeArea(
          top: !AppConfig.fullscreen,
          child: _offline ? _offlineView() : _webView(),
        ),
        floatingActionButton: FloatingActionButton.small(
          backgroundColor: Live.accentColor,
          onPressed: () =>
              SharePlus.instance.share(ShareParams(text: Live.startUrl)),
          child: const Icon(Icons.share),
        ),
        bottomNavigationBar: Live.bottomNav && Live.bottomNavItems.isNotEmpty
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
    return RefreshIndicator(
      onRefresh: () async => _controller.reload(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height - 24, child: view),
        ],
      ),
    );
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
              onPressed: () => _controller.reload(),
              child: Text(AppStrings.t(_locale, 'retry')),
            ),
          ],
        ),
      ),
    );
  }
}
