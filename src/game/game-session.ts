import type { Point2 } from "./types";

export const GAME_SESSION_STORAGE_KEY = "salvador-historic-core:session:v1";

export interface MissionStep {
  id: string;
  title: string;
  detail: string;
  target: Point2;
  radius: number;
  reward: number;
  xp: number;
}

export interface SessionEvent {
  id: number;
  message: string;
  tone: "info" | "success";
}

export interface GameSessionSnapshot {
  missionTitle: string;
  currentStepIndex: number;
  completedSteps: number;
  totalSteps: number;
  currentStep: MissionStep | null;
  playerPosition: Point2;
  distanceToObjective: number | null;
  nearObjective: boolean;
  balance: number;
  xp: number;
  event: SessionEvent | null;
  complete: boolean;
}

export interface GameSession {
  getSnapshot: () => GameSessionSnapshot;
  getServerSnapshot: () => GameSessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  updatePlayerPosition: (position: Point2) => void;
  interact: () => boolean;
  reset: () => void;
}

export interface HistoricRouteTargets {
  upperAccess: Point2;
  lowerAccess: Point2;
  mercadoModelo: Point2;
}

export function createHistoricRouteMission({
  upperAccess,
  lowerAccess,
  mercadoModelo,
}: HistoricRouteTargets): readonly MissionStep[] {
  return [
    {
      id: "find-lacerda-upper-access",
      title: "Encontre o Elevador Lacerda",
      detail: "Atravesse a Praça Tomé de Souza até o acesso superior.",
      target: upperAccess,
      radius: 12,
      reward: 100,
      xp: 100,
    },
    {
      id: "reach-lacerda-lower-access",
      title: "Desça para a Cidade Baixa",
      detail: "Chegue ao acesso inferior do Elevador para continuar a rota.",
      target: lowerAccess,
      radius: 12,
      reward: 150,
      xp: 150,
    },
    {
      id: "reach-mercado-modelo",
      title: "Chegue ao Mercado Modelo",
      detail: "Siga pela orla até o Mercado Modelo e conclua a rota histórica.",
      target: mercadoModelo,
      radius: 18,
      reward: 300,
      xp: 300,
    },
  ];
}

const DEFAULT_MISSION_STEPS = createHistoricRouteMission({
  upperAccess: [23, 0],
  lowerAccess: [-9, 1],
  mercadoModelo: [-71.49, 127.15],
});

const MISSION_TITLE = "Rota do Centro Histórico";
const PERSISTED_VERSION = 1;

interface PersistedSession {
  version: number;
  currentStepIndex: number;
  balance: number;
  xp: number;
  playerPosition: Point2;
}

function distanceBetween(a: Point2, b: Point2) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function readPersistedSession(maxSteps: number): PersistedSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(GAME_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    const currentStepIndex = parsed.currentStepIndex;
    const balance = parsed.balance;
    const xp = parsed.xp;
    const rawPosition = parsed.playerPosition;
    if (
      parsed.version !== PERSISTED_VERSION ||
      typeof currentStepIndex !== "number" ||
      !Number.isInteger(currentStepIndex) ||
      typeof balance !== "number" ||
      !Number.isFinite(balance) ||
      typeof xp !== "number" ||
      !Number.isFinite(xp) ||
      !Array.isArray(rawPosition) ||
      rawPosition.length !== 2 ||
      typeof rawPosition[0] !== "number" ||
      typeof rawPosition[1] !== "number" ||
      !Number.isFinite(rawPosition[0]) ||
      !Number.isFinite(rawPosition[1])
    ) {
      return null;
    }

    return {
      version: PERSISTED_VERSION,
      currentStepIndex: Math.max(0, Math.min(maxSteps, currentStepIndex)),
      balance: Math.max(0, balance),
      xp: Math.max(0, xp),
      playerPosition: [rawPosition[0], rawPosition[1]],
    };
  } catch {
    return null;
  }
}

function persistSession(session: PersistedSession) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(GAME_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be disabled in private browsing or embedded previews.
  }
}

