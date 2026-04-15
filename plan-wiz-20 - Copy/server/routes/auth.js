import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

console.log("Auth routes loaded, User model:", User);

router.post("/register", async (req, res) => {
  try {
    console.log("Register request:", req.body);
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({ message: "Please fill in all fields" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "Email already registered" });
      return;
    }

    const user = new User({ fullName, email, password, isApproved: false, role: "user" });
    await user.save();

    res.status(201).json({
      message: "Account created. Please wait for admin approval.",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    console.log("Login request:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Please fill in all fields" });
      return;
    }

    const user = await User.findOne({ email });
    console.log("Found user:", user);
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const isMatch = await user.comparePassword(password);
    console.log("Password match:", isMatch);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    if (!user.isApproved && user.role !== "admin") {
      res.status(403).json({ message: "Account pending approval. Contact admin." });
      return;
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "No token provided" });
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      res.status(403).json({ message: "Admin only" });
      return;
    }
    const users = await User.find().select("-password");
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/approve/:userId", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "No token provided" });
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      res.status(403).json({ message: "Admin only" });
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isApproved: true },
      { new: true }
    );
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ message: "User approved", user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/create-admin", async (req, res) => {
  try {
    const { fullName, email, password, secretKey } = req.body;
    const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin-secret-key";

    if (secretKey !== ADMIN_SECRET) {
      res.status(403).json({ message: "Invalid secret key" });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "Email already registered" });
      return;
    }

    const user = new User({ fullName, email, password, role: "admin", isApproved: true });
    await user.save();

    res.status(201).json({ message: "Admin created", user: { id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;