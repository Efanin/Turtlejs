// ------------------ ИГРОВОЕ ПОЛЕ ------------------
    const CELL_SIZE = 40;
    const GRID_W = 15;
    const GRID_H = 15;
    let candies = [];
    let obstacles = [];
    let robot = { x: 7, y: 7, dir: 0 };
    let score = 0;
    let gameActive = true;
    
    let savedCandies = [];
    let savedObstacles = [];
    
    let program = [];
    
    let isExecuting = false;
    let executionInterval = null;
    let currentFlatIndex = 0;
    let flatCommands = [];
    let currentHighlightElement = null;
    
    let dragSourceCmd = null;
    let dragSourceParent = null;
    let dragSourceIndex = null;
    let dropIndicator = null;
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreSpan = document.getElementById('scoreValue');
    const candiesLeftSpan = document.getElementById('candiesLeft');
    const scriptListEl = document.getElementById('scriptList');
    const resetBtn = document.getElementById('resetWorldBtn');
    const applyBtn = document.getElementById('applySettingsBtn');
    const runBtn = document.getElementById('runProgramBtn');
    const clearBtn = document.getElementById('clearProgramBtn');
    const candiesCountInput = document.getElementById('candiesCountInput');
    const obstaclesCountInput = document.getElementById('obstaclesCountInput');
    
    // ---------- Генерация мира ----------
    function generateWorld(candiesCount, obstaclesCount) {
        let newCandies = [];
        let newObstacles = [];
        
        const startX = Math.floor(GRID_W/2);
        const startY = Math.floor(GRID_H/2);
        let occupied = new Set();
        occupied.add(`${startX},${startY}`);
        
        let obstaclesPlaced = 0;
        let maxAttempts = 3000;
        for(let i=0; i<obstaclesCount && obstaclesPlaced < obstaclesCount; i++) {
            let placed = false;
            for(let attempt=0; attempt<maxAttempts; attempt++) {
                const x = Math.floor(Math.random() * GRID_W);
                const y = Math.floor(Math.random() * GRID_H);
                const key = `${x},${y}`;
                if(!occupied.has(key)) {
                    newObstacles.push({ x, y });
                    occupied.add(key);
                    obstaclesPlaced++;
                    placed = true;
                    break;
                }
            }
            if(!placed) break;
        }
        
        let candiesPlaced = 0;
        for(let i=0; i<candiesCount && candiesPlaced < candiesCount; i++) {
            let placed = false;
            for(let attempt=0; attempt<maxAttempts; attempt++) {
                const x = Math.floor(Math.random() * GRID_W);
                const y = Math.floor(Math.random() * GRID_H);
                const key = `${x},${y}`;
                if(!occupied.has(key)) {
                    newCandies.push({ x, y });
                    occupied.add(key);
                    candiesPlaced++;
                    placed = true;
                    break;
                }
            }
            if(!placed) break;
        }
        
        return { candies: newCandies, obstacles: newObstacles };
    }
    
    function saveLevelState() {
        savedCandies = JSON.parse(JSON.stringify(candies));
        savedObstacles = JSON.parse(JSON.stringify(obstacles));
    }
    
    function restoreLevelState() {
        candies = JSON.parse(JSON.stringify(savedCandies));
        obstacles = JSON.parse(JSON.stringify(savedObstacles));
    }
    
    function resetWorld() {
        const candiesCount = parseInt(candiesCountInput.value) || 45;
        const obstaclesCount = parseInt(obstaclesCountInput.value) || 25;
        const generated = generateWorld(candiesCount, obstaclesCount);
        candies = generated.candies;
        obstacles = generated.obstacles;
        saveLevelState();
        robot = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2), dir: 0 };
        score = 0;
        gameActive = true;
        updateUI();
        drawGame();
        stopExecution();
        clearHighlight();
    }
    
    function applySettings() {
        if(isExecuting) stopExecution();
        const candiesCount = parseInt(candiesCountInput.value) || 45;
        const obstaclesCount = parseInt(obstaclesCountInput.value) || 25;
        const generated = generateWorld(Math.min(candiesCount, 120), Math.min(obstaclesCount, 100));
        candies = generated.candies;
        obstacles = generated.obstacles;
        saveLevelState();
        robot = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2), dir: 0 };
        score = 0;
        gameActive = true;
        updateUI();
        drawGame();
        clearHighlight();
    }
    
    function checkCollisionWithObstacle(x, y) {
        return obstacles.some(obs => obs.x === x && obs.y === y);
    }
    
    function checkLose() {
        if(!gameActive) return true;
        if(robot.x < 0 || robot.x >= GRID_W || robot.y < 0 || robot.y >= GRID_H) {
            gameActive = false;
            stopExecution();
            showGameOverMessage("💥 ВЫХОД ЗА ГРАНИЦУ! 💥");
            drawGame();
            return true;
        }
        if(checkCollisionWithObstacle(robot.x, robot.y)) {
            gameActive = false;
            stopExecution();
            showGameOverMessage("🧱 СТОЛКНОВЕНИЕ С ПРЕПЯТСТВИЕМ! 🧱");
            drawGame();
            return true;
        }
        return false;
    }
    
    function showGameOverMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'game-over-message';
        msgDiv.innerText = text;
        document.body.appendChild(msgDiv);
        setTimeout(() => { if(msgDiv && msgDiv.remove) msgDiv.remove(); }, 2000);
    }
    
    function collectCandyAtRobot() {
        if(!gameActive) return false;
        const idx = candies.findIndex(c => c.x === robot.x && c.y === robot.y);
        if(idx !== -1) {
            candies.splice(idx, 1);
            score++;
            updateUI();
            drawGame();
            return true;
        }
        return false;
    }
    
    function moveSteps(direction, steps) {
        if(!gameActive) return false;
        let dx = 0, dy = 0;
        if(direction === 'forward') {
            switch(robot.dir) {
                case 0: dy = -1; break;
                case 1: dx = 1; break;
                case 2: dy = 1; break;
                case 3: dx = -1; break;
            }
        } else {
            switch(robot.dir) {
                case 0: dy = 1; break;
                case 1: dx = -1; break;
                case 2: dy = -1; break;
                case 3: dx = 1; break;
            }
        }
        
        for(let s=0; s<steps; s++) {
            if(!gameActive) break;
            let newX = robot.x + dx;
            let newY = robot.y + dy;
            
            if(newX < 0 || newX >= GRID_W || newY < 0 || newY >= GRID_H) {
                robot.x = newX;
                robot.y = newY;
                drawGame();
                checkLose();
                return false;
            }
            if(checkCollisionWithObstacle(newX, newY)) {
                robot.x = newX;
                robot.y = newY;
                drawGame();
                checkLose();
                return false;
            }
            robot.x = newX;
            robot.y = newY;
            collectCandyAtRobot();
            if(checkLose()) return false;
        }
        drawGame();
        return true;
    }
    
    function turnRight() { if(gameActive) { robot.dir = (robot.dir + 1) % 4; drawGame(); } }
    function turnLeft() { if(gameActive) { robot.dir = (robot.dir + 3) % 4; drawGame(); } }
    
    function flattenProgram(prog) {
        let flat = [];
        for(let cmd of prog) {
            if(cmd.type === 'forward') {
                for(let i=0; i<cmd.steps; i++) flat.push({ type: 'forward', originalCmd: cmd });
            } 
            else if(cmd.type === 'back') {
                for(let i=0; i<cmd.steps; i++) flat.push({ type: 'back', originalCmd: cmd });
            }
            else if(cmd.type === 'right') flat.push({ type: 'right', originalCmd: cmd });
            else if(cmd.type === 'left') flat.push({ type: 'left', originalCmd: cmd });
            else if(cmd.type === 'loop') {
                let repeats = cmd.repeatCount;
                for(let r=0; r<repeats; r++) {
                    let innerFlat = flattenProgram(cmd.children);
                    flat.push(...innerFlat);
                }
            }
        }
        return flat;
    }
    
    function clearHighlight() {
        if(currentHighlightElement) {
            currentHighlightElement.classList.remove('active-command');
            currentHighlightElement = null;
        }
    }
    
    function highlightCommandByFlatIndex(flatIdx) {
        clearHighlight();
        if(flatIdx < 0 || flatIdx >= flatCommands.length) return;
        const targetPrimitive = flatCommands[flatIdx];
        if(!targetPrimitive.originalCmd) return;
        
        function findCommandElement(container, targetCmd) {
            const items = container.querySelectorAll('li');
            for(let item of items) {
                if(item._cmdRef === targetCmd) return item;
                const nested = item.querySelector('.nested-list');
                if(nested) {
                    const found = findCommandElement(nested, targetCmd);
                    if(found) return found;
                }
            }
            return null;
        }
        
        const targetElement = findCommandElement(scriptListEl, targetPrimitive.originalCmd);
        if(targetElement) {
            targetElement.classList.add('active-command');
            currentHighlightElement = targetElement;
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    function executeSinglePrimitive(cmd) {
        if(!gameActive) return false;
        if(cmd.type === 'forward') moveSteps('forward', 1);
        else if(cmd.type === 'back') moveSteps('back', 1);
        else if(cmd.type === 'right') turnRight();
        else if(cmd.type === 'left') turnLeft();
        updateUI();
        drawGame();
        return gameActive;
    }
    
    function startExecution() {
        if(isExecuting) stopExecution();
        if(program.length === 0) {
            return;
        }
        
        restoreLevelState();
        robot = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2), dir: 0 };
        score = 0;
        gameActive = true;
        updateUI();
        drawGame();
        
        if(checkCollisionWithObstacle(robot.x, robot.y)) {
            gameActive = false;
            return;
        }
        
        flatCommands = flattenProgram(program);
        if(flatCommands.length === 0) {
            return;
        }
        
        currentFlatIndex = 0;
        isExecuting = true;
        
        executionInterval = setInterval(() => {
            if(!isExecuting) return;
            if(!gameActive) {
                stopExecution();
                clearHighlight();
                return;
            }
            if(currentFlatIndex >= flatCommands.length) {
                stopExecution();
                clearHighlight();
                const msgDiv = document.querySelector('.code-panel .info-message');
                const original = msgDiv.innerHTML;
                msgDiv.innerHTML = '✅ Программа выполнена! 🎉';
                setTimeout(() => { if(msgDiv) msgDiv.innerHTML = original; }, 1800);
                if(candies.length === 0 && gameActive) setTimeout(()=> alert("🏆 ВСЕ КОНФЕТЫ СОБРАНЫ! ПОБЕДА!"), 100);
                return;
            }
            
            highlightCommandByFlatIndex(currentFlatIndex);
            const cmd = flatCommands[currentFlatIndex];
            executeSinglePrimitive(cmd);
            currentFlatIndex++;
            
            if(!gameActive) {
                stopExecution();
                clearHighlight();
            }
            updateUI();
            drawGame();
        }, 420);
    }
    
    function stopExecution() {
        if(executionInterval) {
            clearInterval(executionInterval);
            executionInterval = null;
        }
        isExecuting = false;
        clearHighlight();
    }
    
    function updateUI() {
        scoreSpan.innerText = score;
        candiesLeftSpan.innerText = candies.length;
    }
    
    // ------------------ ОТРИСОВКА ПОЛЯ ------------------
    function drawGame() {
        canvas.width = GRID_W * CELL_SIZE;
        canvas.height = GRID_H * CELL_SIZE;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for(let i=0; i<GRID_W; i++) {
            for(let j=0; j<GRID_H; j++) {
                let x = i*CELL_SIZE, y = j*CELL_SIZE;
                let color = ( (i+j)%2 === 0 ) ? '#9ac9e8' : '#7bb3d1';
                ctx.fillStyle = color;
                ctx.fillRect(x, y, CELL_SIZE-1, CELL_SIZE-1);
                ctx.strokeStyle = '#4f8db3';
                ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
            }
        }
        
        for(let obs of obstacles) {
            let ox = obs.x * CELL_SIZE;
            let oy = obs.y * CELL_SIZE;
            ctx.fillStyle = '#5a3e2b';
            ctx.beginPath();
            ctx.roundRect(ox+4, oy+4, CELL_SIZE-8, CELL_SIZE-8, 8);
            ctx.fill();
            ctx.fillStyle = '#8b5e3c';
            ctx.beginPath();
            ctx.roundRect(ox+6, oy+6, CELL_SIZE-12, CELL_SIZE-12, 5);
            ctx.fill();
            ctx.fillStyle = '#c9a87b';
            ctx.font = `${CELL_SIZE * 0.5}px monospace`;
            ctx.fillText("❌", ox+6, oy+27);
        }
        
        for(let candy of candies) {
            let cx = candy.x * CELL_SIZE;
            let cy = candy.y * CELL_SIZE;
            ctx.font = `${CELL_SIZE * 0.6}px "Segoe UI Emoji"`;
            ctx.fillStyle = '#ffdf80';
            ctx.fillText("🍬", cx + 3, cy + CELL_SIZE-10);
        }
        
        if(robot.x >= 0 && robot.x < GRID_W && robot.y >= 0 && robot.y < GRID_H) {
            let rx = robot.x * CELL_SIZE;
            let ry = robot.y * CELL_SIZE;
            
            ctx.fillStyle = '#c22d2d';
            ctx.beginPath();
            ctx.roundRect(rx+2, ry+2, CELL_SIZE-4, CELL_SIZE-4, 8);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(rx+CELL_SIZE*0.35, ry+CELL_SIZE*0.4-5, 4, 0, 2*Math.PI);
            ctx.arc(rx+CELL_SIZE*0.65, ry+CELL_SIZE*0.4-5, 4, 0, 2*Math.PI);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(rx+CELL_SIZE*0.32+1, ry+CELL_SIZE*0.37-5, 1.8, 0, 2*Math.PI);
            ctx.arc(rx+CELL_SIZE*0.62+1, ry+CELL_SIZE*0.37-5, 1.8, 0, 2*Math.PI);
            ctx.fill();
            
            let centerX = rx + CELL_SIZE/2;
            let centerY = ry + CELL_SIZE/2;
            let arrowLength = CELL_SIZE * 0.45;
            let arrowDx = 0, arrowDy = 0;
            switch(robot.dir) {
                case 0: arrowDx = 0; arrowDy = -arrowLength; break;
                case 1: arrowDx = arrowLength; arrowDy = 0; break;
                case 2: arrowDx = 0; arrowDy = arrowLength; break;
                case 3: arrowDx = -arrowLength; arrowDy = 0; break;
            }
            
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ffaa44';
            ctx.fillStyle = '#ffdd88';
            let arrowTipX = centerX + arrowDx;
            let arrowTipY = centerY + arrowDy;
            let perpX = -arrowDy * 0.4;
            let perpY = arrowDx * 0.4;
            ctx.beginPath();
            ctx.moveTo(arrowTipX, arrowTipY);
            ctx.lineTo(centerX - arrowDx*0.3 + perpX, centerY - arrowDy*0.3 + perpY);
            ctx.lineTo(centerX - arrowDx*0.3 - perpX, centerY - arrowDy*0.3 - perpY);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            let frontX = robot.x, frontY = robot.y;
            switch(robot.dir) {
                case 0: frontY--; break;
                case 1: frontX++; break;
                case 2: frontY++; break;
                case 3: frontX--; break;
            }
            if(frontX >= 0 && frontX < GRID_W && frontY >= 0 && frontY < GRID_H) {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#00ff2aff';
                ctx.fillRect(frontX*CELL_SIZE, frontY*CELL_SIZE, CELL_SIZE, CELL_SIZE);
                ctx.globalAlpha = 1;
            }
        }
        
        if(!gameActive && (robot.x < 0 || robot.x >= GRID_W || robot.y < 0 || robot.y >= GRID_H || checkCollisionWithObstacle(robot.x, robot.y))) {
            ctx.font = "bold 24px monospace";
            ctx.fillStyle = "#ff4444";
            ctx.shadowBlur = 8;
            ctx.fillText("Х", GRID_W*CELL_SIZE/2-110, GRID_H*CELL_SIZE/2);
        } else if(candies.length === 0 && score>0 && gameActive) {
            ctx.font = "bold 20px monospace";
            ctx.fillStyle = "#ffd966";
            ctx.shadowBlur = 6;
            let rx = robot.x * CELL_SIZE;
            ctx.fillText("🏆 ПОБЕДА! 🏆", rx-40, robot.y*CELL_SIZE-15);
        }
    }
    
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            this.moveTo(x+r, y);
            this.lineTo(x+w-r, y);
            this.quadraticCurveTo(x+w, y, x+w, y+r);
            this.lineTo(x+w, y+h-r);
            this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
            this.lineTo(x+r, y+h);
            this.quadraticCurveTo(x, y+h, x, y+h-r);
            this.lineTo(x, y+r);
            this.quadraticCurveTo(x, y, x+r, y);
            return this;
        };
    }
    
    // ------------------ UI ПРОГРАММЫ С ПЕРЕТАСКИВАНИЕМ ------------------
    function updateCommandValue(cmd, newValue) {
        if (cmd.type === 'forward' || cmd.type === 'back') {
            cmd.steps = Math.min(Math.max(1, parseInt(newValue) || 1), 50);
        } else if (cmd.type === 'loop') {
            cmd.repeatCount = Math.min(Math.max(1, parseInt(newValue) || 1), 200);
        }
        renderProgram(scriptListEl, program);
    }
    
    function showDropIndicator(element, position) {
        removeDropIndicator();
        
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        indicator.style.height = '3px';
        indicator.style.backgroundColor = '#ffaa44';
        indicator.style.margin = '2px 0';
        indicator.style.borderRadius = '2px';
        indicator.style.boxShadow = '0 0 4px #ffaa44';
        
        if (position === 'before') {
            element.parentNode.insertBefore(indicator, element);
        } else if (position === 'after') {
            if (element.nextSibling) {
                element.parentNode.insertBefore(indicator, element.nextSibling);
            } else {
                element.parentNode.appendChild(indicator);
            }
        }
        
        dropIndicator = indicator;
    }
    
    function removeDropIndicator() {
        if (dropIndicator && dropIndicator.remove) {
            dropIndicator.remove();
            dropIndicator = null;
        }
    }
    
    function findParentCommandsFromElement(element) {
        let current = element;
        while (current) {
            if (current === scriptListEl) {
                return program;
            }
            if (current.tagName === 'LI' && current._cmdRef && current._cmdRef.type === 'loop') {
                return current._cmdRef.children;
            }
            current = current.parentElement;
        }
        return null;
    }
    
    function renderProgram(parentEl, commands, level = 0) {
        parentEl.innerHTML = '';
        if(commands.length === 0) {
            let emptyLi = document.createElement('li');
            emptyLi.style.justifyContent = 'center';
            emptyLi.style.opacity = '0.7';
            emptyLi.style.cursor = 'default';
            emptyLi.style.padding = '12px';
            emptyLi.innerText = '➕ Добавьте команды из блоков (кликните или перетащите)';
            parentEl.appendChild(emptyLi);
            return;
        }
        
        commands.forEach((cmd, idx) => {
            let li = document.createElement('li');
            li._cmdRef = cmd;
            li.setAttribute('draggable', 'true');
            li.style.cursor = 'grab';
            li.style.position = 'relative';
            
            // Drag start - сохраняем данные о перетаскиваемом блоке
            li.addEventListener('dragstart', (e) => {
                if (isExecuting) {
                    e.preventDefault();
                    return;
                }
                dragSourceCmd = cmd;
                dragSourceParent = commands;
                dragSourceIndex = idx;
                // Сохраняем информацию в dataTransfer
                e.dataTransfer.setData('text/plain', JSON.stringify({ 
                    type: 'move', 
                    cmdId: Date.now() + Math.random()
                }));
                e.dataTransfer.effectAllowed = 'move';
                li.style.opacity = '0.5';
            });
            
            li.addEventListener('dragend', (e) => {
                li.style.opacity = '';
                // Не сбрасываем сразу, чтобы drop мог использовать данные
                setTimeout(() => {
                    dragSourceCmd = null;
                    dragSourceParent = null;
                    dragSourceIndex = null;
                }, 200);
                removeDropIndicator();
            });
            
            // Drag over - показываем индикатор вставки
            li.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (isExecuting) return;
                
                const rect = li.getBoundingClientRect();
                const mouseY = e.clientY;
                const middle = rect.top + rect.height / 2;
                const position = mouseY < middle ? 'before' : 'after';
                
                showDropIndicator(li, position);
            });
            
            li.addEventListener('dragleave', (e) => {
                // Проверяем, что уходим именно с этого элемента
                if (!li.contains(e.relatedTarget)) {
                    removeDropIndicator();
                }
            });
            
            // Drop - выполняем перемещение
            li.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeDropIndicator();
                
                if (isExecuting) return;
                
                // Получаем данные из dataTransfer
                const rawData = e.dataTransfer.getData('text/plain');
                if (!rawData) return;
                
                let data;
                try { data = JSON.parse(rawData); } catch(err) { return; }
                
                // Проверяем тип перетаскивания
                if (data.type === 'move') {
                    // Перемещение существующего блока
                    if (!dragSourceCmd) {
                        console.log('Нет dragSourceCmd для перемещения');
                        return;
                    }
                    
                    const rect = li.getBoundingClientRect();
                    const mouseY = e.clientY;
                    const middle = rect.top + rect.height / 2;
                    const position = mouseY < middle ? 'before' : 'after';
                    
                    let targetParentCommands = findParentCommandsFromElement(li);
                    if (!targetParentCommands) return;
                    
                    let targetIndex = targetParentCommands.indexOf(li._cmdRef);
                    if (position === 'after') {
                        targetIndex++;
                    }
                    
                    // Корректируем индекс если перемещаем внутри того же массива
                    if (dragSourceParent === targetParentCommands) {
                        if (dragSourceIndex < targetIndex) {
                            targetIndex--;
                        }
                    }
                    
                    // Проверяем, не пытаемся ли переместить элемент в то же место
                    if (dragSourceParent === targetParentCommands && dragSourceIndex === targetIndex) {
                        return;
                    }
                    
                    // Выполняем перемещение
                    try {
                        const [movedCommand] = dragSourceParent.splice(dragSourceIndex, 1);
                        targetParentCommands.splice(targetIndex, 0, movedCommand);
                        renderProgram(scriptListEl, program);
                    } catch (error) {
                        console.error('Ошибка при перемещении:', error);
                    }
                }
            });
            
            let leftSpan = document.createElement('span');
            leftSpan.style.display = 'flex';
            leftSpan.style.alignItems = 'center';
            leftSpan.style.gap = '8px';
            leftSpan.style.flex = '1';
            
            if(cmd.type === 'forward') {
                leftSpan.innerHTML = `
                    <span>➡️ ВПЕРЕД</span>
                    <input type="number" class="cmd-param-input" value="${cmd.steps}" min="1" max="50" step="1" style="width: 55px; background: #f0e6c5; border: none; border-radius: 20px; padding: 4px 8px; text-align: center; font-weight: bold;">
                    <span>кл.</span>
                `;
                const input = leftSpan.querySelector('.cmd-param-input');
                input.addEventListener('change', (e) => {
                    e.stopPropagation();
                    updateCommandValue(cmd, e.target.value);
                });
                input.addEventListener('click', (e) => e.stopPropagation());
                input.addEventListener('dragstart', (e) => e.stopPropagation());
            }
            else if(cmd.type === 'back') {
                leftSpan.innerHTML = `
                    <span>🔙 НАЗАД</span>
                    <input type="number" class="cmd-param-input" value="${cmd.steps}" min="1" max="50" step="1" style="width: 55px; background: #f0e6c5; border: none; border-radius: 20px; padding: 4px 8px; text-align: center; font-weight: bold;">
                    <span>кл.</span>
                `;
                const input = leftSpan.querySelector('.cmd-param-input');
                input.addEventListener('change', (e) => {
                    e.stopPropagation();
                    updateCommandValue(cmd, e.target.value);
                });
                input.addEventListener('click', (e) => e.stopPropagation());
                input.addEventListener('dragstart', (e) => e.stopPropagation());
            }
            else if(cmd.type === 'right') leftSpan.innerHTML = `↪️ ПОВЕРНУТЬ ВПРАВО 90°`;
            else if(cmd.type === 'left') leftSpan.innerHTML = `↩️ ПОВЕРНУТЬ ВЛЕВО 90°`;
            else if(cmd.type === 'loop') {
                leftSpan.innerHTML = `
                    <span>🔄 ПОВТОРИТЬ</span>
                    <input type="number" class="cmd-param-input" value="${cmd.repeatCount}" min="1" max="200" step="1" style="width: 55px; background: #f0e6c5; border: none; border-radius: 20px; padding: 4px 8px; text-align: center; font-weight: bold;">
                    <span>раз</span>
                `;
                const input = leftSpan.querySelector('.cmd-param-input');
                input.addEventListener('change', (e) => {
                    e.stopPropagation();
                    updateCommandValue(cmd, e.target.value);
                });
                input.addEventListener('click', (e) => e.stopPropagation());
                input.addEventListener('dragstart', (e) => e.stopPropagation());
            }
            
            let delBtn = document.createElement('button');
            delBtn.innerText = '✖';
            delBtn.className = 'del-cmd';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                commands.splice(idx, 1);
                renderProgram(parentEl, commands);
            });
            
            li.appendChild(leftSpan);
            
            if(cmd.type !== 'loop') {
                li.appendChild(delBtn);
            } else {
                let closeSpan = document.createElement('span');
                let loopContainerDiv = document.createElement('div');
                loopContainerDiv.appendChild(closeSpan);
                loopContainerDiv.appendChild(delBtn);
                li.appendChild(loopContainerDiv);
                
                let nestedUl = document.createElement('ul');
                nestedUl.className = 'nested-list';
                nestedUl.style.listStyle = 'none';
                nestedUl.style.paddingLeft = '16px';
                nestedUl.style.width = '100%';
                nestedUl.style.marginTop = '8px';
                
                // Добавляем возможность перетаскивать в цикл
                nestedUl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                });
                
                nestedUl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeDropIndicator();
                    
                    if (isExecuting) return;
                    
                    const raw = e.dataTransfer.getData('text/plain');
                    if (!raw) return;
                    
                    let data;
                    try { data = JSON.parse(raw); } catch(err) { return; }
                    
                    // Проверяем, это перемещение существующего блока или новый блок
                    if (data.type === 'move') {
                        // Перемещение существующего блока в цикл
                        if (dragSourceCmd && dragSourceParent !== null && dragSourceIndex !== null) {
                            const [movedCommand] = dragSourceParent.splice(dragSourceIndex, 1);
                            cmd.children.push(movedCommand);
                            renderProgram(scriptListEl, program);
                        }
                    } else {
                        // Добавление нового блока из библиотеки
                        let newCmd = null;
                        if(data.type === 'forward') newCmd = { type: 'forward', steps: Math.min(parseInt(data.steps)||1,50) };
                        else if(data.type === 'back') newCmd = { type: 'back', steps: Math.min(parseInt(data.steps)||1,50) };
                        else if(data.type === 'right') newCmd = { type: 'right' };
                        else if(data.type === 'left') newCmd = { type: 'left' };
                        else if(data.type === 'loop') newCmd = { type: 'loop', repeatCount: Math.min(parseInt(data.repeat)||2,200), children: [] };
                        if(newCmd) {
                            cmd.children.push(newCmd);
                            renderProgram(scriptListEl, program);
                        }
                    }
                });
                
                renderProgram(nestedUl, cmd.children, level+1);
                li.appendChild(nestedUl);
                li.style.flexWrap = 'wrap';
            }
            
            parentEl.appendChild(li);
        });
    }
    
    function addCommandFromBlock(type, blockElement) {
        if(isExecuting) return;
        
        if(type === 'forward') {
            let stepsInput = blockElement.querySelector('.forward-steps');
            let steps = stepsInput ? parseInt(stepsInput.value) : 1;
            program.push({ type: 'forward', steps: Math.min(steps,50) });
        } 
        else if(type === 'back') {
            let stepsInput = blockElement.querySelector('.back-steps');
            let steps = stepsInput ? parseInt(stepsInput.value) : 1;
            program.push({ type: 'back', steps: Math.min(steps,50) });
        }
        else if(type === 'right') program.push({ type: 'right' });
        else if(type === 'left') program.push({ type: 'left' });
        else if(type === 'loop') {
            let loopInput = blockElement.querySelector('.loop-param');
            let repeat = loopInput ? parseInt(loopInput.value) : 4;
            program.push({ type: 'loop', repeatCount: Math.min(repeat,200), children: [] });
        }
        renderProgram(scriptListEl, program);
    }
    
    function setupDragDropFromBlocks() {
        const blocks = document.querySelectorAll('.command-block');
        blocks.forEach(block => {
            block.setAttribute('draggable', 'true');
            block.addEventListener('dragstart', (e) => {
                const type = block.getAttribute('data-type');
                let stepsVal = null, repeatVal = null;
                if(type === 'forward') stepsVal = block.querySelector('.forward-steps')?.value;
                if(type === 'back') stepsVal = block.querySelector('.back-steps')?.value;
                if(type === 'loop') repeatVal = block.querySelector('.loop-param')?.value;
                e.dataTransfer.setData('text/plain', JSON.stringify({ type, steps: stepsVal, repeat: repeatVal }));
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
        
        scriptListEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        
        scriptListEl.addEventListener('drop', (e) => {
            e.preventDefault();
            removeDropIndicator();
            if (isExecuting) return;
            
            const raw = e.dataTransfer.getData('text/plain');
            if(!raw) return;
            let data;
            try { data = JSON.parse(raw); } catch(err) { return; }
            
            // Определяем позицию вставки
            const rect = scriptListEl.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            const items = Array.from(scriptListEl.children).filter(li => li.tagName === 'LI');
            
            let insertIndex = items.length;
            for (let i = 0; i < items.length; i++) {
                const itemRect = items[i].getBoundingClientRect();
                const itemMiddle = itemRect.top + itemRect.height / 2;
                if (mouseY < itemMiddle - rect.top) {
                    insertIndex = i;
                    break;
                }
            }
            
            let newCmd = null;
            if(data.type === 'forward') newCmd = { type: 'forward', steps: Math.min(parseInt(data.steps)||1,50) };
            else if(data.type === 'back') newCmd = { type: 'back', steps: Math.min(parseInt(data.steps)||1,50) };
            else if(data.type === 'right') newCmd = { type: 'right' };
            else if(data.type === 'left') newCmd = { type: 'left' };
            else if(data.type === 'loop') newCmd = { type: 'loop', repeatCount: Math.min(parseInt(data.repeat)||2,200), children: [] };
            
            if(newCmd) {
                program.splice(insertIndex, 0, newCmd);
                renderProgram(scriptListEl, program);
            }
        });
    }
    
    function clearProgram() {
        if(isExecuting) stopExecution();
        program = [];
        renderProgram(scriptListEl, program);
    }
    
    function bindBlockClicks() {
        document.querySelectorAll('.command-block').forEach(block => {
            block.removeEventListener('click', blockClickHandler);
            block.addEventListener('click', blockClickHandler);
        });
    }
    
    function blockClickHandler(e) {
        if(e.target.tagName === 'INPUT') return;
        let targetBlock = e.currentTarget;
        let type = targetBlock.getAttribute('data-type');
        addCommandFromBlock(type, targetBlock);
    }
    
    function init() {
        const generated = generateWorld(25, 10);
        candies = generated.candies;
        obstacles = generated.obstacles;
        saveLevelState();
        robot = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2), dir: 0 };
        score = 0;
        gameActive = true;
        updateUI();
        drawGame();
        renderProgram(scriptListEl, program);
        bindBlockClicks();
        setupDragDropFromBlocks();
        runBtn.addEventListener('click', startExecution);
        clearBtn.addEventListener('click', clearProgram);
        applyBtn.addEventListener('click', () => {
            if(isExecuting) stopExecution();
            applySettings();
        });
    }
    init();