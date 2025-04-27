import mapboxgl from 'mapbox-gl';
import {
    AIRCRAFT,
    DEFAULT_BEARING,
    DEFAULT_CENTER,
    DEFAULT_MAP_STYLE,
    DEFAULT_PITCH,
    DEFAULT_ZOOM,
    MAPBOX_ACCESS_TOKEN
} from '../config/config';

export type MapboxEventCallback = (event: mapboxgl.MapboxEvent) => void;

export class MapboxManager {
    private map: mapboxgl.Map | null = null;
    private container: HTMLElement | null = null;
    private onMapLoadCallbacks: MapboxEventCallback[] = [];
    private onMoveCallbacks: MapboxEventCallback[] = [];
    private isTerrainEnabled: boolean = false;
    private isPanLocked: boolean = true;
    private isProgrammaticMovement: boolean = false; // Add flag to track programmatic movements

    constructor() {
        if (!MAPBOX_ACCESS_TOKEN || MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN') {
            console.warn('Mapbox access token is not set. Please set it in config.ts or through environment variables.');
        }
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    }

    /**
     * Initialize the Mapbox map
     */
    public initialize(containerId: string): Promise<mapboxgl.Map> {
        return new Promise((resolve, reject) => {
            try {
                this.container = document.getElementById(containerId);

                if (!this.container) {
                    throw new Error(`Container element with ID '${containerId}' not found`);
                }

                // Create Mapbox map instance
                this.map = new mapboxgl.Map({
                    container: this.container,
                    style: DEFAULT_MAP_STYLE,
                    center: DEFAULT_CENTER,
                    zoom: DEFAULT_ZOOM,
                    pitch: DEFAULT_PITCH,
                    bearing: DEFAULT_BEARING,
                    antialias: true,
                    attributionControl: false,
                    // Enable interactive features for zoom and pitch, only pan remains locked by default
                    scrollZoom: true,
                    dragPan: !this.isPanLocked,
                    touchZoomRotate: true,
                    doubleClickZoom: true,
                    touchPitch: true,
                    keyboard: false,
                });

                // Add navigation controls
                this.map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
                this.map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

                // Set up event listeners
                this.map.on('load', () => {
                    console.log('Mapbox map loaded successfully');
                    // Disable 3D terrain
                    this.disable3DTerrain();

                    // Only lock pan, not zoom and pitch
                    this.lockPan();

                    // Notify listeners that the map is loaded
                    this.onMapLoadCallbacks.forEach(callback => callback({ type: 'load', target: this.map! } as mapboxgl.MapboxEvent));
                    resolve(this.map!);
                });

                this.map.on('error', (error) => {
                    console.error('Error loading Mapbox map:', error);
                    reject(error);
                });

                this.map.on('move', (event) => {
                    this.onMoveCallbacks.forEach(callback => callback(event));
                });
            } catch (error) {
                console.error('Failed to initialize Mapbox map:', error);
                reject(error);
            }
        });
    }

    /**
     * Lock pan to prevent user from moving the map horizontally
     */
    private lockPan(): void {
        if (!this.map) return;

        const originalCenter = this.map.getCenter();

        // Add event listener to prevent map movement
        this.map.on('move', () => {
            if (this.isPanLocked && this.map && !this.isProgrammaticMovement) {
                // Only reset the center if it was changed by a user interaction
                // and not by a programmatic change (like flying to a location)
                if (this.map.isMoving() && this.map.dragPan && !this.map.dragPan.isEnabled()) {
                    this.isProgrammaticMovement = true; // Set flag before programmatically moving
                    this.map.setCenter(originalCenter);
                    // Reset flag after a short delay to prevent issues during the current event cycle
                    setTimeout(() => {
                        this.isProgrammaticMovement = false;
                    }, 0);
                }
            }
        });
    }

    /**
     * Set the zoom lock state
     */
    public setZoomLock(locked: boolean): void {
        if (this.map) {
            this.map.scrollZoom.disable();
            this.map.touchZoomRotate.disable();
            this.map.doubleClickZoom.disable();

            // Re-enable if unlocking
            if (!locked) {
                this.map.scrollZoom.enable();
                this.map.touchZoomRotate.enable();
                this.map.doubleClickZoom.enable();
            }
        }
    }

    /**
     * Set the pitch lock state
     */
    public setPitchLock(locked: boolean): void {
        if (this.map) {
            if (locked) {
                // Disable touch pitch interactions but still allow programmatic changes
                if (this.map.touchPitch) {
                    this.map.touchPitch.disable();
                }
            } else {
                // Re-enable pitch interaction
                if (this.map.touchPitch) {
                    this.map.touchPitch.enable();
                }
            }
        }
    }

    /**
     * Set the pan lock state
     */
    public setPanLock(locked: boolean): void {
        this.isPanLocked = locked;
        if (this.map) {
            if (locked) {
                this.map.dragPan.disable();
            } else {
                this.map.dragPan.enable();
            }
        }
    }

