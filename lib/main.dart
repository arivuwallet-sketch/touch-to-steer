import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const _bg = Color(0xFF080A0D);
const _panel = Color(0xFF11151A);
const _panel2 = Color(0xFF171C22);
const _red = Color(0xFFE11D2E);
const _green = Color(0xFF22C55E);
const _amber = Color(0xFFF59E0B);
const _muted = Color(0xFF7D8793);

enum RigMode { pad, wheel, mouse }

class ControllerState {
  double steer = 0;
  double throttle = 0;
  double brake = 0;
  double clutch = 0;
  double handbrake = 0;
  double nitro = 0;
  double lx = 0, ly = 0, rx = 0, ry = 0;
  double lt = 0, rt = 0;
  int gear = 0;
  int dial = 0;
  final Map<String, bool> buttons = {};

  Map<String, dynamic> toJson() => {
        'steer': steer,
        'throttle': throttle,
        'brake': brake,
        'clutch': clutch,
        'handbrake': handbrake,
        'nitro': nitro,
        'lx': lx,
        'ly': ly,
        'rx': rx,
        'ry': ry,
        'lt': lt,
        'rt': rt,
        'gear': gear,
        'dial': dial,
        'wheelPlatform': 'ps4',
        'buttons': buttons,
      };

  void reset() {
    steer = throttle = brake = clutch = handbrake = nitro = 0;
    lx = ly = rx = ry = lt = rt = 0;
    gear = dial = 0;
    buttons.clear();
  }
}

class BridgeClient extends ChangeNotifier {
  WebSocket? _socket;
  Timer? _pump;
  final ControllerState state = ControllerState();
  String status = 'Disconnected';
  int latencyMs = 0;
  int packets = 0;
  double? speed, rpm, rpmMax;
  int? telemetryGear;
  String? telemetrySource;
  bool telemetryLive = false;
  String outputMode = 'universal';

  bool get connected => status == 'Connected';

  Future<void> connect(String url, {String output = 'universal'}) async {
    await disconnect(sendReset: false);
    outputMode = output;
    status = 'Connecting…';
    notifyListeners();
    try {
      final socket = await WebSocket.connect(url).timeout(const Duration(seconds: 5));
      socket.pingInterval = const Duration(seconds: 3);
      _socket = socket;
      status = 'Connected';
      notifyListeners();

      _send({
        'type': 'hello',
        'client': 'touch-to-steer-flutter',
        'version': 4,
        'transport': 'websocket',
        'rateHz': 240,
        'output': outputMode,
      });

      socket.listen(
        _onMessage,
        onError: (_) {
          if (identical(_socket, socket)) {
            status = 'Error';
            notifyListeners();
          }
        },
        onDone: () {
          if (identical(_socket, socket)) {
            _socket = null;
            _pump?.cancel();
            _pump = null;
            status = 'Disconnected';
            telemetryLive = false;
            notifyListeners();
          }
        },
        cancelOnError: false,
      );

      _pump = Timer.periodic(const Duration(milliseconds: 4), (_) {
        _sendState(priority: 'watchdog');
      });
      _sendState(priority: 'hot');
    } catch (_) {
      status = 'Error';
      notifyListeners();
    }
  }

  Future<void> disconnect({bool sendReset = true}) async {
    _pump?.cancel();
    _pump = null;
    if (sendReset && connected) {
      state.reset();
      _send({
        'type': 'state',
        'priority': 'edge',
        't': DateTime.now().millisecondsSinceEpoch,
        'seq': ++packets,
        ...state.toJson(),
      });
    }
    final s = _socket;
    _socket = null;
    try {
      await s?.close();
    } catch (_) {}
    status = 'Disconnected';
    telemetryLive = false;
    notifyListeners();
  }

  void resetState() {
    state.reset();
    if (connected) _sendState(priority: 'edge');
    notifyListeners();
  }

  void setValues(Map<String, dynamic> patch) {
    patch.forEach((k, v) {
      final n = (v as num).toDouble();
      switch (k) {
        case 'steer':
          state.steer = n;
        case 'throttle':
          state.throttle = n;
        case 'brake':
          state.brake = n;
        case 'clutch':
          state.clutch = n;
        case 'handbrake':
          state.handbrake = n;
        case 'nitro':
          state.nitro = n;
        case 'lx':
          state.lx = n;
        case 'ly':
          state.ly = n;
        case 'rx':
          state.rx = n;
        case 'ry':
          state.ry = n;
        case 'lt':
          state.lt = n;
        case 'rt':
          state.rt = n;
        case 'gear':
          state.gear = n.toInt();
        case 'dial':
          state.dial = n.toInt();
      }
    });
    if (connected) _sendState(priority: 'hot');
    notifyListeners();
  }

  void press(String id, bool down) {
    if (state.buttons[id] == down) return;
    state.buttons[id] = down;
    if (connected) _sendState(priority: 'edge');
    notifyListeners();
  }

