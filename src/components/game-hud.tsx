import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameSessionSnapshot } from "../game/game-session";
import type { ThirdPersonInputState } from "../game/third-person-player";

type CameraMode = "aerial" | "street" | "thirdPerson";

interface GameHudProps {
  snapshot: GameSessionSnapshot;
  cameraMode: CameraMode;
  onVirtualInput: (input: ThirdPersonInputState) => void;
  onInteract: () => void;
}

const EMPTY_INPUT: ThirdPersonInputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

function VirtualJoystick({ onInput }: { onInput: (input: ThirdPersonInputState) => void }) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateInput = (event: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (!base) return;

    const bounds = base.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const maxDistance = bounds.width * 0.32;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const threshold = maxDistance * 0.28;

    setKnob({ x, y });
    onInput({
      forward: y < -threshold,
      backward: y > threshold,
      left: x < -threshold,
      right: x > threshold,
    });
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onInput(EMPTY_INPUT);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={baseRef}
      className="relative h-28 w-28 touch-none rounded-full border border-white/20 bg-black/35 shadow-2xl backdrop-blur-md"
      aria-label="Controle virtual de movimento"
      onPointerDown={(event) => {
        pointerId.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateInput(event);
      }}
      onPointerMove={(event) => {
        if (pointerId.current === event.pointerId) updateInput(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className="pointer-events-none absolute inset-3 rounded-full border border-white/10" />
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-[#f0d39b]/55 bg-[#c9a96e]/80 shadow-lg transition-transform duration-75"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

export function GameHud({ snapshot, cameraMode, onVirtualInput, onInteract }: GameHudProps) {
  const progress = Math.round((snapshot.completedSteps / snapshot.totalSteps) * 100);

  return (
    <>
      <section
        aria-label="Objetivo atual"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 p-[max(0.75rem,env(safe-area-inset-top))] sm:p-6"
      >
        <div className="pointer-events-auto w-fit max-w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-white/15 bg-[#101714]/78 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#d4b477]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d4b477] shadow-[0_0_12px_#d4b477]" />
            <span>Rota {snapshot.completedSteps + 1}/{snapshot.totalSteps}</span>
            <span className="ml-auto text-white/55">
              {snapshot.distanceToObjective === null
                ? "—"
                : `${Math.round(snapshot.distanceToObjective)} m`}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-3">
            <p className="text-sm font-semibold leading-tight text-white sm:text-base">
              {snapshot.currentStep?.title ?? "Exploração livre"}
            </p>
            {snapshot.nearObjective && (
              <span className="shrink-0 rounded-md bg-[#c9a96e] px-2 py-1 text-[10px] font-bold text-[#18130b]">
                <span className="sm:hidden">Toque</span>
                <span className="hidden sm:inline">E</span>
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#c9a96e] transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-white/45">{progress}%</span>
          </div>
        </div>

        {snapshot.event && (
          <div
            key={snapshot.event.id}
            className={`pointer-events-auto mt-2 w-fit max-w-[min(360px,calc(100vw-1.5rem))] rounded-xl border px-3 py-2 text-xs shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 ${
              snapshot.event.tone === "success"
                ? "border-[#75b884]/35 bg-[#173622]/90 text-[#c4f0d2]"
                : "border-white/10 bg-black/70 text-white/75"
            }`}
            role="status"
            aria-live="polite"
          >
            {snapshot.event.message}
          </div>
        )}
      </section>

      {cameraMode === "thirdPerson" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 flex items-end justify-between px-4 sm:hidden">
          <div className="pointer-events-auto">
            <VirtualJoystick onInput={onVirtualInput} />
          </div>
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              onInteract();
            }}
            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border border-[#f0d39b]/60 bg-[#c9a96e]/85 text-xs font-black uppercase tracking-[0.12em] text-[#18130b] shadow-2xl active:scale-95"
            aria-label="Interagir"
          >
            Ação
          </button>
        </div>
      )}
    </>
  );
}
