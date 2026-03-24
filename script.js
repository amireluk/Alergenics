// State Management
let tasks = [];
let sessionHistory = new Map(); // Robust per-item undo storage

// Master Allergen List (Hebrew - MoH Israel)
const mohAllergens = [
    'חלב', 'ביצים', 'בוטנים', 'סויה', 'חיטה', 
    'אגוזי לוז', 'אגוזי מלך', 'אגוזי קשיו', 'אגוזי פקאן', 'פיסטוק', 
    'שקדים', 'צנוברים', 'שומשום', 'דגים', 
    'סרטנים', 'רכיכות', 'סלרי', 'חרדל', 'תורמוס', 'גופרית'
];

// Emoji Mapping
const allergenMap = {
    'בוטנים': '🥜', 'חלב': '🥛', 'ביצים': '🥚', 'ביצה': '🥚', 'חיטה': '🌾',
    'גלוטן': '🌾', 'דגים': '🐟', 'דג': '🐟', 'סויה': '🫘', 'אגוזי לוז': '🌰',
    'אגוזי מלך': '🌰', 'אגוזי קשיו': '🌰', 'אגוזי פקאן': '🌰', 'פיסטוק': '🌰',
    'שקדים': '🌰', 'צנוברים': '🌲', 'שומשום': '🥯', 'טחינה': '🥯',
    'סרטנים': '🦐', 'רכיכות': '🐚', 'סלרי': '🌿', 'חרדל': '🌭',
    'תורמוס': '🌸', 'גופרית': '🍷', 'אבק': '🧹', 'חתול': '🐈',
    'כלב': '🐕', 'תות': '🍓', 'תפוח': '🍎', 'דבש': '🍯'
};

let itemCadences = {}; 

// DOM Elements
const pendingList = document.getElementById('pending-list');
const viewAgenda = document.getElementById('view-agenda');
const viewTrack = document.getElementById('view-track');
const masterListContainer = document.getElementById('master-list-container');
const btnFinishManage = document.getElementById('btn-finish-manage');
const btnOpenSettings = document.getElementById('btn-open-settings');
const bottomNav = document.getElementById('bottom-nav');

// Audio Context for click sound
let audioCtx = null;
function playClickSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) { /* Audio fails silently */ }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setupEventListeners();
    render();
    
    // Initial state for History API
    window.history.replaceState({ view: 'agenda' }, '');
});

function setupEventListeners() {
    btnOpenSettings.addEventListener('click', () => {
        playClickSound();
        switchView('track', true);
    });
    
    btnFinishManage.addEventListener('click', () => {
        playClickSound();
        switchView('agenda', true);
    });

    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.view) {
            switchView(event.state.view, false);
        } else {
            switchView('agenda', false);
        }
    });
}

function switchView(target, pushToHistory) {
    if (pushToHistory) {
        window.history.pushState({ view: target }, '');
    }

    if (target === 'track') {
        viewAgenda.classList.add('hidden');
        viewTrack.classList.remove('hidden');
        bottomNav.classList.add('hidden');
        renderMasterList();
    } else {
        viewTrack.classList.add('hidden');
        viewAgenda.classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        render();
    }
}

function loadTasks() {
    const stored = localStorage.getItem('alergenics_tasks_he');
    if (stored) {
        tasks = JSON.parse(stored);
        tasks.forEach(t => { itemCadences[t.name] = t.freqValue; });
    }
}

function saveTasks() {
    localStorage.setItem('alergenics_tasks_he', JSON.stringify(tasks));
}

function calculateNextDue(lastDoneStr, freqValue) {
    const lastDone = new Date(lastDoneStr);
    const nextDue = new Date(lastDone);
    nextDue.setUTCDate(lastDone.getUTCDate() + parseInt(freqValue));
    return nextDue.toISOString();
}

