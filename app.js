// Global application state
let data = {
    scenes: {},
    startSceneId: null,
    storyMetadata: {
        title: 'My Interactive Story',
        description: 'An educational branching narrative',
        subject: 'General',
        difficulty: 'Beginner',
        learningObjectives: [],
        tags: []
    }
};

let selectedSceneId = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Educational features state
let readingTime = 0;
let choiceStats = new Map();
let sessionStartTime = Date.now();

// DOM elements
let board, inspector, connectorsSvg;
let sceneElements = new Map();

// Initialize application
function initApp() {
    // Get DOM references
    board = document.getElementById('board');
    inspector = document.getElementById('inspector');
    connectorsSvg = document.getElementById('connectors');
    
    // Setup event listeners
    setupEventListeners();
    
    // Load data from localStorage or create sample story
    loadFromLocal();
    
    // Render initial state
    renderAll();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
}

// Generate unique IDs
function makeId(prefix = 's') {
    return prefix + '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Setup event listeners
function setupEventListeners() {
    // Toolbar buttons
    document.getElementById('newSceneBtn').addEventListener('click', () => {
        addScene(Math.random() * 800 + 100, Math.random() * 600 + 100);
    });
    
    document.getElementById('previewBtn').addEventListener('click', openPreview);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
    document.getElementById('importJsonBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    document.getElementById('exportHtmlBtn').addEventListener('click', exportPlayableHTML);
    
    // Sample stories dropdown
    document.getElementById('samplesSelect').addEventListener('change', (e) => {
        const storyKey = e.target.value;
        if (storyKey) {
            loadSampleStory(storyKey);
            e.target.value = ''; // Reset dropdown
        }
    });
    
    // Share scene button
    document.getElementById('shareSceneBtn').addEventListener('click', () => {
        if (selectedSceneId) {
            shareScene(selectedSceneId);
        }
    });
    
    document.getElementById('storySettingsBtn').addEventListener('click', openStorySettings);
    document.getElementById('analyticsBtn').addEventListener('click', openAnalytics);
    
    // Inspector form
    document.getElementById('sceneTitle').addEventListener('input', updateSceneTitle);
    document.getElementById('sceneText').addEventListener('input', updateSceneText);
    document.getElementById('sceneCategory').addEventListener('change', updateSceneCategory);
    document.getElementById('sceneNotes').addEventListener('input', updateSceneNotes);
    document.getElementById('readTime').addEventListener('input', updateReadTime);
    document.getElementById('addChoiceBtn').addEventListener('click', addChoice);
    document.getElementById('deleteSceneBtn').addEventListener('click', deleteScene);
    document.getElementById('addHintBtn').addEventListener('click', addHint);
    
    // Image controls
    document.querySelectorAll('input[name="imageType"]').forEach(radio => {
        radio.addEventListener('change', switchImageType);
    });
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    document.getElementById('searchUnsplashBtn').addEventListener('click', searchUnsplash);
    document.getElementById('emojiInput').addEventListener('input', updateEmojiPreview);
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', (e) => selectEmoji(e.target.dataset.emoji));
    });
    
    // Modal controls
    document.getElementById('closeSettingsBtn').addEventListener('click', closeStorySettings);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveStorySettings);
    document.getElementById('closeAnalyticsBtn').addEventListener('click', closeAnalytics);
    
    // File input for import
    document.getElementById('fileInput').addEventListener('change', importJSON);
    
    // Preview overlay
    document.getElementById('closePreviewBtn').addEventListener('click', closePreview);
    
    // Board click (deselect)
    board.addEventListener('click', (e) => {
        if (e.target === board) {
            selectScene(null);
        }
    });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.code) {
            case 'KeyN':
                e.preventDefault();
                addScene(Math.random() * 800 + 100, Math.random() * 600 + 100);
                break;
            case 'Space':
                e.preventDefault();
                openPreview();
                break;
            case 'Delete':
            case 'Backspace':
                if (selectedSceneId) {
                    e.preventDefault();
                    deleteScene();
                }
                break;
        }
    });
}

// Add new scene
function addScene(x, y) {
    const id = makeId('scene');
    const scene = {
        id,
        title: 'New Scene',
        text: 'Enter your scene description here...',
        x: Math.max(0, Math.min(x, 1800)),
        y: Math.max(0, Math.min(y, 1300)),
        choices: [],
        image: null,
        imageType: 'upload', // 'upload', 'unsplash', 'emoji'
        backgroundColor: '#ffffff',
        textColor: '#333333',
        category: 'story', // 'story', 'question', 'info', 'decision'
        hints: [],
        notes: '',
        estimatedReadTime: 1
    };
    
    data.scenes[id] = scene;
    
    // Set as start scene if it's the first one
    if (!data.startSceneId) {
        data.startSceneId = id;
    }
    
    renderScene(scene);
    selectScene(id);
    saveToLocal();
}

// Render all scenes
function renderAll() {
    // Clear board
    if (board) {
        const sceneElements = board.querySelectorAll('.scene');
        sceneElements.forEach(el => el.remove());
    }
    
    // Render all scenes
    Object.values(data.scenes).forEach(scene => {
        renderScene(scene);
    });
    
    // Render connectors
    renderConnectors();
}

// Render individual scene
function renderScene(scene) {
    // Remove existing element if any
    const existingElement = document.querySelector(`[data-scene-id="${scene.id}"]`);
    if (existingElement) {
        existingElement.remove();
    }
    
    // Create scene element
    const sceneEl = document.createElement('div');
    sceneEl.className = 'scene';
    sceneEl.setAttribute('data-scene-id', scene.id);
    sceneEl.style.left = scene.x + 'px';
    sceneEl.style.top = scene.y + 'px';
    
    // Add new animation class
    sceneEl.classList.add('new');
    setTimeout(() => sceneEl.classList.remove('new'), 300);
    
    // Create image content
    let imageContent = '';
    if (scene.image) {
        if (scene.imageType === 'emoji') {
            imageContent = `<div class="scene-emoji">${scene.image}</div>`;
        } else {
            imageContent = `<img src="${scene.image}" class="scene-image" alt="Scene image">`;
        }
    }
    
    // Scene category badge
    const categoryLabel = scene.category === 'story' ? '' : 
        `<div class="scene-category ${scene.category}">${scene.category}</div>`;
    
    // Scene content
    sceneEl.innerHTML = `
        ${categoryLabel}
        ${imageContent}
        <div class="scene-title">${escapeHtml(scene.title)}</div>
        <div class="scene-text">${escapeHtml(scene.text)}</div>
        <div class="scene-meta">
            <div class="choice-count">
                <i data-feather="git-branch"></i>
                <span>${scene.choices.length} choices</span>
            </div>
            ${scene.hints && scene.hints.length > 0 ? `<div class="hint-count">
                <i data-feather="help-circle"></i>
                <span>${scene.hints.length} hints</span>
            </div>` : ''}
        </div>
    `;
    
    // Add event listeners
    sceneEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectScene(scene.id);
    });
    
    sceneEl.addEventListener('mousedown', startDrag);
    
    board.appendChild(sceneEl);
    
    // Replace feather icons
    feather.replace();
}

