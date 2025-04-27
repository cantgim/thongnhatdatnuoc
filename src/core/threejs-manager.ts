import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
    AIRCRAFT,
    CHASE_CAMERA,
    MAP_BOUNDARY,
    THREE_JS
} from '../config/config';
import { MapboxManager } from '../map/mapbox-manager';
import { AircraftState } from '../types/aircraft';
import { AircraftPhysics } from './aircraft-physics';

export class ThreeJsManager {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private mapboxManager: MapboxManager;
    private aircraft: THREE.Object3D | null = null;
    private animationFrameId: number | null = null;
    private boundaryIndicator: THREE.Mesh | null = null;
    private audioManager: AudioManager; // Add audio manager

    // Physics engine instance
    private physicsEngine: AircraftPhysics;

    // Camera properties
    private cameraOffset = new THREE.Vector3(
        THREE_JS.CAMERA.DEFAULT_POSITION.x,
        THREE_JS.CAMERA.DEFAULT_POSITION.y,
        THREE_JS.CAMERA.DEFAULT_POSITION.z
    );
    private currentCameraPosition = new THREE.Vector3(
        THREE_JS.CAMERA.DEFAULT_POSITION.x,
        THREE_JS.CAMERA.DEFAULT_POSITION.y,
        THREE_JS.CAMERA.DEFAULT_POSITION.z
    );
    private targetCameraPosition = new THREE.Vector3(
        THREE_JS.CAMERA.DEFAULT_POSITION.x,
        THREE_JS.CAMERA.DEFAULT_POSITION.y,
        THREE_JS.CAMERA.DEFAULT_POSITION.z
    );
    private cameraMode: 'CLOSE' | 'MEDIUM' | 'FAR' = CHASE_CAMERA.DEFAULT_MODE as 'CLOSE' | 'MEDIUM' | 'FAR';
    private lastTerrainCheck: number = 0;
    private movementEnabled = true;

    // Map update tracking
    private _cumulativePitchAdjustment: number = 0;
    private _cumulativeZoomAdjustment: number = 0;
    private _lastCameraLog: number | undefined;

    constructor(mapboxManager: MapboxManager, physicsEngine: AircraftPhysics) {
        this.mapboxManager = mapboxManager;
        this.physicsEngine = physicsEngine;
        this.audioManager = new AudioManager(); // Initialize audio manager

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            THREE_JS.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            THREE_JS.CAMERA.NEAR_CLIP,
            THREE_JS.CAMERA.FAR_CLIP
        );

        // Create renderer with transparency
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Add ambient and directional light
        const ambientLight = new THREE.AmbientLight(
            THREE_JS.LIGHTING.AMBIENT_COLOR,
            THREE_JS.LIGHTING.AMBIENT_INTENSITY
        );
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(
            THREE_JS.LIGHTING.DIRECTIONAL_COLOR,
            THREE_JS.LIGHTING.DIRECTIONAL_INTENSITY
        );
        directionalLight.position.set(
            THREE_JS.LIGHTING.DIRECTIONAL_POSITION.x,
            THREE_JS.LIGHTING.DIRECTIONAL_POSITION.y,
            THREE_JS.LIGHTING.DIRECTIONAL_POSITION.z
        );
        this.scene.add(directionalLight);

        // Setup window resize handler
        window.addEventListener('resize', this.handleResize);

