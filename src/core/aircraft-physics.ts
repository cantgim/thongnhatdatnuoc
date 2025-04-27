import * as THREE from 'three';
import {
    AIRCRAFT,
    DEFAULT_CENTER,
    HORIZONTAL_DECAY_RATE,
    MAP_BOUNDARY,
    MAX_SPEED,
    MAX_THROTTLE,
    MIN_THROTTLE_TO_MOVE,
    THROTTLE_CHANGE_RATE,
    THROTTLE_DECAY_RATE,
    VERTICAL_DECAY_RATE
} from '../config/config';
import { AircraftControls, AircraftState, BoundaryStatus } from '../types/aircraft';
import { calculateGeoDirection, calculateGeoDistanceKm, eulerToHPR } from '../utils/math-helpers';

// Event types for physics updates
export type PhysicsUpdateCallback = (state: AircraftState) => void;

/**
 * Centralized physics engine for aircraft simulation
 * Handles all physics calculations and state management
 */
export class AircraftPhysics {
    // Current aircraft state
    private state: AircraftState;

    // Banking physics variables
    private bankAngle: number = 0;         // Current bank angle (in degrees)
    private targetBankAngle: number = 0;   // Target bank angle (in degrees)
    private bankMomentum: number = 0;      // Bank momentum for smoother transitions
    private turnYawRate: number = 0;       // Current yaw rate based on bank angle

    // Input control smoothing
    private prevControls: AircraftControls = {
        pitch: 0,
        roll: 0,
        yaw: 0,
        throttle: 0,
        verticalThrust: 0
    };

    // Time tracking
    private lastUpdateTime: number = 0;
    private _lastAircraftLog: number | undefined;
    private _lastBoundaryCheck: number = 0;

    // Boundary status
    private boundaryStatus: BoundaryStatus = {
        distanceToCenter: 0,
        distanceToEdge: 0,
        percentToEdge: 0,
        isCrossingBoundary: false,
        isNearBoundary: false,
        directionToCenter: new THREE.Vector2(0, 0)
    };

    // Event listeners
    private updateListeners: PhysicsUpdateCallback[] = [];

    // User input tracking
    private hasUserInput: boolean = false;

