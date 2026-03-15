import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(express.json());

  // Simple file-based database
  const DB_FILE = path.join(__dirname, "db.json");
  const getDb = () => {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb = {
        users: [
          { id: "1", username: "admin", password: "admin", role: "admin", name: "Admin SESI" },
          { id: "2", username: "monitor", password: "123", role: "operator", name: "Monitor SESI" }
        ],
        products: [],
        notebooks: [],
        professors: [],
        loans: [],
        stockMovements: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  };

  const saveDb = (db: any) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  };

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    const user = db.users.find((u: any) => u.username === username && u.password === password);
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ message: "Usuário ou senha inválidos" });
    }
  });

  // Generic CRUD helpers
  const setupCrud = (name: string) => {
    app.get(`/api/${name}`, (req, res) => {
      res.json(getDb()[name]);
    });

    app.post(`/api/${name}`, (req, res) => {
      const db = getDb();
      const newItem = { ...req.body, id: Date.now().toString() };
      db[name].push(newItem);
      saveDb(db);
      res.json(newItem);
    });

    app.put(`/api/${name}/:id`, (req, res) => {
      const db = getDb();
      const index = db[name].findIndex((item: any) => item.id === req.params.id);
      if (index !== -1) {
        db[name][index] = { ...db[name][index], ...req.body };
        saveDb(db);
        res.json(db[name][index]);
      } else {
        res.status(404).json({ message: "Não encontrado" });
      }
    });

    app.delete(`/api/${name}/:id`, (req, res) => {
      const db = getDb();
      db[name] = db[name].filter((item: any) => item.id !== req.params.id);
      saveDb(db);
      res.json({ success: true });
    });
  };

  setupCrud("products");
  setupCrud("notebooks");
  setupCrud("professors");
  setupCrud("loans");
  setupCrud("stockMovements");

  // Bulk imports
  app.post("/api/bulk/products", (req, res) => {
    const db = getDb();
    const newProducts = req.body.map((p: any) => ({ ...p, id: Math.random().toString(36).substr(2, 9) }));
    db.products.push(...newProducts);
    saveDb(db);
    res.json({ count: newProducts.length });
  });

  app.post("/api/bulk/notebooks", (req, res) => {
    const db = getDb();
    const newNotebooks = req.body.map((n: any) => ({ ...n, id: Math.random().toString(36).substr(2, 9) }));
    db.notebooks.push(...newNotebooks);
    saveDb(db);
    res.json({ count: newNotebooks.length });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
