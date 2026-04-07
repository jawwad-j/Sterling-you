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