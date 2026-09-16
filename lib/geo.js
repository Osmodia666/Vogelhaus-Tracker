const toRad = deg => (deg * Math.PI) / 180
const toDeg = rad => (rad * 180) / Math.PI

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Peilung in Grad ab Norden (0-360), im Uhrzeigersinn.
export function bearingDegrees(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

const COMPASS_POINTS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']
export function compassLabel(bearing) {
  return COMPASS_POINTS[Math.round(bearing / 45) % 8]
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}
