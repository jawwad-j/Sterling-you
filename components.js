// js/components.js

const headerHTML = `
    <div id="top-bar" class="bg-[#322C2B] text-white py-2 overflow-hidden transition-all duration-300">
        <div class="max-w-7xl mx-auto px-6 md:px-10">
            <p class="text-[11px] tracking-[0.2em] uppercase font-light text-left">
                Free Shipping on orders over ৳5,000
            </p>
        </div>
    </div>

    <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div class="flex justify-between items-center h-16">
            <div class="md:hidden font-serif text-xl font-bold text-[#322C2B]">Sterling.</div>

            <nav class="hidden md:block flex-grow">
                <ul id="dynamic-nav" class="flex items-center space-x-8 text-[12px] font-bold tracking-[0.1em] text-[#322C2B] uppercase">
                    <li><span class="text-gray-300">Loading...</span></li>
                </ul>
            </nav>

            <div class="flex items-center space-x-6 text-[#322C2B]">
                
                <div class="relative flex items-center">
                    <input type="text" id="nav-search-input" placeholder="Search..." autocomplete="off" oninput="if(window.handleLiveSearch) window.handleLiveSearch(this.value)"
                           class="w-0 focus:w-32 md:focus:w-48 transition-all duration-300 outline-none border-b border-gray-300 text-[10px] uppercase tracking-widest px-2 py-1 bg-transparent">
                    <button onclick="if(window.handleSearch) window.handleSearch()" class="hover:text-[#B36A5E] transition">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    </button>
                    <div id="search-results-dropdown" class="absolute top-full right-0 mt-2 w-64 md:w-80 bg-white shadow-2xl rounded-xl overflow-hidden hidden z-[200] border border-gray-100">
                        <div id="live-search-items" class="max-h-96 overflow-y-auto custom-scrollbar"></div>
                    </div>
                </div>

                <button onclick="toggleCart()" class="relative p-2 flex items-center justify-center hover:text-[#B36A5E] transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span id="cart-count-badge" class="absolute top-0 right-0 bg-[#B36A5E] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white min-w-[18px] text-center">0</span>
                </button>

                <div class="relative">
                    <button id="nav-user-btn" onclick="toggleUserDropdown()" class="flex items-center justify-center p-2 text-[#322C2B] transition-colors focus:outline-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                    </button>

                    <div id="user-dropdown" class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 hidden z-[500] overflow-hidden">
                        <div class="p-4 border-b bg-gray-50">
                            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account</p>
                            <div id="dropdown-header-content" class="text-xs font-bold text-[#322C2B] mt-1">
                                </div>
                        </div>
                        <div class="py-2">
                            <a href="account.html" class="block px-4 py-2 text-[11px] font-bold text-gray-600 hover:bg-gray-50 hover:text-[#B36A5E]">View Profile & Orders</a>
                            <a href="account.html#payments" class="block px-4 py-2 text-[11px] font-bold text-gray-600 hover:bg-gray-50">Payment Methods</a>
                            <button id="dropdown-signout-btn" onclick="window.logout()" class="hidden w-full text-left px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-50">Sign Out</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
`;

const footerHTML = `
<footer class="bg-[#322C2B] text-white pt-12 pb-8 border-t border-gray-800">
    <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div class="space-y-4">
                <h4 class="text-xl font-serif italic">Sterling.</h4>
                <p class="text-[11px] text-gray-400 leading-relaxed tracking-wide">Elevate your everyday with curated luxury.</p>
            </div>
            <div class="space-y-4">
                <h4 class="text-[11px] font-bold tracking-[0.3em] uppercase text-gray-500">Support</h4>
                <ul id="dynamic-support" class="text-[12px] text-gray-300 space-y-2"><li>Loading...</li></ul>
            </div>
            <div class="space-y-4">
                <h4 class="text-[11px] font-bold tracking-[0.3em] uppercase text-gray-500">Shop</h4>
                <ul class="text-[12px] text-gray-300 space-y-2">
                    <li><a href="category.html?type=Handbags" class="hover:text-white">Handbags</a></li>
                    <li><a href="category.html?type=Footwear" class="hover:text-white">Footwear</a></li>
                </ul>
            </div>
            <div class="space-y-6 md:text-right">
                <div>
                    <h4 class="text-[11px] font-bold tracking-[0.3em] uppercase text-gray-500 mb-3">Follow Us</h4>
                    <div id="dynamic-socials" class="flex items-center gap-5 md:justify-end"></div>
                </div>
            </div>
        </div>
        <div class="border-t border-gray-700 pt-6 flex justify-between items-center"><p class="text-[9px] uppercase text-gray-500">© 2026 Sterling You.</p></div>
    </div>
</footer>
`;

// Logic to Inject Components and Handle Auth UI
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('main-header').innerHTML = headerHTML;
    document.getElementById('main-footer').innerHTML = footerHTML;

    // Handle Dropdown Toggle
    window.toggleUserDropdown = () => {
        document.getElementById('user-dropdown').classList.toggle('hidden');
    }

    // Auth Listener for UI State
firebase.auth().onAuthStateChanged(async (user) => {
        const iconBtn = document.getElementById('nav-user-btn');
        const headerContent = document.getElementById('dropdown-header-content');
        const signoutBtn = document.getElementById('dropdown-signout-btn');
        const badge = document.getElementById('cart-count-badge');

        // Always update Cart Badge on any auth change
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        if(badge) badge.innerText = cart.reduce((t, i) => t + i.quantity, 0);

        if (user) {
            // --- LOGGED IN STATE ---
            // 1. Change Icon to Terracotta
            iconBtn.classList.remove('text-[#322C2B]');
            iconBtn.classList.add('text-[#B36A5E]'); 
            
            // 2. Show Sign Out Button
            signoutBtn.classList.remove('hidden'); 
            
            // 3. Personalized Welcome
            const doc = await firebase.firestore().collection("users").doc(user.uid).get();
            const name = doc.exists ? doc.data().fullName : "User";
            headerContent.innerHTML = `Hi, ${name}`;
        } else {
            // --- GUEST STATE ---
            // 1. Reset Icon to Dark Grey
            iconBtn.classList.add('text-[#322C2B]');
            iconBtn.classList.remove('text-[#B36A5E]');
            
            // 2. Hide Sign Out Button
            signoutBtn.classList.add('hidden'); 
            
            // 3. Show Sign In Link at the top
            headerContent.innerHTML = `<a href="account.html" class="text-[#B36A5E] font-bold hover:underline">Sign In / Register</a>`;
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown');
        const btn = document.getElementById('nav-user-btn');
        // If dropdown is open and we click anywhere else, close it
        if (dropdown && !dropdown.classList.contains('hidden')) {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        }
    });
});