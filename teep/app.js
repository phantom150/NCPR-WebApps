let events = [];
let editingEventId = null;

// Define semester boundaries
const seasonDates = {
    "Fall": { start: "08-01", end: "12-31" },
    "Spring": { start: "01-01", end: "05-31" },
    "Summer": { start: "06-01", end: "07-31" }
};
const seasonOrder = ["Spring", "Summer", "Fall"];
const units = ["UNC", "Duke", "NCSU", "Other"];

window.onload = () => {
    fetch('default_data.json')
        .then(response => response.json())
        .then(data => {
            processLoadedData(data);
        })
        .catch(err => {
            console.warn("Browser blocked auto-loading the JSON (CORS policy for local files). Please load manually.");
            updateGrid();
        });
};

function processLoadedData(data) {
    if (Array.isArray(data)) {
        // Fallback if the old array-style JSON is loaded
        events = data;
        alert("Success: Loaded events, but no timeframe data was found in this file.");
    } else if (data && data.events) {
        // New JSON format containing timeframe data
        events = data.events;
        if (data.timeframe) {
            document.getElementById("start-year").value = data.timeframe.year;
            document.getElementById("start-season").value = data.timeframe.season;
        }
    } else {
        alert("Error: Unrecognized JSON structure.");
        return;
    }
    cancelEdit(); 
    updateGrid();
}

function changeSemester(direction) {
    let seasonSelect = document.getElementById('start-season');
    let yearInput = document.getElementById('start-year');
    
    let currentSeason = seasonSelect.value;
    let currentYear = parseInt(yearInput.value);
    let idx = seasonOrder.indexOf(currentSeason);

    if (direction === 1) { // Next
        if (idx === 2) {
            seasonSelect.value = "Spring";
            yearInput.value = currentYear + 1;
        } else {
            seasonSelect.value = seasonOrder[idx + 1];
        }
    } else { // Prev
        if (idx === 0) {
            seasonSelect.value = "Fall";
            yearInput.value = currentYear - 1;
        } else {
            seasonSelect.value = seasonOrder[idx - 1];
        }
    }
    updateGrid();
}

function getWeeksForSemester(year, season) {
    let startDate = new Date(`${year}-${seasonDates[season].start}T12:00:00`);
    let endDate = new Date(`${year}-${seasonDates[season].end}T12:00:00`);

    // Wind back to the first Monday
    let day = startDate.getDay();
    let diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    let current = new Date(startDate.setDate(diff));

    let weeks = [];
    let weekNum = 1;
    
    while (current <= endDate) {
        let monthStr = current.toLocaleString('default', { month: 'short' });
        let startOfWeek = new Date(current);
        let endOfWeek = new Date(current.getTime() + 6 * 24 * 60 * 60 * 1000); 
        
        weeks.push({
            label: `Wk ${weekNum}<br>${monthStr} ${current.getDate()}`,
            start: startOfWeek,
            end: endOfWeek
        });
        
        current.setDate(current.getDate() + 7);
        weekNum++;
    }
    return weeks;
}