        // Register for physics updates
        this.physicsEngine.onPhysicsUpdate(this.handlePhysicsUpdate);
    }

    /**
     * Handle physics update events from AircraftPhysics
     */
    private handlePhysicsUpdate = (state: AircraftState): void => {
        // Update aircraft model based on the physics state
        this.updateAircraftModel(state);

        // Update audio based on aircraft state
        this.updateAudio(state);

        // Update map position to follow aircraft
        const horizontalVelocity = Math.sqrt(
            state.velocity.x * state.velocity.x +
            state.velocity.z * state.velocity.z
        );

        const isActuallyMoving = horizontalVelocity > AIRCRAFT.PHYSICS.MOVEMENT_DETECTION_THRESHOLD ||
            state.throttle > 0.01;

        this.updateMapPosition(state, isActuallyMoving);

        // Update boundary indicator if enabled
        if (MAP_BOUNDARY.ENABLED && MAP_BOUNDARY.SHOW_VISUAL_INDICATOR) {
            this.updateBoundaryIndicator(state);
        }
    }

    /**
     * Initialize the Three.js scene
     */
    public initialize(container: HTMLElement): void {
        if (!container) {
            console.error('Container element not found');
            return;
        }

        // Position the renderer above the map
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.pointerEvents = 'none'; // Let map handle events
        container.appendChild(this.renderer.domElement);

        // Initialize audio
        this.audioManager.initialize();

        // Load the aircraft model
        this.loadAircraftModel();

        // Initialize camera based on the default mode
        this.setCameraMode(this.cameraMode);

        // Set up map synchronization
        // The map might not be loaded yet, so we'll set up the listener
        // which will start working once the map is ready
        this.mapboxManager.onMapMove(() => {
            this.updateCameraFromMap();
        });

        // Create boundary indicator if enabled
        if (MAP_BOUNDARY.ENABLED && MAP_BOUNDARY.SHOW_VISUAL_INDICATOR) {
            this.createBoundaryIndicator();
        }

        // Add keyboard event listener for camera mode switching
        document.addEventListener('keydown', this.handleCameraControls);

        // Start animation loop immediately
        this.startAnimationLoop();
    }

    /**
     * Create a visual indicator for the boundary
     */
    private createBoundaryIndicator(): void {
        // Create a semi-transparent red ring to indicate the boundary
        const ringGeometry = new THREE.RingGeometry(0.95, 1, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0 // Start invisible
        });

        this.boundaryIndicator = new THREE.Mesh(ringGeometry, ringMaterial);

        // Position at aircraft height but scaled to fill the view
        this.boundaryIndicator.rotation.x = Math.PI / 2; // Make it horizontal
        this.boundaryIndicator.scale.set(500, 500, 1); // Large enough to be visible

        // Add to scene
        this.scene.add(this.boundaryIndicator);
    }

    /**
     * Update the boundary indicator based on aircraft position
     */
    private updateBoundaryIndicator(state: AircraftState): void {
        if (!this.boundaryIndicator || !state.boundaryStatus) return;

        // Position the indicator at aircraft position but at a fixed height offset
        this.boundaryIndicator.position.copy(state.position);
        this.boundaryIndicator.position.y = Math.max(50, state.position.y - 50); // Below aircraft but visible

        // Get the material to update opacity
        const material = this.boundaryIndicator.material as THREE.MeshBasicMaterial;

        if (state.boundaryStatus.isCrossingBoundary) {
            // Fully visible and pulsing when outside boundary
            const pulse = 0.6 + Math.sin(Date.now() / 200) * 0.4;
            material.opacity = pulse;
            material.color.setHex(0xff0000); // Bright red
        } else if (state.boundaryStatus.isNearBoundary) {
            // Partially visible when approaching boundary
            // Opacity increases as you get closer to boundary
            const boundaryProximity = (state.boundaryStatus.percentToEdge - MAP_BOUNDARY.WARNING_THRESHOLD) /
                (1 - MAP_BOUNDARY.WARNING_THRESHOLD);
            material.opacity = boundaryProximity * 0.6;
            material.color.setHex(0xff5500); // Orange-red
        } else {
            // Invisible when well within boundary
            material.opacity = 0;
        }
    }

    /**
     * Load the aircraft 3D model
     */
    private loadAircraftModel(): void {
        // Create a fallback aircraft by default
        this.createFallbackAircraft();

        const loader = new GLTFLoader();

        // Try to load the helicopter model
        loader.load(
            '/assets/airplane.glb',
            (gltf) => {
                // Remove fallback model if it exists
                if (this.aircraft) {
                    this.scene.remove(this.aircraft);
                }

                this.aircraft = gltf.scene;
                this.aircraft.scale.set(AIRCRAFT.SCALE, AIRCRAFT.SCALE, AIRCRAFT.SCALE);
                this.scene.add(this.aircraft);
                console.log('Aircraft model loaded successfully');
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading aircraft model:', error);
                // We've already created a fallback aircraft above, so no need to create it again
            }
        );
    }

    /**
     * Create a simple aircraft using geometry if the model fails to load
     */
    private createFallbackAircraft(): void {
        const geometry = new THREE.ConeGeometry(
            THREE_JS.FALLBACK_AIRCRAFT.CONE_RADIUS,
            THREE_JS.FALLBACK_AIRCRAFT.CONE_HEIGHT,
            THREE_JS.FALLBACK_AIRCRAFT.CONE_SEGMENTS
        );
        const material = new THREE.MeshPhongMaterial({
            color: THREE_JS.FALLBACK_AIRCRAFT.COLOR
        });
        this.aircraft = new THREE.Mesh(geometry, material);
        this.aircraft.rotation.x = THREE_JS.FALLBACK_AIRCRAFT.ROTATION_X;
        this.scene.add(this.aircraft);
        console.log('Created fallback aircraft model');
    }

    /**
     * Update the Three.js camera based on the Mapbox camera
     */
    private updateCameraFromMap(): void {
        const map = this.mapboxManager.getMap();
        if (!map) return;

        const position = this.mapboxManager.getCameraPosition();
        if (!position) return;

        // Convert map coordinates to Three.js coordinates
        // This is a simplified conversion - in a real implementation, 
        // you would need to project the coordinates properly

        // Do NOT position the aircraft at the center of the map - this was causing 
        // the aircraft to disappear when moving because it was overriding the position
        // from physics calculations

        // Position the camera to look at the aircraft using its current position
        // from the physics engine instead of resetting it to (0,0,0)
        const state = this.physicsEngine.getState();
        this.camera.position.set(0, 50, -100);
        this.camera.lookAt(state.position);
    }

    /**
     * Start the animation loop
     */
    private startAnimationLoop(): void {
        const animate = (currentTime: number) => {
            this.animationFrameId = requestAnimationFrame(animate);

            // Update physics (handled by AircraftPhysics)
            this.physicsEngine.update(currentTime);

            // Update camera position to follow aircraft
            this.updateCamera();

            // Render the scene
            this.renderer.render(this.scene, this.camera);
        };

        animate(performance.now());
    }

    /**
     * Update the aircraft model to match the current state
     */
    private updateAircraftModel(state: AircraftState): void {
        if (!this.aircraft) return;

        // Update aircraft position
        this.aircraft.position.copy(state.position);

        // Update aircraft rotation - convert from flight Euler angles to Three.js model orientation
        this.aircraft.rotation.set(
            state.rotation!.x,  // Pitch
            state.rotation!.y,  // Yaw
            state.rotation!.z,  // Roll
            'YXZ'  // Order: yaw, pitch, roll
        );
    }

    /**
     * Update the map position based on aircraft position
     */
    private updateMapPosition(state: AircraftState, isActuallyMoving: boolean): void {
        const map = this.mapboxManager.getMap();
        if (!map) return;

        // Get the current time to throttle updates
        const now = Date.now();

        // Convert aircraft velocity to geographic movement
        // Get the current map center
        const currentCenter = map.getCenter();

        // Calculate movement distance based on aircraft velocity and direction
        // This is a simplified conversion that moves the map in the direction the aircraft is facing
        const forwardDir = new THREE.Vector3(0, 0, -1);
        forwardDir.applyEuler(state.rotation!);

        // Scale to adjust how quickly the map moves with the aircraft
        const speedFactor = state.velocity.length();

        // Increase the movement scale to make movements more noticeable
        // This helps prevent the "laggy" feeling by ensuring movements are more pronounced
        const movementScale = AIRCRAFT.PHYSICS.MAP_MOVEMENT.SCALE_FACTOR * speedFactor;

        // Calculate new position - Invert the movement direction to make aircraft appear to move forward
        const newLng = currentCenter.lng - (forwardDir.x * movementScale);
        const newLat = currentCenter.lat - (forwardDir.z * movementScale);

        // Update the map bearing to match aircraft yaw
        const newBearing = THREE.MathUtils.radToDeg(state.rotation!.y);

        // Get current map values
        const currentPitch = map.getPitch();
        const currentZoom = map.getZoom();

        // Calculate pitch and zoom adjustments based on vertical velocity
        let pitchAdjustment = 0;
        let zoomAdjustment = 0;
        const hasVerticalMovement = Math.abs(state.velocity.y) > AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.THRESHOLD;

        // Only calculate new adjustments when there's vertical movement
        if (hasVerticalMovement) {
            // Calculate direction of adjustment (negative for upward movement, positive for downward)
            const verticalDirection = -Math.sign(state.velocity.y);

            // Scale adjustments based on vertical velocity with increased factors
            pitchAdjustment = verticalDirection * Math.min(
                Math.abs(state.velocity.y) * AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.PITCH_ADJUSTMENT.FACTOR,
                AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.PITCH_ADJUSTMENT.MAX
            );

            zoomAdjustment = verticalDirection * Math.min(
                Math.abs(state.velocity.y) * AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.ZOOM_ADJUSTMENT.FACTOR,
                AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.ZOOM_ADJUSTMENT.MAX
            );

            // Apply the adjustments to our cumulative values with more subtle influence
            this._cumulativePitchAdjustment =
                this._cumulativePitchAdjustment * AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.SMOOTHING.RETENTION_FACTOR +
                pitchAdjustment * AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.SMOOTHING.NEW_INFLUENCE;

            this._cumulativeZoomAdjustment =
                this._cumulativeZoomAdjustment * AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.SMOOTHING.RETENTION_FACTOR +
                zoomAdjustment * AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.SMOOTHING.NEW_INFLUENCE;
        }

        // Calculate new pitch and zoom based on current + cumulative adjustments
        // Use a smaller factor for more gradual changes
        const newPitch = Math.max(
            AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.LIMITS.MIN_PITCH,
            Math.min(
                AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.LIMITS.MAX_PITCH,
                currentPitch + this._cumulativePitchAdjustment * AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.SMOOTHING.APPLY_FACTOR
            )
        );

        const newZoom = Math.max(
            AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.LIMITS.MIN_ZOOM,
            Math.min(
                AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.LIMITS.MAX_ZOOM,
                currentZoom + this._cumulativeZoomAdjustment * AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.SMOOTHING.APPLY_FACTOR
            )
        );

        // Throttle map updates to reduce CPU usage and improve performance
        const hasSignificantVerticalMovement = Math.abs(state.velocity.y) > AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.SIGNIFICANT_THRESHOLD;
        const shouldUpdate = isActuallyMoving || hasSignificantVerticalMovement;

        // Skip small changes to reduce unnecessary updates
        const hasMeaningfulChange =
            Math.abs(newBearing - map.getBearing()) > AIRCRAFT.PHYSICS.MAP_MOVEMENT.MIN_SIGNIFICANT_CHANGE.BEARING ||
            Math.abs(newLat - currentCenter.lat) > AIRCRAFT.PHYSICS.MAP_MOVEMENT.MIN_SIGNIFICANT_CHANGE.POSITION ||
            Math.abs(newLng - currentCenter.lng) > AIRCRAFT.PHYSICS.MAP_MOVEMENT.MIN_SIGNIFICANT_CHANGE.POSITION;

        if (shouldUpdate && hasMeaningfulChange) {
            // Use our safe method in MapboxManager with reduced animation speed
            this.mapboxManager.updateMapPosition(
                [newLng, newLat],  // center as [lng, lat]
                newBearing,        // bearing
                newPitch,          // pitch
                newZoom,           // zoom
                AIRCRAFT.PHYSICS.MAP_MOVEMENT.TRANSITION_SPEED  // animation speed
            );

            // Sync map position back to physics engine
            this.physicsEngine.updateMapPosition({ lng: newLng, lat: newLat });
        } else if (hasMeaningfulChange) {
            // For simple rotations when the aircraft is not moving forward,
            // just update bearing, pitch and zoom with reduced animation speed
            this.mapboxManager.updateMapPosition(
                [currentCenter.lng, currentCenter.lat],  // keep current center
                newBearing,                             // update bearing
                newPitch,                               // update pitch
                newZoom,                                // update zoom
                AIRCRAFT.PHYSICS.MAP_MOVEMENT.TRANSITION_SPEED  // animation speed
            );

            // Still sync current position even without movement
            this.physicsEngine.updateMapPosition({ lng: currentCenter.lng, lat: currentCenter.lat });
        }
    }

    /**
     * Update the camera position to follow the aircraft
     */
    private updateCamera(): void {
        if (!this.aircraft) return;

        // Get the current state from the physics engine
        const state = this.physicsEngine.getState();

        // Calculate the desired camera position based on aircraft position and rotation
        const targetPosition = this.calculateCameraPosition(state);

        // Set target position for smooth interpolation
        this.targetCameraPosition.copy(targetPosition);

        // Apply terrain collision avoidance if enabled
        if (CHASE_CAMERA.COLLISION_AVOIDANCE_ENABLED) {
            this.checkTerrainCollision();
        }

        // Smoothly interpolate between current position and target position
        this.currentCameraPosition.lerp(
            this.targetCameraPosition,
            CHASE_CAMERA.SMOOTHING_FACTOR
        );

        // Log camera position changes less frequently
        const now = Date.now();
        if (!this._lastCameraLog || now - this._lastCameraLog > AIRCRAFT.PHYSICS.LOGGING.CAMERA_INTERVAL) {
            // Calculate change in position since last frame
            this._lastCameraLog = now;
        }

        // Update camera position and orientation
        this.camera.position.copy(this.currentCameraPosition);
        this.camera.lookAt(state.position);
    }

    /**
     * Calculate the camera position based on the aircraft state
     */
    private calculateCameraPosition(state: AircraftState): THREE.Vector3 {
        // Create a vector for the camera offset
        const offset = this.cameraOffset.clone();

        // Adjust camera height based on aircraft pitch
        // When the aircraft pitches down, the camera should rise
        // When the aircraft pitches up, the camera should lower
        if (CHASE_CAMERA.PITCH_INFLUENCE > 0) {
            // Get the pitch in radians
            const pitchRad = state.rotation!.x;

            // Calculate pitch influence (negative pitch = camera moves up)
            const pitchInfluence = -pitchRad * CHASE_CAMERA.PITCH_INFLUENCE * 50;

            // Apply the influence to the offset's y position
            offset.y += pitchInfluence;
        }

        // Create a rotation matrix from the aircraft's rotation
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(new THREE.Euler(
            0,  // Don't apply pitch to camera
            state.rotation!.y,  // Apply yaw
            0,  // Don't apply roll to camera
            'YXZ'
        ));

        // Apply the rotation to the offset vector
        offset.applyMatrix4(rotationMatrix);

        // Add the rotated offset to the aircraft position
        return state.position.clone().add(offset);
    }

    /**
     * Apply control inputs to the aircraft
     * This now just forwards the controls to AircraftPhysics
     */
    public applyControlInputs(controls: {
        pitch: number;     // -1 to 1 (forward/backward)
        roll: number;      // -1 to 1 (left/right)
        yaw: number;       // -1 to 1 (rotate left/right)
        throttle: number;  // -1 to 1 (down/up) or -999 for immediate reset
        verticalThrust: number; // -1 to 1 (down/up) for direct vertical control
    }): void {
        if (!this.movementEnabled) return;
        this.physicsEngine.applyControlInputs(controls);
    }

    /**
     * Get the current aircraft state from the physics engine
     */
    public getAircraftState(): AircraftState {
        return this.physicsEngine.getState();
    }

    /**
     * Handle window resize
     */
    private handleResize = (): void => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }

        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('keydown', this.handleCameraControls);

        // Remove physics update listener
        this.physicsEngine.removeUpdateListener(this.handlePhysicsUpdate);

        // Clean up audio resources
        this.audioManager.dispose();

        this.renderer.dispose();

        // Dispose of geometries, materials, textures
        this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                if (object.geometry) object.geometry.dispose();

                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => disposeMaterial(material));
                    } else {
                        disposeMaterial(object.material);
                    }
                }
            }
        });

        function disposeMaterial(material: THREE.Material) {
            material.dispose();
        }
    }

    /**
     * Handle keyboard controls for camera switching
     */
    private handleCameraControls = (event: KeyboardEvent): void => {
        // Only handle camera mode switching keys (C key)
        if (event.key === 'c' || event.key === 'C') {
            this.cycleCameraMode();
        }
    }

    /**
     * Cycle through available camera modes
     */
    private cycleCameraMode(): void {
        switch (this.cameraMode) {
            case 'CLOSE':
                this.setCameraMode('MEDIUM');
                break;
            case 'MEDIUM':
                this.setCameraMode('FAR');
                break;
            case 'FAR':
                this.setCameraMode('CLOSE');
                break;
        }

        console.log(`Camera mode switched to: ${this.cameraMode}`);
    }

    /**
     * Set the camera mode to a specific setting
     */
    private setCameraMode(mode: 'CLOSE' | 'MEDIUM' | 'FAR'): void {
        this.cameraMode = mode;

        // Update camera offset based on the selected mode
        const offset = CHASE_CAMERA.MODES[mode];
        this.cameraOffset.set(offset.x, offset.y, offset.z);

        // Also update the current target immediately to avoid jarring transitions
        const newPosition = this.calculateCameraPosition(this.physicsEngine.getState());
        this.targetCameraPosition.copy(newPosition);
    }

    /**
     * Check for potential terrain collisions with the camera
     */
    private checkTerrainCollision(): void {
        const now = Date.now();
        // Only check for terrain collisions periodically to save performance
        if (now - this.lastTerrainCheck < AIRCRAFT.PHYSICS.LOGGING.TERRAIN_CHECK_INTERVAL) return;
        this.lastTerrainCheck = now;

        // Get terrain height at the camera position from Mapbox
        // This is a simplified implementation - in a real application,
        // you'd need to implement proper terrain collision detection
        const map = this.mapboxManager.getMap();
        if (!map) return;

        try {
            const state = this.physicsEngine.getState();

            // Raycast from aircraft towards camera position to check for terrain
            const directionToCamera = this.targetCameraPosition.clone()
                .sub(state.position)
                .normalize();

            const distance = state.position.distanceTo(this.targetCameraPosition);

            // Get current terrain elevation at camera position (this is a simplification)
            // In a real implementation, you'd query the actual terrain height from Mapbox
            const terrainHeight = 0; // Placeholder for terrain height

            // Minimum height the camera should be above terrain
            const minHeight = terrainHeight + CHASE_CAMERA.MIN_DISTANCE_FROM_TERRAIN;

            // If camera would be below minimum height, adjust it upward
            if (this.targetCameraPosition.y < minHeight) {
                this.targetCameraPosition.y = minHeight;

                // Ensure the camera still maintains proper distance
                const newDirection = this.targetCameraPosition.clone()
                    .sub(state.position)
                    .normalize();

                this.targetCameraPosition.copy(
                    state.position.clone().add(
                        newDirection.multiplyScalar(distance)
                    )
                );
            }
        } catch (error) {
            console.error('Error checking terrain collision:', error);
        }
    }

    /**
     * Update audio based on aircraft state
     */
    private updateAudio(state: AircraftState): void {
        // Calculate the overall speed (throttle would also work here)
        const speed = state.velocity.length();

        // Update the audio volume and playback based on speed
        this.audioManager.updateSound(speed);
    }
}

