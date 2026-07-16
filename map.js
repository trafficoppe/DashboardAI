let dbMap = null;
let dbMarkersLayer = null;
let rawTrafficData = [];

const MAHIDOL_LAT = 13.7928;
const MAHIDOL_LNG = 100.3235;

const THAI_MONTHS = [
    { val: "01", text: "ม.ค." }, { val: "02", text: "ก.พ." }, { val: "03", text: "มี.ค." },
    { val: "04", text: "เม.ย." }, { val: "05", text: "พ.ค." }, { val: "06", text: "มิ.ย." },
    { val: "07", text: "ก.ค." }, { val: "08", text: "ส.ค." }, { val: "09", text: "ก.ย." },
    { val: "10", text: "ต.ค." }, { val: "11", text: "พ.ย." }, { val: "12", text: "ธ.ค." }
];

// บังคับสไตล์ CSS สำหรับไอคอนหมุดรถยนต์ให้อยู่หน้าสุด[cite: 8]
if (!document.getElementById('hotspot-point-style')) {
    const style = document.createElement('style');
    style.id = 'hotspot-point-style';
    style.innerHTML = `
        .custom-car-icon {
            z-index: 9999 !important; 
        }
    `;
    document.head.appendChild(style);
}

function initDashboardMap() {
    if (dbMap !== null) {
        dbMap.remove();
        dbMap = null;
    }

    const safeParse = (key, defaultVal) => {
        const val = parseFloat(localStorage.getItem(key));
        return isNaN(val) ? defaultVal : val;
    };

    const savedZoom = safeParse('myMapZoom', 16.2);
    const savedLat = safeParse('myMapLat', MAHIDOL_LAT);
    const savedLng = safeParse('myMapLng', MAHIDOL_LNG);
    const savedBearing = safeParse('myMapBearing', -272);

    dbMap = L.map('dashboardMap', {
        rotate: true,               
        bearing: savedBearing,      
        zoomSnap: 0.1,              
        zoomControl: false,         
        attributionControl: false,  
        dragging: true,             
        scrollWheelZoom: false,     
        touchZoom: false,           
        doubleClickZoom: false,     
        boxZoom: false,             
        keyboard: false,            
        minZoom: 14,
        maxZoom: 19
    }).setView([savedLat, savedLng], savedZoom); 

    const mapContainer = document.getElementById('dashboardMap');
    if (mapContainer) {
        const killScroll = function(e) {
            e.stopImmediatePropagation();
        };
        mapContainer.addEventListener('wheel', killScroll, { capture: true, passive: false });
        mapContainer.addEventListener('mousewheel', killScroll, { capture: true, passive: false });
        mapContainer.addEventListener('DOMMouseScroll', killScroll, { capture: true, passive: false });
    }

    // 🌟 เปลี่ยน Tile Layer เป็น OpenStreetMap Standard เพื่อให้แสดงสีจริงและตัวหนังสือภาษาไทยชัดเจน[cite: 8]
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(dbMap);
    
    dbMarkersLayer = L.layerGroup().addTo(dbMap); 

    // 🌟 นำฟังก์ชันการแต่งสี Tile Pane Filter ออก เพื่อให้แผนที่คงสีธรรมชาติสีเดิมไว้[cite: 8]
    const mapControls = L.control({ position: 'topright' }); 
    mapControls.onAdd = function() {
        const container = L.DomUtil.create('div', 'map-control-panel-wrapper');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end';
        container.style.gap = '10px';
        
        let monthCheckboxes = THAI_MONTHS.map(m => `
            <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; user-select: none;">
                <input type="checkbox" class="month-filter-cb" value="${m.val}" checked style="cursor: pointer; accent-color: #1a237e;">
                ${m.text}
            </label>
        `).join('');

        // ลบสไลเดอร์ความสว่างและความคมชัดออก เหลือเฉพาะตัวควบคุมแผนที่หลัก[cite: 8]
        container.innerHTML = `
            <div id="toggleMenuBtn" style="background: rgba(255, 255, 255, 0.95); width: 44px; height: 44px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 24px; color: #1a237e; user-select: none; transition: 0.2s;">
                ☰
            </div>
            
            <div id="sliderPanel" style="display: none; background: rgba(255, 255, 255, 0.95); padding: 15px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); flex-direction: column; gap: 10px; width: 220px; font-family: 'Sarabun', sans-serif;">
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 13px; font-weight: bold; color: #1a237e;">📅 เลือกปีเกิดเหตุ</span>
                    <select id="filterYearSelect" style="width: 100%; padding: 5px; border-radius: 6px; border: 1px solid #ccc; font-family: 'Sarabun'; font-size: 13px;">
                        <option value="all">แสดงทุกปี</option>
                    </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 13px; font-weight: bold; color: #1a237e;">📆 เลือกเดือน</span>
                        <span id="btnSelectAllMonths" style="font-size: 11px; color: #007bff; cursor: pointer; text-decoration: underline; user-select: none;">ล้างทั้งหมด</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: #f8f9fa; padding: 8px; border-radius: 6px; border: 1px solid #e0e0e0;">
                        ${monthCheckboxes}
                    </div>
                </div>

                <hr style="border: 0; border-top: 1px solid #ddd; margin: 4px 0; width: 100%;">

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: #333;">ซูม</span>
                    <input type="range" id="mapZoomSlider" min="14" max="19" step="0.1" value="${savedZoom}" style="width: 130px; accent-color: #1a237e;">
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: #ff6f00;">องศา</span>
                    <input type="range" id="mapRotateSlider" min="0" max="360" step="1" value="${(savedBearing % 360 + 360) % 360}" style="width: 130px; accent-color: #ff6f00;">
                </div>
            </div>
        `;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
    };
    mapControls.addTo(dbMap);

    const toggleMenuBtn = document.getElementById('toggleMenuBtn');
    const sliderPanel = document.getElementById('sliderPanel');
    let isPanelOpen = false;

    if (toggleMenuBtn && sliderPanel) {
        toggleMenuBtn.addEventListener('click', function() {
            isPanelOpen = !isPanelOpen;
            if (isPanelOpen) {
                sliderPanel.style.display = 'flex';       
                toggleMenuBtn.innerHTML = '✖';            
                toggleMenuBtn.style.color = '#c62828';    
            } else {
                sliderPanel.style.display = 'none';       
                toggleMenuBtn.innerHTML = '☰';            
                toggleMenuBtn.style.color = '#1a237e';    
            }
        });
    }

    setTimeout(() => {
        document.querySelectorAll('.month-filter-cb').forEach(cb => {
            cb.addEventListener('change', applyDateFilter);
        });
        const yearSel = document.getElementById('filterYearSelect');
        if (yearSel) yearSel.addEventListener('change', applyDateFilter);
        
        const btnSelectAll = document.getElementById('btnSelectAllMonths');
        if (btnSelectAll) {
            btnSelectAll.addEventListener('click', function() {
                const checkboxes = document.querySelectorAll('.month-filter-cb');
                const allChecked = Array.from(checkboxes).every(c => c.checked);
                checkboxes.forEach(c => c.checked = !allChecked);
                btnSelectAll.innerText = allChecked ? "เลือกทั้งหมด" : "ล้างทั้งหมด";
                applyDateFilter();
            });
        }
    }, 100);

    const eZoom = document.getElementById('mapZoomSlider');
    const eRot = document.getElementById('mapRotateSlider');

    if (eZoom) eZoom.addEventListener('input', e => dbMap.setZoom(parseFloat(e.target.value)));
    if (eRot) eRot.addEventListener('input', e => {
        const d = parseInt(e.target.value);
        if (typeof dbMap.setBearing === 'function') dbMap.setBearing(d); 
        localStorage.setItem('myMapBearing', d);
    });
    
    dbMap.on('zoomend', () => { if (eZoom) eZoom.value = dbMap.getZoom(); localStorage.setItem('myMapZoom', dbMap.getZoom()); });
}

