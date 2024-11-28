class BlockManager {
    constructor(engine) {
        this.engine = engine;
        this.blockCategories = new Map();
        this.blockInstances = new Map();
        this.draggedBlock = null;
        this.selectedBlock = null;
        this.initializeBlockCategories();
        this.setupEventListeners();
    }

    initializeBlockCategories() {
        // Movimento
        this.addCategory('motion', '#4C97FF', [
            { type: 'move_steps', template: 'move %n steps', params: ['number'] },
            { type: 'turn_right', template: 'turn right %n degrees', params: ['number'] },
            { type: 'turn_left', template: 'turn left %n degrees', params: ['number'] },
            { type: 'goto_xy', template: 'go to x: %n y: %n', params: ['number', 'number'] },
            { type: 'glide', template: 'glide %n secs to x: %n y: %n', params: ['number', 'number', 'number'] }
        ]);

        // Controle
        this.addCategory('control', '#FFAB19', [
            { type: 'wait', template: 'wait %n seconds', params: ['number'] },
            { type: 'repeat', template: 'repeat %n', params: ['number'], hasStack: true },
            { type: 'forever', template: 'forever', hasStack: true },
            { type: 'if', template: 'if %b then', params: ['boolean'], hasStack: true },
            { type: 'if_else', template: 'if %b then', params: ['boolean'], hasStack: true, hasElse: true }
        ]);

        // Aparência
        this.addCategory('looks', '#9966FF', [
            { type: 'say', template: 'say %s', params: ['string'] },
            { type: 'think', template: 'think %s', params: ['string'] },
            { type: 'show', template: 'show' },
            { type: 'hide', template: 'hide' },
            { type: 'change_costume', template: 'switch costume to %m.costume', params: ['costume'] }
        ]);

        // Som
        this.addCategory('sound', '#D65CD6', [
            { type: 'play_sound', template: 'play sound %m.sound', params: ['sound'] },
            { type: 'stop_sounds', template: 'stop all sounds' },
            { type: 'change_volume', template: 'change volume by %n', params: ['number'] },
            { type: 'set_volume', template: 'set volume to %n%', params: ['number'] }
        ]);

        // Sensores
        this.addCategory('sensing', '#4CBFE6', [
            { type: 'touching', template: 'touching %m.sprite?', params: ['sprite'], returns: 'boolean' },
            { type: 'ask', template: 'ask %s and wait', params: ['string'] },
            { type: 'mouse_x', template: 'mouse x', returns: 'number' },
            { type: 'mouse_y', template: 'mouse y', returns: 'number' },
            { type: 'key_pressed', template: 'key %m.key pressed?', params: ['key'], returns: 'boolean' }
        ]);

        // Operadores
        this.addCategory('operators', '#40BF4A', [
            { type: 'add', template: '%n + %n', params: ['number', 'number'], returns: 'number' },
            { type: 'subtract', template: '%n - %n', params: ['number', 'number'], returns: 'number' },
            { type: 'multiply', template: '%n * %n', params: ['number', 'number'], returns: 'number' },
            { type: 'divide', template: '%n / %n', params: ['number', 'number'], returns: 'number' },
            { type: 'random', template: 'pick random %n to %n', params: ['number', 'number'], returns: 'number' }
        ]);

        // Variáveis
        this.addCategory('variables', '#FF8C1A', [
            { type: 'set_var', template: 'set %m.var to %s', params: ['variable', 'string'] },
            { type: 'change_var', template: 'change %m.var by %n', params: ['variable', 'number'] },
            { type: 'show_var', template: 'show variable %m.var', params: ['variable'] },
            { type: 'hide_var', template: 'hide variable %m.var', params: ['variable'] }
        ]);
    }

    addCategory(name, color, blocks) {
        this.blockCategories.set(name, {
            color: color,
            blocks: blocks
        });
        this.createCategoryUI(name, color, blocks);
    }

    createCategoryUI(name, color, blocks) {
        const category = document.createElement('div');
        category.className = 'block-category';
        category.style.backgroundColor = color;
        category.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        
        const blockList = document.createElement('div');
        blockList.className = 'block-list';
        blockList.style.display = 'none';
        
        blocks.forEach(blockInfo => {
            const blockElement = this.createBlockElement(blockInfo, color);
            blockList.appendChild(blockElement);
        });
        
        category.addEventListener('click', () => {
            const allBlockLists = document.querySelectorAll('.block-list');
            allBlockLists.forEach(list => list.style.display = 'none');
            blockList.style.display = 'block';
        });
        
        this.engine.blocksPalette.appendChild(category);
        this.engine.blocksPalette.appendChild(blockList);
    }

    createBlockElement(blockInfo, color) {
        const block = document.createElement('div');
        block.className = 'block';
        block.style.backgroundColor = color;
        block.setAttribute('data-type', blockInfo.type);
        block.innerHTML = this.formatBlockTemplate(blockInfo.template);
        this.setupBlockDragAndDrop(block);
        return block;
    }

    formatBlockTemplate(template) {
        return template.replace(/%([a-z])/g, (match, type) => {
            switch(type) {
                case 'n': return '<input type="number" class="block-input number" value="0">';
                case 's': return '<input type="text" class="block-input string" value="">';
                case 'b': return '<select class="block-input boolean"><option>true</option><option>false</option></select>';
                default: return match;
            }
        });
    }

    setupBlockDragAndDrop(block) {
        block.draggable = true;
        
        block.addEventListener('dragstart', (e) => {
            this.draggedBlock = block.cloneNode(true);
            e.dataTransfer.setData('text/plain', block.getAttribute('data-type'));
            block.classList.add('dragging');
        });

        block.addEventListener('dragend', () => {
            block.classList.remove('dragging');
            this.draggedBlock = null;
        });
    }

    setupEventListeners() {
        this.engine.codeArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dropTarget = this.findDropTarget(e.clientX, e.clientY);
            this.updateDropIndicator(dropTarget);
        });

        this.engine.codeArea.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedBlock) {
                const dropTarget = this.findDropTarget(e.clientX, e.clientY);
                this.handleBlockDrop(dropTarget);
            }
        });
    }

    findDropTarget(x, y) {
        const elements = document.elementsFromPoint(x, y);
        return elements.find(el => el.classList.contains('block') || el.classList.contains('block-drop-zone'));
    }

    updateDropIndicator(target) {
        // Remove previous indicators
        document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        
        if (target) {
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            target.parentNode.insertBefore(indicator, target);
        }
    }

    handleBlockDrop(target) {
        if (target) {
            const newBlock = this.draggedBlock.cloneNode(true);
            this.setupBlockDragAndDrop(newBlock);
            target.parentNode.insertBefore(newBlock, target);
            this.updateBlockConnections();
        }
    }

    updateBlockConnections() {
        const blocks = Array.from(this.engine.codeArea.querySelectorAll('.block'));
        blocks.forEach((block, index) => {
            block.nextBlock = blocks[index + 1] || null;
            if (index > 0) {
                block.previousBlock = blocks[index - 1];
            }
        });
    }
}

export default BlockManager;
