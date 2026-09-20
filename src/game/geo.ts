const SEMI_MAJOR_AXIS = 6_378_137;
const FLATTENING = 1 / 298.257223563;
const ECCENTRICITY_SQUARED =
  FLATTENING * (2 - FLATTENING);
const SECOND_ECCENTRICITY_SQUARED =
  ECCENTRICITY_SQUARED /
  (1 - ECCENTRICITY_SQUARED);
const SCALE_FACTOR = 0.9996;
const CENTRAL_MERIDIAN = (-39 * Math.PI) / 180;
const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

export function latLonToUtm24S(
  latitude: number,
  longitude: number,
): [number, number] {
  const phi = latitude * TO_RADIANS;
  const lambda = longitude * TO_RADIANS;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const n =
    SEMI_MAJOR_AXIS /
    Math.sqrt(
      1 -
        ECCENTRICITY_SQUARED *
          sinPhi *
          sinPhi,
    );
  const t = tanPhi * tanPhi;
  const c =
    SECOND_ECCENTRICITY_SQUARED *
    cosPhi *
    cosPhi;
  const aTerm =
    cosPhi * (lambda - CENTRAL_MERIDIAN);
  const e4 =
    ECCENTRICITY_SQUARED *
    ECCENTRICITY_SQUARED;
  const e6 = e4 * ECCENTRICITY_SQUARED;

  const meridionalArc =
    SEMI_MAJOR_AXIS *
    ((1 -
      ECCENTRICITY_SQUARED / 4 -
      (3 * e4) / 64 -
      (5 * e6) / 256) *
      phi -
      (3 * ECCENTRICITY_SQUARED / 8 +
        (3 * e4) / 32 +
        (45 * e6) / 1024) *
        Math.sin(2 * phi) +
      ((15 * e4) / 256 +
        (45 * e6) / 1024) *
        Math.sin(4 * phi) -
      ((35 * e6) / 3072) *
        Math.sin(6 * phi));

  const easting =
    500_000 +
    SCALE_FACTOR *
      n *
      (aTerm +
        ((1 - t + c) * aTerm ** 3) /
          6 +
        ((5 -
          18 * t +
          t ** 2 +
          72 * c -
          58 *
            SECOND_ECCENTRICITY_SQUARED) *
          aTerm ** 5) /
          120);

  let northing =
    SCALE_FACTOR *
    (meridionalArc +
      n *
        tanPhi *
        (aTerm ** 2 / 2 +
          ((5 -
            t +
            9 * c +
            4 * c ** 2) *
            aTerm ** 4) /
            24 +
          ((61 -
            58 * t +
            t ** 2 +
            600 * c -
            330 *
              SECOND_ECCENTRICITY_SQUARED) *
            aTerm ** 6) /
            720));

  if (latitude < 0) {
    northing += 10_000_000;
  }

  return [easting, northing];
}

export function geographicToLocalMeters(
  latitude: number,
  longitude: number,
  originEasting: number,
  originNorthing: number,
): [number, number] {
  const [easting, northing] =
    latLonToUtm24S(latitude, longitude);
  return [
    easting - originEasting,
    northing - originNorthing,
  ];
}

export function utm24SToLatLon(
  easting: number,
  northing: number,
): [number, number] {
  const x = easting - 500_000;
  const y = northing - 10_000_000;
  const e4 =
    ECCENTRICITY_SQUARED *
    ECCENTRICITY_SQUARED;
  const e6 =
    e4 * ECCENTRICITY_SQUARED;
  const meridionalArc = y / SCALE_FACTOR;
  const mu =
    meridionalArc /
    (SEMI_MAJOR_AXIS *
      (1 -
        ECCENTRICITY_SQUARED / 4 -
        (3 * e4) / 64 -
        (5 * e6) / 256));
  const e1 =
    (1 -
      Math.sqrt(
        1 - ECCENTRICITY_SQUARED,
      )) /
    (1 +
      Math.sqrt(
        1 - ECCENTRICITY_SQUARED,
      ));

  const phi1 =
    mu +
    (3 * e1 / 2 -
      (27 * e1 ** 3) / 32) *
      Math.sin(2 * mu) +
    (21 * e1 ** 2 / 16 -
      (55 * e1 ** 4) / 32) *
      Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) *
      Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) *
      Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const c1 =
    SECOND_ECCENTRICITY_SQUARED *
    cosPhi1 *
    cosPhi1;
  const t1 = tanPhi1 * tanPhi1;
  const n1 =
    SEMI_MAJOR_AXIS /
    Math.sqrt(
      1 -
        ECCENTRICITY_SQUARED *
          sinPhi1 *
          sinPhi1,
    );
  const r1 =
    (SEMI_MAJOR_AXIS *
      (1 -
        ECCENTRICITY_SQUARED)) /
    (1 -
      ECCENTRICITY_SQUARED *
        sinPhi1 *
        sinPhi1) **
      1.5;
  const d =
    x / (n1 * SCALE_FACTOR);

  const latitude =
    phi1 -
    ((n1 * tanPhi1) / r1) *
      (d ** 2 / 2 -
        ((5 +
          3 * t1 +
          10 * c1 -
          4 * c1 ** 2 -
          9 *
            SECOND_ECCENTRICITY_SQUARED) *
          d ** 4) /
          24 +
        ((61 +
          90 * t1 +
          298 * c1 +
          45 * t1 ** 2 -
          252 *
            SECOND_ECCENTRICITY_SQUARED -
          3 * c1 ** 2) *
          d ** 6) /
          720);

  const longitude =
    CENTRAL_MERIDIAN +
    (d -
      ((1 + 2 * t1 + c1) *
        d ** 3) /
        6 +
      ((5 -
        2 * c1 +
        28 * t1 -
        3 * c1 ** 2 +
        8 *
          SECOND_ECCENTRICITY_SQUARED +
        24 * t1 ** 2) *
        d ** 5) /
        120) /
      cosPhi1;

  return [
    latitude * TO_DEGREES,
    longitude * TO_DEGREES,
  ];
}

export function localMetersToGeographic(
  x: number,
  z: number,
  originEasting: number,
  originNorthing: number,
): [number, number] {
  return utm24SToLatLon(
    originEasting + x,
    originNorthing + z,
  );
}
