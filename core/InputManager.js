class InputManager {
    constructor(target) {
        this.target = target;
        this.keys = new Map();
        this.mouseButtons = new Map();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseWorldPosition = { x: 0, y: 0 };
        this.touches = new Map();
        this.gestures = new Map();
        this.gamepads = new Map();
        
        // Estado dos inputs
        this.pressedKeys = new Set();
        this.releasedKeys = new Set();
        this.heldKeys = new Set();
        
        // Mapeamento de teclas
        this.keyMap = new Map();
        
        // Callbacks
        this.keyCallbacks = new Map();
        this.mouseCallbacks = new Map();
        this.touchCallbacks = new Map();
        this.gestureCallbacks = new Map();
        
        // Configurações
        this.preventDefault = true;
        this.enableGamepad = true;
        this.enableTouch = true;
        this.enableGestures = true;
        
        this.setupEventListeners();
        if (this.enableGamepad) {
            this.setupGamepad();
        }
    }

    setupEventListeners() {
        // Keyboard events
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Mouse events
        this.target.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.target.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.target.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.target.addEventListener('wheel', (e) => this.handleMouseWheel(e));
        
        // Touch events
        if (this.enableTouch) {
            this.target.addEventListener('touchstart', (e) => this.handleTouchStart(e));
            this.target.addEventListener('touchend', (e) => this.handleTouchEnd(e));
            this.target.addEventListener('touchmove', (e) => this.handleTouchMove(e));
            
            if (this.enableGestures) {
                this.setupGestureRecognition();
            }
        }
        
        // Context menu
        this.target.addEventListener('contextmenu', (e) => {
            if (this.preventDefault) {
                e.preventDefault();
            }
        });
    }

    setupGestureRecognition() {
        let startTouch = null;
        let startTime = 0;
        
        this.target.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startTouch = e.touches[0];
                startTime = performance.now();
            }
        });
        
        this.target.addEventListener('touchend', (e) => {
            if (startTouch) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                if (duration < 300) { // Tap gesture
                    this.emitGesture('tap', { x: startTouch.clientX, y: startTouch.clientY });
                }
                
                startTouch = null;
            }
        });
        
        this.target.addEventListener('touchmove', (e) => {
            if (startTouch && e.touches.length === 1) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - startTouch.clientX;
                const deltaY = touch.clientY - startTouch.clientY;
                
                if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
                    const direction = Math.abs(deltaX) > Math.abs(deltaY)
                        ? (deltaX > 0 ? 'right' : 'left')
                        : (deltaY > 0 ? 'down' : 'up');
                        
                    this.emitGesture('swipe', { direction, deltaX, deltaY });
                    startTouch = null;
                }
            }
        });
    }

    setupGamepad() {
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepads.set(e.gamepad.index, e.gamepad);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            this.gamepads.delete(e.gamepad.index);
        });
    }

    handleKeyDown(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }
        
        const key = event.code;
        if (!this.heldKeys.has(key)) {
            this.pressedKeys.add(key);
        }
        this.heldKeys.add(key);
        
        // Executar callbacks
        if (this.keyCallbacks.has('keydown')) {
            this.keyCallbacks.get('keydown').forEach(callback => callback(key));
        }
    }

    handleKeyUp(event) {
        const key = event.code;
        this.releasedKeys.add(key);
        this.heldKeys.delete(key);
        
        // Executar callbacks
        if (this.keyCallbacks.has('keyup')) {
            this.keyCallbacks.get('keyup').forEach(callback => callback(key));
        }
    }

    handleMouseDown(event) {
        const button = event.button;
        this.mouseButtons.set(button, true);
        
        // Executar callbacks
        if (this.mouseCallbacks.has('mousedown')) {
            this.mouseCallbacks.get('mousedown').forEach(callback => 
                callback(this.getMousePosition(event), button));
        }
    }

    handleMouseUp(event) {
        const button = event.button;
        this.mouseButtons.set(button, false);
        
        // Executar callbacks
        if (this.mouseCallbacks.has('mouseup')) {
            this.mouseCallbacks.get('mouseup').forEach(callback => 
                callback(this.getMousePosition(event), button));
        }
    }

    handleMouseMove(event) {
        this.updateMousePosition(event);
        
        // Executar callbacks
        if (this.mouseCallbacks.has('mousemove')) {
            this.mouseCallbacks.get('mousemove').forEach(callback => 
                callback(this.mousePosition));
        }
    }

    handleMouseWheel(event) {
        const delta = Math.sign(event.deltaY);
        
        // Executar callbacks
        if (this.mouseCallbacks.has('wheel')) {
            this.mouseCallbacks.get('wheel').forEach(callback => callback(delta));
        }
    }

    handleTouchStart(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }
        
        Array.from(event.changedTouches).forEach(touch => {
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startX: touch.clientX,
                startY: touch.clientY,
                timeStart: performance.now()
            });
        });
        
        // Executar callbacks
        if (this.touchCallbacks.has('touchstart')) {
            this.touchCallbacks.get('touchstart').forEach(callback => 
                callback(Array.from(this.touches.values())));
        }
    }

    handleTouchEnd(event) {
        Array.from(event.changedTouches).forEach(touch => {
            this.touches.delete(touch.identifier);
        });
        
        // Executar callbacks
        if (this.touchCallbacks.has('touchend')) {
            this.touchCallbacks.get('touchend').forEach(callback => 
                callback(Array.from(this.touches.values())));
        }
    }

    handleTouchMove(event) {
        Array.from(event.changedTouches).forEach(touch => {
            if (this.touches.has(touch.identifier)) {
                const touchData = this.touches.get(touch.identifier);
                touchData.x = touch.clientX;
                touchData.y = touch.clientY;
            }
        });
        
        // Executar callbacks
        if (this.touchCallbacks.has('touchmove')) {
            this.touchCallbacks.get('touchmove').forEach(callback => 
                callback(Array.from(this.touches.values())));
        }
    }

    emitGesture(type, data) {
        if (this.gestureCallbacks.has(type)) {
            this.gestureCallbacks.get(type).forEach(callback => callback(data));
        }
    }

    updateMousePosition(event) {
        const rect = this.target.getBoundingClientRect();
        this.mousePosition.x = event.clientX - rect.left;
        this.mousePosition.y = event.clientY - rect.top;
    }

    getMousePosition(event) {
        const rect = this.target.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    // API Pública
    isKeyPressed(key) {
        return this.pressedKeys.has(this.keyMap.get(key) || key);
    }

    isKeyHeld(key) {
        return this.heldKeys.has(this.keyMap.get(key) || key);
    }

    isKeyReleased(key) {
        return this.releasedKeys.has(this.keyMap.get(key) || key);
    }

    isMouseButtonDown(button) {
        return this.mouseButtons.get(button) || false;
    }

    getMousePos() {
        return { ...this.mousePosition };
    }

    getTouches() {
        return Array.from(this.touches.values());
    }

    mapKey(action, key) {
        this.keyMap.set(action, key);
    }

    on(event, callback) {
        if (event.startsWith('key')) {
            if (!this.keyCallbacks.has(event)) {
                this.keyCallbacks.set(event, new Set());
            }
            this.keyCallbacks.get(event).add(callback);
        } else if (event.startsWith('mouse')) {
            if (!this.mouseCallbacks.has(event)) {
                this.mouseCallbacks.set(event, new Set());
            }
            this.mouseCallbacks.get(event).add(callback);
        } else if (event.startsWith('touch')) {
            if (!this.touchCallbacks.has(event)) {
                this.touchCallbacks.set(event, new Set());
            }
            this.touchCallbacks.get(event).add(callback);
        } else if (event.startsWith('gesture')) {
            if (!this.gestureCallbacks.has(event)) {
                this.gestureCallbacks.set(event, new Set());
            }
            this.gestureCallbacks.get(event).add(callback);
        }
    }

    off(event, callback) {
        if (event.startsWith('key') && this.keyCallbacks.has(event)) {
            this.keyCallbacks.get(event).delete(callback);
        } else if (event.startsWith('mouse') && this.mouseCallbacks.has(event)) {
            this.mouseCallbacks.get(event).delete(callback);
        } else if (event.startsWith('touch') && this.touchCallbacks.has(event)) {
            this.touchCallbacks.get(event).delete(callback);
        } else if (event.startsWith('gesture') && this.gestureCallbacks.has(event)) {
            this.gestureCallbacks.get(event).delete(callback);
        }
    }

    update() {
        // Limpar estados temporários
        this.pressedKeys.clear();
        this.releasedKeys.clear();
        
        // Atualizar gamepads
        if (this.enableGamepad) {
            this.updateGamepads();
        }
    }

    updateGamepads() {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad) {
                this.gamepads.set(gamepad.index, gamepad);
            }
        }
    }

    getGamepad(index) {
        return this.gamepads.get(index);
    }

    setWorldPosition(x, y) {
        this.mouseWorldPosition.x = x;
        this.mouseWorldPosition.y = y;
    }

    getWorldPosition() {
        return { ...this.mouseWorldPosition };
    }
}

export default InputManager;
