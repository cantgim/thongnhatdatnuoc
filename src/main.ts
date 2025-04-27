import * as THREE from 'three';
import { AIRCRAFT, MAP_BOUNDARY } from './config/config';
import { GameManager } from './core/game-manager';
import './style.css';
import { AircraftState } from './types/aircraft';
import { radToDeg } from './utils/math-helpers';

// Create game manager instance with initial heading
const gameManager = new GameManager(AIRCRAFT.INITIAL_HEADING);
let flightDataInterval: number | null = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize game with the app container
    await gameManager.initialize('app');

    // Add event listener for window unload to clean up resources
    window.addEventListener('beforeunload', () => {
      if (flightDataInterval) {
        clearInterval(flightDataInterval);
      }
      gameManager.dispose();
    });

    // Show instruction overlay
    showInstructions();

    // Create technical specifications panel
    createTechSpecsPanel();
  } catch (error) {
    console.error('An error occurred during setup:', error);
    hideLoadingIndicator();
    showErrorMessage('Game initialization failed. Please ensure you have a valid Mapbox token in your environment variables or config.ts file.');
  }
});

/**
 * Display game instructions to the user
 */
const showInstructions = (): void => {
  const instructions = document.createElement('div');
  instructions.className = 'instructions-overlay';
  instructions.innerHTML = `
    <div class="instructions-panel">
      <h2>Flight Controls</h2>
      <ul>
        <li><strong>W/S</strong>: Pitch up/down and move up/down</li>
        <li><strong>A/D</strong>: Roll left/right</li>
        <li><strong>Q/E</strong>: Yaw left/right</li>
        <li><strong>Space</strong>: Increase forward speed</li>
        <li><strong>Shift</strong>: Decrease forward speed</li>
        <li><strong>C</strong>: Change camera view</li>
      </ul>
      <p class="note">Note: If you don't see the map, please check your Mapbox access token.</p>
      ${MAP_BOUNDARY.ENABLED ?
      `<p class="boundary-info">Flight boundary: Limited to ${MAP_BOUNDARY.RADIUS_KM}km radius.</p>` :
      ''}
      <button id="start-btn" class="start-button">Start Flying</button>
    </div>
  `;

  document.getElementById('app')?.appendChild(instructions);

  document.getElementById('start-btn')?.addEventListener('click', () => {
    // Hide the instructions panel
    instructions.style.display = 'none';

    // Start playing the aircraft engine sound immediately
    const threeJsManager = gameManager.getThreeJsManager();
    if (threeJsManager) {
      // Access the audio manager through a new method we'll add to ThreeJsManager
      playEngineSound();
    }
  });
};

/**
 * Play the engine sound immediately
 * This is called when the user clicks the Start Flying button
 */
const playEngineSound = (): void => {
  const threeJsManager = gameManager.getThreeJsManager();
  if (!threeJsManager) return;

  // Access the audioManager through reflection since it's private
  // This is a bit hacky but avoids modifying the ThreeJsManager class further
  const audioManager = (threeJsManager as any).audioManager;
  if (audioManager && typeof audioManager.playSound === 'function') {
    audioManager.playSound();
    console.log('Started engine sound on game start');
  } else {
    console.warn('Could not access audio manager to play sound');
  }
};

/**
 * Display an error message to the user
 */
const showErrorMessage = (message: string): void => {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;

  document.getElementById('app')?.appendChild(errorDiv);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 10000);
};

/**
 * Update loading indicator message
 */
const updateLoadingMessage = (message: string): void => {
  const detailElement = document.querySelector('#loading-indicator .loading-detail');
  if (detailElement) {
    detailElement.textContent = message;
  }
};

/**
 * Hide loading indicator
 */
const hideLoadingIndicator = (): void => {
  const loadingDiv = document.getElementById('loading-indicator');
  if (loadingDiv) {
    loadingDiv.remove();
  }
};

/**
 * Create a technical specifications panel to display flight data
 */
