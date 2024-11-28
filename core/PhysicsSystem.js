class PhysicsSystem {
    constructor() {
        this.entities = new Set();
        this.gravity = { x: 0, y: 9.81 };
        this.worldBounds = {
            left: -Infinity,
            right: Infinity,
            top: -Infinity,
            bottom: Infinity
        };
        this.collisionGroups = new Map();
        this.collisionMatrix = new Map();
        this.quadTree = null;
        this.timeScale = 1;
        this.iterations = 3;
        this.enableSleeping = true;
        
        // Configurações de física
        this.velocityIterations = 8;
        this.positionIterations = 3;
        this.enableContinuousPhysics = true;
        
        // Configurações de colisão
        this.broadphase = 'quadtree'; // ou 'bruteforce'
        this.continuousDetection = true;
        this.reuseCollisionManifolds = true;
        
        this.setupQuadTree();
    }

    setupQuadTree() {
        // Implementar QuadTree para otimização de colisão
        this.quadTree = {
            bounds: { x: 0, y: 0, width: 1000, height: 1000 },
            maxObjects: 10,
            maxLevels: 5,
            level: 0,
            objects: [],
            nodes: []
        };
    }

    addEntity(entity) {
        this.entities.add(entity);
        
        // Adicionar aos grupos de colisão
        entity.collisionGroups.forEach(group => {
            if (!this.collisionGroups.has(group)) {
                this.collisionGroups.set(group, new Set());
            }
            this.collisionGroups.get(group).add(entity);
        });
    }

    removeEntity(entity) {
        this.entities.delete(entity);
        
        // Remover dos grupos de colisão
        entity.collisionGroups.forEach(group => {
            if (this.collisionGroups.has(group)) {
                this.collisionGroups.get(group).delete(entity);
            }
        });
    }

    setGravity(x, y) {
        this.gravity.x = x;
        this.gravity.y = y;
    }

    setWorldBounds(left, right, top, bottom) {
        this.worldBounds = { left, right, top, bottom };
    }

    setCollisionGroup(group1, group2, callback) {
        const key = `${group1}_${group2}`;
        this.collisionMatrix.set(key, callback);
    }

    update(deltaTime) {
        const scaledDelta = deltaTime * this.timeScale;
        
        // Atualizar QuadTree
        this.updateQuadTree();
        
        // Aplicar física para cada entidade
        for (let i = 0; i < this.iterations; i++) {
            this.updatePhysics(scaledDelta / this.iterations);
        }
        
        // Detectar e resolver colisões
        this.handleCollisions();
        
        // Aplicar restrições de mundo
        this.applyWorldBounds();
    }

    updatePhysics(deltaTime) {
        for (const entity of this.entities) {
            if (!entity.solid || (this.enableSleeping && entity.sleeping)) continue;
            
            // Aplicar gravidade
            if (entity.gravity !== 0) {
                entity.velocity.x += this.gravity.x * entity.gravity * deltaTime;
                entity.velocity.y += this.gravity.y * entity.gravity * deltaTime;
            }
            
            // Aplicar forças
            entity.velocity.x += entity.acceleration.x * deltaTime;
            entity.velocity.y += entity.acceleration.y * deltaTime;
            
            // Aplicar arrasto
            if (entity.drag !== 0) {
                entity.velocity.x *= (1 - entity.drag * deltaTime);
                entity.velocity.y *= (1 - entity.drag * deltaTime);
            }
            
            // Atualizar posição
            entity.x += entity.velocity.x * deltaTime;
            entity.y += entity.velocity.y * deltaTime;
            
            // Resetar aceleração
            entity.acceleration.x = 0;
            entity.acceleration.y = 0;
        }
    }

    handleCollisions() {
        const pairs = this.broadphase === 'quadtree' 
            ? this.getCollisionPairsQuadTree()
            : this.getCollisionPairsBruteForce();
            
        for (const [entity1, entity2] of pairs) {
            if (this.checkCollision(entity1, entity2)) {
                this.resolveCollision(entity1, entity2);
            }
        }
    }

    getCollisionPairsQuadTree() {
        const pairs = new Set();
        const checked = new Set();
        
        for (const entity of this.entities) {
            const potentialCollisions = this.quadTree.retrieve(entity);
            
            for (const other of potentialCollisions) {
                if (entity === other) continue;
                
                const pairId = [entity.id, other.id].sort().join('_');
                if (checked.has(pairId)) continue;
                
                checked.add(pairId);
                pairs.add([entity, other]);
            }
        }
        
        return pairs;
    }

    getCollisionPairsBruteForce() {
        const pairs = new Set();
        const entities = Array.from(this.entities);
        
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                pairs.add([entities[i], entities[j]]);
            }
        }
        
        return pairs;
    }

    checkCollision(entity1, entity2) {
        // Verificar se os grupos de colisão são compatíveis
        const canCollide = this.checkCollisionGroups(entity1, entity2);
        if (!canCollide) return false;
        
        // Verificar colisão baseada na forma
        switch(entity1.collisionShape) {
            case 'circle':
                return entity2.collisionShape === 'circle' 
                    ? this.checkCircleCircle(entity1, entity2)
                    : this.checkCircleRect(entity1, entity2);
            case 'rectangle':
                return entity2.collisionShape === 'circle'
                    ? this.checkCircleRect(entity2, entity1)
                    : this.checkRectRect(entity1, entity2);
            default:
                return false;
        }
    }

    checkCollisionGroups(entity1, entity2) {
        for (const group1 of entity1.collisionGroups) {
            for (const group2 of entity2.collisionGroups) {
                const key = `${group1}_${group2}`;
                if (this.collisionMatrix.has(key)) {
                    return true;
                }
            }
        }
        return false;
    }

    checkCircleCircle(circle1, circle2) {
        const dx = circle2.x - circle1.x;
        const dy = circle2.y - circle1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = circle1.radius + circle2.radius;
        
        return distance < minDistance;
    }

    checkCircleRect(circle, rect) {
        const closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
        const closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));
        
        const distanceX = circle.x - closestX;
        const distanceY = circle.y - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;
        
        return distanceSquared < (circle.radius * circle.radius);
    }

    checkRectRect(rect1, rect2) {
        return !(rect1.right < rect2.left ||
                rect1.left > rect2.right ||
                rect1.bottom < rect2.top ||
                rect1.top > rect2.bottom);
    }

    resolveCollision(entity1, entity2) {
        // Calcular normal de colisão
        const dx = entity2.x - entity1.x;
        const dy = entity2.y - entity1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const nx = dx / distance;
        const ny = dy / distance;
        
        // Calcular velocidade relativa
        const relativeVelocityX = entity1.velocity.x - entity2.velocity.x;
        const relativeVelocityY = entity1.velocity.y - entity2.velocity.y;
        
        // Calcular velocidade relativa ao longo da normal
        const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;
        
        // Se os objetos estão se afastando, não resolver colisão
        if (velocityAlongNormal > 0) return;
        
        // Calcular coeficiente de restituição
        const restitution = Math.min(entity1.bounce, entity2.bounce);
        
        // Calcular impulso escalar
        const j = -(1 + restitution) * velocityAlongNormal;
        const impulseScalar = j / (1/entity1.mass + 1/entity2.mass);
        
        // Aplicar impulso
        entity1.velocity.x -= (impulseScalar * nx) / entity1.mass;
        entity1.velocity.y -= (impulseScalar * ny) / entity1.mass;
        entity2.velocity.x += (impulseScalar * nx) / entity2.mass;
        entity2.velocity.y += (impulseScalar * ny) / entity2.mass;
        
        // Separar entidades (evitar sobreposição)
        const percent = 0.2; // penetration percentage to correct
        const slop = 0.01; // penetration allowance
        const penetration = distance - (entity1.radius + entity2.radius);
        
        if (penetration < 0) {
            const correction = (Math.max(penetration - slop, 0) / (1/entity1.mass + 1/entity2.mass)) * percent;
            const correctionX = nx * correction;
            const correctionY = ny * correction;
            
            entity1.x -= correctionX / entity1.mass;
            entity1.y -= correctionY / entity1.mass;
            entity2.x += correctionX / entity2.mass;
            entity2.y += correctionY / entity2.mass;
        }
    }

    applyWorldBounds() {
        for (const entity of this.entities) {
            if (!entity.solid) continue;
            
            const bounds = entity.getBoundingBox();
            
            // Colisão com limites horizontais
            if (bounds.left < this.worldBounds.left) {
                entity.x = this.worldBounds.left + entity.boundingBox.width / 2;
                entity.velocity.x *= -entity.bounce;
            } else if (bounds.right > this.worldBounds.right) {
                entity.x = this.worldBounds.right - entity.boundingBox.width / 2;
                entity.velocity.x *= -entity.bounce;
            }
            
            // Colisão com limites verticais
            if (bounds.top < this.worldBounds.top) {
                entity.y = this.worldBounds.top + entity.boundingBox.height / 2;
                entity.velocity.y *= -entity.bounce;
            } else if (bounds.bottom > this.worldBounds.bottom) {
                entity.y = this.worldBounds.bottom - entity.boundingBox.height / 2;
                entity.velocity.y *= -entity.bounce;
            }
        }
    }

    updateQuadTree() {
        // Limpar QuadTree
        this.quadTree.objects = [];
        this.quadTree.nodes = [];
        
        // Inserir todas as entidades
        for (const entity of this.entities) {
            if (entity.solid) {
                this.quadTree.insert(entity);
            }
        }
    }
}

export default PhysicsSystem;
