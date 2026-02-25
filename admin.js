// admin.js - The Brain of Sterling v8.1

// 1. LOGISTICS & STATE
const logistics = {
    Pathao: {
        cod: 0.01,
        Dhaka: { base500: 60, base1kg: 70, base2kg: 90, extra: 15 },
        SubDhaka: { base500: 80, base1kg: 100, base2kg: 130, extra: 25 },
        Outside: { base500: 110, base1kg: 130, base2kg: 170, extra: 25 }
    }
};

let products = []; // Now controlled by Firebase
let customers = [{ id: 101, name: "Tanvir Hasan", phone: "01700000000", address: "Dhaka", totalSpent: 15000, risk: "Active" }];
let orders = [{ id: 2001, userId: 101, productId: 1, amount: 7999, status: "Pending", date: "2026-02-05", payType: "COD" }];

// 2. FIREBASE CORE LOGIC
function fetchProductsFromCloud() {
    console.log("📡 Connecting to Firestore Live Stream...");
    db.collection("products").onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({
            fireId: doc.id,
            ...doc.data()
        }));
        console.log("✅ Cloud Sync:", products.length, "items");
        
        // Auto-refresh UI
        renderInventory();
        renderPipeline();
        calculatePL(); 
    }, (error) => {
        console.error("Cloud Sync Error:", error);
    });
}

// 3. INITIALIZATION (One single onload)
window.onload = () => {
    fetchProductsFromCloud();
    // Orders and CRM still use local arrays for now until you migrate them too
    renderCRM();
};

// 4. FINANCIAL ENGINE (P&L)
function calculatePL() {
    const from = document.getElementById('global-from').value;
    const to = document.getElementById('global-to').value;

    let totalRevenue = 0, totalLandingCost = 0, totalLogistics = 0;
    let totalCODCharges = 0, courierTransit = 0, successCount = 0, returnCount = 0;

    orders.forEach(o => {
        if (from && o.date < from) return;
        if (to && o.date > to) return;

        if (o.status !== "Cancelled" && o.status !== "Returned") {
            totalRevenue += o.amount;
            const p = products.find(prod => prod.id === o.productId);
            if(p) totalLandingCost += p.costPrice || 0; 
            
            if(o.status === "Shipped" || o.status === "Delivered") {
                const shipCost = o.shippingCost || 70; 
                totalLogistics += shipCost;
                if(o.payType === "COD") totalCODCharges += (o.amount * 0.01);
                if(o.status === "Shipped") courierTransit += (o.amount * 0.99) - shipCost;
            }
            if(o.status === "Delivered") successCount++;
        }
        if(o.status === "Returned") returnCount++;
    });

    const grossProfit = totalRevenue - (totalLandingCost + totalLogistics + totalCODCharges);
    
    document.getElementById('kpi-revenue').innerText = "৳" + totalRevenue.toLocaleString();
    document.getElementById('kpi-gross').innerText = "৳" + grossProfit.toLocaleString();
    document.getElementById('kpi-net').innerText = "৳" + grossProfit.toLocaleString(); // Simplified for now
    document.getElementById('kpi-transit').innerText = "৳" + Math.round(courierTransit).toLocaleString();
    
    updateCharts(grossProfit, courierTransit, successCount, returnCount);
}

// 5. INVENTORY RENDER (Crucial for the Inventory page)
function renderInventory() {
    const table = document.getElementById('inventory-table');
    if(!table) return; 
    
    table.innerHTML = products.map(p => `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-4">
                <div class="flex items-center gap-3">
                    <img src="${p.image}" class="w-12 h-12 rounded-lg object-cover border" onerror="this.src='https://via.placeholder.com/50'">
                    <span class="font-bold">${p.name}</span>
                </div>
            </td>
            <td class="p-4 text-gray-500">${p.category}</td>
            <td class="p-4 font-mono">৳${p.costPrice}</td>
            <td class="p-4 font-bold text-[#B36A5E]">৳${p.price}</td>
            <td class="p-4">${p.stock} units</td>
            <td class="p-4">
                <button onclick="editStock('${p.fireId}')" class="text-blue-600 hover:underline text-xs">Edit</button>
            </td>
        </tr>
    `).join('');
}