    /**
     * Create a new AircraftPhysics instance
     * @param initialHeadingDegrees Optional initial heading angle in degrees (0-360), default is 0 (north)
     */
    constructor(initialHeadingDegrees: number = 0) {
        // Convert initial heading from degrees to radians
        const initialHeadingRadians = THREE.MathUtils.degToRad(initialHeadingDegrees);

        // Initialize aircraft state
        this.state = {
            position: new THREE.Vector3(0, AIRCRAFT.DEFAULT_ALTITUDE, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 0,
            altitude: AIRCRAFT.DEFAULT_ALTITUDE,
            heading: initialHeadingDegrees,
            pitch: 0,
            roll: 0,
            rotation: new THREE.Euler(0, initialHeadingRadians, 0, 'YXZ'), // YXZ order: yaw, pitch, roll
            angularVelocity: new THREE.Vector3(0, 0, 0),
            throttle: 0,
            isFlying: true,
            isGrounded: false,
            mapPosition: DEFAULT_CENTER,
            boundaryStatus: this.boundaryStatus
        };

        this.lastUpdateTime = performance.now();
    }

    /**
     * Set the aircraft's heading angle
     * @param headingDegrees Heading angle in degrees (0-360)
     */
    public setHeading(headingDegrees: number): void {
        // Normalize the heading to 0-360 range
        const normalizedHeading = ((headingDegrees % 360) + 360) % 360;

        // Convert to radians for the rotation Euler
        const headingRadians = THREE.MathUtils.degToRad(normalizedHeading);

        // Update the state
        this.state.heading = normalizedHeading;
        this.state.rotation!.y = headingRadians;

        // Notify listeners of the updated state
        this.notifyUpdateListeners();
    }

    /**
     * Register a callback for physics updates
     */
    public onPhysicsUpdate(callback: PhysicsUpdateCallback): void {
        this.updateListeners.push(callback);
    }

    /**
     * Remove a callback for physics updates
     */
    public removeUpdateListener(callback: PhysicsUpdateCallback): void {
        const index = this.updateListeners.indexOf(callback);
        if (index !== -1) {
            this.updateListeners.splice(index, 1);
        }
    }

    /**
     * Apply control inputs to the aircraft
     * This combines the control logic from both GameManager and ThreeJsManager
     */
    public applyControlInputs(rawControls: AircraftControls): void {
        // Process control inputs from raw values to physics values
        const controls = this.processControls(rawControls);

        // Flag that we have user input this frame
        this.hasUserInput = true;

        // Apply control inputs to angular velocity for smoother rotation
        this.state.angularVelocity!.x += controls.pitch * AIRCRAFT.PHYSICS.CONTROL_SENSITIVITY.PITCH;
        this.state.angularVelocity!.z += controls.roll * AIRCRAFT.PHYSICS.CONTROL_SENSITIVITY.ROLL;
        this.state.angularVelocity!.y += controls.yaw * AIRCRAFT.PHYSICS.CONTROL_SENSITIVITY.YAW;

        // Clamp angular velocity to prevent too rapid rotation
        this.state.angularVelocity!.x = Math.max(
            -AIRCRAFT.PHYSICS.MAX_ANGULAR_VELOCITY,
            Math.min(AIRCRAFT.PHYSICS.MAX_ANGULAR_VELOCITY, this.state.angularVelocity!.x)
        );
        this.state.angularVelocity!.y = Math.max(
            -AIRCRAFT.PHYSICS.MAX_ANGULAR_VELOCITY,
            Math.min(AIRCRAFT.PHYSICS.MAX_ANGULAR_VELOCITY, this.state.angularVelocity!.y)
        );
        this.state.angularVelocity!.z = Math.max(
            -AIRCRAFT.PHYSICS.MAX_ANGULAR_VELOCITY,
            Math.min(AIRCRAFT.PHYSICS.MAX_ANGULAR_VELOCITY, this.state.angularVelocity!.z)
        );

        // Normal throttle control
        if (controls.throttle !== 0) {
            // Directly add throttle input using the configured change rate and respecting MAX_THROTTLE limit
            const throttleChange = controls.throttle * THROTTLE_CHANGE_RATE;
            this.state.throttle = Math.max(0, Math.min(MAX_THROTTLE,
                this.state.throttle + throttleChange
            ));
        }

        // Clamp rotations to prevent extreme angles
        this.state.rotation!.x = Math.max(
            -AIRCRAFT.PHYSICS.MAX_ROTATION,
            Math.min(AIRCRAFT.PHYSICS.MAX_ROTATION, this.state.rotation!.x)
        );
        this.state.rotation!.z = Math.max(
            -AIRCRAFT.PHYSICS.MAX_ROTATION,
            Math.min(AIRCRAFT.PHYSICS.MAX_ROTATION, this.state.rotation!.z)
        );
    }

    /**
     * Process raw controls into physics values with banking and coordinated turn physics
     * This extracts the banking physics from GameManager
     */
    private processControls(rawControls: AircraftControls): AircraftControls {
        // Flag for coordinated turns
        let coordinatedTurn = false;

        // Process roll control with banking physics
        if (rawControls.roll < 0) {
            // Left roll - update banking physics
            this.targetBankAngle = AIRCRAFT.CONTROLS.BANK.TARGET_LEFT;
            this.bankMomentum -= AIRCRAFT.CONTROLS.BANK.MOMENTUM_FACTOR;
        } else if (rawControls.roll > 0) {
            // Right roll - update banking physics
            this.targetBankAngle = AIRCRAFT.CONTROLS.BANK.TARGET_RIGHT;
            this.bankMomentum += AIRCRAFT.CONTROLS.BANK.MOMENTUM_FACTOR;
        } else {
            // No roll input - gradually return to level flight
            this.targetBankAngle = 0;
            this.bankMomentum *= AIRCRAFT.CONTROLS.BANK.MOMENTUM_DAMPENING;
        }

        // Handle throttle and determine if coordinated turns should be applied
        if (rawControls.throttle > 0 || rawControls.throttle < 0) {
            coordinatedTurn = true;
        }

        // Create a new object for the processed controls
        const processedControls: AircraftControls = {
            pitch: rawControls.pitch,
            roll: rawControls.roll,
            yaw: rawControls.yaw,
            throttle: rawControls.throttle,
            verticalThrust: rawControls.verticalThrust
        };

        // Apply coordinated turn physics if active
        if (coordinatedTurn && this.state.throttle > MIN_THROTTLE_TO_MOVE) {
            // Update current bank angle using momentum-based physics
            this.bankAngle = this.bankAngle * AIRCRAFT.CONTROLS.BANK.ANGLE_RETENTION_FACTOR +
                this.targetBankAngle * AIRCRAFT.CONTROLS.BANK.ANGLE_BLEND_FACTOR;

            // Airspeed dependent turning - faster airspeed leads to more responsive turns
            const airspeedMultiplier = AIRCRAFT.CONTROLS.TURN.AIRSPEED_BASE_MULTIPLIER +
                (Math.abs(this.state.throttle) * AIRCRAFT.CONTROLS.TURN.AIRSPEED_FACTOR);

            if (Math.abs(this.bankAngle) > AIRCRAFT.CONTROLS.BANK.MIN_ANGLE_FOR_TURN) {
                // Calculate turn rate based on proper banking physics
                const bankRadians = Math.abs(this.bankAngle) * (Math.PI / 180);

                // Non-linear turn rate based on bank angle (proportional to tan of bank angle)
                const turnRate = Math.min(
                    AIRCRAFT.CONTROLS.TURN.MAX_TURN_RATE, // Cap maximum turn rate
                    AIRCRAFT.CONTROLS.TURN.TURN_RATE_BASE_FACTOR * Math.tan(bankRadians) * airspeedMultiplier
                );

                // Smoothly transition turn rate (avoid abrupt yaw changes)
                this.turnYawRate = this.turnYawRate * AIRCRAFT.CONTROLS.TURN.TURN_RATE_RETENTION_FACTOR +
                    turnRate * AIRCRAFT.CONTROLS.TURN.TURN_RATE_BLEND_FACTOR;

                // Set the yaw rate with proper direction if user isn't providing manual yaw input
                if (processedControls.yaw === 0) {
                    processedControls.yaw = Math.sign(this.bankAngle) * this.turnYawRate;
                }

                // Apply subtle nose-up pitch during steep turns (compensates for lift loss)
                if (Math.abs(this.bankAngle) > AIRCRAFT.CONTROLS.BANK.STEEP_TURN_THRESHOLD && processedControls.pitch === 0) {
                    // Add small upward pitch proportional to bank angle
                    const bankCompensation = Math.abs(this.bankAngle) / AIRCRAFT.CONTROLS.TURN.BANK_COMPENSATION_DIVISOR *
                        AIRCRAFT.CONTROLS.TURN.BANK_COMPENSATION_FACTOR;
                    processedControls.pitch -= bankCompensation;
                }
            }
        } else {
            // Without throttle, gradually reset bank-related values
            this.bankAngle *= AIRCRAFT.CONTROLS.NO_THROTTLE_DECAY.BANK_ANGLE_DECAY;
            this.targetBankAngle *= AIRCRAFT.CONTROLS.NO_THROTTLE_DECAY.TARGET_BANK_DECAY;
            this.bankMomentum *= AIRCRAFT.CONTROLS.NO_THROTTLE_DECAY.BANK_MOMENTUM_DECAY;
            this.turnYawRate *= AIRCRAFT.CONTROLS.NO_THROTTLE_DECAY.TURN_YAW_RATE_DECAY;
        }

        // Apply control smoothing - keep old values for logging
        this.prevControls = {
            pitch: processedControls.pitch !== 0 ? processedControls.pitch : this.prevControls.pitch * AIRCRAFT.CONTROLS.SMOOTHING.DECAY_FACTOR,
            roll: processedControls.roll !== 0 ? processedControls.roll : this.prevControls.roll * AIRCRAFT.CONTROLS.SMOOTHING.DECAY_FACTOR,
            yaw: processedControls.yaw !== 0 ? processedControls.yaw : this.prevControls.yaw * AIRCRAFT.CONTROLS.SMOOTHING.DECAY_FACTOR,
            throttle: processedControls.throttle, // Direct throttle control without smoothing
            verticalThrust: processedControls.verticalThrust !== 0 ? processedControls.verticalThrust : this.prevControls.verticalThrust * AIRCRAFT.CONTROLS.SMOOTHING.DECAY_FACTOR,
        };

        return this.prevControls;
    }

    /**
     * Update the physics state for a new frame
     */
    public update(currentTime: number): void {
        // Calculate time delta in seconds
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = currentTime;

        // Skip if delta time is too large (e.g., after tab was inactive)
        if (deltaTime > 0.1) return;

        // Get the current time stamp for logging
        const now = Date.now();

        // Check if we need to update the boundary status
        if (MAP_BOUNDARY.ENABLED && now - this._lastBoundaryCheck > MAP_BOUNDARY.DISTANCE_CHECK_INTERVAL) {
            this.updateBoundaryStatus();
            this._lastBoundaryCheck = now;
        }

        // Update aircraft physics
        this.updateAircraftPhysics(deltaTime, now);

        // Apply boundary forces if needed
        if (MAP_BOUNDARY.ENABLED && (this.boundaryStatus.isNearBoundary || this.boundaryStatus.isCrossingBoundary)) {
            this.applyBoundaryForces(deltaTime);
        }

        // Notify listeners of the updated state
        this.notifyUpdateListeners();

        // Reset user input flag after applying physics
        this.hasUserInput = false;
    }

    /**
     * Update the boundary status based on current aircraft position
     */
    private updateBoundaryStatus(): void {
        if (!MAP_BOUNDARY.ENABLED || !this.state.mapPosition) return;

        // Calculate distance from center in kilometers
        const distanceToCenter = calculateGeoDistanceKm(
            this.state.mapPosition.lng,
            this.state.mapPosition.lat,
            MAP_BOUNDARY.CENTER.lng,
            MAP_BOUNDARY.CENTER.lat
        );

        // Calculate distance to edge (negative means outside boundary)
        const distanceToEdge = MAP_BOUNDARY.RADIUS_KM - distanceToCenter;

        // Calculate percentage of distance to edge (0 = at center, 1 = at edge)
        const percentToEdge = distanceToCenter / MAP_BOUNDARY.RADIUS_KM;

        // Calculate direction back to center (for force application)
        const directionVector = calculateGeoDirection(
            this.state.mapPosition.lng,
            this.state.mapPosition.lat,
            MAP_BOUNDARY.CENTER.lng,
            MAP_BOUNDARY.CENTER.lat
        );

        // Create 2D direction vector to center
        const directionToCenter = new THREE.Vector2(-directionVector.x, -directionVector.y);

        // Update boundary status
        this.boundaryStatus = {
            distanceToCenter,
            distanceToEdge,
            percentToEdge,
            isCrossingBoundary: distanceToEdge <= 0,
            isNearBoundary: percentToEdge >= MAP_BOUNDARY.WARNING_THRESHOLD && percentToEdge < 1,
            directionToCenter
        };

        // Update state with the boundary status
        this.state.boundaryStatus = this.boundaryStatus;
    }

    /**
     * Apply forces to push aircraft back within the boundary
     */
    private applyBoundaryForces(deltaTime: number): void {
        if (!MAP_BOUNDARY.ENABLED) return;

        // Check if we're at or beyond the boundary
        if (this.boundaryStatus.isCrossingBoundary) {
            // Hard boundary makes an impenetrable wall
            if (MAP_BOUNDARY.HARD_BOUNDARY) {
                // Get the current map position
                const { lng, lat } = this.state.mapPosition;

                // Calculate the direction vector from center to aircraft
                const dirToAircraft = new THREE.Vector2(
                    lng - MAP_BOUNDARY.CENTER.lng,
                    lat - MAP_BOUNDARY.CENTER.lat
                );

                // Calculate the current distance from center
                const currentDistance = dirToAircraft.length();

                // Only proceed if we have a valid direction vector
                if (currentDistance > 0) {
                    // Calculate new position exactly at the boundary
                    const normalized = dirToAircraft.clone().normalize();

                    // Scale to boundary radius (with a small margin to keep inside)
                    const boundaryRadius = MAP_BOUNDARY.RADIUS_KM * 0.00009; // Convert to coordinate units
                    const safeRadius = boundaryRadius * 0.99; // Small margin to keep inside
                    normalized.multiplyScalar(safeRadius);

                    // Set new position at the boundary
                    const newLng = MAP_BOUNDARY.CENTER.lng + normalized.x;
                    const newLat = MAP_BOUNDARY.CENTER.lat + normalized.y;

                    // Update map position while keeping altitude
                    this.state.mapPosition = {
                        lng: newLng,
                        lat: newLat
                    };

                    // Get velocity direction relative to boundary
                    const velocityDirection = new THREE.Vector2(
                        this.state.velocity.x,
                        this.state.velocity.z
                    ).normalize();

                    // Get boundary normal (points from center outward)
                    const boundaryNormal = normalized;

                    // Project velocity onto boundary normal
                    const dotProduct = velocityDirection.dot(boundaryNormal);

                    // If moving outward (dot product > 0), reflect the velocity component
                    if (dotProduct > 0) {
                        // Calculate the component of velocity going toward boundary
                        const outwardComponent = dotProduct * velocityDirection.length();

                        // Apply reflection force opposite to the outward direction
                        // Plus some additional damping to simulate energy loss in collision
                        const reflectionFactor = 1.2; // Slightly more than 1 to ensure no penetration
                        const dampingFactor = 0.8; // Energy loss in the collision

                        this.state.velocity.x -= boundaryNormal.x * outwardComponent * reflectionFactor * dampingFactor;
                        this.state.velocity.z -= boundaryNormal.y * outwardComponent * reflectionFactor * dampingFactor;
                    }
                }
            } else {
                // If not using hard boundary, apply very strong inward force
                const forceMagnitude = Math.abs(this.boundaryStatus.distanceToEdge) * MAP_BOUNDARY.FORCE_MULTIPLIER * 5;
                this.applyBoundaryForce(forceMagnitude, deltaTime);
            }
        } else if (this.boundaryStatus.isNearBoundary) {
            // Apply proportionally smaller force as warning when approaching boundary
            const boundaryProximity = (this.boundaryStatus.percentToEdge - MAP_BOUNDARY.WARNING_THRESHOLD) /
                (1 - MAP_BOUNDARY.WARNING_THRESHOLD);
            const forceMagnitude = boundaryProximity * MAP_BOUNDARY.FORCE_MULTIPLIER * 2;
            this.applyBoundaryForce(forceMagnitude, deltaTime);
        }
    }

    /**
     * Apply a boundary force in the direction toward the center
     */
    private applyBoundaryForce(forceMagnitude: number, deltaTime: number): void {
        if (forceMagnitude <= 0) return;

        // Create a Three.js direction vector toward center
        const forceDirection = new THREE.Vector3(
            this.boundaryStatus.directionToCenter.x,
            0, // Keep vertical movement unaffected
            this.boundaryStatus.directionToCenter.y
        ).normalize();

        // Apply force to velocity
        this.state.velocity.x += forceDirection.x * forceMagnitude * deltaTime * 5;
        this.state.velocity.z += forceDirection.z * forceMagnitude * deltaTime * 5;
    }

    /**
     * Update the aircraft physics based on current state
     */
    private updateAircraftPhysics(deltaTime: number, now: number): void {
        // Apply rotation from angular velocity
        this.state.rotation!.x += this.state.angularVelocity!.x * deltaTime;
        this.state.rotation!.y += this.state.angularVelocity!.y * deltaTime;
        this.state.rotation!.z += this.state.angularVelocity!.z * deltaTime;

        // Advanced realistic banking effects - add slight roll overshoot and settling
        if (Math.abs(this.state.angularVelocity!.z) > AIRCRAFT.PHYSICS.BANKING.ROLL_VELOCITY_THRESHOLD) {
            // When actively rolling, add a subtle secondary oscillation 
            const rollDirection = Math.sign(this.state.angularVelocity!.z);
            const rollMagnitude = Math.abs(this.state.angularVelocity!.z);

            // Apply subtle damped oscillation effect when roll rate changes
            const oscillationAmount = rollMagnitude *
                AIRCRAFT.PHYSICS.BANKING.OSCILLATION.MAGNITUDE_FACTOR *
                Math.sin(now / AIRCRAFT.PHYSICS.BANKING.OSCILLATION.FREQUENCY);
            this.state.rotation!.z += oscillationAmount;

            // Add small pitch coupling with roll (adverse yaw effect)
            if (Math.abs(this.state.angularVelocity!.y) < AIRCRAFT.PHYSICS.BANKING.PITCH_COUPLING.YAW_VELOCITY_THRESHOLD) {
                // Rolling causes a slight nose-up tendency
                const pitchCoupling = Math.abs(rollMagnitude) *
                    AIRCRAFT.PHYSICS.BANKING.PITCH_COUPLING.MAGNITUDE_FACTOR *
                    -rollDirection;
                this.state.rotation!.x += pitchCoupling;
            }
        }

        // Apply variable damping to angular velocity (simulates stability)
        const speedFactor = Math.min(1, this.state.speed / AIRCRAFT.PHYSICS.DAMPING.SPEED_DIVISOR);
        const speedDependentDamping = AIRCRAFT.PHYSICS.DAMPING.BASE_DAMPING +
            (AIRCRAFT.PHYSICS.DAMPING.SPEED_DEPENDENT_FACTOR * speedFactor);

        // Apply damping with speed-dependent effects
        this.state.angularVelocity!.x *= Math.pow(
            speedDependentDamping,
            deltaTime * AIRCRAFT.PHYSICS.DAMPING.PHYSICS_RATE
        );
        this.state.angularVelocity!.y *= Math.pow(
            speedDependentDamping,
            deltaTime * AIRCRAFT.PHYSICS.DAMPING.PHYSICS_RATE
        );
        this.state.angularVelocity!.z *= Math.pow(
            speedDependentDamping,
            deltaTime * AIRCRAFT.PHYSICS.DAMPING.PHYSICS_RATE
        );

        // Convert heading to direction vector
        const forwardVector = new THREE.Vector3(0, 0, -1);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(new THREE.Euler(
            0, // Don't use pitch for forward direction
            this.state.rotation!.y,
            0, // Don't use roll for forward direction
            'YXZ'
        ));
        forwardVector.applyMatrix4(rotationMatrix);

        // Get right vector for lateral movement
        const rightVector = new THREE.Vector3(1, 0, 0);
        rightVector.applyMatrix4(rotationMatrix);

        // Calculate forces based on orientation and throttle
        if (this.state.throttle > MIN_THROTTLE_TO_MOVE) {
            // Direct forward thrust based on throttle
            const forwardThrust = this.state.throttle * AIRCRAFT.PHYSICS.FORWARD_MOVEMENT.THRUST_MULTIPLIER;
            this.state.velocity.x += forwardVector.x * forwardThrust * deltaTime;
            this.state.velocity.z += forwardVector.z * forwardThrust * deltaTime;

            // Additional movement based on pitch and roll for realistic flight control
            const pitchFactor = this.state.rotation!.x * AIRCRAFT.PHYSICS.FORWARD_MOVEMENT.PITCH_INFLUENCE;

            // Enhanced roll effect - apply a slightly non-linear relationship 
            // between roll angle and lateral acceleration to simulate realistic turning
            const rollRadians = this.state.rotation!.z;
            const rollFactor = -Math.sign(rollRadians) *
                Math.pow(
                    Math.abs(rollRadians) * AIRCRAFT.PHYSICS.ROLL_TURN.ROLL_FACTOR_MULTIPLIER,
                    AIRCRAFT.PHYSICS.ROLL_TURN.ROLL_FACTOR_EXPONENT
                );

            // Apply additional forward/backward acceleration based on pitch
            this.state.velocity.x += forwardVector.x * pitchFactor * deltaTime;
            this.state.velocity.z += forwardVector.z * pitchFactor * deltaTime;

            // Apply enhanced sideways acceleration based on roll (with slight speed dependency)
            const speedInfluence = AIRCRAFT.PHYSICS.ROLL_TURN.SPEED_INFLUENCE_BASE +
                (this.state.speed / 20 * AIRCRAFT.PHYSICS.ROLL_TURN.SPEED_INFLUENCE_FACTOR);
            const adjustedSpeedInfluence = Math.min(speedInfluence, AIRCRAFT.PHYSICS.ROLL_TURN.SPEED_INFLUENCE_MAX);

            this.state.velocity.x += rightVector.x * rollFactor * deltaTime * adjustedSpeedInfluence;
            this.state.velocity.z += rightVector.z * rollFactor * deltaTime * adjustedSpeedInfluence;

            // Simulate loss of vertical lift during steep banks
            if (Math.abs(rollRadians) > AIRCRAFT.PHYSICS.BANK_LIFT_LOSS.ANGLE_THRESHOLD &&
                this.prevControls.verticalThrust < AIRCRAFT.PHYSICS.BANK_LIFT_LOSS.VERTICAL_THRUST_THRESHOLD) {
                // Calculate vertical force loss based on bank angle
                const liftLoss = (1 - Math.cos(Math.abs(rollRadians))) * AIRCRAFT.PHYSICS.BANK_LIFT_LOSS.MAX_LOSS_FACTOR;
                this.state.velocity.y -= liftLoss * deltaTime;
            }
        }

        // Apply vertical movement based on verticalThrust
        if (this.prevControls.verticalThrust !== 0) {
            // Scale the thrust to get appropriate acceleration
            const verticalForce = this.prevControls.verticalThrust * AIRCRAFT.PHYSICS.VERTICAL_THRUST.MULTIPLIER;
            this.state.velocity.y += verticalForce * deltaTime;
        }

        // Apply the drag forces to each component of velocity
        this.state.velocity.x *= (1 - HORIZONTAL_DECAY_RATE * deltaTime);
        this.state.velocity.z *= (1 - HORIZONTAL_DECAY_RATE * deltaTime);
        this.state.velocity.y *= (1 - VERTICAL_DECAY_RATE * deltaTime);

        // Apply throttle decay when there's no user input and throttle is active
        if (!this.hasUserInput && this.state.throttle > 0) {
            this.state.throttle = Math.max(0,
                this.state.throttle - (THROTTLE_DECAY_RATE * deltaTime)
            );
        }

        // Apply speed limit
        const currentSpeed = this.state.velocity.length();
        if (currentSpeed > MAX_SPEED) {
            // Scale velocity down to max speed
            this.state.velocity.normalize().multiplyScalar(MAX_SPEED);
        }

        // Apply auto-stabilization if there's no user input
        if (!this.hasUserInput) {
            // Gently return pitch and roll to zero
            if (AIRCRAFT.PHYSICS.STABILIZATION.APPLY_TO_PITCH) {
                this.state.rotation!.x *= Math.pow(
                    1 - AIRCRAFT.PHYSICS.STABILIZATION.RATE,
                    deltaTime * AIRCRAFT.PHYSICS.DAMPING.PHYSICS_RATE
                );
            }

            if (AIRCRAFT.PHYSICS.STABILIZATION.APPLY_TO_ROLL) {
                this.state.rotation!.z *= Math.pow(
                    1 - AIRCRAFT.PHYSICS.STABILIZATION.RATE,
                    deltaTime * AIRCRAFT.PHYSICS.DAMPING.PHYSICS_RATE
                );
            }
        }

        // Update position based on velocity
        this.state.position.x += this.state.velocity.x * deltaTime;
        this.state.position.y += this.state.velocity.y * deltaTime;
        this.state.position.z += this.state.velocity.z * deltaTime;

        // Enforce ground collision - prevent aircraft from going below ground
        if (this.state.position.y < 0) {
            // Set position to exactly ground level
            this.state.position.y = 0;

            // Check velocity to apply bounce effect if hitting ground with force
            if (this.state.velocity.y < -0.5) {
                // Create a minimal bounce effect (10% of impact velocity)
                this.state.velocity.y = Math.abs(this.state.velocity.y) * 0.1;

                // Apply some drag to horizontal movement when hitting ground
                this.state.velocity.x *= 0.8;
                this.state.velocity.z *= 0.8;
            } else {
                // Just stop vertical movement entirely for gentle contact
                this.state.velocity.y = 0;
            }
        }

        // Update state properties from Three.js properties
        const { heading, pitch, roll } = eulerToHPR(this.state.rotation!);
        this.state.heading = heading;
        this.state.pitch = pitch;
        this.state.roll = roll;
        this.state.speed = this.state.velocity.length();
        this.state.altitude = this.state.position.y;
        this.state.isGrounded = this.state.position.y <= 0.5;
        this.state.isFlying = !this.state.isGrounded;

        // Log aircraft movement periodically
        if (!this._lastAircraftLog || now - this._lastAircraftLog > AIRCRAFT.PHYSICS.LOGGING.AIRCRAFT_INTERVAL) {
            const horizontalVelocity = Math.sqrt(
                this.state.velocity.x * this.state.velocity.x +
                this.state.velocity.z * this.state.velocity.z
            );

            console.log('AIRCRAFT STATE:', {
                moving: horizontalVelocity > AIRCRAFT.PHYSICS.MOVEMENT_DETECTION_THRESHOLD ? 'YES' : 'NO',
                velocity: {
                    x: this.state.velocity.x.toFixed(8),
                    y: this.state.velocity.y.toFixed(8),
                    z: this.state.velocity.z.toFixed(8),
                },
                rotation: {
                    x: this.state.pitch.toFixed(2), // pitch in degrees
                    y: this.state.heading.toFixed(2), // yaw in degrees
                    z: this.state.roll.toFixed(2)  // roll in degrees
                },
                horizontalSpeed: horizontalVelocity.toFixed(8),
                totalSpeed: this.state.speed.toFixed(8),
                throttle: this.state.throttle.toFixed(4),
                position: {
                    x: this.state.position.x.toFixed(4),
                    y: this.state.position.y.toFixed(4),
                    z: this.state.position.z.toFixed(4)
                },
                boundary: MAP_BOUNDARY.ENABLED ? {
                    distanceToCenter: this.boundaryStatus.distanceToCenter.toFixed(2) + 'km',
                    percentToEdge: (this.boundaryStatus.percentToEdge * 100).toFixed(1) + '%',
                    status: this.boundaryStatus.isCrossingBoundary ? 'OUTSIDE' :
                        this.boundaryStatus.isNearBoundary ? 'NEAR EDGE' : 'INSIDE'
                } : 'DISABLED'
            });
            this._lastAircraftLog = now;
        }
    }

    /**
     * Get the current aircraft state
     */
    public getState(): AircraftState {
        return { ...this.state };
    }

    /**
     * Get banking physics values for debugging
     */
    public getBankingState(): { bankAngle: number, targetBank: number, momentum: number, turnRate: number } {
        return {
            bankAngle: this.bankAngle,
            targetBank: this.targetBankAngle,
            momentum: this.bankMomentum,
            turnRate: this.turnYawRate
        };
    }

    /**
     * Notify all listeners of state updates
     */
    private notifyUpdateListeners(): void {
        const state = this.getState();
        for (const listener of this.updateListeners) {
            listener(state);
        }
    }

    /**
     * Update the map position for the aircraft
     * This is called by ThreeJsManager to keep the state in sync
     */
    public updateMapPosition(mapPosition: { lng: number, lat: number }): void {
        this.state.mapPosition = mapPosition;

        // Update boundary status immediately when map position changes
        if (MAP_BOUNDARY.ENABLED) {
            this.updateBoundaryStatus();
        }
    }
}