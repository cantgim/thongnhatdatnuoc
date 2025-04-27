import * as THREE from 'three';

export interface AircraftControls {
    pitch: number;     // -1 to 1 (forward/backward)
    roll: number;      // -1 to 1 (left/right)
    yaw: number;       // -1 to 1 (rotate left/right)
    throttle: number;  // -1 to 1 (down/up) or -999 for immediate reset
    verticalThrust: number; // -1 to 1 (down/up) for direct vertical control
}

export interface BoundaryStatus {
    distanceToCenter: number;    // Distance to center in km
    distanceToEdge: number;      // Distance to edge in km
    percentToEdge: number;       // Percentage of distance to edge (0-1)
    isCrossingBoundary: boolean; // True if crossing the boundary
    isNearBoundary: boolean;     // True if approaching the boundary
    directionToCenter: THREE.Vector2; // Normalized direction back to center
}

export interface AircraftState {
    // Position and movement
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    speed: number;
    altitude: number;

    // Orientation
    heading: number;  // 0-360 degrees
    pitch: number;    // degrees
    roll: number;     // degrees
    rotation?: THREE.Euler;
    angularVelocity?: THREE.Vector3;

    // Control state
    throttle: number;

    // Aircraft status
    isFlying: boolean;
    isGrounded: boolean;

    // Map position
    mapPosition: { lng: number, lat: number };

    // Boundary information
    boundaryStatus?: BoundaryStatus;
}