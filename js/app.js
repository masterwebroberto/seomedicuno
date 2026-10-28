/* MediCare · comportamiento del sitio (roles paciente y médico).
   El contenido estático ya viene escrito en cada HTML; aquí solo hay lógica.
   Los datos viven en localStorage (demo). La capa DB/Auth está aislada para
   reemplazarla por Supabase (ver supabase/schema.sql). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const params = new URLSearchParams(location.search);
  const page = location.pathname.split('/').pop() || 'index.html';

  /* Médicos: se leen del selector de reserva (única fuente de datos del HTML) */
  const DOCS = $$('#bk-doc option').map(o => ({ id: o.value, name: o.dataset.name, spec: o.dataset.spec, sede: o.dataset.sede, price: +o.dataset.price, cmp: o.dataset.cmp || '', rne: o.dataset.rne || '' }));
  const docById = id => DOCS.find(d => d.id === id);
  const SLOTS = ['09:00', '10:00', '11:00', '15:00', '16:00', '17:00'];

  /* ---------- Capa de datos ---------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* noop */ } }
  };
  const Auth = {
    get() {
      const u = ls.get('medicare_user', null);
      const ok = u && typeof u === 'object' && typeof u.name === 'string' && u.name.trim() && typeof u.email === 'string' &&
        (!u.role || u.role === 'paciente' || (u.role === 'medico' && typeof u.doctorId === 'string'));
      if (!ok) { if (u !== null) ls.del('medicare_user'); return null; }   // sesión de una versión anterior: se descarta
      return u.role ? u : { ...u, role: 'paciente' };
    },
    set: u => ls.set('medicare_user', u),
    clear: () => ls.del('medicare_user')
  };
  const DB = {
    appts: () => { const l = ls.get('medicare_citas_v2', []); return Array.isArray(l) ? l.filter(a => a && typeof a === 'object') : []; },
    save: l => ls.set('medicare_citas_v2', l),
    add(a) { const l = DB.appts(); l.push(a); DB.save(l); },
    patch(id, p) { DB.save(DB.appts().map(a => a.id === id ? { ...a, ...p } : a)); },
    avail: id => ls.get('medicare_disp_' + id, { days: [1, 2, 3, 4, 5, 6], slots: SLOTS }),
    setAvail: (id, v) => ls.set('medicare_disp_' + id, v)
  };
  const atn = a => ({ fecha: today(), diagnostico: '', indicaciones: '', receta: [], examenes: [], ...(a.atencion || {}) });
  const ACTIVE = s => s === 'pendiente' || s === 'confirmada';
  const STATUS = { pendiente: ['Pendiente de confirmación', 'warn'], confirmada: ['Confirmada', 'ok'], atendida: ['Atendida', 'done'], cancelada: ['Cancelada', 'off'] };

  /* ---------- Utilidades ---------- */
  const toast = msg => {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3800);
  };
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = t => { const [h, m] = t.split(':'); return `${String(h % 12 || 12).padStart(2, '0')}:${m} ${h < 12 ? 'AM' : 'PM'}`; };
  const safeNext = (n, def) => (/^[\w-]+\.html$/.test(n || '') ? n : def);
  const svg = p => `<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I_CAL = svg('<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>');
  const I_CARD = svg('<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>');
  const I_USER = svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
  const badge = st => { const [l, c] = STATUS[st] || [st, '']; return `<p class="badge ${c}">${l}</p>`; };
  const card = (inner, side = '') => `<article class="card appt"><div>${inner}</div>${side ? `<div class="appt-side">${side}</div>` : ''}</article>`;
  const empty = (t, p, cta = '') => `<div class="empty"><h3>${t}</h3><p class="muted">${p}</p>${cta}</div>`;
  const btn = (act, id, label, cls = 'btn-ghost') => `<button class="btn ${cls} btn-sm" data-act="${act}" data-id="${esc(id)}">${label}</button>`;
  const byDate = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
  let renderAll = () => {};

  /* ---------- Cabecera ---------- */
  function header() {
    const t = $('#nav-toggle'), nav = $('#header-nav');
    if (t && nav) t.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      t.setAttribute('aria-expanded', open); t.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    const u = Auth.get(), a = $('#acc-link'), n = $('#nav-account');
    if (u && a) { const m = u.role === 'medico'; a.href = m ? 'panel-medico.html' : 'micuenta.html'; $('span', a).textContent = m ? 'Mi panel' : (String(u.name).trim().split(' ')[0] || 'Mi cuenta'); }
    if (u && n && u.role === 'medico') { n.href = 'panel-medico.html'; n.textContent = 'Panel médico'; }
  }

  /* ---------- Reserva de cita (pacientes) ---------- */
  function refreshSlots() {
    const d = $('#bk-doc').value, date = $('#bk-date').value, av = DB.avail(d), err = $('#bk-err');
    err.textContent = ''; let ok = av.slots;
    if (date && !av.days.includes(new Date(date + 'T00:00').getDay())) { ok = []; err.textContent = 'El médico no atiende ese día. Elige otra fecha.'; }
    const taken = new Set(DB.appts().filter(a => ACTIVE(a.status) && a.doctorId === d && a.date === date).map(a => a.time));
    $('#bk-time').innerHTML = '<option value="">Selecciona un horario</option>' +
      SLOTS.filter(t => ok.includes(t)).map(t => `<option value="${t}"${taken.has(t) ? ' disabled' : ''}>${fmtTime(t)}${taken.has(t) ? ' (ocupado)' : ''}</option>`).join('');
    $('#bk-price').textContent = `S/ ${docById(d).price}.00`;
  }
  function openBooking(id) {
    const u = Auth.get();
    if (!u) {
      if (id) sessionStorage.setItem('pending_booking_doctor', id);
      location.href = `login.html?next=${encodeURIComponent(page)}`; return;
    }
    if (u.role === 'medico') { toast('Ingresa como paciente para reservar una cita.'); return; }
    $('#bk-doc').value = docById(id) ? id : DOCS[0].id;
    $('#bk-date').min = today(); $('#bk-date').value = '';
    refreshSlots(); $('#booking').showModal();
  }
  function booking() {
    const dlg = $('#booking'); if (!dlg || !DOCS.length) return;
    $('#bk-close').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    $('#bk-doc').addEventListener('change', refreshSlots);
    $('#bk-date').addEventListener('change', refreshSlots);
    $('#bk-form').addEventListener('submit', e => {
      e.preventDefault();
      const u = Auth.get(), doctorId = $('#bk-doc').value, date = $('#bk-date').value, time = $('#bk-time').value, err = $('#bk-err');
      if (!u || u.role !== 'paciente') { err.textContent = 'Inicia sesión como paciente.'; return; }
      if (!date || date < today()) { err.textContent = 'Elige una fecha desde hoy en adelante.'; $('#bk-date').focus(); return; }
      if (!DB.avail(doctorId).days.includes(new Date(date + 'T00:00').getDay())) { refreshSlots(); return; }
      if (!time) { err.textContent = 'Selecciona un horario disponible.'; $('#bk-time').focus(); return; }
      if (DB.appts().some(a => ACTIVE(a.status) && a.doctorId === doctorId && a.date === date && a.time === time)) { err.textContent = 'Ese horario acaba de ocuparse. Elige otro.'; refreshSlots(); return; }
      DB.add({ id: 'c' + Date.now().toString(36), code: 'MED-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000), doctorId, patient: u.email, patientName: u.name, date, time, modality: $('#bk-mode').value, total: docById(doctorId).price, status: 'pendiente' });
      dlg.close(); renderAll();
      toast(`Cita solicitada para el ${fmtDate(date)}, ${fmtTime(time)}. El médico la confirmará.`);
    });
    const pending = sessionStorage.getItem('pending_booking_doctor');
    if (pending && Auth.get()) { sessionStorage.removeItem('pending_booking_doctor'); openBooking(pending); }
  }

  /* ---------- Acciones (botones con data-act) ---------- */
  function downloadRx(id) {
    const a = DB.appts().find(x => x.id === id); if (!a || !a.atencion) return;
    const d = docById(a.doctorId) || { name: 'Médico', cmp: '' };
    const txt = [`RECETA MÉDICA ${a.code}`, `Fecha: ${atn(a).fecha}`, `Médico: ${d.name}${d.cmp ? ` (CMP ${d.cmp})` : ''}`, `Paciente: ${a.patientName}`, '',
      ...atn(a).receta.map(r => `- ${r.med}: ${r.dosis}`), '', `Indicaciones: ${atn(a).indicaciones || '-'}`, '', 'Documento de demostración sin validez legal.'].join('\n');
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
    const l = Object.assign(document.createElement('a'), { href: url, download: `receta-${a.code}.txt` });
    document.body.appendChild(l); l.click(); l.remove(); URL.revokeObjectURL(url);
  }
  function seedDemo() {
    const u = Auth.get(); if (!u || u.role !== 'paciente') return;
    if (DB.appts().some(a => a.patient === u.email)) { toast('Ya tienes citas registradas.'); return; }
    const plus = n => { let d = new Date(Date.now() + 864e5 * n); if (d.getDay() === 0) d = new Date(d.getTime() + 864e5); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
    const mk = (doc, date, time, status, extra = {}) => ({ id: 'd' + Math.random().toString(36).slice(2, 8), code: 'MED-2026-' + Math.floor(1000 + Math.random() * 9000), doctorId: doc, patient: u.email, patientName: u.name, date, time, modality: 'Presencial', total: docById(doc).price, status, ...extra });
    [mk('carlos-mendoza', '2026-02-15', '10:00', 'atendida', { atencion: { fecha: '2026-02-15', diagnostico: 'Hipertensión arterial leve', indicaciones: 'Dieta baja en sal y control en 30 días.', receta: [{ med: 'Enalapril 10 mg', dosis: 'Tomar 1 tableta cada 12 horas por 30 días' }, { med: 'Aspirina 100 mg', dosis: 'Tomar 1 tableta después del almuerzo' }], examenes: ['Electrocardiograma de reposo', 'Perfil lipídico'] } }),
     mk('ana-torres', plus(3), '10:00', 'confirmada'), mk('mario-ramirez', plus(7), '15:00', 'pendiente')].forEach(a => DB.add(a));
    renderAll(); toast('Datos de ejemplo cargados. Revisa las 4 pestañas.');
  }
  function act(name, id) {
    if (name === 'cancel' && confirm('¿Cancelar esta cita?')) { DB.patch(id, { status: 'cancelada' }); renderAll(); toast('Cita cancelada'); }
    else if (name === 'confirm') { DB.patch(id, { status: 'confirmada' }); renderAll(); toast('Cita confirmada. El paciente verá el cambio en su cuenta.'); }
    else if (name === 'atender') { const f = $('#at-form'); f.reset(); $('#at-id').value = id; $('#at-err').textContent = ''; $('#atencion').showModal(); }
    else if (name === 'rx') downloadRx(id);
    else if (name === 'seed') seedDemo();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open-booking]');
    if (b) { e.preventDefault(); openBooking(b.dataset.openBooking); return; }
    const x = e.target.closest('[data-act]');
    if (x) act(x.dataset.act, x.dataset.id);
  });

  /* ---------- Filtros (las tarjetas ya están en el HTML; solo se ocultan) ---------- */
  function filters() {
    const apply = (cards, test, countEl, noun) => {
      let n = 0; cards.forEach(c => { const ok = test(c); c.hidden = !ok; if (ok) n++; });
      const nr = $('#no-results'); if (nr) nr.hidden = n > 0;
      if (countEl) countEl.textContent = `${n} ${noun}`;
    };
    const fn = $('#f-name');
    if (fn) {
      const s = $('#f-spec'), u = $('#f-unit'), cards = $$('#doctors-list .doc-card'), c = $('#f-count');
      fn.value = params.get('q') || '';
      const e = params.get('e'); if (e && $(`#f-spec option[value="${CSS.escape(e)}"]`)) s.value = e;
      const run = () => apply(cards, x => (!s.value || x.dataset.spec === s.value) && (!u.value || x.dataset.sede === u.value) && x.dataset.name.includes(norm(fn.value.trim())), c, 'médicos encontrados');
      [fn, s, u].forEach(el => el.addEventListener('input', run)); run();
    }
    const sn = $('#s-search');
    if (sn) {
      const u = $('#s-unit'), cards = $$('#specialties-grid .spec-card');
      const run = () => apply(cards, x => (!u.value || x.dataset.unit === u.value) && x.dataset.name.includes(norm(sn.value.trim())), $('#s-count'), 'especialidades encontradas');
      sn.addEventListener('input', run); u.addEventListener('change', run);
    }
  }

  /* ---------- Portal del paciente ---------- */
  function renderPatient() {
    const u = Auth.get(), mine = DB.appts().filter(a => a.patient === u.email).sort(byDate);
    const dd = a => docById(a.doctorId) || { name: 'Médico', spec: '', sede: '' };
    const head = a => `<p class="code">${esc(a.code)}</p><h3>${esc(dd(a).name)}</h3><p class="muted">${esc(dd(a).spec)} · ${esc(a.modality)} · ${esc(dd(a).sede)}</p><p>${I_CAL} <time datetime="${esc(a.date)}">${esc(fmtDate(a.date))}</time>, ${esc(fmtTime(a.time))}</p>`;
    const up = mine.filter(a => a.status !== 'atendida'), done = mine.filter(a => a.status === 'atendida');
    $('#appointments-container').innerHTML = up.map(a => card(head(a) + `<p>${I_CARD} Total: S/ ${Number(a.total).toFixed(2)} <span class="note">(pago simulado)</span></p>`,
      badge(a.status) + (ACTIVE(a.status) ? btn('cancel', a.id, 'Cancelar cita', 'btn-danger') : ''))).join('')
      || empty('Aún no tienes citas programadas', 'Elige un médico y reserva tu primer horario.', '<div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="doctores.html">Buscar médico</a><button class="btn btn-ghost" data-act="seed">Cargar datos de ejemplo</button></div><p class="note" style="margin:1rem auto 0">Para la demostración: crea citas, una atención con receta y exámenes de ejemplo.</p>');
    $('#sec-atenciones-list').innerHTML = done.map(a => card(head(a) + `<p><strong>Diagnóstico:</strong> ${esc(atn(a).diagnostico || '-')}</p><p><strong>Indicaciones:</strong> ${esc(atn(a).indicaciones || '-')}</p>`, badge('atendida'))).join('')
      || empty('Sin atenciones registradas', 'Cuando un médico termine tu consulta, aparecerá aquí.');
    const rx = done.filter(a => atn(a).receta.length);
    $('#sec-recetas-list').innerHTML = rx.map(a => card(`<p class="code">${esc(a.code)}</p><h3>${esc(dd(a).name)}</h3><p class="muted">${esc(fmtDate(atn(a).fecha))}</p><ul class="rx">${atn(a).receta.map(r => `<li><strong>${esc(r.med)}:</strong> ${esc(r.dosis)}</li>`).join('')}</ul>`,
      btn('rx', a.id, 'Descargar receta'))).join('') || empty('Sin recetas', 'Tus recetas médicas aparecerán aquí.');
    const ex = done.filter(a => atn(a).examenes.length);
    $('#sec-examenes-list').innerHTML = ex.map(a => card(`<p class="code">${esc(a.code)}</p><h3>${esc(dd(a).name)}</h3><p class="muted">Orden del ${esc(fmtDate(atn(a).fecha))}</p><ul class="rx">${atn(a).examenes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, '<p class="badge warn">Indicado</p>')).join('')
      || empty('Sin exámenes indicados', 'Los exámenes que te indique tu médico aparecerán aquí.');
  }

  /* ---------- Panel del médico ---------- */
  function renderPanel() {
    const u = Auth.get(), me = docById(u.doctorId), mine = DB.appts().filter(a => a.doctorId === u.doctorId).sort(byDate);
    const who = a => `<p class="code">${esc(a.code)}</p><h3>${I_USER} ${esc(a.patientName)}</h3><p class="muted">${esc(a.modality)} · S/ ${Number(a.total).toFixed(2)}</p><p>${I_CAL} <time datetime="${esc(a.date)}">${esc(fmtDate(a.date))}</time>, ${esc(fmtTime(a.time))}</p>`;
    const act_ = mine.filter(a => ACTIVE(a.status)), done = mine.filter(a => a.status === 'atendida');
    const n = (v, l) => `<div class="stat"><strong>${v}</strong><span>${l}</span></div>`;
    $('#agenda-stats').innerHTML = n(act_.filter(a => a.date === today()).length, 'Citas hoy') + n(mine.filter(a => a.status === 'pendiente').length, 'Por confirmar') + n(done.length, 'Atenciones realizadas');
    $('#agenda-list').innerHTML = act_.map(a => card(who(a), badge(a.status) + '<div class="btn-row" style="margin:0;justify-content:flex-end">' +
      (a.status === 'pendiente' ? btn('confirm', a.id, 'Confirmar', 'btn-primary') : btn('atender', a.id, 'Atender', 'btn-primary')) + btn('cancel', a.id, 'Cancelar', 'btn-danger') + '</div>')).join('')
      || empty('Tu agenda está libre', 'Cuando un paciente reserve contigo, la cita aparecerá aquí.');
    $('#hist-list').innerHTML = done.slice().reverse().map(a => card(who(a) + `<p><strong>Diagnóstico:</strong> ${esc(atn(a).diagnostico || '-')}</p>`, badge('atendida'))).join('')
      || empty('Sin atenciones registradas', 'Las consultas que atiendas quedarán registradas aquí.');
    $('#perfil-box').innerHTML = `<div class="info-block"><h3>Nombre</h3><p>${esc(me.name)}</p></div><div class="info-block"><h3>Especialidad</h3><p>${esc(me.spec)}</p></div><div class="info-block"><h3>Sede y tarifa</h3><p>${esc(me.sede)} · S/ ${me.price}.00 por consulta</p></div>` +
      (me.cmp ? `<div class="info-block"><h3>Colegiatura</h3><p>CMP ${esc(me.cmp)}${me.rne ? ` · RNE ${esc(me.rne)}` : ''}</p></div>` : '<p class="note">Sin CMP registrado. En producción, un administrador verifica la colegiatura antes de activar el perfil.</p>');
  }
  function panelForms() {
    const u = Auth.get(), av = DB.avail(u.doctorId);
    $$('#disp-form [name=day]').forEach(c => { c.checked = av.days.includes(+c.value); });
    $$('#disp-form [name=slot]').forEach(c => { c.checked = av.slots.includes(c.value); });
    $('#disp-form').addEventListener('submit', e => {
      e.preventDefault();
      const days = $$('#disp-form [name=day]:checked').map(c => +c.value), slots = $$('#disp-form [name=slot]:checked').map(c => c.value);
      if (!days.length || !slots.length) { $('#disp-err').textContent = 'Elige al menos un día y un horario.'; return; }
      $('#disp-err').textContent = ''; DB.setAvail(u.doctorId, { days, slots }); toast('Disponibilidad guardada');
    });
    const dlg = $('#atencion');
    $('#at-close').addEventListener('click', () => dlg.close());
    $('#at-form').addEventListener('submit', e => {
      e.preventDefault();
      const dx = $('#at-dx').value.trim(); if (!dx) { $('#at-err').textContent = 'Escribe el diagnóstico.'; $('#at-dx').focus(); return; }
      const meds = $$('.at-row').map(r => ({ med: $('.at-med', r).value.trim(), dosis: $('.at-dosis', r).value.trim() })).filter(r => r.med);
      DB.patch($('#at-id').value, { status: 'atendida', atencion: { fecha: today(), diagnostico: dx, indicaciones: $('#at-ind').value.trim(), receta: meds, examenes: $('#at-ex').value.split(',').map(s => s.trim()).filter(Boolean) } });
      dlg.close(); renderAll(); toast('Atención registrada. El paciente ya ve su receta y exámenes.');
    });
  }

  /* ---------- Portales (paciente y médico comparten estructura) ---------- */
  function portal() {
    const dash = $('#dash'); if (!dash) return;
    const u = Auth.get(), panel = !!$('#sec-agenda'), need = panel ? 'medico' : 'paciente';
    if (u && u.role !== need) { location.replace(u.role === 'medico' ? 'panel-medico.html' : 'micuenta.html'); return; }
    if (u && panel && !docById(u.doctorId)) { Auth.clear(); location.reload(); return; }
    $('#gate').hidden = !!u; dash.hidden = !u;
    if (!u) return;
    $('#user-welcome-name').textContent = panel ? `Hola, ${u.name}` : `Hola, ${u.name}`;
    const lo = $('#btn-logout'); lo.hidden = false;
    lo.addEventListener('click', () => { Auth.clear(); location.href = 'index.html'; });
    const tabs = $$('[role=tab]');
    const show = t => { tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; $('#' + b.getAttribute('aria-controls')).hidden = !on; }); history.replaceState(null, '', '#' + t.dataset.tab); };
    tabs.forEach((b, i) => {
      b.addEventListener('click', () => show(b));
      b.addEventListener('keydown', e => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return;
        e.preventDefault(); const n = tabs[(i + k + tabs.length) % tabs.length]; n.focus(); show(n);
      });
    });
    show(tabs.find(b => b.dataset.tab === location.hash.slice(1)) || tabs[0]);
    renderAll = panel ? renderPanel : renderPatient;
    if (panel) panelForms();
    renderAll();
  }

  /* ---------- Ingreso ---------- */
  function login() {
    const f = $('#login-form'); if (!f) return;
    const roleOf = () => $('input[name=role]:checked').value;
    const sync = () => { const m = roleOf() === 'medico'; $('#row-doc').hidden = !m; $('#row-name').hidden = m; };
    $$('input[name=role]').forEach(r => r.addEventListener('change', sync));
    if (params.get('role') === 'medico') $('input[name=role][value=medico]').checked = true;
    sync();
    f.addEventListener('submit', e => {
      e.preventDefault();
      const role = roleOf(), email = $('#l-email').value.trim(), err = $('#l-err');
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Escribe un correo válido.'; $('#l-email').focus(); return; }
      if (role === 'medico') {
        const d = docById($('#l-doc').value); if (!d) { err.textContent = 'Elige tu perfil médico.'; return; }
        Auth.set({ role, doctorId: d.id, name: d.name, email });
        location.href = safeNext(params.get('next'), 'panel-medico.html');
      } else {
        const name = $('#l-name').value.trim(); if (name.length < 3) { err.textContent = 'Escribe tu nombre completo.'; $('#l-name').focus(); return; }
        Auth.set({ role, name, email });
        location.href = safeNext(params.get('next'), 'micuenta.html');
      }
    });
  }

  document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.classList.add('img-fail'); }, true);
  let failed = false;
  [header, booking, filters, portal, login].forEach(fn => {
    try { fn(); } catch (e) { failed = true; window.MC_ERR = e.message; console.error('[MediCare]', fn.name, e); }
  });
  window.MC_READY = !failed;
})();
