// Mapbox API key management - retrieve from environment or set a default for development
// For production, you should use environment variables through import.meta.env
export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'your-default-token';

// Default map settings
export const DEFAULT_MAP_STYLE = 'mapbox://styles/vinhgiang/cm9v54tjc01dx01r3cz1p19fg';
export const DEFAULT_CENTER = { lng: 106.636, lat: 10.811 }; // Ho Chi Minh City, Vietnam
export const DEFAULT_ZOOM = 20;
export const DEFAULT_PITCH = 80;
export const DEFAULT_BEARING = 0;

// Map boundary settings
export const MAP_BOUNDARY = {
    ENABLED: true,
    RADIUS_KM: 10, // 10km boundary radius
    CENTER: DEFAULT_CENTER, // Use default center as boundary center
    FORCE_MULTIPLIER: 3.0, // Increased from 1.5 to 3.0 for stronger boundary enforcement
    WARNING_THRESHOLD: 0.85, // When to start warning user (85% of radius)
    HARD_BOUNDARY: true, // Changed to true to strictly prevent crossing
    SHOW_VISUAL_INDICATOR: true, // Show visual indicator when approaching boundary
    DISTANCE_CHECK_INTERVAL: 100, // Reduced from 500ms to 100ms for more frequent boundary checks
};

// Chase camera settings
export const CHASE_CAMERA = {
    ENABLED: true,
    MODES: {
        CLOSE: { x: 0, y: 20, z: -40 },
        MEDIUM: { x: 0, y: 50, z: -100 },
        FAR: { x: 0, y: 150, z: -300 }
    },
    DEFAULT_MODE: 'MEDIUM',
    SMOOTHING_FACTOR: 0.01, // Lower values = smoother (0.01-0.25 is good)
    COLLISION_AVOIDANCE_ENABLED: false,
    MIN_DISTANCE_FROM_TERRAIN: 10, // Minimum distance to keep from terrain
    PITCH_INFLUENCE: 0.2 // How much aircraft pitch affects camera height (0-1)
};

// THREE.js rendering settings
export const THREE_JS = {
    // Camera settings
    CAMERA: {
        FOV: 75, // Field of view in degrees
        NEAR_CLIP: 0.1, // Near clipping plane
        FAR_CLIP: 10000, // Far clipping plane
        DEFAULT_POSITION: { x: 0, y: 50, z: -100 },
    },

    // Lighting settings
    LIGHTING: {
        AMBIENT_INTENSITY: 0.5,
        AMBIENT_COLOR: 0xffffff,
        DIRECTIONAL_INTENSITY: 1.0,
        DIRECTIONAL_COLOR: 0xffffff,
        DIRECTIONAL_POSITION: { x: 0, y: 1, z: 0 },
    },

    // Fallback aircraft model settings
    FALLBACK_AIRCRAFT: {
        CONE_RADIUS: 5,
        CONE_HEIGHT: 20,
        CONE_SEGMENTS: 4,
        COLOR: 0xff0000,
        ROTATION_X: Math.PI / 2,
    },
};

