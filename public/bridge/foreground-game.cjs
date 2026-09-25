"use strict";
const { execFile } = require("node:child_process");

const FOREGROUND_GAME_COMMAND = [
  'Add-Type @"',
  "using System;",
  "using System.Text;",
  "using System.Runtime.InteropServices;",
  "public static class TtsWindow {",
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
  '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);',
  "}",
  '"@;',
  '$hwnd=[TtsWindow]::GetForegroundWindow();',
  'if ($hwnd -eq [IntPtr]::Zero) { exit 0 }',
  '$sb=New-Object Text.StringBuilder 512;',
  '[TtsWindow]::GetWindowText($hwnd,$sb,$sb.Capacity) | Out-Null;',
  '[uint32]$foregroundProcessId=0;',
  '[TtsWindow]::GetWindowThreadProcessId($hwnd,[ref]$foregroundProcessId) | Out-Null;',
  '$p=Get-Process -Id $foregroundProcessId -ErrorAction SilentlyContinue;',
  'if ($p) {',
  '  [pscustomobject]@{title=$sb.ToString(); process=$p.ProcessName} | ConvertTo-Json -Compress',
  '}',
].join("\n");

// PowerShell startup/compilation must never run on the input event loop.
// At most one query runs, even when Windows is slow or the timer fires again.
function createForegroundReader(run = execFile, platform = process.platform) {
  let pending = null;
  return function readForegroundGame() {
    if (platform !== "win32") return Promise.resolve(null);
    if (pending) return pending;
    pending = new Promise((resolve) => {
      run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", FOREGROUND_GAME_COMMAND],
        { windowsHide: true, encoding: "utf8", timeout: 2000, maxBuffer: 16384 },
        (error, stdout) => resolve(error ? null : String(stdout || "").trim() || null));
    }).finally(() => { pending = null; });
    return pending;
  };
}
module.exports = { createForegroundReader, FOREGROUND_GAME_COMMAND };
