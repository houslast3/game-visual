class Engine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.setupWorkspace();
        this.sprites = new Map();
        this.variables = new Map();
        this.events = new Map();
        this.isRunning = false;
        this.fps = 60;
        this.lastTime = 0;
        this.deltaTime = 0;
    }

    setupWorkspace() {
        // Criar área de trabalho principal
        this.workspace = document.createElement('div');
        this.workspace.className = 'scratch-workspace';
        
        // Área de blocos
        this.blocksPalette = document.createElement('div');
        this.blocksPalette.className = 'blocks-palette';
        
        // Área de código
        this.codeArea = document.createElement('div');
        this.codeArea.className = 'code-area';
        
        // Área de preview
        this.previewArea = document.createElement('div');
        this.previewArea.className = 'preview-area';
        
        // Canvas para renderização
        this.canvas = document.createElement('canvas');
        this.canvas.width = 480;
        this.canvas.height = 360;
        this.ctx = this.canvas.getContext('2d');
        
        // Adicionar elementos ao workspace
        this.previewArea.appendChild(this.canvas);
        this.workspace.appendChild(this.blocksPalette);
        this.workspace.appendChild(this.codeArea);
        this.workspace.appendChild(this.previewArea);
        
        // Adicionar workspace ao container
        this.container.appendChild(this.workspace);
        
        // Inicializar sistemas
        this.initializeSystems();
    }

    initializeSystems() {
        this.renderer = new Renderer(this.ctx);
        this.input = new InputManager(this.canvas);
        this.physics = new PhysicsSystem();
        this.sound = new SoundSystem();
        this.blockManager = new BlockManager(this);
        this.eventSystem = new EventSystem();
        this.assetLoader = new AssetLoader();
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = performance.now();
            requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
        }
    }

    stop() {
        this.isRunning = false;
    }

    gameLoop(timestamp) {
        if (!this.isRunning) return;

        // Calcular delta time
        this.deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Atualizar sistemas
        this.update();
        this.render();

        // Próximo frame
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }

    update() {
        // Atualizar física
        this.physics.update(this.deltaTime);

        // Atualizar sprites
        for (const sprite of this.sprites.values()) {
            sprite.update(this.deltaTime);
        }

        // Atualizar eventos
        this.eventSystem.update();

        // Atualizar input
        this.input.update();
    }

    render() {
        // Limpar canvas
        this.renderer.clear();

        // Renderizar sprites
        for (const sprite of this.sprites.values()) {
            this.renderer.renderSprite(sprite);
        }

        // Renderizar efeitos visuais
        this.renderer.renderEffects();
    }

    addSprite(sprite) {
        this.sprites.set(sprite.id, sprite);
        return sprite;
    }

    removeSprite(spriteId) {
        this.sprites.delete(spriteId);
    }

    getSprite(spriteId) {
        return this.sprites.get(spriteId);
    }

    setVariable(name, value) {
        this.variables.set(name, value);
    }

    getVariable(name) {
        return this.variables.get(name);
    }

    addEventListener(type, callback) {
        this.eventSystem.addEventListener(type, callback);
    }

    removeEventListener(type, callback) {
        this.eventSystem.removeEventListener(type, callback);
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.handleResize();
    }
}

export default Engine;
