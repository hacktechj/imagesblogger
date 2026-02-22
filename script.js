/* ---------------- CONSTANTS & HEADERS ---------------- */
const API_BASE_URL = "https://unamenable-nathan-telegnostic.ngrok-free.dev/api";
const NGROK_HEADERS = {
    "ngrok-skip-browser-warning": "69420",
    "Content-Type": "application/json",
    "Accept": "application/json"
};
let CURRENT_USER_ID = null;

/* ---------------- INITIALIZATION ---------------- */
document.addEventListener("DOMContentLoaded", () => {
    setupMenus();
    
    const storedUserId = localStorage.getItem("user_id");
    if (!storedUserId) {
        console.warn("No user_id found. Please log in.");
        return;
    }

    CURRENT_USER_ID = storedUserId;
    initializeApp();
});

async function initializeApp() {
    try {
        // 1. Validate User & Get Dashboard Data
        const response = await fetch(`${API_BASE_URL}/user/dashboard/${CURRENT_USER_ID}`, {
            headers: NGROK_HEADERS
        });
        
        if (!response.ok) return;
        const data = await response.json();

        // 2. DIGISTORE CHECK: If ID is missing, force the modal
        if (!data.digistore_id) {
            showAffiliateModal();
        } else {
            renderDashboard(data);
            loadChartData(); // This draws the SVG lines
            loadProductsDropdown();
            setupEventListeners();
        }
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

/* ---------------- DASHBOARD & CHART ---------------- */
function renderDashboard(data) {
    if (document.getElementById("username")) document.getElementById("username").innerText = data.username;
    if (document.getElementById("earnings")) document.getElementById("earnings").innerText = (data.sales_volume || 0).toLocaleString('de-DE');
    if (document.getElementById("earnings-team")) document.getElementById("earnings-team").innerText = (data.team_volume || 0).toLocaleString('de-DE');
    if (document.getElementById("earnings-sale")) document.getElementById("earnings-sale").innerText = data.sales_count || 0;
    if (document.getElementById("earnings-clicks")) document.getElementById("earnings-clicks").innerText = data.clicks || 0;
}

async function loadChartData() {
    try {
        const res = await fetch(`${API_BASE_URL}/user/chart/${CURRENT_USER_ID}`, { headers: NGROK_HEADERS });
        const data = await res.json(); 

        const chartMain = document.getElementById("chart-main");
        const lineElement = document.getElementById("chart-line");
        if (!chartMain || !lineElement) return;

        const chartWidth = chartMain.clientWidth;
        const chartHeight = 200;
        const points = [];

        for (let i = 1; i <= 7; i++) {
            const count = data[i-1]?.click_count || 0;
            const bar = document.getElementById(`day${i}-bar`);
            
            // Update Bars
            const heightPercent = Math.min((count / 30) * 100, 100);
            if (bar) bar.style.height = `${heightPercent}%`;

            // Calculate SVG Line Points
            const xPos = ((i - 1) * (chartWidth / 7)) + ((chartWidth / 7) / 2);
            const yPos = chartHeight - (heightPercent * (chartHeight / 100));
            points.push(`${xPos},${yPos}`);
        }
        lineElement.setAttribute("points", points.join(" "));
    } catch (e) { console.error("Chart Error:", e); }
}

/* ---------------- DIGISTORE MODAL ---------------- */
function showAffiliateModal() {
    if (document.getElementById("affiliate-overlay-modal")) return;

    const modal = document.createElement("div");
    modal.id = "affiliate-overlay-modal";
    modal.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(10px);`;
    modal.innerHTML = `
        <div style="background:#111; padding:30px; border-radius:15px; border:1px solid #333; text-align:center; width:90%; max-width:350px;">
            <h2 style="color:white; font-family:Tajawal;">Digistore24 ID Required</h2>
            <p style="color:#888; margin:15px 0;">Enter your ID to sync your live sales data.</p>
            <input id="ds-input" type="text" placeholder="Your ID" style="width:100%; padding:12px; background:#000; border:1px solid #444; color:white; border-radius:8px; margin-bottom:15px;">
            <button id="ds-save" style="width:100%; padding:12px; background:#28a745; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Link Account</button>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById("ds-save").onclick = async () => {
        const val = document.getElementById("ds-input").value.trim();
        if (!val) return alert("Please enter an ID");

        const res = await fetch(`${API_BASE_URL}/user/set-affiliate-id`, {
            method: "POST",
            headers: NGROK_HEADERS,
            body: JSON.stringify({ user_id: CURRENT_USER_ID, affiliate_id: val })
        });

        if (res.ok) {
            modal.remove();
            location.reload();
        } else {
            alert("Error saving ID. Please try again.");
        }
    };
}

/* ---------------- MENU & UTILS ---------------- */
function setupMenus() {
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("menu");
    const close = document.getElementById("close-menu");
    if (!sidebar || !btn) return;

    btn.onclick = () => sidebar.style.display = "flex";
    close.onclick = () => sidebar.style.display = "none";
}

function setupEventListeners() {
    const genBtn = document.getElementById("generate-btn");
    if (genBtn) genBtn.onclick = generateLink;
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

async function loadProductsDropdown() {
    const select = document.getElementById("product-select");
    if (!select) return;
    const res = await fetch(`${API_BASE_URL}/products`, { headers: NGROK_HEADERS });
    const products = await res.json();
    select.innerHTML = products.map(p => `<option value="${p.digistore_prod_id}">${p.product_name}</option>`).join('');
}

async function checkAuth(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/auth/me?user_id=${userId}`, {
            headers: NGROK_HEADERS
        });
        const data = await res.json();
        return res.ok && data.user_id == userId;
    } catch (e) { return false; }
}

async function checkAffiliateStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/user/dashboard/${CURRENT_USER_ID}`, {
            headers: NGROK_HEADERS
        });
        
        if (!response.ok) throw new Error("Dashboard fetch failed");
        const data = await response.json();

        // CRITICAL: If Digistore ID is missing, force the modal
        if (!data.digistore_id || data.digistore_id === "") {
            console.log("Digistore ID missing. Showing modal...");
            showAffiliateModal();
        } else {
            console.log("Digistore ID found. Loading Dashboard.");
            renderDashboard(data);
            loadChartData();
            loadAchievements(); 
            setupEventListeners();
        }
    } catch (error) {
        console.error("Affiliate Status Error:", error);
    }
}

