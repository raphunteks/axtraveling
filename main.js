import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.18.5/package/xlsx.mjs';

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION & DATABASE INTEGRATION ---
    const STORAGE_KEY = 'axa_premium_rundown';
    
    // LINK DATABASE GOOGLE APPS SCRIPT ANDA
    const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx6Of-Ochxpzaw-xwWCW46zwQQ90g4SJJ-tX8dMn5kJTtK_FXWszYyIyCcAqdex1YeD/exec";
    
    let rundownData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let currentFilter = 'all';
    let itemToDeleteId = null;

    // --- 2. CLOUD SYNC & STORAGE SYSTEM ---
    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rundownData));
        
        fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'sync', data: rundownData })
        }).catch(err => console.error("Cloud Sync Failed:", err));
    }

    function fetchFromCloud() {
        fetch(GAS_API_URL)
            .then(res => res.json())
            .then(data => {
                if(data && Array.isArray(data)) {
                    rundownData = data;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(rundownData));
                    renderFilters(); 
                    renderTimeline(); 
                }
            })
            .catch(err => console.error("Failed fetching data from Cloud:", err));
    }

    // --- 3. DOM ELEMENTS ---
    const timelineContainer = document.getElementById('timelineContainer');
    const dynamicFiltersContainer = document.getElementById('dynamicFilters');
    
    const formModal = document.getElementById('formModal');
    const rundownForm = document.getElementById('rundownForm');
    const modalTitle = document.getElementById('modalTitle');
    const confirmModal = document.getElementById('confirmModal');
    
    const inputId = document.getElementById('agendaId');
    const inputTitle = document.getElementById('agendaTitle');
    const inputDay = document.getElementById('agendaDay');
    const inputTime = document.getElementById('agendaTime');
    const inputDest = document.getElementById('agendaDest');
    const inputDesc = document.getElementById('agendaDesc');
    
    // New Elements
    const inputQty = document.getElementById('agendaQty');
    const inputCost = document.getElementById('agendaCost');

    // Utility: Format Rupiah
    const formatRp = (num) => {
        if (!num) return "Rp 0";
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    };

    // --- 4. RENDER ENGINE & ANIMATION ---
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -20px 0px" });

    function renderFilters() {
        if(!dynamicFiltersContainer) return;
        const uniqueDays = [...new Set(rundownData.map(item => item.day))].sort((a, b) => {
            const numA = parseInt(a.toString().replace(/\D/g, ''));
            const numB = parseInt(b.toString().replace(/\D/g, ''));
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        let html = `<button class="nav-link ${currentFilter === 'all' ? 'active' : ''}" data-day="all">Semua Jadwal</button>`;
        uniqueDays.forEach(day => {
            const isActive = currentFilter === day ? 'active' : '';
            const displayText = day.toString().toLowerCase().includes('hari') ? day : `Hari ${day}`;
            html += `<button class="nav-link ${isActive}" data-day="${day}">${displayText}</button>`;
        });

        dynamicFiltersContainer.innerHTML = html;
        dynamicFiltersContainer.querySelectorAll('.nav-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentFilter = e.target.dataset.day;
                renderFilters();
                renderTimeline();
            });
        });
    }

    function renderTimeline() {
        timelineContainer.innerHTML = '';
        
        let filteredData = rundownData;
        if (currentFilter !== 'all') {
            filteredData = rundownData.filter(item => item.day === currentFilter);
        }

        filteredData.sort((a, b) => {
            if (a.day === b.day) return a.time.localeCompare(b.time);
            const numA = parseInt(a.day.toString().replace(/\D/g, ''));
            const numB = parseInt(b.day.toString().replace(/\D/g, ''));
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.day.localeCompare(b.day);
        });

        if (filteredData.length === 0) {
            timelineContainer.innerHTML = `
                <div class="empty-state">
                    <h3 style="margin-bottom: 12px; font-size: 20px;">Database Kosong</h3>
                    <p style="color: var(--color-text-muted); font-size: 14px;">Belum ada agenda perjalanan yang ditambahkan. Silahkan mulai membuat agenda baru.</p>
                </div>`;
            return;
        }

        filteredData.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'timeline-item';
            el.style.transition = `opacity 0.6s ease, transform 0.6s ease ${index * 0.08}s`;
            
            const displayBadgeDay = item.day.toString().toLowerCase().includes('hari') ? item.day : `Day ${item.day}`;
            
            // Regex Fallback Pengaman Jam dari String Aneh (misal dari sinkronisasi)
            let safeTime = item.time;
            if(safeTime && safeTime.match(/\d{2}:\d{2}/)) {
                safeTime = safeTime.match(/\d{2}:\d{2}/)[0];
            }
            
            // HTML Komponen Biaya (Hanya muncul jika ada biayanya)
            let costHtml = '';
            if (item.total && parseFloat(item.total) > 0) {
                costHtml = `
                    <div style="margin-bottom:20px; padding:12px; background:rgba(59,130,246,0.05); border-radius:8px; font-size:14px; border: 1px solid rgba(59,130,246,0.2);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="color:var(--color-text-muted);">Estimasi Biaya:</span> <strong>${formatRp(item.cost)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="color:var(--color-text-muted);">Jumlah (Org/Pcs):</span> <strong>${item.qty}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top: 1px dashed rgba(255,255,255,0.1); padding-top:8px; margin-top:8px;">
                            <span style="color:var(--color-text-muted);">Total Tagihan (+ PPN 10%):</span> <strong style="color:var(--color-accent); font-size:16px;">${formatRp(item.total)}</strong>
                        </div>
                    </div>`;
            }

            el.innerHTML = `
                <div class="timeline-node"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="time-badge">${displayBadgeDay} • ${safeTime} WITA</span>
                        <div class="action-icons">
                            <button class="icon-btn btn-edit" data-id="${item.id}" title="Edit">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button class="icon-btn btn-delete" data-id="${item.id}" title="Hapus">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    <h3>${item.title}</h3>
                    <p style="margin-bottom: 12px;">${item.desc}</p>
                    ${costHtml}
                    <span class="tag-location">
                        <svg width="16" height="16" fill="none" stroke="var(--color-accent)" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        ${item.dest}
                    </span>
                </div>
            `;
            timelineContainer.appendChild(el);
            revealObserver.observe(el);
        });

        document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => openModal(e.currentTarget.closest('.btn-edit').dataset.id)));
        document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => confirmDelete(e.currentTarget.closest('.btn-delete').dataset.id)));
    }

    // --- 5. MODAL & CRUD LOGIC ---
    function openModal(id = null) {
        rundownForm.reset();
        if (id) {
            modalTitle.textContent = "Edit Agenda";
            const item = rundownData.find(i => i.id === id);
            if (item) {
                inputId.value = item.id;
                inputTitle.value = item.title;
                inputDay.value = item.day;
                
                // Fallback Waktu Normal
                let safeTime = item.time;
                if(safeTime && safeTime.match(/\d{2}:\d{2}/)) {
                    safeTime = safeTime.match(/\d{2}:\d{2}/)[0];
                }
                inputTime.value = safeTime;
                
                inputDest.value = item.dest;
                inputDesc.value = item.desc;
                inputQty.value = item.qty || '';
                inputCost.value = item.cost || '';
            }
        } else {
            modalTitle.textContent = "Tambah Agenda";
            inputId.value = "";
            if (currentFilter !== 'all') inputDay.value = currentFilter;
        }
        formModal.classList.add('active');
    }

    function closeModal() { formModal.classList.remove('active'); }
    
    function confirmDelete(id) {
        itemToDeleteId = id;
        confirmModal.classList.add('active');
    }
    
    function closeConfirmModal() {
        confirmModal.classList.remove('active');
        itemToDeleteId = null;
    }

    document.getElementById('btnOpenAddModal').addEventListener('click', () => openModal());
    document.getElementById('footerAddBtn').addEventListener('click', (e) => { e.preventDefault(); openModal(); window.scrollTo({top: 0, behavior: 'smooth'}); });
    document.getElementById('btnCancelModal').addEventListener('click', closeModal);
    document.getElementById('btnCancelDelete').addEventListener('click', closeConfirmModal);
    
    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
        if (itemToDeleteId) {
            rundownData = rundownData.filter(i => i.id !== itemToDeleteId);
            saveToStorage();
            renderFilters();
            renderTimeline();
            closeConfirmModal();
        }
    });

    rundownForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let normalizedDay = inputDay.value.trim();
        if(normalizedDay.toLowerCase().startsWith("hari ")) {
            normalizedDay = "Hari " + normalizedDay.substring(5);
        }

        // AUTO CALCULATION TOTAL + 10% PPN
        const rawQty = parseInt(inputQty.value) || 1;
        const rawCost = parseFloat(inputCost.value) || 0;
        const calculatedTotal = (rawCost * rawQty) * 1.10;

        const agendaData = {
            id: inputId.value || Date.now().toString(),
            title: inputTitle.value,
            day: normalizedDay,
            time: inputTime.value,
            dest: inputDest.value,
            desc: inputDesc.value,
            qty: rawQty,
            cost: rawCost,
            total: calculatedTotal
        };

        if (inputId.value) {
            const index = rundownData.findIndex(i => i.id === inputId.value);
            if (index !== -1) rundownData[index] = agendaData;
        } else {
            rundownData.push(agendaData);
        }
        
        saveToStorage();
        renderFilters(); 
        renderTimeline();
        closeModal();
    });

    // --- 6. EXCEL EXPORT (XLSX) ---
    const exportExcel = () => {
        if(rundownData.length === 0) return;
        const excelData = rundownData.map(item => {
            // Pengaman Waktu untuk export
            let safeTime = item.time;
            if(safeTime && safeTime.match(/\d{2}:\d{2}/)) { safeTime = safeTime.match(/\d{2}:\d{2}/)[0]; }
            
            return {
                "Day / Waktu": `${item.day.toLowerCase().includes('hari') ? item.day : 'Hari Ke-'+item.day}`,
                "Jam (WITA)": safeTime,
                "Judul Aktivitas & Order": item.title,
                "Lokasi": item.dest,
                "Catatan/Deskripsi": item.desc,
                "Jmlh(Orang/Pcs)": item.qty || 1,
                "Harga Satuan(Rp)": parseFloat(item.cost) || 0,
                "Total Akhir(+10% PPN)": parseFloat(item.total) || 0
            };
        }).sort((a, b) => {
            if (a["Day / Waktu"] === b["Day / Waktu"]) return a["Jam (WITA)"].localeCompare(b["Jam (WITA)"]);
            return a["Day / Waktu"].localeCompare(b["Day / Waktu"]);
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Memperlebar kolom Excel agar lebih proporsional
        worksheet['!cols'] = [
            {wch: 12}, // Day
            {wch: 12}, // Jam
            {wch: 35}, // Judul
            {wch: 30}, // Lokasi
            {wch: 50}, // Deskripsi
            {wch: 15}, // Qty
            {wch: 20}, // Harga
            {wch: 25}  // Total
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "AXA_Rundown_Financials");
        XLSX.writeFile(workbook, "AXA_Exclusive_Itinerary_Cost.xlsx");
    };

    document.getElementById('btnExportExcel').addEventListener('click', exportExcel);
    document.getElementById('footerExportBtn').addEventListener('click', (e) => { e.preventDefault(); exportExcel(); });

    // --- 7. INIT ENGINE ---
    window.addEventListener('click', (e) => {
        if (e.target === formModal) closeModal();
        if (e.target === confirmModal) closeConfirmModal();
    });

    renderFilters();
    renderTimeline();
    fetchFromCloud(); // Auto sync in background
});