// Start dragging
function startDrag(e) {
    if (e.button !== 0) return; // Only left mouse button
    
    e.preventDefault();
    const sceneEl = e.currentTarget;
    const sceneId = sceneEl.getAttribute('data-scene-id');
    const scene = data.scenes[sceneId];
    
    if (!scene) return;
    
    isDragging = true;
    sceneEl.classList.add('dragging');
    
    const rect = sceneEl.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    // Mouse move handler
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        
        const boardRect = board.getBoundingClientRect();
        const newX = e.clientX - boardRect.left - dragOffset.x + board.scrollLeft;
        const newY = e.clientY - boardRect.top - dragOffset.y + board.scrollTop;
        
        // Constrain to board bounds
        scene.x = Math.max(0, Math.min(newX, 1800));
        scene.y = Math.max(0, Math.min(newY, 1300));
        
        sceneEl.style.left = scene.x + 'px';
        sceneEl.style.top = scene.y + 'px';
        
        // Update connectors in real-time
        renderConnectors();
    };
    
    // Mouse up handler
    const handleMouseUp = () => {
        if (isDragging) {
            isDragging = false;
            sceneEl.classList.remove('dragging');
            saveToLocal();
        }
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

// Select scene
function selectScene(sceneId) {
    // Update selected state
    selectedSceneId = sceneId;
    
    // Update visual selection
    if (document) {
        document.querySelectorAll('.scene').forEach(el => {
            el.classList.remove('selected');
        });
    }
    
    if (sceneId) {
        const sceneEl = document.querySelector(`[data-scene-id="${sceneId}"]`);
        if (sceneEl) {
            sceneEl.classList.add('selected');
        }
    }
    
    // Show/hide share button based on selection
    const shareBtn = document.getElementById('shareSceneBtn');
    if (shareBtn) {
        shareBtn.style.display = sceneId ? 'inline-flex' : 'none';
    }
    
    // Update inspector
    updateInspector();
}

// Update inspector panel
function updateInspector() {
    const inspectorContent = document.getElementById('inspectorContent');
    const inspectorForm = document.getElementById('inspectorForm');
    const deleteBtn = document.getElementById('deleteSceneBtn');
    
    if (!selectedSceneId || !data.scenes[selectedSceneId]) {
        inspectorContent.style.display = 'block';
        inspectorForm.style.display = 'none';
        deleteBtn.style.display = 'none';
        return;
    }
    
    const scene = data.scenes[selectedSceneId];
    
    inspectorContent.style.display = 'none';
    inspectorForm.style.display = 'block';
    deleteBtn.style.display = 'block';
    
    // Populate form
    document.getElementById('sceneTitle').value = scene.title;
    document.getElementById('sceneText').value = scene.text;
    document.getElementById('sceneCategory').value = scene.category || 'story';
    document.getElementById('sceneNotes').value = scene.notes || '';
    document.getElementById('readTime').value = scene.estimatedReadTime || 1;
    
    // Set image type radio
    const imageType = scene.imageType || 'upload';
    document.querySelector(`input[name="imageType"][value="${imageType}"]`).checked = true;
    switchImageType({ target: { value: imageType } });
    
    // Update image preview
    updateImagePreview(scene);
    
    // Render choices and hints
    renderChoices();
    renderHints();
}

// Update scene title
function updateSceneTitle(e) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    data.scenes[selectedSceneId].title = e.target.value;
    renderScene(data.scenes[selectedSceneId]);
    saveToLocal();
}

// Update scene text
function updateSceneText(e) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    data.scenes[selectedSceneId].text = e.target.value;
    renderScene(data.scenes[selectedSceneId]);
    saveToLocal();
}

// Add new choice
function addChoice() {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const choice = {
        id: makeId('choice'),
        text: 'New choice',
        target: null
    };
    
    data.scenes[selectedSceneId].choices.push(choice);
    renderChoices();
    renderScene(data.scenes[selectedSceneId]);
    renderConnectors();
    saveToLocal();
}

// Render choices list
function renderChoices() {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const choicesList = document.getElementById('choicesList');
    const scene = data.scenes[selectedSceneId];
    
    choicesList.innerHTML = '';
    
    scene.choices.forEach((choice, index) => {
        const choiceEl = document.createElement('div');
        choiceEl.className = 'choice-item';
        choiceEl.classList.add('new');
        setTimeout(() => choiceEl.classList.remove('new'), 300);
        
        choiceEl.innerHTML = `
            <div class="choice-item-header">
                <div class="choice-item-title">Choice ${index + 1}</div>
                <button class="choice-delete" onclick="deleteChoice('${choice.id}')">
                    <i data-feather="x"></i>
                </button>
            </div>
            <div class="choice-form">
                <input type="text" class="choice-text" value="${escapeHtml(choice.text)}" 
                       onchange="updateChoiceText('${choice.id}', this.value)">
                <select class="choice-target" onchange="updateChoiceTarget('${choice.id}', this.value)">
                    <option value="">Select target scene...</option>
                    ${Object.values(data.scenes)
                        .filter(s => s.id !== selectedSceneId)
                        .map(s => `<option value="${s.id}" ${choice.target === s.id ? 'selected' : ''}>${escapeHtml(s.title)}</option>`)
                        .join('')}
                </select>
            </div>
        `;
        
        choicesList.appendChild(choiceEl);
    });
    
    feather.replace();
}

// Update choice text
function updateChoiceText(choiceId, text) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const choice = data.scenes[selectedSceneId].choices.find(c => c.id === choiceId);
    if (choice) {
        choice.text = text;
        saveToLocal();
    }
}

// Update choice target
function updateChoiceTarget(choiceId, targetId) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const choice = data.scenes[selectedSceneId].choices.find(c => c.id === choiceId);
    if (choice) {
        choice.target = targetId || null;
        renderConnectors();
        saveToLocal();
    }
}

// Delete choice
function deleteChoice(choiceId) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const scene = data.scenes[selectedSceneId];
    scene.choices = scene.choices.filter(c => c.id !== choiceId);
    
    renderChoices();
    renderScene(scene);
    renderConnectors();
    saveToLocal();
}

// Delete scene
function deleteScene() {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const sceneId = selectedSceneId;
    
    // Remove scene
    delete data.scenes[sceneId];
    
    // Remove scene element
    const sceneEl = document.querySelector(`[data-scene-id="${sceneId}"]`);
    if (sceneEl) {
        sceneEl.remove();
    }
    
    // Remove references to this scene in choices
    Object.values(data.scenes).forEach(scene => {
        scene.choices.forEach(choice => {
            if (choice.target === sceneId) {
                choice.target = null;
            }
        });
    });
    
    // Update start scene if needed
    if (data.startSceneId === sceneId) {
        const remainingScenes = Object.keys(data.scenes);
        data.startSceneId = remainingScenes.length > 0 ? remainingScenes[0] : null;
    }
    
    selectScene(null);
    renderConnectors();
    saveToLocal();
}

// Render SVG connectors
function renderConnectors() {
    connectorsSvg.innerHTML = '';
    
    Object.values(data.scenes).forEach(scene => {
        scene.choices.forEach(choice => {
            if (choice.target && data.scenes[choice.target]) {
                drawConnector(scene, data.scenes[choice.target]);
            }
        });
    });
}