/**
 * Audio manager for aircraft sounds
 */
class AudioManager {
    private audioContext: AudioContext | null = null;
    private engineSound: HTMLAudioElement | null = null;
    private audioSource: MediaElementAudioSourceNode | null = null;
    private gainNode: GainNode | null = null;
    private isPlaying: boolean = false;
    private lastSpeed: number = 0;

    /**
     * Initialize the audio manager
     */
    public initialize(): void {
        try {
            // Create audio elements
            this.engineSound = new Audio('/assets/plane.mp3');
            this.engineSound.loop = true;

            // Create audio context and nodes
            this.audioContext = new AudioContext();
            this.audioSource = this.audioContext.createMediaElementSource(this.engineSound);
            this.gainNode = this.audioContext.createGain();

            // Connect nodes
            this.audioSource.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            // Initial gain (volume) - set to 0 initially
            this.gainNode.gain.value = 0;

            console.log('Audio system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize audio system:', error);
        }
    }

    /**
     * Play sound immediately at a default volume
     * Used when user starts the game
     */
    public playSound(): void {
        if (!this.audioContext || !this.engineSound || !this.gainNode) return;

        // Resume audio context if it's suspended (needed due to autoplay policies)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        if (!this.isPlaying) {
            // Start sound with a moderate volume
            const initialVolume = 0.3;

            // Apply volume with smooth transition
            this.gainNode.gain.setTargetAtTime(initialVolume, this.audioContext.currentTime, 0.5);

            // Play the engine sound
            this.engineSound.play().catch(error => {
                console.error('Failed to play engine sound:', error);
            });

            this.isPlaying = true;
            console.log('Engine sound started playing on game start');
        }
    }

    /**
     * Update sound based on aircraft speed
     * @param speed Current speed of the aircraft
     */
    public updateSound(speed: number): void {
        if (!this.audioContext || !this.engineSound || !this.gainNode) return;

        // Resume audio context if it's suspended (needed due to autoplay policies)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Determine if the aircraft is moving
        const isMoving = speed > 0.01;

        // Start sound if not already playing (should not happen if playSound was called at game start)
        if (isMoving && !this.isPlaying) {
            this.engineSound.play().catch(error => {
                console.error('Failed to play engine sound:', error);
            });
            this.isPlaying = true;
        } else if (!isMoving && this.isPlaying) {
            // Don't stop the sound when aircraft is not moving
            // Just reduce the volume instead
            const minIdleVolume = 0.1;
            this.gainNode.gain.setTargetAtTime(minIdleVolume, this.audioContext.currentTime, 0.5);
            return;
        }

        // Don't update if there's no significant change in speed (optimization)
        if (Math.abs(speed - this.lastSpeed) < 0.05 && this.isPlaying) return;
        this.lastSpeed = speed;

        // Calculate volume based on speed
        // Map speed from 0-MAX_SPEED to volume range 0-1
        const MAX_REFERENCE_SPEED = 5; // Adjust based on your game's speed scale
        const minVolume = 0.1;  // Minimum volume when not moving
        const maxVolume = 0.8;  // Maximum volume at full speed

        // Calculate volume with a curve for more natural sound increase
        let volume = minVolume; // Start with minimum volume
        if (isMoving) {
            // Use a non-linear mapping for more realistic engine sound
            const normalizedSpeed = Math.min(speed / MAX_REFERENCE_SPEED, 1);
            volume = minVolume + (maxVolume - minVolume) * Math.pow(normalizedSpeed, 1.5);
        }

        // Apply new volume with smooth transition
        const volumeChangeTime = 0.2; // seconds
        this.gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, volumeChangeTime);
    }

    /**
     * Fade out the sound and then stop it
     */
    private fadeOutAndStop(): void {
        if (!this.audioContext || !this.gainNode || !this.engineSound) return;

        const fadeOutTime = 0.5; // seconds

        // Fade out volume
        this.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, fadeOutTime / 3);

        // Stop sound after fade completes
        setTimeout(() => {
            if (this.engineSound) {
                this.engineSound.pause();
                if (this.engineSound.fastSeek) {
                    this.engineSound.fastSeek(0);
                } else {
                    this.engineSound.currentTime = 0;
                }
                this.isPlaying = false;
            }
        }, fadeOutTime * 1000);
    }

    /**
     * Clean up audio resources
     */
    public dispose(): void {
        if (this.engineSound) {
            this.engineSound.pause();
            this.isPlaying = false;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.audioSource = null;
        this.gainNode = null;
        this.engineSound = null;
    }
}