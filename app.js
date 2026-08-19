/* ============================================================
   app.js — controlador principal: login, navegación, vistas,
   escáner, reportes, credencial, menú y reinicio.
   ============================================================ */

const PASSWORD_LOGIN = '0000';
const PASSWORD_RESET = '1111';
const SESSION_KEY = 'aqr_session_user';

let scanner = null;
let lastReportRecords = null;
let lastReportRange = null;
let selectedCardStudent = null;

/* ---------------------------------------------------------
   Utilidades de UI
--------------------------------------------------------- */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

let toastTimer = null;
function showToast(message, type = '') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = ''; }, 2600);
}

function openModal(id) { $(id).classList.add('show'); }
function closeModal(id) { $(id).classList.remove('show'); }

/* ---------------------------------------------------------
   Arranque
--------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  initInstallPrompt();
  wireLogin();
  wireDrawer();
  wireTabs();
  wireRegistro();
  wireAsistencia();
  wireReporte();
  wireTarjeta();
  wireResetFlow();

  const activeUser = sessionStorage.getItem(SESSION_KEY);
  if (activeUser) {
    enterApp(activeUser);
  }
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((err) => {
        console.warn('No se pudo registrar el service worker:', err);
      });
    });
  }
}

/* ---------------------------------------------------------
   Instalación como app nativa (beforeinstallprompt)
--------------------------------------------------------- */

let deferredInstallPrompt = null;

function initInstallPrompt() {
  const btnLogin = $('#install-btn-login');
  const btnMenu = $('#drawer-install');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btnLogin.classList.add('show');
    if (btnMenu) btnMenu.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    btnLogin.classList.remove('show');
    if (btnMenu) btnMenu.classList.add('hidden');
    showToast('Aplicación instalada correctamente', 'ok');
  });

  const doInstall = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btnLogin.classList.remove('show');
  };

  btnLogin.addEventListener('click', doInstall);
  if (btnMenu) btnMenu.addEventListener('click', doInstall);
}

/* ---------------------------------------------------------
   Login
--------------------------------------------------------- */

function wireLogin() {
  const form = $('#login-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = $('#login-username').value.trim();
    const pass = $('#login-password').value;
    const errorBox = $('#login-error');

    if (!user) {
      errorBox.textContent = 'Ingresa un usuario.';
      errorBox.classList.add('show');
      return;
    }
    if (pass !== PASSWORD_LOGIN) {
      errorBox.textContent = 'Contraseña incorrecta.';
      errorBox.classList.add('show');
      $('#login-password').value = '';
      return;
    }
    errorBox.classList.remove('show');
    sessionStorage.setItem(SESSION_KEY, user);
    enterApp(user);
  });
}

function enterApp(user) {
  $('#view-login').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  $('#drawer-username').textContent = user;
  $('#drawer-avatar').textContent = user.trim().charAt(0).toUpperCase() || 'U';
  showView('registro');
  renderStudentsList();
  renderTodayCount();
  renderTarjetaOptions();
}

function logout() {
  if (scanner) scanner.stop();
  sessionStorage.removeItem(SESSION_KEY);
  $('#app-shell').classList.add('hidden');
  $('#view-login').classList.remove('hidden');
  $('#login-password').value = '';
  closeDrawer();
}

/* ---------------------------------------------------------
   Navegación por pestañas
--------------------------------------------------------- */

const VIEW_LABELS = {
  registro: ['Registro de alumnos', 'Alta y credenciales QR'],
  asistencia: ['Toma de asistencia', 'Escanea el QR del alumno'],
  reporte: ['Reporte de asistencia', 'Consulta por rango de fechas'],
  tarjeta: ['Crear tarjeta', 'Credencial imprimible']
};