// Draw single connector
function drawConnector(fromScene, toScene) {
    const fromX = fromScene.x + 200; // Right edge of scene
    const fromY = fromScene.y + 60; // Middle of scene
    const toX = toScene.x; // Left edge of target scene
    const toY = toScene.y + 60; // Middle of target scene
    
    // Calculate control points for smooth curve
    const controlOffset = Math.min(200, Math.abs(toX - fromX) / 2);
    const controlX1 = fromX + controlOffset;
    const controlY1 = fromY;
    const controlX2 = toX - controlOffset;
    const controlY2 = toY;
    
    // Create path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathData = `M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`;
    path.setAttribute('d', pathData);
    path.setAttribute('class', 'connector-path');
    
    // Create arrowhead
    const arrowSize = 8;
    const angle = Math.atan2(toY - controlY2, toX - controlX2);
    const arrowX1 = toX - arrowSize * Math.cos(angle - Math.PI / 6);
    const arrowY1 = toY - arrowSize * Math.sin(angle - Math.PI / 6);
    const arrowX2 = toX - arrowSize * Math.cos(angle + Math.PI / 6);
    const arrowY2 = toY - arrowSize * Math.sin(angle + Math.PI / 6);
    
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrow.setAttribute('points', `${toX},${toY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`);
    arrow.setAttribute('class', 'connector-arrow');
    
    connectorsSvg.appendChild(path);
    connectorsSvg.appendChild(arrow);
}

// Preview functionality
function openPreview() {
    const startScene = data.startSceneId ? data.scenes[data.startSceneId] : Object.values(data.scenes)[0];
    
    if (!startScene) {
        alert('No scenes to preview. Create a scene first!');
        return;
    }
    
    document.getElementById('previewOverlay').style.display = 'flex';
    playScene(startScene.id);
}

function closePreview() {
    document.getElementById('previewOverlay').style.display = 'none';
}

function playScene(sceneId) {
    const scene = data.scenes[sceneId];
    if (!scene) return;
    
    document.getElementById('previewTitle').textContent = scene.title;
    document.getElementById('previewText').textContent = scene.text;
    
    const choicesContainer = document.getElementById('previewChoices');
    choicesContainer.innerHTML = '';
    
    scene.choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'preview-choice';
        button.textContent = choice.text;
        
        if (choice.target && data.scenes[choice.target]) {
            button.addEventListener('click', () => playScene(choice.target));
        } else {
            button.classList.add('disabled');
            button.textContent += ' (unlinked)';
        }
        
        choicesContainer.appendChild(button);
    });
    
    if (scene.choices.length === 0) {
        const endMessage = document.createElement('div');
        endMessage.className = 'preview-choice disabled';
        endMessage.textContent = 'The End';
        choicesContainer.appendChild(endMessage);
    }
}

// Export JSON
function exportJSON() {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'story.json';
    a.click();
    
    URL.revokeObjectURL(url);
}

