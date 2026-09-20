import { useEffect, useRef, useState } from "react";
import derivedVectorsData from "../../geospatial/derived/site-vectors.json";
import geospatialBase from "../data/geospatial-base.json";
import siteData from "../data/site-data.json";
import type {
  DerivedBuildingFootprint,
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
  setMapReference: (enabled: boolean) => void;
}

interface GeospatialBaseRuntime {
  origin: {
    latitude: number;
    longitude: number;
    easting: number;
    northing: number;
  };
  geographicBounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
  mapReference: {
    tileTemplate: string;
    zoom: number;
    maxTiles: number;
    attribution: string;
    attributionUrl: string;
  };
  terrain: {
    active: string;
    fallbackActive: boolean;
  };
  vectors: {
    active: string;
    fallbackActive: boolean;
  };
}

interface DerivedSiteVectors {
  available: boolean;
  metadata?: {
    roadCount: number;
    spaceCount: number;
    buildingFootprintCount: number;
  };
  roads: LinearFeature[];
  spaces: LinearFeature[];
  buildingFootprints: DerivedBuildingFootprint[];
}

const data = siteData as unknown as SalvadorSiteData;
const geo = geospatialBase as GeospatialBaseRuntime;
const derivedVectors =
  derivedVectorsData as unknown as DerivedSiteVectors;
function normalizeFeatureName(name: string) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

function mergeLinearFeatures(
  fallback: LinearFeature[],
  derived: LinearFeature[],
) {
  const derivedNames = new Set(
    derived.map((feature) => normalizeFeatureName(feature.name)),
  );
  return [
    ...fallback.filter(
      (feature) =>
        !derivedNames.has(normalizeFeatureName(feature.name)),
    ),
    ...derived,
  ];
}

const derivedVectorsUsable =
  (geo.vectors.active === "geospatial-derived" ||
    geo.vectors.active === "geospatial-hybrid") &&
  derivedVectors.available;
const runtimeRoads =
  geo.vectors.active === "geospatial-derived" &&
  derivedVectors.available
    ? derivedVectors.roads
    : geo.vectors.active === "geospatial-hybrid" &&
        derivedVectors.available
      ? [...data.roads, ...derivedVectors.roads]
      : data.roads;
const runtimeSpaces =
  geo.vectors.active === "geospatial-derived" &&
  derivedVectors.available
    ? derivedVectors.spaces
    : geo.vectors.active === "geospatial-hybrid" &&
        derivedVectors.available
      ? mergeLinearFeatures(data.spaces, derivedVectors.spaces)
      : data.spaces;
const derivedBuildingsEligible =
  derivedVectorsUsable &&
  geo.terrain.active === "geospatial-derived" &&
  geo.terrain.fallbackActive === false;
const geospatialFallback =
  geo.terrain.fallbackActive || geo.vectors.fallbackActive;
const osmBbox = [
  geo.geographicBounds.west,
  geo.geographicBounds.south,
  geo.geographicBounds.east,
  geo.geographicBounds.north,
].join(",");
const osmEmbedUrl =
  "https://www.openstreetmap.org/export/embed.html" +
  `?bbox=${encodeURIComponent(osmBbox)}&layer=mapnik` +
  `&marker=${geo.origin.latitude}%2C${geo.origin.longitude}`;

