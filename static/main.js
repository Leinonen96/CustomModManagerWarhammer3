let allMods = [];

// --- SETTINGS LOGIC ---
async function checkConfig() {
    const res = await fetch('/api/config');
    const config = await res.json();
    
    document.getElementById('config-workshop').value = config.WORKSHOP_DIR || "";
    document.getElementById('config-data').value = config.GAME_DATA_DIR || "";
    document.getElementById('config-script').value = config.SCRIPT_FILE || "";

    // If paths are missing, force the modal open and hide the cancel button
    if (!config.WORKSHOP_DIR || !config.GAME_DATA_DIR || !config.SCRIPT_FILE) {
        document.getElementById('settings-modal').style.display = 'flex';
        document.getElementById('close-modal-btn').style.display = 'none';
        return false;
    }
    return true;
}

async function openSettings() {
    await checkConfig();
    document.getElementById('settings-modal').style.display = 'flex';
    document.getElementById('close-modal-btn').style.display = 'block';
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

async function saveSettings() {
    const config = {
        WORKSHOP_DIR: document.getElementById('config-workshop').value.trim(),
        GAME_DATA_DIR: document.getElementById('config-data').value.trim(),
        SCRIPT_FILE: document.getElementById('config-script').value.trim()
    };

    const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
    
    const result = await res.json();
    alert(result.message);
    location.reload(); 
}

// --- CORE UI GENERATION ---
function createModElement(mod) {
    const div = document.createElement('div');
    div.className = 'mod-item';
    div.dataset.id = mod.id;
    
    const steamUrl = mod.url || `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}`;
    
    div.innerHTML = `
        <div class="order-num">-</div>
        <img src="${mod.thumb}" alt="Mod Thumbnail">
        <div class="mod-info">
            <div class="mod-name" title="${mod.name}">${mod.name}</div>
            <div class="mod-meta">
                Workshop ID: ${mod.id} | 
                <a href="${steamUrl}" target="_blank" onclick="event.stopPropagation()">View on Steam</a>
            </div>
        </div>
    `;
    return div;
}

function updateLoadOrderNumbers() {
    document.querySelectorAll('#active-mods .mod-item').forEach((el, index) => {
        el.querySelector('.order-num').innerText = index + 1;
    });
    document.querySelectorAll('#inactive-mods .mod-item').forEach(el => {
        el.querySelector('.order-num').innerText = '-';
    });
}

async function init() {
    // Check config before doing anything else
    const isConfigured = await checkConfig();
    if (!isConfigured) return; 

    // Ensure the container elements actually exist before trying to use them
    const inactiveContainer = document.getElementById('inactive-mods');
    if (!inactiveContainer) return;

    const response = await fetch('/api/mods');
    allMods = await response.json();
    
    allMods.forEach(mod => {
        inactiveContainer.appendChild(createModElement(mod));
    });

    // Re-run numbering whenever an item is dropped/sorted
    new Sortable(inactiveContainer, { 
        group: 'shared', 
        animation: 150,
        onSort: updateLoadOrderNumbers 
    });
    
    const activeContainer = document.getElementById('active-mods');
    if (activeContainer) {
        new Sortable(activeContainer, { 
            group: 'shared', 
            animation: 150,
            onSort: updateLoadOrderNumbers
        });
    }

    updateLoadOrderNumbers();
    refreshPresetDropdown();
}

// --- SEARCH LOGIC ---
function filterInactive() {
    const term = document.getElementById('search-inactive').value.toLowerCase();
    document.querySelectorAll('#inactive-mods .mod-item').forEach(el => {
        const name = el.querySelector('.mod-name').innerText.toLowerCase();
        el.style.display = name.includes(term) ? 'flex' : 'none';
    });
}

function filterActive() {
    const term = document.getElementById('search-active').value.toLowerCase();
    document.querySelectorAll('#active-mods .mod-item').forEach(el => {
        const name = el.querySelector('.mod-name').innerText.toLowerCase();
        el.style.display = name.includes(term) ? 'flex' : 'none';
    });
}

// --- PRESET LOGIC ---
async function refreshPresetDropdown() {
    const res = await fetch('/api/presets');
    const presets = await res.json();
    const select = document.getElementById('preset-select');
    
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">-- Select Preset --</option>';
    presets.forEach(p => {
        const isSelected = p === currentValue ? 'selected' : '';
        select.innerHTML += `<option value="${p}" ${isSelected}>${p}</option>`;
    });
}

async function savePreset() {
    const name = document.getElementById('preset-name').value.trim();
    if(!name) return alert('Please enter a preset name!');

    const activeElements = document.getElementById('active-mods').children;
    const currentOrder = Array.from(activeElements).map(el => {
        return allMods.find(m => m.id === el.dataset.id);
    });

    const response = await fetch(`/api/preset/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentOrder)
    });
    const result = await response.json();
    
    document.getElementById('preset-select').value = name;
    
    alert(result.message);
    refreshPresetDropdown();
}

async function loadPreset() {
    const name = document.getElementById('preset-select').value;
    if(!name) return alert('Please select a preset to load.');

    const res = await fetch(`/api/preset/${name}`);
    const activeData = await res.json();
    const activeIds = activeData.map(m => m.id);

    const activeContainer = document.getElementById('active-mods');
    const inactiveContainer = document.getElementById('inactive-mods');
    activeContainer.innerHTML = '';
    inactiveContainer.innerHTML = '';

    activeData.forEach(mod => activeContainer.appendChild(createModElement(mod)));

    allMods.forEach(mod => {
        if(!activeIds.includes(mod.id)) {
            inactiveContainer.appendChild(createModElement(mod));
        }
    });
    
    document.getElementById('search-inactive').value = '';
    document.getElementById('search-active').value = '';
    filterInactive();
    filterActive();
    
    updateLoadOrderNumbers();
    
    document.getElementById('preset-name').value = name;
}

async function deletePreset() {
    const name = document.getElementById('preset-select').value;
    if(!name) return alert('Please select a preset to delete.');

    const confirmed = confirm(`Are you sure you want to delete the preset "${name}"? This cannot be undone.`);
    if(!confirmed) return;

    const response = await fetch(`/api/preset/${name}`, { method: 'DELETE' });
    const result = await response.json();
    
    alert(result.message);
    
    document.getElementById('preset-select').value = "";
    document.getElementById('preset-name').value = "";
    refreshPresetDropdown();
}

// --- SYMLINK APPLICATION ---
async function applyLoadOrder() {
    const activeElements = document.getElementById('active-mods').children;
    const currentOrder = Array.from(activeElements).map(el => {
        return allMods.find(m => m.id === el.dataset.id);
    });

    const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentOrder)
    });
    const result = await response.json();
    alert(result.message);
}

window.onload = init;