  void _sendState({String priority = 'watchdog'}) {
    if (!connected) return;
    _send({
      'type': 'state',
      'priority': priority,
      't': DateTime.now().millisecondsSinceEpoch,
      'seq': ++packets,
      ...state.toJson(),
    });
  }

  void sendMouse({
    required String action,
    double dx = 0,
    double dy = 0,
    String? button,
    bool? down,
    double delta = 0,
  }) {
    if (!connected) return;
    _send({
      'type': 'mouse',
      't': DateTime.now().millisecondsSinceEpoch,
      'action': action,
      'dx': dx,
      'dy': dy,
      'button': button,
      'down': down,
      'delta': delta,
    });
  }

  void _send(Map<String, dynamic> message) {
    final socket = _socket;
    if (socket == null) return;
    try {
      socket.add(jsonEncode(message));
    } catch (_) {}
  }

  void _onMessage(dynamic raw) {
    try {
      final map = jsonDecode(raw.toString());
      if (map['type'] == 'ack' && map['t'] is num) {
        latencyMs = math.max(
          0,
          DateTime.now().millisecondsSinceEpoch - (map['t'] as num).toInt(),
        );
        notifyListeners();
      } else if (map['type'] == 'telemetry') {
        speed = (map['speed'] as num?)?.toDouble();
        rpm = (map['rpm'] as num?)?.toDouble();
        rpmMax = (map['rpmMax'] as num?)?.toDouble();
        telemetryGear = (map['gear'] as num?)?.toInt();
        telemetrySource = map['source']?.toString();
        telemetryLive = true;
        notifyListeners();
        Future<void>.delayed(const Duration(milliseconds: 600), () {
          telemetryLive = false;
          notifyListeners();
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _pump?.cancel();
    _socket?.close();
    super.dispose();
  }
}

class NativeSensors {
  static const EventChannel _channel = EventChannel('touch_to_steer/gyroscope');

  static Stream<Map<String, double>> get stream => _channel
      .receiveBroadcastStream()
      .map(
        (e) => Map<String, double>.from(
          (e as Map).map(
            (k, v) => MapEntry(k.toString(), (v as num).toDouble()),
          ),
        ),
      );
}

class NativeSettings {
  static const MethodChannel _channel = MethodChannel('touch_to_steer/settings');

  static Future<Map<String, dynamic>> load() async {
    try {
      final result = await _channel.invokeMethod<dynamic>('load');
      if (result is String && result.isNotEmpty) {
        return Map<String, dynamic>.from(jsonDecode(result));
      }
    } catch (_) {}
    return {};
  }

  static Future<void> save(Map<String, dynamic> settings) async {
    try {
      await _channel.invokeMethod('save', jsonEncode(settings));
    } catch (_) {}
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  runApp(const TouchToSteerApp());
}

class TouchToSteerApp extends StatelessWidget {
  const TouchToSteerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'TouchToSteer',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: _bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _red,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const RigScreen(),
    );
  }
}

class RigScreen extends StatefulWidget {
  const RigScreen({super.key});

  @override
  State<RigScreen> createState() => _RigScreenState();
}

class _RigScreenState extends State<RigScreen> {
  final BridgeClient bridge = BridgeClient();

  RigMode mode = RigMode.pad;
  String bridgeUrl = 'ws://192.168.1.10:8787';
  String outputMode = 'universal';
  String steerMode = 'touch';
  double sensitivity = 1;
  double steerSensitivity = 1;
  double deadzone = .05;
  double maxTiltDeg = 35;
  bool autoCentre = true;
  bool vibration = true;

  StreamSubscription<Map<String, double>>? sensorSub;

  @override
  void initState() {
    super.initState();
    bridge.addListener(_refresh);
    _loadSettings();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _loadSettings() async {
    final s = await NativeSettings.load();
    if (!mounted) return;
    setState(() {
      bridgeUrl = (s['bridgeUrl'] as String?) ?? bridgeUrl;
      outputMode = (s['outputMode'] as String?) ?? outputMode;
      steerMode = (s['steerMode'] as String?) ?? steerMode;
      sensitivity = ((s['sensitivity'] as num?) ?? sensitivity).toDouble();
      steerSensitivity =
          ((s['steerSensitivity'] as num?) ?? steerSensitivity).toDouble();
      deadzone = ((s['deadzone'] as num?) ?? deadzone).toDouble();
      maxTiltDeg = ((s['maxTiltDeg'] as num?) ?? maxTiltDeg).toDouble();
      autoCentre = (s['autoCentre'] as bool?) ?? autoCentre;
      vibration = (s['vibration'] as bool?) ?? vibration;
    });
    if (steerMode == 'tilt') _enableGyro();
  }

  Future<void> _saveSettings() => NativeSettings.save({
        'bridgeUrl': bridgeUrl,
        'outputMode': outputMode,
        'steerMode': steerMode,
        'sensitivity': sensitivity,
        'steerSensitivity': steerSensitivity,
        'deadzone': deadzone,
        'maxTiltDeg': maxTiltDeg,
        'autoCentre': autoCentre,
        'vibration': vibration,
      });

  void _switchMode(RigMode next) {
    bridge.resetState();
    setState(() {
      mode = next;
    });
    if (next == RigMode.wheel && steerMode == 'tilt') {
      _enableGyro();
    }
  }

  Future<void> _showSettings() async {
    final url = TextEditingController(text: bridgeUrl);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _panel,
      barrierColor: Colors.black54,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 24),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Expanded(
                      child: Text(
                        'Controller settings',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  TextField(
                    controller: url,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'PC bridge WebSocket',
                      hintText: 'ws://192.168.1.10:8787',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Windows output',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'universal',
                        label: Text('Universal'),
                      ),
                      ButtonSegment(
                        value: 'xinput',
                        label: Text('XInput'),
                      ),
                      ButtonSegment(
                        value: 'ds4',
                        label: Text('DS4'),
                      ),
                    ],
                    selected: {outputMode},
                    onSelectionChanged: (v) =>
                        setSheet(() => outputMode = v.first),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Steering',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'touch',
                        label: Text('Touch wheel'),
                      ),
                      ButtonSegment(value: 'tilt', label: Text('Gyro')),
                    ],
                    selected: {steerMode},
                    onSelectionChanged: (v) {
                      setSheet(() => steerMode = v.first);
                      if (v.first == 'tilt') {
                        _enableGyro();
                      } else {
                        _disableGyro();
                      }
                    },
                  ),
                  _slider(
                    'Steer sensitivity',
                    steerSensitivity,
                    0.5,
                    2,
                    (v) => setSheet(() => steerSensitivity = v),
                  ),
                  _slider(
                    'Deadzone',
                    deadzone,
                    0,
                    .2,
                    (v) => setSheet(() => deadzone = v),
                  ),
                  _slider(
                    'Max gyro tilt',
                    maxTiltDeg,
                    15,
                    60,
                    (v) => setSheet(() => maxTiltDeg = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Auto-centre wheel'),
                    value: autoCentre,
                    onChanged: (v) => setSheet(() => autoCentre = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Haptic feedback'),
                    value: vibration,
                    onChanged: (v) => setSheet(() => vibration = v),
                  ),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () async {
                          bridgeUrl = url.text.trim();
                          await _saveSettings();
                          if (bridge.connected) {
                            await bridge.disconnect();
                          } else {
                            await bridge.connect(
                              bridgeUrl,
                              output: outputMode,
                            );
                          }
                          if (context.mounted) Navigator.pop(context);
                          if (steerMode == 'tilt') {
                            _enableGyro();
                          }
                          if (mounted) setState(() {});
                        },
                        icon: Icon(
                          bridge.connected ? Icons.link_off : Icons.link,
                        ),
                        label: Text(
                          bridge.connected ? 'Disconnect' : 'Save & Connect',
                        ),
                      ),
                    ),
                  ]),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    url.dispose();
    await _saveSettings();
    if (steerMode == 'tilt') {
      _enableGyro();
    } else {
      _disableGyro();
    }
  }

  Widget _slider(
    String label,
    double value,
    double min,
    double max,
    ValueChanged<double> fn,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: Text(label)),
            Text(
              value.toStringAsFixed(2),
              style: const TextStyle(color: _muted),
            ),
          ],
        ),
        Slider(
          value: value.clamp(min, max),
          min: min,
          max: max,
          onChanged: fn,
        ),
      ],
    );
  }

  void _enableGyro() {
    sensorSub ??= NativeSensors.stream.listen((v) {
      if (mode != RigMode.wheel || steerMode != 'tilt') return;
      final roll = v['roll'] ?? 0;
      final raw =
          ((roll * 180 / math.pi) / maxTiltDeg).clamp(-1.0, 1.0);
      final curved = _curve(
        raw,
        deadzone,
        1.4,
        steerSensitivity,
      );
      bridge.setValues({'steer': curved});
    });
  }

  void _disableGyro() {
    sensorSub?.cancel();
    sensorSub = null;
    bridge.setValues({'steer': 0});
  }

  double _curve(
    double value,
    double dz,
    double linearity,
    double sensitivityValue,
  ) {
    final sign = value.isNegative ? -1.0 : 1.0;
    var m = value.abs();
    if (m <= dz) return 0;
    m = (m - dz) / (1 - dz);
    m = math.pow(m, linearity).toDouble() * sensitivityValue;
    return sign * m.clamp(0, 1);
  }

  @override
  void dispose() {
    sensorSub?.cancel();
    bridge.removeListener(_refresh);
    bridge.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(child: _modeView()),
          Positioned(
            top: 10,
            right: 10,
            child: Row(
              children: [
                _topButton(
                  Icons.gamepad_rounded,
                  mode == RigMode.pad,
                  () => _switchMode(RigMode.pad),
                ),
                const SizedBox(width: 6),
                _topButton(
                  Icons.speed_rounded,
                  mode == RigMode.wheel,
                  () => _switchMode(RigMode.wheel),
                ),
                const SizedBox(width: 6),
                _topButton(
                  Icons.mouse_rounded,
                  mode == RigMode.mouse,
                  () => _switchMode(RigMode.mouse),
                ),
                const SizedBox(width: 6),
                _topButton(
                  Icons.settings_rounded,
                  false,
                  _showSettings,
                  statusDot: true,
                ),
              ],
            ),
          ),
          Positioned(
            left: 12,
            top: 12,
            child: _statusPill(),
          ),
        ],
      ),
    );
  }

  Widget _topButton(
    IconData icon,
    bool active,
    VoidCallback onTap, {
    bool statusDot = false,
  }) {
    return Material(
      color: active ? _red : Colors.black.withValues(alpha: .55),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            SizedBox(
              width: 46,
              height: 42,
              child: Icon(icon, size: 21),
            ),
            if (statusDot)
              Positioned(
                right: 5,
                top: 5,
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: bridge.connected ? _green : _muted,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _statusPill() {
    final statusColor = bridge.connected
        ? _green
        : (bridge.status == 'Error' ? _red : _muted);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: .48),
        border: Border.all(color: Colors.white12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: statusColor,
              ),
            ),
            const SizedBox(width: 7),
            Text(
              bridge.status.toUpperCase(),
              style: const TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.2,
              ),
            ),
            if (bridge.latencyMs > 0) ...[
              const SizedBox(width: 9),
              Text(
                '${bridge.latencyMs} ms',
                style: const TextStyle(fontSize: 9, color: _muted),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _modeView() {
    switch (mode) {
      case RigMode.wheel:
        return WheelRig(
          bridge: bridge,
          steerMode: steerMode,
          steerSensitivity: steerSensitivity,
          deadzone: deadzone,
          autoCentre: autoCentre,
          vibration: vibration,
        );
      case RigMode.mouse:
        return MouseRig(bridge: bridge, vibration: vibration);
      case RigMode.pad:
        return GamepadRig(bridge: bridge, vibration: vibration);
    }
  }
}

class GamepadRig extends StatelessWidget {
  final BridgeClient bridge;
  final bool vibration;

  const GamepadRig({
    super.key,
    required this.bridge,
    required this.vibration,
  });

  void _haptic() {
    if (vibration) HapticFeedback.selectionClick();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _bg,
      child: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: CustomPaint(painter: GridPainter()),
            ),
            Positioned(
              left: 14,
              top: 62,
              child: Row(
                children: [
                  _HoldButton(
                    label: 'LB',
                    onChanged: (v) => bridge.press('lb', v),
                    onStart: _haptic,
                  ),
                  const SizedBox(width: 10),
                  _HoldButton(
                    label: 'LT',
                    analog: true,
                    onAnalog: (v) => bridge.setValues({'lt': v}),
                    onStart: _haptic,
                  ),
                ],
              ),
            ),
            Positioned(
              right: 14,
              top: 62,
              child: Row(
                children: [
                  _HoldButton(
                    label: 'RT',
                    analog: true,
                    onAnalog: (v) => bridge.setValues({'rt': v}),
                    onStart: _haptic,
                  ),
                  const SizedBox(width: 10),
                  _HoldButton(
                    label: 'RB',
                    onChanged: (v) => bridge.press('rb', v),
                    onStart: _haptic,
                  ),
                ],
              ),
            ),
            Positioned(
              left: 22,
              bottom: 26,
              child: Column(
                children: [
                  const Text(
                    'D-PAD',
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                      color: _muted,
                    ),
                  ),
                  const SizedBox(height: 7),
                  _DPad(bridge: bridge, vibration: vibration),
                ],
              ),
            ),
            Positioned(
              left: 182,
              bottom: 18,
              child: _Stick(
                label: 'L-STICK',
                onChanged: (x, y) =>
                    bridge.setValues({'lx': x, 'ly': y}),
              ),
            ),
            Positioned(
              left: 330,
              bottom: 18,
              child: _Stick(
                label: 'R-STICK',
                onChanged: (x, y) =>
                    bridge.setValues({'rx': x, 'ry': y}),
              ),
            ),
            Positioned(
              right: 24,
              bottom: 34,
              child: Row(
                children: [
                  _ABXYButton(
                    label: 'X',
                    id: 'x',
                    color: const Color(0xFF3B82F6),
                    onChanged: (v) => bridge.press('x', v),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    children: [
                      _ABXYButton(
                        label: 'Y',
                        id: 'y',
                        color: _amber,
                        onChanged: (v) => bridge.press('y', v),
                      ),
                      const SizedBox(height: 12),
                      _ABXYButton(
                        label: 'A',
                        id: 'a',
                        color: _green,
                        onChanged: (v) => bridge.press('a', v),
                      ),
                    ],
                  ),
                  const SizedBox(width: 12),
                  _ABXYButton(
                    label: 'B',
                    id: 'b',
                    color: _red,
                    onChanged: (v) => bridge.press('b', v),
                  ),
                ],
              ),
            ),
            Positioned(
              bottom: 14,
              left: 14,
              child: Row(
                children: [
                  _SmallButton(
                    'BACK',
                    () => bridge.press('back', true),
                    () => bridge.press('back', false),
                  ),
                  const SizedBox(width: 8),
                  _SmallButton(
                    'START',
                    () => bridge.press('start', true),
                    () => bridge.press('start', false),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SmallButton extends StatelessWidget {
  final String label;
  final VoidCallback down;
  final VoidCallback up;

  const _SmallButton(this.label, this.down, this.up);

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTapDown: (_) => down(),
        onTapUp: (_) => up(),
        onTapCancel: up,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 9,
          ),
          decoration: BoxDecoration(
            color: _panel2,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white10),
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 8,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
            ),
          ),
        ),
      );
}

class _HoldButton extends StatefulWidget {
  final String label;
  final ValueChanged<bool>? onChanged;
  final ValueChanged<double>? onAnalog;
  final VoidCallback onStart;
  final bool analog;

  const _HoldButton({
    required this.label,
    this.onChanged,
    this.onAnalog,
    required this.onStart,
    this.analog = false,
  });

  @override
  State<_HoldButton> createState() => _HoldButtonState();
}

class _HoldButtonState extends State<_HoldButton> {
  double value = 0;

  void _update(double dx, double width) {
    final v = widget.analog
        ? (dx / width).clamp(0.0, 1.0)
        : 1.0;
    setState(() => value = v);
    widget.onAnalog?.call(v);
  }

  void _end() {
    if (widget.analog) widget.onAnalog?.call(0);
    widget.onChanged?.call(false);
    setState(() => value = 0);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTapDown: (d) {
          widget.onStart();
          widget.onChanged?.call(true);
          if (widget.analog) {
            _update(d.localPosition.dx, 120);
          }
        },
        onHorizontalDragUpdate: widget.analog
            ? (d) => _update(d.localPosition.dx, 120)
            : null,
        onHorizontalDragEnd:
            widget.analog ? (_) => _end() : null,
        onTapUp: (_) => _end(),
        onTapCancel: _end,
        child: Container(
          width: 120,
          height: 38,
          decoration: BoxDecoration(
            color: Color.lerp(
              _panel2,
              _red,
              (value * .85).clamp(0, 1),
            ),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white12),
          ),
          alignment: Alignment.center,
          child: Text(
            widget.label,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.8,
            ),
          ),
        ),
      );
}

