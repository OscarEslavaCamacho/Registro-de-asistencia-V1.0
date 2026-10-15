/* ============================================================
   db.js — capa de datos sobre localStorage.
   Todo el estado de la app (alumnos y asistencias) vive aquí,
   en el navegador del dispositivo. No se envía a ningún servidor.
   ============================================================ */

const DB = (() => {
  const KEY_STUDENTS = 'aqr_students';
  const KEY_ATTENDANCE = 'aqr_attendance';
  const KEY_COUNTER = 'aqr_counter';
  const KEY_SCHOOL = 'aqr_school_name';

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Error leyendo', key, e);
      return fallback;
    }
  }

  function _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ---------- Alumnos ----------

  function getStudents() {
    return _read(KEY_STUDENTS, []);
  }

  function getStudentById(matricula) {
    return getStudents().find((s) => s.matricula === matricula) || null;
  }

  function _nextMatricula() {
    const n = _read(KEY_COUNTER, 0) + 1;
    _write(KEY_COUNTER, n);
    return String(n).padStart(4, '0');
  }

  function addStudent({ nombre, apellidoP, apellidoM, grado, grupo, tutor }) {
    const students = getStudents();
    const matricula = _nextMatricula();
    const student = {
      matricula,
      nombre: (nombre || '').trim(),
      apellidoP: (apellidoP || '').trim(),
      apellidoM: (apellidoM || '').trim(),
      grado: (grado || '').trim(),
      grupo: (grupo || '').trim(),
      tutor: (tutor || '').trim(),
      fechaRegistro: new Date().toISOString()
    };
    students.push(student);
    _write(KEY_STUDENTS, students);
    return student;
  }

  function updateStudent(matricula, changes) {
    const students = getStudents();
    const idx = students.findIndex((s) => s.matricula === matricula);
    if (idx === -1) return null;
    students[idx] = { ...students[idx], ...changes };
    _write(KEY_STUDENTS, students);
    return students[idx];
  }

  function deleteStudent(matricula) {
    const students = getStudents().filter((s) => s.matricula !== matricula);
    _write(KEY_STUDENTS, students);
  }

  function nombreCompleto(s) {
    return [s.nombre, s.apellidoP, s.apellidoM].filter(Boolean).join(' ');
  }

  // ---------- Asistencia ----------

  function getAttendance() {
    return _read(KEY_ATTENDANCE, []);
  }

  function _todayStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Registra asistencia; evita duplicados del mismo alumno el mismo día.
  function addAttendance(matricula) {
    const records = getAttendance();
    const fecha = _todayStr();
    const yaExiste = records.some((r) => r.matricula === matricula && r.fecha === fecha);
    if (yaExiste) {
      return { ok: false, reason: 'duplicado' };
    }
    const now = new Date();
    const hora = now.toTimeString().slice(0, 8);
    const record = { matricula, fecha, hora, timestamp: now.toISOString() };
    records.push(record);
    _write(KEY_ATTENDANCE, records);
    return { ok: true, record };
  }

  function getAttendanceToday() {
    const fecha = _todayStr();
    return getAttendance().filter((r) => r.fecha === fecha);
  }

  function getAttendanceByRange(fechaInicio, fechaFin) {
    return getAttendance()
      .filter((r) => r.fecha >= fechaInicio && r.fecha <= fechaFin)
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }

  // ---------- Configuración ----------

  function getSchoolName() {
    return _read(KEY_SCHOOL, 'Registro de Asistencia Escolar');
  }

  function setSchoolName(name) {
    _write(KEY_SCHOOL, name);
  }

  // ---------- Reinicio total ----------

  function resetAll() {
    localStorage.removeItem(KEY_STUDENTS);
    localStorage.removeItem(KEY_ATTENDANCE);
    localStorage.removeItem(KEY_COUNTER);
    // La configuración del nombre de escuela se conserva a propósito;
    // si también se debe borrar, descomentar la siguiente línea:
    // localStorage.removeItem(KEY_SCHOOL);
  }

  return {
    getStudents,
    getStudentById,
    addStudent,
    updateStudent,
    deleteStudent,
    nombreCompleto,
    getAttendance,
    addAttendance,
    getAttendanceToday,
    getAttendanceByRange,
    getSchoolName,
    setSchoolName,
    resetAll,
    _todayStr
  };
})();