function getDaysDifference(isoStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(isoStr);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isSameDay(isoStr1, isoStr2) {
    if (!isoStr1 || !isoStr2) return false;
    const d1 = new Date(isoStr1);
    const d2 = new Date(isoStr2);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
}

function getEmoji(name) {
    return allergenMap[name.trim()] || '🍴';
}

function renderMasterList() {
    masterListContainer.innerHTML = '';
    mohAllergens.forEach(name => {
        const isTracked = tasks.some(t => t.name === name);
        if (!itemCadences[name]) itemCadences[name] = 3;

        const btnContainer = document.createElement('div');
        btnContainer.className = `btn-allergen-toggle ${isTracked ? 'tracked' : ''}`;
        
        btnContainer.innerHTML = `
            <div class="allergen-main-info" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                <span class="emoji" style="font-size: 1.5rem;">${getEmoji(name)}</span>
                <span class="name" style="font-size: 0.9rem; font-weight: 600;">${name}</span>
            </div>
            <div class="cadence-ctrl">
                <button class="btn-qty minus">-</button>
                <span class="cadence-val">${itemCadences[name]}</span>
                <button class="btn-qty plus">+</button>
            </div>
        `;
        
        btnContainer.querySelector('.allergen-main-info').onclick = () => {
            playClickSound();
            isTracked ? untrackAllergen(name) : trackAllergen(name);
        };

        btnContainer.querySelector('.minus').onclick = (e) => {
            e.stopPropagation();
            playClickSound();
            updateCadence(name, -1);
        };
        btnContainer.querySelector('.plus').onclick = (e) => {
            e.stopPropagation();
            playClickSound();
            updateCadence(name, 1);
        };

        masterListContainer.appendChild(btnContainer);
    });
}

function updateCadence(name, delta) {
    const newVal = Math.max(1, (itemCadences[name] || 3) + delta);
    itemCadences[name] = newVal;
    const task = tasks.find(t => t.name === name);
    if (task) {
        task.freqValue = newVal;
        saveTasks();
    }
    renderMasterList();
}

function trackAllergen(name) {
    const todayISO = new Date().toISOString();
    const newTask = {
        id: Date.now(),
        name: name,
        freqValue: itemCadences[name] || 3,
        freqUnit: 'days',
        lastDone: null,
        nextDue: todayISO 
    };
    tasks.push(newTask);
    saveTasks();
    renderMasterList();
}

function untrackAllergen(name) {
    const index = tasks.findIndex(t => t.name === name);
    if (index !== -1) {
        tasks.splice(index, 1);
        saveTasks();
        renderMasterList();
    }
}

function render() {
    if (!pendingList) return;
    pendingList.innerHTML = '';
    
    if (tasks.length === 0) {
        pendingList.innerHTML = '<p class="empty-msg">אין אלרגנים במעקב. עברו להגדרות כדי להתחיל!</p>';
        return;
    }

    const todayISO = new Date().toISOString();
    
    // Sort tasks primarily by nextDue
    const sortedTasks = [...tasks].sort((a, b) => new Date(a.nextDue) - new Date(b.nextDue));

    // Groups
    const groups = [
        { title: 'היום ובאיחור', items: [] },
        { title: 'מחר', items: [] },
        { title: 'בהמשך', items: [] }
    ];

    sortedTasks.forEach(task => {
        // Special logic: If lastDone is today, it stays in "Today" section regardless of nextDue
        if (isSameDay(task.lastDone, todayISO)) {
            groups[0].items.push(task);
            return;
        }

        const diff = getDaysDifference(task.nextDue);
        if (diff <= 0) groups[0].items.push(task);
        else if (diff === 1) groups[1].items.push(task);
        else groups[2].items.push(task);
    });

    groups.forEach(group => {
        if (group.items.length === 0) return;

        const title = document.createElement('div');
        title.className = 'agenda-section-title';
        title.innerText = group.title;
        pendingList.appendChild(title);

        group.items.forEach(task => {
            const card = document.createElement('div');
            card.className = 'action-card';
            
            const diff = getDaysDifference(task.nextDue);
            const isDoneToday = isSameDay(task.lastDone, todayISO);
            
            let statusText = '';
            let statusClass = '';
            
            if (isDoneToday) {
                statusText = 'בוצע בהצלחה!';
                statusClass = 'status-ok';
            } else if (diff < 0) {
                statusText = `באיחור של ${Math.abs(diff)} ימים`;
                statusClass = 'status-overdue';
            } else if (diff === 0) {
                statusText = 'היום';
                statusClass = 'status-due';
            } else if (diff === 1) {
                statusText = 'מחר';
                statusClass = 'status-ok';
            } else {
                statusText = `בעוד ${diff} ימים`;
                statusClass = 'status-ok';
            }

            const canUndo = sessionHistory.has(task.id);
            
            card.innerHTML = `
                <div class="action-info">
                    <h3 style="display:flex; align-items:center;">
                        ${task.name} ${getEmoji(task.name)}
                        ${isDoneToday ? '<span class="checkmark">✅</span>' : ''}
                    </h3>
                    <p class="${statusClass}">${statusText}</p>
                </div>
                <div class="action-buttons">
                    ${isDoneToday || canUndo ? 
                        `<button class="btn-undo-item" onclick="undoItem(${task.id})">בטל</button>` : 
                        (diff <= 0 ? `<button class="btn-done" onclick="markAsDone(${task.id})">בוצע</button>` : '')
                    }
                </div>
            `;
            pendingList.appendChild(card);
        });
    });
}

window.markAsDone = function(id) {
    playClickSound();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        // Save state for undo
        sessionHistory.set(id, { ...tasks[index] });
        
        const todayISO = new Date().toISOString();
        tasks[index].lastDone = todayISO;
        tasks[index].nextDue = calculateNextDue(todayISO, tasks[index].freqValue);
        
        saveTasks();
        render();
    }
};

window.undoItem = function(id) {
    playClickSound();
    if (sessionHistory.has(id)) {
        const prevState = sessionHistory.get(id);
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = prevState;
            sessionHistory.delete(id);
            saveTasks();
            render();
        }
    }
};