class _DPad extends StatelessWidget {
  final BridgeClient bridge;
  final bool vibration;

  const _DPad({
    required this.bridge,
    required this.vibration,
  });

  @override
  Widget build(BuildContext context) {
    Widget cell(String id, String label) => GestureDetector(
          onTapDown: (_) {
            if (vibration) HapticFeedback.selectionClick();
            bridge.press(id, true);
          },
          onTapUp: (_) => bridge.press(id, false),
          onTapCancel: () => bridge.press(id, false),
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: _panel2,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white10),
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        );

    return Column(
      children: [
        cell('dpad_up', '▲'),
        const SizedBox(height: 7),
        Row(
          children: [
            cell('dpad_left', '◀'),
            const SizedBox(width: 14),
            cell('dpad_right', '▶'),
          ],
        ),
        const SizedBox(height: 7),
        cell('dpad_down', '▼'),
      ],
    );
  }
}

class _Stick extends StatefulWidget {
  final String label;
  final void Function(double x, double y) onChanged;

  const _Stick({
    required this.label,
    required this.onChanged,
  });

  @override
  State<_Stick> createState() => _StickState();
}

class _StickState extends State<_Stick> {
  Offset value = Offset.zero;

  void _set(Offset p, Size s) {
    final center = Offset(s.width / 2, s.height / 2);
    var delta = p - center;
    final maxR = s.shortestSide * .34;
    if (delta.distance > maxR) {
      delta = delta / delta.distance * maxR;
    }
    final normalized = Offset(
      delta.dx / maxR,
      delta.dy / maxR,
    );
    setState(() => value = normalized);
    widget.onChanged(normalized.dx, normalized.dy);
  }

