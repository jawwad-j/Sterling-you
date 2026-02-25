/* -------------------------------------------------------------------------- */
/* cart.js                                                                    */
/* Centralized Cart, Badges & Navbar Logic                                    */
/* -------------------------------------------------------------------------- */

// --- 1. SHARED NAVBAR LOGIC ---
async function loadNavbar() {
    const nav = document.getElementById('dynamic-nav');
    if (!nav) return;

    const baseClass = "hover:text-[#B36A5E] transition pb-1 font-medium"; 
    const boldClass = "hover:text-[#B36A5E] transition pb-1 font-bold";
    const ordered = ["Handbags", "Footwear", "Beauty", "Accessories", "Fashion"];
    
    let dbCats = new Set();
    try {
        const snap = await db.collection("categories").get();
        dbCats = new Set(snap.docs.map(d => d.data().name));
    } catch (e) { console.log("Nav load error", e); }

    let h = `<li><a href="index.html" class="${baseClass}">Home</a></li><li><a href="category.html?type=New" class="${boldClass}">NEW</a></li>`; 
    ordered.forEach(c => {
        if (dbCats.has(c)) { h += `<li><a href="category.html?type=${c}" class="${baseClass}">${c}</a></li>`; dbCats.delete(c); }
        else { h += `<li><a href="category.html?type=${c}" class="${baseClass}">${c}</a></li>`; }
    });
    dbCats.forEach(c => h += `<li><a href="category.html?type=${c}" class="${baseClass}">${c}</a></li>`);
    h += `<li><a href="category.html?type=Sale" class="text-[#B36A5E] italic font-bold hover:opacity-80 transition pb-1">Sale</a></li>`;
    nav.innerHTML = h;
}

// --- 2. CART LOGIC ---
window.toggleCart = () => {
    const d = document.getElementById('cart-drawer'), o = document.getElementById('cart-overlay');
    if (d && o) { 
        d.classList.toggle('translate-x-full'); 
        o.classList.toggle('hidden'); 
        if (!d.classList.contains('translate-x-full')) renderSidebarCart(); 
    }
};

window.addToCart = (p) => {
    // 1. VALIDATION
    if (!p.id) { console.error("Product has no ID:", p); alert("Error adding to cart. Please refresh."); return; }

    // 2. DETERMINE MAX STOCK (Safe check for empty strings)
    const maxStock = (p.stock !== undefined && p.stock !== null && p.stock !== "") ? Number(p.stock) : 999;

    // 3. INITIAL STOCK CHECK
    if (maxStock <= 0) { 
        alert("Sorry, this item is out of stock."); return; 
    }

    let c = JSON.parse(localStorage.getItem('cart')) || [];
    // ENSURE STRING COMPARISON FOR IDS
    let idx = c.findIndex(i => String(i.id).trim() === String(p.id).trim());
    
    // 4. SANITIZE DATA
    const cleanProduct = {
        id: String(p.id).trim(),
        name: String(p.name).trim(),
        price: Number(p.price) || 0,
        originalPrice: Number(p.originalPrice || p.price) || 0,
        image: p.image || '',
        stock: maxStock,
        quantity: 1
    };

    if (idx > -1) {
        // STRICT STOCK CHECK
        if(c[idx].quantity >= cleanProduct.stock) { 
            alert(`Sorry, there is no more stock left. We only have ${cleanProduct.stock} units available.`); 
            return; 
        }
        
        c[idx].quantity += 1;
        // Update details
        c[idx].price = cleanProduct.price;
        c[idx].image = cleanProduct.image;
        c[idx].stock = cleanProduct.stock; 
    } else {
        c.push(cleanProduct);
    }
    
    localStorage.setItem('cart', JSON.stringify(c));
    updateCartBadge();
    toggleCart();
};

window.changeQty = (i, d) => {
    let c = JSON.parse(localStorage.getItem('cart'));
    if (!c || !c[i]) return;

    // STRICT CHECK FOR QTY INCREASE
    if (d > 0) {
        const stockLimit = (c[i].stock !== undefined && c[i].stock !== null && c[i].stock !== "") ? Number(c[i].stock) : 999;
        if (c[i].quantity >= stockLimit) {
            alert(`Sorry, there is no more stock left. We only have ${stockLimit} units available.`);
            return;
        }
    }

    c[i].quantity += d;
    if (c[i].quantity <= 0) c.splice(i, 1);
    localStorage.setItem('cart', JSON.stringify(c));
    renderSidebarCart();
    updateCartBadge();
};

