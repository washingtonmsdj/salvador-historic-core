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