  void _end() {
    setState(() => value = Offset.zero);
    widget.onChanged(0, 0);
  }

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text(
            widget.label,
            style: const TextStyle(
              fontSize: 8,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
              color: _muted,
            ),
          ),
          const SizedBox(height: 5),
          GestureDetector(
            onPanDown: (d) =>
                _set(d.localPosition, const Size(132, 132)),
            onPanUpdate: (d) =>
                _set(d.localPosition, const Size(132, 132)),
            onPanEnd: (_) => _end(),
            onPanCancel: _end,
            child: CustomPaint(
              size: const Size(132, 132),
              painter: StickPainter(value),
            ),
          ),
        ],
      );
}

class StickPainter extends CustomPainter {
  final Offset value;

  StickPainter(this.value);

  @override
  void paint(Canvas c, Size s) {
    final center = Offset(s.width / 2, s.height / 2);
    final base = Paint()..color = _panel2;
    final ring = Paint()
      ..color = Colors.white10
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    c.drawCircle(center, s.width * .47, base);
    c.drawCircle(center, s.width * .47, ring);
    final pos = center +
        Offset(
          value.dx * s.width * .28,
          value.dy * s.height * .28,
        );
    c.drawCircle(
      pos,
      s.width * .13,
      Paint()..color = _red,
    );
  }

