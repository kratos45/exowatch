"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Eye, Sparkles } from "lucide-react";

interface SolarObject {
  name: string;
  type: string;
  a: number; // Semi-major axis (AU or scaled units)
  e: number; // Eccentricity
  period: number; // Orbital period
  inclination?: number;
  diameter?: number;
  velocity?: number;
  material?: string;
  threat_centrality?: number;
  impact_prob?: number;
  pha?: boolean;
  color: string;
  radius: number;
}

interface LivingSolarSystemProps {
  data: {
    planets: SolarObject[];
    asteroids: SolarObject[];
  };
  onSelectObject: (obj: SolarObject) => void;
  selectedObjectName?: string;
}

export default function LivingSolarSystem3D({
  data,
  onSelectObject,
  selectedObjectName,
}: LivingSolarSystemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [hoveredObject, setHoveredObject] = useState<SolarObject | null>(null);
  const [showOrbits, setShowOrbits] = useState(true);

  // References for animation loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const meshMapRef = useRef<Map<string, { mesh: THREE.Mesh; data: SolarObject; orbitLine?: THREE.Line }>>(new Map());
  const simTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);
  const speedRef = useRef<number>(1.0);

  isPlayingRef.current = isPlaying;
  speedRef.current = speedMultiplier;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0f1d"); // Deep space navy/black
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 45, 60);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const sunPointLight = new THREE.PointLight(0xffffff, 2.5, 300);
    sunPointLight.position.set(0, 0, 0);
    scene.add(sunPointLight);

    // 5. Starfield background
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 400;
      starPositions[i + 1] = (Math.random() - 0.5) * 400;
      starPositions[i + 2] = (Math.random() - 0.5) * 400;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.6, transparent: true, opacity: 0.8 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 6. Create celestial bodies
    const meshes = new Map<string, { mesh: THREE.Mesh; data: SolarObject; orbitLine?: THREE.Line }>();

    // SCALE FACTOR: AU to 3D Scene units
    const AU_SCALE = 16.0;

    const allBodies = [...(data.planets || []), ...(data.asteroids || [])];

    allBodies.forEach((body) => {
      const isSun = body.type === "star";
      const a = isSun ? 0 : Math.max(0.4, body.a) * AU_SCALE;
      const e = Math.min(0.85, Math.max(0.01, body.e));
      const inc = ((body.inclination || 0) * Math.PI) / 180;

      // Object Geometry & Material
      let geometry: THREE.BufferGeometry;
      let material: THREE.Material;

      if (isSun) {
        geometry = new THREE.SphereGeometry(3.5, 32, 32);
        material = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

        // Sun Glow Halo
        const glowGeo = new THREE.SphereGeometry(4.2, 32, 32);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.25,
          side: THREE.BackSide,
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        scene.add(glowMesh);
      } else {
        const radius = Math.max(0.2, (body.radius || 0.5) * (body.type === "planet" ? 1.0 : 0.8));
        geometry = new THREE.SphereGeometry(radius, 16, 16);
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(body.color || "#00ffff"),
          roughness: 0.6,
          metalness: 0.3,
          emissive: body.pha ? new THREE.Color(0xff0000) : new THREE.Color(0x000000),
          emissiveIntensity: body.pha ? 0.4 : 0.0,
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      (mesh as any).userData = { objectData: body };
      scene.add(mesh);

      // Orbit Ellipse Line
      let orbitLine: THREE.Line | undefined;
      if (!isSun) {
        const pointsCount = 128;
        const orbitPoints: THREE.Vector3[] = [];
        const b = a * Math.sqrt(1 - e * e); // Semi-minor axis
        const c = a * e; // Focus offset from center

        for (let i = 0; i <= pointsCount; i++) {
          const theta = (i / pointsCount) * Math.PI * 2;
          const x = a * Math.cos(theta) - c;
          const z = b * Math.sin(theta);
          const y = z * Math.sin(inc);
          const zRotated = z * Math.cos(inc);
          orbitPoints.push(new THREE.Vector3(x, y, zRotated));
        }

        const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMat = new THREE.LineBasicMaterial({
          color: body.type === "planet" ? 0x06b6d4 : (body.pha ? 0xef4444 : 0x334155),
          transparent: true,
          opacity: body.type === "planet" ? 0.45 : (body.pha ? 0.6 : 0.25),
        });
        orbitLine = new THREE.Line(orbitGeo, orbitMat);
        scene.add(orbitLine);
      }

      meshes.set(body.name, { mesh, data: body, orbitLine });
    });

    meshMapRef.current = meshes;

    // 7. Raycasting for Mouse Hover & Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const interactiveMeshes = Array.from(meshMapRef.current.values()).map((v) => v.mesh);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const targetData = (intersects[0].object as any).userData?.objectData;
        if (targetData) {
          setHoveredObject(targetData);
          container.style.cursor = "pointer";
          return;
        }
      }
      setHoveredObject(null);
      container.style.cursor = "grab";
    };

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const interactiveMeshes = Array.from(meshMapRef.current.values()).map((v) => v.mesh);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const targetData = (intersects[0].object as any).userData?.objectData;
        if (targetData && targetData.type !== "star") {
          onSelectObject(targetData);
        }
      }
    };

    container.addEventListener("mousemove", onPointerMove);
    container.addEventListener("click", onPointerDown);

    // Simple OrbitControls (Drag to rotate camera, Wheel to zoom)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let cameraAngleX = 0.8;
    let cameraAngleY = 0.6;
    let cameraDistance = 75;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      cameraAngleX -= deltaX * 0.008;
      cameraAngleY = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAngleY + deltaY * 0.008));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance = Math.max(15, Math.min(180, cameraDistance + e.deltaY * 0.05));
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("wheel", onWheel, { passive: false });

    // 8. Animation Loop
    let lastTimestamp = performance.now();

    const animate = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      if (isPlayingRef.current) {
        simTimeRef.current += delta * speedRef.current * 1.5;
      }

      const simTime = simTimeRef.current;

      // Update camera position based on spherical coordinates
      camera.position.x = cameraDistance * Math.sin(cameraAngleX) * Math.cos(cameraAngleY);
      camera.position.y = cameraDistance * Math.sin(cameraAngleY);
      camera.position.z = cameraDistance * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);
      camera.lookAt(0, 0, 0);

      // Rotate starfield slowly
      starField.rotation.y += 0.0002;

      // Propagate Keplerian orbits
      meshMapRef.current.forEach(({ mesh, data: body }) => {
        if (body.type === "star") return;

        const a = Math.max(0.4, body.a) * AU_SCALE;
        const e = Math.min(0.85, Math.max(0.01, body.e));
        const b = a * Math.sqrt(1 - e * e);
        const c = a * e;
        const inc = ((body.inclination || 0) * Math.PI) / 180;
        const period = Math.max(10, body.period);

        // Mean Anomaly M = n * t
        const n = (Math.PI * 2) / period;
        const M = (simTime * n * 5.0) % (Math.PI * 2);

        // Approximate Kepler's Equation: E ~ M + e * sin(M)
        const E = M + e * Math.sin(M);

        // Position in orbital plane
        const x = a * Math.cos(E) - c;
        const z = b * Math.sin(E);

        // Rotate for orbital inclination
        mesh.position.x = x;
        mesh.position.y = z * Math.sin(inc);
        mesh.position.z = z * Math.cos(inc);

        mesh.rotation.y += 0.02;
      });

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", onPointerMove);
      container.removeEventListener("click", onPointerDown);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
    };
  }, [data]);

  // Toggle orbit lines visibility
  useEffect(() => {
    meshMapRef.current.forEach(({ orbitLine }) => {
      if (orbitLine) orbitLine.visible = showOrbits;
    });
  }, [showOrbits]);

  return (
    <div className="relative w-full h-full min-h-[550px] rounded-xl overflow-hidden border-2 border-cyan-200 shadow-[0_0_25px_rgba(0,255,255,0.2)] bg-black">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full min-h-[550px]" />

      {/* Floating Cockpit HUD Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-auto">
        <div className="bg-white/90 backdrop-blur-md border border-cyan-300 p-3 rounded-lg shadow-lg font-mono text-xs">
          <div className="flex items-center gap-2 text-cyan-600 font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4 text-cyan-500 animate-spin" /> Cockpit Système Solaire 3D
          </div>
          <div className="text-gray-700 text-[11px] leading-tight space-y-1">
            <div>🛰️ Objets en orbite : <span className="font-bold text-cyan-700">{data.asteroids?.length || 0} NEOs</span> + 5 Planètes</div>
            <div>⏱️ Vitesse simulation : <span className="font-bold text-cyan-700">{speedMultiplier.toFixed(1)}x</span></div>
            <div className="text-gray-500 text-[10px]">Glissez pour pivoter • Molette pour zoomer • Cliquez un astéroïde</div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md border border-cyan-300 p-2 rounded-lg shadow-lg">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded hover:bg-cyan-50 text-cyan-600 transition"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-700">
            <span>0.2x</span>
            <input
              type="range"
              min="0.2"
              max="5.0"
              step="0.2"
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
              className="w-20 accent-cyan-500 cursor-pointer"
            />
            <span>5x</span>
          </div>
          <button
            onClick={() => setShowOrbits(!showOrbits)}
            className={`px-2 py-1 text-[10px] font-mono rounded border transition ${
              showOrbits ? "bg-cyan-100 text-cyan-700 border-cyan-400" : "bg-gray-100 text-gray-500 border-gray-300"
            }`}
          >
            Orbites
          </button>
        </div>
      </div>

      {/* Hovered Object Telemetry Tooltip */}
      {hoveredObject && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md border-2 border-cyan-400 p-3 rounded-lg shadow-xl font-mono text-xs max-w-sm pointer-events-none z-20">
          <div className="flex items-center justify-between gap-2 border-b border-cyan-100 pb-1.5 mb-2">
            <span className="font-bold text-gray-900 text-sm truncate">{hoveredObject.name}</span>
            {hoveredObject.pha && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold animate-pulse">
                GÉOCROISEUR PHA
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-700">
            <div>Demi-grand axe : <span className="font-bold text-cyan-600">{hoveredObject.a} UA</span></div>
            <div>Excentricité : <span className="font-bold text-cyan-600">{hoveredObject.e}</span></div>
            <div>Diamètre : <span className="font-bold text-gray-800">{hoveredObject.diameter || "N/A"} km</span></div>
            <div>Vitesse : <span className="font-bold text-gray-800">{hoveredObject.velocity || "54000"} km/h</span></div>
            <div>Matériau : <span className="font-bold text-amber-600">{hoveredObject.material || "Silicates"}</span></div>
            <div>Impact Prob : <span className="font-bold text-red-600">{hoveredObject.impact_prob || 0}%</span></div>
          </div>
          <div className="text-[10px] text-cyan-500 mt-2 text-right font-bold">Cliquez pour verrouiller l'analyse ➔</div>
        </div>
      )}

      {/* Selected Target HUD Indicator */}
      {selectedObjectName && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md border border-cyan-400 px-3 py-1.5 rounded-lg shadow font-mono text-xs text-cyan-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
          Cible active : <span className="font-bold text-gray-900">{selectedObjectName}</span>
        </div>
      )}
    </div>
  );
}