function wireTabs() {
  $all('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
}

function showView(name) {
  $all('.view-panel').forEach((p) => p.classList.add('hidden'));
  $(`#panel-${name}`).classList.remove('hidden');
  $all('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));

  const [title, sub] = VIEW_LABELS[name];
  $('#topbar-title-main').textContent = title;
  $('#topbar-title-sub').textContent = sub;

  // Si salimos de la vista de asistencia, detener la cámara para ahorrar batería.
  if (name !== 'asistencia' && scanner) {
    stopScanning();
  }
  if (name === 'tarjeta') {
    renderTarjetaOptions();
  }
}

/* ---------------------------------------------------------
   Menú hamburguesa (drawer)
--------------------------------------------------------- */

function wireDrawer() {
  $('#btn-hamburger').addEventListener('click', openDrawer);
  $('#drawer-overlay').addEventListener('click', closeDrawer);
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-logout').addEventListener('click', logout);
  $('#drawer-reset').addEventListener('click', () => {
    closeDrawer();
    openModal('#modal-reset-password');
    $('#reset-password-input').value = '';
    $('#reset-password-error').classList.remove('show');
    setTimeout(() => $('#reset-password-input').focus(), 250);
  });
}

function openDrawer() {
  $('#drawer-overlay').classList.add('show');
  $('#drawer').classList.add('show');
}
function closeDrawer() {
  $('#drawer-overlay').classList.remove('show');
  $('#drawer').classList.remove('show');
}

/* ---------------------------------------------------------
   Vista: Registro de alumnos
--------------------------------------------------------- */

function wireRegistro() {
  const form = $('#form-registro');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = $('#reg-nombre').value.trim();
    const apellidoP = $('#reg-apellidoP').value.trim();
    const apellidoM = $('#reg-apellidoM').value.trim();
    const grado = $('#reg-grado').value.trim();
    const grupo = $('#reg-grupo').value.trim();
    const tutor = $('#reg-tutor').value.trim();

    if (!nombre || !apellidoP) {
      showToast('Nombre y apellido paterno son obligatorios', 'err');
      return;
    }

    const student = DB.addStudent({ nombre, apellidoP, apellidoM, grado, grupo, tutor });
    form.reset();
    renderStudentsList();
    renderTarjetaOptions();
    showToast(`Alumno registrado · Matrícula ${student.matricula}`, 'ok');
  });

  $('#btn-export-students').addEventListener('click', () => {
    const students = DB.getStudents();
    if (!students.length) {
      showToast('Aún no hay alumnos registrados', 'err');
      return;
    }
    PDFGEN.studentsListPDF(students);
  });
}

