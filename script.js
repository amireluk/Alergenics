// State Management
let tasks = [];
let lastAction = null;
let movedThisSession = new Set(); 

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
const navItems = document.querySelectorAll('.nav-item');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setupEventListeners();
    render();
});

function setupEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            switchView(target);
        });
    });

    btnFinishManage.addEventListener('click', () => switchView('agenda'));
}

function switchView(target) {
    // Update Nav UI
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-target') === target);
    });

    if (target === 'track') {
        viewAgenda.classList.add('hidden');
        viewTrack.classList.remove('hidden');
        renderMasterList();
    } else {
        viewTrack.classList.add('hidden');
        viewAgenda.classList.remove('hidden');
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

function calculateNextDue(lastDoneStr, freqValue, freqUnit) {
    const lastDone = new Date(lastDoneStr);
    const nextDue = new Date(lastDone);
    const val = parseInt(freqValue);
    nextDue.setUTCDate(lastDone.getUTCDate() + val); // Always days for now
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

function getEmoji(name) {
    return allergenMap[name.trim()] || '';
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
            isTracked ? untrackAllergen(name) : trackAllergen(name);
        };

        btnContainer.querySelector('.minus').onclick = (e) => {
            e.stopPropagation();
            updateCadence(name, -1);
        };
        btnContainer.querySelector('.plus').onclick = (e) => {
            e.stopPropagation();
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
    lastAction = null;
    renderMasterList();
}

function untrackAllergen(name) {
    const index = tasks.findIndex(t => t.name === name);
    if (index !== -1) {
        lastAction = { type: 'untrack', prevData: { ...tasks[index] }, index: index };
        tasks.splice(index, 1);
        saveTasks();
        renderMasterList();
    }
}

function render() {
    if (!pendingList) return;
    pendingList.innerHTML = '';
    
    if (tasks.length === 0) {
        pendingList.innerHTML = '<p class="empty-msg">אין אלרגנים במעקב. עברו לניהול כדי להתחיל!</p>';
        return;
    }

    const sortedTasks = [...tasks].sort((a, b) => new Date(a.nextDue) - new Date(b.nextDue));
    let splitLineAdded = false;

    sortedTasks.forEach((task, index) => {
        const diff = getDaysDifference(task.nextDue);
        if (!splitLineAdded && diff > 0 && index > 0) {
            const hr = document.createElement('div');
            hr.className = 'agenda-divider';
            pendingList.appendChild(hr);
            splitLineAdded = true;
        }

        const card = document.createElement('div');
        card.className = 'action-card';
        
        let statusText = '';
        let statusClass = '';
        if (diff < 0) {
            statusText = `באיחור של ${Math.abs(diff)} ימים`;
            statusClass = 'status-overdue';
        } else if (diff === 0) {
            statusText = 'היום';
            statusClass = 'status-due';
        } else {
            statusText = `בעוד ${diff} ימים`;
            statusClass = 'status-ok';
        }

        const isMoved = movedThisSession.has(task.id);
        const showBtn = diff <= 0 || isMoved;
        const btnText = isMoved ? 'בטל' : 'בוצע';
        const btnClass = isMoved ? 'btn-undo-item' : 'btn-done';
        const btnAction = isMoved ? `undoItem(${task.id})` : `markAsDone(${task.id})`;

        card.innerHTML = `
            <div class="action-info">
                <h3 style="margin:0; font-size: 1.1rem;">${task.name} ${getEmoji(task.name)}</h3>
                <p class="${statusClass}" style="margin:0; font-size: 0.9rem;">${statusText}</p>
            </div>
            ${showBtn ? `<button class="${btnClass}" onclick="${btnAction}">${btnText}</button>` : ''}
        `;
        pendingList.appendChild(card);
    });
}

window.markAsDone = function(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        lastAction = { type: 'done', index: index, prevData: { ...tasks[index] } };
        const todayISO = new Date().toISOString();
        tasks[index].lastDone = todayISO;
        tasks[index].nextDue = calculateNextDue(todayISO, tasks[index].freqValue, tasks[index].freqUnit);
        movedThisSession.add(id);
        saveTasks();
        render();
    }
};

window.undoItem = function(id) {
    undoLastAction();
};

function undoLastAction() {
    if (lastAction) {
        if (lastAction.type === 'done') {
            tasks[lastAction.index] = { ...lastAction.prevData };
            movedThisSession.delete(lastAction.prevData.id);
        } else if (lastAction.type === 'untrack') {
            tasks.splice(lastAction.index, 0, lastAction.prevData);
        }
        saveTasks();
        lastAction = null;
        render();
        if (!viewTrack.classList.contains('hidden')) renderMasterList();
    }
}