async function showAffiliateModal() {
    if (document.getElementById("affiliate-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "affiliate-overlay";
    overlay.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(8px);`;
    
    overlay.innerHTML = `
        <div style="background:#1a1a1a;padding:40px;border-radius:15px;text-align:center;border:1px solid #333;max-width:400px;width:90%;box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="color:white;margin-bottom:10px;font-family:Tajawal, sans-serif;">Link Your Account</h2>
            <p style="color:#aaa;margin-bottom:20px;">Enter your Digistore24 ID to sync your sales data.</p>
            <input id="modal-ds-id" placeholder="Digistore24 ID" style="padding:12px;width:100%;margin-bottom:10px;border-radius:5px;border:1px solid #444;background:#000;color:white;outline:none;">
            <p id="modal-error" style="color:#ff4444;font-size:13px;display:none;margin-bottom:10px;"></p>
            <button id="save-ds-btn" style="padding:12px 30px;width:100%;background:#28a745;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;transition:0.3s;">Save & Continue</button>
        </div>`;
    
    document.body.appendChild(overlay);

    const btn = document.getElementById("save-ds-btn");
    const input = document.getElementById("modal-ds-id");
    const errorMsg = document.getElementById("modal-error");

    btn.onclick = async () => {
        const affId = input.value.trim();
        if (!affId) {
            errorMsg.innerText = "Please enter your ID";
            errorMsg.style.display = "block";
            return;
        }

        btn.innerText = "Syncing...";
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/user/set-affiliate-id`, {
                method: "POST",
                headers: NGROK_HEADERS,
                body: JSON.stringify({ 
                    user_id: CURRENT_USER_ID, 
                    affiliate_id: affId 
                })
            });

            const result = await res.json();

            if (res.ok && result.status === "success") {
                overlay.remove();
                location.reload(); // Refresh to populate dashboard
            } else {
                errorMsg.innerText = result.message || "Could not link ID.";
                errorMsg.style.display = "block";
                btn.innerText = "Save & Continue";
                btn.disabled = false;
            }
        } catch (e) {
            errorMsg.innerText = "Server Error. Try again later.";
            errorMsg.style.display = "block";
            btn.disabled = false;
        }
    };
}

/* ---------------- RENDERING HELPERS ---------------- */
function renderDashboard(data) {
    document.getElementById("username").innerText = data.username || "Affiliate";
    document.getElementById("earnings").innerText = (data.sales_volume || 0).toLocaleString('de-DE');
    document.getElementById("earnings-team").innerText = (data.team_volume || 0).toLocaleString('de-DE');
    document.getElementById("earnings-sale").innerText = data.sales_count || 0;
    document.getElementById("earnings-clicks").innerText = data.clicks || 0;

    const clickPercent = document.getElementById("usd-clicks");
    if (clickPercent) {
        const percentage = Math.min(((data.clicks || 0) / 100) * 100, 100).toFixed(1);
        clickPercent.innerText = `${percentage}%`;
    }
}