// Import JSON
function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            
            // Validate data structure
            if (importedData && typeof importedData.scenes === 'object') {
                data = importedData;
                selectScene(null);
                renderAll();
                saveToLocal();
                alert('Story imported successfully!');
            } else {
                alert('Invalid story file format.');
            }
        } catch (error) {
            alert('Error reading story file: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
}

// Export playable HTML
function exportPlayableHTML() {
    const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Story</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .story-container {
            background: white;
            border-radius: 1rem;
            max-width: 600px;
            width: 100%;
            padding: 2rem;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }
        .story-title {
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #1e293b;
            text-align: center;
        }
        .story-text {
            font-size: 1.1rem;
            line-height: 1.6;
            margin-bottom: 2rem;
            color: #4b5563;
        }
        .story-choices {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        .story-choice {
            padding: 1rem;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: left;
            font-size: 1rem;
        }
        .story-choice:hover {
            background: #f1f5f9;
            border-color: #3b82f6;
            transform: translateY(-1px);
        }
        .story-choice.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #fef2f2;
            color: #ef4444;
        }
        .story-end {
            text-align: center;
            color: #6b7280;
            font-style: italic;
            padding: 2rem 0;
        }
    </style>
</head>
<body>
    <div class="story-container">
        <div id="story-content"></div>
    </div>

    <script>
        const storyData = ${JSON.stringify(data)};
        
        function playScene(sceneId) {
            const scene = storyData.scenes[sceneId];
            if (!scene) return;
            
            const container = document.getElementById('story-content');
            container.innerHTML = \`
                <h1 class="story-title">\${escapeHtml(scene.title)}</h1>
                <div class="story-text">\${escapeHtml(scene.text)}</div>
                <div class="story-choices" id="choices"></div>
            \`;
            
            const choicesContainer = document.getElementById('choices');
            
            if (scene.choices.length === 0) {
                choicesContainer.innerHTML = '<div class="story-end">The End</div>';
                return;
            }
            
            scene.choices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'story-choice';
                button.textContent = choice.text;
                
                if (choice.target && storyData.scenes[choice.target]) {
                    button.addEventListener('click', () => playScene(choice.target));
                } else {
                    button.classList.add('disabled');
                    button.textContent += ' (unlinked)';
                }
                
                choicesContainer.appendChild(button);
            });
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Start the story
        const startScene = storyData.startSceneId ? storyData.scenes[storyData.startSceneId] : Object.values(storyData.scenes)[0];
        if (startScene) {
            playScene(startScene.id);
        } else {
            document.getElementById('story-content').innerHTML = '<div class="story-end">No story content found.</div>';
        }
    </script>
</body>
</html>`;

    const blob = new Blob([template], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playable-story.html';
    a.click();
    
    URL.revokeObjectURL(url);
}

// Load sample story
function loadSampleStory() {
    if (Object.keys(data.scenes).length > 0) {
        if (!confirm('This will replace your current story. Continue?')) {
            return;
        }
    }
    
    const sampleData = {
        scenes: {
            scene_1: {
                id: 'scene_1',
                title: 'The Science Lab Adventure',
                text: 'Welcome to the school science lab! Today you\'re investigating different states of matter. You see two experiments set up on the lab benches.',
                x: 100,
                y: 100,
                image: '🔬',
                imageType: 'emoji',
                category: 'info',
                hints: [
                    { id: 'hint_1', text: 'Remember the three main states of matter: solid, liquid, and gas' }
                ],
                notes: 'This introduces students to basic chemistry concepts',
                estimatedReadTime: 2,
                choices: [
                    {
                        id: 'choice_1',
                        text: 'Investigate the ice cube experiment',
                        target: 'scene_2'
                    },
                    {
                        id: 'choice_2',
                        text: 'Examine the boiling water setup',
                        target: 'scene_3'
                    }
                ]
            },
            scene_2: {
                id: 'scene_2',
                title: 'Ice Cube Investigation',
                text: 'You observe the ice cube melting on the warm lab bench. The solid ice is slowly turning into liquid water as it absorbs heat energy from the environment.',
                x: 400,
                y: 50,
                image: '🧊',
                imageType: 'emoji',
                category: 'info',
                hints: [
                    { id: 'hint_2', text: 'Ice melts at 0°C (32°F)' },
                    { id: 'hint_3', text: 'This is called the melting point' }
                ],
                notes: 'Students learn about solid to liquid phase transition',
                estimatedReadTime: 2,
                choices: [
                    {
                        id: 'choice_3',
                        text: 'Record your observations about melting',
                        target: 'scene_4'
                    },
                    {
                        id: 'choice_4',
                        text: 'Move to the water boiling experiment',
                        target: 'scene_3'
                    }
                ]
            },
            scene_3: {
                id: 'scene_3',
                title: 'Boiling Water Experiment',
                text: 'The water in the beaker is bubbling vigorously! Steam rises from the surface as the liquid water transforms into water vapor (gas). The thermometer reads 100°C.',
                x: 400,
                y: 200,
                image: '💨',
                imageType: 'emoji',
                category: 'info',
                hints: [
                    { id: 'hint_4', text: 'Water boils at 100°C (212°F) at sea level' },
                    { id: 'hint_5', text: 'Steam is water in its gas state' }
                ],
                notes: 'Students learn about liquid to gas phase transition',
                estimatedReadTime: 2,
                choices: [
                    {
                        id: 'choice_5',
                        text: 'Record boiling point observations',
                        target: 'scene_4'
                    },
                    {
                        id: 'choice_6',
                        text: 'Check the ice cube experiment',
                        target: 'scene_2'
                    }
                ]
            },
            scene_4: {
                id: 'scene_4',
                title: 'Knowledge Check',
                text: 'Now that you\'ve observed both experiments, let\'s test your understanding. What are the three main states of matter you\'ve learned about today?',
                x: 700,
                y: 125,
                image: '❓',
                imageType: 'emoji',
                category: 'question',
                hints: [
                    { id: 'hint_6', text: 'Think about what you observed in both experiments' },
                    { id: 'hint_7', text: 'The ice was __, the water was __, and the steam was __' }
                ],
                notes: 'Assessment question to check understanding',
                estimatedReadTime: 1,
                choices: [
                    {
                        id: 'choice_7',
                        text: 'Solid, Liquid, and Gas',
                        target: 'scene_6'
                    },
                    {
                        id: 'choice_8',
                        text: 'Hot, Cold, and Warm',
                        target: 'scene_5'
                    }
                ]
            },
            scene_5: {
                id: 'scene_5',
                title: 'Try Again',
                text: 'That\'s not quite right. Remember what you observed: the ice cube was solid, the water was liquid, and the steam was gas. These are the three states of matter!',
                x: 700,
                y: 300,
                image: '🤔',
                imageType: 'emoji',
                category: 'info',
                hints: [
                    { id: 'hint_8', text: 'Review your observations from both experiments' }
                ],
                notes: 'Corrective feedback with encouragement',
                estimatedReadTime: 1,
                choices: [
                    {
                        id: 'choice_9',
                        text: 'Try the question again',
                        target: 'scene_4'
                    }
                ]
            },
            scene_6: {
                id: 'scene_6',
                title: 'Excellent Work!',
                text: 'Perfect! You\'ve successfully identified the three states of matter: solid (ice), liquid (water), and gas (steam). You\'ve completed your science lab investigation!',
                x: 1000,
                y: 125,
                image: '🎉',
                imageType: 'emoji',
                category: 'info',
                hints: [
                    { id: 'hint_9', text: 'Matter can change states when energy (heat) is added or removed' }
                ],
                notes: 'Positive reinforcement and summary of learning',
                estimatedReadTime: 1,
                choices: []
            }
        },
        startSceneId: 'scene_1',
        storyMetadata: {
            title: 'States of Matter Lab Investigation',
            description: 'An interactive science lesson about solid, liquid, and gas states of matter',
            subject: 'Science',
            difficulty: 'Beginner',
            learningObjectives: [
                'Identify the three main states of matter',
                'Understand how temperature affects state changes',
                'Observe and record scientific phenomena'
            ],
            tags: ['chemistry', 'states of matter', 'lab experiment', 'temperature']
        }
    };
    
    data = sampleData;
    selectScene(null);
    renderAll();
    saveToLocal();
}

// LocalStorage functions
function saveToLocal() {
    try {
        localStorage.setItem('storyEditor_data', JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function loadFromLocal() {
    try {
        const saved = localStorage.getItem('storyEditor_data');
        if (saved) {
            data = JSON.parse(saved);
        } else {
            // Load sample story on first visit
            loadSampleStory('mathAdventure');
        }
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
        loadSampleStory('mathAdventure');
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update scene properties
function updateSceneCategory(e) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    data.scenes[selectedSceneId].category = e.target.value;
    renderScene(data.scenes[selectedSceneId]);
    saveToLocal();
}

function updateSceneNotes(e) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    data.scenes[selectedSceneId].notes = e.target.value;
    saveToLocal();
}

function updateReadTime(e) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    data.scenes[selectedSceneId].estimatedReadTime = parseInt(e.target.value) || 1;
    saveToLocal();
}

// Image handling functions
function switchImageType(e) {
    const imageType = e.target.value;
    
    // Hide all image option panels
    document.getElementById('uploadImageControls').style.display = 'none';
    document.getElementById('unsplashControls').style.display = 'none';
    document.getElementById('emojiControls').style.display = 'none';
    
    // Show selected panel
    switch(imageType) {
        case 'upload':
            document.getElementById('uploadImageControls').style.display = 'block';
            break;
        case 'unsplash':
            document.getElementById('unsplashControls').style.display = 'block';
            break;
        case 'emoji':
            document.getElementById('emojiControls').style.display = 'block';
            break;
    }
    
    // Update scene if one is selected
    if (selectedSceneId && data.scenes[selectedSceneId]) {
        data.scenes[selectedSceneId].imageType = imageType;
        saveToLocal();
    }
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file || !selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const scene = data.scenes[selectedSceneId];
        scene.image = event.target.result;
        scene.imageType = 'upload';
        updateImagePreview(scene);
        renderScene(scene);
        saveToLocal();
    };
    reader.readAsDataURL(file);
}

function searchUnsplash() {
    const query = document.getElementById('unsplashSearch').value.trim();
    if (!query) return;
    
    // For educational purposes, we'll create some sample educational images
    const educationalImages = [
        { url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=200&fit=crop', alt: 'Library books' },
        { url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=300&h=200&fit=crop', alt: 'School supplies' },
        { url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=300&h=200&fit=crop', alt: 'Student writing' },
        { url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=300&h=200&fit=crop', alt: 'Scientific equipment' },
        { url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=300&h=200&fit=crop', alt: 'Globe and books' },
        { url: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=300&h=200&fit=crop', alt: 'Mathematics' }
    ];
    
    const resultsContainer = document.getElementById('unsplashResults');
    resultsContainer.innerHTML = '';
    
    educationalImages.forEach(image => {
        const img = document.createElement('img');
        img.src = image.url;
        img.alt = image.alt;
        img.addEventListener('click', () => selectUnsplashImage(image.url));
        resultsContainer.appendChild(img);
    });
}

function selectUnsplashImage(imageUrl) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const scene = data.scenes[selectedSceneId];
    scene.image = imageUrl;
    scene.imageType = 'unsplash';
    updateImagePreview(scene);
    renderScene(scene);
    saveToLocal();
    
    // Update selection visual
    document.querySelectorAll('#unsplashResults img').forEach(img => {
        img.classList.remove('selected');
    });
    document.querySelector(`#unsplashResults img[src="${imageUrl}"]`).classList.add('selected');
}

function updateEmojiPreview(e) {
    const emoji = e.target.value;
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const scene = data.scenes[selectedSceneId];
    scene.image = emoji;
    scene.imageType = 'emoji';
    updateImagePreview(scene);
    renderScene(scene);
    saveToLocal();
}

function selectEmoji(emoji) {
    document.getElementById('emojiInput').value = emoji;
    updateEmojiPreview({ target: { value: emoji } });
}

function updateImagePreview(scene) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    if (scene.image) {
        if (scene.imageType === 'emoji') {
            preview.innerHTML = `<div class="emoji-preview">${scene.image}</div>`;
        } else {
            preview.innerHTML = `<img src="${scene.image}" alt="Scene preview">`;
        }
    }
}

// Hints functionality
function addHint() {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const scene = data.scenes[selectedSceneId];
    if (!scene.hints) scene.hints = [];
    
    scene.hints.push({
        id: makeId('hint'),
        text: 'Enter helpful hint here...'
    });
    
    renderHints();
    renderScene(scene);
    saveToLocal();
}

function renderHints() {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const hintsList = document.getElementById('hintsList');
    const scene = data.scenes[selectedSceneId];
    
    hintsList.innerHTML = '';
    
    if (!scene.hints) scene.hints = [];
    
    scene.hints.forEach((hint, index) => {
        const hintEl = document.createElement('div');
        hintEl.className = 'hint-item';
        hintEl.innerHTML = `
            <input type="text" value="${escapeHtml(hint.text)}" 
                   onchange="updateHintText('${hint.id}', this.value)"
                   placeholder="Enter hint text...">
            <button class="hint-delete" onclick="deleteHint('${hint.id}')">
                <i data-feather="x"></i>
            </button>
        `;
        hintsList.appendChild(hintEl);
    });
    
    feather.replace();
}

function updateHintText(hintId, text) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const scene = data.scenes[selectedSceneId];
    const hint = scene.hints.find(h => h.id === hintId);
    if (hint) {
        hint.text = text;
        saveToLocal();
    }
}

function deleteHint(hintId) {
    if (!selectedSceneId || !data.scenes[selectedSceneId]) return;
    
    const scene = data.scenes[selectedSceneId];
    scene.hints = scene.hints.filter(h => h.id !== hintId);
    
    renderHints();
    renderScene(scene);
    saveToLocal();
}

// Story settings modal
function openStorySettings() {
    document.getElementById('storyTitle').value = data.storyMetadata.title;
    document.getElementById('storyDescription').value = data.storyMetadata.description;
    document.getElementById('storySubject').value = data.storyMetadata.subject;
    document.getElementById('storyDifficulty').value = data.storyMetadata.difficulty;
    document.getElementById('learningObjectives').value = data.storyMetadata.learningObjectives.join('\n');
    document.getElementById('storyTags').value = data.storyMetadata.tags.join(', ');
    
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeStorySettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function saveStorySettings() {
    data.storyMetadata.title = document.getElementById('storyTitle').value;
    data.storyMetadata.description = document.getElementById('storyDescription').value;
    data.storyMetadata.subject = document.getElementById('storySubject').value;
    data.storyMetadata.difficulty = document.getElementById('storyDifficulty').value;
    data.storyMetadata.learningObjectives = document.getElementById('learningObjectives').value
        .split('\n').filter(obj => obj.trim()).map(obj => obj.trim());
    data.storyMetadata.tags = document.getElementById('storyTags').value
        .split(',').filter(tag => tag.trim()).map(tag => tag.trim());
    
    saveToLocal();
    closeStorySettings();
}

// Analytics modal
function openAnalytics() {
    generateAnalytics();
    document.getElementById('analyticsModal').style.display = 'flex';
}

function closeAnalytics() {
    document.getElementById('analyticsModal').style.display = 'none';
}

function generateAnalytics() {
    const scenes = Object.values(data.scenes);
    const totalScenes = scenes.length;
    const totalChoices = scenes.reduce((sum, scene) => sum + scene.choices.length, 0);
    const totalHints = scenes.reduce((sum, scene) => sum + (scene.hints ? scene.hints.length : 0), 0);
    const estimatedTime = scenes.reduce((sum, scene) => sum + (scene.estimatedReadTime || 1), 0);
    
    // Scene type distribution
    const sceneTypes = scenes.reduce((acc, scene) => {
        const type = scene.category || 'story';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    
    // Complexity analysis
    const maxChoices = Math.max(...scenes.map(s => s.choices.length), 0);
    const avgChoices = totalChoices / totalScenes || 0;
    const complexityScore = Math.round((avgChoices / 3) * 100); // 3 choices = 100% complexity
    
    // Update analytics display
    document.getElementById('storyStats').innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Total Scenes</span>
            <span class="stat-value">${totalScenes}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Total Choices</span>
            <span class="stat-value">${totalChoices}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Learning Hints</span>
            <span class="stat-value">${totalHints}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Estimated Reading Time</span>
            <span class="stat-value">${estimatedTime} min</span>
        </div>
    `;
    
    document.getElementById('sceneChart').innerHTML = `
        ${Object.entries(sceneTypes).map(([type, count]) => `
            <div class="stat-item">
                <span class="stat-label">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span class="stat-value">${count}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${(count/totalScenes)*100}%"></div>
            </div>
        `).join('')}
    `;
    
    document.getElementById('complexityStats').innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Complexity Score</span>
            <span class="stat-value">${complexityScore}%</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${complexityScore}%"></div>
        </div>
        <div class="stat-item">
            <span class="stat-label">Max Choices per Scene</span>
            <span class="stat-value">${maxChoices}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Average Choices</span>
            <span class="stat-value">${avgChoices.toFixed(1)}</span>
        </div>
    `;
    
    // Path analysis
    const paths = findAllPaths();
    document.getElementById('pathAnalysis').innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Possible Story Paths</span>
            <span class="stat-value">${paths.length}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Average Path Length</span>
            <span class="stat-value">${paths.length > 0 ? (paths.reduce((sum, path) => sum + path.length, 0) / paths.length).toFixed(1) : 0}</span>
        </div>
    `;
}

function findAllPaths() {
    const paths = [];
    const startScene = data.startSceneId ? data.scenes[data.startSceneId] : Object.values(data.scenes)[0];
    
    if (!startScene) return paths;
    
    function explorePath(sceneId, currentPath, visited) {
        if (visited.has(sceneId)) return; // Avoid cycles
        
        const scene = data.scenes[sceneId];
        if (!scene) return;
        
        const newPath = [...currentPath, sceneId];
        const newVisited = new Set([...visited, sceneId]);
        
        if (scene.choices.length === 0) {
            paths.push(newPath);
            return;
        }
        
        scene.choices.forEach(choice => {
            if (choice.target && data.scenes[choice.target]) {
                explorePath(choice.target, newPath, newVisited);
            }
        });
    }
    
    explorePath(startScene.id, [], new Set());
    return paths;
}

// Scene sharing functionality
function shareScene(sceneId) {
    if (!data.scenes[sceneId]) return;
    
    const scene = data.scenes[sceneId];
    const sceneData = {
        scene: scene,
        storyTitle: data.storyMetadata?.title || 'Shared Scene'
    };
    
    const encodedData = btoa(JSON.stringify(sceneData));
    const shareUrl = `${window.location.origin}${window.location.pathname}?scene=${encodedData}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Share link copied to clipboard!');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Share link copied to clipboard!');
    });
}

function loadSharedScene(encodedData) {
    try {
        const sceneData = JSON.parse(atob(encodedData));
        
        // Hide main UI elements
        document.getElementById('toolbar').style.display = 'none';
        document.getElementById('inspector').style.display = 'none';
        
        // Show shared scene preview
        document.getElementById('board').innerHTML = `
            <div class="shared-scene-container">
                <div class="shared-scene-header">
                    <h1>${escapeHtml(sceneData.storyTitle)}</h1>
                    <div class="scene-badge ${sceneData.scene.category || 'story'}">${(sceneData.scene.category || 'story').charAt(0).toUpperCase() + (sceneData.scene.category || 'story').slice(1)}</div>
                </div>
                <div class="shared-scene">
                    ${sceneData.scene.image ? (
                        sceneData.scene.imageType === 'emoji' 
                            ? `<div class="scene-image emoji">${sceneData.scene.image}</div>`
                            : `<img src="${sceneData.scene.image}" alt="Scene image" class="scene-image">`
                    ) : ''}
                    <h2>${escapeHtml(sceneData.scene.title)}</h2>
                    <p class="scene-text">${escapeHtml(sceneData.scene.text)}</p>
                    
                    ${sceneData.scene.hints && sceneData.scene.hints.length > 0 ? `
                        <div class="scene-hints">
                            <h3>💡 Learning Hints</h3>
                            ${sceneData.scene.hints.map(hint => `<div class="hint">${escapeHtml(hint.text)}</div>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${sceneData.scene.choices && sceneData.scene.choices.length > 0 ? `
                        <div class="scene-choices">
                            <h3>Choices</h3>
                            ${sceneData.scene.choices.map(choice => `<div class="choice-preview">${escapeHtml(choice.text)}</div>`).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="scene-info">
                        <span class="read-time">📖 ${sceneData.scene.estimatedReadTime || 1} min read</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add shared scene styles
        const sharedStyles = document.createElement('style');
        sharedStyles.textContent = `
            .shared-scene-container {
                max-width: 800px;
                margin: 2rem auto;
                padding: 2rem;
                background: white;
                border-radius: 1rem;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            }
            .shared-scene-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2rem;
                border-bottom: 2px solid #f1f5f9;
                padding-bottom: 1rem;
            }
            .shared-scene-header h1 {
                margin: 0;
                color: #1e293b;
            }
            .shared-scene {
                line-height: 1.6;
            }
            .scene-image {
                width: 100%;
                max-width: 400px;
                height: 200px;
                object-fit: cover;
                border-radius: 0.5rem;
                margin-bottom: 1.5rem;
                display: block;
                margin-left: auto;
                margin-right: auto;
            }
            .scene-image.emoji {
                font-size: 4rem;
                text-align: center;
                line-height: 200px;
                background: #f8fafc;
                border: 2px solid #e2e8f0;
            }
            .shared-scene h2 {
                color: #1e293b;
                margin-bottom: 1rem;
            }
            .scene-text {
                font-size: 1.1rem;
                color: #4b5563;
                margin-bottom: 1.5rem;
            }
            .scene-hints {
                background: #fffbeb;
                border: 1px solid #fbbf24;
                border-radius: 0.5rem;
                padding: 1rem;
                margin-bottom: 1.5rem;
            }
            .scene-hints h3 {
                margin: 0 0 0.5rem 0;
                color: #92400e;
            }
            .hint {
                background: white;
                padding: 0.5rem;
                border-radius: 0.25rem;
                margin-bottom: 0.5rem;
                color: #451a03;
            }
            .scene-choices {
                background: #f0f9ff;
                border: 1px solid #3b82f6;
                border-radius: 0.5rem;
                padding: 1rem;
                margin-bottom: 1.5rem;
            }
            .scene-choices h3 {
                margin: 0 0 0.5rem 0;
                color: #1e40af;
            }
            .choice-preview {
                background: white;
                padding: 0.75rem;
                border-radius: 0.25rem;
                margin-bottom: 0.5rem;
                border: 1px solid #ddd6fe;
                color: #1e293b;
            }
            .scene-info {
                text-align: center;
                color: #6b7280;
                font-size: 0.9rem;
                margin-top: 1.5rem;
                padding-top: 1rem;
                border-top: 1px solid #e5e7eb;
            }
        `;
        document.head.appendChild(sharedStyles);
        
    } catch (error) {
        console.error('Error loading shared scene:', error);
        document.getElementById('board').innerHTML = '<div style="text-align: center; padding: 2rem;">Invalid share link</div>';
    }
}

// Sample stories data
const sampleStories = {
    mathAdventure: {
        scenes: {
            scene_1: {
                id: 'scene_1',
                title: 'The Number Kingdom',
                text: 'Welcome to the magical Number Kingdom! The evil Fraction Dragon has scattered all the numbers. You must help Princess Calculate restore order using your math skills.',
                x: 100, y: 100,
                image: '🏰', imageType: 'emoji', category: 'story',
                hints: [{ id: 'h1', text: 'Remember: fractions represent parts of a whole' }],
                notes: 'Introduction to fractions through storytelling',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c1', text: 'Start with simple fractions (1/2, 1/4)', target: 'scene_2' },
                    { id: 'c2', text: 'Go directly to the dragon\'s lair', target: 'scene_3' }
                ]
            },
            scene_2: {
                id: 'scene_2',
                title: 'The Pizza Palace',
                text: 'You arrive at Pizza Palace where the chef needs help dividing pizzas fairly. There are 8 slices total, and 4 customers want equal shares.',
                x: 400, y: 50,
                image: '🍕', imageType: 'emoji', category: 'question',
                hints: [
                    { id: 'h2', text: 'Divide the total slices by number of customers' },
                    { id: 'h3', text: '8 ÷ 4 = ?' }
                ],
                notes: 'Basic division and fraction understanding',
                estimatedReadTime: 3,
                choices: [
                    { id: 'c3', text: 'Each customer gets 2 slices (2/8 = 1/4)', target: 'scene_4' },
                    { id: 'c4', text: 'Each customer gets 3 slices', target: 'scene_5' }
                ]
            },
            scene_3: {
                id: 'scene_3',
                title: 'The Dragon\'s Challenge',
                text: 'The Fraction Dragon roars: "Solve this or be turned to stone! What is 3/4 + 1/4?"',
                x: 400, y: 200,
                image: '🐉', imageType: 'emoji', category: 'question',
                hints: [
                    { id: 'h4', text: 'When denominators are the same, just add the numerators' },
                    { id: 'h5', text: '3 + 1 = 4, so 3/4 + 1/4 = 4/4' }
                ],
                notes: 'Adding fractions with same denominator',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c5', text: '4/4 = 1 whole', target: 'scene_6' },
                    { id: 'c6', text: '4/8', target: 'scene_5' }
                ]
            },
            scene_4: {
                id: 'scene_4',
                title: 'Well Done!',
                text: 'Correct! You helped divide the pizza fairly. The chef gives you a magical fraction wand that will help defeat the dragon.',
                x: 700, y: 50,
                image: '🪄', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h6', text: 'Fair division is an important life skill!' }],
                notes: 'Positive reinforcement for correct answer',
                estimatedReadTime: 1,
                choices: [
                    { id: 'c7', text: 'Face the dragon with your new powers', target: 'scene_3' }
                ]
            },
            scene_5: {
                id: 'scene_5',
                title: 'Try Again!',
                text: 'That\'s not quite right. Don\'t worry - even the best mathematicians make mistakes! Let\'s review and try again.',
                x: 700, y: 150,
                image: '🤔', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h7', text: 'Take your time and think step by step' }],
                notes: 'Encouraging feedback for incorrect answers',
                estimatedReadTime: 1,
                choices: [
                    { id: 'c8', text: 'Go back and try again', target: 'scene_2' }
                ]
            },
            scene_6: {
                id: 'scene_6',
                title: 'Victory!',
                text: 'Amazing! You defeated the Fraction Dragon! The Number Kingdom is saved, and you\'ve mastered basic fractions. Princess Calculate rewards you with the Golden Calculator!',
                x: 700, y: 300,
                image: '🏆', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h8', text: 'Practice makes perfect in mathematics!' }],
                notes: 'Celebration and learning summary',
                estimatedReadTime: 2,
                choices: []
            }
        },
        startSceneId: 'scene_1',
        storyMetadata: {
            title: 'Math Adventure: The Number Kingdom',
            description: 'Learn fractions through an exciting adventure story',
            subject: 'Mathematics',
            difficulty: 'Beginner',
            learningObjectives: ['Understanding basic fractions', 'Adding fractions with same denominators', 'Real-world applications of division'],
            tags: ['fractions', 'division', 'problem-solving', 'adventure']
        }
    },

    spaceExploration: {
        scenes: {
            scene_1: {
                id: 'scene_1',
                title: 'Mission to Mars',
                text: 'You are an astronaut preparing for a mission to Mars. Your spacecraft has three different routes to choose from, each with different challenges.',
                x: 100, y: 100,
                image: '🚀', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h1', text: 'Mars is about 225 million kilometers from Earth on average' }],
                notes: 'Introduction to space exploration and distances',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c1', text: 'Take the fastest route (6 months)', target: 'scene_2' },
                    { id: 'c2', text: 'Take the most fuel-efficient route (9 months)', target: 'scene_3' },
                    { id: 'c3', text: 'Take the scenic route past Jupiter (12 months)', target: 'scene_4' }
                ]
            },
            scene_2: {
                id: 'scene_2',
                title: 'Asteroid Field Challenge',
                text: 'Your fast route takes you through an asteroid field! You must calculate the safe distance to navigate between two large asteroids.',
                x: 400, y: 50,
                image: '☄️', imageType: 'emoji', category: 'question',
                hints: [
                    { id: 'h2', text: 'Safe distance = asteroid width + 2 × safety buffer' },
                    { id: 'h3', text: 'Asteroid A: 500m wide, Asteroid B: 300m wide, Safety buffer: 200m' }
                ],
                notes: 'Mathematical problem solving in space context',
                estimatedReadTime: 3,
                choices: [
                    { id: 'c4', text: '1200 meters apart', target: 'scene_5' },
                    { id: 'c5', text: '800 meters apart', target: 'scene_6' }
                ]
            },
            scene_3: {
                id: 'scene_3',
                title: 'Solar Panel Efficiency',
                text: 'On the fuel-efficient route, your solar panels are crucial. The Sun\'s intensity decreases as you get farther away. How does this affect power generation?',
                x: 400, y: 150,
                image: '☀️', imageType: 'emoji', category: 'question',
                hints: [
                    { id: 'h4', text: 'Light intensity follows the inverse square law' },
                    { id: 'h5', text: 'If you double the distance, intensity becomes 1/4' }
                ],
                notes: 'Physics concepts: inverse square law',
                estimatedReadTime: 3,
                choices: [
                    { id: 'c6', text: 'Power decreases with distance squared', target: 'scene_7' },
                    { id: 'c7', text: 'Power decreases linearly with distance', target: 'scene_6' }
                ]
            },
            scene_4: {
                id: 'scene_4',
                title: 'Jupiter\'s Gravity Assist',
                text: 'Taking the scenic route past Jupiter allows you to use its gravity to speed up your spacecraft! This saves fuel for the journey.',
                x: 400, y: 250,
                image: '🪐', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h6', text: 'Gravity assists are used by real space missions like Voyager' }],
                notes: 'Real space exploration technique',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c8', text: 'Continue to Mars with extra speed', target: 'scene_7' }
                ]
            },
            scene_5: {
                id: 'scene_5',
                title: 'Safe Navigation!',
                text: 'Perfect calculation! You safely navigate through the asteroid field and arrive at Mars ahead of schedule. Your precision saves the mission!',
                x: 700, y: 50,
                image: '🎯', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h7', text: 'Precision in calculations is crucial for space missions' }],
                notes: 'Success story emphasizing accuracy importance',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c9', text: 'Begin Mars exploration', target: 'scene_8' }
                ]
            },
            scene_6: {
                id: 'scene_6',
                title: 'Course Correction Needed',
                text: 'Your calculation needs adjustment. Mission Control helps you recalculate and find the safe path.',
                x: 700, y: 150,
                image: '📡', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h8', text: 'Mistakes are learning opportunities in science' }],
                notes: 'Constructive feedback and second chances',
                estimatedReadTime: 1,
                choices: [
                    { id: 'c10', text: 'Try the calculation again', target: 'scene_2' },
                    { id: 'c11', text: 'Request different route', target: 'scene_3' }
                ]
            },
            scene_7: {
                id: 'scene_7',
                title: 'Scientific Success!',
                text: 'Excellent! Your understanding of physics helps optimize the mission. You arrive at Mars with perfect timing and full power reserves.',
                x: 700, y: 250,
                image: '🧪', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h9', text: 'Understanding physics is key to space exploration' }],
                notes: 'Connecting science concepts to real applications',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c12', text: 'Begin Mars exploration', target: 'scene_8' }
                ]
            },
            scene_8: {
                id: 'scene_8',
                title: 'Mars Discovery!',
                text: 'You\'ve successfully reached Mars! Your mission discovers evidence of ancient water flows. This breakthrough advances our understanding of the Red Planet!',
                x: 1000, y: 150,
                image: '🔴', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h10', text: 'Mars exploration continues to reveal new discoveries!' }],
                notes: 'Mission accomplished with scientific discovery',
                estimatedReadTime: 2,
                choices: []
            }
        },
        startSceneId: 'scene_1',
        storyMetadata: {
            title: 'Space Exploration: Mission to Mars',
            description: 'Learn physics and mathematics through space exploration',
            subject: 'Science',
            difficulty: 'Intermediate',
            learningObjectives: ['Apply mathematical calculations to real scenarios', 'Understand inverse square law', 'Learn about space exploration techniques'],
            tags: ['space', 'physics', 'mathematics', 'problem-solving', 'astronomy']
        }
    },

    environmentalHero: {
        scenes: {
            scene_1: {
                id: 'scene_1',
                title: 'The Polluted Lake',
                text: 'You discover that Lake Crystal, once the cleanest lake in your town, is now polluted. Fish are dying and plants are withering. As an environmental scientist, what\'s your first step?',
                x: 100, y: 100,
                image: '🏞️', imageType: 'emoji', category: 'decision',
                hints: [{ id: 'h1', text: 'Scientific method starts with observation and data collection' }],
                notes: 'Introduction to environmental science methodology',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c1', text: 'Test the water quality for pollutants', target: 'scene_2' },
                    { id: 'c2', text: 'Interview local residents about changes', target: 'scene_3' },
                    { id: 'c3', text: 'Look for the pollution source upstream', target: 'scene_4' }
                ]
            },
            scene_2: {
                id: 'scene_2',
                title: 'Water Quality Analysis',
                text: 'Your tests show high levels of nitrogen and phosphorus. The pH is 8.5 (normal is 6.5-7.5). What do these results suggest?',
                x: 400, y: 50,
                image: '🧪', imageType: 'emoji', category: 'question',
                hints: [
                    { id: 'h2', text: 'High nitrogen and phosphorus often come from fertilizers' },
                    { id: 'h3', text: 'High pH can indicate chemical runoff' }
                ],
                notes: 'Interpreting water quality data',
                estimatedReadTime: 3,
                choices: [
                    { id: 'c4', text: 'Agricultural runoff from nearby farms', target: 'scene_5' },
                    { id: 'c5', text: 'Natural seasonal changes', target: 'scene_6' },
                    { id: 'c6', text: 'Industrial waste discharge', target: 'scene_7' }
                ]
            },
            scene_3: {
                id: 'scene_3',
                title: 'Community Insights',
                text: 'Residents report that the lake started changing 3 months ago, right after the new fertilizer factory opened upstream. They\'ve also noticed more algae blooms.',
                x: 400, y: 150,
                image: '👥', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h4', text: 'Algae blooms are often caused by excess nutrients (eutrophication)' }],
                notes: 'Importance of community observations in environmental science',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c7', text: 'Investigate the fertilizer factory', target: 'scene_8' },
                    { id: 'c8', text: 'Test the water for chemical pollutants', target: 'scene_2' }
                ]
            },
            scene_4: {
                id: 'scene_4',
                title: 'Upstream Investigation',
                text: 'Following the river upstream, you find a pipe discharging cloudy water directly into the river. There\'s also a strong chemical smell.',
                x: 400, y: 250,
                image: '🏭', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h5', text: 'Direct discharge is a point source of pollution' }],
                notes: 'Identifying pollution sources through field investigation',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c9', text: 'Document everything and contact authorities', target: 'scene_9' },
                    { id: 'c10', text: 'Take water samples from the discharge', target: 'scene_10' }
                ]
            },
            scene_5: {
                id: 'scene_5',
                title: 'Agricultural Impact Confirmed',
                text: 'Your analysis is correct! The excess nutrients are causing eutrophication - algae overgrowth that depletes oxygen and harms fish.',
                x: 700, y: 50,
                image: '🌱', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h6', text: 'Eutrophication is a major water pollution problem worldwide' }],
                notes: 'Understanding the eutrophication process',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c11', text: 'Develop a restoration plan', target: 'scene_11' }
                ]
            },
            scene_6: {
                id: 'scene_6',
                title: 'Seasonal Changes?',
                text: 'While seasons can affect water quality, the dramatic change and chemical evidence suggest human causes rather than natural variation.',
                x: 700, y: 100,
                image: '🤔', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h7', text: 'Natural changes are usually gradual, not sudden' }],
                notes: 'Distinguishing natural vs. human-caused changes',
                estimatedReadTime: 1,
                choices: [
                    { id: 'c12', text: 'Look for human-caused pollution sources', target: 'scene_4' }
                ]
            },
            scene_7: {
                id: 'scene_7',
                title: 'Industrial Investigation',
                text: 'Good thinking! Your investigation reveals illegal chemical dumping. The evidence helps authorities shut down the polluting operation.',
                x: 700, y: 150,
                image: '⚖️', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h8', text: 'Environmental laws protect our water resources' }],
                notes: 'Legal aspects of environmental protection',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c13', text: 'Begin lake restoration', target: 'scene_11' }
                ]
            },
            scene_8: {
                id: 'scene_8',
                title: 'Factory Investigation',
                text: 'At the factory, you discover they\'re following regulations, but there\'s still runoff during heavy rains. This is non-point source pollution.',
                x: 700, y: 200,
                image: '🌧️', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h9', text: 'Non-point source pollution is harder to control than point sources' }],
                notes: 'Different types of pollution sources',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c14', text: 'Work with factory on better practices', target: 'scene_12' }
                ]
            },
            scene_9: {
                id: 'scene_9',
                title: 'Environmental Justice',
                text: 'Your documentation leads to legal action. The company is fined and must clean up their discharge. You\'ve protected the lake!',
                x: 700, y: 250,
                image: '🛡️', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h10', text: 'Documentation is crucial for environmental protection' }],
                notes: 'Importance of evidence in environmental cases',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c15', text: 'Monitor recovery progress', target: 'scene_13' }
                ]
            },
            scene_10: {
                id: 'scene_10',
                title: 'Evidence Gathering',
                text: 'Your water samples show dangerous levels of heavy metals and toxins. This evidence will be crucial for stopping the pollution.',
                x: 700, y: 300,
                image: '📊', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h11', text: 'Scientific evidence is the foundation of environmental law' }],
                notes: 'Role of data in environmental protection',
                estimatedReadTime: 1,
                choices: [
                    { id: 'c16', text: 'Present findings to authorities', target: 'scene_9' }
                ]
            },
            scene_11: {
                id: 'scene_11',
                title: 'Lake Restoration Success',
                text: 'Your restoration plan works! After 6 months of reduced nutrient input and natural recovery, fish are returning and the water is clear again.',
                x: 1000, y: 100,
                image: '🐟', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h12', text: 'Ecosystems can recover when pollution sources are controlled' }],
                notes: 'Successful environmental restoration case study',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c17', text: 'Share your success story', target: 'scene_14' }
                ]
            },
            scene_12: {
                id: 'scene_12',
                title: 'Collaborative Solution',
                text: 'Working with the factory, you design buffer zones and retention ponds that capture runoff before it reaches the lake.',
                x: 1000, y: 200,
                image: '🤝', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h13', text: 'Collaboration often leads to better long-term solutions' }],
                notes: 'Partnership approach to environmental problems',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c18', text: 'Monitor the improved system', target: 'scene_13' }
                ]
            },
            scene_13: {
                id: 'scene_13',
                title: 'Long-term Monitoring',
                text: 'Your continued monitoring shows steady improvement. The lake ecosystem is recovering, and you\'ve established a model for other communities.',
                x: 1000, y: 300,
                image: '📈', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h14', text: 'Long-term monitoring is essential for environmental protection' }],
                notes: 'Importance of ongoing environmental monitoring',
                estimatedReadTime: 2,
                choices: [
                    { id: 'c19', text: 'Teach others about lake protection', target: 'scene_14' }
                ]
            },
            scene_14: {
                id: 'scene_14',
                title: 'Environmental Hero!',
                text: 'Congratulations! You\'ve successfully saved Lake Crystal and become an environmental hero. Your work inspires others to protect their local ecosystems.',
                x: 1300, y: 200,
                image: '🏆', imageType: 'emoji', category: 'info',
                hints: [{ id: 'h15', text: 'Every person can make a difference in environmental protection!' }],
                notes: 'Celebration of environmental stewardship',
                estimatedReadTime: 2,
                choices: []
            }
        },
        startSceneId: 'scene_1',
        storyMetadata: {
            title: 'Environmental Hero: Saving Lake Crystal',
            description: 'Learn environmental science through a pollution investigation',
            subject: 'Environmental Science',
            difficulty: 'Intermediate',
            learningObjectives: ['Understand water pollution causes and effects', 'Learn scientific investigation methods', 'Explore environmental problem-solving'],
            tags: ['environment', 'pollution', 'water quality', 'scientific method', 'ecology']
        }
    }
};