// Consolidated aircraft configuration including both controls and physics
export const AIRCRAFT = {
    // Aircraft appearance settings
    SCALE: 0.5, // Aircraft scale
    DEFAULT_ALTITUDE: 0, // meters
    // Define initial heading angle (in degrees, 0 = North, 90 = East, 180 = South, 270 = West)
    INITIAL_HEADING: 72, // Change this value to set the initial aircraft heading direction

    // Speed and throttle settings
    MAX_SPEED: 2.0, // Maximum speed the aircraft can reach in units/second
    MAX_THROTTLE: 0.5, // Maximum throttle value (0.0 to 10)
    THROTTLE_CHANGE_RATE: 0.01, // How quickly throttle increases when pressing Space
    MIN_THROTTLE_TO_MOVE: 0.01, // Minimum throttle required for the aircraft to move

    // Decay rates
    DECAY_RATES: {
        HORIZONTAL: 0.5, // How quickly horizontal speed decreases (higher = faster decay)
        VERTICAL: 0.2, // How quickly vertical speed decreases (higher = faster decay)
        THROTTLE: 0.2, // How quickly throttle decreases when not pressing Space (0-1)
    },

    // Flight controls configuration (previously FLIGHT_CONTROLS)
    CONTROLS: {
        // Control input values
        INPUT: {
            PITCH_VALUE: 0.8,
            ROLL_VALUE: 0.8,
            YAW_VALUE: 0.8,
            VERTICAL_THRUST_VALUE: 0.1,
            THROTTLE_VALUE: 0.5,
        },

        // Bank angle settings
        BANK: {
            TARGET_LEFT: -35, // Target bank angle when rolling left (degrees)
            TARGET_RIGHT: 35, // Target bank angle when rolling right (degrees)
            MOMENTUM_FACTOR: 0.3, // Factor applied to bank momentum when applying input
            MOMENTUM_DAMPENING: 0.7, // Factor to dampen bank momentum when no input
            ANGLE_BLEND_FACTOR: 0.15, // How quickly to blend toward target bank angle (0-1)
            ANGLE_RETENTION_FACTOR: 0.85, // How much of the current bank angle to retain (0-1)
            MIN_ANGLE_FOR_TURN: 5, // Minimum bank angle needed to initiate a coordinated turn
            STEEP_TURN_THRESHOLD: 25, // Bank angle threshold for applying pitch compensation
        },

        // Turn physics calculations
        TURN: {
            AIRSPEED_BASE_MULTIPLIER: 0.3, // Base multiplier for airspeed influence on turn rate
            AIRSPEED_FACTOR: 0.3, // How much airspeed affects turn rate
            MAX_TURN_RATE: 1.2, // Maximum allowed turn rate
            TURN_RATE_BASE_FACTOR: 0.2, // Base factor for calculating turn rate
            TURN_RATE_BLEND_FACTOR: 0.3, // Blending factor for smooth turn rate transitions
            TURN_RATE_RETENTION_FACTOR: 0.7, // Retention factor for current turn rate
            BANK_COMPENSATION_DIVISOR: 45, // Divisor for calculating pitch compensation in turns
            BANK_COMPENSATION_FACTOR: 0.2, // Factor for pitch compensation during bank
        },

        // Control smoothing
        SMOOTHING: {
            DECAY_FACTOR: 0.8, // Factor for decaying control inputs when released
        },

        // Without throttle, decay factors for bank-related values
        NO_THROTTLE_DECAY: {
            BANK_ANGLE_DECAY: 0.9, // How quickly bank angle decays without throttle
            TARGET_BANK_DECAY: 0.9, // How quickly target bank angle decays without throttle
            BANK_MOMENTUM_DECAY: 0.8, // How quickly bank momentum decays without throttle
            TURN_YAW_RATE_DECAY: 0.8, // How quickly turn yaw rate decays without throttle
        },

        // Debug settings
        DEBUG: {
            LOG_INTERVAL: 1000, // Interval between logs in milliseconds
            LOG_DURATION: 20, // Duration of log window in milliseconds
        }
    },

    // Aircraft physics settings (previously AIRCRAFT_PHYSICS)
    PHYSICS: {
        // Angular velocity multipliers
        CONTROL_SENSITIVITY: {
            PITCH: 0.07,
            ROLL: 0.07,
            YAW: 0.02,
        },

        // Angular velocity clamps
        MAX_ANGULAR_VELOCITY: 1.5,

        // Rotation clamps (in radians)
        MAX_ROTATION: Math.PI / 2,

        // Auto-stabilization
        STABILIZATION: {
            RATE: 0.03, // When no input, how quickly aircraft returns to level flight
            APPLY_TO_PITCH: true,
            APPLY_TO_ROLL: true,
        },

        // Advanced banking effects
        BANKING: {
            // Threshold for applying banking effects
            ROLL_VELOCITY_THRESHOLD: 0.001,

            // Oscillation settings for realistic banking feel
            OSCILLATION: {
                MAGNITUDE_FACTOR: 0.005,
                FREQUENCY: 500, // ms
            },

            // Roll-pitch coupling (adverse yaw effect)
            PITCH_COUPLING: {
                MAGNITUDE_FACTOR: 0.002,
                YAW_VELOCITY_THRESHOLD: 0.2,
            }
        },

        // Angular velocity damping (simulates aerodynamic stability)
        DAMPING: {
            BASE_DAMPING: 0.95,
            SPEED_DEPENDENT_FACTOR: 0.05,
            SPEED_DIVISOR: 15, // Speed at which additional damping reaches max effect
            PHYSICS_RATE: 60, // Physics calculations per second reference rate
        },

        // Forward movement settings
        FORWARD_MOVEMENT: {
            THRUST_MULTIPLIER: 3.0, // How much throttle affects forward movement
            PITCH_INFLUENCE: 3.0, // How much pitch affects forward/backward movement
        },

        // Roll-based turning physics
        ROLL_TURN: {
            ROLL_FACTOR_EXPONENT: 1.2, // Non-linear relationship between roll angle and turn rate
            ROLL_FACTOR_MULTIPLIER: 2.0, // Base multiplier for roll effect on turning
            SPEED_INFLUENCE_BASE: 1.0, // Base value for speed's influence on turn radius
            SPEED_INFLUENCE_FACTOR: 0.05, // How much speed affects turn tightness
            SPEED_INFLUENCE_MAX: 2.0, // Maximum multiplier for speed influence
        },

        // Vertical lift loss during banks
        BANK_LIFT_LOSS: {
            ANGLE_THRESHOLD: 0.7, // Bank angle threshold for lift loss (radians)
            VERTICAL_THRUST_THRESHOLD: 0.2, // If vertical thrust exceeds this, no lift loss
            MAX_LOSS_FACTOR: 0.5, // Maximum lift loss at 90° bank
        },

        // Vertical thrust settings
        VERTICAL_THRUST: {
            MULTIPLIER: 3.0, // How much vertical thrust input affects vertical velocity
            LOGGING_THRESHOLD: 0.1, // Minimum force to log
        },

        // Map movement settings
        MAP_MOVEMENT: {
            SCALE_FACTOR: 0.00002, // How much aircraft velocity affects map movement
            MIN_SIGNIFICANT_CHANGE: {
                BEARING: 0.5, // Degrees
                POSITION: 0.000001, // Coordinate units
            },
            TRANSITION_SPEED: 0.1, // Animation speed for map movements (0-1)
        },

        // Vertical movement effects on map
        VERTICAL_MOVEMENT: {
            THRESHOLD: 0.3, // Minimum vertical velocity to trigger camera adjustments
            SIGNIFICANT_THRESHOLD: 0.3, // Threshold for "significant" vertical movement
            PITCH_ADJUSTMENT: {
                FACTOR: 0.05,
                MAX: 0.2,
            },
            ZOOM_ADJUSTMENT: {
                FACTOR: 0.05,
                MAX: 0.2,
            },
            SMOOTHING: {
                RETENTION_FACTOR: 0.9, // How much to retain previous adjustment
                NEW_INFLUENCE: 0.1, // How much new adjustment to blend in
                APPLY_FACTOR: 0.2, // How strongly to apply cumulative adjustments
            },
            LIMITS: {
                MIN_PITCH: 0,
                MAX_PITCH: 85,
                MIN_ZOOM: 16,
                MAX_ZOOM: 22,
            },
        },

        // Logging intervals (in milliseconds)
        LOGGING: {
            AIRCRAFT_INTERVAL: 2000,
            MAP_INTERVAL: 3000,
            CAMERA_INTERVAL: 2000,
            TERRAIN_CHECK_INTERVAL: 100,
        },

        // Horizontal velocity threshold for movement detection
        MOVEMENT_DETECTION_THRESHOLD: 0.00001,
    }
};

