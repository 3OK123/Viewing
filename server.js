import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ===== DB =====
mongoose.connect("mongodb://127.0.0.1:27017/streaming").then(() => {
  console.log("✅ MongoDB Connected");
}).catch(err => {
  console.error("❌ MongoDB Error:", err);
});

// ===== Model =====
const seriesSchema = new mongoose.Schema({
  title: String,
  description: String,
  poster: String,
  episodes: [
    {
      number: Number,
      title: String,
      video: String
    }
  ]
}, { timestamps: true });

const Series = mongoose.model("Series", seriesSchema);

// ===== Upload Configuration =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["video/mp4", "image/jpeg", "image/png"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only MP4, JPEG, PNG files allowed"));
    }
  }
});

// ===== APIs =====

// 1. Get all series
app.get("/api/series", async (req, res) => {
  try {
    const series = await Series.find();
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get single series by ID
app.get("/api/series/:id", async (req, res) => {
  try {
    const series = await Series.findById(req.params.id);
    if (!series) return res.status(404).json({ error: "Series not found" });
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create new series
app.post("/api/series", upload.single("poster"), async (req, res) => {
  try {
    const posterUrl = req.file ? `/uploads/${req.file.filename}` : "";
    const newSeries = await Series.create({
      title: req.body.title,
      description: req.body.description,
      poster: posterUrl,
      episodes: []
    });
    res.status(201).json(newSeries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update series
app.put("/api/series/:id", upload.single("poster"), async (req, res) => {
  try {
    const updateData = {
      title: req.body.title,
      description: req.body.description
    };

    if (req.file) {
      updateData.poster = `/uploads/${req.file.filename}`;
    }

    const series = await Series.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!series) return res.status(404).json({ error: "Series not found" });
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete series
app.delete("/api/series/:id", async (req, res) => {
  try {
    const series = await Series.findByIdAndDelete(req.params.id);
    if (!series) return res.status(404).json({ error: "Series not found" });
    res.json({ message: "Series deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Add episode to series
app.post("/api/episode/:id", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Video file is required" });
    }

    const series = await Series.findById(req.params.id);
    if (!series) return res.status(404).json({ error: "Series not found" });

    series.episodes.push({
      number: parseInt(req.body.number),
      title: req.body.title,
      video: req.file.filename
    });

    await series.save();
    res.status(201).json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Update episode
app.put("/api/episode/:seriesId/:episodeIndex", upload.single("video"), async (req, res) => {
  try {
    const series = await Series.findById(req.params.seriesId);
    if (!series) return res.status(404).json({ error: "Series not found" });

    const episode = series.episodes[req.params.episodeIndex];
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    if (req.body.title) episode.title = req.body.title;
    if (req.body.number) episode.number = parseInt(req.body.number);
    if (req.file) episode.video = req.file.filename;

    await series.save();
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Delete episode
app.delete("/api/episode/:seriesId/:episodeIndex", async (req, res) => {
  try {
    const series = await Series.findById(req.params.seriesId);
    if (!series) return res.status(404).json({ error: "Series not found" });

    series.episodes.splice(req.params.episodeIndex, 1);
    await series.save();
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "✅ Server is running" });
});

// 10. Root route
app.get("/", (req, res) => {
  res.json({ message: "Streaming API is running on http://localhost:5000" });
});

// ===== Error Handling =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));