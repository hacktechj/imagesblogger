/* ---------------- MENU LOGIC ---------------- */
function setupMenus() {
    // UPDATED IDs to match your HTML
    const sidebar = document.getElementById("sidebar"); // Changed from menu-list to sidebar
    const btn = document.getElementById("menu");
    const overlay = document.getElementById("menu-overlay"); // Ensure this exists or is handled
    const closeBtn = document.getElementById("close-menu");

    if (!sidebar || !btn) return;

    function showMenu() {
        sidebar.style.setProperty('display', 'flex', 'important');
        if (overlay) overlay.style.display = "block";
        document.body.style.overflow = "hidden";
    }

    function hideMenu() {
        sidebar.style.setProperty('display', 'none', 'important');
        if (overlay) overlay.style.display = "none";
        document.body.style.overflow = "auto";
    }

    btn.onclick = function(e) {
        e.stopPropagation();
        if (sidebar.style.display !== "flex") {
            showMenu();
        } else {
            hideMenu();
        }
    };

    if (overlay) overlay.onclick = hideMenu;
    if (closeBtn) closeBtn.onclick = hideMenu;

    const links = sidebar.getElementsByTagName("a");
    for (let link of links) {
        link.onclick = hideMenu;
    }
}

/* ---------------- API & DASHBOARD LOGIC ---------------- */
const API_BASE_URL = "https://unamenable-nathan-telegnostic.ngrok-free.dev/api";
let CURRENT_USER_ID = null;

const NGROK_HEADERS = {
    "ngrok-skip-browser-warning": "69420",
    "Content-Type": "application/json"
};

document.addEventListener("DOMContentLoaded", async () => {
    setupMenus();

    const storedUserId = localStorage.getItem("user_id");

    if (!storedUserId) {
        window.location.href = "login.html";
        return;
    }

    const isAuthenticated = await checkAuth(storedUserId);
    if (!isAuthenticated) {
        localStorage.removeItem("user_id");
        window.location.href = "login.html";
        return;
    }

    CURRENT_USER_ID = storedUserId;
    checkAffiliateStatus();
    loadProductsDropdown();
});

async function checkAuth(userId) {
    if (!userId || userId === "undefined") return false;
    try {
        const url = `${API_BASE_URL}/auth/me?user_id=${userId}`;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "ngrok-skip-browser-warning": "69420",
                "Accept": "application/json"
            }
        });
        if (!res.ok) return false;
        const data = await res.json();
        return data && data.user_id == userId;
    } catch (e) {
        return false;
    }
}

async function checkAffiliateStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/user/dashboard/${CURRENT_USER_ID}`, {
            headers: { "ngrok-skip-browser-warning": "true" }
        });
        if (!response.ok) return;
        
        const data = await response.json();

        if (!data.digistore_id) {
            showAffiliateModal();
        } else {
            renderDashboard(data);
            loadChartData();
            loadAchievements(); 
            setupEventListeners();
        }
    } catch (error) {}
}

async function updateLiveStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/user/dashboard/${CURRENT_USER_ID}`, {
            headers: { "ngrok-skip-browser-warning": "true" }
        });
        if (response.ok) {
            const data = await response.json();
            renderDashboard(data);
            loadChartData();
        }
    } catch (error) {}
}

function renderDashboard(data) {
    const greetings = document.getElementById("greetings");
    if (greetings) {
        // Targeted the internal span 'username' to keep 'Good Day' static
        const nameSpan = document.getElementById("username");
        if (nameSpan) nameSpan.innerText = data.username;
        else greetings.innerText = `Good Day, ${data.username}`;
    }
    
    const earnings = document.getElementById("earnings");
    if (earnings) earnings.innerText = (data.sales_volume || 0).toLocaleString('de-DE');

    const teamSales = document.getElementById("earnings-team"); 
    if (teamSales) teamSales.innerText = (data.team_volume || 0).toLocaleString('de-DE');

    const salesCount = document.getElementById("earnings-sale"); 
    if (salesCount) salesCount.innerText = data.sales_count || 0;

    const clickCount = document.getElementById("earnings-clicks");
    if (clickCount) {
        clickCount.innerText = data.clicks !== undefined ? data.clicks : 0;
    }

    const clickPercent = document.getElementById("usd-clicks");
    if (clickPercent) {
        const goal = 100; 
        const currentClicks = data.clicks || 0;
        const percentage = Math.min((currentClicks / goal) * 100, 100).toFixed(1);
        clickPercent.innerText = `${percentage}%`;
    }
}

async function loadProductsDropdown() {
    const select = document.getElementById("product-select");
    if (!select) return;
    try {
        const res = await fetch(`${API_BASE_URL}/products`, {
            headers: { "ngrok-skip-browser-warning": "true" }
        });
        const products = await res.json();
        select.innerHTML = "";
        products.forEach(prod => {
            const option = document.createElement("option");
            option.value = prod.digistore_prod_id;
            option.innerText = prod.product_name;
            select.appendChild(option);
        });
    } catch (e) {}
}

async function generateLink() {
    const select = document.getElementById("product-select");
    const productId = (select && select.value) ? select.value : "467275";
    
    try {
        const response = await fetch(`${API_BASE_URL}/user/generate-link`, {
            method: "POST",
            headers: NGROK_HEADERS,
            body: JSON.stringify({ 
                user_id: CURRENT_USER_ID, 
                product_id: productId 
            })
        });

        const data = await response.json();

        if (data.link) {
            await navigator.clipboard.writeText(data.link);
            alert(`Link copied for Product ID ${productId}:\n${data.link}`);
        } else {
            alert("Error: " + (data.error || "Failed to generate link"));
        }
    } catch (error) {
        alert("Connection error. Please try again.");
    }
}

async function loadAchievements() {
    const categorySelect = document.getElementById("achievements");
    const activeKey = categorySelect ? categorySelect.value : "clicks";
    try {
        const response = await fetch(`${API_BASE_URL}/user/achievements/${CURRENT_USER_ID}`, {
            headers: { "ngrok-skip-browser-warning": "true" }
        });
        if (!response.ok) return;
        
        const allData = await response.json();
        const progressList = allData[activeKey];
        if (!progressList) return;

        const currentVal = progressList[0].current; 
        let nextMilestone = progressList.find(m => m.status === "locked") || progressList[progressList.length - 1];
        let diff = nextMilestone.milestone - currentVal;
        
        const pathStats = document.getElementById("path-stats");
        if (pathStats) {
            pathStats.innerText = `You have ${currentVal} out of ${nextMilestone.milestone}. ${diff > 0 ? diff + ' more for next reward' : 'All milestones reached!'}`;
        }

        progressList.forEach((item, index) => {
            const btn = document.getElementById(`reward-received${index + 1}`);
            if (btn) {
                btn.innerText = item.status === "claimed" ? "Claimed" : 
                                item.status === "available" ? "Collect Reward" : "Locked";
                btn.disabled = item.status !== "available";
                btn.style.backgroundColor = item.status === "available" ? "#28a745" : "";
                btn.style.color = item.status === "available" ? "white" : "";
            }
        });
    } catch (error) {}
}

async function collectReward(category, milestone) {
    try {
        const response = await fetch(`${API_BASE_URL}/user/achievements/collect`, {
            method: "POST",
            headers: NGROK_HEADERS,
            body: JSON.stringify({ user_id: CURRENT_USER_ID, category, milestone })
        });
        const data = await response.json();
        if (data.status === "success") {
            window.open(data.reward_url, "_blank");
            loadAchievements();
        }
    } catch (error) {}
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
