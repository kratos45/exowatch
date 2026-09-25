"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { AlertOctagon, Flame, Waves, Radio, ShieldCheck, MapPin, Zap, Compass } from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const PRESET_LOCATIONS = [
  { name: "Paris, France", lat: 48.85, lon: 2.35, type: "rock" },
  { name: "New York, USA", lat: 40.71, lon: -74.0, type: "rock" },
  { name: "Tokyo, Japon", lat: 35.67, lon: 139.65, type: "rock" },
  { name: "Océan Atlantique (Nord)", lat: 32.0, lon: -40.0, type: "water" },
  { name: "Océan Pacifique (Fosse)", lat: 11.3, lon: 142.2, type: "water" },
  { name: "Désert du Sahara", lat: 23.4, lon: 12.5, type: "rock" },
];

export default function ImpactSimulatorView({ selectedTarget }: { selectedTarget?: string }) {
  const [asteroidName, setAsteroidName] = useState<string>(selectedTarget || "99942 Apophis (2004 MN4)");
  const [asteroidList, setAsteroidList] = useState<any[]>([]);
  const [targetLocation, setTargetLocation] = useState(PRESET_LOCATIONS[0]);
  const [customDiameter, setCustomDiameter] = useState<number>(380);
  const [customVelocity, setCustomVelocity] = useState<number>(20.5);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  useEffect(() => {
    axios.get(`${API_URL}/asteroids`).then((res) => {
      setAsteroidList(res.data);
      if (selectedTarget) {
        setAsteroidName(selectedTarget);
      } else if (res.data.length > 0) {
        setAsteroidName(res.data[0].name);
      }
    });
  }, [selectedTarget]);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const payload = {
        asteroid_name: asteroidName,
        target_location: targetLocation.name,
        latitude: targetLocation.lat,
        longitude: targetLocation.lon,
        target_type: targetLocation.type,
        custom_diameter_m: customDiameter,
        custom_velocity_kms: customVelocity,
      };
      const res = await axios.post(`${API_URL}/simulate-impact`, payload);
      setSimulationResult(res.data);
    } catch (err) {
      alert("Erreur lors de la simulation d'impact.");
    }
    setIsSimulating(false);
  };

  // Run simulation once on initial mount
  useEffect(() => {
    handleSimulate();
  }, [asteroidName, targetLocation]);

  const physics = simulationResult?.physics;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-sm h-full">
      {/* Colonne Gauche : Paramètres & Cibles (4/12) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="border-2 border-red-200 shadow-[0_0_15px_rgba(239,68,68,0.15)] rounded-xl bg-white p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-red-100 pb-3">
            <AlertOctagon className="w-5 h-5 text-red-600 animate-pulse" />
            <h2 className="text-red-700 font-extrabold uppercase tracking-wider text-base">
              Modèle d'Impact Terrestre
            </h2>
          </div>

          {/* Asteroid Selector */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">ASTÉROÏDE IMPACTEUR</label>
            <select
              value={asteroidName}
              onChange={(e) => setAsteroidName(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-bold text-gray-800 outline-none focus:border-red-500"
            >
              {asteroidList.map((a, i) => (
                <option key={i} value={a.name}>
                  {a.name} ({a.d_max} km)
                </option>
              ))}
            </select>
          </div>

          {/* Location Presets */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">POINT D'IMPACT ESTIMÉ</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_LOCATIONS.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => setTargetLocation(loc)}
                  className={`p-2 text-left rounded text-[11px] border transition ${
                    targetLocation.name === loc.name
                      ? "bg-red-50 border-red-500 text-red-800 font-bold shadow-[0_0_8px_rgba(239,68,68,0.2)]"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:border-red-300"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className={loc.type === "water" ? "text-cyan-500" : "text-amber-500"} />
                    <span className="truncate">{loc.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Physical Sliders */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div>
              <div className="flex justify-between text-xs text-gray-700 mb-1">
                <span>Diamètre d'Impact</span>
                <span className="font-bold text-red-600">{customDiameter} mètres</span>
              </div>
              <input
                type="range"
                min="50"
                max="2500"
                step="50"
                value={customDiameter}
                onChange={(e) => setCustomDiameter(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded cursor-pointer accent-red-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-700 mb-1">
                <span>Vitesse d'Entrée Atmosphérique</span>
                <span className="font-bold text-red-600">{customVelocity} km/s</span>
              </div>
              <input
                type="range"
                min="11"
                max="45"
                step="0.5"
                value={customVelocity}
                onChange={(e) => setCustomVelocity(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded cursor-pointer accent-red-600"
              />
            </div>
          </div>

          {/* Simulation Trigger Button */}
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold uppercase text-xs rounded-lg transition shadow-[0_0_15px_rgba(239,68,68,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Zap size={16} /> {isSimulating ? "Calcul de l'Onde de Choc..." : "Exécuter la Simulation Physique"}
          </button>
        </div>
      </div>

      {/* Colonne Droite : Visualisation Onde de Choc & Rapport Scientifique (8/12) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        {/* Visualisation Visuelle de l'Onde de Choc (Interactive Shockwave Radar) */}
        <div className="border-2 border-red-200 shadow-[0_0_20px_rgba(239,68,68,0.15)] rounded-xl bg-white p-5 flex flex-col relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-red-600 animate-spin" />
              <h3 className="font-extrabold text-gray-900 uppercase tracking-wider text-sm">
                Radar de Dispersion Cinétique & Onde de Choc
              </h3>
            </div>
            <div className="text-xs text-gray-500 font-bold">
              Épicentre : <span className="text-red-600">{targetLocation.name}</span>
            </div>
          </div>

          {/* Interactive Shockwave SVG Diagram */}
          <div className="w-full h-[260px] bg-gradient-to-b from-gray-900 to-slate-950 rounded-xl relative flex items-center justify-center overflow-hidden border border-gray-800">
            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  "radial-gradient(circle, #06b6d4 1px, transparent 1px), linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)",
                backgroundSize: "20px 20px, 40px 40px, 40px 40px",
              }}
            />

            {/* Shockwave Rings */}
            {physics && (
              <div className="relative flex items-center justify-center">
                {/* 1 psi outer ring (window shatter) */}
                <div
                  className="absolute rounded-full border border-yellow-400/40 bg-yellow-500/5 animate-pulse"
                  style={{
                    width: `${Math.min(240, physics.blast_radii_km.window_breakage_1psi * 5)}px`,
                    height: `${Math.min(240, physics.blast_radii_km.window_breakage_1psi * 5)}px`,
                  }}
                />

                {/* 5 psi ring (building collapse) */}
                <div
                  className="absolute rounded-full border-2 border-orange-500/60 bg-orange-500/10 animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]"
                  style={{
                    width: `${Math.min(180, physics.blast_radii_km.structural_collapse_5psi * 8)}px`,
                    height: `${Math.min(180, physics.blast_radii_km.structural_collapse_5psi * 8)}px`,
                  }}
                />

                {/* 20 psi vaporization fireball */}
                <div
                  className="absolute rounded-full border-2 border-red-500 bg-red-600/30 shadow-[0_0_30px_rgba(239,68,68,0.8)]"
                  style={{
                    width: `${Math.min(90, Math.max(30, physics.blast_radii_km.vaporization_20psi * 12))}px`,
                    height: `${Math.min(90, Math.max(30, physics.blast_radii_km.vaporization_20psi * 12))}px`,
                  }}
                />

                {/* Center Crater Epicenter */}
                <div className="w-4 h-4 rounded-full bg-white border-2 border-red-500 shadow-[0_0_15px_#ffffff] z-10 animate-bounce"></div>

                {/* Floating Distance Markers */}
                <div className="absolute top-2 right-4 text-[10px] text-gray-300 font-mono space-y-1 bg-black/60 backdrop-blur p-2 rounded border border-gray-700">
                  <div className="flex items-center gap-1.5 text-red-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    20 psi (Vaporisation) : {physics.blast_radii_km.vaporization_20psi} km
                  </div>
                  <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    5 psi (Effondrement) : {physics.blast_radii_km.structural_collapse_5psi} km
                  </div>
                  <div className="flex items-center gap-1.5 text-yellow-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    1 psi (Onde sonore) : {physics.blast_radii_km.window_breakage_1psi} km
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Physical Metrics Grid */}
          {physics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-red-50/60 p-3 rounded-lg border border-red-200">
                <div className="text-[10px] text-gray-500 font-bold">ÉNERGIE CINÉTIQUE</div>
                <div className="text-xl font-black text-red-700">{physics.energy_megatons.toLocaleString()} Mt</div>
                <div className="text-[10px] text-red-500">({physics.hiroshima_equivalents.toLocaleString()} Hiroshimas)</div>
              </div>

              <div className="bg-orange-50/60 p-3 rounded-lg border border-orange-200">
                <div className="text-[10px] text-gray-500 font-bold">CRATÈRE FORMÉ</div>
                <div className="text-xl font-black text-orange-700">{physics.crater_diameter_km} km</div>
                <div className="text-[10px] text-orange-600">Profondeur: {physics.crater_depth_m} m</div>
              </div>

              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                <div className="text-[10px] text-gray-500 font-bold">SÉISME RICHTER</div>
                <div className="text-xl font-black text-amber-700">M {physics.richter_magnitude}</div>
                <div className="text-[10px] text-amber-600">Onde de surface P & S</div>
              </div>

              <div className="bg-cyan-50/60 p-3 rounded-lg border border-cyan-200">
                <div className="text-[10px] text-gray-500 font-bold">RAYON THERMIQUE</div>
                <div className="text-xl font-black text-cyan-700">{physics.blast_radii_km.thermal_radiation} km</div>
                <div className="text-[10px] text-cyan-600">Brûlures 3e degré</div>
              </div>
            </div>
          )}

          {/* AI Tactical Civil Defense & Planetary Protection Report */}
          <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
            <div className="flex items-center gap-2 text-red-700 font-bold uppercase tracking-wider mb-2 border-b border-gray-200 pb-1.5">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              Évaluation Tactique Défense Planétaire (IA ExoWatch)
            </div>
            <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-[12px]">
              {simulationResult?.llm_tactical_assessment || "Calcul de l'évaluation tactique en cours..."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
