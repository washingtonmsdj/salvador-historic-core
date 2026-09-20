const A = 6_378_137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const CENTRAL_MERIDIAN = (-39 * Math.PI) / 180;
const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

export function latLonToUtm24S(latitude, longitude) {
  const phi = latitude * TO_RADIANS;
  const lambda = longitude * TO_RADIANS;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
  const t = tanPhi * tanPhi;
  const c = EP2 * cosPhi * cosPhi;
  const aTerm = cosPhi * (lambda - CENTRAL_MERIDIAN);
  const e4 = E2 * E2;
  const e6 = e4 * E2;

  const meridionalArc =
    A *
    ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      (3 * E2 / 8 + (3 * e4) / 32 + (45 * e6) / 1024) *
        Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi));

  const easting =
    500_000 +
    K0 *
      n *
      (aTerm +
        ((1 - t + c) * aTerm ** 3) / 6 +
        ((5 - 18 * t + t ** 2 + 72 * c - 58 * EP2) * aTerm ** 5) / 120);

  let northing =
    K0 *
    (meridionalArc +
      n *
        tanPhi *
        (aTerm ** 2 / 2 +
          ((5 - t + 9 * c + 4 * c ** 2) * aTerm ** 4) / 24 +
          ((61 - 58 * t + t ** 2 + 600 * c - 330 * EP2) * aTerm ** 6) /
            720));

  if (latitude < 0) northing += 10_000_000;

  return [easting, northing];
}

export function utm24SToLatLon(easting, northing) {
  const x = easting - 500_000;
  const y = northing - 10_000_000;
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const m = y / K0;
  const mu =
    m /
    (A * (1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256));
  const e1 =
    (1 - Math.sqrt(1 - E2)) /
    (1 + Math.sqrt(1 - E2));

  const phi1 =
    mu +
    (3 * e1 / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    (21 * e1 ** 2 / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const c1 = EP2 * cosPhi1 * cosPhi1;
  const t1 = tanPhi1 * tanPhi1;
  const n1 = A / Math.sqrt(1 - E2 * sinPhi1 * sinPhi1);
  const r1 =
    (A * (1 - E2)) /
    (1 - E2 * sinPhi1 * sinPhi1) ** 1.5;
  const d = x / (n1 * K0);

  const latitude =
    phi1 -
    ((n1 * tanPhi1) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * EP2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * EP2 - 3 * c1 ** 2) *
          d ** 6) /
          720);

  const longitude =
    CENTRAL_MERIDIAN +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * EP2 + 24 * t1 ** 2) *
        d ** 5) /
        120) /
      cosPhi1;

  return [latitude * TO_DEGREES, longitude * TO_DEGREES];
}