  @override
  bool shouldRepaint(covariant StickPainter old) =>
      old.value != value;
}

class _ABXYButton extends StatelessWidget {
  final String label, id;
  final Color color;
  final ValueChanged<bool> onChanged;

  const _ABXYButton({
    required this.label,
    required this.id,
    required this.color,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTapDown: (_) {
          HapticFeedback.selectionClick();
          onChanged(true);
        },
        onTapUp: (_) => onChanged(false),
        onTapCancel: () => onChanged(false),
        child: Container(
          width: 62,
          height: 62,
          decoration: BoxDecoration(
            color: Color.alphaBlend(
              color.withValues(alpha: .18),
              _panel2,
            ),
            shape: BoxShape.circle,
            border: Border.all(
              color: color.withValues(alpha: .55),
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: .14),
                blurRadius: 18,
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ),
      );
}

class WheelRig extends StatefulWidget {
  final BridgeClient bridge;
  final String steerMode;
  final double steerSensitivity;
  final double deadzone;
  final bool autoCentre;
  final bool vibration;

  const WheelRig({
    super.key,
    required this.bridge,
    required this.steerMode,
    required this.steerSensitivity,
    required this.deadzone,
    required this.autoCentre,
    required this.vibration,
  });

  @override
  State<WheelRig> createState() => _WheelRigState();
}

class _WheelRigState extends State<WheelRig>
    with SingleTickerProviderStateMixin {
  double wheelAngle = 0;
  Offset? lastPoint;
  AnimationController? centerController;
  late Animation<double> centerAnimation;

  double get maxLock => 450;

  @override
  void dispose() {
    centerController?.dispose();
    super.dispose();
  }

  void _setWheelFromPoint(Offset local, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final angle = math.atan2(
      local.dy - center.dy,
      local.dx - center.dx,
    );
    if (lastPoint == null) {
      lastPoint = local;
      return;
    }
    final previous = math.atan2(
      lastPoint!.dy - center.dy,
      lastPoint!.dx - center.dx,
    );
    var delta = angle - previous;
    while (delta > math.pi) {
      delta -= math.pi * 2;
    }
    while (delta < -math.pi) {
      delta += math.pi * 2;
    }
    lastPoint = local;
    wheelAngle =
        (wheelAngle + delta * 180 / math.pi).clamp(
      -maxLock,
      maxLock,
    );
    final raw = wheelAngle / maxLock;
    widget.bridge.setValues({'steer': _curve(raw)});
    setState(() {});
  }

  double _curve(double raw) {
    final sign = raw.isNegative ? -1.0 : 1.0;
    var m = raw.abs();
    if (m <= widget.deadzone) return 0;
    m = (m - widget.deadzone) / (1 - widget.deadzone);
    m = math.pow(m, 1.4).toDouble() *
        widget.steerSensitivity;
    return sign * m.clamp(0, 1);
  }

  void _centre() {
    if (!widget.autoCentre) {
      lastPoint = null;
      return;
    }
    centerController?.dispose();
    centerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    centerAnimation = Tween<double>(
      begin: wheelAngle,
      end: 0,
    ).animate(
      CurvedAnimation(
        parent: centerController!,
        curve: Curves.easeOutCubic,
      ),
    )..addListener(() {
        wheelAngle = centerAnimation.value;
        widget.bridge.setValues({
          'steer': _curve(wheelAngle / maxLock),
        });
        setState(() {});
      });
    centerController!.forward();
    lastPoint = null;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _bg,
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: WheelBackgroundPainter(),
            ),
          ),
          Positioned(
            left: 18,
            top: 58,
            child: _telemetryCard(),
          ),
          Positioned(
            left: 20,
            bottom: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LOGITECH G29 STYLE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  widget.steerMode == 'touch'
                      ? 'Touch 900° • release to auto-centre'
                      : 'Gyro steering • tilt phone',
                  style: const TextStyle(
                    fontSize: 8,
                    color: _muted,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 36,
            bottom: 42,
            width: 410,
            height: 410,
            child: GestureDetector(
              onPanStart: (d) {
                if (widget.steerMode == 'tilt') return;
                centerController?.stop();
                lastPoint = d.localPosition;
                if (widget.vibration) {
                  HapticFeedback.selectionClick();
                }
              },
              onPanUpdate: (d) {
                if (widget.steerMode == 'tilt') return;
                _setWheelFromPoint(
                  d.localPosition,
                  const Size(410, 410),
                );
              },
              onPanEnd: (_) => _centre(),
              onPanCancel: _centre,
              child: Transform.rotate(
                angle: wheelAngle * math.pi / 180,
                child: CustomPaint(
                  painter: WheelPainter(),
                ),
              ),
            ),
          ),
          Positioned(
            left: 485,
            bottom: 40,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                _Pedal(
                  label: 'BRAKE',
                  color: _red,
                  onChanged: (v) =>
                      widget.bridge.setValues({'brake': v}),
                ),
                const SizedBox(width: 20),
                _Pedal(
                  label: 'GAS',
                  color: _green,
                  onChanged: (v) =>
                      widget.bridge.setValues({'throttle': v}),
                ),
              ],
            ),
          ),
          Positioned(
            right: 22,
            bottom: 52,
            child: Column(
              children: [
                _Action(
                  label: 'HANDBRAKE',
                  color: _red,
                  onDown: () => widget.bridge
                      .setValues({'handbrake': 1}),
                  onUp: () => widget.bridge
                      .setValues({'handbrake': 0}),
                ),
                const SizedBox(height: 12),
                _Action(
                  label: 'NITRO',
                  color: _amber,
                  onDown: () => widget.bridge
                      .setValues({'nitro': 1}),
                  onUp: () => widget.bridge
                      .setValues({'nitro': 0}),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _telemetryCard() {
    final live = widget.bridge.telemetryLive;
    return Container(
      padding: const EdgeInsets.all(12),
      width: 190,
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: .42),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'TELEMETRY',
                style: TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.7,
                ),
              ),
              const Spacer(),
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: live ? _green : _muted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            live && widget.bridge.speed != null
                ? '${widget.bridge.speed!.round()} KM/H'
                : '-- KM/H',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            live && widget.bridge.rpm != null
                ? '${widget.bridge.rpm!.round()} RPM'
                : '-- RPM',
            style: const TextStyle(
              fontSize: 10,
              color: _muted,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            live && widget.bridge.telemetryGear != null
                ? 'GEAR ${widget.bridge.telemetryGear}'
                : 'GEAR --',
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (live && widget.bridge.telemetrySource != null) ...[
            const SizedBox(height: 4),
            Text(
              widget.bridge.telemetrySource!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 7,
                color: _muted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Pedal extends StatefulWidget {
  final String label;
  final Color color;
  final ValueChanged<double> onChanged;

  const _Pedal({
    required this.label,
    required this.color,
    required this.onChanged,
  });

  @override
  State<_Pedal> createState() => _PedalState();
}

class _PedalState extends State<_Pedal> {
  double value = 0;

  void _update(Offset local, Size size) {
    final v =
        ((size.height - local.dy) / size.height).clamp(0.0, 1.0);
    setState(() => value = v);
    widget.onChanged(v);
  }

  void _end() {
    setState(() => value = 0);
    widget.onChanged(0);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        onPanDown: (d) =>
            _update(d.localPosition, const Size(92, 220)),
        onPanUpdate: (d) =>
            _update(d.localPosition, const Size(92, 220)),
        onPanEnd: (_) => _end(),
        onPanCancel: _end,
        child: Container(
          width: 92,
          height: 220,
          decoration: BoxDecoration(
            color: _panel2,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white10),
          ),
          child: Stack(
            children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: 220 * value,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: widget.color.withValues(alpha: .80),
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
              ),
              Center(
                child: RotatedBox(
                  quarterTurns: 3,
                  child: Text(
                    widget.label,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 10,
                right: 11,
                child: Text(
                  '${(value * 100).round()}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: _muted,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

class _Action extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onDown;
  final VoidCallback onUp;

  const _Action({
    required this.label,
    required this.color,
    required this.onDown,
    required this.onUp,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTapDown: (_) {
          HapticFeedback.selectionClick();
          onDown();
        },
        onTapUp: (_) => onUp(),
        onTapCancel: onUp,
        child: Container(
          width: 120,
          height: 58,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(13),
            border: Border.all(
              color: color.withValues(alpha: .45),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w900,
              color: color,
              letterSpacing: 1.2,
            ),
          ),
        ),
      );
}

class WheelPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final center = Offset(s.width / 2, s.height / 2);
    final r = math.min(s.width, s.height) * .44;
    c.drawCircle(
      center,
      r,
      Paint()..color = const Color(0xFF15191E),
    );
    c.drawCircle(
      center,
      r * .95,
      Paint()
        ..color = const Color(0xFF080A0D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 12,
    );
    c.drawCircle(
      center,
      r * .89,
      Paint()
        ..color = const Color(0xFF252A30)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5,
    );
    c.drawArc(
      Rect.fromCircle(center: center, radius: r * .76),
      -2.6,
      5.2,
      false,
      Paint()
        ..color = const Color(0xFF5D646D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * .17
        ..strokeCap = StrokeCap.round,
    );
    final spoke = Paint()
      ..color = const Color(0xFF737B84)
      ..strokeWidth = r * .15
      ..strokeCap = StrokeCap.round;
    c.drawLine(
      center,
      Offset(
        center.dx - r * .62,
        center.dy - r * .10,
      ),
      spoke,
    );
    c.drawLine(
      center,
      Offset(
        center.dx + r * .62,
        center.dy - r * .10,
      ),
      spoke,
    );
    c.drawLine(
      center,
      Offset(
        center.dx,
        center.dy + r * .46,
      ),
      spoke,
    );
    c.drawCircle(
      center,
      r * .22,
      Paint()..color = const Color(0xFF1C2025),
    );
    c.drawCircle(
      center,
      r * .17,
      Paint()..color = const Color(0xFF2E343B),
    );
    c.drawRect(
      Rect.fromCenter(
        center: Offset(
          center.dx,
          center.dy - r * .76,
        ),
        width: r * .08,
        height: r * .22,
      ),
      Paint()..color = _red,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class WheelBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final rect = Offset.zero & s;
    c.drawRect(
      rect,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(0, -.8),
          radius: 1.3,
          colors: [Color(0xFF1A222B), _bg],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class GridPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()
      ..color = Colors.white.withValues(alpha: .025)
      ..strokeWidth = 1;
    for (double x = 0; x < s.width; x += 34) {
      c.drawLine(Offset(x, 0), Offset(x, s.height), p);
    }
    for (double y = 0; y < s.height; y += 34) {
      c.drawLine(Offset(0, y), Offset(s.width, y), p);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class MouseRig extends StatefulWidget {
  final BridgeClient bridge;
  final bool vibration;

  const MouseRig({
    super.key,
    required this.bridge,
    required this.vibration,
  });

  @override
  State<MouseRig> createState() => _MouseRigState();
}

class _MouseRigState extends State<MouseRig> {
  Offset last = Offset.zero;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _bg,
      child: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onPanStart: (d) => last = d.localPosition,
              onPanUpdate: (d) {
                final delta = d.localPosition - last;
                last = d.localPosition;
                widget.bridge.sendMouse(
                  action: 'move',
                  dx: delta.dx * 2.0,
                  dy: delta.dy * 2.0,
                );
              },
              child: Center(
                child: Container(
                  width: 360,
                  height: 220,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [
                        Color(0xFF151A20),
                        Color(0xFF0D1115),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: Colors.white10),
                  ),
                  alignment: Alignment.center,
                  child: const Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.touch_app_rounded,
                        size: 48,
                        color: _muted,
                      ),
                      SizedBox(height: 12),
                      Text(
                        'TOUCHPAD',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Drag anywhere to move the Windows cursor',
                        style: TextStyle(
                          fontSize: 9,
                          color: _muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            left: 24,
            bottom: 22,
            child: Row(
              children: [
                _MouseButton(
                  label: 'LEFT',
                  onDown: () => widget.bridge.sendMouse(
                    action: 'button',
                    button: 'left',
                    down: true,
                  ),
                  onUp: () => widget.bridge.sendMouse(
                    action: 'button',
                    button: 'left',
                    down: false,
                  ),
                ),
                const SizedBox(width: 10),
                _MouseButton(
                  label: 'RIGHT',
                  onDown: () => widget.bridge.sendMouse(
                    action: 'button',
                    button: 'right',
                    down: true,
                  ),
                  onUp: () => widget.bridge.sendMouse(
                    action: 'button',
                    button: 'right',
                    down: false,
                  ),
                ),
                const SizedBox(width: 10),
                _MouseButton(
                  label: 'MIDDLE',
                  onDown: () => widget.bridge.sendMouse(
                    action: 'button',
                    button: 'middle',
                    down: true,
                  ),
                  onUp: () => widget.bridge.sendMouse(
                    action: 'button',
                    button: 'middle',
                    down: false,
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            right: 22,
            bottom: 22,
            child: _MouseButton(
              label: 'RESET',
              onDown: () =>
                  widget.bridge.sendMouse(action: 'reset'),
              onUp: () {},
            ),
          ),
        ],
      ),
    );
  }
}

class _MouseButton extends StatelessWidget {
  final String label;
  final VoidCallback onDown;
  final VoidCallback onUp;

  const _MouseButton({
    required this.label,
    required this.onDown,
    required this.onUp,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTapDown: (_) => onDown(),
        onTapUp: (_) => onUp(),
        onTapCancel: onUp,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 13,
          ),
          decoration: BoxDecoration(
            color: _panel2,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white10),
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
            ),
          ),
        ),
      );
}
