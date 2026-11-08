const {timingSafeEqual} = require('node:crypto');
function remotePolicy(env) {
  const publicMode = env.RIG_PUBLIC === '1';
  const token = String(env.RIG_ACCESS_TOKEN || '');
  if ((publicMode || token) && !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    throw new Error('Set RIG_ACCESS_TOKEN to 32–128 random URL-safe characters before enabling remote access.');
  }
  return {publicMode, token, host: publicMode ? '127.0.0.1' : (env.RIG_HOST || '0.0.0.0'),
    mouseAllowed: !publicMode || env.RIG_REMOTE_MOUSE === '1'};
}
function authorizeUpgrade(headers, token) {
  if (!token) return true;
  const protocols = String(headers['sec-websocket-protocol'] || '').split(',').map(v=>v.trim());
  const candidates = protocols.filter(v=>v.startsWith('rig-auth.'));
  if (candidates.length !== 1 || !protocols.includes('rig-v1')) return false;
  const supplied = Buffer.from(candidates[0].slice(9));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function playerLimit(value) {
  const n = Number(value ?? 16);
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : 16;
}
function capacityError(sessions, current, mode, limit) {
  const others = [...sessions].filter(s=>s!==current);
  if (others.length >= limit) return `Host limit of ${limit} controller sessions reached.`;
  const xbox = others.filter(s=>s.targets.some(t=>t.type==='xinput')).length;
  if (mode !== 'ds4' && xbox >= 4) return 'All four Windows XInput slots are in use. Select DS4/HID for additional players if the game supports it.';
  return null;
}
module.exports = {remotePolicy, authorizeUpgrade, playerLimit, capacityError};
