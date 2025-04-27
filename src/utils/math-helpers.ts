import * as THREE from 'three';

/**
 * Convert radians to degrees
 */
export const radToDeg = (radians: number): number => {
    return radians * (180 / Math.PI);
};

/**
 * Convert Euler rotation to heading, pitch, roll format
 * @param euler Euler angles in YXZ order (yaw, pitch, roll)
 */
export function eulerToHPR(euler: THREE.Euler): { heading: number, pitch: number, roll: number } {
    // Convert to degrees
    const heading = THREE.MathUtils.radToDeg(euler.y) % 360;
    const pitch = THREE.MathUtils.radToDeg(euler.x);
    const roll = THREE.MathUtils.radToDeg(euler.z);

    // Normalize the heading to be 0-360
    const normalizedHeading = heading < 0 ? heading + 360 : heading;

    return {
        heading: normalizedHeading,
        pitch: pitch,
        roll: roll
    };
}

/**
 * Calculate distance in km between two geographic coordinates using the Haversine formula
 * @param lon1 Longitude of first point
 * @param lat1 Latitude of first point
 * @param lon2 Longitude of second point
 * @param lat2 Latitude of second point
 * @returns Distance in kilometers
 */
export function calculateGeoDistanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = THREE.MathUtils.degToRad(lat2 - lat1);
    const dLon = THREE.MathUtils.degToRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(THREE.MathUtils.degToRad(lat1)) * Math.cos(THREE.MathUtils.degToRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate direction vector from one geographic point to another
 * @param fromLon Source longitude
 * @param fromLat Source latitude
 * @param toLon Destination longitude
 * @param toLat Destination latitude
 * @returns Normalized direction vector {x, y} where x is east-west and y is north-south
 */
export function calculateGeoDirection(fromLon: number, fromLat: number, toLon: number, toLat: number): { x: number, y: number } {
    const dLon = toLon - fromLon;
    const dLat = toLat - fromLat;

    // Simple vector normalization
    const length = Math.sqrt(dLon * dLon + dLat * dLat);

    if (length === 0) {
        return { x: 0, y: 0 };
    }

    return {
        x: dLon / length,
        y: dLat / length
    };
}