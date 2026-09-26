"use strict";
const { spawn } = require("node:child_process");

const FOREGROUND_GAME_COMMAND = [
  '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false);',
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

// Compile once in a separate process, then sample at 4 Hz. Reading this
// cache never waits for PowerShell, so foreground detection cannot block input.
const queryStart = FOREGROUND_GAME_COMMAND.indexOf('$hwnd=');
const FOREGROUND_WATCH_COMMAND = FOREGROUND_GAME_COMMAND.slice(0, queryStart) +
  "\nfunction Read-Foreground {\n" +
  FOREGROUND_GAME_COMMAND.slice(queryStart).replace('exit 0',
    "'{\"title\":\"Desktop\",\"process\":\"\"}'; return") +
  "\n}\nwhile ($true) { try { Read-Foreground } catch { '{\"title\":\"Unavailable\",\"process\":\"\"}' }; Start-Sleep -Milliseconds 250 }";

function createForegroundReader(run = spawn, platform = process.platform, now = Date.now) {
  let child = null, latest = null, buffer = "", updatedAt = 0, retryAt = 0, startedAt = 0;
  function start() {
    try {
      const proc = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", FOREGROUND_WATCH_COMMAND],
        { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
      child = proc; startedAt = now(); updatedAt = 0;
      const failed = () => {
        if (child !== proc) return;
        child = null; latest = null; buffer = ""; retryAt = now() + 2000;
      };
      proc.on("error", failed);
      proc.on("exit", failed);
      proc.stdout.setEncoding("utf8");
      proc.stdout.on("data", (chunk) => {
        if (child !== proc) return;
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
          try {
            const info = JSON.parse(line);
            if (info && typeof info.title === "string" && typeof info.process === "string") {
              latest = line; updatedAt = now();
            }
          } catch { /* ignore PowerShell diagnostics */ }
        }
        if (buffer.length > 16384) buffer = "";
      });
      proc.unref?.();
    } catch { child = null; retryAt = now() + 2000; }
  }
  function readForegroundGame() {
    if (platform !== "win32") return Promise.resolve(null);
    // Recover a hung helper as well as a crashed one. Allow cold Add-Type
    // compilation ten seconds, but never display stale results while waiting.
    if (child && now() - (updatedAt || startedAt) > 10000) {
      readForegroundGame.stop(); retryAt = now() + 2000;
    }
    if (!child && now() >= retryAt) start();
    return Promise.resolve(latest && now() - updatedAt < 2000 ? latest : null);
  }
  readForegroundGame.stop = () => {
    const proc = child; child = null; latest = null; buffer = "";
    proc?.kill();
  };
  return readForegroundGame;
}
module.exports = { createForegroundReader, FOREGROUND_GAME_COMMAND, FOREGROUND_WATCH_COMMAND };
