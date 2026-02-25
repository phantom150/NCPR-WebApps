// Strict 3 Academic Years Configuration
const START_YEAR = 2025;
const START_MONTH = 6; // June 2025 (Start of Summer Period)
const TOTAL_MONTHS = 36; // Covers exactly AY 25-26, AY 26-27, AY 27-28

const colorMap = { "UNC": "#7BAFD4", "Duke": "#003087", "NCSU": "#CC0000", "NCPR": "#555555" };

// Initialize as an empty array; data will be fetched on load.
let staffData = [];

// Fetch initial data from JSON file
async function loadInitialData() {
    try {
        const response = await fetch('default_dat.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        staffData = await response.json();
    } catch (error) {
        console.error("Could not load default_dat.json. Starting with empty chart.", error);
        alert("Failed to load initial data. If running locally, you may need a local server.");
    } finally {
        // Render the Gantt chart whether data loaded successfully or is empty
        renderGantt(); 
    }
}

function getMonthIndex(dateStr) {
    if (!dateStr) return null;
    let [y, m] = dateStr.split('-');
    return ((parseInt(y) - START_YEAR) * 12) + (parseInt(m) - START_MONTH);
}

function renderBlock(start, end, customStyle, label, title, rowNum, id) {
    if (start >= TOTAL_MONTHS || end <= 0 || start >= end) return '';
    let s = Math.max(0, start);
    let e = Math.min(TOTAL_MONTHS, end);
    let width = e - s;
    if (width <= 0) return '';
    
    return `<div class="bar-segment" style="grid-column: ${s + 2} / span ${width}; grid-row: ${rowNum}; ${customStyle}" title="${title}" onclick="editStaff('${id}')">
                <span class="seg-label" style="${customStyle.includes('#ff') ? 'color:black; text-shadow:none;' : ''}">${label}</span>
            </div>`;
}

function renderMarker(index, color, label, rowNum, topOffset) {
    if (index < 0 || index >= TOTAL_MONTHS) return '';
    return `<div class="milestone-marker" style="grid-column: ${index + 2}; grid-row: ${rowNum}; border-left-color: ${color};">
                <span class="milestone-label" style="color: ${color}; top: ${topOffset}px;">${label}</span>
            </div>`;
}

function renderGantt() {
    const container = document.getElementById('ganttContainer');
    
    let billets = {};
    staffData.forEach(s => {
        let key = `${s.unit} - ${s.billet}`;
        if (!billets[key]) billets[key] = [];
        billets[key].push(s);
    });

    let totalOfficerRows = 0;
    for (let key in billets) {
        totalOfficerRows += billets[key].length;
    }

    let html = `<div class="gantt-grid" style="grid-template-columns: 160px repeat(${TOTAL_MONTHS}, minmax(40px, 1fr));">`;
    
    // Header Row 1: Academic Years
    html += `<div class="row-label" style="grid-column: 1; grid-row: 1; background: #ddd; z-index: 21;">Academic Year</div>`;
    for(let y=0; y<3; y++) {
        html += `<div class="gantt-header-years" style="grid-column: ${2 + (y*12)} / span 12; grid-row: 1;">AY ${2025+y}-${2026+y}</div>`;
    }

    // Header Row 2: Months
    html += `<div class="row-label" style="grid-column: 1; grid-row: 2; background: #eee; z-index: 21;">Month</div>`;
    for (let i = 0; i < TOTAL_MONTHS; i++) {
        let date = new Date(START_YEAR, START_MONTH - 1 + i);
        let m = date.getMonth() + 1;
        let mName = date.toLocaleString('default', { month: 'short' });
        let semClass = (m == 6 || m == 7) ? 'summer' : (m >= 8 && m <= 12) ? 'fall' : 'spring';
        html += `<div class="gantt-header-months bg-col ${semClass}" style="grid-column: ${i+2}; grid-row: 2;">${mName}<br>${date.getFullYear().toString().slice(-2)}</div>`;
    }

    // Background Columns Setup
    for (let i = 0; i < TOTAL_MONTHS; i++) {
        let m = new Date(START_YEAR, START_MONTH - 1 + i).getMonth() + 1;
        let semClass = (m == 6 || m == 7) ? 'summer' : (m >= 8 && m <= 12) ? 'fall' : 'spring';
        html += `<div class="bg-col ${semClass}" style="grid-column: ${i+2}; grid-row: 3 / span ${Math.max(1, totalOfficerRows)};"></div>`;
    }

    let currentRowNum = 3;

    for (let key in billets) {
        let staffList = billets[key].sort((a, b) => getMonthIndex(a.report) - getMonthIndex(b.report));
        let unit = staffList[0].unit;
        let rowSpan = staffList.length; 
        
        html += `<div style="display: contents;">`;
        html += `<div class="row-label" style="grid-column: 1; grid-row: ${currentRowNum} / span ${rowSpan}; border-bottom: 2px solid #ccc;">
                    <span class="unit-badge unit-${unit}">${unit}</span>
                    ${staffList[0].billet}
                 </div>`;
        
        staffList.forEach((s, idx) => {
            let officerRow = currentRowNum + idx;
            
            let rIdx = getMonthIndex(s.report);
            let tIdx = s.tihe ? getMonthIndex(s.tihe) : rIdx;
            let pIdx = getMonthIndex(s.prd);
            let sbIdx = s.sb ? getMonthIndex(s.sb) : null;
            let termIdx = s.terminal ? getMonthIndex(s.terminal) : null;
            
            let wEndIdx = sbIdx ?? termIdx ?? pIdx;
            
            // Inbound logic
            let inbStart = Math.max(rIdx, tIdx); 
            let prevWorkEnd = rIdx; 
            if (idx > 0) {
                let p = staffList[idx-1];
                prevWorkEnd = (p.sb ? getMonthIndex(p.sb) : null) ?? (p.terminal ? getMonthIndex(p.terminal) : null) ?? getMonthIndex(p.prd);
                if (prevWorkEnd < inbStart) {
                    html += renderBlock(prevWorkEnd, inbStart, 'background: rgba(255,0,0,0.2); border: 2px dashed red; color: red;', 'GAP', 'Staffing Gap', officerRow, null);
                }
            } else { prevWorkEnd = inbStart; }
            
            let inbEnd = Math.max(inbStart, prevWorkEnd);
            
            // Outbound logic
            let nextReport = wEndIdx;
            if (idx < staffList.length - 1) nextReport = getMonthIndex(staffList[idx+1].report);
            
            let outStart = Math.min(wEndIdx, nextReport);
            let outEnd = wEndIdx;
            
            // Solo logic
            let soloStart = inbEnd;
            let soloEnd = outStart;
            if (soloEnd < soloStart) { soloEnd = soloStart; outStart = soloStart; }

            // Styling
            let uColor = colorMap[s.unit] || "#333";
            let opacity = s.name.toLowerCase() === "unknown" ? "opacity: 0.6; border: 2px dashed white;" : "";
            
            let inbStyle = `background: repeating-linear-gradient(45deg, rgba(255,255,255,0.4), rgba(255,255,255,0.4) 4px, ${uColor} 4px, ${uColor} 8px); ${opacity}`;
            let soloStyle = `background: ${uColor}; ${opacity}`;
            let outStyle = `background: repeating-linear-gradient(-45deg, rgba(0,0,0,0.3), rgba(0,0,0,0.3) 4px, ${uColor} 4px, ${uColor} 8px); ${opacity}`;
            let sbStyle = `background: #ffcc00;`;
            let termStyle = `background: #ff9999;`;

            html += renderBlock(inbStart, inbEnd, inbStyle, 'Inbound T/O', 'Inbound Turnover Window', officerRow, s.id);
            html += renderBlock(soloStart, soloEnd, soloStyle, s.name, 'Active Billet', officerRow, s.id);
            html += renderBlock(outStart, outEnd, outStyle, 'Outbound T/O', 'Outbound Turnover Window', officerRow, s.id);
            if (sbIdx !== null) html += renderBlock(sbIdx, termIdx ?? pIdx, sbStyle, 'Skillbridge', 'Skillbridge Window', officerRow, s.id);
            if (termIdx !== null) html += renderBlock(termIdx, pIdx, termStyle, 'Terminal', 'Terminal Leave', officerRow, s.id);
            
            html += renderMarker(rIdx, 'blue', 'Report', officerRow, 2);
            if (s.tihe && tIdx !== rIdx) html += renderMarker(tIdx, 'purple', 'TiHE', officerRow, 14);
            else if (s.tihe) html += renderMarker(tIdx, 'purple', 'TiHE/Rep', officerRow, 14);
            html += renderMarker(pIdx, 'red', 'PRD', officerRow, 26);

            if (idx < rowSpan - 1) {
                html += `<div style="grid-column: 2 / -1; grid-row: ${officerRow}; border-bottom: 1px dashed #ddd; pointer-events: none; z-index: 2;"></div>`;
            }
        });

        html += `<div style="grid-column: 2 / -1; grid-row: ${currentRowNum + rowSpan - 1}; border-bottom: 2px solid #ccc; pointer-events: none; z-index: 2;"></div>`;
        html += `</div>`;
        
        currentRowNum += rowSpan;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

// Global functions for modal and exports
function openAddModal() {
    document.getElementById('staffForm').reset();
    document.getElementById('staffId').value = '';
    document.getElementById('modalTitle').innerText = 'Add Staff Member';
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('staffModal').style.display = 'flex';
}

function editStaff(id) {
    if(!id) return;
    let s = staffData.find(x => x.id === id);
    document.getElementById('staffId').value = s.id;
    document.getElementById('staffName').value = s.name;
    document.getElementById('staffUnit').value = s.unit;
    document.getElementById('staffBillet').value = s.billet;
    document.getElementById('staffReport').value = s.report || '';
    document.getElementById('staffTihe').value = s.tihe || '';
    document.getElementById('staffPrd').value = s.prd || '';
    document.getElementById('staffTerminal').value = s.terminal || '';
    document.getElementById('staffSkillbridge').value = s.sb || '';
    
    document.getElementById('modalTitle').innerText = 'Edit Staff Member';
    document.getElementById('deleteBtn').style.display = 'inline-block';
    document.getElementById('staffModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('staffModal').style.display = 'none';
}

document.getElementById('staffForm').addEventListener('submit', function(e) {
    e.preventDefault();
    let id = document.getElementById('staffId').value || Date.now().toString();
    let newData = {
        id: id,
        name: document.getElementById('staffName').value,
        unit: document.getElementById('staffUnit').value,
        billet: document.getElementById('staffBillet').value,
        report: document.getElementById('staffReport').value,
        tihe: document.getElementById('staffTihe').value,
        prd: document.getElementById('staffPrd').value,
        terminal: document.getElementById('staffTerminal').value,
        sb: document.getElementById('staffSkillbridge').value
    };

    let index = staffData.findIndex(x => x.id === id);
    if (index >= 0) staffData[index] = newData;
    else staffData.push(newData);

    closeModal();
    renderGantt();
});

function deleteStaff() {
    let id = document.getElementById('staffId').value;
    staffData = staffData.filter(x => x.id !== id);
    closeModal();
    renderGantt();
}

function exportJSON() {
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(staffData));
    let node = document.createElement('a');
    node.setAttribute("href", dataStr);
    node.setAttribute("download", "ncpr_rotation_plan.json");
    document.body.appendChild(node);
    node.click();
    node.remove();
}

function importJSON(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        staffData = JSON.parse(e.target.result);
        renderGantt();
    };
    reader.readAsText(file);
}

function exportCSV() {
    let headers = ["id", "name", "unit", "billet", "report", "tihe", "prd", "terminal", "sb"];
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + 
        staffData.map(e => headers.map(h => e[h] || '').join(",")).join("\n");
    let node = document.createElement('a');
    node.setAttribute("href", encodeURI(csvContent));
    node.setAttribute("download", "ncpr_rotation_plan.csv");
    document.body.appendChild(node);
    node.click();
    node.remove();
}

function importCSV(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        let lines = e.target.result.split('\n');
        let headers = lines[0].split(',').map(h => h.trim());
        let newData = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            let obj = {};
            let currentline = lines[i].split(',');
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j] ? currentline[j].trim() : '';
            }
            if(!obj.id) obj.id = Date.now().toString() + i;
            newData.push(obj);
        }
        staffData = newData;
        renderGantt();
    };
    reader.readAsText(file);
}

// Replaced window.onload with the new load function
window.onload = loadInitialData;