const express = require("express");
const session = require("express-session");
const cors = require("cors");
const serverless = require("serverless-http"); // 1. Add this
const apiRouter = require("../routes/api");

const app = express();

// 2. Update CORS for your deployed frontend URL later
app.use(
  cors({
    origin: ["http://localhost:5173", "https://your-frontend.netlify.app"],
    credentials: true,
  }),
);

app.use(express.json());

// 3. IMPORTANT: Sessions in serverless can be tricky.
// For now, this stays in memory (will reset often).
app.use(
  session({
    secret: "pwp_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true if on Netlify
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// Your routes
app.use("/api", apiRouter);

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "PWP backend is running on Netlify Functions",
  });
});

// 4. WRAP AND EXPORT (Replace app.listen)
const handler = serverless(app);
module.exports.handler = async (event, context) => {
  // This allows the function to work with Netlify's event system
  return await handler(event, context);
};
