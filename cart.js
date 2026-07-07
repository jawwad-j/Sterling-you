/* -------------------------------------------------------------------------- */
/* cart.js                                                                    */
/* Centralized Cart, Badges & Navbar Logic                                    */
/* -------------------------------------------------------------------------- */

// --- GA4 ---
(function() {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-EPT9FZHCYL';
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', 'G-EPT9FZHCYL');
})();

// --- 1. SHARED NAVBAR LOGIC ---
async function loadNavbar() {
    const nav = document.getElementById('dynamic-nav');
    if (!nav) return;

    const baseClass = "hover:text-[#B36A5E] transition pb-1 font-medium"; 
    const boldClass = "hover:text-[#B36A5E] transition pb-1 font-bold";
    const isHomePage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    try {
        // Fetch categories from DB
        const snap = await db.collection("categories").get();
        let dbCats = new Set(snap.docs.map(d => d.data().name).filter(Boolean));

        // Fetch banner order to determine nav order
        let orderedList = [];
        try {
            const bannerSnap = await db.collection("category_banners").orderBy("order").get();
            orderedList = bannerSnap.docs.map(d => d.data().category).filter(Boolean);
        } catch(e) { console.error("Banner nav order error:", e); }

        // Start nav
        let h = '';
        if (!isHomePage) {
            h += `<li><a href="index.html" class="${baseClass}">Home</a></li>`;
        }
        h += `<li><a href="category.html?type=New" class="${boldClass}">NEW</a></li>`;

        // Render banner-ordered categories first
        orderedList.forEach(cat => {
            if (dbCats.has(cat)) {
                h += `<li><a href="category.html?type=${encodeURIComponent(cat)}" class="${baseClass}">${cat}</a></li>`;
                dbCats.delete(cat);
            }
        });

        // Render any remaining categories not in banners
        dbCats.forEach(cat => {
            h += `<li><a href="category.html?type=${encodeURIComponent(cat)}" class="${baseClass}">${cat}</a></li>`;
        });

        // Always end with Sale
        h += `<li><a href="category.html?type=Sale" class="text-[#B36A5E] italic font-bold hover:opacity-80 transition pb-1">Sale</a></li>`;
        
nav.innerHTML = h;

        // Also populate mobile nav
        const mobileNav = document.getElementById('dynamic-nav-mobile');
        if (mobileNav) mobileNav.innerHTML = h;

    } catch (e) { 
        console.error("Nav load error", e); 
    }
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
    if (!p.id) { console.error("Product has no ID:", p); alert("Error adding to cart. Please refresh."); return; }

    const maxStock = (p.stock !== undefined && p.stock !== null && p.stock !== "") ? Number(p.stock) : 999;

    if (maxStock <= 0) { 
        alert("Sorry, this item is out of stock."); return; 
    }

    let c = JSON.parse(localStorage.getItem('cart')) || [];
    let idx = c.findIndex(i => String(i.id).trim() === String(p.id).trim());
    
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
        if(c[idx].quantity >= cleanProduct.stock) { 
            alert(`Sorry, there is no more stock left. We only have ${cleanProduct.stock} units available.`); 
            return; 
        }
        c[idx].quantity += 1;
        c[idx].price = cleanProduct.price;
        c[idx].image = cleanProduct.image;
        c[idx].stock = cleanProduct.stock; 
    } else {
        c.push(cleanProduct);
    }

    fbq('track', 'AddToCart', {
        content_name: cleanProduct.name,
        content_ids: [cleanProduct.id],
        content_type: 'product',
        value: cleanProduct.price,
        currency: 'BDT'
    });

// GA4 add_to_cart
try {
    gtag('event', 'add_to_cart', {
        currency: 'BDT',
        value: Number(cleanProduct.price) || 0,
        items: [{
            item_id: String(cleanProduct.id),
            item_name: cleanProduct.name,
            price: Number(cleanProduct.price) || 0,
            quantity: 1
        }]
    });
} catch(e) {}
    
    localStorage.setItem('cart', JSON.stringify(c));
    updateCartBadge();
    toggleCart();
};

