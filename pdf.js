/* ============================================================
   pdf.js — generación de reportes y credenciales en PDF
   usando jsPDF + jspdf-autotable.
   ============================================================ */

const PDFGEN = (() => {
  function _doc(orientation = 'p', unit = 'mm', format = 'letter') {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ orientation, unit, format });
  }

  function _fechaLarga(d = new Date()) {
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function _header(doc, titulo) {
    const school = DB.getSchoolName();
    doc.setFillColor(44, 74, 124); // --color-primary
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(school, 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(titulo, 14, 18);
    doc.setTextColor(27, 36, 48);
  }

  function _footer(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const h = doc.internal.pageSize.getHeight();
      const w = doc.internal.pageSize.getWidth();
      doc.setFontSize(8);
      doc.setTextColor(139, 147, 161);
      doc.text(`Generado el ${_fechaLarga()}`, 14, h - 8);
      doc.text(`Página ${i} de ${pageCount}`, w - 14, h - 8, { align: 'right' });
    }
  }

  // ---------- Listado de alumnos registrados ----------
  function studentsListPDF(students) {
    const doc = _doc();
    _header(doc, 'Listado de alumnos registrados');

    const rows = students.map((s) => [
      s.matricula,
      DB.nombreCompleto(s),
      s.grado || '-',
      s.grupo || '-',
      s.tutor || '-',
      new Date(s.fechaRegistro).toLocaleDateString('es-MX')
    ]);

    doc.autoTable({
      startY: 30,
      head: [['Matrícula', 'Nombre completo', 'Grado', 'Grupo', 'Tutor', 'Registrado']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [231, 236, 244], textColor: [27, 36, 48], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 248, 250] },
      margin: { left: 14, right: 14 }
    });

    doc.setFontSize(10);
    doc.text(`Total de alumnos: ${students.length}`, 14, doc.lastAutoTable.finalY + 8);

    _footer(doc);
    doc.save(`listado-alumnos-${DB._todayStr()}.pdf`);
  }

  // ---------- Reporte de asistencia por rango de fechas ----------
  function attendanceReportPDF(records, studentsById, fechaInicio, fechaFin) {
    const doc = _doc();
    _header(doc, `Reporte de asistencia: ${fechaInicio} a ${fechaFin}`);

    const rows = records.map((r) => {
      const s = studentsById.get(r.matricula);
      return [
        r.fecha,
        r.hora,
        r.matricula,
        s ? DB.nombreCompleto(s) : '(alumno no encontrado)',
        s ? `${s.grado || ''} ${s.grupo || ''}`.trim() || '-' : '-'
      ];
    });

    doc.autoTable({
      startY: 30,
      head: [['Fecha', 'Hora', 'Matrícula', 'Nombre', 'Grado/Grupo']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [231, 236, 244], textColor: [27, 36, 48], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 248, 250] },
      margin: { left: 14, right: 14 }
    });

    const y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Total de registros de asistencia: ${records.length}`, 14, y);

    _footer(doc);
    doc.save(`reporte-asistencia-${fechaInicio}_a_${fechaFin}.pdf`);
  }

  // ---------- Credencial / tarjeta individual ----------
  async function studentCardPDF(student) {
    // Tamaño estándar de credencial CR80 (85.6 x 54 mm), horizontal.
    const doc = _doc('l', 'mm', [85.6, 54]);
    const w = 85.6;
    const h = 54;

    // Franja superior
    doc.setFillColor(44, 74, 124);
    doc.rect(0, 0, w, 13, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(DB.getSchoolName(), 4, 8, { maxWidth: w - 20 });

    // Cuerpo
    doc.setTextColor(27, 36, 48);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(DB.nombreCompleto(student), 4, 22, { maxWidth: w - 26 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(91, 100, 114);
    const grado = `${student.grado || ''} ${student.grupo ? '· Grupo ' + student.grupo : ''}`.trim();
    doc.text(grado || '-', 4, 27.5);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(47, 111, 79);
    doc.text(`No. ${student.matricula}`, 4, 34);

    // QR
    const qrDataUrl = await QR.toDataURL(student.matricula, 300);
    const qrSize = 26;
    doc.setDrawColor(225, 229, 234);
    doc.rect(w - qrSize - 5, h - qrSize - 5, qrSize, qrSize);
    doc.addImage(qrDataUrl, 'PNG', w - qrSize - 5, h - qrSize - 5, qrSize, qrSize);

    // Pie
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(139, 147, 161);
    doc.text('Presentar esta credencial para pase de lista', 4, h - 4);

    doc.save(`credencial-${student.matricula}.pdf`);
  }

  return { studentsListPDF, attendanceReportPDF, studentCardPDF };
})();
