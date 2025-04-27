type KeyState = {
    [key: string]: boolean;
};

export type InputEventCallback = (keyState: KeyState) => void;

export class InputHandler {
    private keyState: KeyState = {};
    private listeners: InputEventCallback[] = [];
    private isListening: boolean = false;

    constructor() {
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }

    /**
     * Start listening for keyboard input
     */
    public startListening(): void {
        if (this.isListening) return;

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        this.isListening = true;
    }

    /**
     * Stop listening for keyboard input
     */
    public stopListening(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.isListening = false;
    }

    /**
     * Register a callback for input events
     */
    public addListener(callback: InputEventCallback): void {
        this.listeners.push(callback);
    }

    /**
     * Remove a callback for input events
     */
    public removeListener(callback: InputEventCallback): void {
        const index = this.listeners.indexOf(callback);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Check if a key is currently pressed
     */
    public isKeyPressed(key: string): boolean {
        return this.keyState[key] === true;
    }

    /**
     * Handle keydown events
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // Prevent default behavior for arrow keys to avoid page scrolling
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
            event.preventDefault();
        }

        this.keyState[event.key] = true;
        this.notifyListeners();
    }

    /**
     * Handle keyup events
     */
    private handleKeyUp(event: KeyboardEvent): void {
        this.keyState[event.key] = false;
        this.notifyListeners();
    }

    /**
     * Notify all listeners of the current key state
     */
    private notifyListeners(): void {
        for (const listener of this.listeners) {
            listener({ ...this.keyState });
        }
    }
}