function updateAccidentMap(filteredData) {
    rawTrafficData = filteredData; 
    
    if (!dbMap) initDashboardMap();
    
    const yearSelect = document.getElementById('filterYearSelect');
    if (yearSelect && yearSelect.options.length <= 1) { 
        let years = new Set();
        rawTrafficData.forEach(row => {
            const dateStr = row[6] || ''; 
            let year = '';
            if (dateStr.includes('-')) year = dateStr.split('-')[0];
            else if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                year = parts[0].length === 4 ? parts[0] : parts[2];
            }
            if(year && !isNaN(year)) years.add(year.trim());
        });
        
        Array.from(years).sort().reverse().forEach(y => {
            let opt = document.createElement('option');
            opt.value = y;
            opt.text = parseInt(y) > 2500 ? y : parseInt(y) + 543;
            yearSelect.appendChild(opt);
        });
    }

    applyDateFilter(); 
}

function applyDateFilter() {
    if (!dbMap || !dbMarkersLayer) return;
    
    dbMarkersLayer.clearLayers(); 

    const yearSelect = document.getElementById('filterYearSelect');
    const selectedYear = yearSelect ? yearSelect.value : 'all';
    const checkedMonths = Array.from(document.querySelectorAll('.month-filter-cb:checked')).map(cb => cb.value);

    // 🌟 1. ถ้าไม่ได้ติ๊กเดือนอะไรเลย ก็ไม่ต้องวาดหมุดใดๆ (หยุดการทำงานทันที)
    if (checkedMonths.length === 0) return;

    const carIcon = L.divIcon({
        html: `<div style="font-size: 18px; line-height: 1; filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4)); text-shadow: 0 0 2px #fff;">🚗</div>`,
        className: 'custom-car-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10], 
        popupAnchor: [0, -10]
    });

    rawTrafficData.forEach(row => {
        const incidentType = row[12] || ''; 
        
        if (incidentType.trim() === 'อุบัติเหตุจากยานพาหนะ') {
            const dateStr = row[6] || ''; 
            let rowYear = '';
            let rowMonth = '';

            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                rowYear = parts[0];  
                rowMonth = parts[1]; 
            } else if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts[0].length === 4) {
                    rowYear = parts[0];
                    rowMonth = parts[1];
                } else {
                    rowYear = parts[2];
                    rowMonth = parts[1];
                }
            }

            if (rowYear && rowMonth) {
                rowMonth = rowMonth.padStart(2, '0');
                
                // กรองปี
                if (selectedYear !== 'all' && rowYear !== selectedYear) return;
                
                // 🌟 2. กรองเดือน: ถ้าเดือนนี้ไม่ได้อยู่ในที่ติ๊กไว้ ให้ข้ามไปเลย
                if (!checkedMonths.includes(rowMonth)) return;
            } else {
                // ข้ามข้อมูลที่วันที่ไม่สมบูรณ์
                return;
            }

            const coordinateStr = row[11] || ''; 
            if (coordinateStr.includes(',')) {
                const parts = coordinateStr.split(',');
                const lat = parseFloat(parts[0].trim());
                const lng = parseFloat(parts[1].trim());
                
                if (!isNaN(lat) && !isNaN(lng)) {
                    const locationName = row[10] || 'ไม่ระบุสถานที่'; 
                    const timeStr = row[7] || '-';                   
                    
                    const popupHTML = `
                        <div style="font-family: 'Sarabun', sans-serif; font-size: 13px; line-height: 1.5; padding: 2px;">
                            <strong style="color: #c62828; font-size: 14px;">🚗 อุบัติเหตุจากยานพาหนะ</strong><br>
                            <div style="margin-top: 4px; height: 1px; background: #eee;"></div>
                            <strong>สถานที่:</strong> ${locationName}<br>
                            <strong>วันเวลา:</strong> ${dateStr} (${timeStr} น.)
                        </div>
                    `;
                    
                    const marker = L.marker([lat, lng], { icon: carIcon }).bindPopup(popupHTML);
                    dbMarkersLayer.addLayer(marker);
                }
            }
        }
    });
}