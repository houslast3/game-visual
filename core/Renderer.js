class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.canvas = ctx.canvas;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.camera = {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0
        };
        this.effects = new Map();
        this.layers = new Map();
        this.currentLayer = 'default';
        this.backgroundColor = '#ffffff';
        this.debug = false;

        // Inicializar camada padrão
        this.addLayer('default', 0);
        
        // Configurar efeitos padrão
        this.setupDefaultEffects();
    }

    setupDefaultEffects() {
        // Efeito de cor
        this.addEffect('color', (ctx, params) => {
            ctx.fillStyle = params.color;
            ctx.fillRect(0, 0, this.width, this.height);
        });

        // Efeito de brilho
        this.addEffect('brightness', (ctx, params) => {
            ctx.filter = `brightness(${params.value}%)`;
        });

        // Efeito de desfoque
        this.addEffect('blur', (ctx, params) => {
            ctx.filter = `blur(${params.radius}px)`;
        });

        // Efeito de pixelização
        this.addEffect('pixelate', (ctx, params) => {
            const size = params.size || 10;
            ctx.imageSmoothingEnabled = false;
            // Implementar pixelização
        });
    }

    addLayer(name, zIndex) {
        this.layers.set(name, {
            zIndex: zIndex,
            visible: true,
            alpha: 1,
            entities: new Set()
        });
    }

    setLayer(name) {
        if (this.layers.has(name)) {
            this.currentLayer = name;
        }
    }

    addToLayer(entity, layerName = 'default') {
        if (this.layers.has(layerName)) {
            this.layers.get(layerName).entities.add(entity);
        }
    }

    removeFromLayer(entity, layerName = 'default') {
        if (this.layers.has(layerName)) {
            this.layers.get(layerName).entities.delete(entity);
        }
    }

    addEffect(name, callback) {
        this.effects.set(name, callback);
    }

    applyEffect(name, params = {}) {
        const effect = this.effects.get(name);
        if (effect) {
            effect(this.ctx, params);
        }
    }

    clear() {
        this.ctx.save();
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();
    }

    beginDraw() {
        this.ctx.save();
        
        // Aplicar transformações da câmera
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(this.camera.scale, this.camera.scale);
        this.ctx.rotate(this.camera.rotation);
        this.ctx.translate(-this.camera.x, -this.camera.y);
    }

    endDraw() {
        this.ctx.restore();
    }

    render(sprites) {
        this.clear();
        this.beginDraw();

        // Ordenar camadas por zIndex
        const sortedLayers = Array.from(this.layers.entries())
            .sort((a, b) => a[1].zIndex - b[1].zIndex);

        // Renderizar cada camada
        for (const [layerName, layer] of sortedLayers) {
            if (layer.visible) {
                this.ctx.save();
                this.ctx.globalAlpha = layer.alpha;

                // Renderizar entidades na camada
                for (const entity of layer.entities) {
                    if (entity.visible) {
                        this.renderEntity(entity);
                    }
                }

                this.ctx.restore();
            }
        }

        // Renderizar debug info se necessário
        if (this.debug) {
            this.renderDebugInfo();
        }

        this.endDraw();
    }

    renderEntity(entity) {
        if (!entity.currentCostume) return;

        this.ctx.save();

        // Aplicar transformações do sprite
        this.ctx.translate(entity.x, entity.y);
        this.ctx.rotate(entity.rotation * Math.PI / 180);
        this.ctx.scale(entity.scaleX, entity.scaleY);

        // Aplicar efeitos visuais do sprite
        if (entity.effects) {
            for (const [effectName, params] of entity.effects) {
                this.applyEffect(effectName, params);
            }
        }

        // Desenhar o sprite
        const width = entity.currentCostume.width;
        const height = entity.currentCostume.height;
        this.ctx.drawImage(
            entity.currentCostume,
            -width / 2,
            -height / 2,
            width,
            height
        );

        this.ctx.restore();
    }

    renderDebugInfo() {
        this.ctx.save();
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 1;

        // Renderizar bounding boxes
        for (const layer of this.layers.values()) {
            for (const entity of layer.entities) {
                if (entity.visible) {
                    const box = entity.getBoundingBox();
                    this.ctx.strokeRect(
                        box.left,
                        box.top,
                        box.right - box.left,
                        box.bottom - box.top
                    );

                    // Renderizar ponto central
                    this.ctx.beginPath();
                    this.ctx.arc(entity.x, entity.y, 2, 0, Math.PI * 2);
                    this.ctx.stroke();

                    // Renderizar direção
                    this.ctx.beginPath();
                    this.ctx.moveTo(entity.x, entity.y);
                    const radians = entity.rotation * Math.PI / 180;
                    this.ctx.lineTo(
                        entity.x + Math.cos(radians) * 20,
                        entity.y + Math.sin(radians) * 20
                    );
                    this.ctx.stroke();
                }
            }
        }

        this.ctx.restore();
    }

    setCamera(x, y, scale = 1, rotation = 0) {
        this.camera.x = x;
        this.camera.y = y;
        this.camera.scale = scale;
        this.camera.rotation = rotation;
    }

    moveCamera(dx, dy) {
        this.camera.x += dx;
        this.camera.y += dy;
    }

    zoomCamera(factor) {
        this.camera.scale *= factor;
    }

    rotateCamera(angle) {
        this.camera.rotation += angle;
    }

    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.width / 2) / this.camera.scale + this.camera.x;
        const worldY = (screenY - this.height / 2) / this.camera.scale + this.camera.y;
        return { x: worldX, y: worldY };
    }

    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.camera.x) * this.camera.scale + this.width / 2;
        const screenY = (worldY - this.camera.y) * this.camera.scale + this.height / 2;
        return { x: screenX, y: screenY };
    }

    handleResize() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    setDebug(enabled) {
        this.debug = enabled;
    }
}

export default Renderer;
