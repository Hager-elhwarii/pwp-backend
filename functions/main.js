const express = require("express");
const session = require("express-session");
const cors = require("cors");
const apiRouter = require("../routes/api");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(
  session({
    secret: "pwp_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);
app.use("/api", apiRouter);

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "PWP backend is running",
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
