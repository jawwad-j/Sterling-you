/* ============================================================================
   Sterling You — Checkout Auth Popup  (checkout-auth.js)
   ----------------------------------------------------------------------------
   A single-page sign-in / sign-up popup that reuses the SAME auth logic as
   login.html (phone_lookups, OTP via signInWithPhoneNumber, phone@sterling.com
   password accounts, rate limiting). The ONLY difference from login.html is
   that on success it CLOSES the popup instead of redirecting — Firebase's
   onAuthStateChanged in checkout.html then fires and checkout continues.

   REQUIREMENTS on the page before this loads:
     - Firebase initialised with globals `db` and `auth`
     - firebase-auth-compat + firebase-firestore-compat loaded

   USAGE:
     openAuthPopup();        // opens the modal
   On successful login/signup the modal closes automatically; checkout's
   onAuthStateChanged handles the rest. No callback needed, but you can set
   window.SterlingAuthOnSuccess = () => {...} if you want a hook.
   ========================================================================== */
(function () {
    "use strict";

    // ── Constants (same as login.html) ──
    const MAX_OTP_PER_HOUR   = 3;
    const MAX_WRONG_ATTEMPTS = 3;
    const MIN_GAP_MS         = 2000;
    const BD_PREFIXES        = ['013','014','015','016','017','018','019'];

    // ── State ──
    let recaptchaVerifier = null;
    let confirmationResult = null;
    let currentPhone = '';
    let existingUserEmail = '';
    let otpPurpose = '';
    let authedUser = null;
    let wrongAttempts = 0;
    let lastSendTime = 0;
    let otpTimer = null;
    let timerSecs = 120;
    let injected = false;

    // ── Modal markup (injected once) ──
    function injectModal() {
        if (injected || document.getElementById('checkoutAuthModal')) { injected = true; return; }
        injected = true;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
<div id="checkoutAuthModal" class="fixed inset-0 bg-black/60 hidden items-center justify-center z-[600] p-4 backdrop-blur-sm">
  <div class="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
    <div class="p-5 border-b bg-gray-50 flex justify-between items-start shrink-0">
      <div>
        <h3 id="ca-title" class="font-bold text-[#322C2B] text-sm">Sign in to continue</h3>
        <p id="ca-subtitle" class="text-[11px] text-gray-500 mt-0.5">Enter your phone number to start.</p>
      </div>
      <button onclick="closeAuthPopup()" class="text-gray-400 text-xl leading-none hover:text-black">&times;</button>
    </div>
    <div class="p-6 overflow-y-auto flex-1">

      <!-- STEP: phone -->
      <div id="ca-step-phone" class="space-y-3">
        <label class="block text-[9px] font-bold uppercase text-gray-400 tracking-widest">Phone Number</label>
        <input id="ca-phone" type="tel" inputmode="numeric" maxlength="11" placeholder="01XXXXXXXXX"
          class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B36A5E]">
        <p id="ca-phone-err" class="hidden text-[11px] text-red-500"></p>
        <button id="ca-btn-check" onclick="caCheckPhone()" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-[#B36A5E] transition">Continue</button>
      </div>

      <!-- STEP: existing user (password) -->
      <div id="ca-step-existing" class="space-y-3 hidden">
        <div class="flex items-center gap-3 mb-1">
          <div id="ca-existing-avatar" class="w-10 h-10 rounded-full bg-[#F5ECE9] text-[#B36A5E] flex items-center justify-center font-bold">U</div>
          <div><p id="ca-existing-name" class="text-sm font-bold text-[#322C2B]">User</p><p id="ca-existing-phone" class="text-[11px] text-gray-400"></p></div>
        </div>
        <label class="block text-[9px] font-bold uppercase text-gray-400 tracking-widest">Password</label>
        <div class="relative">
          <input id="ca-existing-pass" type="password" placeholder="Your password"
            class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B36A5E] pr-10">
        </div>
        <p id="ca-existing-pass-err" class="hidden text-[11px] text-red-500"></p>
        <button id="ca-btn-login-pass" onclick="caLoginWithPassword()" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-[#B36A5E] transition">Login</button>
        <div class="flex justify-between text-[10px] pt-1">
          <button onclick="caSendOTPForExisting()" class="text-[#B36A5E] font-bold hover:underline">Login with OTP</button>
          <button onclick="caStartForgotPassword()" class="text-gray-400 hover:underline">Forgot password?</button>
        </div>
        <button onclick="caBackToPhone()" class="w-full text-[10px] text-gray-400 hover:underline pt-1">← Different number</button>
      </div>

      <!-- STEP: OTP -->
      <div id="ca-step-otp" class="space-y-3 hidden">
        <p class="text-[11px] text-gray-500">Enter the 6-digit code sent to <b id="ca-display-phone"></b></p>
        <div class="flex gap-2 justify-between" onpaste="caOtpPaste(event)">
          ${[0,1,2,3,4,5].map(i => `<input id="ca-otp-${i}" type="tel" inputmode="numeric" maxlength="1" oninput="caOtpInput(this,${i})" onkeydown="caOtpKeydown(event,${i})" class="w-11 h-12 text-center text-lg font-bold border border-gray-200 rounded-lg outline-none focus:border-[#B36A5E]">`).join('')}
        </div>
        <p id="ca-otp-err" class="hidden text-[11px] text-red-500"></p>
        <p id="ca-attempt-warn" class="text-[10px] text-amber-600"></p>
        <button id="ca-btn-verify" onclick="caVerifyOTP()" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-[#B36A5E] transition">Verify &amp; Continue</button>
        <div class="text-center text-[10px] text-gray-400"><span id="ca-timer"></span> <button id="ca-btn-resend" onclick="caResendOTP()" class="text-[#B36A5E] font-bold hover:underline disabled:text-gray-300" disabled>Resend</button></div>
        <button onclick="caBackToPhone()" class="w-full text-[10px] text-gray-400 hover:underline">← Back</button>
      </div>

      <!-- STEP: new user -->
      <div id="ca-step-new" class="space-y-3 hidden">
        <label class="block text-[9px] font-bold uppercase text-gray-400 tracking-widest">Full Name</label>
        <input id="ca-new-name" type="text" placeholder="Your name" class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B36A5E]">
        <p id="ca-new-name-err" class="hidden text-[11px] text-red-500"></p>
        <label class="block text-[9px] font-bold uppercase text-gray-400 tracking-widest">Create Password</label>
        <input id="ca-new-pass" type="password" placeholder="Min 6 chars, 1 caps, 1 number" class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B36A5E]">
        <p id="ca-new-pass-err" class="hidden text-[11px] text-red-500"></p>
        <input id="ca-new-pass-confirm" type="password" placeholder="Confirm password" class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B36A5E]">
        <p id="ca-new-pass-confirm-err" class="hidden text-[11px] text-red-500"></p>
        <p id="ca-create-err" class="hidden text-[11px] text-red-500"></p>
        <button id="ca-btn-create" onclick="caCreateAccount()" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-[#B36A5E] transition">Create Account &amp; Continue</button>
      </div>

      <!-- STEP: reset password -->
      <div id="ca-step-reset" class="space-y-3 hidden">
        <label class="block text-[9px] font-bold uppercase text-gray-400 tracking-widest">New Password</label>
        <input id="ca-reset-pass" type="password" placeholder="Min 6 chars, 1 caps, 1 number" class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B36A5E]">
        <p id="ca-reset-pass-err" class="hidden text-[11px] text-red-500"></p>
        <input id="ca-reset-confirm" type="password" placeholder="Confirm new password" class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B36A5E]">
        <p id="ca-reset-confirm-err" class="hidden text-[11px] text-red-500"></p>
        <button id="ca-btn-save-pass" onclick="caSaveNewPassword()" class="w-full bg-[#322C2B] text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-[#B36A5E] transition">Save &amp; Continue</button>
      </div>

      <div id="ca-recaptcha-container"></div>
    </div>
  </div>