function renderStudentsList() {
  const students = DB.getStudents().slice().reverse();
  const container = $('#students-list');
  $('#students-count').textContent = students.length;

  if (!students.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></svg>
        <p>Todavía no registras alumnos.<br>Usa el formulario de arriba para dar de alta al primero.</p>
      </div>`;
    return;
  }

  container.innerHTML = students.map((s) => `
    <div class="student-row">
      <div class="student-chip">${s.matricula}</div>
      <div class="student-info">
        <div class="student-name">${escapeHtml(DB.nombreCompleto(s))}</div>
        <div class="student-meta">${escapeHtml(s.grado || '-')} · Grupo ${escapeHtml(s.grupo || '-')}</div>
      </div>
      <div class="row-actions">
        <button class="icon-mini" data-del="${s.matricula}" title="Eliminar alumno">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  $all('[data-del]', container).forEach((btn) => {
    btn.addEventListener('click', () => {
      const matricula = btn.dataset.del;
      const s = DB.getStudentById(matricula);
      if (confirm(`¿Eliminar a ${DB.nombreCompleto(s)} (No. ${matricula})? Esto no borra su historial de asistencia ya registrado.`)) {
        DB.deleteStudent(matricula);
        renderStudentsList();
        renderTarjetaOptions();
        showToast('Alumno eliminado');
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------
   Vista: Toma de asistencia
--------------------------------------------------------- */

function wireAsistencia() {
  $('#btn-toggle-scan').addEventListener('click', () => {
    if (scanner && scanner.running) {
      stopScanning();
    } else {
      startScanning();
    }
  });

  $('#btn-confirm-attendance').addEventListener('click', () => {
    if (!window._pendingMatricula) return;
    const res = DB.addAttendance(window._pendingMatricula);
    if (res.ok) {
      showToast('Asistencia registrada', 'ok');
    } else {
      showToast('Este alumno ya tenía asistencia registrada hoy', 'err');
    }
    renderTodayCount();
    resumeScanningAfterMatch();
  });

  $('#btn-continue-scan').addEventListener('click', resumeScanningAfterMatch);
}

function startScanning() {
  if (!DB.getStudents().length) {
    showToast('Primero registra al menos un alumno', 'err');
    return;
  }
  $('#match-result').classList.add('hidden');
  $('#scanner-wrap').classList.remove('hidden');
  $('#scanner-hint').classList.remove('hidden');
  $('#btn-toggle-scan').textContent = 'Detener escáner';

  scanner = scanner || new QR.Scanner('qr-reader');
  scanner.start(onScanDecoded, (err) => {
    showToast('No se pudo acceder a la cámara. Revisa los permisos.', 'err');
    console.error(err);
    $('#btn-toggle-scan').textContent = 'Iniciar escáner';
  });
}

function stopScanning() {
  if (scanner) scanner.stop();
  $('#btn-toggle-scan').textContent = 'Iniciar escáner';
}

function onScanDecoded(decodedText) {
  const matricula = QR.parsePayload(decodedText);
  const student = matricula ? DB.getStudentById(matricula) : null;
  const resultBox = $('#match-result');
  resultBox.classList.remove('hidden');

  if (!student) {
    resultBox.innerHTML = matchCardHtml(null);
    if (scanner) scanner.stop();
    window._pendingMatricula = null;
    return;
  }

  resultBox.innerHTML = matchCardHtml(student);
  window._pendingMatricula = student.matricula;
  if (scanner) scanner.stop();

  // Re-conectar botones que viven dentro del HTML recién insertado.
  $('#btn-confirm-attendance').classList.toggle('hidden', false);
}

function matchCardHtml(student) {
  if (!student) {
    return `
      <div class="match-card err">
        <div class="status-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><path d="M6 18L18 6M6 6l12 12"/></svg></div>
        <div class="m-name">Código no reconocido</div>
        <div class="m-meta">Este QR no corresponde a ningún alumno registrado.</div>
        <div class="match-actions">
          <button class="btn btn-outline" id="btn-continue-scan">Volver a escanear</button>
        </div>
      </div>`;
  }
  const yaRegistrado = DB.getAttendance().some(
    (r) => r.matricula === student.matricula && r.fecha === DB._todayStr()
  );
  return `
    <div class="match-card ok">
      <div class="status-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><path d="M5 13l4 4L19 7"/></svg></div>
      <div class="m-name">${escapeHtml(DB.nombreCompleto(student))}</div>
      <div class="m-meta">${escapeHtml(student.grado || '-')} · Grupo ${escapeHtml(student.grupo || '-')}</div>
      <div class="m-id">Matrícula No. ${student.matricula}</div>
      ${yaRegistrado ? '<div class="m-meta" style="margin-top:8px;color:var(--color-danger);font-weight:600;">Ya tiene asistencia registrada hoy</div>' : ''}
      <div class="match-actions">
        ${yaRegistrado
          ? '<button class="btn btn-outline" id="btn-continue-scan">Seguir escaneando</button>'
          : '<button class="btn btn-outline" id="btn-continue-scan">Cancelar</button><button class="btn btn-accent" id="btn-confirm-attendance">Registrar asistencia</button>'}
      </div>
    </div>`;
}

// Los botones dentro de match-card se regeneran con innerHTML, así que
// usamos delegación de eventos para que siempre respondan.
document.addEventListener('click', (e) => {
  if (e.target.closest('#btn-continue-scan')) resumeScanningAfterMatch();
  if (e.target.closest('#btn-confirm-attendance') && $('#panel-asistencia') && !$('#panel-asistencia').classList.contains('hidden')) {
    const matricula = window._pendingMatricula;
    if (!matricula) return;
    const res = DB.addAttendance(matricula);
    if (res.ok) showToast('Asistencia registrada', 'ok');
    else showToast('Este alumno ya tenía asistencia registrada hoy', 'err');
    renderTodayCount();
    resumeScanningAfterMatch();
  }
});

function resumeScanningAfterMatch() {
  window._pendingMatricula = null;
  $('#match-result').classList.add('hidden');
  $('#match-result').innerHTML = '';
  startScanning();
}

function renderTodayCount() {
  $('#today-count-num').textContent = DB.getAttendanceToday().length;
}

/* ---------------------------------------------------------
   Vista: Reporte de asistencia
--------------------------------------------------------- */

function wireReporte() {
  const today = DB._todayStr();
  $('#report-fecha-inicio').value = today;
  $('#report-fecha-fin').value = today;

  $('#btn-generate-report').addEventListener('click', () => {
    const inicio = $('#report-fecha-inicio').value;
    const fin = $('#report-fecha-fin').value;
    if (!inicio || !fin) {
      showToast('Selecciona ambas fechas', 'err');
      return;
    }
    if (inicio > fin) {
      showToast('La fecha inicial no puede ser mayor a la final', 'err');
      return;
    }
    const records = DB.getAttendanceByRange(inicio, fin);
    lastReportRecords = records;
    lastReportRange = { inicio, fin };
    renderReport(records, inicio, fin);
  });

  $('#btn-download-report-pdf').addEventListener('click', () => {
    if (!lastReportRecords) return;
    const studentsById = new Map(DB.getStudents().map((s) => [s.matricula, s]));
    PDFGEN.attendanceReportPDF(lastReportRecords, studentsById, lastReportRange.inicio, lastReportRange.fin);
  });
}

function renderReport(records, inicio, fin) {
  const studentsById = new Map(DB.getStudents().map((s) => [s.matricula, s]));
  const uniqueStudents = new Set(records.map((r) => r.matricula));

  $('#report-summary').innerHTML = `
    <div class="summary-chip"><span class="n">${records.length}</span><span class="l">Asistencias</span></div>
    <div class="summary-chip"><span class="n">${uniqueStudents.size}</span><span class="l">Alumnos distintos</span></div>
    <div class="summary-chip"><span class="n">${diffDays(inicio, fin)}</span><span class="l">Días cubiertos</span></div>
  `;
  $('#report-summary').classList.remove('hidden');

  const wrap = $('#report-table-wrap');
  if (!records.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2v4M16 2v4M3 9h18M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"/></svg>
        <p>No hay asistencias registradas en ese rango de fechas.</p>
      </div>`;
  } else {
    wrap.innerHTML = `
      <div class="report-table-wrap">
        <table class="report-table">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Matrícula</th><th>Nombre</th><th>Grupo</th></tr></thead>
          <tbody>
            ${records.map((r) => {
              const s = studentsById.get(r.matricula);
              return `<tr>
                <td>${r.fecha}</td>
                <td class="mono">${r.hora}</td>
                <td class="mono">${r.matricula}</td>
                <td>${s ? escapeHtml(DB.nombreCompleto(s)) : '<em>alumno eliminado</em>'}</td>
                <td>${s ? escapeHtml(s.grupo || '-') : '-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }
  $('#btn-download-report-pdf').disabled = records.length === 0;
}

function diffDays(inicio, fin) {
  const a = new Date(inicio + 'T00:00:00');
  const b = new Date(fin + 'T00:00:00');
  return Math.round((b - a) / 86400000) + 1;
}

/* ---------------------------------------------------------
   Vista: Crear tarjeta (credencial)
--------------------------------------------------------- */

function wireTarjeta() {
  $('#tarjeta-select-alumno').addEventListener('change', (e) => {
    const matricula = e.target.value;
    selectedCardStudent = matricula ? DB.getStudentById(matricula) : null;
    renderCardPreview();
  });

  $('#btn-download-card-pdf').addEventListener('click', () => {
    if (!selectedCardStudent) {
      showToast('Selecciona un alumno primero', 'err');
      return;
    }
    PDFGEN.studentCardPDF(selectedCardStudent);
  });
}

function renderTarjetaOptions() {
  const select = $('#tarjeta-select-alumno');
  const students = DB.getStudents();
  const currentValue = select.value;

  if (!students.length) {
    select.innerHTML = '<option value="">No hay alumnos registrados</option>';
    selectedCardStudent = null;
    renderCardPreview();
    return;
  }

  select.innerHTML =
    '<option value="">Selecciona un alumno…</option>' +
    students.map((s) => `<option value="${s.matricula}">${escapeHtml(DB.nombreCompleto(s))} · No. ${s.matricula}</option>`).join('');

  if (currentValue && students.some((s) => s.matricula === currentValue)) {
    select.value = currentValue;
    selectedCardStudent = DB.getStudentById(currentValue);
  } else {
    selectedCardStudent = null;
  }
  renderCardPreview();
}

async function renderCardPreview() {
  const wrap = $('#id-card-preview-wrap');
  const btn = $('#btn-download-card-pdf');

  if (!selectedCardStudent) {
    wrap.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="8" cy="12.5" r="2"/><path d="M13 11h5M13 14h3"/></svg>
        <p>Elige un alumno para previsualizar su credencial.</p>
      </div>`;
    btn.disabled = true;
    return;
  }
  btn.disabled = false;

  const s = selectedCardStudent;
  wrap.innerHTML = `
    <div class="id-card">
      <div class="id-card-head">
        <span class="school-name">${escapeHtml(DB.getSchoolName())}</span>
        <span class="card-tag">Credencial</span>
      </div>
      <div class="id-card-body">
        <div class="id-card-photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
        </div>
        <div class="id-card-data">
          <div class="n">${escapeHtml(DB.nombreCompleto(s))}</div>
          <div class="g">${escapeHtml(s.grado || '-')} · Grupo ${escapeHtml(s.grupo || '-')}</div>
          <div class="mat">No. ${s.matricula}</div>
        </div>
        <div class="id-card-qr"><canvas id="id-card-qr-canvas"></canvas></div>
      </div>
      <div class="id-card-foot">PRESENTAR PARA PASE DE LISTA</div>
    </div>`;

  try {
    await QR.renderToCanvas($('#id-card-qr-canvas'), s.matricula, 200);
  } catch (err) {
    console.warn(err);
  }
}

/* ---------------------------------------------------------
   Reinicio de la aplicación (menú hamburguesa)
--------------------------------------------------------- */

function wireResetFlow() {
  $('#reset-password-cancel').addEventListener('click', () => closeModal('#modal-reset-password'));
  $('#reset-password-confirm').addEventListener('click', () => {
    const val = $('#reset-password-input').value;
    if (val !== PASSWORD_RESET) {
      $('#reset-password-error').classList.add('show');
      return;
    }
    closeModal('#modal-reset-password');
    openModal('#modal-reset-confirm');
  });
  $('#reset-password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#reset-password-confirm').click();
  });

  $('#reset-confirm-cancel').addEventListener('click', () => closeModal('#modal-reset-confirm'));
  $('#reset-confirm-accept').addEventListener('click', () => {
    DB.resetAll();
    closeModal('#modal-reset-confirm');
    renderStudentsList();
    renderTodayCount();
    renderTarjetaOptions();
    showView('registro');
    showToast('La aplicación se reinició correctamente', 'ok');
  });
}
