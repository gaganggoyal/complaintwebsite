/* complaint.website — admin panel client */
(function () {
  'use strict';

  var WA = '919569608101';
  var PLAN_LABELS = {
    single:  { label: 'Single Complaint',   price: '₹9' },
    monthly: { label: 'Monthly Membership', price: '₹499' },
    annual:  { label: 'Annual Membership',  price: '₹999' }
  };

  var all = [];

  function $(id) { return document.getElementById(id); }
  function show(el, msg, kind) {
    el.textContent = msg;
    el.className = 'alert show ' + (kind || 'err');
  }
  function hide(el) { el.className = 'alert'; }

  async function api(url, data) {
    var opts = { headers: { 'Accept': 'application/json' } };
    if (data !== undefined) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
    var res = await fetch(url, opts);
    var json = {};
    try { json = await res.json(); } catch (e) {}
    return { status: res.status, ok: res.ok, data: json };
  }

  function fmtDate(ms) {
    if (!ms) return '—';
    var d = new Date(ms);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  // Text goes into HTML, and names/notes are user-supplied — always escape.
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // password show/hide
  document.querySelectorAll('.pw-toggle').forEach(function (t) {
    t.addEventListener('click', function () {
      var inp = document.getElementById(t.dataset.target);
      if (!inp) return;
      var showing = inp.type === 'password';
      inp.type = showing ? 'text' : 'password';
      t.textContent = showing ? 'Hide' : 'Show';
    });
  });

  // ---------------- login ----------------
  var loginForm = $('adminLoginForm');
  var admAlert = $('admAlert');

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hide(admAlert);
    var btn = $('admSubmit');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    var out = await api('/api/admin/login', { password: $('admPass').value });
    btn.disabled = false;
    btn.textContent = 'Sign in';
    if (out.ok && out.data.ok) {
      $('admPass').value = '';
      enterPanel();
    } else {
      show(admAlert, out.data.error || 'Could not sign in.');
    }
  });

  $('admLogout').addEventListener('click', async function () {
    await api('/api/admin/logout', {});
    location.reload();
  });

  $('refreshBtn').addEventListener('click', load);
  $('search').addEventListener('input', render);
  $('filter').addEventListener('change', render);

  function enterPanel() {
    $('adminLogin').style.display = 'none';
    // Must be an explicit value: #adminApp is hidden by a stylesheet rule (to
    // avoid a flash before sign-in), and setting '' only clears an inline
    // style — the rule would keep winning and leave the page blank.
    $('adminApp').style.display = 'block';
    load();
  }

  // ---------------- data ----------------
  async function load() {
    var out = await api('/api/admin/users');
    if (out.status === 401) { location.reload(); return; }
    if (!out.ok) { show($('listAlert'), out.data.error || 'Could not load customers.'); return; }
    hide($('listAlert'));

    all = out.data.users || [];
    var s = out.data.stats || {};
    $('stTotal').textContent = s.total || 0;
    $('stVerified').textContent = s.verified || 0;
    $('stPending').textContent = s.pending || 0;
    $('stActive').textContent = s.active || 0;
    render();
  }

  function matches(u) {
    var f = $('filter').value;
    if (f === 'pending' && u.plan_status === 'active') return false;
    if (f === 'active' && u.plan_status !== 'active') return false;
    if (f === 'unverified' && u.email_verified) return false;

    var q = $('search').value.trim().toLowerCase();
    if (!q) return true;
    return (u.name + ' ' + u.email + ' ' + u.phone).toLowerCase().indexOf(q) !== -1;
  }

  function waLink(u) {
    var plan = PLAN_LABELS[u.plan] || { label: u.plan, price: '' };
    var msg = 'Namaste ' + u.name + '! Thank you for registering on complaint.website for the ' +
      plan.label + ' (' + plan.price + ') plan. Here are the payment details to activate your plan:';
    return 'https://wa.me/' + String(u.phone).replace(/[^0-9]/g, '').replace(/^0+/, '').replace(/^(?!91)/, '91') +
      '?text=' + encodeURIComponent(msg);
  }

  function render() {
    var list = all.filter(matches);
    var tbody = $('rows');
    tbody.innerHTML = '';
    $('emptyState').style.display = list.length ? 'none' : '';

    list.forEach(function (u) {
      var plan = PLAN_LABELS[u.plan] || { label: u.plan, price: '' };
      var isActive = u.plan_status === 'active';

      var statusPill = !u.email_verified
        ? '<span class="pill unver">Email not verified</span>'
        : (isActive ? '<span class="pill active">● Active</span>'
                    : '<span class="pill pending">● Awaiting payment</span>');

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><div class="nm">' + esc(u.name) + '</div>' +
          '<div class="sub2">' + esc(u.email) + '</div>' +
          '<div class="sub2 mono">' + esc(u.phone) + '</div></td>' +
        '<td><b>' + esc(plan.label) + '</b><div class="sub2">' + esc(plan.price) + '</div></td>' +
        '<td>' + statusPill + (isActive && u.activated_at ? '<div class="sub2">' + esc(fmtDate(u.activated_at)) + '</div>' : '') + '</td>' +
        '<td class="sub2 mono">' + esc(fmtDate(u.created_at)) + '</td>' +
        '<td><input class="note-in" type="text" placeholder="Add note…" value="' + esc(u.admin_note || '') + '"></td>' +
        '<td><div class="act">' +
          '<button class="mini js-toggle ' + (isActive ? 'un' : 'go') + '">' + (isActive ? 'Mark pending' : '✓ Mark active') + '</button>' +
          // Only offered while the address is unconfirmed — that is the one
          // case where the customer is stuck and cannot proceed.
          (!u.email_verified ? '<button class="mini js-resend send">✉ Resend email</button>' : '') +
          '<a class="mini wa" target="_blank" rel="noopener" href="' + esc(waLink(u)) + '">WhatsApp</a>' +
          '<button class="mini js-del del">Delete</button>' +
        '</div></td>';

      // --- wire up actions ---
      // Selected by class, not position: adding a button would otherwise
      // shift the indices and wire the wrong handler to the wrong control.
      var toggleBtn = tr.querySelector('.js-toggle');
      var delBtn = tr.querySelector('.js-del');
      var resendBtn = tr.querySelector('.js-resend');
      var noteInput = tr.querySelector('.note-in');

      toggleBtn.addEventListener('click', async function () {
        toggleBtn.disabled = true;
        var next = isActive ? 'pending' : 'active';
        var out = await api('/api/admin/status', { id: u.id, status: next });
        if (out.ok) { load(); }
        else { show($('listAlert'), out.data.error || 'Could not update status.'); toggleBtn.disabled = false; }
      });

      if (resendBtn) {
        resendBtn.addEventListener('click', async function () {
          hide($('listAlert'));
          resendBtn.disabled = true;
          var label = resendBtn.textContent;
          resendBtn.textContent = 'Sending…';

          var out = await api('/api/admin/resend-verification', { id: u.id });

          if (out.ok && out.data.ok) {
            show($('listAlert'), 'Verification email sent to ' + u.email + '.', 'ok');
            resendBtn.textContent = '✓ Sent';
            // Leave it disabled briefly so a double-click cannot fire twice.
            setTimeout(function () {
              resendBtn.disabled = false;
              resendBtn.textContent = label;
            }, 4000);
          } else {
            show($('listAlert'), out.data.error || 'Could not send the email.');
            resendBtn.disabled = false;
            resendBtn.textContent = label;
          }
        });
      }

      delBtn.addEventListener('click', async function () {
        if (!confirm('Delete ' + u.name + ' (' + u.email + ')? This cannot be undone.')) return;
        delBtn.disabled = true;
        var out = await api('/api/admin/delete', { id: u.id });
        if (out.ok) { load(); }
        else { show($('listAlert'), out.data.error || 'Could not delete.'); delBtn.disabled = false; }
      });

      // Save a note on blur — quiet, no confirmation needed.
      noteInput.addEventListener('blur', async function () {
        if (noteInput.value === (u.admin_note || '')) return;
        var out = await api('/api/admin/note', { id: u.id, note: noteInput.value });
        if (out.ok) { u.admin_note = noteInput.value; noteInput.style.borderColor = '#b9e8cd'; }
        else { show($('listAlert'), out.data.error || 'Could not save note.'); }
      });

      tbody.appendChild(tr);
    });
  }

  // ---------------- boot ----------------
  (async function () {
    var out = await api('/api/admin/session');
    if (!out.data.enabled) {
      show(admAlert, 'Admin is not configured on this server — set ADMIN_PASSWORD in the .env file and restart.');
      return;
    }
    if (out.data.signedIn) enterPanel();
  })();
})();
