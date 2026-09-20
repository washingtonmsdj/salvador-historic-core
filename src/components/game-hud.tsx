import type { GameSessionSnapshot } from "../game/game-session";

interface GameHudProps {
  snapshot: GameSessionSnapshot;
  onReset: () => void;
}

export function GameHud({ snapshot, onReset }: GameHudProps) {
  const progress = Math.round((snapshot.completedSteps / snapshot.totalSteps) * 100);

  return (
    <section
      aria-label="Estado da missão"
      className="pointer-events-none absolute left-4 top-4 z-20 w-[min(370px,calc(100vw-2rem))] sm:left-6 sm:top-6"
    >
      <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#101714]/88 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4b477]">
          <span>Missão principal</span>
          <span className="text-white/45">
            {snapshot.completedSteps}/{snapshot.totalSteps}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white sm:text-base">{snapshot.missionTitle}</h2>
          <span className="text-right text-[11px] font-medium leading-relaxed text-white/65">
            R$ {snapshot.balance} · {snapshot.xp} XP
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#c9a96e] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {snapshot.currentStep ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-white">{snapshot.currentStep.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              {snapshot.currentStep.detail}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/55">
              <span>
                {snapshot.distanceToObjective === null
                  ? "Calculando rota…"
                  : `${Math.round(snapshot.distanceToObjective)} m do objetivo`}
              </span>
              {snapshot.nearObjective ? (
                <span className="rounded-md bg-[#c9a96e] px-2 py-1 font-semibold text-[#18130b]">
                  Pressione E
                </span>
              ) : (
                <span>WASD · Shift corre</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-[#245d42]/35 p-3">
            <p className="text-sm font-semibold text-[#c4f0d2]">Rota concluída</p>
            <p className="mt-1 text-xs text-white/65">
              Explore a área e use o mapa quando quiser comparar o blockout com a cidade real.
            </p>
          </div>
        )}
      </div>

      {snapshot.event && (
        <div
          key={snapshot.event.id}
          className={`pointer-events-auto mt-2 rounded-xl border px-3 py-2 text-xs shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 ${
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

      <button
        type="button"
        onClick={onReset}
        className="pointer-events-auto mt-2 text-[10px] text-white/40 underline-offset-2 transition hover:text-white/75 hover:underline"
      >
        Reiniciar missão
      </button>
    </section>
  );
}
