import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.18.5/package/xlsx.mjs';

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'axa_premium_rundown';
    const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx6Of-Ochxpzaw-xwWCW46zwQQ90g4SJJ-tX8dMn5kJTtK_FXWszYyIyCcAqdex1YeD/exec";
    
    let rundownData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let currentFilter = 'all';
    let itemToDeleteId = null;

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

    const timelineContainer = document.getElementById('timelineContainer');
    const dynamicFiltersContainer = document.getElementById('dynamicFilters');
    
    const formModal = document.getElementById('formModal');
    const rundownForm = document.getElementById('rundownForm');
    const modalTitle = document.getElementById('modalTitle');
    const confirmModal = document.getElementById('confirmModal');
    
    const inputId = document.getElementById('agendaId');
    const inputType = document.getElementById('agendaType');
    const inputDay = document.getElementById('agendaDay');
    const inputTime = document.getElementById('agendaTime');
    const inputDest = document.getElementById('agendaDest');
    
    const travelSpecificField = document.getElementById('travelSpecificField');
    const foodSpecificContainer = document.getElementById('foodSpecificContainer');
    const orderItemsWrapper = document.getElementById('orderItemsWrapper');
    const btnAddMoreOrder = document.getElementById('btnAddMoreOrder');
    
    const inputTitleTravel = document.getElementById('agendaTitleTravel');
    const inputDescTravel = document.getElementById('agendaDescTravel');
    const lblDest = document.getElementById('lblDest');

    const modalTabBtns = document.querySelectorAll('.modal-tab-btn');

    const formatRp = (num) => {
        if (!num) return "Rp 0";
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    };

    // --- MULTIPLE ORDER ROWS BUILDER ---
    function addOrderRow(data = {}) {
        const row = document.createElement('div');
        row.className = 'order-item-row';
        row.innerHTML = `
            <button type="button" class="remove-order-btn" title="Hapus Item">&times;</button>
            <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size: 11px;">Menu / Item Pesanan</label>
                <input type="text" class="form-control order-title" placeholder="Cth: Kopi Susu / Nasi Goreng" value="${data.title || ''}" required>
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
                <div class="form-group" style="flex: 1; margin-bottom:0;">
                    <label style="font-size: 11px;">Jumlah (Pcs/Org)</label>
                    <input type="number" class="form-control order-qty" placeholder="1" min="1" value="${data.qty || 1}" required>
                </div>
                <div class="form-group" style="flex: 1; margin-bottom:0;">
                    <label style="font-size: 11px;">Estimasi Harga Satuan (Rp)</label>
                    <input type="number" class="form-control order-cost" placeholder="25000" min="0" value="${data.cost || ''}" required>
                </div>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 11px;">Catatan Pesanan Khusus (Opsional)</label>
                <input type="text" class="form-control order-desc" placeholder="Cth: Less sugar, extra ice" value="${data.desc || ''}">
            </div>
        `;
        
        row.querySelector('.remove-order-btn').addEventListener('click', () => {
            if (orderItemsWrapper.children.length > 1) {
                row.remove();
            } else {
                alert("Minimal harus menyisakan 1 pesanan dalam satu waktu.");
            }
        });

        orderItemsWrapper.appendChild(row);
    }

    btnAddMoreOrder.addEventListener('click', () => addOrderRow());

    // --- TAB SWITCHER ---
    function switchModalTab(type) {
        modalTabBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.modal-tab-btn[data-tabtype="${type}"]`).classList.add('active');
        inputType.value = type;

        if (type === 'food') {
            lblDest.textContent = "Nama Resto / Toko / Outlet";
            travelSpecificField.style.display = "none";
            foodSpecificContainer.style.display = "block";
            
            // Jika kosong saat switch, berikan 1 baris default
            if(orderItemsWrapper.children.length === 0) {
                addOrderRow();
            }
        } else {
            lblDest.textContent = "Destinasi / Lokasi Umum";
            travelSpecificField.style.display = "block";
            foodSpecificContainer.style.display = "none";
        }
    }

    modalTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => switchModalTab(e.target.dataset.tabtype));
    });

    // --- RENDER TIMELINE ---
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
            
            let safeTime = item.time;
            if(safeTime && safeTime.match(/\d{2}:\d{2}/)) {
                safeTime = safeTime.match(/\d{2}:\d{2}/)[0];
            }
            
            let badgeTypeIcon = '';
            let costHtml = '';
            
            if (item.type === 'food') {
                badgeTypeIcon = `<span style="font-size: 12px; background: rgba(245, 158, 11, 0.1); color: #F59E0B; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.3); margin-left: 8px;">🛍️ Makan / Belanja</span>`;
                
                if (item.total && parseFloat(item.total) > 0) {
                    costHtml = `
                        <div style="margin-bottom:20px; padding:12px; background:rgba(59,130,246,0.05); border-radius:8px; font-size:14px; border: 1px solid rgba(59,130,246,0.2);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                <span style="color:var(--color-text-muted);">Estimasi Biaya:</span> <strong>${formatRp(item.cost)}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                <span style="color:var(--color-text-muted);">Jumlah (Pcs/Org):</span> <strong>${item.qty}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; border-top: 1px dashed rgba(255,255,255,0.1); padding-top:8px; margin-top:8px;">
                                <span style="color:var(--color-text-muted);">Total Tagihan (+ PPN 10%):</span> <strong style="color:var(--color-accent); font-size:16px;">${formatRp(item.total)}</strong>
                            </div>
                        </div>`;
                }
            }

            el.innerHTML = `
                <div class="timeline-node"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <div>
                            <span class="time-badge">${displayBadgeDay} • ${safeTime} WITA</span>
                            ${badgeTypeIcon}
                        </div>
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

    // --- MODAL & CRUD LOGIC ---
    function openModal(id = null) {
        rundownForm.reset();
        orderItemsWrapper.innerHTML = '';
        
        if (id) {
            modalTitle.textContent = "Edit Agenda";
            const item = rundownData.find(i => i.id === id);
            if (item) {
                inputId.value = item.id;
                switchModalTab(item.type || 'travel');
                
                inputDay.value = item.day;
                let safeTime = item.time;
                if(safeTime && safeTime.match(/\d{2}:\d{2}/)) { safeTime = safeTime.match(/\d{2}:\d{2}/)[0]; }
                inputTime.value = safeTime;
                inputDest.value = item.dest;
                
                if (item.type === 'food') {
                    // Mendukung multiple order lama yang disatukan koma atau single item
                    addOrderRow({ title: item.title, qty: item.qty, cost: item.cost, desc: item.desc });
                } else {
                    inputTitleTravel.value = item.title;
                    inputDescTravel.value = item.desc;
                }
            }
        } else {
            modalTitle.textContent = "Tambah Agenda";
            inputId.value = "";
            switchModalTab('travel');
            addOrderRow(); // Default 1 baris pesanan kosong untuk tab food
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

        const activeType = inputType.value;

        if (activeType === 'travel') {
            const agendaData = {
                id: inputId.value || Date.now().toString(),
                type: 'travel',
                title: inputTitleTravel.value,
                day: normalizedDay,
                time: inputTime.value,
                dest: inputDest.value,
                desc: inputDescTravel.value,
                qty: 0, cost: 0, total: 0
            };

            if (inputId.value) {
                const index = rundownData.findIndex(i => i.id === inputId.value);
                if (index !== -1) rundownData[index] = agendaData;
            } else {
                rundownData.push(agendaData);
            }
        } else {
            // MULTIPLE ORDERS PROCESSING: Menyimpan setiap baris pesanan menjadi entri timeline terpisah atau digabung
            const rows = orderItemsWrapper.querySelectorAll('.order-item-row');
            
            // Jika ini mode Edit, hapus dulu data lama agar tidak terjadi duplikasi ganda saat di-update
            if (inputId.value) {
                rundownData = rundownData.filter(i => i.id !== inputId.value);
            }

            rows.forEach((row, idx) => {
                const title = row.querySelector('.order-title').value;
                const qty = parseInt(row.querySelector('.order-qty').value) || 1;
                const cost = parseFloat(row.querySelector('.order-cost').value) || 0;
                const desc = row.querySelector('.order-desc').value || 'Pesanan Makanan / Belanja';
                const total = (cost * qty) * 1.10;

                const orderItemData = {
                    id: (Date.now() + idx).toString(),
                    type: 'food',
                    title: title,
                    day: normalizedDay,
                    time: inputTime.value,
                    dest: inputDest.value,
                    desc: desc,
                    qty: qty,
                    cost: cost,
                    total: total
                };
                rundownData.push(orderItemData);
            });
        }
        
        saveToStorage();
        renderFilters(); 
        renderTimeline();
        closeModal();
    });

    // --- EXCEL EXPORT ---
    const exportExcel = () => {
        if(rundownData.length === 0) return;
        const excelData = rundownData.map(item => {
            let safeTime = item.time;
            if(safeTime && safeTime.match(/\d{2}:\d{2}/)) { safeTime = safeTime.match(/\d{2}:\d{2}/)[0]; }
            
            return {
                "Day / Waktu": `${item.day.toLowerCase().includes('hari') ? item.day : 'Hari Ke-'+item.day}`,
                "Jam (WITA)": safeTime,
                "Kategori": item.type === 'food' ? 'Makan/Belanja' : 'Perjalanan/Aktivitas',
                "Judul / Item Pesanan": item.title,
                "Lokasi / Resto": item.dest,
                "Catatan/Deskripsi": item.desc,
                "Jmlh(Pcs/Org)": item.type === 'food' ? (item.qty || 1) : "-",
                "Harga Satuan(Rp)": item.type === 'food' ? (parseFloat(item.cost) || 0) : "-",
                "Total Akhir(+10% PPN)": item.type === 'food' ? (parseFloat(item.total) || 0) : "-"
            };
        }).sort((a, b) => {
            if (a["Day / Waktu"] === b["Day / Waktu"]) return a["Jam (WITA)"].localeCompare(b["Jam (WITA)"]);
            return a["Day / Waktu"].localeCompare(b["Day / Waktu"]);
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        worksheet['!cols'] = [
            {wch: 12}, {wch: 12}, {wch: 18}, {wch: 35}, {wch: 30}, {wch: 50}, {wch: 15}, {wch: 20}, {wch: 25}
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "AXA_Rundown_Financials");
        XLSX.writeFile(workbook, "AXA_Exclusive_Itinerary.xlsx");
    };

    document.getElementById('btnExportExcel').addEventListener('click', exportExcel);
    document.getElementById('footerExportBtn').addEventListener('click', (e) => { e.preventDefault(); exportExcel(); });

    window.addEventListener('click', (e) => {
        if (e.target === formModal) closeModal();
        if (e.target === confirmModal) closeConfirmModal();
    });

    renderFilters();
    renderTimeline();
    fetchFromCloud();
});
