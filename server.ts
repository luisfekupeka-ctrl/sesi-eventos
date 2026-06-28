import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbPath = path.resolve(__dirname, "events.db");
let db;
try {
  db = new Database(dbPath);
} catch (err) {
  console.warn(`[Database] Failed to open database at ${dbPath}. Attempting fallback to /tmp/events.db...`, err);
  const tempDbPath = path.join("/tmp", "events.db");
  try {
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, tempDbPath);
      console.log(`[Database] Copied existing database to writeable path: ${tempDbPath}`);
    }
    dbPath = tempDbPath;
    db = new Database(dbPath);
    console.log(`[Database] Successfully opened fallback database at ${dbPath}`);
  } catch (fallbackErr) {
    console.error("[Database] Critical: Failed to configure writeable database path:", fallbackErr);
    throw fallbackErr;
  }
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    date TEXT,
    time TEXT,
    max_vagas INTEGER,
    deadline TEXT,
    classes_allowed TEXT,
    years_allowed TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS event_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    is_required INTEGER DEFAULT 0,
    options TEXT,
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', '2024');

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
    UNIQUE(category_id, name)
  );
`);

// Safe migration for events table
const migrateEventsTable = () => {
  const columns = [
    "ALTER TABLE events ADD COLUMN category_id INTEGER",
    "ALTER TABLE events ADD COLUMN subcategory_id INTEGER",
    "ALTER TABLE events ADD COLUMN is_paid INTEGER DEFAULT 0",
    "ALTER TABLE events ADD COLUMN restringir_duplicidade INTEGER DEFAULT 0",
    "ALTER TABLE events ADD COLUMN limitar_vagas_por_ano INTEGER DEFAULT 0",
    "ALTER TABLE events ADD COLUMN vagas_por_ano INTEGER DEFAULT NULL"
  ];
  for (const col of columns) {
    try {
      db.exec(col);
    } catch (e) {
      // Ignore if column already exists
    }
  }
};
migrateEventsTable();

// Seed default categories and subcategories
const seedCategoriesTable = () => {
  const categories = ["After", "Oficina", "Reunião", "Feriado", "Esporte", "Cultura", "Palestra", "Evento Escolar"];
  const insertCat = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  const insertSub = db.prepare("INSERT OR IGNORE INTO subcategories (category_id, name) VALUES (?, ?)");
  
  db.transaction(() => {
    for (const cat of categories) {
      insertCat.run(cat);
    }
    
    // Seed default subcategories under "After"
    const afterRow = db.prepare("SELECT id FROM categories WHERE name = 'After'").get() as { id: number } | undefined;
    if (afterRow) {
      const subcategories = ["Esporte", "Cultura", "Música", "Tecnologia"];
      for (const sub of subcategories) {
        insertSub.run(afterRow.id, sub);
      }
    }
  })();
};
seedCategoriesTable();

const app = express();
app.use(cors());
app.use(express.json());

// API Routes

// Admin Login
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  
  try {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get();
    const adminPassword = setting ? setting.value : "2024";
    
    if (password === adminPassword) {
      res.json({ authorized: true });
    } else {
      res.status(401).json({ authorized: false, error: "Senha incorreta" });
    }
  } catch (err) {
    res.status(500).json({ error: "Erro ao verificar senha" });
  }
});

// Get all events
app.get("/api/events", (req, res) => {
  try {
    const events = db.prepare(`
      SELECT e.*, 
      c.name AS category_name,
      s.name AS subcategory_name,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as current_registrations
      FROM events e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN subcategories s ON e.subcategory_id = s.id
      ORDER BY e.created_at DESC
    `).all();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single event with fields
app.get("/api/events/:id", (req, res) => {
  try {
    const event = db.prepare(`
      SELECT e.*, 
      c.name AS category_name,
      s.name AS subcategory_name
      FROM events e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN subcategories s ON e.subcategory_id = s.id
      WHERE e.id = ?
    `).get(req.params.id);
    
    if (!event) return res.status(404).json({ error: "Event not found" });
    
    const fields = db.prepare("SELECT * FROM event_fields WHERE event_id = ?").all(req.params.id);
    const registrationsCount = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE event_id = ?").get(req.params.id);
    
    res.json({ ...event, fields, current_registrations: registrationsCount.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create event
app.post("/api/events", (req, res) => {
  const { name, type, description, date, time, max_vagas, deadline, classes_allowed, years_allowed, category_id, subcategory_id, is_paid, restringir_duplicidade, limitar_vagas_por_ano, vagas_por_ano, fields } = req.body;
  
  const insertEvent = db.prepare(`
    INSERT INTO events (name, type, description, date, time, max_vagas, deadline, classes_allowed, years_allowed, category_id, subcategory_id, is_paid, restringir_duplicidade, limitar_vagas_por_ano, vagas_por_ano)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction(() => {
    const info = insertEvent.run(
      name, 
      type, 
      description, 
      date, 
      time, 
      max_vagas, 
      deadline, 
      classes_allowed || '', 
      years_allowed || '',
      category_id || null,
      subcategory_id || null,
      is_paid ? 1 : 0,
      restringir_duplicidade ? 1 : 0,
      limitar_vagas_por_ano ? 1 : 0,
      vagas_por_ano !== undefined && vagas_por_ano !== null ? vagas_por_ano : null
    );
    const eventId = info.lastInsertRowid;
    
    const insertField = db.prepare(`
      INSERT INTO event_fields (event_id, field_name, field_label, field_type, is_required, options)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    for (const field of fields) {
      insertField.run(eventId, field.field_name, field.field_label, field.field_type, field.is_required ? 1 : 0, field.options || null);
    }
    
    return eventId;
  });
  
  try {
    const eventId = transaction();
    res.json({ id: eventId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete event
app.delete("/api/events/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update event
app.put("/api/events/:id", (req, res) => {
  const { name, type, description, date, time, max_vagas, deadline, category_id, subcategory_id, is_paid, restringir_duplicidade, years_allowed, limitar_vagas_por_ano, vagas_por_ano } = req.body;
  const eventId = req.params.id;

  try {
    db.prepare(`
      UPDATE events 
      SET name = ?, type = ?, description = ?, date = ?, time = ?, max_vagas = ?, deadline = ?, category_id = ?, subcategory_id = ?, is_paid = ?, restringir_duplicidade = ?, years_allowed = ?, limitar_vagas_por_ano = ?, vagas_por_ano = ?
      WHERE id = ?
    `).run(name, type, description, date, time, max_vagas, deadline, category_id || null, subcategory_id || null, is_paid ? 1 : 0, restringir_duplicidade ? 1 : 0, years_allowed || '', limitar_vagas_por_ano ? 1 : 0, vagas_por_ano !== undefined && vagas_por_ano !== null ? vagas_por_ano : null, eventId);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register for event
app.post("/api/events/:id/register", (req, res) => {
  const eventId = req.params.id;
  const { data } = req.body;
  
  try {
    // Check spots & allowed years
    const event = db.prepare("SELECT max_vagas, deadline, years_allowed, category_id, subcategory_id, restringir_duplicidade, limitar_vagas_por_ano, vagas_por_ano FROM events WHERE id = ?").get(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    
    const count = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE event_id = ?").get(eventId);
    
    if (count.count >= event.max_vagas) {
      return res.status(400).json({ error: "Acabaram as vagas deste evento, por favor escolha outro." });
    }

    // Check for duplicate registration by name and surname
    const existingRegs = db.prepare("SELECT data FROM registrations WHERE event_id = ?").all(eventId);
    const fullName = `${data.nome || ''} ${data.sobrenome || ''}`.trim().toLowerCase();
    
    if (fullName) {
      const isDuplicate = existingRegs.some(r => {
        const regData = JSON.parse(r.data);
        const regFullName = `${regData.nome || ''} ${regData.sobrenome || ''}`.trim().toLowerCase();
        return regFullName === fullName;
      });

      if (isDuplicate) {
        return res.status(400).json({ error: "Este aluno já está inscrito neste evento." });
      }
    }

    // Helper to normalize school years for comparison
    const normalizeYear = (y: any) => {
      if (typeof y !== 'string') return '';
      return y.trim().toLowerCase().replace(/º/g, '°');
    };

    // 1. Year eligibility check
    if (event.years_allowed && event.years_allowed.trim()) {
      const allowedList = event.years_allowed.split(',').map(y => normalizeYear(y));
      const studentGrade = normalizeYear(data.ano_escolar);
      if (studentGrade && !allowedList.includes(studentGrade)) {
        return res.status(400).json({ error: `Este evento não é permitido para o seu ano escolar (${data.ano_escolar}).` });
      }
    }

    // Year-specific spots limit check
    if (event.limitar_vagas_por_ano === 1 && event.vagas_por_ano !== null && event.vagas_por_ano !== undefined) {
      const studentGrade = normalizeYear(data.ano_escolar);
      if (studentGrade) {
        const yearCount = existingRegs.filter(r => {
          try {
            const regData = JSON.parse(r.data);
            return normalizeYear(regData.ano_escolar) === studentGrade;
          } catch (e) {
            return false;
          }
        }).length;

        if (yearCount >= event.vagas_por_ano) {
          return res.status(400).json({ 
            error: `Infelizmente, o limite de ${event.vagas_por_ano} vagas para o ${data.ano_escolar} já foi preenchido.` 
          });
        }
      }
    }

    // 2. Duplicate restriction check (restringir_duplicidade per category & subcategory)
    if (event.restringir_duplicidade === 1 && event.category_id && event.subcategory_id) {
      const duplicateRegs = db.prepare(`
        SELECT r.data, e.name AS event_name FROM registrations r
        JOIN events e ON r.event_id = e.id
        WHERE e.category_id = ? AND e.subcategory_id = ? AND e.id != ?
      `).all(event.category_id, event.subcategory_id, eventId);

      const hasConflictingReg = duplicateRegs.some(r => {
        const regData = JSON.parse(r.data);
        const regFullName = `${regData.nome || ''} ${regData.sobrenome || ''}`.trim().toLowerCase();
        return regFullName === fullName;
      });

      if (hasConflictingReg) {
        const conflict = duplicateRegs.find(r => {
          const regData = JSON.parse(r.data);
          return `${regData.nome || ''} ${regData.sobrenome || ''}`.trim().toLowerCase() === fullName;
        });
        return res.status(400).json({ 
          error: `Este aluno já está inscrito em outro evento com a mesma categoria e tipo (${conflict.event_name}).` 
        });
      }
    }
    
    const now = new Date();
    const deadlineDate = new Date(event.deadline);
    if (now > deadlineDate) {
      return res.status(400).json({ error: "Inscrições encerradas" });
    }
    
    db.prepare("INSERT INTO registrations (event_id, data) VALUES (?, ?)").run(eventId, JSON.stringify(data));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get registrations for an event
app.get("/api/events/:id/registrations", (req, res) => {
  const regs = db.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY registration_date DESC").all(req.params.id);
  const fields = db.prepare("SELECT * FROM event_fields WHERE event_id = ?").all(req.params.id);
  
  const formattedRegs = regs.map(r => ({
    ...r,
    data: JSON.parse(r.data)
  }));
  
  res.json({ registrations: formattedRegs, fields });
});

// Delete a registration
app.delete("/api/registrations/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM registrations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API de Alunos ---

// Get all students
app.get("/api/students", (req, res) => {
  try {
    const students = db.prepare("SELECT * FROM students ORDER BY name ASC").all();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create single student
app.post("/api/students", (req, res) => {
  const { name, grade } = req.body;
  if (!name || !grade) {
    return res.status(400).json({ error: "Nome e ano escolar são obrigatórios." });
  }
  try {
    const info = db.prepare("INSERT INTO students (name, grade) VALUES (?, ?)").run(name, grade);
    res.json({ id: info.lastInsertRowid, name, grade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk create students
app.post("/api/students/bulk", (req, res) => {
  const { grade, names } = req.body;
  if (!grade || !names || !Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: "Ano escolar e lista de nomes são obrigatórios." });
  }
  
  const insert = db.prepare("INSERT INTO students (name, grade) VALUES (?, ?)");
  const transaction = db.transaction(() => {
    for (const name of names) {
      if (name && name.trim()) {
        insert.run(name.trim(), grade);
      }
    }
  });

  try {
    transaction();
    res.json({ success: true, count: names.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete student
app.delete("/api/students/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM students WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API de Categorias e Subcategorias ---

// Get all categories with subcategories
app.get("/api/categories", (req, res) => {
  try {
    const categories = db.prepare("SELECT * FROM categories ORDER BY name ASC").all();
    const subcategories = db.prepare("SELECT * FROM subcategories ORDER BY name ASC").all();
    
    const result = categories.map(cat => ({
      ...cat,
      subcategories: subcategories.filter(sub => sub.category_id === cat.id)
    }));
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create category
app.post("/api/categories", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nome da categoria é obrigatório." });
  try {
    const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    res.json({ id: info.lastInsertRowid, name, subcategories: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete category
app.delete("/api/categories/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create subcategory
app.post("/api/categories/:categoryId/subcategories", (req, res) => {
  const { categoryId } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nome do tipo é obrigatório." });
  try {
    const info = db.prepare("INSERT INTO subcategories (category_id, name) VALUES (?, ?)").run(categoryId, name);
    res.json({ id: info.lastInsertRowid, category_id: parseInt(categoryId), name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete subcategory
app.delete("/api/subcategories/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM subcategories WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development or production static serving
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(__dirname, "dist"));
  
  if (!isProduction) {
    console.log(`[${new Date().toISOString()}] Starting in DEVELOPMENT mode (Vite Middleware)`);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log(`[${new Date().toISOString()}] Starting in PRODUCTION mode (Serving dist folder)`);
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      // Check if it's an API call that missed
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API route not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  startServer();
}

export default app;
