class SoundSystem {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        
        // Gerenciamento de sons
        this.sounds = new Map();
        this.instances = new Map();
        this.categories = new Map();
        
        // Estado
        this.muted = false;
        this.volume = 1;
        this.enabled = true;
        
        // Configurações
        this.maxInstances = 32;
        this.spatialScale = 1;
        this.rolloffFactor = 1;
        this.dopplerFactor = 1;
        
        // Efeitos
        this.effects = new Map();
        this.effectChains = new Map();
        
        // Listener padrão
        this.listener = {
            position: [0, 0, 0],
            orientation: [0, 0, -1, 0, 1, 0],
            velocity: [0, 0, 0]
        };
        
        this.setupDefaultEffects();
    }

    setupDefaultEffects() {
        // Reverb
        this.addEffect('reverb', (context) => {
            const convolver = context.createConvolver();
            // Carregar impulse response...
            return convolver;
        });

        // Delay
        this.addEffect('delay', (context) => {
            const delay = context.createDelay(5.0);
            const feedback = context.createGain();
            delay.connect(feedback);
            feedback.connect(delay);
            return { delay, feedback };
        });

        // Compressor
        this.addEffect('compressor', (context) => {
            const compressor = context.createDynamicsCompressor();
            return compressor;
        });

        // Filter
        this.addEffect('filter', (context) => {
            const filter = context.createBiquadFilter();
            return filter;
        });
    }

    async loadSound(name, url, options = {}) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            
            this.sounds.set(name, {
                buffer: audioBuffer,
                loop: options.loop || false,
                volume: options.volume || 1,
                category: options.category || 'default',
                spatial: options.spatial || false,
                minDistance: options.minDistance || 1,
                maxDistance: options.maxDistance || 10000
            });
            
            // Adicionar à categoria
            if (!this.categories.has(options.category)) {
                this.categories.set(options.category, new Set());
            }
            this.categories.get(options.category).add(name);
            
            return true;
        } catch (error) {
            console.error(`Error loading sound ${name}:`, error);
            return false;
        }
    }

    play(name, options = {}) {
        if (!this.enabled || !this.sounds.has(name)) return null;
        
        const sound = this.sounds.get(name);
        const source = this.context.createBufferSource();
        source.buffer = sound.buffer;
        
        // Configurar fonte
        source.loop = options.loop || sound.loop;
        
        // Criar cadeia de áudio
        const gainNode = this.context.createGain();
        gainNode.gain.value = (options.volume || sound.volume) * this.volume;
        
        // Configurar espacialização se necessário
        let spatialNode = null;
        if (sound.spatial) {
            spatialNode = this.context.createPanner();
            spatialNode.panningModel = 'HRTF';
            spatialNode.distanceModel = 'inverse';
            spatialNode.refDistance = sound.minDistance;
            spatialNode.maxDistance = sound.maxDistance;
            spatialNode.rolloffFactor = this.rolloffFactor;
            
            if (options.position) {
                spatialNode.setPosition(...options.position);
            }
            if (options.velocity) {
                spatialNode.setVelocity(...options.velocity);
            }
        }
        
        // Conectar nós
        source.connect(gainNode);
        if (spatialNode) {
            gainNode.connect(spatialNode);
            spatialNode.connect(this.masterGain);
        } else {
            gainNode.connect(this.masterGain);
        }
        
        // Aplicar efeitos se especificados
        if (options.effects) {
            this.applyEffectChain(source, gainNode, options.effects);
        }
        
        // Iniciar playback
        const startTime = options.startTime || this.context.currentTime;
        const offset = options.offset || 0;
        const duration = options.duration || sound.buffer.duration;
        
        source.start(startTime, offset, duration);
        
        // Criar instância
        const instance = {
            id: Math.random().toString(36).substr(2, 9),
            source,
            gainNode,
            spatialNode,
            startTime,
            name,
            options
        };
        
        this.instances.set(instance.id, instance);
        
        // Limpar instância quando terminar
        source.onended = () => {
            this.instances.delete(instance.id);
        };
        
        return instance.id;
    }

    stop(id) {
        if (this.instances.has(id)) {
            const instance = this.instances.get(id);
            instance.source.stop();
            this.instances.delete(id);
        }
    }

    pause(id) {
        if (this.instances.has(id)) {
            const instance = this.instances.get(id);
            instance.source.stop();
            instance.pauseTime = this.context.currentTime - instance.startTime;
        }
    }

    resume(id) {
        if (this.instances.has(id)) {
            const instance = this.instances.get(id);
            if (instance.pauseTime !== undefined) {
                const newInstance = this.play(instance.name, {
                    ...instance.options,
                    offset: instance.pauseTime
                });
                this.instances.delete(id);
                return newInstance;
            }
        }
        return null;
    }

    setVolume(volume, id) {
        if (id) {
            // Ajustar volume de uma instância específica
            if (this.instances.has(id)) {
                const instance = this.instances.get(id);
                instance.gainNode.gain.value = volume;
            }
        } else {
            // Ajustar volume master
            this.volume = volume;
            this.masterGain.gain.value = volume;
        }
    }

    mute() {
        this.muted = true;
        this.masterGain.gain.value = 0;
    }

    unmute() {
        this.muted = false;
        this.masterGain.gain.value = this.volume;
    }

    setCategoryVolume(category, volume) {
        if (this.categories.has(category)) {
            for (const soundName of this.categories.get(category)) {
                const sound = this.sounds.get(soundName);
                sound.volume = volume;
            }
        }
    }

    setListenerPosition(x, y, z) {
        this.listener.position = [x, y, z];
        this.context.listener.setPosition(x, y, z);
    }

    setListenerOrientation(forward, up) {
        this.listener.orientation = [...forward, ...up];
        this.context.listener.setOrientation(...this.listener.orientation);
    }

    setListenerVelocity(x, y, z) {
        this.listener.velocity = [x, y, z];
        // Nota: A API Web Audio não suporta diretamente setVelocity para o listener
    }

    addEffect(name, createCallback) {
        this.effects.set(name, createCallback);
    }

    createEffectChain(name, effects) {
        const chain = effects.map(effect => {
            if (this.effects.has(effect.type)) {
                const node = this.effects.get(effect.type)(this.context);
                Object.assign(node, effect.params || {});
                return node;
            }
            return null;
        }).filter(Boolean);
        
        this.effectChains.set(name, chain);
    }

    applyEffectChain(source, destination, chainName) {
        if (this.effectChains.has(chainName)) {
            const chain = this.effectChains.get(chainName);
            let previousNode = source;
            
            chain.forEach(effect => {
                previousNode.connect(effect);
                previousNode = effect;
            });
            
            previousNode.connect(destination);
        }
    }

    update() {
        // Atualizar posições espaciais, se necessário
        for (const instance of this.instances.values()) {
            if (instance.spatialNode && instance.options.update) {
                const position = instance.options.update();
                instance.spatialNode.setPosition(...position);
            }
        }
    }
}

export default SoundSystem;