function updateGrid() {
    const year = document.getElementById("start-year").value;
    const season = document.getElementById("start-season").value;
    const filter = document.getElementById("day-filter").value;
    const weeks = getWeeksForSemester(year, season);
    
    const container = document.getElementById("teep-container");
    
    let gridStyle = `grid-template-columns: 120px repeat(${weeks.length}, minmax(90px, 1fr));`;
    let html = `<div class="teep-grid" style="${gridStyle}">`;

    html += `<div class="semester-header row-header">Unit</div>`;
    html += `<div class="semester-header" style="grid-column: span ${weeks.length}">${season} ${year}</div>`;

    html += `<div class="header-row row-header">Week Of</div>`;
    weeks.forEach(w => {
        html += `<div class="header-row cell" style="font-size:12px;">${w.label}</div>`;
    });

    units.forEach(unit => {
        html += `<div class="row-header">${unit === "Other" ? "Other/NCPR" : unit}</div>`;
        
        weeks.forEach(week => {
            const cellEvents = events.filter(e => {
                if (e.unit !== unit || !e.startDate) return false;
                
                let eStart = new Date(`${e.startDate}T12:00:00`);
                let eEnd = new Date(`${e.endDate}T12:00:00`);
                
                if (eStart > week.end || eEnd < week.start) return false;

                if (filter === 'all') return true;

                let overlapStart = eStart > week.start ? eStart : week.start;
                let overlapEnd = eEnd < week.end ? eEnd : week.end;

                let hasWeekday = false;
                let hasWeekend = false;

                let currentDay = new Date(overlapStart);
                while (currentDay <= overlapEnd) {
                    let dayOfWeek = currentDay.getDay(); 
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        hasWeekend = true;
                    } else {
                        hasWeekday = true;
                    }
                    currentDay.setDate(currentDay.getDate() + 1);
                }

                if (filter === 'weekdays' && hasWeekday) return true;
                if (filter === 'weekends' && hasWeekend) return true;

                return false;
            });
            
            let eventsHtml = cellEvents.map((e) => {
                let eStart = new Date(`${e.startDate}T12:00:00`);
                let eEnd = new Date(`${e.endDate}T12:00:00`);
                let dateDisplay = e.startDate === e.endDate ? e.startDate : `${e.startDate} to ${e.endDate}`;
                
                let spansLeft = eStart < week.start;
                let spansRight = eEnd > week.end;

                let classes = `event-item cat-${e.category}`;
                if (spansLeft) classes += ` spans-left`;
                if (spansRight) classes += ` spans-right`;

                let prefix = spansLeft ? '◀ ' : '';
                let suffix = spansRight ? ' ▶' : '';

                return `
                <div class="${classes}" title="${e.title} (${dateDisplay})">
                    <span class="title">${prefix}${e.title}${suffix}</span>
                    <div class="event-actions">
                        <span class="edit-btn" title="Edit" onclick="editEvent('${e.id}')">✎</span>
                        <span class="delete-btn" title="Delete" onclick="deleteEvent('${e.id}')">×</span>
                    </div>
                </div>
                `;
            }).join('');

            html += `<div class="cell">${eventsHtml}</div>`;
        });
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

function submitEvent() {
    const title = document.getElementById("event-title").value;
    const unit = document.getElementById("event-unit").value;
    const startDate = document.getElementById("event-start-date").value; 
    let endDate = document.getElementById("event-end-date").value;
    const category = document.getElementById("event-category").value;

    if (!title || !startDate) {
        alert("Please provide a title and a start date.");
        return;
    }

    if (!endDate) {
        endDate = startDate;
    } else if (new Date(endDate) < new Date(startDate)) {
        alert("End date cannot be before start date.");
        return;
    }

    if (editingEventId) {
        const index = events.findIndex(e => e.id === editingEventId);
        if (index !== -1) {
            events[index] = { id: editingEventId, title, unit, startDate, endDate, category };
        }
        cancelEdit(); 
    } else {
        events.push({ id: Date.now().toString(), title, unit, startDate, endDate, category });
        clearForm();
    }
    
    updateGrid();
}

function editEvent(id) {
    const eventToEdit = events.find(e => e.id === id);
    if (!eventToEdit) return;

    document.getElementById("event-title").value = eventToEdit.title;
    document.getElementById("event-unit").value = eventToEdit.unit;
    document.getElementById("event-start-date").value = eventToEdit.startDate;
    document.getElementById("event-end-date").value = eventToEdit.endDate;
    document.getElementById("event-category").value = eventToEdit.category;

    editingEventId = id;
    document.getElementById("form-header").innerText = "Edit Event";
    document.getElementById("submit-btn").innerText = "Update Event";
    document.getElementById("cancel-btn").style.display = "inline-block";
}

function cancelEdit() {
    editingEventId = null;
    document.getElementById("form-header").innerText = "Add Event";
    document.getElementById("submit-btn").innerText = "Add Event";
    document.getElementById("cancel-btn").style.display = "none";
    clearForm();
}

function clearForm() {
    document.getElementById("event-title").value = ''; 
    document.getElementById("event-start-date").value = '';
    document.getElementById("event-end-date").value = '';
}

function deleteEvent(id) {
    events = events.filter(e => e.id !== id);
    updateGrid();
}

function saveJSON() {
    const year = document.getElementById("start-year").value;
    const season = document.getElementById("start-season").value;
    
    const exportData = {
        timeframe: {
            year: year,
            season: season
        },
        events: events
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ncpr_teep_data.json';
    a.click();
    URL.revokeObjectURL(url);
}

function loadJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            processLoadedData(data);
        } catch (error) {
            alert("Error parsing JSON file.");
        }
    };
    reader.readAsText(file);
    
    // Crucial: Reset the input so choosing the same file again triggers the load
    event.target.value = '';
}