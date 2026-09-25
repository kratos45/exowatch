/**
 * Keplerian Orbital Mechanics solver in TypeScript.
 * Converts classical orbital elements (a, e, i, Ω, ω, M)
 * into heliocentric 3D coordinates along the orbital ellipse.
 */

export interface OrbitalElements {
  semi_major_axis: number;           // a (AU)
  eccentricity: number;              // e
  inclination: number;               // i (deg)
  ascending_node_longitude: number;  // Ω (deg)
  perihelion_argument: number;       // ω (deg)
  mean_anomaly?: number;             // M (deg)
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

const DEG_TO_RAD = Math.PI / 180.0;

export function orbitalElementsTo3DPoints(
  elements: OrbitalElements,
  nPoints: number = 100,
  scale: number = 5.0
): Point3D[] {
  const a = (elements.semi_major_axis || 1.0) * scale;
  const e = Math.min(Math.max(elements.eccentricity || 0.05, 0.0), 0.95);
  const inc = (elements.inclination || 0.0) * DEG_TO_RAD;
  const Omega = (elements.ascending_node_longitude || 0.0) * DEG_TO_RAD;
  const omega = (elements.perihelion_argument || 0.0) * DEG_TO_RAD;

  const points: Point3D[] = [];

  for (let k = 0; k <= nPoints; k++) {
    const theta = (2.0 * Math.PI * k) / nPoints; // True anomaly sweep
    const r = (a * (1.0 - e * e)) / (1.0 + e * Math.cos(theta));

    // Orbital plane coordinates (P, Q)
    const xOrb = r * Math.cos(theta);
    const yOrb = r * Math.sin(theta);

    // Rotation to Heliocentric Ecliptic J2000 frame
    const Px = Math.cos(Omega) * Math.cos(omega) - Math.sin(Omega) * Math.sin(omega) * Math.cos(inc);
    const Py = Math.sin(Omega) * Math.cos(omega) + Math.cos(Omega) * Math.sin(omega) * Math.cos(inc);
    const Pz = Math.sin(omega) * Math.sin(inc);

    const Qx = -Math.cos(Omega) * Math.sin(omega) - Math.sin(Omega) * Math.cos(omega) * Math.cos(inc);
    const Qy = -Math.sin(Omega) * Math.sin(omega) + Math.cos(Omega) * Math.cos(omega) * Math.cos(inc);
    const Qz = Math.cos(omega) * Math.sin(inc);

    const x = xOrb * Px + yOrb * Qx;
    const y = xOrb * Py + yOrb * Qy;
    const z = xOrb * Pz + yOrb * Qz;

    points.push({ x, y: z, z: y }); // map Z to elevation
  }

  return points;
}