window.changeQty = (i, d) => {
    let c = JSON.parse(localStorage.getItem('cart'));
    if (!c || !c[i]) return;

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
        const footer = document.querySelector('#cart-drawer .border-t');
        if(footer) {
             const btn = footer.querySelector('button');
             footer.innerHTML = `<div class="flex justify-between font-bold text-[#322C2B] text-sm mb-4"><span>Subtotal</span><span>৳0</span></div><p class="text-[10px] text-gray-400 italic mb-4 text-right">Shipping calculated at checkout</p>`;
             if(btn) footer.appendChild(btn);
        }
        return;
    }

    l.innerHTML = c.map((i, x) => {
        const tot = i.price * i.quantity;
        const org = (i.originalPrice || i.price) * i.quantity;
        const itemSavings = org - tot;
        savings += itemSavings; 
        subtotal += tot;

        return `
        <div class="flex gap-4 mb-6 border-b border-gray-100 pb-6 last:border-0 animate-fadeIn">
            <div class="w-16 h-20 flex-shrink-0 bg-gray-50 rounded overflow-hidden border border-gray-100"><img src="${i.image}" class="w-full h-full object-cover"></div>
            <div class="flex-1 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start">
                        <h4 class="text-[11px] font-bold uppercase text-[#322C2B] leading-tight pr-4 line-clamp-2">${i.name}</h4>
                        <button onclick="removeFromCart(${x})" class="text-gray-400 hover:text-red-500 transition">×</button>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-[10px] text-gray-400">Unit: ৳${Number(i.price).toLocaleString()}</p>
                        ${i.originalPrice && i.originalPrice > i.price ? `<span class="text-[10px] text-gray-400 line-through">৳${Number(i.originalPrice).toLocaleString()}</span>` : ''}
                    </div>
                </div>
                <div class="flex justify-between items-end mt-2">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center border border-gray-200 rounded-md">
                            <button onclick="changeQty(${x},-1)" class="px-2.5 py-1 hover:bg-gray-50 text-gray-500">-</button>
                            <span class="text-[10px] font-bold text-[#322C2B] min-w-[20px] text-center">${i.quantity}</span>
                            <button onclick="changeQty(${x},1)" class="px-2.5 py-1 hover:bg-gray-50 text-gray-500">+</button>
                        </div>
                    </div>
                    <div class="text-right">
                        ${itemSavings > 0 ? `<p class="text-[9px] text-green-600 font-bold mb-0.5">Save ৳${itemSavings.toLocaleString()}</p>` : ''}
                        <span class="text-[12px] font-bold text-[#322C2B]">৳${tot.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    const footer = document.querySelector('#cart-drawer .border-t');
    if (footer) {
        let btn = footer.querySelector('button');
        if (!btn) {
            btn = document.createElement('button');
            btn.onclick = () => window.location.href='checkout.html';
            btn.className = "w-full bg-[#322C2B] text-white py-4 rounded-xl font-bold uppercase text-xs hover:bg-[#B36A5E] transition shadow-lg tracking-widest";
            btn.innerText = "Checkout Now";
        }

        let html = '';
        if (savings > 0) {
            html += `<div class="flex justify-between text-[11px] text-green-600 font-bold mb-2"><span>Total Savings</span><span>-৳${savings.toLocaleString()}</span></div>`;
        }
        html += `<div class="flex justify-between font-bold text-[#322C2B] text-sm mb-2"><span>Subtotal</span><span>৳${subtotal.toLocaleString()}</span></div>`;
        html += `<p class="text-[10px] text-gray-400 italic mb-4 text-right">Shipping calculated at checkout</p>`;

        footer.innerHTML = html;
        footer.appendChild(btn);
    }
}

// --- 3. ANNOUNCEMENT BAR ---
window.loadAnnouncementBar = async function() {
    try {
        const doc = await db.collection("settings").doc("storefront").get();
        if (doc.exists && doc.data().announcementBar) {
            const topBarP = document.querySelector('#top-bar p');
            if (topBarP) topBarP.innerText = doc.data().announcementBar;
        }
    } catch(e) { console.error("Announcement bar error:", e); }
};

document.addEventListener('DOMContentLoaded', () => { 
    updateCartBadge(); 
    loadNavbar(); 
    window.loadAnnouncementBar();
});

// --- 4. HELPER FUNCTIONS ---

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
    if (stock === undefined || stock === null || stock === "") return '';
    const numStock = Number(stock);
    if (isNaN(numStock)) return '';
    if (numStock <= 0) return `<span class="absolute top-2 left-2 bg-gray-900 text-white text-[9px] font-bold px-2 py-1 uppercase tracking-widest shadow-sm">Sold Out</span>`;
    if (numStock <= 5) return `<span class="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-bold px-2 py-1 uppercase tracking-widest shadow-sm animate-pulse">Low Stock</span>`;
    return '';
};

window.renderActionButtons = (product) => {
    const cleanName = product.name ? product.name.replace(/'/g, "\\'").replace(/"/g, '&quot;') : "Product";
    
    let currentStock = 999;
    if (product.stock !== undefined && product.stock !== null && product.stock !== "") {
        const parsedStock = Number(product.stock);
        if (!isNaN(parsedStock)) currentStock = parsedStock;
    }

    const isPreorder      = product.isPreorder === true || product.isPreorder === 'true';
    const preorderAdvance = Number(product.preorderAdvance) || 510;

    const pStr = JSON.stringify({
        id: String(product.id).trim(),
        name: cleanName,
        price: Number(product.price) || 0,
        originalPrice: Number(product.originalPrice || product.price) || 0,
        image: product.image || '',
        stock: currentStock,
        isPreorder: isPreorder,
        preorderAdvance: preorderAdvance
    }).replace(/"/g, '&quot;');
    
    if (currentStock > 0) {
        return `<button onclick="addToCart(${pStr})" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[#B36A5E] transition shadow-lg">Add to Cart</button>`;
    } else if (isPreorder) {
        return `<button onclick="openPreorderModal(${pStr})" class="w-full bg-[#B36A5E] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[#322C2B] transition shadow-lg">Pre-order Now</button>`;
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

// Send email notification to admin
try {
    await emailjs.send('service_qr9m3ds', 'template_razbuuu', {
        order_id: 'STOCK REQUEST',
        customer_name: userData.fullName || "Unknown",
        customer_phone: userData.phone || "Unknown",
        total: '0',
        shipping: '0',
        items: pname,
        address: 'Product Request — Not an order'
    });
} catch(e) { console.error('Request notification failed:', e); }

alert("Request sent! We will notify you when stock is available.");
    } catch (e) { console.error(e); alert("Error sending request."); }
};

// --- 5. SURROGATE SESSION (ADMIN MANUAL ORDERS) ---
function checkSurrogateSession() {
    const surrogateData = sessionStorage.getItem('surrogate_session');
    if (surrogateData) {
        const surrogate = JSON.parse(surrogateData);
        const banner = document.createElement('div');
        banner.className = "bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest py-2 px-6 flex justify-between items-center z-[99999] relative shadow-md";
        banner.innerHTML = `
            <span class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                ADMIN MODE: Ordering for ${surrogate.name} (${surrogate.phone})
            </span>
            <button onclick="endSurrogateSession()" class="underline hover:text-red-200">End Session & Clear Cart</button>
        `;
        document.body.insertBefore(banner, document.body.firstChild);
    }
}

window.endSurrogateSession = () => {
    sessionStorage.removeItem('surrogate_session');
    localStorage.removeItem('cart');
    window.location.href = 'index.html';
};

document.addEventListener('DOMContentLoaded', checkSurrogateSession);

// --- 6. UNIFIED FOOTER LOADER ---
window.loadFooterData = async function() {

    // Support Links
    try {
        const supSnap = await db.collection("support_links").orderBy("order").get();
        const supEl = document.getElementById('dynamic-support');
        if (supEl) supEl.innerHTML = supSnap.docs.map(d =>
            `<li><a href="${d.data().url}" class="hover:text-white transition">${d.data().title}</a></li>`
        ).join('');
    } catch(e) { console.error("Support links error:", e); }

    // Social Links
    try {
        const socSnap = await db.collection("social_links").get();
        const icons = {
            Instagram: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect width="16" height="16" x="4" y="4" rx="4"/><circle cx="12" cy="12" r="3"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
            Facebook:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3V2z"/></svg>`,
            WhatsApp:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 11-7.6-12.7 8.38 8.38 0 013.8.9L21 3z"/></svg>`,
            TikTok:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 12a4 4 0 104 4V4h4a4 4 0 00-4 4"/></svg>`
        };
        const socEl = document.getElementById('dynamic-socials');
        if (socEl) socEl.innerHTML = socSnap.docs.map(d => {
            const icon = icons[d.data().platform] || d.data().platform;
            return `<a href="${d.data().url}" target="_blank" class="text-white hover:text-[#B36A5E] hover:scale-110 transition">${icon}</a>`;
        }).join(' ');
    } catch(e) { console.error("Social links error:", e); }

    // Shop Links — ordered by banner order
    try {
        const catSnap = await db.collection("categories").get();
        let dbCats = new Set(catSnap.docs.map(d => d.data().name).filter(Boolean));

        let footerOrderedList = [];
        try {
            const footerBannerSnap = await db.collection("category_banners").orderBy("order").get();
            footerOrderedList = footerBannerSnap.docs.map(d => d.data().category).filter(Boolean);
        } catch(e) { console.error("Banner order error:", e); }

        let shopHtml = `<li><a href="category.html?type=New" class="hover:text-white transition">New Arrivals</a></li>`;
        let linkCount = 0;

        footerOrderedList.forEach(cat => {
            if (dbCats.has(cat) && linkCount < 5) {
                shopHtml += `<li><a href="category.html?type=${encodeURIComponent(cat)}" class="hover:text-white transition">${cat}</a></li>`;
                dbCats.delete(cat);
                linkCount++;
            }
        });
        dbCats.forEach(cat => {
            if (linkCount < 5) {
                shopHtml += `<li><a href="category.html?type=${encodeURIComponent(cat)}" class="hover:text-white transition">${cat}</a></li>`;
                linkCount++;
            }
        });
        shopHtml += `<li><a href="category.html?type=Sale" class="text-[#B36A5E] hover:text-white transition">Sale</a></li>`;

        const footerShopEl = document.getElementById('footer-shop-list');
        if (footerShopEl) footerShopEl.innerHTML = shopHtml;
    } catch(e) { console.error("Shop links error:", e); }

    // Contact Info
    try {
        const con = await db.collection("settings").doc("contact").get();
        if (con.exists) {
            const d = con.data();
            const ph = document.getElementById('footer-phone');
            const em = document.getElementById('footer-email');
            const ad = document.getElementById('footer-address');
            if (ph && d.phone) ph.innerText = d.phone;
            if (em && d.email) em.innerText = d.email;
            if (ad && d.address) ad.innerText = d.address;
        }
    } catch(e) { console.error("Contact info error:", e); }

};

window.imgUrl = function(url, size) {
    if (!url) return '';
    // Add size hint for future CDN integration
    return url;
};

// ============================================================
//  PRE-ORDER SYSTEM
// ============================================================
window._preorderSettings = { globalEta: '', bkashNumber: '', currentBatch: '' };

window.loadPreorderSettings = async function() {
    try {
        const doc = await db.collection("settings").doc("preorder").get();
        if (doc.exists) {
            const d = doc.data();
            window._preorderSettings = {
                globalEta:    d.globalEta    || '',
                bkashNumber:  d.bkashNumber  || '',
                currentBatch: d.currentBatch || ''
            };
        }
    } catch(e) { console.error("Preorder settings load error:", e); }
    return window._preorderSettings;
};

// Secondary Firebase app so creating a customer account never disturbs the
// visitor's own session.
async function poGetSecondaryApp() {
    try { return firebase.app("SecondaryPreorder"); }
    catch(e) { return firebase.initializeApp(firebase.app().options, "SecondaryPreorder"); }
}

async function poCreateCustomer(name, phone) {
    const fakeEmail = phone.replace(/\s+/g, '') + '@sterling.com';
    const tempPass  = 'Sterling' + Date.now().toString().slice(-5);
    let uid;
    try {
        const sapp = await poGetSecondaryApp();
        const cred = await sapp.auth().createUserWithEmailAndPassword(fakeEmail, tempPass);
        uid = cred.user.uid;
        await sapp.auth().signOut();
    } catch(authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
            try {
                const lk = await db.collection("phone_lookups").doc(phone).get();
                uid = (lk.exists && lk.data().uid) ? lk.data().uid : ('po_' + Date.now());
            } catch(e) { uid = 'po_' + Date.now(); }
        } else { throw authErr; }
    }
    
    await db.collection("users").doc(uid).set({
        fullName: name, phone: phone, email: fakeEmail,
        crmTags: 'Good', isBlocked: false, addresses: [], paymentMethods: [],
        totalSpend: 0, source: 'preorder_web',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection("phone_lookups").doc(phone).set({ uid: uid, name: name }, { merge: true });
    return uid;
}

function injectPreorderModal() {
    if (document.getElementById('preorder-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'preorder-modal';
    modal.className = 'hidden fixed inset-0 bg-black/60 z-[10050] items-center justify-center p-4 backdrop-blur-sm';
    modal.style.fontFamily = "'Montserrat', sans-serif";
    modal.innerHTML = `
      <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        <div class="p-4 border-b flex items-center gap-3 bg-gray-50">
          <img id="po-product-img" src="" class="w-12 h-14 object-cover rounded-lg border border-gray-100 bg-gray-100">
          <div class="flex-1 min-w-0">
            <p class="text-[9px] font-bold uppercase tracking-widest" style="color:#B36A5E">Pre-order <span class="po-number-display text-[9px] text-[#322C2B]"></span></p>
            <p id="po-product-name" class="text-sm font-bold text-[#322C2B] truncate"></p>
          </div>
          <button onclick="closePreorderModal()" class="text-gray-400 hover:text-black text-2xl leading-none">&times;</button>
        </div>

        <!-- STEP 1: phone -->
        <div id="po-step-1" class="p-6 space-y-4">
          <p class="text-xs text-gray-500 leading-relaxed">Enter your number to start your pre-order. If you've ordered before, we'll fill in your details.</p>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Contact Number</label>
            <input type="tel" id="po-phone" placeholder="01XXXXXXXXX" class="w-full border-b border-gray-300 py-2 text-sm outline-none focus:border-[#B36A5E]" onkeydown="if(event.key==='Enter'){event.preventDefault();poLookupPhone();}">
          </div>
          <p id="po-error" class="hidden text-red-500 text-[11px] font-bold"></p>
          <button id="po-lookup-btn" onclick="poLookupPhone()" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-[10px] hover:bg-[#B36A5E] transition shadow-lg tracking-widest">Continue</button>
        </div>

        <!-- STEP 2: details -->
        <div id="po-step-2" class="hidden p-6 space-y-4">
          <p id="po-returning-note" class="hidden text-[11px] font-bold px-3 py-2 rounded-lg" style="color:#322C2B;background:#F5ECE9;border:1px solid #E5D3CD">Welcome back! Please confirm your delivery address below.</p>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Full Name</label>
            <input type="text" id="po-name" placeholder="Your name" class="w-full border-b border-gray-300 py-2 text-sm outline-none focus:border-[#B36A5E]">
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Delivery Address</label>
            <textarea id="po-address" rows="2" placeholder="House, road, area, district..." class="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-[#B36A5E] resize-none"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Quantity</label>
              <input type="number" id="po-qty" value="1" min="1" oninput="poRecalcAdvance()" class="w-full border-b border-gray-300 py-2 text-sm outline-none focus:border-[#B36A5E] text-center font-bold">
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Advance (৳)</label>
              <input type="number" id="po-advance" class="w-full border-b border-gray-300 py-2 text-sm outline-none focus:border-[#B36A5E] text-center font-bold">
            </div>
          </div>
          <p id="po-advance-hint" class="text-[10px] text-gray-400"></p>
          <p id="po-error-2" class="hidden text-red-500 text-[11px] font-bold"></p>
          <div class="flex gap-3 pt-1">
            <button onclick="poBackToStep1()" class="flex-1 text-[10px] font-bold uppercase text-gray-400 border border-gray-200 py-3 rounded-xl hover:bg-gray-50 transition tracking-widest">Back</button>
            <button id="po-submit-btn" onclick="poSubmitForm()" class="flex-1 text-white py-3 rounded-xl font-bold uppercase text-[10px] transition shadow-lg tracking-widest" style="background:#B36A5E" onmouseover="this.style.background='#322C2B'" onmouseout="this.style.background='#B36A5E'">Confirm Pre-order</button>
          </div>
        </div>

        <!-- STEP 3: bKash -->
        <div id="po-step-3" class="hidden p-6 space-y-4">
          <div class="rounded-xl p-4 text-center" style="background:#F5ECE9;border:1px solid #E5D3CD">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-1" style="color:#B36A5E">Pre-order Recorded ✓</p>
            <p class="text-xs text-gray-600">Send your advance via bKash to confirm:</p>
          </div>
          <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center space-y-1">
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Send Money to bKash</p>
            <p id="po-bkash-number" class="text-xl font-bold text-[#322C2B] tracking-wide"></p>
            <p class="text-[10px] text-gray-400">Amount: <span id="po-bkash-amount" class="font-bold" style="color:#B36A5E"></span></p>
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">bKash Transaction ID <span class="normal-case font-normal text-gray-300">(optional)</span></label>
            <input type="text" id="po-txn" placeholder="e.g. 9XY7ABCD12" class="w-full border-b border-gray-300 py-2 text-sm outline-none focus:border-[#B36A5E]">
          </div>
          <button onclick="poSubmitTxn()" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-[10px] hover:bg-[#B36A5E] transition shadow-lg tracking-widest">Done</button>
          <p class="text-[10px] text-gray-400 text-center">We'll call you to confirm and notify you when stock arrives.</p>
        </div>

        <!-- DONE -->
        <div id="po-step-done" class="hidden p-8 text-center space-y-3">
          <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl" style="background:#F5ECE9">✨</div>
          <h3 class="text-lg font-bold text-[#322C2B]">Thank you!</h3>
          <p class="text-sm text-gray-500">Your pre-order is in. We'll be in touch shortly.</p>
          <div class="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mx-auto max-w-[220px]">
            <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Your Pre-Order Number</p>
            <p class="po-number-display text-base font-bold text-[#322C2B]">—</p>
          </div>
          <button onclick="closePreorderModal()" class="bg-[#322C2B] text-white px-6 py-2.5 rounded-xl font-bold uppercase text-[10px] hover:bg-[#B36A5E] transition tracking-widest">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
}
document.addEventListener('DOMContentLoaded', injectPreorderModal);

window.openPreorderModal = function(product) {
    injectPreorderModal();
    window._poProduct   = product;
    window._poIsNew     = false;
    window._poUserId    = null;
    window._poPhone     = null;
    window._poPreorderId = null;

    document.getElementById('po-product-name').innerText = product.name || 'Pre-order';
    document.getElementById('po-product-img').src = product.image || '';

    document.getElementById('po-step-1').classList.remove('hidden');
    document.getElementById('po-step-2').classList.add('hidden');
    document.getElementById('po-step-3').classList.add('hidden');
    document.getElementById('po-step-done').classList.add('hidden');

    document.getElementById('po-phone').value = '';
    document.getElementById('po-name').value = '';
    document.getElementById('po-address').value = '';
    document.getElementById('po-qty').value = 1;
    document.getElementById('po-advance').value = '';
    document.getElementById('po-txn').value = '';
    document.getElementById('po-error').classList.add('hidden');
    document.getElementById('po-error-2').classList.add('hidden');
    document.getElementById('po-returning-note').classList.add('hidden');

    const modal = document.getElementById('preorder-modal');
    modal.classList.remove('hidden'); modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    // If a customer is already logged in, skip the phone-entry step
    const _poAuthUser = firebase.auth().currentUser;
    if (_poAuthUser) poAutofillForLoggedInUser(_poAuthUser);
};

async function poAutofillForLoggedInUser(user) {
    try {
        const doc = await firebase.firestore().collection("users").doc(user.uid).get();
        if (!doc.exists) return;              // no profile — fall back to step 1
        const d = doc.data();
        const phone = d.phone || '';
        if (!phone) return;                   // no phone on file — keep step 1

        window._poPhone  = phone;
        window._poUserId = user.uid;
        window._poIsNew  = false;

        document.getElementById('po-phone').value = phone;
        if (d.fullName) document.getElementById('po-name').value = d.fullName;

        // Pre-fill default saved address if they have one
        let defaultAddr = '';
        if (Array.isArray(d.addresses) && d.addresses.length) {
            const def = d.addresses.find(a => a && a.isDefault) || d.addresses[0];
            defaultAddr = (def && (def.fullDisplay || def.detail)) || '';
        }
        if (defaultAddr) document.getElementById('po-address').value = defaultAddr;

        // Jump straight to the details step
        document.getElementById('po-step-1').classList.add('hidden');
        document.getElementById('po-step-2').classList.remove('hidden');
        const note = document.getElementById('po-returning-note');
        note.innerText = 'Welcome back' + (d.fullName ? ', ' + d.fullName : '') + '! Please confirm your details below.';
        note.classList.remove('hidden');
        poRecalcAdvance();
    } catch(e) {
        // Never block the sale — on any error just leave them on step 1
        console.error('Preorder autofill error:', e);
    }
}

window.closePreorderModal = function() {
    const modal = document.getElementById('preorder-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    document.body.style.overflow = '';
};

window.poBackToStep1 = function() {
    document.getElementById('po-step-2').classList.add('hidden');
    document.getElementById('po-step-1').classList.remove('hidden');
};

window.poLookupPhone = async function() {
    const phone = (document.getElementById('po-phone').value || '').trim();
    const err   = document.getElementById('po-error');
    err.classList.add('hidden');
    if (!phone || phone.length < 6) { err.innerText = 'Please enter a valid phone number.'; err.classList.remove('hidden'); return; }
    window._poPhone = phone;

    const btn = document.getElementById('po-lookup-btn');
    btn.innerText = 'Checking...'; btn.disabled = true;
    try {
        // Read ONLY the public phone_lookups doc — never the locked users collection.
        let foundName = '';
        let foundUid  = null;
        try {
            const lk = await db.collection("phone_lookups").doc(phone).get();
            if (lk.exists) { foundUid = lk.data().uid || null; foundName = lk.data().name || ''; }
        } catch(e) { /* fall through as a new customer — never block the sale */ }

        if (foundUid || foundName) {
            window._poIsNew  = false;
            window._poUserId = foundUid;
            if (foundName) document.getElementById('po-name').value = foundName;
            // Address is always typed fresh on the storefront.
            const note = document.getElementById('po-returning-note');
            note.innerText = 'Welcome back! Please confirm your delivery address below.';
            note.classList.remove('hidden');
        } else {
            window._poIsNew  = true;
            window._poUserId = null;
            document.getElementById('po-returning-note').classList.add('hidden');
        }

        document.getElementById('po-step-1').classList.add('hidden');
        document.getElementById('po-step-2').classList.remove('hidden');
        poRecalcAdvance();
    } catch(e) {
        err.innerText = 'Lookup failed. Please try again.'; err.classList.remove('hidden');
    } finally {
        btn.innerText = 'Continue'; btn.disabled = false;
    }
};

window.poRecalcAdvance = function() {
    const qty    = Math.max(1, Number(document.getElementById('po-qty').value) || 1);
    const perBag = Number(window._poProduct.preorderAdvance) || 510;
    const min    = perBag * qty;
    const adv    = document.getElementById('po-advance');
    adv.min = min;
    if (!adv.value || Number(adv.value) < min) adv.value = min;
    document.getElementById('po-advance-hint').innerText =
        'Minimum ৳' + min.toLocaleString() + ' (' + qty + ' × ৳' + perBag.toLocaleString() + '). You may pay more.';
};

function poErr2(msg) {
    const e = document.getElementById('po-error-2');
    e.innerText = msg; e.classList.remove('hidden');
}

window.poSubmitForm = async function() {
    const name    = (document.getElementById('po-name').value || '').trim();
    const address = (document.getElementById('po-address').value || '').trim();
    const qty     = Math.max(1, Number(document.getElementById('po-qty').value) || 1);
    const advance = Number(document.getElementById('po-advance').value) || 0;
    const perBag  = Number(window._poProduct.preorderAdvance) || 510;
    const minAdv  = perBag * qty;

    document.getElementById('po-error-2').classList.add('hidden');
    if (!name)    { poErr2('Please enter your name.'); return; }
    if (!address) { poErr2('Please enter your delivery address.'); return; }
    if (advance < minAdv) { poErr2('Advance must be at least ৳' + minAdv.toLocaleString() + '.'); return; }

    const btn = document.getElementById('po-submit-btn');
    btn.innerText = 'Submitting...'; btn.disabled = true;
    try {
        // Storefront is anonymous — never touch the locked `users` collection.
        // Capture the name in the public phone_lookups doc; the real CRM account
        // is created admin-side via "Save as Customer".
        const uid = window._poUserId || null;
        try { await db.collection("phone_lookups").doc(window._poPhone).set({ name: name }, { merge: true }); } catch(e) {}

const poNumber = 'PO-' + Math.floor(100000 + Math.random() * 900000);
        const ref = await db.collection("preorders").add({
            poNumber:        poNumber,
            customerName:    name,
            customerPhone:   window._poPhone,
            customerAddress: address,
            userId:          uid || null,
            productId:       window._poProduct.id,
            productName:     window._poProduct.name,
            productImage:    window._poProduct.image || '',
            productPrice:    Number(window._poProduct.price) || 0,
            quantity:        qty,
            advanceAmount:   advance,
            bkashTxnId:      null,
            batch:           window._preorderSettings.currentBatch || '',
            status:          'Pending',
            source:          'web',
            createdAt:       new Date().toISOString()
        });
        window._poPreorderId = ref.id;
        window._poNumber = poNumber;
        document.querySelectorAll('.po-number-display').forEach(el => { el.innerText = poNumber; });

        try { fbq('track', 'Lead', { content_name: window._poProduct.name, value: advance, currency: 'BDT' }); } catch(e) {}

        // GA4 pre-order event
        try {
            gtag('event', 'preorder', {
                currency: 'BDT',
                value: advance,
                items: [{
                    item_id: String(window._poProduct.id),
                    item_name: window._poProduct.name,
                    price: Number(window._poProduct.price) || 0,
                    quantity: qty
                }]
            });
        } catch(e) {}



        // Email notification to admin — reuses the existing order template
        try {
            await emailjs.send('service_qr9m3ds', 'template_razbuuu', {
                order_id:       'PRE-ORDER',
                customer_name:  name,
                customer_phone: window._poPhone,
                total:          advance.toLocaleString(),
                shipping:       '0',
                items:          window._poProduct.name + ' × ' + qty + ' (Advance ৳' + advance.toLocaleString() + ', Batch: ' + (window._preorderSettings.currentBatch || 'N/A') + ')',
                address:        address
            });
        } catch(e) { console.error('Pre-order notification failed:', e); }

        document.getElementById('po-step-2').classList.add('hidden');
        document.getElementById('po-step-3').classList.remove('hidden');
        document.getElementById('po-bkash-number').innerText = window._preorderSettings.bkashNumber || 'Contact us';
        document.getElementById('po-bkash-amount').innerText = '৳' + advance.toLocaleString();
    } catch(e) {
        poErr2('Could not submit: ' + e.message);
    } finally {
        btn.innerText = 'Confirm Pre-order'; btn.disabled = false;
    }
};

window.poSubmitTxn = async function() {
    const txn = (document.getElementById('po-txn').value || '').trim();
    try {
        if (txn && window._poPreorderId) {
            await db.collection("preorders").doc(window._poPreorderId).update({ bkashTxnId: txn });
        }
    } catch(e) {}
    document.getElementById('po-step-3').classList.add('hidden');
    document.getElementById('po-step-done').classList.remove('hidden');
};