    /**
     * Register a callback for when the map is loaded
     */
    public onMapLoad(callback: MapboxEventCallback): void {
        if (this.map && this.map.loaded()) {
            // Call immediately if map is already loaded
            callback({ type: 'load', target: this.map } as mapboxgl.MapboxEvent);
        } else {
            // Queue for later execution
            this.onMapLoadCallbacks.push(callback);
        }
    }

    /**
     * Register a callback for when the map moves
     */
    public onMapMove(callback: MapboxEventCallback): void {
        this.onMoveCallbacks.push(callback);

        // If map is already available, attach the event listener now
        if (this.map) {
            // Make sure we don't add duplicate event listeners
            // The event listener is already set up in initialize(), but in case onMapMove
            // is called after the map is loaded, we need to make sure the callback gets called
            if (!this.map.listens('move')) {
                this.map.on('move', (event) => {
                    this.onMoveCallbacks.forEach(cb => cb(event));
                });
            }
        }
    }

    /**
     * Get the Mapbox map instance
     */
    public getMap(): mapboxgl.Map | null {
        return this.map;
    }

    /**
     * Get the current camera position
     */
    public getCameraPosition() {
        if (!this.map) return null;

        return {
            center: this.map.getCenter(),
            zoom: this.map.getZoom(),
            pitch: this.map.getPitch(),
            bearing: this.map.getBearing()
        };
    }

    /**
     * Enable 3D terrain
     */
    public enable3DTerrain(): void {
        if (!this.map || this.isTerrainEnabled) return;

        // Check if the map style is loaded
        if (!this.map.isStyleLoaded()) {
            // If not loaded yet, wait for the style.load event
            this.map.once('style.load', () => {
                this.setupTerrain();
            });
        } else {
            // Style is already loaded, set up terrain immediately
            this.setupTerrain();
        }
    }

    /**
     * Set up the terrain and DEM sources
     */
    private setupTerrain(): void {
        if (!this.map) return;

        try {
            // Add the DEM source for terrain if it doesn't exist
            if (!this.map.getSource('mapbox-dem')) {
                this.map.addSource('mapbox-dem', {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    'tileSize': 512,
                    'maxzoom': 14
                });
            }

            // Set terrain with exaggeration
            this.map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

            // Add sky layer for a more realistic look
            if (!this.map.getLayer('sky')) {
                this.map.addLayer({
                    'id': 'sky',
                    'type': 'sky',
                    'paint': {
                        'sky-type': 'atmosphere',
                        'sky-atmosphere-sun': [0.0, 0.0],
                        'sky-atmosphere-sun-intensity': 15
                    }
                });
            }

            this.isTerrainEnabled = true;
            console.log('3D terrain enabled successfully');
        } catch (error) {
            console.error('Error enabling 3D terrain:', error);
        }
    }

    /**
     * Disable 3D terrain
     */
    public disable3DTerrain(): void {
        if (!this.map || !this.isTerrainEnabled) return;

        try {
            // Remove the DEM source for terrain
            if (this.map.getSource('mapbox-dem')) {
                this.map.removeSource('mapbox-dem');
            }

            // Remove sky layer if it exists
            if (this.map.getLayer('sky')) {
                this.map.removeLayer('sky');
            }

            // Reset terrain
            this.map.setTerrain(null);

            this.isTerrainEnabled = false;
            console.log('3D terrain disabled successfully');
        } catch (error) {
            console.error('Error disabling 3D terrain:', error);
        }
    }

    /**
     * Update the map position programmatically
     * This is a new method to safely update map position without triggering recursion
     */
    public updateMapPosition(
        center: [number, number],
        bearing: number,
        pitch: number,
        zoom: number,
        speed: number = 0.4
    ): void {
        if (!this.map) return;

        this.isProgrammaticMovement = true;

        try {
            // Apply limits to pitch and zoom based on config
            const limitedPitch = Math.max(
                AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.LIMITS.MIN_PITCH,
                Math.min(
                    AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.LIMITS.MAX_PITCH,
                    pitch
                )
            );

            const limitedZoom = Math.max(
                AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.LIMITS.MIN_ZOOM,
                Math.min(
                    AIRCRAFT.PHYSICS.VERTICAL_MOVEMENT.LIMITS.MAX_ZOOM,
                    zoom
                )
            );

            // Use individual setters for minor, continuous changes
            // This is more efficient for small changes
            console.log('Updating map position without animation for minor changes');
            this.map.jumpTo({
                center: center,
                bearing: bearing,
                pitch: limitedPitch,
                zoom: limitedZoom
            });
        } finally {
            // Reset the flag after the operations
            setTimeout(() => {
                this.isProgrammaticMovement = false;
            }, 0);
        }
    }
}