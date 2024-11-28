class Sprite {
    constructor(engine, options = {}) {
        this.engine = engine;
        this.id = options.id || `sprite_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Sprite';
        
        // Posição e transformação
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.rotation = options.rotation || 0;
        this.scaleX = options.scaleX || 1;
        this.scaleY = options.scaleY || 1;
        this.visible = options.visible !== undefined ? options.visible : true;
        
        // Propriedades de renderização
        this.costumes = new Map();
        this.currentCostume = null;
        this.currentCostumeIndex = 0;
        this.effects = new Map();
        
        // Física
        this.velocity = { x: 0, y: 0 };
        this.acceleration = { x: 0, y: 0 };
        this.drag = options.drag || 0;
        this.bounce = options.bounce || 0;
        this.gravity = options.gravity || 0;
        this.solid = options.solid !== undefined ? options.solid : true;
        
        // Colisão
        this.boundingBox = { width: 0, height: 0 };
        this.collisionShape = options.collisionShape || 'rectangle';
        this.collisionGroups = new Set(options.collisionGroups || ['default']);
        
        // Estado e comportamento
        this.scripts = new Map();
        this.variables = new Map();
        this.lists = new Map();
        this.state = 'idle';
        this.direction = 1; // 1 direita, -1 esquerda
        
        // Animação
        this.animations = new Map();
        this.currentAnimation = null;
        this.animationFrame = 0;
        this.animationTimer = 0;
        
        // Som
        this.sounds = new Map();
        this.currentSound = null;
        this.volume = 100;
        
        // Eventos
        this.eventListeners = new Map();
        
        this.setupEventHandlers();
    }

    // Gerenciamento de Costumes
    addCostume(name, image) {
        this.costumes.set(name, image);
        if (!this.currentCostume) {
            this.switchCostume(name);
        }
        this.updateBoundingBox();
    }

    switchCostume(name) {
        if (this.costumes.has(name)) {
            this.currentCostume = this.costumes.get(name);
            this.currentCostumeIndex = Array.from(this.costumes.keys()).indexOf(name);
            this.updateBoundingBox();
        }
    }

    nextCostume() {
        const costumes = Array.from(this.costumes.keys());
        this.currentCostumeIndex = (this.currentCostumeIndex + 1) % costumes.length;
        this.switchCostume(costumes[this.currentCostumeIndex]);
    }

    // Animação
    addAnimation(name, frames, frameRate = 12) {
        this.animations.set(name, {
            frames: frames,
            frameRate: frameRate,
            frameTime: 1000 / frameRate
        });
    }

    playAnimation(name, loop = true) {
        if (this.animations.has(name)) {
            this.currentAnimation = this.animations.get(name);
            this.currentAnimation.loop = loop;
            this.animationFrame = 0;
            this.animationTimer = 0;
        }
    }

    stopAnimation() {
        this.currentAnimation = null;
        this.animationFrame = 0;
        this.animationTimer = 0;
    }

    // Física e Movimento
    setVelocity(x, y) {
        this.velocity.x = x;
        this.velocity.y = y;
    }

    addForce(x, y) {
        this.acceleration.x += x;
        this.acceleration.y += y;
    }

    move(steps) {
        const radians = this.rotation * Math.PI / 180;
        this.x += Math.cos(radians) * steps;
        this.y += Math.sin(radians) * steps;
    }

    turnRight(degrees) {
        this.rotation = (this.rotation + degrees) % 360;
    }

    turnLeft(degrees) {
        this.rotation = (this.rotation - degrees) % 360;
    }

    // Colisão
    updateBoundingBox() {
        if (this.currentCostume) {
            this.boundingBox.width = this.currentCostume.width * Math.abs(this.scaleX);
            this.boundingBox.height = this.currentCostume.height * Math.abs(this.scaleY);
        }
    }

    checkCollision(other) {
        if (!this.solid || !other.solid) return false;

        const thisBox = this.getBoundingBox();
        const otherBox = other.getBoundingBox();

        return !(thisBox.right < otherBox.left ||
                thisBox.left > otherBox.right ||
                thisBox.bottom < otherBox.top ||
                thisBox.top > otherBox.bottom);
    }

    getBoundingBox() {
        return {
            left: this.x - this.boundingBox.width / 2,
            right: this.x + this.boundingBox.width / 2,
            top: this.y - this.boundingBox.height / 2,
            bottom: this.y + this.boundingBox.height / 2
        };
    }

    // Som
    addSound(name, audio) {
        this.sounds.set(name, audio);
    }

    playSound(name) {
        if (this.sounds.has(name)) {
            const sound = this.sounds.get(name);
            sound.volume = this.volume / 100;
            sound.play();
        }
    }

    stopSounds() {
        this.sounds.forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }

    // Eventos
    setupEventHandlers() {
        this.on('tick', (deltaTime) => this.update(deltaTime));
        this.on('collide', (other) => this.handleCollision(other));
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    emit(event, ...args) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => callback(...args));
        }
    }

    // Atualização
    update(deltaTime) {
        this.updatePhysics(deltaTime);
        this.updateAnimation(deltaTime);
    }

    updatePhysics(deltaTime) {
        // Aplicar gravidade
        if (this.gravity) {
            this.velocity.y += this.gravity * deltaTime;
        }

        // Aplicar aceleração
        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;

        // Aplicar arrasto
        if (this.drag) {
            this.velocity.x *= (1 - this.drag * deltaTime);
            this.velocity.y *= (1 - this.drag * deltaTime);
        }

        // Atualizar posição
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;

        // Resetar aceleração
        this.acceleration.x = 0;
        this.acceleration.y = 0;
    }

    updateAnimation(deltaTime) {
        if (this.currentAnimation) {
            this.animationTimer += deltaTime;
            if (this.animationTimer >= this.currentAnimation.frameTime) {
                this.animationTimer = 0;
                this.animationFrame++;
                
                if (this.animationFrame >= this.currentAnimation.frames.length) {
                    if (this.currentAnimation.loop) {
                        this.animationFrame = 0;
                    } else {
                        this.stopAnimation();
                    }
                }
                
                if (this.currentAnimation) {
                    const frameName = this.currentAnimation.frames[this.animationFrame];
                    this.switchCostume(frameName);
                }
            }
        }
    }

    handleCollision(other) {
        if (this.bounce && other.solid) {
            // Implementar lógica de ricochete
            const thisBox = this.getBoundingBox();
            const otherBox = other.getBoundingBox();
            
            // Determinar direção da colisão
            const overlapX = Math.min(thisBox.right - otherBox.left, otherBox.right - thisBox.left);
            const overlapY = Math.min(thisBox.bottom - otherBox.top, otherBox.bottom - thisBox.top);
            
            if (overlapX < overlapY) {
                this.velocity.x *= -this.bounce;
            } else {
                this.velocity.y *= -this.bounce;
            }
        }
    }
}

export default Sprite;
