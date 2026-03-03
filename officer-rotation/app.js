const START_YEAR = 2024;
const START_MONTH = 6; // June
const TOTAL_MONTHS = 72; // 6 Years

const colorMap = { "UNC": "#7BAFD4", "Duke": "#003087", "NCSU": "#CC0000", "NCPR": "#555555" };
let staffData = [];

async function loadInitialData() {
    try {
        const response = await fetch('default_dat.json');
        if (response.ok) staffData = await response.json();
    } catch (e) { console.error("No default file found."); }
    renderGantt();
    setTimeout(snapToPresent, 500);
}

function getMonthIndex(dateStr) {
    if (!dateStr) return null;
    let parts = dateStr.split('-');
    let y = parseInt(parts[0]);
    let m = parseInt(parts[1]);
    let index = ((y - START_YEAR) * 12) + (m - START_MONTH);
    return index;
}

function renderBlock(start, end, customStyle, label, title, rowNum, id) {
    if (start >= TOTAL_MONTHS || end <= 0 || start >= end) return '';
    let s = Math.max(0, start);
    let e = Math.min(TOTAL_MONTHS, end);
    let width = e - s;
    
    // We wrap the label in the seg-label span which is now sticky in CSS
    return `
        <div class="bar-segment" 
             style="grid-column: ${s + 2} / span ${width}; grid-row: ${rowNum}; ${customStyle}" 
             title="${title}" 
             onclick="editStaff('${id}')">
            <span class="seg-label">${label}</span>
        </div>`;
}

function renderMarker(index, color, label, rowNum, topOffset) {
    if (index < 0 || index >= TOTAL_MONTHS) return '';
    return `<div class="milestone-marker" style="grid-column: ${index + 2}; grid-row: ${rowNum}; border-left-color: ${color};">
                <span class="milestone-label" style="color: ${color}; top: ${topOffset}px;">${label}</span>
            </div>`;
}

function renderGantt() {
    const container = document.getElementById('ganttGridTarget');
    if (!container) return;

    let billets = {};
    staffData.forEach(s => {
        let key = `${s.unit} - ${s.billet}`;
        if (!billets[key]) billets[key] = [];
        billets[key].push(s);
    });

    let totalOfficerRows = 0;
    for (let key in billets) totalOfficerRows += billets[key].length;

    let html = `<div class="gantt-grid">`;
    
    // Academic Year Headers
    html += `<div class="row-label" style="grid-column: 1; grid-row: 1; z-index: 50; background:#ddd;">Academic Year</div>`;
    for(let y=0; y < (TOTAL_MONTHS/12); y++) {
        html += `<div class="gantt-header-years" style="grid-column: ${2 + (y*12)} / span 12; grid-row: 1;">AY ${START_YEAR+y}-${START_YEAR+y+1}</div>`;
    }

    // Month Headers
    html += `<div class="row-label" style="grid-column: 1; grid-row: 2; z-index: 50; background:#eee;">Month</div>`;
    const now = new Date();
    const currentMonthIdx = ((now.getFullYear() - START_YEAR) * 12) + (now.getMonth() - (START_MONTH - 1));

    for (let i = 0; i < TOTAL_MONTHS; i++) {
        let date = new Date(START_YEAR, START_MONTH - 1 + i);
        let m = date.getMonth() + 1;
        let semClass = (m == 6 || m == 7) ? 'summer' : (m >= 8 && m <= 12) ? 'fall' : 'spring';
        let isToday = (i === currentMonthIdx) ? 'today-col' : '';
        
        html += `<div class="gantt-header-months ${semClass} ${isToday}" style="grid-column: ${i+2}; grid-row: 2;">${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear().toString().slice(-2)}</div>`;
        html += `<div class="bg-col ${semClass} ${isToday}" style="grid-column: ${i+2}; grid-row: 3 / span ${Math.max(1, totalOfficerRows + 10)};"></div>`;
    }

    let currentRowNum = 3;
    for (let key in billets) {
        let staffList = billets[key].sort((a, b) => getMonthIndex(a.report) - getMonthIndex(b.report));
        let rowSpan = staffList.length;
        html += `<div class="row-label" style="grid-column: 1; grid-row: ${currentRowNum} / span ${rowSpan};">
                    <span class="unit-badge unit-${staffList[0].unit}">${staffList[0].unit}</span>
                    ${staffList[0].billet}
                 </div>`;

        staffList.forEach((s, idx) => {
            let row = currentRowNum + idx;
            let rIdx = getMonthIndex(s.report), tIdx = s.tihe ? getMonthIndex(s.tihe) : rIdx, pIdx = getMonthIndex(s.prd);
            let sbIdx = s.sb ? getMonthIndex(s.sb) : null, termIdx = s.terminal ? getMonthIndex(s.terminal) : null;
            let wEndIdx = sbIdx ?? termIdx ?? pIdx;

            let inbStart = Math.max(rIdx, tIdx);
            let prevEnd = rIdx; 
            if (idx > 0) {
                let p = staffList[idx-1];
                prevEnd = getMonthIndex(p.sb || p.terminal || p.prd);
                if (prevEnd < inbStart) html += renderBlock(prevEnd, inbStart, 'background:rgba(255,0,0,0.1); border:1px dashed red; color:red;', 'GAP', 'Gap', row, null);
            }
            
            let uColor = colorMap[s.unit] || "#333";
            let opacity = s.name.toLowerCase() === "unknown" ? "opacity: 0.6; border: 1px dashed white;" : "";
            
            html += renderBlock(inbStart, Math.max(inbStart, prevEnd), `background: repeating-linear-gradient(45deg, rgba(255,255,255,0.2), rgba(255,255,255,0.2) 4px, ${uColor} 4px, ${uColor} 8px); ${opacity}`, 'T/O', '', row, s.id);
            html += renderBlock(Math.max(inbStart, prevEnd), Math.min(wEndIdx, TOTAL_MONTHS), `background: ${uColor}; ${opacity}`, s.name, '', row, s.id);
            
            html += renderMarker(rIdx, 'blue', 'REP', row, 2);
            html += renderMarker(pIdx, 'red', 'PRD', row, 20);
        });
        currentRowNum += rowSpan;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function snapToPresent() {
    const container = document.getElementById('ganttContainer');
    const now = new Date();
    const currentMonthIndex = ((now.getFullYear() - START_YEAR) * 12) + (now.getMonth() - (START_MONTH - 1));
    const colWidth = container.querySelector('.gantt-header-months').offsetWidth;
    container.scrollTo({ left: (currentMonthIndex * colWidth) - 200, behavior: 'smooth' });
}

function handleScroll() {
    const container = document.getElementById('ganttContainer');
    const btn = document.getElementById('snapBtn');
    btn.style.display = container.scrollLeft > 300 ? 'block' : 'none';
}

// ... Keep your Modal and Export/Import functions from the original code ...
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

function closeModal() { document.getElementById('staffModal').style.display = 'none'; }

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

window.onload = loadInitialData;