export function SalvadorScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef<SceneControls | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("aerial");
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapReferenceEnabled, setMapReferenceEnabled] = useState(true);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveOsmState, setLiveOsmState] = useState<
    "loading" | "active" | "cached" | "unavailable"
  >("loading");
  const [liveOsmCounts, setLiveOsmCounts] = useState({
    roads: 0,
    spaces: 0,
    buildings: 0,
  });
  const [liveTerrainState, setLiveTerrainState] = useState<
    "loading" | "active" | "cached" | "unavailable"
  >("loading");
  const [liveTerrainStats, setLiveTerrainStats] = useState({
    contours: 0,
    columns: 0,
    rows: 0,
    maxHeight: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let clearRuntimeTerrain: (() => void) | null = null;

    const handleResize = () => engine?.resize();

    async function boot() {
      try {
        const [
          { Engine },
          { Scene },
          { HemisphericLight },
          { DirectionalLight },
          { ShadowGenerator },
          { Vector3 },
          { Color3, Color4 },
          { createTerrain, setRuntimeDerivedTerrain },
          { createOsmTerrainReference },
          { createRoads, createSpaces },
          { createBuildings },
          { createBuildingFootprintGuides },
          { loadLiveOsmVectors },
          { loadLiveConderTerrain },
          { deriveRuntimeBuildingBlockouts },
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
          import("@babylonjs/core/Lights/Shadows/shadowGenerator"),
          import("@babylonjs/core/Maths/math.vector"),
          import("@babylonjs/core/Maths/math.color"),
          import("../game/terrain"),
          import("../game/osm-terrain-reference"),
          import("../game/roads"),
          import("../game/buildings"),
          import("../game/building-footprint-guides"),
          import("../game/live-osm"),
          import("../game/live-conder"),
          import("../game/derived-buildings"),
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
        scene.clearColor = new Color4(0.16, 0.19, 0.2, 1);

        const ambient = new HemisphericLight(
          "ambient-light",
          new Vector3(0.2, 1, 0.1),
          scene,
        );
        ambient.intensity = 1.12;
        ambient.groundColor = new Color3(0.22, 0.2, 0.17);

        const sun = new DirectionalLight(
          "sun-light",
          new Vector3(-0.55, -1, 0.35),
          scene,
        );
        sun.position = new Vector3(120, 180, -80);
        sun.intensity = 0.74;

        clearRuntimeTerrain = () =>
          setRuntimeDerivedTerrain(null);

        let terrainMeshes = createTerrain(
          scene,
          data.terrain,
          data.levels,
        );
        let mapReference = createOsmTerrainReference(
          scene,
          geo.mapReference,
          geo.origin,
          geo.geographicBounds,
          data.terrain,
          data.levels,
        );
        let mapReferenceRuntimeEnabled = true;
        mapReference.setEnabled(
          mapReferenceRuntimeEnabled,
        );

        let activeRoadFeatures = runtimeRoads;
        let activeSpaceFeatures = runtimeSpaces;
        let activeBuildingFootprints:
          DerivedBuildingFootprint[] = [];

        let spaceMeshes = createSpaces(
          scene,
          runtimeSpaces,
          data.terrain,
          data.levels,
        );
        let roadMeshes = createRoads(
          scene,
          runtimeRoads,
          data.terrain,
          data.levels,
        );
        const derivedBuildingResult = derivedBuildingsEligible
          ? deriveRuntimeBuildingBlockouts(
              derivedVectors.buildingFootprints,
              data.terrain,
              data.levels,
              [...data.buildings, ...data.elevator].flatMap(
                (item) => (item.footprint ? [item.footprint] : []),
              ),
              data.buildings,
            )
          : null;
        const replacedFallbackIds = new Set(
          derivedBuildingResult?.replacedFallbackIds ?? [],
        );
        const curatedBuildings = derivedBuildingResult
          ? data.buildings.filter(
              (building) =>
                !replacedFallbackIds.has(building.id),
            )
          : data.buildings;
        const runtimeBuildings = [
          ...curatedBuildings,
          ...(derivedBuildingResult?.buildings ?? []),
        ];
        const buildingMeshes = createBuildings(
          scene,
          runtimeBuildings,
        );
        const elevatorMeshes = createElevatorBlockout(
          scene,
          data.elevator,
        );
        createConnectionPoints(scene, data.landmarks);
        const barrierMeshes = createBarriers(scene, data.barriers);

        const shadows = new ShadowGenerator(2048, sun);
        shadows.useBlurExponentialShadowMap = true;
        shadows.blurKernel = 24;
        shadows.bias = 0.0005;
        shadows.normalBias = 0.025;
        shadows.setDarkness(0.3);

        for (const mesh of [
          ...buildingMeshes,
          ...elevatorMeshes,
          ...barrierMeshes,
        ]) {
          shadows.addShadowCaster(mesh);
        }

        for (const mesh of terrainMeshes) {
          mesh.receiveShadows = true;
        }

        const cameras = createCameras(scene, canvas);
        configurePlayer(scene, cameras.street);

        const debug = createDebug(scene, [
          ...runtimeBuildings,
          ...data.elevator,
          ...data.landmarks,
          ...data.barriers,
        ]);
        debug.setEnabled(false);

        controlsRef.current = {
          activateCamera: cameras.activate,
          setDebug: debug.setEnabled,
          setMapReference: (enabled) => {
            mapReferenceRuntimeEnabled = enabled;
            mapReference.setEnabled(enabled);
          },
        };

        engine.runRenderLoop(() => {
          scene?.render();
        });

        window.addEventListener("resize", handleResize);
        setLoadState("ready");

        let buildingGuideMeshes: ReturnType<
          typeof createBuildingFootprintGuides
        > = [];

        void loadLiveOsmVectors({
          geographicBounds: geo.geographicBounds,
          localBounds: data.terrain.bounds,
          origin: {
            easting: geo.origin.easting,
            northing: geo.origin.northing,
          },
        })
          .then((live) => {
            const liveScene = scene;
            if (disposed || !liveScene) return;

            if (live.roads.length > 0) {
              activeRoadFeatures = live.roads;
              for (const mesh of roadMeshes) {
                mesh.dispose();
              }
              roadMeshes = createRoads(
                liveScene,
                live.roads,
                data.terrain,
                data.levels,
              );
            }

            if (live.spaces.length > 0) {
              activeSpaceFeatures =
                mergeLinearFeatures(
                  runtimeSpaces,
                  live.spaces,
                );
              for (const mesh of spaceMeshes) {
                mesh.dispose();
              }
              spaceMeshes = createSpaces(
                liveScene,
                activeSpaceFeatures,
                data.terrain,
                data.levels,
              );
            }

            activeBuildingFootprints =
              live.buildingFootprints;
            for (const mesh of buildingGuideMeshes) {
              mesh.dispose();
            }
            buildingGuideMeshes =
              createBuildingFootprintGuides(
                liveScene,
                activeBuildingFootprints,
                data.terrain,
                data.levels,
              );

            setLiveOsmCounts({
              roads: live.roads.length,
              spaces: live.spaces.length,
              buildings:
                live.buildingFootprints.length,
            });
            setLiveOsmState(
              live.source === "session-cache"
                ? "cached"
                : "active",
            );
          })
          .catch((error) => {
            console.warn(
              "Live OSM vectors unavailable; keeping versioned seed.",
              error,
            );
            if (!disposed) {
              setLiveOsmState("unavailable");
            }
          });
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

  const toggleMapReference = () => {
    setMapReferenceEnabled((current) => {
      const next = !current;
      controlsRef.current?.setMapReference(next);
      return next;
    });
  };

  return (
    <main className="relative h-dvh min-h-[480px] w-full overflow-hidden bg-[#0b1110] text-[#f2eee4]">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none outline-none transition-opacity ${
          mapVisible ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        tabIndex={0}
        aria-label="Cena 3D navegável do Centro Histórico de Salvador"
        onPointerDown={(event) => event.currentTarget.focus()}
      />

      {mapVisible && (
        <section className="absolute inset-0 z-[5] bg-[#e9e5dc]">
          <iframe
            title="Mapa real OpenStreetMap do perímetro do projeto"
            src={osmEmbedUrl}
            className="h-full w-full border-0"
            loading="eager"
          />
          <div className="pointer-events-none absolute bottom-20 left-4 max-w-sm rounded-xl border border-black/10 bg-white/92 p-3 text-xs text-black/75 shadow-xl backdrop-blur-md">
            <p className="font-semibold text-black">
              Referência geográfica real · OpenStreetMap
            </p>
            <p className="mt-1">
              Origem: Elevador Lacerda · {geo.origin.latitude.toFixed(7)},{" "}
              {geo.origin.longitude.toFixed(7)}
            </p>
            <p className="mt-1">
              Recorte: {(geo.geographicBounds.east - geo.geographicBounds.west).toFixed(6)}° ×{" "}
              {(geo.geographicBounds.north - geo.geographicBounds.south).toFixed(6)}°
            </p>
            {geospatialFallback && (
              <p className="mt-2 font-medium text-[#8a5514]">
                O mapa é real; o 3D ainda usa fallback até os produtos GIS derivados serem materializados.
              </p>
            )}
          </div>
        </section>
      )}

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
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                geospatialFallback ? "bg-[#d89a3d]" : "bg-[#75b884]"
              }`}
            />
            Base geo: {geo.terrain.active} · {geo.vectors.active}
          </div>
          <div className="mt-1 text-white/45">
            GIS materializado: {derivedVectors.metadata?.roadCount ?? 0} ruas ·{" "}
            {derivedVectors.metadata?.spaceCount ?? 0} espaços ·{" "}
            {derivedVectors.metadata?.buildingFootprintCount ?? 0} edifícios
          </div>
          <div className="mt-1 text-white/45">
            OSM ao vivo:{" "}
            {liveOsmState === "loading"
              ? "carregando"
              : liveOsmState === "active"
                ? "ativo"
                : liveOsmState === "cached"
                  ? "cache da sessão"
                  : "indisponível — usando seed"}
            {(liveOsmState === "active" ||
              liveOsmState === "cached") && (
              <>
                {" "}· {liveOsmCounts.roads} ruas ·{" "}
                {liveOsmCounts.spaces} áreas ·{" "}
                {liveOsmCounts.buildings} footprints
              </>
            )}
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
<button
          type="button"
          onClick={toggleMapReference}
          disabled={loadState !== "ready" || mapVisible}
          aria-pressed={mapReferenceEnabled}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
            mapReferenceEnabled
              ? "bg-[#75b884] text-[#0c2114]"
              : "bg-white/5 text-white/75 hover:bg-white/10"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Mapa no terreno
        </button>
                <button
          type="button"
          onClick={() => setMapVisible((current) => !current)}
          aria-pressed={mapVisible}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
            mapVisible
              ? "bg-[#75b884] text-[#0c2114]"
              : "bg-white/5 text-white/75 hover:bg-white/10"
          }`}
        >
          {mapVisible ? "Voltar ao 3D" : "Mapa real"}
        </button>
      </div>

{!mapVisible &&
        (mapReferenceEnabled ||
          geo.vectors.active.startsWith("geospatial") ||
          liveOsmState === "active" ||
          liveOsmState === "cached") && (
        <a
          href={geo.mapReference.attributionUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-4 right-4 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] text-white/75 underline-offset-2 hover:underline"
        >
          {geo.mapReference.attribution}
        </a>
      )}

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
