import { defaultWheelBindings, type WheelBindings, type WheelOutput } from './controller-types';

export const PAD_CONTROLS = ['lt', 'rt', 'a', 'b', 'x', 'y', 'lb', 'rb', 'l3', 'r3'] as const;
export type PadControl = typeof PAD_CONTROLS[number];
export type PadBindings = Partial<Record<PadControl, WheelOutput>>;
export type SavedGameProfile = { wheelBindings?: Partial<WheelBindings>; padBindings?: PadBindings };
export type ProfileOptions = {
  autoGameProfiles?: boolean;
  asphaltAcceleration?: 'auto' | 'manual';
  gameProfiles?: Record<string, SavedGameProfile>;
  padBindings?: PadBindings;
};
export type ResolvedGameProfile = {
  id: string; gameKey: string | null; name: string; note: string;
  wheelBindings: WheelBindings; padBindings: PadBindings;
};
const NON_GAMES = new Set(['chrome','msedge','firefox','brave','opera','steam','steamwebhelper',
  'epicgameslauncher','epicwebhelper','explorer','discord','code','notepad','powershell','pwsh',
  'cmd','windowsterminal','searchhost','taskmgr','dwm','sihost','lockapp']);
const outputs = new Set(['rt','lt','a','b','x','y','lb','rb','l3','r3','none']);
function validated<T extends string>(keys: readonly T[], source: Partial<Record<T, WheelOutput>> | undefined) {
  const result: Partial<Record<T, WheelOutput>> = {};
  for (const key of keys) if (source && outputs.has(source[key] ?? '')) result[key] = source[key];
  return result;
}
const wheelKeys = Object.keys(defaultWheelBindings) as (keyof WheelBindings)[];

/** Match executable identity first; never select a game from a browser tab title. */
export function resolveGameProfile(title: string, process: string | null, options: ProfileOptions = {}, manual: WheelBindings = defaultWheelBindings): ResolvedGameProfile {
  const exe = (process ?? '').split(/[\\/]/).pop()!.replace(/\.exe$/i, '').toLowerCase().trim();
  const normalized = title.toLowerCase().replace(/[™®]/g,'').replace(/\s+/g,' ').trim();
  const usable = !!exe && !NON_GAMES.has(exe);
  const asphalt = usable && (/^asphalt9(?:_(?:steam|gdk)_x64_rtl)?$/.test(exe) ||
    ['asphaltlegends','asphaltlegendsunite'].includes(exe) ||
    (exe === 'applicationframehost' && /^asphalt (?:9\s*:?\s*legends|legends(?: unite)?)$/.test(normalized)));
  const heat = usable && (exe === 'needforspeedheat' || exe === 'nfsheat');
  const gameKey = !usable ? null : asphalt ? 'asphalt-legends' : heat ? 'nfs-heat' :
    exe === 'applicationframehost' ? (normalized && !['desktop','game detection unavailable','unavailable'].includes(normalized) ? `window:${normalized}` : null) : `process:${exe}`;
  const auto = options.autoGameProfiles !== false;
  let id = 'standard', name = 'Standard controller', note = 'No built-in profile. Standard bindings apply; save overrides for this game.';
  let wheel: WheelBindings = { ...defaultWheelBindings, ...validated(wheelKeys, manual) };
  let pad: PadBindings = { ...validated(PAD_CONTROLS, options.padBindings) };
  if (auto && asphalt) {
    const acceleration = options.asphaltAcceleration === 'manual' ? 'manual' : 'auto';
    id = `asphalt-${acceleration}`; name = `Asphalt · ${acceleration} accel`;
    // Auto acceleration does not have a GAS input. RT can boost, so silence
    // GAS in both modes rather than accidentally consuming the nitro meter.
    wheel = { throttle: acceleration === 'auto' ? 'none' : 'rt', brake:'lt', handbrake:'x', nitro:'a',
      clutch:'none', gearUp:'none', gearDown:'none', horn:'none' };
    pad = acceleration === 'auto' ? { rt:'none' } : {};
    note = acceleration === 'auto' ? 'GAS/RT is inactive: the game accelerates automatically. A/Cross = nitro; X/Square or LT/L2 = drift. Turn TouchDrive off in the game for direct steering.' :
      'Enable manual acceleration inside Asphalt: GAS/RT = accelerate; A/Cross = nitro; X/Square or LT/L2 = drift. The app cannot change or read that game setting.';
  } else if (auto && heat) {
    id = 'nfs-heat'; name = 'Need for Speed Heat';
    wheel = { ...defaultWheelBindings, nitro:'a', handbrake:'x', clutch:'none' };
    pad = {};
    note = 'Default Xbox controls: RT = GAS; LT = brake; A = nitrous; X = handbrake. Gear shifts require manual gearbox in-game.';
  } else if (!auto) {
    name = 'Manual bindings'; note = 'Automatic profiles disabled. Your global bindings apply.';
  }
  const custom = auto && gameKey && Object.hasOwn(options.gameProfiles ?? {}, gameKey) ? options.gameProfiles?.[gameKey] : undefined;
  if (custom) {
    wheel = { ...wheel, ...validated(wheelKeys, custom.wheelBindings) };
    pad = { ...pad, ...validated(PAD_CONTROLS, custom.padBindings) };
    name += ' · saved';
  }
  return { id, gameKey, name, note, wheelBindings:wheel, padBindings:pad };
}

/** Store only edits, so changing a game's acceleration preset stays effective. */
export function updateGameOverride(existing: SavedGameProfile | undefined, current: ResolvedGameProfile, patch: SavedGameProfile): SavedGameProfile {
  const saved: SavedGameProfile = { ...existing };
  if (patch.wheelBindings) {
    const edits = { ...existing?.wheelBindings };
    for (const key of wheelKeys) {
      const value = patch.wheelBindings[key];
      if (value && outputs.has(value) && value !== current.wheelBindings[key]) edits[key] = value;
    }
    saved.wheelBindings = edits;
  }
  if (patch.padBindings) {
    const edits = { ...existing?.padBindings };
    for (const key of PAD_CONTROLS) {
      const value = patch.padBindings[key];
      if (value && outputs.has(value) && value !== (current.padBindings[key] ?? key)) edits[key] = value;
    }
    saved.padBindings = edits;
  }
  return saved;
}
