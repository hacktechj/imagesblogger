/* ---------------- CONSTANTS & HEADERS ---------------- */
const API_BASE_URL = "https://unamenable-nathan-telegnostic.ngrok-free.dev/api";
const NGROK_HEADERS = {
    "ngrok-skip-browser-warning": "69420",
    "Content-Type": "application/json",
    "Accept": "application/json"
};
let CURRENT_USER_ID = null;

/* ---------------- INITIALIZATION ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
    setupMenus();
    
    const storedUserId = localStorage.getItem("user_id");
    if (!storedUserId) {
        console.warn("No user_id found. Please log in.");
        return;
    }

    CURRENT_USER_ID = storedUserId;

    // 1. Check Authentication first
    const isAuthenticated = await checkAuth(CURRENT_USER_ID);
    if (!isAuthenticated) {
        console.error("Auth failed. Redirecting...");
        // localStorage.removeItem("user_id"); // Optional: clear if invalid
        return;
    }

    // 2. Load Dashboard and Check Affiliate Status
    await checkAffiliateStatus();
    loadProductsDropdown();
});

/* ---------------- AUTH & STATUS ---------------- */
async function checkAuth(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/auth/me?user_id=${userId}`, { headers: NGROK_HEADERS });
        const data = await res.json();
        return res.ok && data.user_id == userId;
    } catch (e) { return false; }
}

async function checkAffiliateStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/user/dashboard/${CURRENT_USER_ID}`, { headers: NGROK_HEADERS });
        if (!response.ok) return;
        
        const data = await response.json();

        if (!data.digistore_id || data.digistore_id === "") {
            showAffiliateModal();
        } else {
            renderDashboard(data);
            loadChartData();
            loadAchievements(); 
            setupEventListeners();
        }
    } catch (error) { console.error("Dashboard Error:", error); }
}

/* ---------------- RENDERING & CHART ---------------- */
function renderDashboard(data) {
    const ids = {
        "username": data.username || "Affiliate",
        "earnings": (data.sales_volume || 0).toLocaleString('de-DE'),
        "earnings-team": (data.team_volume || 0).toLocaleString('de-DE'),
        "earnings-sale": data.sales_count || 0,
        "earnings-clicks": data.clicks || 0
    };

    for (const [id, val] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    const clickPercent = document.getElementById("usd-clicks");
    if (clickPercent) {
        const percentage = Math.min(((data.clicks || 0) / 100) * 100, 100).toFixed(1);
        clickPercent.innerText = `${percentage}%`;
    }
}

async function loadChartData() {
    try {
        const res = await fetch(`${API_BASE_URL}/user/chart/${CURRENT_USER_ID}`, { headers: NGROK_HEADERS });
        if (!res.ok) return;
        const data = await res.json(); 

        const chartMain = document.getElementById("chart-main");
        if (!chartMain) return;

        const chartWidth = chartMain.clientWidth;
        const chartHeight = 200;
        const points = [];

        for (let i = 1; i <= 7; i++) {
            const count = data[i-1]?.click_count || 0;
            const heightPercent = Math.min((count / 30) * 100, 100);
            
            // Update HTML Bars
            const bar = document.getElementById(`day${i}-bar`);
            const dayContainer = document.getElementById(`day-${i}`);
            if (bar) bar.style.height = `${heightPercent}%`;
            if (dayContainer) {
                const pTags = dayContainer.getElementsByTagName("p");
                if (pTags[0]) pTags[0].innerText = `${Math.round(heightPercent)}%`;
                if (pTags[1]) pTags[1].innerText = count;
            }

            // Calculate SVG Line
            const xPos = ((i - 1) * (chartWidth / 7)) + ((chartWidth / 7) / 2);
            const yPos = chartHeight - (heightPercent * (chartHeight / 100));
            points.push(`${xPos},${yPos}`);
        }

        const lineElement = document.getElementById("chart-line");
        if (lineElement) lineElement.setAttribute("points", points.join(" "));
    } catch (e) { console.error("Chart Error:", e); }
}

/* ---------------- MODAL ---------------- */
function showAffiliateModal() {
    if (document.getElementById("affiliate-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "affiliate-overlay";
    overlay.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(8px);`;
    overlay.innerHTML = `
        <div style="background:#1a1a1a;padding:40px;border-radius:15px;text-align:center;border:1px solid #333;max-width:400px;width:90%;">
            <h2 style="color:white;font-family:Tajawal;">Link Your Account</h2>
            <p style="color:#aaa;margin-bottom:20px;">Enter your Digistore24 ID to sync data.</p>
            <input id="modal-ds-id" placeholder="Digistore ID" style="padding:12px;width:100%;margin-bottom:10px;border-radius:5px;border:1px solid #444;background:#000;color:white;outline:none;">
            <p id="modal-error" style="color:#ff4444;font-size:13px;display:none;"></p>
            <button id="save-ds-btn" style="padding:12px 30px;width:100%;background:#28a745;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">Save & Continue</button>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById("save-ds-btn").onclick = async () => {
        const affId = document.getElementById("modal-ds-id").value.trim();
        if (!affId) return;
        try {
            const res = await fetch(`${API_BASE_URL}/user/set-affiliate-id`, {
                method: "POST",
                headers: NGROK_HEADERS,
                body: JSON.stringify({ user_id: CURRENT_USER_ID, affiliate_id: affId })
            });
            if (res.ok) location.reload();
            else alert("Error saving ID.");
        } catch (e) { alert("Connection Error."); }
    };
}

/* ---------------- MENU & EVENT LISTENERS ---------------- */
function setupMenus() {
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("menu");
    const close = document.getElementById("close-menu");
    if (btn && sidebar) btn.onclick = () => sidebar.style.display = "flex";
    if (close && sidebar) close.onclick = () => sidebar.style.display = "none";
}

function setupEventListeners() {
    const genBtn = document.getElementById("generate-btn");
    if (genBtn) genBtn.onclick = generateLink;

    const uplinerBtn = document.getElementById("btn");
    if (uplinerBtn) {
        uplinerBtn.onclick = async () => {
            const res = await fetch(`${API_BASE_URL}/user/upliner/${CURRENT_USER_ID}`, { headers: NGROK_HEADERS });
            const data = await res.json();
            alert(data.name ? `Upliner: ${data.name}\nContact: ${data.phone}` : "Upliner: None");
        };
    }
}

async function loadProductsDropdown() {
    const select = document.getElementById("product-select");
    if (!select) return;
    try {
        const res = await fetch(`${API_BASE_URL}/products`, { headers: NGROK_HEADERS });
        const products = await res.json();
        select.innerHTML = products.map(p => `<option value="${p.digistore_prod_id}">${p.product_name}</option>`).join('');
    } catch (e) {}
}

async function generateLink() {
    const select = document.getElementById("product-select");
    const productId = select?.value || "467275";
    const res = await fetch(`${API_BASE_URL}/user/generate-link`, {
        method: "POST",
        headers: NGROK_HEADERS,
        body: JSON.stringify({ user_id: CURRENT_USER_ID, product_id: productId })
    });
    const data = await res.json();
    if (data.link) {
        navigator.clipboard.writeText(data.link);
        alert("Link copied: " + data.link);
    }
}

async function loadAchievements() {
    // Basic placeholder so it doesn't crash if called
    console.log("Loading Achievements...");
}
