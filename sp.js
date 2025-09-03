
        const state = {
            nodes: {
                root: {
                    id: 'root',
                    text: '中心主题',
                    color: '#3B82F6',
                    x: 1000,
                    y: 1000,
                    parent: null,
                    children: {
                        top: [],
                        bottom: [],
                        left: [],
                        right: []
                    },
                    collapsed: false
                }
            },
            activeNodeId: 'root',
            nextNodeId: 1,
            scale: 1,
            history: [],
            historyIndex: -1,
            isDragging: false,
            draggedNode: null,
            isCanvasDragging: false,
            canvasOffset: { x: 0, y: 0 },
            dragStart: { x: 0, y: 0 },
            editingNodeId: null, // 新增：跟踪当前正在编辑的节点ID
            exportSettings: {
                watermarkText: '',
                watermarkOpacity: 6
            }
        };

        // DOM 元素引用
        const elements = {
            nodesContainer: document.getElementById('nodes-container'),
            connections: document.getElementById('connections'),
            canvas: document.getElementById('canvas'),
            mindmapContainer: document.getElementById('mindmap-container'),
            deleteNodeBtn: document.getElementById('delete-node'),
            toggleCollapseBtn: document.getElementById('toggle-collapse'),
            exportBtn: document.getElementById('export-btn'),
            undoBtn: document.getElementById('undo-btn'),
            redoBtn: document.getElementById('redo-btn'),
            clearBtn: document.getElementById('clear-btn'),
            zoomInBtn: document.getElementById('zoom-in'),
            zoomOutBtn: document.getElementById('zoom-out'),
            zoomLevel: document.getElementById('zoom-level'),
            statusInfo: document.getElementById('status-info'),
            themeToggle: document.getElementById('theme-toggle'),
            colorPickers: document.querySelectorAll('.color-picker'),
            watermarkText: document.getElementById('watermark-text'),
            watermarkOpacity: document.getElementById('watermark-opacity'),
            opacityValue: document.getElementById('opacity-value'),
            watermarkPreview: document.getElementById('watermark-preview'),
            watermarkTextPreview: document.getElementById('watermark-text-preview')
        };

        // let longPressTimer = null; // 不再需要

        // 初始化函数
        function init() {
            Object.keys(elements).forEach(key => {
                if (!elements[key] && key !== 'colorPickers') {
                    console.warn(`元素 ${key} 未找到`);
                }
            });
            
            saveStateToHistory();
            renderAll();
            bindEvents();
            
            if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            updateExportSettingsDisplay();
            updateWatermarkPreview();
            updateCanvasPosition();
        }

        // 渲染所有节点和连接线
        function renderAll() {
            renderNodes();
            renderConnections();
            updateStatus();
            updateCollapseButtonState();
            updateHistoryButtons();
        }

        // Update canvas position based on state
        function updateCanvasPosition() {
            elements.canvas.style.top = `${state.canvasOffset.y}px`;
            elements.canvas.style.left = `${state.canvasOffset.x}px`;
        }

        // 渲染节点
        function renderNodes() {
            if (!elements.nodesContainer) return;
            elements.nodesContainer.innerHTML = '';
            
            function renderNode(nodeId, parentCollapsed = false) {
                const node = state.nodes[nodeId];
                if (!node) return;
                
                const isVisible = !parentCollapsed;
                const nodeElement = document.createElement('div');
                nodeElement.className = `node absolute node-transition p-3 rounded-lg shadow-md cursor-move select-none ${node.id === state.activeNodeId ? 'node-active' : ''}`;
                nodeElement.style.top = `${node.y}px`;
                nodeElement.style.left = `${node.x}px`;
                nodeElement.style.transform = 'translate(-50%, -50%)';
                nodeElement.style.backgroundColor = node.color;
                nodeElement.style.color = getContrastColor(node.color);
                nodeElement.style.minWidth = '120px';
                nodeElement.style.display = isVisible ? 'block' : 'none';
                nodeElement.dataset.id = node.id;
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'node-content node-content-editable text-center';
                contentDiv.textContent = node.text;
                contentDiv.contentEditable = "false";
                nodeElement.appendChild(contentDiv);
                
                const hasChildren = Object.values(node.children).some(direction => direction.length > 0);
                if (hasChildren) {
                    
                }
                
                elements.nodesContainer.appendChild(nodeElement);
                bindNodeEvents(nodeElement);
                
                if (node.collapsed && hasChildren && isVisible) {
                    const indicator = document.createElement('div');
                    indicator.className = 'collapsed-indicator bg-gray-400 text-white';
                    indicator.style.top = `${node.y}px`;
                    indicator.style.left = `${node.x}px`;
                    indicator.style.transform = 'translate(-50%, -50%)';
                    
                    let indicatorX = node.x;
                    let indicatorY = node.y;
                    
                    if (node.children.top.length > 0) indicatorY -= 10;
                    else if (node.children.bottom.length > 0) indicatorY += 10;
                    else if (node.children.left.length > 0) indicatorX -= 10;
                    else if (node.children.right.length > 0) indicatorX += 10;
                    
                    indicator.style.left = `${indicatorX}px`;
                    indicator.style.top = `${indicatorY}px`;
                    indicator.innerHTML = '+';
                    
                    indicator.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleNodeCollapse(nodeId);
                    });
                    
                    elements.nodesContainer.appendChild(indicator);
                }
                
                if (!node.collapsed) {
                    Object.values(node.children).forEach(direction => {
                        direction.forEach(childId => {
                            renderNode(childId, parentCollapsed || node.collapsed);
                        });
                    });
                }
            }
            
            renderNode('root');
        }

        // 渲染连接线
        function renderConnections() {
            if (!elements.connections) return;
            elements.connections.innerHTML = '';
            
            const svgNS = "http://www.w3.org/2000/svg";
            
            function drawConnections(nodeId, parentCollapsed = false) {
                const node = state.nodes[nodeId];
                if (!node) return;
                
                if (parentCollapsed) return;
                
                if (!node.collapsed) {
                    Object.entries(node.children).forEach(([direction, childIds]) => {
                        childIds.forEach(childId => {
                            const child = state.nodes[childId];
                            if (!child) return;
                            
                            const line = document.createElementNS(svgNS, "line");
                            line.setAttribute("class", "connection-line");
                            
                            let startX, startY, endX, endY;
                            
                            switch(direction) {
                                case 'top':
                                    startX = node.x;
                                    startY = node.y - 20;
                                    endX = child.x;
                                    endY = child.y + 20;
                                    break;
                                case 'bottom':
                                    startX = node.x;
                                    startY = node.y + 20;
                                    endX = child.x;
                                    endY = child.y - 20;
                                    break;
                                case 'left':
                                    startX = node.x - 60;
                                    startY = node.y;
                                    endX = child.x + 60;
                                    endY = child.y;
                                    break;
                                case 'right':
                                    startX = node.x + 60;
                                    startY = node.y;
                                    endX = child.x - 60;
                                    endY = child.y;
                                    break;
                            }
                            
                            line.setAttribute("x1", startX);
                            line.setAttribute("y1", startY);
                            line.setAttribute("x2", endX);
                            line.setAttribute("y2", endY);
                            
                            elements.connections.appendChild(line);
                            drawConnections(childId, node.collapsed);
                        });
                    });
                }
            }
            
            drawConnections('root');
        }

        function updateCollapseButtonState() {
            if (!elements.toggleCollapseBtn) return;
            
            if (!state.activeNodeId) {
                elements.toggleCollapseBtn.disabled = true;
                elements.toggleCollapseBtn.classList.add('opacity-50');
                return;
            }
            
            const node = state.nodes[state.activeNodeId];
            if (!node) {
                elements.toggleCollapseBtn.disabled = true;
                elements.toggleCollapseBtn.classList.add('opacity-50');
                return;
            }
            
            const hasChildren = Object.values(node.children).some(direction => direction.length > 0);
            elements.toggleCollapseBtn.disabled = !hasChildren;
            elements.toggleCollapseBtn.classList.toggle('opacity-50', !hasChildren);
            
            const iconElement = elements.toggleCollapseBtn.querySelector('i');
            if (iconElement) {
                if (node.collapsed) {
                    iconElement.className = 'fa fa-expand text-primary mr-2';
                } else {
                    iconElement.className = 'fa fa-compress text-primary mr-2';
                }
            }
        }

        function toggleNodeCollapse(nodeId) {
            const node = state.nodes[nodeId];
            if (!node) return;
            
            const hasChildren = Object.values(node.children).some(direction => direction.length > 0);
            if (!hasChildren) return;
            
            node.collapsed = !node.collapsed;
            saveStateToHistory();
            renderAll();
        }

        function addChildNode(direction) {
            if (!state.activeNodeId) return;
            const parentNode = state.nodes[state.activeNodeId];
            if (!parentNode) return;
            if (parentNode.children[direction].length > 0) return;
            
            let x = parentNode.x;
            let y = parentNode.y;
            const offset = 200;
            
            switch(direction) {
                case 'top':
                    y -= offset;
                    break;
                case 'bottom':
                    y += offset;
                    break;
                case 'left':
                    x -= offset;
                    break;
                case 'right':
                    x += offset;
                    break;
            }
            
            const nodeId = `node-${state.nextNodeId++}`;
            const newNode = {
                id: nodeId,
                text: `新节点`,
                color: '#10B981',
                x: x,
                y: y,
                parent: parentNode.id,
                children: {
                    top: [],
                    bottom: [],
                    left: [],
                    right: []
                },
                collapsed: false
            };
            
            state.nodes[nodeId] = newNode;
            parentNode.children[direction].push(nodeId);
            
            if (parentNode.collapsed) {
                parentNode.collapsed = false;
            }
            
            state.activeNodeId = nodeId;
            saveStateToHistory();
            renderAll();
        }

        function deleteNode() {
            if (!state.activeNodeId || state.activeNodeId === 'root') return;
            const nodeId = state.activeNodeId;
            const node = state.nodes[nodeId];
            if (!node || !node.parent) return;
            
            function deleteChildNodes(currentNodeId) {
                const currentNode = state.nodes[currentNodeId];
                if (!currentNode) return;
                
                Object.values(currentNode.children).forEach(direction => {
                    direction.forEach(childId => {
                        deleteChildNodes(childId);
                    });
                });
                
                delete state.nodes[currentNodeId];
            }
            
            deleteChildNodes(nodeId);
            
            const parentNode = state.nodes[node.parent];
            Object.entries(parentNode.children).forEach(([direction, childIds]) => {
                const index = childIds.indexOf(nodeId);
                if (index !== -1) {
                    parentNode.children[direction].splice(index, 1);
                }
            });
            
            state.activeNodeId = node.parent;
            saveStateToHistory();
            renderAll();
        }

        // 修复：新的文本更新函数，更可靠地保存文本
        function updateNodeText(nodeId, newText) {
            const node = state.nodes[nodeId];
            if (!node) return;
            
            const trimmedText = newText ? newText.trim() : '';
            if (trimmedText === '') {
                // 如果文本为空，则恢复为默认文本
                const defaultText = '新节点';
                if (node.text !== defaultText) {
                    node.text = defaultText;
                    saveStateToHistory();
                    renderAll();
                }
            } else if (trimmedText !== node.text) {
                node.text = trimmedText;
                saveStateToHistory();
                renderAll();
            }
        }

        function changeNodeColor(color) {
            if (!state.activeNodeId) return;
            const node = state.nodes[state.activeNodeId];
            if (!node) return;
            node.color = color;
            saveStateToHistory();
            renderAll();
        }

        function updateExportSettingsDisplay() {
            if (!elements.watermarkText || !elements.watermarkOpacity || !elements.opacityValue) return;
            elements.watermarkText.value = state.exportSettings.watermarkText;
            elements.watermarkOpacity.value = state.exportSettings.watermarkOpacity;
            elements.opacityValue.textContent = `${state.exportSettings.watermarkOpacity}%`;
        }

        function updateWatermarkPreview() {
            const watermarkText = state.exportSettings.watermarkText.trim();
            const opacity = state.exportSettings.watermarkOpacity / 100;
            const container = document.body;
            
            if (watermarkText) {
                const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewbox="0 0 300 200"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="rgba(0,0,0,${opacity})" transform="rotate(-30 150 100)">${watermarkText}</text></svg>`;
                const encodedSvg = encodeURIComponent(svgContent);
                container.style.backgroundImage = `url("data:image/svg+xml,${encodedSvg}")`;
                container.style.backgroundRepeat = 'repeat';
                container.style.backgroundPosition = 'center';
            } else {
                container.style.backgroundImage = 'none';
            }
        }

        function exportAsImage() {
            if (!elements.canvas || !elements.mindmapContainer) return;
            const collapseStates = {};
            Object.keys(state.nodes).forEach(nodeId => {
                collapseStates[nodeId] = state.nodes[nodeId].collapsed;
                state.nodes[nodeId].collapsed = false;
            });
            renderAll();
            
            const exportContainer = document.createElement('div');
            exportContainer.style.position = 'absolute';
            exportContainer.style.top = '-9999px';
            exportContainer.style.left = '-9999px';
            exportContainer.style.width = elements.canvas.offsetWidth + 'px';
            exportContainer.style.height = elements.canvas.offsetHeight + 'px';
            exportContainer.style.backgroundColor = 'white';
            
            // Add watermark to the export container
            const watermarkText = state.exportSettings.watermarkText.trim();
            if (watermarkText) {
                const opacity = state.exportSettings.watermarkOpacity / 100;
                const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewbox="0 0 300 200"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="rgba(0,0,0,${opacity})" transform="rotate(-30 150 100)">${watermarkText}</text></svg>`;
                const encodedSvg = encodeURIComponent(svgContent);
                exportContainer.style.backgroundImage = `url("data:image/svg+xml,${encodedSvg}")`;
                exportContainer.style.backgroundRepeat = 'repeat';
            }

            const canvasClone = elements.canvas.cloneNode(true);
            canvasClone.style.position = 'static';
            canvasClone.style.transform = `scale(${state.scale})`;
            canvasClone.style.transformOrigin = 'center';
            
            exportContainer.appendChild(canvasClone);
            
            document.body.appendChild(exportContainer);
            
            html2canvas(exportContainer, {
                scale: 2,
                backgroundColor: null,
                useCORS: true
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'mindmap.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                Object.keys(state.nodes).forEach(nodeId => {
                    state.nodes[nodeId].collapsed = collapseStates[nodeId];
                });
                renderAll();
                document.body.removeChild(exportContainer);
            }).catch(error => {
                console.error("导出图片失败: ", error);
                Object.keys(state.nodes).forEach(nodeId => {
                    state.nodes[nodeId].collapsed = collapseStates[nodeId];
                });
                renderAll();
                document.body.removeChild(exportContainer);
            });
        }

        function saveStateToHistory() {
            state.history.splice(state.historyIndex + 1);
            const clonedState = JSON.parse(JSON.stringify(state));
            state.history.push(clonedState);
            state.historyIndex = state.history.length - 1;
            updateHistoryButtons();
        }

        function undo() {
            if (state.historyIndex > 0) {
                state.historyIndex--;
                const previousState = state.history[state.historyIndex];
                state.nodes = JSON.parse(JSON.stringify(previousState.nodes));
                state.activeNodeId = previousState.activeNodeId;
                state.nextNodeId = previousState.nextNodeId;
                state.canvasOffset = previousState.canvasOffset;
                renderAll();
                updateCanvasPosition();
            }
        }

        function redo() {
            if (state.historyIndex < state.history.length - 1) {
                state.historyIndex++;
                const nextState = state.history[state.historyIndex];
                state.nodes = JSON.parse(JSON.stringify(nextState.nodes));
                state.activeNodeId = nextState.activeNodeId;
                state.nextNodeId = nextState.nextNodeId;
                state.canvasOffset = nextState.canvasOffset;
                renderAll();
                updateCanvasPosition();
            }
        }

        function updateHistoryButtons() {
            if (!elements.undoBtn || !elements.redoBtn) return;
            elements.undoBtn.disabled = state.historyIndex <= 0;
            elements.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
        }

        function getContrastColor(hexColor) {
            const hex = hexColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 128 ? '#000000' : '#FFFFFF';
        }

        let addNodeTimeout;
        const addNodeIndicators = {};

        function createAddNodeIndicator(nodeElement, direction) {
            const indicator = document.createElement('div');
            indicator.className = `add-node-indicator`;
            const iconClass = {
                'top': 'fa fa-arrow-up',
                'bottom': 'fa fa-arrow-down',
                'left': 'fa fa-arrow-left',
                'right': 'fa fa-arrow-right'
            };
            indicator.innerHTML = `<i class="${iconClass[direction]}"></i>`;

            const nodeRect = nodeElement.getBoundingClientRect();
            const containerRect = elements.nodesContainer.getBoundingClientRect();
            let x, y;

            switch (direction) {
                case 'top':
                    x = nodeRect.x + nodeRect.width / 2 - containerRect.x;
                    y = nodeRect.y - 30 - containerRect.y;
                    break;
                case 'bottom':
                    x = nodeRect.x + nodeRect.width / 2 - containerRect.x;
                    y = nodeRect.y + nodeRect.height + 30 - containerRect.y;
                    break;
                case 'left':
                    x = nodeRect.x - 30 - containerRect.x;
                    y = nodeRect.y + nodeRect.height / 2 - containerRect.y;
                    break;
                case 'right':
                    x = nodeRect.x + nodeRect.width + 30 - containerRect.x;
                    y = nodeRect.y + nodeRect.height / 2 - containerRect.y;
                    break;
            }

            indicator.style.top = `${y}px`;
            indicator.style.left = `${x}px`;
            indicator.style.transform = 'translate(-50%, -50%)';
            indicator.style.pointerEvents = 'auto';
            indicator.style.opacity = '0';
            indicator.style.visibility = 'hidden';

            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                setActiveNode(nodeElement.dataset.id);
                addChildNode(direction);
            });

            indicator.addEventListener('mouseenter', () => {
                clearTimeout(addNodeTimeout);
                indicator.style.opacity = '1';
                indicator.style.visibility = 'visible';
            });
            indicator.addEventListener('mouseleave', () => {
                addNodeTimeout = setTimeout(() => {
                    hideAddNodeIndicators();
                }, 200);
            });

            elements.nodesContainer.appendChild(indicator);
            return indicator;
        }

        function showAddNodeIndicators(nodeElement) {
            hideAddNodeIndicators();
            const nodeId = nodeElement.dataset.id;
            const node = state.nodes[nodeId];
            if (!node) return;

            const directions = ['top', 'bottom', 'left', 'right'];
            directions.forEach(direction => {
                if (node.children[direction].length === 0) {
                    const indicator = createAddNodeIndicator(nodeElement, direction);
                    addNodeIndicators[direction] = indicator;
                    
                    setTimeout(() => {
                        if (indicator) {
                            indicator.style.opacity = '1';
                            indicator.style.visibility = 'visible';
                        }
                    }, 50);
                }
            });
        }

        function hideAddNodeIndicators() {
            Object.values(addNodeIndicators).forEach(indicator => {
                if (indicator && elements.nodesContainer.contains(indicator)) {
                    indicator.style.opacity = '0';
                    indicator.style.visibility = 'hidden';
                    setTimeout(() => {
                        if (indicator && elements.nodesContainer.contains(indicator)) {
                            elements.nodesContainer.removeChild(indicator);
                        }
                    }, 300);
                }
            });
        }

        // 触发编辑状态的逻辑
        function startNodeEditing(nodeId) {
            const nodeElement = document.querySelector(`[data-id="${nodeId}"]`);
            if (!nodeElement) return;

            const contentDiv = nodeElement.querySelector('.node-content');
            if (contentDiv && !state.editingNodeId) {
                state.editingNodeId = nodeId;
                contentDiv.contentEditable = "true";
                contentDiv.focus();
                selectText(contentDiv);
            }
        }

        // 修复：修改 bindNodeEvents，使其更可靠地处理文本编辑
        function bindNodeEvents(nodeElement) {
            const nodeId = nodeElement.dataset.id;
            const node = state.nodes[nodeId];
            if (!node) return;

            nodeElement.addEventListener('mouseenter', (e) => {
                clearTimeout(addNodeTimeout);
                if (!state.isDragging) {
                    showAddNodeIndicators(nodeElement);
                }
            });

            nodeElement.addEventListener('mouseleave', (e) => {
                addNodeTimeout = setTimeout(() => {
                    hideAddNodeIndicators();
                }, 200);
            });

            nodeElement.addEventListener('mousedown', (e) => {
                // 阻止事件冒泡到 mindmapContainer，防止拖拽节点时触发画布拖拽
                e.stopPropagation();
                setActiveNode(nodeId);
                
                // 开始拖拽
                state.isDragging = true;
                state.draggedNode = node;
                state.dragOffset = { x: e.clientX - node.x, y: e.clientY - node.y };
                nodeElement.style.cursor = 'grabbing';
            });
            
            nodeElement.addEventListener('mouseup', (e) => {
                // 拖拽结束时
            });
            
            nodeElement.addEventListener('mouseleave', (e) => {
                 // 鼠标离开节点区域
            });

            const contentDiv = nodeElement.querySelector('.node-content');
            if (contentDiv) {
                // 修复：当失去焦点时，保存文本
                contentDiv.addEventListener('blur', (e) => {
                    if (state.editingNodeId === nodeId) {
                        const newText = e.target.textContent;
                        updateNodeText(nodeId, newText);
                        e.target.contentEditable = "false";
                        state.editingNodeId = null;
                    }
                });
                
                // 修复：当按下回车键时，保存文本
                contentDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        e.target.blur();
                    }
                });
            }
        }

        function setActiveNode(nodeId) {
            if (state.activeNodeId) {
                const oldActive = document.querySelector(`[data-id="${state.activeNodeId}"]`);
                if (oldActive) oldActive.classList.remove('node-active');
            }
            state.activeNodeId = nodeId;
            if (nodeId) {
                const newActive = document.querySelector(`[data-id="${nodeId}"]`);
                if (newActive) newActive.classList.add('node-active');
            }
            updateStatus();
            updateCollapseButtonState();
        }

        function updateStatus() {
            if (!elements.statusInfo) return;
            const activeNode = state.nodes[state.activeNodeId];
            if (activeNode) {
                elements.statusInfo.textContent = `当前节点: ${activeNode.text}`;
                elements.deleteNodeBtn.disabled = state.activeNodeId === 'root';
                elements.deleteNodeBtn.classList.toggle('opacity-50', state.activeNodeId === 'root');
            } else {
                elements.statusInfo.textContent = '未选择节点';
                elements.deleteNodeBtn.disabled = true;
                elements.deleteNodeBtn.classList.add('opacity-50');
            }
        }

        function selectText(element) {
            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // 修复：修改 bindEvents，增加全局点击事件处理
        function bindEvents() {
            elements.mindmapContainer.addEventListener('mousedown', (e) => {
                if (e.target.closest('.node')) {
                    if (!e.target.closest('.node-content-editable[contenteditable="true"]')) {
                        // 如果点击的是节点，但不是正在编辑的文本，则开始拖拽
                        e.stopPropagation();
                        const nodeElement = e.target.closest('.node');
                        const nodeId = nodeElement.dataset.id;
                        setActiveNode(nodeId);
                        state.isDragging = true;
                        state.draggedNode = state.nodes[nodeId];
                        state.dragOffset = { x: e.clientX - state.draggedNode.x, y: e.clientY - state.draggedNode.y };
                        nodeElement.style.cursor = 'grabbing';
                    }
                    return;
                }
                
                // 如果当前有节点在编辑，点击其他地方则保存
                if (state.editingNodeId) {
                    const editingNodeElement = document.querySelector(`[data-id="${state.editingNodeId}"] .node-content`);
                    if (editingNodeElement) {
                        editingNodeElement.blur(); // 强制失去焦点，触发保存
                    }
                }
                
                state.isCanvasDragging = true;
                state.dragStart.x = e.clientX;
                state.dragStart.y = e.clientY;
                elements.mindmapContainer.style.cursor = 'grabbing';
            });
            
            elements.mindmapContainer.addEventListener('mousemove', (e) => {
                if (state.isDragging && state.draggedNode) {
                    e.preventDefault();
                    state.draggedNode.x = e.clientX - state.dragOffset.x;
                    state.draggedNode.y = e.clientY - state.dragOffset.y;
                    renderAll();
                } else if (state.isCanvasDragging) {
                    const dx = e.clientX - state.dragStart.x;
                    const dy = e.clientY - state.dragStart.y;
                    
                    state.canvasOffset.x += dx;
                    state.canvasOffset.y += dy;
                    state.dragStart.x = e.clientX;
                    state.dragStart.y = e.clientY;
                    
                    updateCanvasPosition();
                }
            });

            elements.mindmapContainer.addEventListener('mouseup', () => {
                if (state.isDragging && state.draggedNode) {
                    state.isDragging = false;
                    state.draggedNode = null;
                    const nodeElement = document.querySelector(`[data-id="${state.activeNodeId}"]`);
                    if (nodeElement) nodeElement.style.cursor = 'move';
                    saveStateToHistory();
                    renderAll();
                } else if (state.isCanvasDragging) {
                    state.isCanvasDragging = false;
                    elements.mindmapContainer.style.cursor = 'default';
                }
            });

            // 非节点区域点击事件
            elements.mindmapContainer.addEventListener('click', (e) => {
                if (!e.target.closest('.node')) {
                     setActiveNode(null);
                }
            });

            // 阻止编辑时冒泡
            elements.nodesContainer.addEventListener('mousedown', (e) => {
                const contentDiv = e.target.closest('.node-content-editable');
                if (contentDiv && contentDiv.contentEditable === "true") {
                    e.stopPropagation();
                }
            });

            // 新增：全局回车键事件
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    // 当有节点被选中且没有正在编辑时
                    if (state.activeNodeId && !state.editingNodeId) {
                        e.preventDefault();
                        startNodeEditing(state.activeNodeId);
                    }
                } else if (e.key === ' ' && state.activeNodeId) {
                    e.preventDefault();
                    toggleNodeCollapse(state.activeNodeId);
                }
            });
            
            elements.deleteNodeBtn.addEventListener('click', () => {
                deleteNode();
            });

            elements.toggleCollapseBtn.addEventListener('click', () => {
                if (state.activeNodeId) {
                    toggleNodeCollapse(state.activeNodeId);
                }
            });
            
            elements.colorPickers.forEach(button => {
                button.addEventListener('click', () => {
                    changeNodeColor(button.dataset.color);
                });
            });

            elements.undoBtn.addEventListener('click', undo);
            elements.redoBtn.addEventListener('click', redo);

            elements.clearBtn.addEventListener('click', () => {
                if (confirm('确定要清空画布吗？所有数据将丢失。')) {
                    state.nodes = {
                        root: {
                            id: 'root',
                            text: '中心主题',
                            color: '#3B82F6',
                            x: 1000,
                            y: 1000,
                            parent: null,
                            children: { top: [], bottom: [], left: [], right: [] },
                            collapsed: false
                        }
                    };
                    state.activeNodeId = 'root';
                    state.nextNodeId = 1;
                    state.history = [];
                    state.historyIndex = -1;
                    saveStateToHistory();
                    renderAll();
                }
            });
            
            elements.exportBtn.addEventListener('click', exportAsImage);

            elements.watermarkText.addEventListener('input', (e) => {
                state.exportSettings.watermarkText = e.target.value;
                updateWatermarkPreview();
            });
            elements.watermarkOpacity.addEventListener('input', (e) => {
                state.exportSettings.watermarkOpacity = parseInt(e.target.value);
                elements.opacityValue.textContent = `${e.target.value}%`;
                updateWatermarkPreview();
            });

            elements.themeToggle.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.theme = isDark ? 'dark' : 'light';
            });
        }

        document.addEventListener('DOMContentLoaded', init);
