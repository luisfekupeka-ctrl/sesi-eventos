import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("sesi_eventos.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    startTime TEXT NOT NULL,
    duration TEXT NOT NULL,
    location TEXT,
    maxCapacity INTEGER NOT NULL,
    currentRegistrations INTEGER DEFAULT 0,
    type TEXT NOT NULL,
    targetAudience TEXT NOT NULL,
    configFields TEXT,
    allowedGrades TEXT,
    approvalMode TEXT DEFAULT 'automatic',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    registrationDate TEXT NOT NULL,
    formData TEXT NOT NULL,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    visibleFilters TEXT,
    eventTypes TEXT,
    grades TEXT
  );
`);

// Default settings if not exists
const existingSettings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
if (!existingSettings) {
  db.prepare("INSERT INTO settings (id, visibleFilters, eventTypes, grades) VALUES (?, ?, ?, ?)")
    .run(1, 
      JSON.stringify({ search: true, grade: true, type: true, quickGrades: true }),
      JSON.stringify(['Palestra', 'Workshop', 'Esporte', 'Cultura', 'After']),
      JSON.stringify(['6º Ano', '7º Ano', '8º Ano', '9º Ano', '1º Médio', '2º Médio', '3º Médio'])
    );
}

// Default events if not exists
const existingEvents = db.prepare("SELECT COUNT(*) as count FROM events").get() as any;
if (existingEvents.count === 0) {
  const seedEvents = [
    {
      id: '1',
      name: 'Oficina de Robótica',
      description: 'Aprenda a construir seu primeiro robô utilizando kits LEGO Education e programação básica.',
      type: 'Workshop',
      date: '2026-04-20',
      startTime: '14:00',
      duration: '3h',
      location: 'Laboratório de Maker',
      maxCapacity: 20,
      targetAudience: 'alunos',
      configFields: JSON.stringify({
        studentName: true,
        studentSurname: true,
        studentGrade: true,
        studentClass: true
      }),
      allowedGrades: JSON.stringify([]),
      approvalMode: 'automatic',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Palestra: Futuro das Profissões',
      description: 'Uma conversa inspiradora sobre as carreiras do futuro e as competências necessárias.',
      type: 'Palestra',
      date: '2026-04-25',
      startTime: '19:00',
      duration: '1h 30min',
      location: 'Auditório Principal',
      maxCapacity: 100,
      targetAudience: 'ambos',
      configFields: JSON.stringify({
        studentName: true,
        parentName: true,
        parentEmail: true
      }),
      allowedGrades: JSON.stringify([]),
      approvalMode: 'automatic',
      createdAt: new Date().toISOString()
    }
  ];

  const insertEvent = db.prepare(`
    INSERT INTO events (id, name, description, date, startTime, duration, location, maxCapacity, type, targetAudience, configFields, allowedGrades, approvalMode, createdAt)
    VALUES (@id, @name, @description, @date, @startTime, @duration, @location, @maxCapacity, @type, @targetAudience, @configFields, @allowedGrades, @approvalMode, @createdAt)
  `);

  for (const event of seedEvents) {
    insertEvent.run(event);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
    res.json({
      visibleFilters: JSON.parse(settings.visibleFilters),
      eventTypes: JSON.parse(settings.eventTypes),
      grades: JSON.parse(settings.grades)
    });
  });

  app.post("/api/settings", (req, res) => {
    const { visibleFilters, eventTypes, grades } = req.body;
    db.prepare("UPDATE settings SET visibleFilters = ?, eventTypes = ?, grades = ? WHERE id = 1")
      .run(JSON.stringify(visibleFilters), JSON.stringify(eventTypes), JSON.stringify(grades));
    res.json({ success: true });
  });

  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events ORDER BY date ASC").all() as any[];
    res.json(events.map(e => ({
      ...e,
      allowedGrades: JSON.parse(e.allowedGrades || '[]')
    })));
  });

  app.post("/api/events", (req, res) => {
    const event = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO events 
      (id, name, description, date, startTime, duration, location, maxCapacity, currentRegistrations, type, targetAudience, configFields, allowedGrades, approvalMode, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.id,
      event.name,
      event.description,
      event.date,
      event.startTime,
      event.duration,
      event.location || '',
      event.maxCapacity,
      event.currentRegistrations || 0,
      event.type,
      event.targetAudience,
      event.configFields,
      JSON.stringify(event.allowedGrades || []),
      event.approvalMode || 'automatic',
      event.createdAt || new Date().toISOString()
    );
    res.json({ success: true });
  });

  app.delete("/api/events/:id", (req, res) => {
    db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/registrations/:eventId", (req, res) => {
    const regs = db.prepare("SELECT * FROM registrations WHERE eventId = ? ORDER BY registrationDate DESC").all(req.params.eventId) as any[];
    res.json(regs.map(r => ({
      ...r,
      formData: JSON.parse(r.formData)
    })));
  });

  app.post("/api/registrations", (req, res) => {
    const reg = req.body;
    
    // Check capacity
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(reg.eventId) as any;
    if (event.currentRegistrations >= event.maxCapacity) {
      return res.status(400).json({ error: "Evento lotado" });
    }

    db.transaction(() => {
      db.prepare("INSERT INTO registrations (id, eventId, status, registrationDate, formData) VALUES (?, ?, ?, ?, ?)")
        .run(reg.id, reg.eventId, reg.status || 'pending', reg.registrationDate, JSON.stringify(reg.formData));
      
      if (reg.status === 'approved') {
        db.prepare("UPDATE events SET currentRegistrations = currentRegistrations + 1 WHERE id = ?").run(reg.eventId);
      }
    })();
    
    res.json({ success: true });
  });

  app.patch("/api/registrations/:id", (req, res) => {
    const { status } = req.body;
    const reg = db.prepare("SELECT * FROM registrations WHERE id = ?").get(req.params.id) as any;
    
    if (!reg) return res.status(404).json({ error: "Inscrição não encontrada" });

    db.transaction(() => {
      if (reg.status !== 'approved' && status === 'approved') {
        db.prepare("UPDATE events SET currentRegistrations = currentRegistrations + 1 WHERE id = ?").run(reg.eventId);
      } else if (reg.status === 'approved' && status !== 'approved') {
        db.prepare("UPDATE events SET currentRegistrations = currentRegistrations - 1 WHERE id = ?").run(reg.eventId);
      }
      db.prepare("UPDATE registrations SET status = ? WHERE id = ?").run(status, req.params.id);
    })();

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
