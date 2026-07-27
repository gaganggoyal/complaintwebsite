/* complaint.website — client logic for register / verify / login / dashboard */
(function () {
  'use strict';

  // ---------- language ----------
  var langListeners = [];
  window.setLang = function (l) {
    document.body.classList.toggle('hi', l === 'hi');
    document.documentElement.lang = l;
    try { localStorage.setItem('cw-lang', l); } catch (e) {}
    document.querySelectorAll('.lang-toggle button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lang === l);
    });
    langListeners.forEach(function (fn) { try { fn(l); } catch (e) {} });
  };
  function isHi() { return document.body.classList.contains('hi'); }
  function onLang(fn) { langListeners.push(fn); }

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  function showAlert(el, msg, kind) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert show ' + (kind || 'err');
  }
  function hideAlert(el) { if (el) el.className = 'alert'; }
  function setBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
      btn.dataset.html = btn.innerHTML;
      btn.disabled = true;
      if (busyText) btn.textContent = busyText;
    } else {
      btn.disabled = false;
      if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
    }
  }
  async function postJSON(url, data) {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    var json = {};
    try { json = await res.json(); } catch (e) {}
    return { status: res.status, ok: res.ok, data: json };
  }

  // password show/hide
  document.querySelectorAll('.pw-toggle').forEach(function (t) {
    t.addEventListener('click', function () {
      var inp = document.getElementById(t.dataset.target);
      if (!inp) return;
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      t.textContent = show ? (isHi() ? 'छुपाएँ' : 'Hide') : (isHi() ? 'दिखाएँ' : 'Show');
    });
  });

  // ================= REGISTER =================
  var regForm = $('registerForm');
  if (regForm) {
    // preselect plan from ?plan=single|monthly|annual
    var wantPlan = (qs('plan') || '').toLowerCase();
    if (['single', 'monthly', 'annual'].indexOf(wantPlan) !== -1) {
      var r = document.querySelector('input[name="plan"][value="' + wantPlan + '"]');
      if (r) r.checked = true;
    }
    var regAlert = $('regAlert');
    regForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      hideAlert(regAlert);
      var planEl = document.querySelector('input[name="plan"]:checked');
      var payload = {
        name: $('regName').value,
        email: $('regEmail').value,
        phone: $('regPhone').value,
        password: $('regPassword').value,
        plan: planEl ? planEl.value : ''
      };
      if (!payload.plan) {
        showAlert(regAlert, isHi() ? 'कृपया एक plan चुनिए।' : 'Please choose a plan.');
        return;
      }
      var btn = $('regSubmit');
      setBusy(btn, true, isHi() ? 'भेज रहे हैं…' : 'Sending…');
      var out = await postJSON('/api/register', payload);
      setBusy(btn, false);
      if (out.ok && out.data.ok) {
        window.location.href = 'verify.html?email=' + encodeURIComponent(out.data.email);
      } else {
        showAlert(regAlert, out.data.error || (isHi() ? 'कुछ गड़बड़ हुई। दोबारा कोशिश कीजिए।' : 'Something went wrong. Please try again.'));
      }
    });
  }

  // ============ ONE-CLICK CONFIRM (from the email link) ============
  // The token arrives as ?token=… . We confirm it with a POST rather than
  // letting the link itself be the confirmation, because mail scanners and
  // link-preview bots follow URLs but do not run JavaScript — a GET route
  // would let them burn the single-use token before the customer clicks.
  var linkCard = $('linkCard');
  if (linkCard) {
    var token = qs('token') || '';
    var linkAlert = $('linkAlert');
    var confirmBtn = $('linkConfirmBtn');

    if (token) {
      $('codeCard').style.display = 'none';
      linkCard.style.display = '';

      var confirming = false;
      var confirm = async function () {
        if (confirming) return;
        confirming = true;
        hideAlert(linkAlert);
        confirmBtn.style.display = 'none';

        var out = await postJSON('/api/verify-link', { token: token });
        confirming = false;

        if (out.ok && out.data.ok) {
          window.location.replace('dashboard.html');
          return;
        }

        // The token is single-use, so pressing the same link twice lands here.
        // If they are already signed in from the first click, that is a
        // success, not an error — send them on to the dashboard.
        try {
          var me = await fetch('/api/me', { headers: { 'Accept': 'application/json' } });
          if (me.ok) { window.location.replace('dashboard.html'); return; }
        } catch (e) { /* offline — fall through to the code form */ }

        // Expired or already-used link: fall back to the code, which the
        // same email always carries.
        showAlert(linkAlert, out.data.error ||
          (isHi() ? 'यह link काम नहीं कर रहा। कृपया code डालिए।'
                  : 'This link did not work. Please enter the code instead.'));
        confirmBtn.style.display = '';
      };

      confirmBtn.addEventListener('click', confirm);
      confirm();

      $('linkUseCode').addEventListener('click', function (e) {
        e.preventDefault();
        linkCard.style.display = 'none';
        $('codeCard').style.display = '';
      });
    }
  }

  // ================= VERIFY =================
  var verForm = $('verifyForm');
  if (verForm) {
    var email = qs('email') || '';
    var emailChip = $('verEmail');
    if (emailChip) emailChip.textContent = email;
    var verAlert = $('verAlert');

    verForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      hideAlert(verAlert);
      var otp = ($('otpCode').value || '').trim();
      if (otp.length < 6) {
        showAlert(verAlert, isHi() ? 'कृपया 6 अंकों का code डालिए।' : 'Please enter the 6-digit code.');
        return;
      }
      var btn = $('verSubmit');
      setBusy(btn, true, isHi() ? 'जाँच रहे हैं…' : 'Verifying…');
      var out = await postJSON('/api/verify', { email: email, otp: otp });
      setBusy(btn, false);
      if (out.ok && out.data.ok) {
        window.location.href = 'dashboard.html';
      } else {
        showAlert(verAlert, out.data.error || (isHi() ? 'Code ग़लत है।' : 'Incorrect code.'));
      }
    });

    var resendBtn = $('resendBtn');
    if (resendBtn) {
      resendBtn.addEventListener('click', async function () {
        hideAlert(verAlert);
        resendBtn.disabled = true;
        var out = await postJSON('/api/resend', { email: email });
        if (out.ok && out.data.ok) {
          showAlert(verAlert, isHi() ? 'नया code भेज दिया गया है।' : 'A new code has been sent.', 'ok');
        } else {
          showAlert(verAlert, out.data.error || (isHi() ? 'अभी code नहीं भेज पाए।' : 'Could not send a code right now.'));
        }
        // 45s cooldown
        var left = 45;
        var baseEn = 'Resend code', baseHi = 'दोबारा code भेजें';
        var tick = setInterval(function () {
          resendBtn.textContent = (isHi() ? baseHi : baseEn) + ' (' + left + ')';
          if (--left < 0) {
            clearInterval(tick);
            resendBtn.textContent = isHi() ? baseHi : baseEn;
            resendBtn.disabled = false;
          }
        }, 1000);
      });
    }
  }

  // ================= LOGIN =================
  var logForm = $('loginForm');
  if (logForm) {
    var logAlert = $('logAlert');
    logForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      hideAlert(logAlert);
      var payload = { email: $('logEmail').value, password: $('logPassword').value };
      var btn = $('logSubmit');
      setBusy(btn, true, isHi() ? 'साइन इन हो रहे हैं…' : 'Signing in…');
      var out = await postJSON('/api/login', payload);
      setBusy(btn, false);
      if (out.ok && out.data.ok) {
        window.location.href = 'dashboard.html';
      } else if (out.status === 403 && out.data.needVerify) {
        window.location.href = 'verify.html?email=' + encodeURIComponent(out.data.email || payload.email);
      } else {
        showAlert(logAlert, out.data.error || (isHi() ? 'ईमेल या पासवर्ड ग़लत है।' : 'Invalid email or password.'));
      }
    });
  }

  // ================= DASHBOARD =================
  var dashRoot = $('dashRoot');
  if (dashRoot) {
    var WA = '919569608101';
    var state = null;

    function renderWa() {
      var waBtn = $('waActivate');
      if (!waBtn || !state) return;
      var msgEn = 'Namaste! I registered on complaint.website as ' + state.name +
        ' (' + state.email + '), WhatsApp ' + state.phone +
        '. I chose the ' + state.planLabel + ' (' + state.planPrice + ') plan and want to pay and activate it.';
      var msgHi = 'नमस्ते! मैंने complaint.website पर ' + state.name +
        ' (' + state.email + '), WhatsApp ' + state.phone +
        ' के नाम से रजिस्टर किया है। मैंने ' + state.planLabel + ' (' + state.planPrice +
        ') plan चुना है और उसे pay करके activate करना है।';
      waBtn.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(isHi() ? msgHi : msgEn);
    }
    onLang(renderWa);

    (async function loadMe() {
      var res = await fetch('/api/me', { headers: { 'Accept': 'application/json' } });
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      state = await res.json();

      $('dashName').textContent = state.name;
      $('dashPlanName').textContent = state.planLabel;
      $('dashPlanPrice').textContent = state.planPrice;
      $('dashEmail').textContent = state.email;
      $('dashPhone').textContent = state.phone;

      var badge = $('dashBadge');
      if (state.plan_status === 'active') {
        badge.className = 'badge active';
        badge.querySelector('.badge-en').textContent = 'Active';
        badge.querySelector('.badge-hi').textContent = 'सक्रिय';
      }
      renderWa();
      dashRoot.style.display = '';
      var loader = $('dashLoading');
      if (loader) loader.style.display = 'none';
    })();

    var logoutBtn = $('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        await postJSON('/api/logout', {});
        window.location.href = 'index.html';
      });
    }
  }
})();
