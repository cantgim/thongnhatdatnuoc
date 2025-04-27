import { AIRCRAFT, DEFAULT_BEARING } from '../config/config';
import { InputHandler } from '../controls/input-handler';
import { MapboxManager } from '../map/mapbox-manager';
import { AircraftPhysics } from './aircraft-physics';
import { ThreeJsManager } from './threejs-manager';

export class GameManager {
    private mapboxManager: MapboxManager;
    private physicsEngine: AircraftPhysics;
    private threeJsManager: ThreeJsManager | null = null;
    private inputHandler: InputHandler;
    private container: HTMLElement | null = null;
    private isInitialized: boolean = false;

    /**
     * Create a new GameManager instance
     * @param initialHeadingDegrees Optional initial heading angle in degrees (0-360), defaults to map's DEFAULT_BEARING
     */
    constructor(initialHeadingDegrees: number = DEFAULT_BEARING) {
        this.mapboxManager = new MapboxManager();
        // Create the centralized physics engine with initial heading
        this.physicsEngine = new AircraftPhysics(initialHeadingDegrees);
        this.inputHandler = new InputHandler();
    }

    /**
     * Initialize the game
     */
    public async initialize(containerId: string): Promise<void> {
        try {
            if (this.isInitialized) {
                console.warn('Game is already initialized');
                return;
            }

            this.container = document.getElementById(containerId);

            if (!this.container) {
                throw new Error(`Container element with ID '${containerId}' not found`);
            }

            // Start Mapbox initialization (don't await yet to allow parallel initialization)
            this.mapboxManager.initialize(containerId);

            // Initialize Three.js with the shared physics engine
            this.threeJsManager = new ThreeJsManager(this.mapboxManager, this.physicsEngine);
            this.threeJsManager.initialize(this.container);

            // Start listening for keyboard input immediately
            this.inputHandler.startListening();

            // Set up flight controls
            this.setupFlightControls();

            this.isInitialized = true;
            console.log('Game initialized successfully');
        } catch (error) {
            console.error('Failed to initialize game:', error);
            throw error; // Re-throw to allow caller to handle it
        }
    }

    /**
     * Get the Mapbox manager instance
     */
    public getMapboxManager(): MapboxManager {
        return this.mapboxManager;
    }

    /**
     * Get the ThreeJs manager instance
     */
    public getThreeJsManager(): ThreeJsManager | null {
        return this.threeJsManager;
    }

    /**
     * Get the physics engine instance
     */
    public getPhysicsEngine(): AircraftPhysics {
        return this.physicsEngine;
    }

    /**
     * Set up flight controls using the input handler
     * This now only handles raw input and forwards to the physics engine
     */
    private setupFlightControls(): void {
        this.inputHandler.addListener((keyState) => {
            if (!this.threeJsManager) return;

            // Define control values (all default to 0 - no input)
            const controls = {
                pitch: 0,
                roll: 0,
                yaw: 0,
                throttle: 0,
                verticalThrust: 0
            };

            // Process pitch and vertical control (W/S keys)
            if (keyState['w'] || keyState['W'] || keyState['ArrowUp']) {
                controls.pitch = -AIRCRAFT.CONTROLS.INPUT.PITCH_VALUE;
                controls.verticalThrust = AIRCRAFT.CONTROLS.INPUT.VERTICAL_THRUST_VALUE;
            } else if (keyState['s'] || keyState['S'] || keyState['ArrowDown']) {
                controls.pitch = AIRCRAFT.CONTROLS.INPUT.PITCH_VALUE;
                controls.verticalThrust = -AIRCRAFT.CONTROLS.INPUT.VERTICAL_THRUST_VALUE;
            }

            // Process roll control (A/D keys)
            if (keyState['a'] || keyState['A'] || keyState['ArrowLeft']) {
                controls.roll = -AIRCRAFT.CONTROLS.INPUT.ROLL_VALUE;
            } else if (keyState['d'] || keyState['D'] || keyState['ArrowRight']) {
                controls.roll = AIRCRAFT.CONTROLS.INPUT.ROLL_VALUE;
            }

            // Process yaw control (Q/E keys)
            if (keyState['q'] || keyState['Q']) {
                controls.yaw = -AIRCRAFT.CONTROLS.INPUT.YAW_VALUE;
            } else if (keyState['e'] || keyState['E']) {
                controls.yaw = AIRCRAFT.CONTROLS.INPUT.YAW_VALUE;
            }

            // Process throttle control (Space/Shift keys)
            if (keyState[' ']) {
                controls.throttle = AIRCRAFT.CONTROLS.INPUT.THROTTLE_VALUE;
            } else if (keyState['Shift']) {
                controls.throttle = -AIRCRAFT.CONTROLS.INPUT.THROTTLE_VALUE;
            }

            // Apply the controls directly to the physics engine
            // Banking calculations are now handled in the physics engine
            this.physicsEngine.applyControlInputs(controls);
        });
    }

    /**
     * Clean up resources when the game is stopped
     */
    public dispose(): void {
        if (!this.isInitialized) return;

        this.inputHandler.stopListening();

        if (this.threeJsManager) {
            this.threeJsManager.dispose();
            this.threeJsManager = null;
        }

        this.isInitialized = false;
    }
}