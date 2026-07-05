/* ============================================================================
   Sterling You — Shared Address Module (address.js)
   ----------------------------------------------------------------------------
   Provides a reusable "Add Address" popup with Pathao-style smart area search.
   Used by checkout.html (in-page popup, no navigation) and optionally elsewhere.

   REQUIREMENTS (must exist on the page BEFORE this script loads):
     - Firebase initialised, with globals `db` and `auth`
     - `window.locationData`  (loaded via locations.js)
     - `window.SterlingAddressUser`  -> function returning the current user object
          { uid, addresses: [...] }   (checkout: currentCheckoutUser)
     - `window.SterlingAddressOnSave` -> callback run after a successful save
          (checkout: re-render address dropdowns + totals)

   The modal HTML is injected automatically on load, so pages only need to
   call `openAddressModal()` to show it.
   ========================================================================== */
(function () {
    "use strict";

    /* ---- 1. Inject the modal markup once ---------------------------------- */
    function injectModal() {
        if (document.getElementById('addressModal')) return; // already present
        const wrap = document.createElement('div');
        wrap.innerHTML = `
<div id="addressModal" class="fixed inset-0 bg-black/60 hidden items-center justify-center z-[400] p-4 backdrop-blur-sm">
  <div class="bg-white w-full max-w-lg rounded-2xl p-8 max-h-[90vh] overflow-y-auto modal-enter">
    <h2 class="text-xl font-bold mb-6" id="addr-modal-title">Add Delivery Address</h2>
    <form id="addressForm" class="space-y-5 relative" novalidate>
      <input type="hidden" id="addr-edit-index" value="-1">
      <div class="mb-4">
        <select id="addr-type" class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#B36A5E]" required>
          <option value="" disabled>Select Address Type *</option>
          <option value="billing">Only Billing Address</option>
          <option value="shipping">Only Shipping Address</option>
          <option value="both" selected>Shipping and Billing Address</option>
        </select>
      </div>
      <div class="space-y-4">
        <div id="smart-search-container">
          <label class="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Search Your Area <span class="text-red-400">*</span></label>
          <input type="text" id="addr-smart-search" autocomplete="off"
            placeholder="Type your area, thana or district (e.g. Gulshan, Mirpur, Dhanmondi...)"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#B36A5E] transition">
          <div id="smart-search-results" class="hidden absolute z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-64 overflow-y-auto w-full left-0"></div>
          <p id="smart-search-chosen" class="hidden mt-2 text-xs font-bold text-[#10B981] bg-green-50 px-3 py-2 rounded-lg border border-green-100"></p>
        </div>
        <input type="hidden" id="addr-division">
        <input type="hidden" id="addr-district">
        <input type="hidden" id="addr-thana">
        <input type="hidden" id="addr-zone-hidden">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col-reverse">
            <input type="text" id="addr-house" class="w-full border-b py-2 text-sm outline-none focus:border-[#B36A5E] transition-colors" placeholder="House No/Name" required>
            <label class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">House No/Name</label>
          </div>
          <div class="flex flex-col-reverse">
            <input type="text" id="addr-floor" class="w-full border-b py-2 text-sm outline-none focus:border-[#B36A5E] transition-colors" placeholder="Floor / Flat">
            <label class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Floor / Flat</label>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col-reverse">
            <input type="text" id="addr-road" class="w-full border-b py-2 text-sm outline-none focus:border-[#B36A5E] transition-colors" placeholder="Road No/Name" required>
            <label class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Road No/Name</label>
          </div>
          <div class="flex flex-col-reverse">
            <input type="text" id="addr-block" class="w-full border-b py-2 text-sm outline-none focus:border-[#B36A5E] transition-colors" placeholder="Block / Sector">
            <label class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Block / Sector</label>
          </div>
        </div>
        <div class="flex flex-col-reverse">
          <input type="text" id="addr-detailed" class="w-full border-b py-2 text-sm outline-none focus:border-[#B36A5E] transition-colors" placeholder="Detailed Address (e.g., Flat 4B, Amin Court)" required>
          <label class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Detailed Address</label>
        </div>
        <div class="flex flex-col-reverse">
          <input type="text" id="addr-details" class="w-full border-b py-2 text-sm outline-none focus:border-[#B36A5E] transition-colors" placeholder="Additional directions (Optional)">
          <label class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Additional directions</label>
        </div>
      </div>
      <div class="flex gap-4 pt-4">
        <button type="button" onclick="closeAddressModal()" class="flex-1 text-xs font-bold uppercase text-gray-400 hover:text-gray-600">Cancel</button>
        <button type="submit" id="addr-submit-btn" class="flex-1 bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-[10px] shadow-md hover:bg-[#B36A5E] transition">Save Address</button>
      </div>
    </form>
  </div>
</div>`;
        document.body.appendChild(wrap.firstElementChild);
    }

    /* ---- 2. Smart area search (ported verbatim from account.html) --------- */
    let searchIndex = null;
    let selectedAreaData = null;

    function buildSearchIndex() {
        const index = [];
        const locationData = window.locationData || {};
        Object.keys(locationData).forEach(division => {
            const districts = locationData[division];
            Object.keys(districts).forEach(district => {
                const thanas = districts[district];
                if (Array.isArray(thanas)) {
                    thanas.forEach(thana => index.push({ division, district, thana, zone: '' }));
                } else {
                    Object.keys(thanas).forEach(thana => {
                        const zones = thanas[thana];
                        if (Array.isArray(zones) && zones.length > 0) {
                            zones.forEach(zone => index.push({ division, district, thana, zone }));
                            index.push({ division, district, thana, zone: '' });
                        } else {
                            index.push({ division, district, thana, zone: '' });
                        }
                    });
                }
            });
        });
        return index;
    }

    function normalizeTranslit(str) {
        return str
            .replace(/sh/g, 's').replace(/ph/g, 'p').replace(/kh/g, 'k')
            .replace(/gh/g, 'g').replace(/ch/g, 'c').replace(/dh/g, 'd')
            .replace(/th/g, 't').replace(/(.)\1+/g, '$1')
            .replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/aa/g, 'a')
            .trim();
    }

    function initSmartSearch() {
        if (!searchIndex) searchIndex = buildSearchIndex();
        const input = document.getElementById('addr-smart-search');
        const results = document.getElementById('smart-search-results');
        if (!input || !results) return;
        if (input.dataset.bound === '1') return; // avoid double-binding
        input.dataset.bound = '1';

        input.addEventListener('input', function () {
            const raw = this.value.trim().toLowerCase();
            const query = normalizeTranslit(raw);
            if (query.length < 2) { results.classList.add('hidden'); return; }

            const scored = searchIndex.map(entry => {
                const haystack = normalizeTranslit(
                    [entry.zone, entry.thana, entry.district, entry.division].filter(Boolean).join(' ').toLowerCase()
                );
                let score = 0;
                const words = query.split(/\s+/);
                words.forEach(word => {
                    if (haystack.includes(word)) score += 3;
                    else {
                        const parts = haystack.split(/[\s,]+/);
                        parts.forEach(part => {
                            if (part.startsWith(word)) score += 2;
                            else if (part.includes(word)) score += 1;
                            else if (word.length >= 3) {
                                const maxDiff = word.length >= 6 ? 2 : 1;
                                let diff = 0;
                                const minLen = Math.min(word.length, part.length);
                                for (let i = 0; i < minLen; i++) { if (word[i] !== part[i]) diff++; }
                                if (diff <= maxDiff && Math.abs(word.length - part.length) <= maxDiff) score += 1;
                                if (part.replace(/(.)\1+/g, '$1').includes(word.replace(/(.)\1+/g, '$1'))) score += 2;
                            }
                        });
                    }
                });
                return { entry, score };
            }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 15);

            if (scored.length === 0) {
                results.innerHTML = '<div class="p-3 text-xs text-gray-400 italic">No matching area found. Try a different spelling.</div>';
                results.classList.remove('hidden');
                return;
            }
            const seen = new Set();
            results.innerHTML = scored.map(({ entry }) => {
                const label = entry.zone
                    ? `${entry.zone}, ${entry.thana}, ${entry.district}, ${entry.division}`
                    : `${entry.thana}, ${entry.district}, ${entry.division}`;
                if (seen.has(label)) return '';
                seen.add(label);
                const highlighted = label.replace(
                    new RegExp(`(${query.split(/\s+/).filter(w => w.length > 1).join('|')})`, 'gi'),
                    '<strong class="text-[#B36A5E]">$1</strong>'
                );
                return `<div class="px-4 py-3 text-xs hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition"
                    data-division="${entry.division}" data-district="${entry.district}"
                    data-thana="${entry.thana}" data-zone="${entry.zone}"
                    onclick="window.selectSmartArea(this)">📍 ${highlighted}</div>`;
            }).join('');
            results.classList.remove('hidden');
        });

        document.addEventListener('click', function (e) {
            if (!input.contains(e.target) && !results.contains(e.target)) results.classList.add('hidden');
        });
    }

    window.selectSmartArea = function (el) {
        const division = el.getAttribute('data-division');
        const district = el.getAttribute('data-district');
        const thana = el.getAttribute('data-thana');
        const zone = el.getAttribute('data-zone');
        document.getElementById('addr-division').value = division;
        document.getElementById('addr-district').value = district;
        document.getElementById('addr-thana').value = thana;
        document.getElementById('addr-zone-hidden').value = zone;
        selectedAreaData = { division, district, thana, zone };
        const input = document.getElementById('addr-smart-search');
        input.value = zone ? `${zone}, ${thana}, ${district}, ${division}` : `${thana}, ${district}, ${division}`;
        const chosen = document.getElementById('smart-search-chosen');
        chosen.innerHTML = `✓ <strong>${district}</strong> › ${thana}${zone ? ' › ' + zone : ''} <span class="text-gray-400 font-normal">(${division})</span>`;
        chosen.classList.remove('hidden');
        document.getElementById('smart-search-results').classList.add('hidden');
    };

    /* ---- 3. Delivery zone (same rules as account.html) -------------------- */
    function getDeliveryZone(district, area) {
        if (district === 'Gazipur' || district === 'Narayanganj' || area === 'Keraniganj' || area === 'Savar') return 'Dhaka Suburb';
        if (district === 'Dhaka') return 'Inside Dhaka';
        return 'Outside Dhaka';
    }

    /* ---- 4. Open / close -------------------------------------------------- */
    window.openAddressModal = function () {
        injectModal();
        initSmartSearch();
        const form = document.getElementById('addressForm');
        if (form) form.reset();
        document.getElementById('addr-edit-index').value = "-1";
        document.getElementById('addr-modal-title').innerText = "Add Delivery Address";
        document.getElementById('addr-submit-btn').innerText = "Save Address";
        document.getElementById('addr-type').value = "both";
        ['addr-division', 'addr-district', 'addr-thana', 'addr-zone-hidden'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        selectedAreaData = null;
        const si = document.getElementById('addr-smart-search'); if (si) si.value = '';
        const chosen = document.getElementById('smart-search-chosen'); if (chosen) chosen.classList.add('hidden');
        const res = document.getElementById('smart-search-results'); if (res) res.classList.add('hidden');
        const m = document.getElementById('addressModal');
        m.classList.remove('hidden'); m.classList.add('flex');
    };

    window.closeAddressModal = function () {
        const m = document.getElementById('addressModal');
        if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    };

    /* ---- 5. Save (writes addresses[] in the exact account.html format) ---- */
    function bindSaveHandler() {
        // Delegated submit so it works even though the modal is injected later
        document.addEventListener('submit', async function (e) {
            if (!e.target || e.target.id !== 'addressForm') return;
            e.preventDefault();

            const user = (typeof window.SterlingAddressUser === 'function') ? window.SterlingAddressUser() : null;
            if (!user || !user.uid) { alert("Please sign in to save an address."); return; }

            const addrType = document.getElementById('addr-type').value;
            const div = document.getElementById('addr-division').value;
            const dist = document.getElementById('addr-district').value;
            const thana = document.getElementById('addr-thana').value;
            const subArea = document.getElementById('addr-zone-hidden') ? document.getElementById('addr-zone-hidden').value : '';
            const house = document.getElementById('addr-house') ? document.getElementById('addr-house').value.trim() : '';
            const floor = document.getElementById('addr-floor') ? document.getElementById('addr-floor').value.trim() : '';
            const road = document.getElementById('addr-road') ? document.getElementById('addr-road').value.trim() : '';
            const block = document.getElementById('addr-block') ? document.getElementById('addr-block').value.trim() : '';
            const detailed = document.getElementById('addr-detailed') ? document.getElementById('addr-detailed').value.trim() : '';
            const extra = document.getElementById('addr-details') ? document.getElementById('addr-details').value.trim() : '';

            if (!addrType) { alert("Please select an Address Type."); return; }
            if (!div || !dist || !thana) {
                alert("Please search and select your area using the area search field.");
                document.getElementById('addr-smart-search').focus();
                return;
            }
            if (!house || !road || !detailed) { alert("Please fill in House No/Name, Road, and Detailed Address."); return; }

            const btn = document.getElementById('addr-submit-btn');
            const btnTxt = btn ? btn.innerText : '';
            if (btn) { btn.innerText = 'Saving...'; btn.disabled = true; }

            try {
                let updatedList = (user.addresses) ? [...user.addresses] : [];
                const deliveryZone = getDeliveryZone(dist, thana);
                const parts = [];
                if (detailed) parts.push(detailed);
                if (house) parts.push(`House: ${house}`);
                if (floor) parts.push(`Floor/Flat: ${floor}`);
                if (road) parts.push(`Road: ${road}`);
                if (block) parts.push(`Block/Sector: ${block}`);
                if (subArea) parts.push(subArea);
                if (thana) parts.push(thana);
                if (dist) parts.push(dist);
                if (extra) parts.push(`(Directions: ${extra})`);
                const fullDisplay = parts.join(', ');

                const baseAddr = {
                    division: div, district: dist, thana: thana, subArea: subArea, zone: deliveryZone,
                    house: house, floor: floor, road: road, block: block, detailed: detailed, detail: extra,
                    fullDisplay: fullDisplay
                };
                const resetDefaults = (list, tag) => list.map(a => { if (a.tag === tag) a.isDefault = false; return a; });

                if (addrType === 'shipping' || addrType === 'both') {
                    updatedList = resetDefaults(updatedList, 'Shipping Address');
                    updatedList.push({ ...baseAddr, id: Date.now().toString() + 'S', tag: 'Shipping Address', isDefault: true });
                }
                if (addrType === 'billing' || addrType === 'both') {
                    updatedList = resetDefaults(updatedList, 'Billing Address');
                    updatedList.push({ ...baseAddr, id: Date.now().toString() + 'B', tag: 'Billing Address', isDefault: true });
                }

                await db.collection("users").doc(user.uid).set({ addresses: updatedList }, { merge: true });
                user.addresses = updatedList; // keep caller's object in sync

                window.closeAddressModal();
                if (typeof window.SterlingAddressOnSave === 'function') window.SterlingAddressOnSave(updatedList);
            } catch (error) {
                console.error("Address save failed:", error);
                alert("Could not save address: " + error.message);
            } finally {
                if (btn) { btn.innerText = btnTxt || 'Save Address'; btn.disabled = false; }
            }
        });
    }

    /* ---- 6. Boot ---------------------------------------------------------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { injectModal(); bindSaveHandler(); });
    } else {
        injectModal(); bindSaveHandler();
    }
})();