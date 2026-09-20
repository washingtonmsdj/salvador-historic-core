const EARTH_RADIUS_METERS = 6_378_137;

export function geographicToLocalMeters(
  latitude: number,
  longitude: number,
  originLatitude: number,
  originLongitude: number,
): [number, number] {
  const toRadians = Math.PI / 180;
  const x =
    (longitude - originLongitude) * toRadians * EARTH_RADIUS_METERS *
    Math.cos(originLatitude * toRadians);
  const z = (latitude - originLatitude) * toRadians * EARTH_RADIUS_METERS;
  return [x, z];
}
