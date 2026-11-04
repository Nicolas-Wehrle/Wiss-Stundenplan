// Synthetic review account. No credentials and no school API calls.
globalThis.WissDemo = (() => {
  const keys = ['demoMode', 'lessons', 'grades', 'rooms', 'absences', 'attendance', 'user', 'lastSync', 'status', 'error', 'teachers', 'teachersDone', 'teachersUpdated', 'roomCache', 'notes', 'examOverrides', 'setupDone', 'notifyPlan', 'notifiedGrades', 'notifiedAbs', 'syncLog', 'lastAttempt'];
  function data(now = new Date(), random = Math.random) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const anchor = new Date(today + 'T12:00:00Z');
    anchor.setUTCDate(anchor.getUTCDate() - (anchor.getUTCDay() + 6) % 7);
    const modules = [['M117', 'Informatik- und Netzinfrastruktur realisieren'], ['M162', 'Daten analysieren und modellieren'], ['M319', 'Applikationen entwerfen und implementieren'], ['M164', 'Datenbanken erstellen und Daten einfügen']];
    const rooms = ['DEMO-201', 'DEMO-202', 'DEMO-203', 'DEMO-204'].map(label => ({ label, floor: '2.OG', seats: 24, surface: 48, comment: 'Fiktiver Demoraum', active: true, building: 'Demo-Campus' }));
    const lessons = [], teachers = {};
    for (let w = -6; w <= 10; w++) for (let d = 0; d < 5; d++) for (let slot = 0; slot < 2; slot++) {
      const dt = new Date(anchor); dt.setUTCDate(dt.getUTCDate() + w * 7 + d);
      const day = dt.toISOString().slice(0, 10), i = (d + slot) % modules.length, [abbr, name] = modules[i];
      const label = abbr + ' ' + name, id = `demo-${day}-${slot}`;
      lessons.push({ id, event: 'demo-module-' + i, start: day + (slot ? ' 13:00' : ' 08:15'), end: day + (slot ? ' 16:15' : ' 11:30'), label, cls: 'DEMO-26', room: rooms[i].label, type: 'Präsenzunterricht', comment: w === 2 ? 'LB – fiktive Leistungsbeurteilung' : '' });
      teachers['l:' + label] = 'Demo-Lehrperson ' + (i + 1);
    }
    const grades = modules.map(([abbr, name], i) => {
      const first = 4 + Math.floor(random() * 5) / 2, second = 4 + Math.floor(random() * 5) / 2;
      return { event: 'demo-module-' + i, label: abbr + ' ' + name, part: 'Modulnote', status: 'Abgeschlossen', grade: (first + second) / 2, exams: [{ nr: 1, label: 'ZP', weight: 1, grade: first }, { nr: 2, label: 'LB', weight: 1, grade: second }] };
    });
    const past = lessons.filter(l => l.start.slice(0, 10) < today).slice(-6);
    const absences = past.filter((_, i) => i === 0 || i === 3).map((l, i) => ({ lesson: l.id, status: i ? 'absent_excused' : 'absent_unexcused', statusLabel: i ? 'Entschuldigt' : 'Unentschuldigt', start: l.start, end: l.end, label: l.label, missed: 4, rate: 0, comment: 'Fiktive Demoabsenz' }));
    const attendance = { counts: { attended: 112, absent_excused: 1, absent_unexcused: 1 }, modules: modules.map(([abbr, name], i) => ({ event: 'demo-module-' + i, label: abbr + ' ' + name, abbr, type: 'Modul', min: 80, total: 40, actual: i ? 40 : 32, rate: i ? 100 : 80, excused: i ? 0 : 4, unexcused: i ? 0 : 4, semTotal: 40, semActual: i ? 40 : 32, semRate: i ? 100 : 80 })) };
    return { lessons, grades, rooms, absences, attendance, teachers };
  }
  return { keys, data };
})();
