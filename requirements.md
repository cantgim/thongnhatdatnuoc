# ✈️ thongnhatdatnuoc: 3D Web-Based Flight Simulation Game

## Software Requirements Specification (SRS)

**Version**: 1.0.0  
**Date**: April 24, 2025  

## 1. Project Overview

**thongnhatdatnuoc** is a web-based 3D flight simulation game that enables users to fly virtual aircraft over real-world 3D cityscapes. The primary goal is to create an immersive flight experience by leveraging modern web technologies to render realistic 3D environments, particularly using Mapbox for 3D building data and satellite imagery, and Three.js for 3D rendering.

The game aims to provide:

- Realistic flight dynamics with simplified controls accessible to casual players  
- Accurate real-world city rendering using Mapbox 3D buildings and satellite imagery  
- Smooth performance in modern web browsers without requiring additional downloads  
- An engaging flight experience with day/night cycles, and navigation challenges  

The primary target audience includes casual simulation enthusiasts, aviation fans, and users interested in exploring real-world cities from a unique perspective.

## 2. Core Gameplay Features

### 2.1 Aircraft Control System

- 6-degrees-of-freedom flight model (pitch, roll, yaw, x, y, z) with simplified physics  
- Keyboard and mouse controls  

### 2.2 Flight Operations

- Takeoff procedures from designated airports or airstrips  
- Landing systems with runway approach guidance  

### 2.3 Camera Systems

- Chase camera following the aircraft  
- Camera collision detection with buildings  

### 2.4 Navigation and Environment

- Real-world cities with 3D buildings  
- Landmark recognition and waypoint system  
- Time-of-day simulation affecting visibility and lighting  

---

## 3. Technical Architecture

### 3.1 Integration Strategy

- **Three.js and Mapbox Integration**:  
  - Use Mapbox GL JS to render base maps with satellite imagery and 3D buildings  
  - Position a custom Three.js scene above the Mapbox canvas  
  - Synchronize camera movements between Mapbox and Three.js scenes  
  - Use building height data to inform aircraft altitude relative to surrounding structures  

### 3.2 Asset Management

- Dynamic loading of 3D building tiles based on player position  
- Level-of-detail (LOD) system for buildings and models  
- Memory management for cached map tiles and 3D models  
- Asset bundling for optimal loading performance  

## 4. Functional Requirements

### 4.1 Map Rendering

| ID   | Requirement                                                 | Priority |
|------|-------------------------------------------------------------|----------|
| F1.1 | Render Mapbox GL 3D buildings with satellite imagery         | High     |
| F1.2 | Support seamless global navigation without visible loading  | High     |
| F1.3 | Implement adaptive level of detail based on altitude        | Medium   |
| F1.4 | Support custom GeoJSON overlays for airports and nav aids   | Medium   |

### 4.2 Aircraft Systems

| ID   | Requirement                                                     | Priority |
|------|------------------------------------------------------------------|----------|
| F2.1 | Implement at least 3 different aircraft with unique flight characteristics | High     |
| F2.2 | Render detailed external aircraft models with animated control surfaces | High     |

### 4.3 User Interface

| ID   | Requirement                                         | Priority |
|------|-----------------------------------------------------|----------|
| F3.1 | Display primary flight instruments                  | High     |
| F3.2 | Provide menu system for settings, aircraft selection| High     |

### 4.4 Environment and Effects

| ID   | Requirement                                                  | Priority |
|------|--------------------------------------------------------------|----------|
| F4.1 | Implement day/night cycle with correct sun/moon positioning  | High     |
| F4.2 | Implement atmospheric scattering for realistic sky colors    | Medium   |
| F4.3 | Create ambient sound design (engine, wind, environment)      | Medium   |

### 4.5 Game Mechanics

| ID   | Requirement                          | Priority |
|------|--------------------------------------|----------|
| F5.1 | Support free flight mode with no objectives | High     |


## 5. Non-Functional Requirements

### 5.1 Performance

| ID     | Requirement                                                   | Target       |
|--------|---------------------------------------------------------------|--------------|
| NF1.1  | Maintain 60+ FPS on mid-range desktop hardware                | High         |
| NF1.2  | Initial load time under 10 seconds                            | High         |
| NF1.3  | Memory usage below 2GB                                        | Medium       |
| NF1.4  | Support for lower detail modes                                | Medium       |
| NF1.5  | Efficient handling of texture streaming and LOD transitions   | Medium       |
| NF1.6  | Compatibility with WebGL 2.0 capable browsers                 | High         |

### 5.2 Usability

| ID     | Requirement                                               | Target       |
|--------|-----------------------------------------------------------|--------------|
| NF2.1  | Intuitive controls with on-screen guidance                | High         |
| NF2.2  | Support for keyboard, mouse inputs                        | High         |
| NF2.3  | Responsive design suitable for desktop and tablet         | Medium       |

### 5.3 Scalability

| ID     | Requirement                                               | Target       |
|--------|-----------------------------------------------------------|--------------|
| NF3.1  | Support for dynamic loading of new aircraft models        | Medium       |

### 5.4 Security and Compliance

| ID     | Requirement                                               | Target       |
|--------|-----------------------------------------------------------|--------------|
| NF4.1  | Secure handling of Mapbox API keys                        | High         |
| NF4.2  | Compliance with browser security policies                 | High         |
| NF4.3  | Proper error handling and logging                         | Medium       |
| NF4.4  | Data privacy considerations                               | High         |


## 6. Data Management 

### 6.1 User Data

- Local storage for user preferences and settings  

## 7. Stretch Goals

- More detailed flight models with realistic systems  
- Additional aircraft types (helicopters, gliders, etc.)  

## 10. Implementation Milestones

### Phase 1: Core Technology Proof of Concept

- Mapbox and Three.js integration  
- Basic 3D building rendering  
- Simple aircraft with basic controls  

### Phase 2: Minimum Viable Product

- Refined flight model  
- Complete UI for essential flight instruments  
- Day/night cycle  
- Single aircraft with detailed model  

### Phase 3: Feature Complete

- Multiple aircraft  
- Enhanced graphics and effects  
- Complete sound design  
