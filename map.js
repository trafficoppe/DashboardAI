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

if (!document.getElementById('hotspot-point-style')) {
    const style = document.createElement('style');
    style.id = 'hotspot-point-style';
    style.innerHTML = `
        .custom-pin-icon {
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
        const killScroll = function(e) { e.stopImmediatePropagation(); };
        mapContainer.addEventListener('wheel', killScroll, { capture: true, passive: false });
        mapContainer.addEventListener('mousewheel', killScroll, { capture: true, passive: false });
        mapContainer.addEventListener('DOMMouseScroll', killScroll, { capture: true, passive: false });
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(dbMap);
    
    dbMarkersLayer = L.layerGroup().addTo(dbMap); 

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
        
        // 🌟 แก้ไขปุ่มล้างทั้งหมด/เลือกทั้งหมด
        const btnSelectAll = document.getElementById('btnSelectAllMonths');
        if (btnSelectAll) {
            btnSelectAll.addEventListener('click', function() {
                const checkboxes = document.querySelectorAll('.month-filter-cb');
                // เช็คว่ามีเดือนไหนถูกติ๊กอยู่บ้างไหม
                const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
                
                if (anyChecked) {
                    // ถ้ามีติ๊กอยู่ ให้เอาออกให้หมด (ล้างทั้งหมด)
                    checkboxes.forEach(cb => cb.checked = false);
                    this.innerText = 'เลือกทั้งหมด';
                } else {
                    // ถ้าไม่มีติ๊กเลย ให้เลือกทั้งหมด
                    checkboxes.forEach(cb => cb.checked = true);
                    this.innerText = 'ล้างทั้งหมด';
                }
                applyDateFilter(); // รีเฟรชแผนที่
            });
        }
    }, 100);
}

function updateAccidentMap(filteredData) {
    rawTrafficData = filteredData; 
    
    if (!dbMap) initDashboardMap();
    
    const yearSelect = document.getElementById('filterYearSelect');
    if (yearSelect && yearSelect.options.length <= 1) { 
        let years = new Set();
        rawTrafficData.forEach(row => {
            const dateStr = row[8] || ''; // 🌟 ดึงวันที่จาก คอลัมน์ I (row[8])
            let year = '';
            if (dateStr.includes('-')) year = dateStr.split('-')[0];
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

    if (checkedMonths.length === 0) return;

    // ฟังก์ชันวาดหมุดใหญ่ๆ รูป Pin
    const createPin = (color) => L.divIcon({
        html: `<svg viewBox="0 0 24 24" width="40" height="40" style="filter: drop-shadow(2px 4px 4px rgba(0,0,0,0.5));">
                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="black" stroke-width="1.5"/>
               </svg>`,
        className: 'custom-pin-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -35] 
    });

    const redPin = createPin('#d32f2f');  // แดง = บาดเจ็บ
    const bluePin = createPin('#1976d2'); // น้ำเงิน = ไม่บาดเจ็บ
    
    // 🌟 Array ชื่อเดือนภาษาไทยแบบเต็ม
    const thaiMonthsFull = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    rawTrafficData.forEach(row => {
        const incidentType = String(row[14] || '').trim(); // คอลัมน์ O
        
        if (incidentType.includes('ยานพาหนะ') || incidentType.includes('จราจร') || incidentType.includes('ถนน') || incidentType.includes('รถ')) {
            const dateStr = row[8] || ''; // คอลัมน์ I
            let rowYear = '', rowMonth = '', rowDay = '';
            let displayDate = dateStr; // ค่าเริ่มต้นหากแปลงไม่สำเร็จ

            // 🌟 แปลงวันที่ YYYY-MM-DD เป็นรูปแบบภาษาไทย
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                rowYear = parts[0];  
                rowMonth = parts[1]; 
                if (parts.length >= 3) {
                    // ตัดเอาเฉพาะตัวเลขวันที่ (เผื่อข้อมูลมีเวลาติดมาด้วย)
                    rowDay = parts[2].substring(0, 2); 
                    
                    const d = parseInt(rowDay, 10);
                    const m = parseInt(rowMonth, 10);
                    const y = parseInt(rowYear, 10);
                    
                    if (!isNaN(d) && !isNaN(m) && !isNaN(y) && m >= 1 && m <= 12) {
                        // แปลงปี ค.ศ. เป็น พ.ศ. (ถ้าปีน้อยกว่า 2500 ถือว่าเป็น ค.ศ.)
                        const thaiYear = y < 2500 ? y + 543 : y;
                        displayDate = `${d} ${thaiMonthsFull[m - 1]} ${thaiYear}`;
                    }
                }
            } 

            if (rowYear && rowMonth) {
                rowMonth = rowMonth.padStart(2, '0');
                if (selectedYear !== 'all' && rowYear !== selectedYear) return;
                if (!checkedMonths.includes(rowMonth)) return;
            } else {
                return;
            }

            const coordinateStr = row[13] || ''; // คอลัมน์ N
            if (coordinateStr.includes(',')) {
                const parts = coordinateStr.split(',');
                const lat = parseFloat(parts[0].trim());
                const lng = parseFloat(parts[1].trim());
                
                if (!isNaN(lat) && !isNaN(lng)) {
                    const locationName = row[12] || 'ไม่ระบุสถานที่'; 
                    const timeStr = row[9] || '-';                   
                    
                    const hasInjuryStr = String(row[21] || '').trim();
                    const injuredCount = parseInt(row[22]) || 0;
                    const isInjured = (injuredCount > 0 || (hasInjuryStr !== 'ไม่มี' && hasInjuryStr !== '-' && hasInjuryStr !== ''));
                    
                    const iconToUse = isInjured ? redPin : bluePin;
                    const injuryLabel = isInjured ? '<span style="color: #d32f2f; font-weight: bold;">(มีผู้บาดเจ็บ)</span>' : '<span style="color: #1976d2; font-weight: bold;">(ไม่มีผู้บาดเจ็บ)</span>';

                    let imgHtml = '';
                    const rawImgUrl = row[30] || '';
                    if (rawImgUrl) {
                        let displayImgUrl = '';
                        if (rawImgUrl.includes('drive.google.com')) {
                            const match = rawImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawImgUrl.match(/id=([a-zA-Z0-9_-]+)/);
                            if (match && match[1]) {
                                displayImgUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
                            }
                        } else {
                            displayImgUrl = rawImgUrl;
                        }
                        
                        if (displayImgUrl) {
                            imgHtml = `<div style="margin-bottom: 8px; text-align: center;">
                                        <img src="${displayImgUrl}" style="max-width: 100%; max-height: 140px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); object-fit: cover;">
                                       </div>`;
                        }
                    }
                    
                    // 🌟 แสดงผลตัวแปร displayDate ในส่วน "วันเวลา"
                    const popupHTML = `
                        <div style="font-family: 'Sarabun', sans-serif; font-size: 13px; line-height: 1.5; padding: 2px; min-width: 220px;">
                            ${imgHtml}
                            <strong style="font-size: 14px;">📍 อุบัติเหตุยานพาหนะ ${injuryLabel}</strong><br>
                            <div style="margin: 6px 0; height: 1px; background: #eee;"></div>
                            <strong>สถานที่:</strong> ${locationName}<br>
                            <strong>วันเวลา:</strong> ${displayDate} (${timeStr} น.)
                        </div>
                    `;
                    
                    const marker = L.marker([lat, lng], { icon: iconToUse }).bindPopup(popupHTML);
                    dbMarkersLayer.addLayer(marker);
                }
            }
        }
    });
}