// For backward compatibility, export individual properties
export const AIRCRAFT_SCALE = AIRCRAFT.SCALE;
export const AIRCRAFT_DEFAULT_ALTITUDE = AIRCRAFT.DEFAULT_ALTITUDE;
export const HORIZONTAL_DECAY_RATE = AIRCRAFT.DECAY_RATES.HORIZONTAL;
export const VERTICAL_DECAY_RATE = AIRCRAFT.DECAY_RATES.VERTICAL;
export const THROTTLE_DECAY_RATE = AIRCRAFT.DECAY_RATES.THROTTLE;
export const MAX_SPEED = AIRCRAFT.MAX_SPEED;
export const MAX_THROTTLE = AIRCRAFT.MAX_THROTTLE;
export const THROTTLE_CHANGE_RATE = AIRCRAFT.THROTTLE_CHANGE_RATE;
export const MIN_THROTTLE_TO_MOVE = AIRCRAFT.MIN_THROTTLE_TO_MOVE;

// For backward compatibility, export the original FLIGHT_CONTROLS and AIRCRAFT_PHYSICS 
// referencing the new structure
export const FLIGHT_CONTROLS = AIRCRAFT.CONTROLS;
export const AIRCRAFT_PHYSICS = AIRCRAFT.PHYSICS;