export function createGameSession(
  missionSteps: readonly MissionStep[] = DEFAULT_MISSION_STEPS,
): GameSession {
  const persisted = readPersistedSession(missionSteps.length);
  const listeners = new Set<() => void>();
  let lastPersistAt = 0;
  let eventId = 0;

  let session: PersistedSession = persisted ?? {
    version: PERSISTED_VERSION,
    currentStepIndex: 0,
    balance: 0,
    xp: 0,
    playerPosition: [0, 0],
  };

  const buildSnapshot = (
    sourceSession: PersistedSession,
    event: SessionEvent | null,
  ): GameSessionSnapshot => {
    const currentStep = missionSteps[sourceSession.currentStepIndex] ?? null;
    const distanceToObjective = currentStep
      ? distanceBetween(sourceSession.playerPosition, currentStep.target)
      : null;

    return {
      missionTitle: MISSION_TITLE,
      currentStepIndex: sourceSession.currentStepIndex,
      completedSteps: sourceSession.currentStepIndex,
      totalSteps: missionSteps.length,
      currentStep,
      playerPosition: sourceSession.playerPosition,
      distanceToObjective,
      nearObjective:
        currentStep !== null &&
        distanceToObjective !== null &&
        distanceToObjective <= currentStep.radius,
      balance: sourceSession.balance,
      xp: sourceSession.xp,
      event,
      complete: currentStep === null,
    };
  };

  const initialEvent = {
    id: ++eventId,
    message: "Rota histórica disponível. Vá até o Elevador Lacerda.",
    tone: "info",
  } satisfies SessionEvent;
  const serverSession: PersistedSession = {
    version: PERSISTED_VERSION,
    currentStepIndex: 0,
    balance: 0,
    xp: 0,
    playerPosition: [0, 0],
  };
  const serverSnapshot = buildSnapshot(serverSession, {
    ...initialEvent,
    id: 0,
  });
  let currentSnapshot = buildSnapshot(session, initialEvent);

  const emit = (event: SessionEvent | null = currentSnapshot.event) => {
    currentSnapshot = buildSnapshot(session, event);
    listeners.forEach((listener) => listener());
  };

  const save = () => {
    persistSession(session);
    lastPersistAt = Date.now();
  };

  return {
    getSnapshot: () => currentSnapshot,
    getServerSnapshot: () => serverSnapshot,

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    updatePlayerPosition: (position) => {
      if (!position.every((value) => Number.isFinite(value))) return;

      const previousPosition = session.playerPosition;
      const moved = distanceBetween(previousPosition, position);
      if (moved < 0.35) return;

      session.playerPosition = [position[0], position[1]];
      const previousNearObjective = currentSnapshot.nearObjective;
      const nextStep = missionSteps[session.currentStepIndex];
      const nextDistance = nextStep
        ? distanceBetween(session.playerPosition, nextStep.target)
        : null;
      const nextNearObjective =
        nextStep !== undefined && nextDistance !== null && nextDistance <= nextStep.radius;

      if (previousNearObjective !== nextNearObjective || moved >= 1.25) {
        emit();
      }

      if (Date.now() - lastPersistAt > 5000) save();
    },

    interact: () => {
      const currentStep = missionSteps[session.currentStepIndex];
      if (!currentStep) {
        emit({
          id: ++eventId,
          message: "Rota concluída. Explore o Centro Histórico livremente.",
          tone: "info",
        });
        return false;
      }

      const distance = distanceBetween(session.playerPosition, currentStep.target);
      if (distance > currentStep.radius) {
        emit({
          id: ++eventId,
          message: `Você ainda está a ${Math.round(distance)} m do objetivo.`,
          tone: "info",
        });
        return false;
      }

      session.currentStepIndex += 1;
      session.balance += currentStep.reward;
      session.xp += currentStep.xp;
      const nextStep = missionSteps[session.currentStepIndex];
      emit({
        id: ++eventId,
        message: nextStep
          ? `Objetivo concluído. +R$ ${currentStep.reward} · próximo: ${nextStep.title}.`
          : `Rota concluída. +R$ ${currentStep.reward} · +${currentStep.xp} XP.`,
        tone: "success",
      });
      save();
      return true;
    },

    reset: () => {
      session = {
        version: PERSISTED_VERSION,
        currentStepIndex: 0,
        balance: 0,
        xp: 0,
        playerPosition: currentSnapshot.playerPosition,
      };
      emit({
        id: ++eventId,
        message: "Rota reiniciada. Vá até o Elevador Lacerda.",
        tone: "info",
      });
      save();
    },
  };
}
