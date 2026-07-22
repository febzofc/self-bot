document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const statTotalPlugins = document.getElementById('stat-total-plugins');
    const statActivePlugins = document.getElementById('stat-active-plugins');
    const statErrorPlugins = document.getElementById('stat-error-plugins');

    const dashboardPluginList = document.getElementById('dashboard-plugin-list');
    const searchPluginInput = document.getElementById('search-plugin-input');
    const filterButtons = document.querySelectorAll('.btn-filter[data-filter]');
    const btnRefreshStats = document.getElementById('btn-refresh-stats');

    const selectedPluginName = document.getElementById('selected-plugin-name');
    const btnSavePluginCode = document.getElementById('btn-save-plugin-code');
    const pluginErrorBanner = document.getElementById('plugin-error-banner');
    const bannerErrorType = document.getElementById('banner-error-type');
    const bannerErrorMsg = document.getElementById('banner-error-msg');
    const pluginCodeEditor = document.getElementById('plugin-code-editor');

    const digitalClock = document.getElementById('digital-clock');
    const toast = document.getElementById('toast-notification');

    let currentStats = null;
    let currentSelectedPlugin = null;
    let currentFilter = 'all';
    let searchQuery = '';

    // Clock
    function updateClock() {
        const now = new Date();
        const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        const timeString = new Intl.DateTimeFormat('id-ID', options).format(now);
        if (digitalClock) digitalClock.textContent = `${timeString} WIB`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Toast
    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2500);
    }

    // Fetch Stats
    async function fetchPluginStats() {
        try {
            const res = await fetch('/api/plugins');
            if (!res.ok) throw new Error('Network error');
            currentStats = await res.json();

            statTotalPlugins.textContent = currentStats.totalPlugins;
            statActivePlugins.textContent = currentStats.activeCount;
            statErrorPlugins.textContent = currentStats.erroredCount;

            renderPluginList();
        } catch (e) {
            console.error('Error fetching plugin stats:', e);
            showToast('Gagal memuat statistik plugin dari server.');
        }
    }

    function renderPluginList() {
        if (!currentStats) return;
        dashboardPluginList.innerHTML = '';

        const erroredKeys = Object.keys(currentStats.erroredPlugins || {});
        let itemsToRender = [];

        // Collect errored
        erroredKeys.forEach(filename => {
            itemsToRender.push({ filename, isErrored: true, info: currentStats.erroredPlugins[filename] });
        });

        // Collect active
        (currentStats.activePlugins || []).forEach(filename => {
            if (!erroredKeys.includes(filename)) {
                itemsToRender.push({ filename, isErrored: false, info: null });
            }
        });

        // Filter
        if (currentFilter === 'error') {
            itemsToRender = itemsToRender.filter(item => item.isErrored);
        } else if (currentFilter === 'active') {
            itemsToRender = itemsToRender.filter(item => !item.isErrored);
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            itemsToRender = itemsToRender.filter(item => item.filename.toLowerCase().includes(q));
        }

        if (itemsToRender.length === 0) {
            dashboardPluginList.innerHTML = '<div class="no-results" style="text-align:center; padding: 20px; color: var(--text-muted); font-size:13px;">Tidak ada plugin ditemukan</div>';
            return;
        }

        itemsToRender.forEach(item => {
            const el = createPluginItemElement(item.filename, item.isErrored);
            dashboardPluginList.appendChild(el);
        });
    }

    function createPluginItemElement(filename, isErrored) {
        const item = document.createElement('div');
        item.className = `plugin-item ${currentSelectedPlugin === filename ? 'active' : ''}`;
        item.dataset.filename = filename;

        const badgeClass = isErrored ? 'badge-err' : 'badge-ok';
        const badgeText = isErrored ? 'ERROR' : 'AKTIF';

        item.innerHTML = `
            <span class="plugin-item-name"><i class="fa-regular fa-file-code"></i> ${filename}</span>
            <span class="plugin-status-badge ${badgeClass}">${badgeText}</span>
        `;

        item.addEventListener('click', () => selectPlugin(filename));
        return item;
    }

    async function selectPlugin(filename) {
        currentSelectedPlugin = filename;
        selectedPluginName.textContent = filename;
        btnSavePluginCode.disabled = true;

        document.querySelectorAll('.plugin-item').forEach(el => {
            el.classList.toggle('active', el.dataset.filename === filename);
        });

        try {
            const res = await fetch(`/api/plugins/code/${filename}`);
            const data = await res.json();

            if (data.success) {
                pluginCodeEditor.value = data.code;
                btnSavePluginCode.disabled = false;

                if (data.errorInfo) {
                    bannerErrorType.textContent = `[${data.errorInfo.errorType}] Waktu Error: ${data.errorInfo.lastErrorTime}`;
                    bannerErrorMsg.textContent = `${data.errorInfo.errorMessage}\n\nStack Trace:\n${data.errorInfo.stackTrace}`;
                    pluginErrorBanner.classList.remove('hidden');
                } else {
                    pluginErrorBanner.classList.add('hidden');
                }
            } else {
                showToast(`Gagal memuat kode plugin: ${data.error}`);
            }
        } catch (e) {
            console.error('Error fetching plugin code:', e);
            showToast('Gagal memuat kode plugin.');
        }
    }

    async function saveCurrentPluginCode() {
        if (!currentSelectedPlugin) return;
        const newCode = pluginCodeEditor.value;

        btnSavePluginCode.disabled = true;
        btnSavePluginCode.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

        try {
            const res = await fetch(`/api/plugins/code/${currentSelectedPlugin}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: newCode })
            });
            const data = await res.json();

            if (data.success) {
                showToast(`Plugin ${currentSelectedPlugin} berhasil disimpan dan dimuat ulang!`);
                await fetchPluginStats();
                await selectPlugin(currentSelectedPlugin);
            } else {
                showToast(`Gagal menyimpan: ${data.error}`);
            }
        } catch (e) {
            console.error('Error saving plugin code:', e);
            showToast('Terjadi kesalahan saat menyimpan kode.');
        } finally {
            btnSavePluginCode.disabled = false;
            btnSavePluginCode.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Kode & Reload Plugin';
        }
    }

    // Event listeners
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderPluginList();
        });
    });

    searchPluginInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderPluginList();
    });

    btnRefreshStats.addEventListener('click', fetchPluginStats);
    btnSavePluginCode.addEventListener('click', saveCurrentPluginCode);

    // Initial load
    fetchPluginStats();
});