const createTechSpecsPanel = (): void => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Create the container for the panel
  const panel = document.createElement('div');
  panel.id = 'tech-specs-panel';
  panel.className = 'tech-specs-panel';
  panel.setAttribute('aria-label', 'Flight technical specifications');
  panel.setAttribute('role', 'region');

  // Create the panel header
  const header = document.createElement('div');
  header.className = 'tech-specs-header';
  header.textContent = 'Flight Data';
  panel.appendChild(header);

  // Create the content container
  const content = document.createElement('div');
  content.className = 'tech-specs-content';
  content.id = 'tech-specs-content';

  // Add the data fields
  const fields = [
    { id: 'altitude', label: 'Altitude', value: '0', unit: 'm' },
    { id: 'horizontal-speed', label: 'Horizontal Speed', value: '0', unit: 'km/h' },
    { id: 'vertical-speed', label: 'Vertical Speed', value: '0', unit: 'm/s' },
    { id: 'heading', label: 'Heading', value: '0', unit: '°' },
    { id: 'pitch', label: 'Pitch', value: '0', unit: '°' },
    { id: 'roll', label: 'Roll', value: '0', unit: '°' },
    { id: 'throttle', label: 'Throttle', value: '0', unit: '%' },
  ];

  // Add boundary information if boundary is enabled
  if (MAP_BOUNDARY.ENABLED) {
    fields.push(
      { id: 'boundary-distance', label: 'Distance to Center', value: '0', unit: 'km' },
      { id: 'boundary-percent', label: 'Boundary Proximity', value: '0', unit: '%' }
    );
  }

  // Add position fields
  fields.push(
    { id: 'position-x', label: 'Position X', value: '0', unit: 'm' },
    { id: 'position-y', label: 'Position Y', value: '0', unit: 'm' },
    { id: 'position-z', label: 'Position Z', value: '0', unit: 'm' }
  );

  fields.forEach(field => {
    const fieldElement = document.createElement('div');
    fieldElement.className = 'tech-specs-field';

    const labelElement = document.createElement('span');
    labelElement.className = 'tech-specs-label';
    labelElement.textContent = field.label;

    const valueContainer = document.createElement('div');
    valueContainer.className = 'tech-specs-value-container';

    const valueElement = document.createElement('span');
    valueElement.id = `data-${field.id}`;
    valueElement.className = 'tech-specs-value';
    valueElement.textContent = field.value;

    const unitElement = document.createElement('span');
    unitElement.className = 'tech-specs-unit';
    unitElement.textContent = field.unit;

    valueContainer.appendChild(valueElement);
    valueContainer.appendChild(unitElement);

    fieldElement.appendChild(labelElement);
    fieldElement.appendChild(valueContainer);

    content.appendChild(fieldElement);
  });

  panel.appendChild(content);

  // Add toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'tech-specs-toggle';
  toggleButton.className = 'tech-specs-toggle';
  toggleButton.innerHTML = '&times;';
  toggleButton.setAttribute('aria-label', 'Toggle flight data panel');
  toggleButton.setAttribute('aria-expanded', 'true');
  toggleButton.setAttribute('aria-controls', 'tech-specs-content');
  toggleButton.setAttribute('tabindex', '0');

  // Add event listeners
  const handleToggleClick = (): void => {
    handleTogglePanel();
  };

  const handleToggleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTogglePanel();
    }
  };

  toggleButton.addEventListener('click', handleToggleClick);
  toggleButton.addEventListener('keydown', handleToggleKeyDown);

  panel.appendChild(toggleButton);

  // Add the panel to the app
  appContainer.appendChild(panel);

  // Start updating the panel data
  startUpdatingFlightData();
};

/**
 * Toggle the visibility of the technical specifications panel
 */
const handleTogglePanel = (): void => {
  const panel = document.getElementById('tech-specs-panel');
  const content = panel?.querySelector('.tech-specs-content');
  const toggleButton = document.getElementById('tech-specs-toggle');

  if (!content || !toggleButton) return;

  // Cast content to HTMLElement to access the style property
  const contentElement = content as HTMLElement;
  const isVisible = contentElement.style.display !== 'none';
  contentElement.style.display = isVisible ? 'none' : 'block';

  // Update the toggle button
  toggleButton.innerHTML = isVisible ? '&#9776;' : '&times;';
  toggleButton.setAttribute('aria-label', isVisible ? 'Show flight data panel' : 'Hide flight data panel');
  toggleButton.setAttribute('aria-expanded', isVisible ? 'false' : 'true');
};

/**
 * Start updating the flight data in the panel
 */
const startUpdatingFlightData = (): void => {
  if (flightDataInterval) {
    clearInterval(flightDataInterval);
  }

  // Update the data every 100ms
  flightDataInterval = window.setInterval(() => {
    const threeJsManager = gameManager.getThreeJsManager();
    if (!threeJsManager) return;

    const aircraftStateFromManager = threeJsManager.getAircraftState();
    if (!aircraftStateFromManager) return;

    // Map the ThreeJsManager's AircraftState to our expected format
    const mappedState = mapAircraftState(aircraftStateFromManager);

    updateFlightData(mappedState);
  }, 100);
};

/**
 * Maps the AircraftState from ThreeJsManager to the format expected by our panel
 */