</div>`;
        document.body.appendChild(wrap.firstElementChild);
    }

    // ── Helpers ──
    const $ = id => document.getElementById(id);
    function showErr(id, msg){ const e=$(id); if(e){e.innerText=msg; e.classList.remove('hidden');} }
    function hideErr(id){ const e=$(id); if(e) e.classList.add('hidden'); }
    function clearErr(){ [...arguments].forEach(hideErr); }
    function setBtn(id, loading, label){ const b=$(id); if(!b) return; b.disabled=loading; b.innerHTML = loading ? '…' : label; }
    function setTitle(t, s){ $('ca-title').innerText=t; $('ca-subtitle').innerText=s; }
    function showStep(step){
        ['ca-step-phone','ca-step-existing','ca-step-otp','ca-step-new','ca-step-reset'].forEach(s=>{
            const el=$(s); if(el) el.classList.toggle('hidden', s!==step);
        });
    }
    function validatePhone(p){
        if(!p || p.length!==11) return 'Must be exactly 11 digits';
        if(!p.startsWith('0')) return 'Must start with 0';
        if(!BD_PREFIXES.includes(p.slice(0,3))) return 'Invalid operator prefix (013–019)';
        return null;
    }
    function validatePassword(pass){
        if(pass.length<6) return 'At least 6 characters.';
        if(!/[A-Z]/.test(pass)) return 'Needs one uppercase letter.';
        if(!/[0-9]/.test(pass)) return 'Needs one number.';
        return null;
    }

    // ── reCAPTCHA ──
    function setupRecaptcha(){
        if(recaptchaVerifier) return;
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier('ca-recaptcha-container', { size:'invisible', callback:()=>{} });
        recaptchaVerifier.render();
    }

    // ── Rate limiting (same as login) ──
    async function checkRateLimit(phone){
        const now=Date.now(), hourAgo=now-3600000;
        if(now-lastSendTime < MIN_GAP_MS) return 'Too fast — please wait a moment.';
        try{
            const pDoc=await db.collection('otp_rate_limits').doc(phone).get();
            if(pDoc.exists){
                const recent=(pDoc.data().requests||[]).filter(t=>t>hourAgo);
                if(recent.length>=MAX_OTP_PER_HOUR){
                    const w=Math.ceil((recent[0]+3600000-now)/60000);
                    return `Too many OTP requests. Try again in ${w} min.`;
                }
            }
            const today=new Date().toISOString().split('T')[0];
            const capDoc=await db.collection('otp_daily_cap').doc(today).get();
            if(capDoc.exists && (capDoc.data().count||0)>=300) return 'Daily OTP limit reached. Try tomorrow.';
            return null;
        }catch(e){ return null; }
    }
    async function recordOTPSent(phone){
        const now=Date.now(), hourAgo=now-3600000, today=new Date().toISOString().split('T')[0];
        try{
            const pRef=db.collection('otp_rate_limits').doc(phone);
            const pDoc=await pRef.get();
            const reqs=pDoc.exists?(pDoc.data().requests||[]).filter(t=>t>hourAgo):[];
            reqs.push(now);
            await pRef.set({requests:reqs,lastUpdated:now},{merge:true});
            await db.collection('otp_daily_cap').doc(today).set({count:firebase.firestore.FieldValue.increment(1),date:today},{merge:true});
        }catch(e){}
    }

    // ── OTP boxes + timer ──
    function otpCode(){ return [0,1,2,3,4,5].map(i=>$('ca-otp-'+i).value).join(''); }
    function clearBoxes(){ [0,1,2,3,4,5].forEach(i=>{const e=$('ca-otp-'+i); if(e){e.value='';e.classList.remove('filled');}}); }
    window.caOtpInput = function(el,i){
        el.value=el.value.replace(/[^0-9]/g,'');
        if(el.value && i<5) $('ca-otp-'+(i+1)).focus();
        if(otpCode().length===6) setTimeout(window.caVerifyOTP,200);
    };
    window.caOtpKeydown = function(e,i){
        if(e.key==='Backspace' && !e.target.value && i>0){ const p=$('ca-otp-'+(i-1)); p.value=''; p.focus(); }
    };
    window.caOtpPaste = function(e){
        e.preventDefault();
        const d=(e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').substring(0,6);
        d.split('').forEach((c,i)=>{const el=$('ca-otp-'+i); if(el) el.value=c;});
        if(d.length===6) setTimeout(window.caVerifyOTP,200);
    };
    function startTimer(){
        timerSecs=120; clearInterval(otpTimer);
        const rb=$('ca-btn-resend'); if(rb) rb.disabled=true;
        otpTimer=setInterval(()=>{
            timerSecs--;
            const el=$('ca-timer');
            if(el) el.innerText = timerSecs>0 ? `Resend in ${timerSecs}s` : '';
            if(timerSecs<=0){ clearInterval(otpTimer); if(rb) rb.disabled=false; if(el) el.innerText=''; }
        },1000);
    }

    async function sendOTPtoPhone(phone){
        const formatted='+880'+phone.substring(1);
        lastSendTime=Date.now();
        if(!recaptchaVerifier) setupRecaptcha();
        confirmationResult=await auth.signInWithPhoneNumber(formatted, recaptchaVerifier);
        await recordOTPSent(phone);
        $('ca-display-phone').innerText=phone;
        wrongAttempts=0; clearBoxes(); hideErr('ca-otp-err');
        const warn=$('ca-attempt-warn'); if(warn) warn.innerText='';
        startTimer();
        setTimeout(()=>{const el=$('ca-otp-0'); if(el) el.focus();},100);
    }

    // ── SUCCESS: close popup instead of redirect ──
    function finishSuccess(){
        clearInterval(otpTimer);
        closeAuthPopup();
        // Wait until Firebase has a confirmed, persisted user before we hand
        // back to checkout — otherwise checkout's guard can race the session
        // and bounce to the login page. Keep the popup guard ON until then.
        const proceed = () => {
            window._authPopupActive = false;
            if (typeof window.SterlingAuthOnSuccess === 'function') {
                try { window.SterlingAuthOnSuccess(); return; } catch(e){}
            }
            window.location.reload();
        };
        if (auth.currentUser) {
            // Give Firestore a beat to have the user doc readable, then go.
            setTimeout(proceed, 400);
        } else {
            const unsub = auth.onAuthStateChanged(u => {
                if (u) { unsub(); setTimeout(proceed, 400); }
            });
            // Safety timeout in case the event never fires
            setTimeout(() => { unsub(); proceed(); }, 4000);
        }
    }

    // ── STEP 1: check phone ──
    window.caCheckPhone = async function(){
        const phone=$('ca-phone').value.trim();
        hideErr('ca-phone-err');
        const ve=validatePhone(phone);
        if(ve){ showErr('ca-phone-err',ve); return; }
        setBtn('ca-btn-check', true, '');
        try{
            const lookup=await db.collection('phone_lookups').doc(phone).get();
            currentPhone=phone;
            if(lookup.exists){
                existingUserEmail=phone+'@sterling.com';
                const name=lookup.data().name||'User';
                $('ca-existing-name').innerText=name;
                $('ca-existing-avatar').innerText=name.charAt(0).toUpperCase();
                $('ca-existing-phone').innerText='+880'+phone.substring(1);
                setTitle('Welcome back','Enter your password to continue.');
                showStep('ca-step-existing');
                setTimeout(()=>$('ca-existing-pass').focus(),100);
            }else{
                const rateErr=await checkRateLimit(phone);
                if(rateErr){ showErr('ca-phone-err',rateErr); setBtn('ca-btn-check',false,'Continue'); return; }
                otpPurpose='new_user';
                await sendOTPtoPhone(phone);
                setTitle('Verify number','Enter the code sent to your phone.');
                showStep('ca-step-otp');
            }
        }catch(e){ showErr('ca-phone-err', e.message||'Something went wrong.'); }
        setBtn('ca-btn-check',false,'Continue');
    };

    // ── returning: password ──
    window.caLoginWithPassword = async function(){
        hideErr('ca-existing-pass-err');
        const pass=$('ca-existing-pass').value;
        if(!pass){ showErr('ca-existing-pass-err','Please enter your password.'); return; }
        setBtn('ca-btn-login-pass', true, '');
        try{
            await auth.signInWithEmailAndPassword(existingUserEmail, pass);
            finishSuccess();
        }catch(e){
            let msg='Incorrect password. Please try again.';
            if(e.code==='auth/too-many-requests') msg='Too many attempts. Use OTP login.';
            showErr('ca-existing-pass-err',msg);
            setBtn('ca-btn-login-pass',false,'Login');
        }
    };
    window.caSendOTPForExisting = async function(){
        hideErr('ca-existing-pass-err');
        const rateErr=await checkRateLimit(currentPhone);
        if(rateErr){ showErr('ca-existing-pass-err',rateErr); return; }
        try{ otpPurpose='existing_otp_login'; await sendOTPtoPhone(currentPhone); setTitle('Verify number','Enter the code sent to your phone.'); showStep('ca-step-otp'); }
        catch(e){ showErr('ca-existing-pass-err','Could not send OTP.'); }
    };
    window.caStartForgotPassword = async function(){
        hideErr('ca-existing-pass-err');
        const rateErr=await checkRateLimit(currentPhone);
        if(rateErr){ showErr('ca-existing-pass-err',rateErr); return; }
        try{ otpPurpose='forgot_password'; await sendOTPtoPhone(currentPhone); setTitle('Reset password',"Verify it's you first."); showStep('ca-step-otp'); }
        catch(e){ showErr('ca-existing-pass-err','Could not send OTP.'); }
    };

    // ── verify OTP ──
    window.caVerifyOTP = async function(){
        const code=otpCode();
        if(code.length!==6) return;
        if(!confirmationResult){ showErr('ca-otp-err','Code expired. Request a new one.'); return; }
        hideErr('ca-otp-err'); setBtn('ca-btn-verify', true, '');
        try{
            const result=await confirmationResult.confirm(code);
            authedUser=result.user; clearInterval(otpTimer);
            if(otpPurpose==='new_user'){
                setTitle('Create account','Almost done — set your name and password.');
                showStep('ca-step-new');
                setTimeout(()=>$('ca-new-name').focus(),200);
            }else if(otpPurpose==='existing_otp_login'){
                finishSuccess();
            }else if(otpPurpose==='forgot_password'){
                setTitle('New password','Choose a strong password.');
                showStep('ca-step-reset');
                setTimeout(()=>$('ca-reset-pass').focus(),200);
            }
        }catch(e){
            wrongAttempts++;
            if(wrongAttempts>=MAX_WRONG_ATTEMPTS){
                clearBoxes(); confirmationResult=null; clearInterval(otpTimer);
                showErr('ca-otp-err','Too many wrong attempts. Request a new OTP.');
                setTimeout(()=>caBackToPhone(),2000);
            }else{
                clearBoxes();
                const left=MAX_WRONG_ATTEMPTS-wrongAttempts;
                showErr('ca-otp-err',`Incorrect code. ${left} attempt${left>1?'s':''} left.`);
            }
        }
        setBtn('ca-btn-verify',false,'Verify & Continue');
    };
    window.caResendOTP = async function(){
        const rateErr=await checkRateLimit(currentPhone);
        if(rateErr){ showErr('ca-otp-err',rateErr); return; }
        clearBoxes(); hideErr('ca-otp-err');
        try{ recaptchaVerifier=null; setupRecaptcha(); await recaptchaVerifier.render(); await sendOTPtoPhone(currentPhone); }
        catch(e){ showErr('ca-otp-err','Failed to resend. Go back and try again.'); }
    };

    // ── new account ──
    window.caCreateAccount = async function(){
        clearErr('ca-new-name-err','ca-new-pass-err','ca-new-pass-confirm-err','ca-create-err');
        const name=$('ca-new-name').value.trim();
        const pass=$('ca-new-pass').value;
        const confirm=$('ca-new-pass-confirm').value;
        let bad=false;
        if(!name||name.length<3){ showErr('ca-new-name-err','Name must be at least 3 characters.'); bad=true; }
        const pe=validatePassword(pass); if(pe){ showErr('ca-new-pass-err',pe); bad=true; }
        if(pass!==confirm){ showErr('ca-new-pass-confirm-err','Passwords do not match.'); bad=true; }
        if(bad) return;
        setBtn('ca-btn-create', true, '');
        try{
            const emailCred=firebase.auth.EmailAuthProvider.credential(currentPhone+'@sterling.com', pass);
            await authedUser.linkWithCredential(emailCred).catch(()=>{});
            const uid=auth.currentUser?auth.currentUser.uid:authedUser.uid;
            await db.collection('users').doc(uid).set({
                fullName:name, phone:currentPhone, email:currentPhone+'@sterling.com',
                contactEmail:null, crmTags:'Good', isBlocked:false,
                addresses:[], paymentMethods:[], totalSpend:0, authMethod:'phone',
                createdAt:firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection('phone_lookups').doc(currentPhone).set({ uid:authedUser.uid, name:name });
            finishSuccess();
        }catch(e){
            showErr('ca-create-err','Could not create account: '+e.message);
            setBtn('ca-btn-create',false,'Create Account & Continue');
        }
    };

    // ── reset password ──
    window.caSaveNewPassword = async function(){
        clearErr('ca-reset-pass-err','ca-reset-confirm-err');
        const pass=$('ca-reset-pass').value;
        const confirm=$('ca-reset-confirm').value;
        const pe=validatePassword(pass); if(pe){ showErr('ca-reset-pass-err',pe); return; }
        if(pass!==confirm){ showErr('ca-reset-confirm-err','Passwords do not match.'); return; }
        setBtn('ca-btn-save-pass', true, '');
        try{
            const emailCred=firebase.auth.EmailAuthProvider.credential(existingUserEmail, pass);
            await authedUser.linkWithCredential(emailCred).catch(async(e)=>{
                if(e.code==='auth/provider-already-linked'||e.code==='auth/email-already-in-use'){ await authedUser.updatePassword(pass); }
                else throw e;
            });
            finishSuccess();
        }catch(e){
            showErr('ca-reset-confirm-err','Could not save: '+e.message);
            setBtn('ca-btn-save-pass',false,'Save & Continue');
        }
    };

    // ── nav ──
    window.caBackToPhone = function(){
        clearInterval(otpTimer);
        hideErr('ca-phone-err'); hideErr('ca-existing-pass-err'); hideErr('ca-otp-err');
        setTitle('Sign in to continue','Enter your phone number to start.');
        showStep('ca-step-phone');
        setTimeout(()=>$('ca-phone').focus(),100);
    };

    // ── open / close ──
    window.openAuthPopup = function(){
        window._authPopupActive = true;    // block checkout's auth redirect while open
        injectModal();
        setupRecaptcha();
        caBackToPhone();
        $('ca-phone').value='';
        const m=$('checkoutAuthModal');
        m.classList.remove('hidden'); m.classList.add('flex');
        setTimeout(()=>$('ca-phone').focus(),100);
    };
    window.closeAuthPopup = function(){
        const m=$('checkoutAuthModal');
        if(m){ m.classList.add('hidden'); m.classList.remove('flex'); }
        clearInterval(otpTimer);
        window._authPopupActive = false;
    };

    // Boot: inject early so reCAPTCHA container exists
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectModal);
    else injectModal();
})();