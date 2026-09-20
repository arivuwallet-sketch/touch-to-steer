import { useCallback, useEffect, useRef, useState } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

const buzz = (on: boolean, ms = 10) => {
  if (on && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

function FlatButton({ label, id, settings, press, className = "" }: {
  label: string; id: string; settings: Settings; press: Props["press"]; className?: string;
}) {
  return <button
    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); buzz(settings.vibration); press(id, true); }}
    onPointerUp={() => press(id, false)}
    onPointerCancel={() => press(id, false)}
    className={`grid min-h-16 min-w-16 touch-none select-none place-items-center rounded-2xl border border-white/10 bg-gradient-to-b from-[#27303d] to-[#10151d] px-4 text-sm font-black tracking-wider text-slate-200 shadow-[0_8px_18px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.08)] active:scale-95 active:brightness-125 ${className}`}
  >{label}</button>;
}

function Pedal({ label, id, settings, set }: {
  label: string; id: "throttle" | "brake" | "clutch"; settings: Settings; set: Props["set"];
}) {
  const [value, setValue] = useState(0);
  const active = useRef<number | null>(null);
  const start = useRef(0);
  const update = (y: number) => {
    const v = Math.max(0, Math.min(1, (start.current - y) / 110));
    setValue(v); set({ [id]: v } as Partial<ControllerState>);
  };
  return <button
    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); active.current=e.pointerId; start.current=e.clientY; setValue(1); set({[id]:1} as Partial<ControllerState>); buzz(settings.vibration,8); }}
    onPointerMove={(e) => active.current===e.pointerId && update(e.clientY)}
    onPointerUp={() => { active.current=null; setValue(0); set({[id]:0} as Partial<ControllerState>); }}
    onPointerCancel={() => { active.current=null; setValue(0); set({[id]:0} as Partial<ControllerState>); }}
    className="relative h-[30vh] min-h-32 w-[13vw] min-w-24 max-w-40 touch-none rounded-2xl border border-white/10 bg-gradient-to-b from-[#303947] to-[#11161e] p-3 shadow-[0_10px_24px_rgba(0,0,0,.5)] active:brightness-125"
  >
    <span className="absolute inset-x-3 top-3 h-2 rounded-full bg-white/10"><span className="block h-full rounded-full bg-sky-400/70" style={{transform:`scaleX(${value})`,transformOrigin:"left"}} /></span>
    <span className="absolute inset-0 grid place-items-center text-sm font-black tracking-[.2em] text-slate-300">{label}</span>
  </button>;
}

export function FlatWheel({ settings, set, press }: Props) {
  const steer = useRef(0);
  const pointer = useRef<{ id:number; last:number; acc:number } | null>(null);
  const max = Math.max(180, settings.wheelRotationDeg || 900) * Math.PI / 360;

  const emit = useCallback((raw:number) => {
    const v=applyCurve(Math.max(-1,Math.min(1,raw)),settings.deadzone,settings.linearity,settings.steerSensitivity);
    steer.current=v; set({steer:v});
  },[set,settings.deadzone,settings.linearity,settings.steerSensitivity]);

  useEffect(() => {
    if (settings.steerMode !== "tilt") return;
    const onOrient=(e:DeviceOrientationEvent)=>emit((e.gamma ?? 0)/(settings.maxTiltDeg || 30));
    window.addEventListener("deviceorientation",onOrient);
    return()=>window.removeEventListener("deviceorientation",onOrient);
  },[settings.steerMode,settings.maxTiltDeg,emit]);

  const onWheelDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    e.currentTarget.setPointerCapture(e.pointerId);
    const r=e.currentTarget.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
    let last=Math.atan2(e.clientY-cy,e.clientX-cx);
    pointer.current={id:e.pointerId,last,acc:steer.current*max};
  };
  const onWheelMove=(e:React.PointerEvent<HTMLDivElement>)=>{
    const p=pointer.current;if(!p||p.id!==e.pointerId)return;
    const r=e.currentTarget.getBoundingClientRect(), a=Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2));
    let d=a-p.last; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; p.last=a; p.acc=Math.max(-max,Math.min(max,p.acc+d)); emit(p.acc/max);
  };
  const release=()=>{pointer.current=null;if(settings.autoCentre)emit(0);};

  return <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_100%_at_50%_0%,#1b2533_0%,#080b10_65%)]">
    <div className="absolute inset-x-0 top-0 h-1 bg-sky-400/70 shadow-[0_0_18px_rgba(56,189,248,.7)]" />
    <div className="absolute left-[max(1rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2">
      <div className="flex items-center gap-4">
        <FlatButton label="D−" id="dpad_left" settings={settings} press={press} />
        <FlatButton label="D+" id="dpad_right" settings={settings} press={press} />
        <FlatButton label="L" id="lights" settings={settings} press={press} />
      </div>
    </div>

    <div className="absolute left-1/2 top-[42%] h-[48vh] w-[48vh] max-h-[82vw] max-w-[82vw] -translate-x-1/2 -translate-y-1/2 touch-none"
      onPointerDown={onWheelDown} onPointerMove={onWheelMove} onPointerUp={release} onPointerCancel={release}>
      <div className="absolute inset-0 rounded-full border-[clamp(1rem,2vw,1.5rem)] border-[#27313e] bg-[#111720] shadow-[0_18px_40px_rgba(0,0,0,.65),inset_0_0_0_2px_rgba(255,255,255,.05)]" />
      <div className="absolute inset-[13%] rounded-full border-2 border-white/10 bg-[#171e28]" />
      <div className="absolute left-1/2 top-1/2 h-[70%] w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#374151] to-[#171c24]" />
      <div className="absolute left-1/2 top-1/2 h-3 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#374151] to-[#171c24]" />
      <div className="absolute left-1/2 top-1/2 grid h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-sky-400/30 bg-[#202936] shadow-[inset_0_0_18px_rgba(0,0,0,.6),0_0_20px_rgba(56,189,248,.12)]">
        <span className="text-[clamp(.65rem,1.5vw,1rem)] font-black tracking-[.25em] text-slate-400">STEER</span>
      </div>
      <div className="absolute left-1/2 top-[3%] h-[8%] w-[7%] -translate-x-1/2 rounded-md bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,.7)]" />
      <div className="absolute left-[16%] top-1/2 -translate-y-1/2"><FlatButton label="△" id="y" settings={settings} press={press} /></div>
      <div className="absolute right-[16%] top-1/2 -translate-y-1/2"><FlatButton label="○" id="b" settings={settings} press={press} /></div>
      <div className="absolute left-1/2 top-[16%] -translate-x-1/2"><FlatButton label="□" id="x" settings={settings} press={press} /></div>
      <div className="absolute left-1/2 bottom-[16%] -translate-x-1/2"><FlatButton label="×" id="a" settings={settings} press={press} /></div>
    </div>

    <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2">
      <div className="flex flex-col gap-4">
        <FlatButton label="HORN" id="horn" settings={settings} press={press} />
        <FlatButton label="CAM" id="look" settings={settings} press={press} />
        <FlatButton label="RESET" id="reset" settings={settings} press={press} />
      </div>
    </div>

    <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-center gap-[clamp(.75rem,2vw,1.5rem)] px-4">
      <Pedal label="CLUTCH" id="clutch" settings={settings} set={set} />
      <Pedal label="BRAKE" id="brake" settings={settings} set={set} />
      <Pedal label="GAS" id="throttle" settings={settings} set={set} />
    </div>
  </div>;
}
