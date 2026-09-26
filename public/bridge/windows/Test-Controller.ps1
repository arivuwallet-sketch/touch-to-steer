param(
    [ValidateSet('Pad', 'Wheel')][string]$Mode = 'Pad',
    [ValidateRange(-1, 3)][int]$ControllerIndex = -1,
    [switch]$ListOnly
)
$ErrorActionPreference = 'Stop'
if (-not ('TtsInputCheck' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TtsInputCheck {
    [StructLayout(LayoutKind.Sequential)]
    public struct Pad {
        public ushort Buttons;
        public byte LT, RT;
        public short LX, LY, RX, RY;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct State { public uint Packet; public Pad Gamepad; }
    [DllImport("xinput1_4.dll", EntryPoint="XInputGetState")]
    public static extern uint Read(uint index, out State state);
}
'@
}
$slots = @()
foreach ($slot in 0..3) {
    $sample = New-Object TtsInputCheck+State
    if ([TtsInputCheck]::Read($slot, [ref]$sample) -eq 0) { $slots += $slot }
}
Write-Host "Connected XInput slots (zero-based): $($slots -join ', ')"
if ($ListOnly) { return }
if ($slots.Count -eq 0) { throw 'No XInput controller. Start the new bridge, select XInput or Universal in the phone app, and connect.' }
if ($ControllerIndex -lt 0) {
    if ($slots.Count -gt 1) { throw 'More than one controller is connected. Run again with -ControllerIndex 0, 1, 2 or 3 for the TouchToSteer slot.' }
    $ControllerIndex = $slots[0]
}
if ($ControllerIndex -notin $slots) { throw 'The selected controller slot is disconnected.' }
Start-Process control.exe -ArgumentList 'joy.cpl'
Write-Host 'Use the controller on your PHONE for these tests. Hold each requested control until told to release.'
Write-Host 'This reads real Windows XInput reports. It does not measure finger-to-game latency or test DS4.'
Read-Host 'Select the matching Xbox controller in joy.cpl > Properties, then press Enter here' | Out-Null

function Read-Pad {
    $value = New-Object TtsInputCheck+State
    if ([TtsInputCheck]::Read($ControllerIndex, [ref]$value) -ne 0) { throw 'Controller disconnected during the check.' }
    return $value.Gamepad
}
function Wait-Condition([scriptblock]$Condition, [int]$StableMs = 150) {
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $stableSince = -1L
    while ($watch.ElapsedMilliseconds -lt 20000) {
        $pad = Read-Pad
        if (& $Condition $pad) {
            if ($stableSince -lt 0) { $stableSince = $watch.ElapsedMilliseconds }
            if ($watch.ElapsedMilliseconds - $stableSince -ge $StableMs) { return $true }
        } else { $stableSince = -1L }
        Start-Sleep -Milliseconds 4
    }
    return $false
}
$steps = @()
function Add-ButtonStep([string]$Name, [int]$Mask) {
    $script:steps += @{
        Name = $Name
        Press = { param($p) ($p.Buttons -band $Mask) -eq $Mask }.GetNewClosure()
        Release = { param($p) ($p.Buttons -band $Mask) -eq 0 }.GetNewClosure()
    }
}
function Add-AxisStep([string]$Name, [string]$Axis, [int]$Direction = 1) {
    $script:steps += @{
        Name = $Name
        Press = { param($p) $p.$Axis * $Direction -gt 17000 }.GetNewClosure()
        Release = { param($p) [Math]::Abs([int]$p.$Axis) -lt 3000 }.GetNewClosure()
    }
}
if ($Mode -eq 'Pad') {
    Add-ButtonStep 'A' 0x1000; Add-ButtonStep 'B' 0x2000
    Add-ButtonStep 'X' 0x4000; Add-ButtonStep 'Y' 0x8000
    Add-ButtonStep 'LB' 0x0100; Add-ButtonStep 'RB' 0x0200
    Add-ButtonStep 'VIEW' 0x0020; Add-ButtonStep 'MENU' 0x0010
    Add-ButtonStep 'M1 (LB alias)' 0x0100; Add-ButtonStep 'M2 (RB alias)' 0x0200
    Add-ButtonStep 'M3 (left stick click alias)' 0x0040; Add-ButtonStep 'M4 (right stick click alias)' 0x0080
    Add-ButtonStep 'D-pad Up' 0x0001; Add-ButtonStep 'D-pad Down' 0x0002
    Add-ButtonStep 'D-pad Left' 0x0004; Add-ButtonStep 'D-pad Right' 0x0008
    Add-ButtonStep 'D-pad Up + Left together' 0x0005
    Add-ButtonStep 'A + LB together' 0x1100
    Add-AxisStep 'Left stick right' LX 1; Add-AxisStep 'Left stick left' LX -1
    Add-AxisStep 'Left stick up' LY 1; Add-AxisStep 'Left stick down' LY -1
    Add-AxisStep 'Right stick right' RX 1; Add-AxisStep 'Right stick left' RX -1
    Add-AxisStep 'Right stick up' RY 1; Add-AxisStep 'Right stick down' RY -1
} else {
    Write-Host 'Set wheel LOCK to 180 degrees and Auto-centre ON for this check.'
    Add-AxisStep 'Steering wheel right' LX 1; Add-AxisStep 'Steering wheel left' LX -1
    Add-ButtonStep 'Handbrake' 0x1000; Add-ButtonStep 'Nitro' 0x0100
    Add-ButtonStep 'Horn' 0x0040
}
$steps += @{Name=$(if ($Mode -eq 'Pad') {'LT'} else {'BRAKE'}); Press={param($p) $p.LT -gt 200};Release={param($p) $p.LT -lt 8}}
$steps += @{Name=$(if ($Mode -eq 'Pad') {'RT'} else {'GAS'}); Press={param($p) $p.RT -gt 200};Release={param($p) $p.RT -lt 8}}
$steps += @{Name='Both triggers/pedals together'; Press={param($p) $p.LT -gt 200 -and $p.RT -gt 200};Release={param($p) $p.LT -lt 8 -and $p.RT -lt 8}}
$results = @()
foreach ($step in $steps) {
    Write-Host "Hold: $($step.Name)" -ForegroundColor Cyan
    $pressed = Wait-Condition $step.Press
    Write-Host 'Release it now.'
    $released = Wait-Condition $step.Release
    $passed = $pressed -and $released
    $results += [pscustomobject]@{Control=$step.Name; PressObserved=$pressed; ReleaseObserved=$released; Passed=$passed}
    Write-Host $(if ($passed) {'PASS'} else {'FAIL / not observed within 20 seconds'})
}
$report = Join-Path (Get-Location) 'TouchToSteer-Input-Check.json'
[pscustomobject]@{
    Mode=$Mode; ControllerIndex=$ControllerIndex; CheckedAt=(Get-Date).ToString('o');
    Method='Real XInputGetState; manual input, 150ms stable detection; not a latency benchmark'; Results=$results
} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $report
Write-Host "Saved: $report"
Write-Host 'HOME/Guide is reserved by Windows and is not exposed by standard XInputGetState. Check it in your game/platform overlay.'
if (@($results | Where-Object { -not $_.Passed }).Count) { exit 1 }