// 6. PIPELINE & ACTIONS
function renderPipeline() {
    const pending = orders.filter(o => o.status === "Pending" || o.status === "On Hold");
    const container = document.getElementById('pipeline-pending');
    if(!container) return;

    document.getElementById('count-pending').innerText = pending.length;
    container.innerHTML = pending.map(o => {
        const c = customers.find(u => u.id === o.userId);
        return `
            <tr class="border-b">
                <td class="p-4 font-bold">#ORD-${o.id}</td>
                <td>${c ? c.name : 'Unknown'}</td>
                <td class="font-bold">৳${o.amount}</td>
                <td><span class="px-2 py-1 rounded text-[9px] font-bold uppercase">${o.status}</span></td>
                <td><button onclick="triggerVerification(${o.id})" class="bg-[#1F2937] text-white px-3 py-1 rounded text-[9px]">Action</button></td>
            </tr>
        `;
    }).join('');
}

// [Include your other functions: triggerVerification, updateOrderStatus, processShipment, updateCharts, closeModal, renderCRM, etc. here]

// 7. CLOUD UTILITIES
async function migrateToCloud() {
    console.log("Starting migration...");
    const batch = db.batch();
    // Assuming 'productsFromJS' is the array from products.js
    if (typeof productsFromJS === 'undefined') { alert("Check products.js!"); return; }

    productsFromJS.forEach((product) => {
        const docRef = db.collection("products").doc(); 
        batch.set(docRef, product);
    });

    await batch.commit();
    alert("🎉 Success!");
}

let currentQueries = [];
let sortDir = { date: 'desc', status: 'asc' };

async function loadQueries() {
    const tbody = document.getElementById('queries-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center">Loading...</td></tr>';
    
    try {
        const snap = await db.collection("customer_queries").get();
        currentQueries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Update Stats
        const pending = currentQueries.filter(q => q.status === 'Pending').length;
        const solved = currentQueries.filter(q => q.status === 'Solved').length;
        document.getElementById('query-stat-pending').innerText = pending;
        document.getElementById('query-stat-solved').innerText = solved;

        renderQueries(currentQueries);
    } catch (e) { console.error(e); }
}

function renderQueries(list) {
    const tbody = document.getElementById('queries-table-body');
    if(!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-gray-400">No messages.</td></tr>'; return; }
    
    tbody.innerHTML = list.map(q => {
        const date = new Date(q.date).toLocaleDateString() + ' ' + new Date(q.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-4 text-gray-500 whitespace-nowrap">${date}</td>
            <td>
                <div class="font-bold text-[#322C2B] cursor-pointer hover:underline" onclick="openUserCRM('${q.userId}')">${q.userName}</div>
                <div class="text-[9px] text-gray-400">${q.userPhone}</div>
            </td>
            <td class="font-mono text-[#B36A5E]">${q.orderId ? '#' + q.orderId : '-'}</td>
            <td>
                <div class="font-bold text-xs">${q.subject}</div>
                <div class="text-[10px] text-gray-500 truncate w-48">${q.message}</div>
            </td>
            <td><span class="px-2 py-1 rounded-full text-[9px] font-bold uppercase ${q.status === 'Solved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}">${q.status}</span></td>
            <td>${q.status === 'Pending' ? `<button onclick="markQuerySolved('${q.id}')" class="text-blue-600 font-bold text-[10px] uppercase hover:underline">Mark Solved</button>` : '<span class="text-gray-300 text-[10px]">Done</span>'}</td>
        </tr>`;
    }).join('');
}

window.sortQueries = (type) => {
    if(type === 'status') {
        currentQueries.sort((a, b) => a.status === 'Pending' ? -1 : 1); // Pending always top
    } else if (type === 'date') {
        sortDir.date = sortDir.date === 'asc' ? 'desc' : 'asc';
        currentQueries.sort((a, b) => sortDir.date === 'asc' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));
    }
    renderQueries(currentQueries);
};