const mapAircraftState = (state: any): AircraftState => {
  if (!state.position || !state.velocity || !state.rotation) {
    // Provide default values if required properties are missing
    return {
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      speed: 0,
      altitude: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      throttle: 0,
      isFlying: false,
      isGrounded: true,
      mapPosition: { lng: 0, lat: 0 },
      boundaryStatus: MAP_BOUNDARY.ENABLED ? {
        distanceToCenter: 0,
        distanceToEdge: MAP_BOUNDARY.RADIUS_KM,
        percentToEdge: 0,
        isCrossingBoundary: false,
        isNearBoundary: false,
        directionToCenter: new THREE.Vector2(0, 0)
      } : undefined
    };
  }

  // Calculate horizontal speed
  const horizontalSpeed = Math.sqrt(
    state.velocity.x * state.velocity.x +
    state.velocity.z * state.velocity.z
  );

  // Map properties to match our expected AircraftState interface
  return {
    position: state.position,
    velocity: state.velocity,
    rotation: state.rotation,
    speed: horizontalSpeed * 10, // Convert to km/h as in the display function
    altitude: state.position.y,
    heading: (radToDeg(state.rotation.y) + 360) % 360,
    pitch: radToDeg(state.rotation.x),
    roll: radToDeg(state.rotation.z),
    throttle: state.throttle || 0,
    isFlying: state.position.y > 0.5, // Simple check if aircraft is above ground
    isGrounded: state.position.y <= 0.5,
    mapPosition: state.mapPosition,
    boundaryStatus: state.boundaryStatus
  };
};

/**
 * Update the flight data display with the current aircraft state
 */
const updateFlightData = (state: AircraftState): void => {
  if (!state.position || !state.velocity || !state.rotation) return;

  // Convert velocity to horizontal and vertical components
  const horizontalSpeed = Math.sqrt(
    state.velocity.x * state.velocity.x +
    state.velocity.z * state.velocity.z
  );

  // Convert to km/h (arbitrary scale factor for more realistic numbers)
  const horizontalSpeedKmh = horizontalSpeed * 10;

  // Vertical speed in m/s
  const verticalSpeed = state.velocity.y * 5; // Scale for display

  // Calculate angle in degrees
  const rollDeg = radToDeg(state.rotation.z);
  const pitchDeg = radToDeg(state.rotation.x);
  const headingDeg = (radToDeg(state.rotation.y) + 360) % 360;

  // Calculate throttle percentage
  const throttlePercent = (state.throttle / 10) * 100;

  // Update the display
  updateDataField('altitude', state.position.y.toFixed(1));
  updateDataField('horizontal-speed', horizontalSpeedKmh.toFixed(1));
  updateDataField('vertical-speed', verticalSpeed.toFixed(1));
  updateDataField('heading', headingDeg.toFixed(0));
  updateDataField('pitch', pitchDeg.toFixed(1));
  updateDataField('roll', rollDeg.toFixed(1));
  updateDataField('throttle', throttlePercent.toFixed(0));

  // Update boundary information if enabled
  if (MAP_BOUNDARY.ENABLED && state.boundaryStatus) {
    updateDataField('boundary-distance', state.boundaryStatus.distanceToCenter.toFixed(1));
    updateDataField('boundary-percent', (state.boundaryStatus.percentToEdge * 100).toFixed(0));

    // Apply styling to boundary proximity
    applyBoundaryProximityStyling('boundary-percent', state.boundaryStatus.percentToEdge);
  }

  // Update position coordinates
  updateDataField('position-x', state.position.x.toFixed(1));
  updateDataField('position-y', state.position.y.toFixed(1));
  updateDataField('position-z', state.position.z.toFixed(1));

  // Add visual indicators for positive/negative values
  applyValueStyling('vertical-speed', verticalSpeed);
  applyValueStyling('pitch', pitchDeg);
  applyValueStyling('roll', rollDeg);
};

/**
 * Update a single data field in the panel
 */
const updateDataField = (id: string, value: string): void => {
  const element = document.getElementById(`data-${id}`);
  if (element) {
    element.textContent = value;
  }
};

/**
 * Apply styling to values based on whether they're positive or negative
 */
const applyValueStyling = (id: string, value: number): void => {
  const element = document.getElementById(`data-${id}`);
  if (!element) return;

  // Remove existing classes
  element.classList.remove('tech-specs-positive', 'tech-specs-negative', 'tech-specs-neutral');

  // Add appropriate class
  if (value > 0.5) {
    element.classList.add('tech-specs-positive');
  } else if (value < -0.5) {
    element.classList.add('tech-specs-negative');
  } else {
    element.classList.add('tech-specs-neutral');
  }
};

/**
 * Apply styling to boundary proximity values
 */
const applyBoundaryProximityStyling = (id: string, proximityPercent: number): void => {
  const element = document.getElementById(`data-${id}`);
  if (!element) return;

  // Remove existing classes
  element.classList.remove('tech-specs-positive', 'tech-specs-negative', 'tech-specs-warning');

  // Add appropriate class based on proximity to boundary
  if (proximityPercent >= 1.0) {
    element.classList.add('tech-specs-negative'); // Outside boundary
  } else if (proximityPercent >= MAP_BOUNDARY.WARNING_THRESHOLD) {
    element.classList.add('tech-specs-warning'); // Near boundary
  } else {
    element.classList.add('tech-specs-positive'); // Well within boundary
  }
};
