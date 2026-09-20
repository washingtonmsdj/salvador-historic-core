import { useEffect, useRef, useState } from "react";
import siteData from "../data/site-data.json";
import type {
  LinearFeature,
  MeasuredObject,
  SceneLevels,
  TerrainConfig,
} from "../game/types";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";

type CameraMode = "aerial" | "street";
type LoadState = "loading" | "ready" | "error";

interface SalvadorSiteData {
  terrain: TerrainConfig;
  levels: SceneLevels;
  buildings: MeasuredObject[];
  elevator: MeasuredObject[];
  landmarks: MeasuredObject[];
  barriers: MeasuredObject[];
  roads: LinearFeature[];
  spaces: LinearFeature[];
}

interface SceneControls {
  activateCamera: (mode: CameraMode) => void;
  setDebug: (enabled: boolean) => void;
}

const data = siteData as unknown as SalvadorSiteData;

export function SalvadorScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef<SceneControls | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("aerial");
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let engine: Engine | null = null;
    let scene: Scene | null = null;

    const handleResize = () => engine?.resize();

    async function boot() {
      try {
        const [
          { Engine },
          { Scene },
          { HemisphericLight },
          { DirectionalLight },
          { Vector3 },
          { Color4 },
          { createTerrain },
          { createRoads, createSpaces },
          { createBuildings },
          { createElevatorBlockout, createConnectionPoints },
          { createBarriers },
          { createCameras },
          { configurePlayer },
          { createDebug },
        ] = await Promise.all([
          import("@babylonjs/core/Engines/engine"),
          import("@babylonjs/core/scene"),
          import("@babylonjs/core/Lights/hemisphericLight"),
          import("@babylonjs/core/Lights/directionalLight"),
          import("@babylonjs/core/Maths/math.vector"),
          import("@babylonjs/core/Maths/math.color"),
          import("../game/terrain"),
          import("../game/roads"),
          import("../game/buildings"),
          import("../game/elevator"),
          import("../game/barriers"),
          import("../game/cameras"),
          import("../game/player"),
          import("../game/debug"),
        ]);

        if (disposed) return;

        engine = new Engine(
          canvas,
          true,
          {
            preserveDrawingBuffer: false,
            stencil: true,
          },
          true,
        );

        scene = new Scene(engine);
        scene.clearColor = new Color4(0.045, 0.065, 0.062, 1);

        const ambient = new HemisphericLight(
          "ambient-light",
          new Vector3(0.2, 1, 0.1),
          scene,
        );
        ambient.intensity = 0.92;

        const sun = new DirectionalLight(
          "sun-light",
          new Vector3(-0.55, -1, 0.35),
          scene,
        );
        sun.position = new Vector3(120, 180, -80);
        sun.intensity = 0.72;

        createTerrain(scene, data.terrain);
        createSpaces(scene, data.spaces);
        createRoads(scene, data.roads, data.terrain, data.levels);
        createBuildings(scene, data.buildings);
        createElevatorBlockout(scene, data.elevator);
        createConnectionPoints(scene, data.landmarks);
        createBarriers(scene, data.barriers);

        const cameras = createCameras(scene, canvas);
        configurePlayer(scene, cameras.street);

        const debug = createDebug(scene, [
          ...data.buildings,
          ...data.elevator,
          ...data.landmarks,
          ...data.barriers,
        ]);
        debug.setEnabled(false);

        controlsRef.current = {
          activateCamera: cameras.activate,
          setDebug: debug.setEnabled,
        };

        engine.runRenderLoop(() => {
          scene?.render();
        });

        window.addEventListener("resize", handleResize);
        setLoadState("ready");
      } catch (error) {
        console.error("Failed to initialize Salvador 3D scene", error);
        if (!disposed) {
          setLoadError(
            error instanceof Error ? error.message : "Falha desconhecida ao iniciar a cena.",
          );
          setLoadState("error");
        }
      }
    }

    void boot();

    return () => {
      disposed = true;
      controlsRef.current = null;
      window.removeEventListener("resize", handleResize);
      engine?.stopRenderLoop();
      scene?.dispose();
      engine?.dispose();
    };
  }, []);

  const changeCamera = (mode: CameraMode) => {
    controlsRef.current?.activateCamera(mode);
    setCameraMode(mode);
    canvasRef.current?.focus();
  };

  const toggleDebug = () => {
    setDebugEnabled((current) => {
      const next = !current;
      controlsRef.current?.setDebug(next);
      return next;
    });
  };

  return (
    <main className="relative h-dvh min-h-[480px] w-full overflow-hidden bg-[#0b1110] text-[#f2eee4]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none outline-none"
        tabIndex={0}
        aria-label="Cena 3D navegável do Centro Histórico de Salvador"
        onPointerDown={(event) => event.currentTarget.focus()}
      />

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div className="max-w-xl rounded-xl border border-white/10 bg-black/55 px-4 py-3 shadow-2xl backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c9a96e]">
            Salvador Historic Core
          </p>
          <h1 className="mt-1 text-base font-semibold sm:text-lg">
            Blockout geográfico · Praça Tomé de Souza ↔ Mercado Modelo
          </h1>
          <p className="mt-1 text-xs text-white/60">
            Coordenadas locais em metros · Elevador Lacerda como origem · dados provisórios identificados
          </p>
        </div>

        <div className="hidden rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-[11px] text-white/65 backdrop-blur-md md:block">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#d89a3d]" />
            ESTIMATED = medida ainda não verificada
          </div>
        </div>
      </header>

      <aside className="pointer-events-none absolute bottom-20 left-4 z-10 hidden rounded-xl border border-white/10 bg-black/55 p-3 text-[11px] text-white/65 backdrop-blur-md sm:block">
        <p className="mb-2 font-semibold uppercase tracking-[0.16em] text-white/80">
          Controles
        </p>
        <p>Rua: WASD / setas + mouse</p>
        <p>Aérea: arrastar + roda do mouse</p>
        <p className="mt-2 text-white/45">Y = altura · X = leste/oeste · Z = norte/sul</p>
      </aside>

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-black/70 p-2 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => changeCamera("aerial")}
          disabled={loadState !== "ready"}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
            cameraMode === "aerial"
              ? "bg-[#c9a96e] text-[#18130b]"
              : "bg-white/5 text-white/75 hover:bg-white/10"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Vista aérea
        </button>
        <button
          type="button"
          onClick={() => changeCamera("street")}
          disabled={loadState !== "ready"}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
            cameraMode === "street"
              ? "bg-[#c9a96e] text-[#18130b]"
              : "bg-white/5 text-white/75 hover:bg-white/10"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Nível da rua
        </button>
        <button
          type="button"
          onClick={toggleDebug}
          disabled={loadState !== "ready"}
          aria-pressed={debugEnabled}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
            debugEnabled
              ? "bg-[#b25e49] text-white"
              : "bg-white/5 text-white/75 hover:bg-white/10"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Debug
        </button>
      </div>

      {loadState !== "ready" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#0b1110]/92 px-6">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#c9a96e]" />
            <p className="text-sm font-medium">
              {loadState === "loading" ? "Montando cena 3D…" : "Não foi possível iniciar a cena"}
            </p>
            {loadError && (
              <p className="mt-2 break-words text-xs leading-relaxed text-white/55">
                {loadError}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