window.removeFromCart = (i) => {
    let c = JSON.parse(localStorage.getItem('cart'));
    c.splice(i, 1);
    localStorage.setItem('cart', JSON.stringify(c));
    renderSidebarCart();
    updateCartBadge();
};

function updateCartBadge() {
    const c = JSON.parse(localStorage.getItem('cart')) || [];
    const b = document.getElementById('cart-count-badge');
    if (b) b.innerText = c.reduce((t, i) => t + (i.quantity || 1), 0);
}

function renderSidebarCart() {
    const l = document.getElementById('sidebar-cart-list');
    const c = JSON.parse(localStorage.getItem('cart')) || [];
    let subtotal = 0, savings = 0;

    if (!c.length) {
        l.innerHTML = '<div class="h-full flex justify-center items-center text-xs text-gray-400 uppercase tracking-widest">Your bag is empty</div>';
        
        // Reset footer if empty
        const footer = document.querySelector('#cart-drawer .border-t');
        if(footer) {
             const btn = footer.querySelector('button');
             footer.innerHTML = `<div class="flex justify-between font-bold text-[#322C2B] text-sm mb-4"><span>Subtotal</span><span>৳0</span></div><p class="text-[10px] text-gray-400 italic mb-4 text-right">Shipping calculated at checkout</p>`;
             if(btn) footer.appendChild(btn);
        }
        return;
    }

    // Render Items
    l.innerHTML = c.map((i, x) => {
        const tot = i.price * i.quantity;
        const org = (i.originalPrice || i.price) * i.quantity;
        savings += (org - tot); 
        subtotal += tot;
        return `
        <div class="flex gap-4 mb-6 border-b border-gray-100 pb-6 last:border-0 animate-fadeIn">
            <div class="w-16 h-20 flex-shrink-0 bg-gray-50 rounded overflow-hidden border border-gray-100"><img src="${i.image}" class="w-full h-full object-cover"></div>
            <div class="flex-1 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start"><h4 class="text-[11px] font-bold uppercase text-[#322C2B] leading-tight pr-4 line-clamp-2">${i.name}</h4><button onclick="removeFromCart(${x})" class="text-gray-400 hover:text-red-500 transition">×</button></div>
                    <p class="text-[10px] text-gray-400 mt-1">Unit: ৳${Number(i.price).toLocaleString()}</p>
                </div>
                <div class="flex justify-between items-end mt-2">
                    <div class="flex items-center border border-gray-200 rounded-md"><button onclick="changeQty(${x},-1)" class="px-2.5 py-1 hover:bg-gray-50 text-gray-500">-</button><span class="text-[10px] font-bold text-[#322C2B] min-w-[20px] text-center">${i.quantity}</span><button onclick="changeQty(${x},1)" class="px-2.5 py-1 hover:bg-gray-50 text-gray-500">+</button></div>
                    <span class="text-[12px] font-bold text-[#322C2B]">৳${tot.toLocaleString()}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    // --- FOOTER RENDERING ---
    const footer = document.querySelector('#cart-drawer .border-t');
    if (footer) {
        // Get the button to preserve it
        let btn = footer.querySelector('button');
        if (!btn) {
            btn = document.createElement('button');
            btn.onclick = () => window.location.href='checkout.html';
            btn.className = "w-full bg-[#322C2B] text-white py-4 rounded-xl font-bold uppercase text-xs hover:bg-[#B36A5E] transition shadow-lg tracking-widest";
            btn.innerText = "Checkout Now";
        }

        let html = '';

        // 1. Savings (Green, exact size requested)
        if (savings > 0) {
            html += `<div class="flex justify-between text-[11px] text-green-600 font-bold mb-2"><span>Total Savings</span><span>-৳${savings.toLocaleString()}</span></div>`;
        }

        // 2. Subtotal
        html += `<div class="flex justify-between font-bold text-[#322C2B] text-sm mb-2"><span>Subtotal</span><span>৳${subtotal.toLocaleString()}</span></div>`;

        // 3. Static Text
        html += `<p class="text-[10px] text-gray-400 italic mb-4 text-right">Shipping calculated at checkout</p>`;

        footer.innerHTML = html;
        footer.appendChild(btn);
    }
}

document.addEventListener('DOMContentLoaded', () => { updateCartBadge(); loadNavbar(); });

// --- 3. HELPER FUNCTIONS ---

window.toggleReceiver = (val) => {
    const el = document.getElementById('recv-details');
    if (!el) return;
    const reqFields = ['recv-relation','recv-name','recv-phone'];
    if (val === 'Other') {
        el.classList.remove('hidden');
        reqFields.forEach(id => { const f = document.getElementById(id); if(f) f.required = true; });
    } else {
        el.classList.add('hidden');
        reqFields.forEach(id => { const f = document.getElementById(id); if(f) f.required = false; });
    }
};

window.getCheckoutExtras = () => {
    const instruction = document.getElementById('del-instruction') ? document.getElementById('del-instruction').value : '';
    const typeEl = document.querySelector('input[name="recv_type"]:checked');
    const type = typeEl ? typeEl.value : 'Me';
    let receiverData = { type: type, relation: 'Self', name: null, phone: null };
    if (type === 'Other') {
        receiverData.relation = document.getElementById('recv-relation') ? document.getElementById('recv-relation').value : '';
        receiverData.name = document.getElementById('recv-name') ? document.getElementById('recv-name').value : '';
        receiverData.phone = document.getElementById('recv-phone') ? document.getElementById('recv-phone').value : '';
    }
    return { instruction, receiverData };
};

window.getProductBadge = (stock) => {
    // Treat missing or empty string as unlimited stock (no badge)
    if (stock === undefined || stock === null || stock === "") return '';
    
    const numStock = Number(stock);
    if (isNaN(numStock)) return '';

    if (numStock <= 0) return `<span class="absolute top-2 left-2 bg-gray-900 text-white text-[9px] font-bold px-2 py-1 uppercase tracking-widest shadow-sm">Sold Out</span>`;
    if (numStock <= 5) return `<span class="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-bold px-2 py-1 uppercase tracking-widest shadow-sm animate-pulse">Low Stock</span>`;
    return '';
};

window.renderActionButtons = (product) => {
    const cleanName = product.name ? product.name.replace(/'/g, "\\'").replace(/"/g, '&quot;') : "Product";
    
    // Default to 999 if stock is missing or empty string. Only truly 0 if explicitly set to 0.
    let currentStock = 999;
    if (product.stock !== undefined && product.stock !== null && product.stock !== "") {
        const parsedStock = Number(product.stock);
        if (!isNaN(parsedStock)) currentStock = parsedStock;
    }

    const pStr = JSON.stringify({
        id: String(product.id).trim(),
        name: cleanName,
        price: Number(product.price) || 0,
        originalPrice: Number(product.originalPrice || product.price) || 0,
        image: product.image || '',
        stock: currentStock
    }).replace(/"/g, '&quot;');
    
    if (currentStock > 0) {
        return `<button onclick="addToCart(${pStr})" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[#B36A5E] transition shadow-lg">Add to Cart</button>`;
    } else {
        return `<button onclick="requestProduct('${String(product.id).trim()}', '${cleanName}')" class="w-full bg-gray-200 text-gray-600 py-3 rounded-xl font-bold uppercase text-xs hover:bg-gray-300 transition">Request Restock</button>`;
    }
};

window.requestProduct = async (pid, pname) => {
    const user = firebase.auth().currentUser;
    if (!user) { alert("Please login to request a product."); return; }
    try {
        const userDoc = await firebase.firestore().collection("users").doc(user.uid).get();
        const userData = userDoc.data();
        await firebase.firestore().collection("product_requests").add({
            productId: pid, productName: pname, userId: user.uid,
            userName: userData.fullName || "Unknown", userPhone: userData.phone || "Unknown",
            requestDate: new Date().toISOString(), status: "New"
        });
        alert("Request sent! We will notify you when stock is available.");
    } catch (e) { console.error(e); alert("Error sending request."); }
};