async function loadChartData() {
    try {
        const res = await fetch(`${API_BASE_URL}/user/chart/${CURRENT_USER_ID}`, {
            method: "GET",
            headers: { "ngrok-skip-browser-warning": "69420", "Accept": "application/json" }
        });
        if (!res.ok) return;
        const data = await res.json(); 

        const maxPossible = 30; 
        const chartHeight = 200; 
        
        const chartMain = document.getElementById("chart-main");
        if (!chartMain) return;
        const chartWidth = chartMain.clientWidth; 
        
        // Corrected selector to find the SVG within main-chart
        const svgElement = document.querySelector("#main-chart svg");
        if (svgElement) {
            svgElement.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
        }

        const points = [];

        for (let i = 1; i <= 7; i++) {
            const dayContainer = document.getElementById(`day-${i}`);
            const dayData = data[i - 1];
            const count = (dayData && dayData.click_count !== undefined) ? dayData.click_count : 0;

            if (dayContainer) {
                const percentLabel = dayContainer.querySelector("p:first-child");
                const countLabel = dayContainer.querySelector("p:last-child");
                const heightPercent = Math.min((count / maxPossible) * 100, 100);
                
                if (percentLabel) percentLabel.innerText = `${Math.round(heightPercent)}%`;
                if (countLabel) countLabel.innerText = count;
                
                const bar = document.getElementById(`day${i}-bar`);
                if (bar) bar.style.height = `${heightPercent}%`;
            }

            const yPos = chartHeight - Math.min((count / maxPossible) * chartHeight, chartHeight);
            const xPos = ((i - 1) * (chartWidth / 7)) + ((chartWidth / 7) / 2); 
            points.push(`${xPos},${yPos}`);
        }

        const lineElement = document.getElementById("chart-line");
        if (lineElement) {
            lineElement.setAttribute("points", points.join(" "));
        }

    } catch (e) {
        console.error("Chart loading error", e);
    }
}

async function showAffiliateModal() {
    if (document.getElementById("affiliate-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "affiliate-overlay";
    overlay.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(5px);`;
    
    overlay.innerHTML = `
        <div style="background:#1a1a1a;padding:40px;border-radius:15px;text-align:center;border:1px solid #333;max-width:400px;width:90%;">
            <h2 style="color:white;margin-bottom:10px;">Link Your Account</h2>
            <p style="color:#aaa;margin-bottom:20px;">Please enter your Digistore24 ID to access your dashboard.</p>
            <input id="modal-ds-id" placeholder="Your Digistore ID" style="padding:12px;width:100%;margin-bottom:10px;border-radius:5px;border:1px solid #444;background:#000;color:white;">
            <p id="modal-error" style="color:#ff4444;font-size:14px;display:none;margin-bottom:10px;"></p>
            <button id="save-ds-btn" style="padding:12px 30px;width:100%;background:#28a745;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">Verify & Start</button>
        </div>`;
    
    document.body.appendChild(overlay);

    const btn = document.getElementById("save-ds-btn");
    const input = document.getElementById("modal-ds-id");
    const errorMsg = document.getElementById("modal-error");

    btn.onclick = async () => {
        const affId = input.value.trim();
        if (!affId) {
            errorMsg.innerText = "Please enter an ID";
            errorMsg.style.display = "block";
            return;
        }

        btn.innerText = "Verifying...";
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/user/set-affiliate-id`, {
                method: "POST",
                headers: NGROK_HEADERS,
                body: JSON.stringify({ user_id: CURRENT_USER_ID, affiliate_id: affId })
            });

            const result = await res.json();

            if (res.ok && result.status === "success") {
                document.body.removeChild(overlay);
                location.reload(); 
            } else {
                errorMsg.innerText = result.message || "Invalid ID. Try again.";
                errorMsg.style.display = "block";
                btn.innerText = "Verify & Start";
                btn.disabled = false;
                input.value = ""; 
            }
        } catch (e) {
            errorMsg.innerText = "Connection error. Try again.";
            errorMsg.style.display = "block";
            btn.disabled = false;
        }
    };
}

function setupEventListeners() {
    const genBtn = document.getElementById("generate-btn");
    if (genBtn) genBtn.onclick = generateLink;

    const achSelect = document.getElementById("achievements");
    if (achSelect) achSelect.onchange = loadAchievements;
    
    const uplinerBtn = document.getElementById("btn");
    if (uplinerBtn) {
        uplinerBtn.onclick = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/user/upliner/${CURRENT_USER_ID}`, {
                    headers: { "ngrok-skip-browser-warning": "true" }
                });
                const data = await res.json();
                if (data && data.name) {
                    alert(`Your Upliner: ${data.name}\nContact: ${data.phone || "No phone provided"}`);
                } else {
                    alert("Upliner: None");
                }
            } catch (error) {
                alert("Upliner: None (Server Error)");
            }
        };
    }
}
