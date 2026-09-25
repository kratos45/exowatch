"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { orbitalElementsTo3DPoints } from "@/lib/orbital-mechanics";
import { useSelectionStore } from "@/store/useSelectionStore";

interface OrbitItem {
  entity_id: string;
  name: string;
  semi_major_axis: number;
  eccentricity: number;
  inclination: number;
  ascending_node_longitude: number;
  perihelion_argument: number;
  mean_anomaly?: number;
  is_hazardous?: boolean;
}

interface OrbitViewerProps {
  orbits: OrbitItem[];
  highlightId?: string | null;
}

export function OrbitViewer({ orbits = [], highlightId }: OrbitViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { setSelectedEntity } = useSelectionStore();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0A0E14");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 35, 60);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 250;
    controls.minDistance = 5;

    // 3. Grid & Celestial helpers
    const grid = new THREE.GridHelper(80, 40, "#1f2937", "#131820");
    grid.position.y = -0.05;
    scene.add(grid);

    // 4. Central Sun
    const sunGeom = new THREE.SphereGeometry(1.6, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: "#fbc531" });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    scene.add(sunMesh);

    // Sun light
    const pointLight = new THREE.PointLight("#FFFFFF", 2, 200);
    scene.add(pointLight);
    const ambientLight = new THREE.AmbientLight("#404040", 1.5);
    scene.add(ambientLight);

    // 5. Earth reference orbit (1 AU = 15 units scale)
    const earthPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      earthPoints.push(new THREE.Vector3(Math.cos(a) * 15, 0, Math.sin(a) * 15));
    }
    const earthOrbitGeo = new THREE.BufferGeometry().setFromPoints(earthPoints);
    const earthOrbitMat = new THREE.LineBasicMaterial({ color: "#00D9FF", transparent: true, opacity: 0.35 });
    const earthOrbitLine = new THREE.Line(earthOrbitGeo, earthOrbitMat);
    scene.add(earthOrbitLine);

    // Earth Sphere
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      new THREE.MeshStandardMaterial({ color: "#00D9FF", roughness: 0.5 })
    );
    earthMesh.position.set(15, 0, 0);
    scene.add(earthMesh);

    // 6. Draw Asteroid Keplerian Orbits
    const orbitLinesGroup = new THREE.Group();
    const asteroidMeshesGroup = new THREE.Group();

    orbits.forEach((item) => {
      const isSelected = item.entity_id === highlightId;
      const isHaz = Boolean(item.is_hazardous);

      const pts = orbitalElementsTo3DPoints(
        {
          semi_major_axis: item.semi_major_axis,
          eccentricity: item.eccentricity,
          inclination: item.inclination,
          ascending_node_longitude: item.ascending_node_longitude,
          perihelion_argument: item.perihelion_argument,
          mean_anomaly: item.mean_anomaly,
        },
        120,
        15.0 // scale: 1 AU = 15 scene units
      );

      const vecPoints = pts.map((p) => new THREE.Vector3(p.x, p.y, p.z));
      const geom = new THREE.BufferGeometry().setFromPoints(vecPoints);

      const lineColor = isSelected
        ? "#FFFFFF"
        : isHaz
        ? "#ff4757"
        : "#2ed573";

      const lineMat = new THREE.LineBasicMaterial({
        color: lineColor,
        linewidth: isSelected ? 3 : 1,
        transparent: true,
        opacity: isSelected ? 1.0 : isHaz ? 0.75 : 0.45,
      });

      const line = new THREE.Line(geom, lineMat);
      orbitLinesGroup.add(line);

      // Asteroid position marker (first point or perihelion)
      if (vecPoints.length > 0) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(isSelected ? 0.7 : 0.4, 12, 12),
          new THREE.MeshBasicMaterial({ color: lineColor })
        );
        marker.position.copy(vecPoints[0]);
        marker.userData = { entity_id: item.entity_id, name: item.name };
        asteroidMeshesGroup.add(marker);
      }
    });

    scene.add(orbitLinesGroup);
    scene.add(asteroidMeshesGroup);

    // 7. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Slow rotation of earth around sun
      const t = Date.now() * 0.0003;
      earthMesh.position.x = Math.cos(t) * 15;
      earthMesh.position.z = Math.sin(t) * 15;

      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [orbits, highlightId]);

  return (
    <div className="relative h-[650px] w-full overflow-hidden rounded-xl border border-[#1f2937] bg-[#0A0E14]">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="h-full w-full" />

      {/* Overlay Mission Control HUD info */}
      <div className="absolute top-4 left-4 rounded-lg border border-[#1f2937] bg-[#0A0E14]/80 p-3 backdrop-blur-md font-mono text-xs space-y-1">
        <div className="text-[10px] text-[#8b949e]">SYSTÈME SOLAIRE HÉLIOCENTRIQUE J2000</div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[#00D9FF]">
            <span className="h-2 w-2 rounded-full bg-[#00D9FF]" />
            Terre (1 UA)
          </span>
          <span className="flex items-center gap-1.5 text-[#ff4757]">
            <span className="h-2 w-2 rounded-full bg-[#ff4757]" />
            Dangereux (PHA)
          </span>
          <span className="flex items-center gap-1.5 text-[#2ed573]">
            <span className="h-2 w-2 rounded-full bg-[#2ed573]" />
            Non menaçant
          </span>
        </div>
      </div>

      {/* Control instructions bottom right */}
      <div className="absolute bottom-4 right-4 rounded-lg border border-[#1f2937] bg-[#0A0E14]/80 px-3 py-1.5 font-mono text-[10px] text-[#8b949e] backdrop-blur-md">
        Clic gauche : rotation • Molette : zoom • Clic droit : translation
      </div>
    </div>
  );
}
