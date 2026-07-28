// Define our data structures
interface Mod {
    id: string;
    name: string;
    real_path: string;
    thumb: string;
    url: string;
}

interface AppConfig {
    WORKSHOP_DIR: string;
    GAME_DATA_DIR: string;
    SCRIPT_FILE: string;
}

declare const Sortable: any;
let allMods: Mod[] = [];

// --- SETTINGS LOGIC ---
async function checkConfig(): Promise<boolean> {
    const res = await fetch('/api/config');
    const config: AppConfig = await res.json();
    
    (document.getElementById('config-workshop') as HTMLInputElement).value = config.WORKSHOP_DIR || "";
    (document.getElementById('config-data') as HTMLInputElement).value = config.GAME_DATA_DIR || "";
    (document.getElementById('config-script') as HTMLInputElement).value = config.SCRIPT_FILE || "";

    if (!config.WORKSHOP_DIR || !config.GAME_DATA_DIR || !config.SCRIPT_FILE) {
        document.getElementById('settings-modal')!.style.display = 'flex';
        document.getElementById('close-modal-btn')!.style.display = 'none';
        return false;
    }
    return true;
}

async function openSettings(): Promise<void> {
    await checkConfig();
    document.getElementById('settings-modal')!.style.display = 'flex';
    document.getElementById('close-modal-btn')!.style.display = 'block';
}

function closeSettings(): void {
    document.getElementById('settings-modal')!.style.display = 'none';
}

async function saveSettings(): Promise<void> {
    const config: AppConfig = {
        WORKSHOP_DIR: (document.getElementById('config-workshop') as HTMLInputElement).value.trim(),
        GAME_DATA_DIR: (document.getElementById('config-data') as HTMLInputElement).value.trim(),
        SCRIPT_FILE: (document.getElementById('config-script') as HTMLInputElement).value.trim()
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
function createModElement(mod: Mod): HTMLDivElement {
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

function updateLoadOrderNumbers(): void {
    document.querySelectorAll('#active-mods .mod-item').forEach((el, index) => {
        (el.querySelector('.order-num') as HTMLElement).innerText = (index + 1).toString();
    });
    document.querySelectorAll('#inactive-mods .mod-item').forEach(el => {
        (el.querySelector('.order-num') as HTMLElement).innerText = '-';
    });
}

async function init(): Promise<void> {
    const isConfigured = await checkConfig();
    if (!isConfigured) return; 

    const inactiveContainer = document.getElementById('inactive-mods');
    if (!inactiveContainer) return;

    const response = await fetch('/api/mods');
    allMods = await response.json();
    
    allMods.forEach(mod => {
        inactiveContainer.appendChild(createModElement(mod));
    });

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
function filterInactive(): void {
    const term = (document.getElementById('search-inactive') as HTMLInputElement).value.toLowerCase();
    document.querySelectorAll('#inactive-mods .mod-item').forEach(el => {
        const name = (el.querySelector('.mod-name') as HTMLElement).innerText.toLowerCase();
        (el as HTMLElement).style.display = name.includes(term) ? 'flex' : 'none';
    });
}

function filterActive(): void {
    const term = (document.getElementById('search-active') as HTMLInputElement).value.toLowerCase();
    document.querySelectorAll('#active-mods .mod-item').forEach(el => {
        const name = (el.querySelector('.mod-name') as HTMLElement).innerText.toLowerCase();
        (el as HTMLElement).style.display = name.includes(term) ? 'flex' : 'none';
    });
}

// --- PRESET LOGIC ---
async function refreshPresetDropdown(): Promise<void> {
    const res = await fetch('/api/presets');
    const presets: string[] = await res.json();
    const select = document.getElementById('preset-select') as HTMLSelectElement;
    
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">-- Select Preset --</option>';
    presets.forEach(p => {
        const isSelected = p === currentValue ? 'selected' : '';
        select.innerHTML += `<option value="${p}" ${isSelected}>${p}</option>`;
    });
}

async function savePreset(): Promise<void> {
    const name = (document.getElementById('preset-name') as HTMLInputElement).value.trim();
    if(!name) {
        alert('Please enter a preset name!');
        return;
    }

    const activeElements = document.getElementById('active-mods')!.children;
    const currentOrder = Array.from(activeElements).map(el => {
        return allMods.find(m => m.id === (el as HTMLElement).dataset.id);
    }).filter(Boolean);

    const response = await fetch(`/api/preset/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentOrder)
    });
    const result = await response.json();
    
    (document.getElementById('preset-select') as HTMLSelectElement).value = name;
    
    alert(result.message);
    refreshPresetDropdown();
}

async function loadPreset(): Promise<void> {
    const name = (document.getElementById('preset-select') as HTMLSelectElement).value;
    if(!name) {
        alert('Please select a preset to load.');
        return;
    }

    const res = await fetch(`/api/preset/${name}`);
    const activeData: Mod[] = await res.json();
    const activeIds = activeData.map(m => m.id);

    const activeContainer = document.getElementById('active-mods')!;
    const inactiveContainer = document.getElementById('inactive-mods')!;
    activeContainer.innerHTML = '';
    inactiveContainer.innerHTML = '';

    activeData.forEach(mod => activeContainer.appendChild(createModElement(mod)));

    allMods.forEach(mod => {
        if(!activeIds.includes(mod.id)) {
            inactiveContainer.appendChild(createModElement(mod));
        }
    });
    
    (document.getElementById('search-inactive') as HTMLInputElement).value = '';
    (document.getElementById('search-active') as HTMLInputElement).value = '';
    filterInactive();
    filterActive();
    
    updateLoadOrderNumbers();
    
    (document.getElementById('preset-name') as HTMLInputElement).value = name;
}

async function deletePreset(): Promise<void> {
    const name = (document.getElementById('preset-select') as HTMLSelectElement).value;
    if(!name) {
        alert('Please select a preset to delete.');
        return;
    }

    const confirmed = confirm(`Are you sure you want to delete the preset "${name}"? This cannot be undone.`);
    if(!confirmed) return;

    const response = await fetch(`/api/preset/${name}`, { method: 'DELETE' });
    const result = await response.json();
    
    alert(result.message);
    
    (document.getElementById('preset-select') as HTMLSelectElement).value = "";
    (document.getElementById('preset-name') as HTMLInputElement).value = "";
    refreshPresetDropdown();
}

// --- SYMLINK APPLICATION ---
async function applyLoadOrder(): Promise<void> {
    const activeElements = document.getElementById('active-mods')!.children;
    const currentOrder = Array.from(activeElements).map(el => {
        return allMods.find(m => m.id === (el as HTMLElement).dataset.id);
    }).filter(Boolean);

    const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentOrder)
    });
    const result = await response.json();
    alert(result.message);
}

// Attach functions to window
(window as any).openSettings = openSettings;
(window as any).closeSettings = closeSettings;
(window as any).saveSettings = saveSettings;
(window as any).filterInactive = filterInactive;
(window as any).filterActive = filterActive;
(window as any).loadPreset = loadPreset;
(window as any).savePreset = savePreset;
(window as any).deletePreset = deletePreset;
(window as any).applyLoadOrder = applyLoadOrder;

window.onload = init;

// --- HEARTBEAT LOGIC ---
// Ping the backend every 2 seconds. When this window closes, the pings stop, and the backend shuts down.
setInterval(() => {
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
}, 2000);