function loadSampleStory(storyKey) {
    if (!sampleStories[storyKey]) return;
    
    if (Object.keys(data.scenes).length > 0) {
        if (!confirm('This will replace your current story. Continue?')) {
            return;
        }
    }
    
    data = JSON.parse(JSON.stringify(sampleStories[storyKey])); // Deep copy
    selectScene(null);
    renderAll();
    saveToLocal();
}

// Make functions globally available
window.updateChoiceText = updateChoiceText;
window.updateChoiceTarget = updateChoiceTarget;
window.deleteChoice = deleteChoice;
window.updateHintText = updateHintText;
window.deleteHint = deleteHint;
window.shareScene = shareScene;
window.loadSampleStory = loadSampleStory;

// Initialize app
if (typeof window !== 'undefined') {
    // Check if we're viewing a shared scene
    const urlParams = new URLSearchParams(window.location.search);
    const sharedSceneData = urlParams.get('scene');
    
    if (sharedSceneData) {
        document.addEventListener('DOMContentLoaded', () => loadSharedScene(sharedSceneData));
    } else {
        // Normal app initialization
        document.addEventListener('DOMContentLoaded', () => {
            loadFromLocal();
            renderAll();
            
            // Add keyboard shortcuts
            document.addEventListener('keydown', function(e) {
                if (e.key === 'n' || e.key === 'N') {
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        createScene();
                    }
                } else if (e.key === ' ') {
                    e.preventDefault();
                    previewStory();
                }
            });
            
            // Add click handler to deselect scenes when clicking empty space
            document.getElementById('board').addEventListener('click', function(e) {
                if (e.target === this) {
                    selectScene(null);
                }
            });
        });
    }
}
