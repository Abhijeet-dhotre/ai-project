import mongoose from "mongoose";
import User from "./server/models/User.js";

const MONGO_URI = "mongodb://127.0.0.1:27017/studyplanner";

async function resetAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
    
    // Delete existing admin
    await User.deleteOne({ email: "admin@studyplanner.com" });
    console.log("Deleted old admin");
    
    // Create new admin
    const admin = new User({
      fullName: "Admin",
      email: "admin@studyplanner.com",
      password: "admin123",
      role: "admin",
      isApproved: true
    });
    
    await admin.save();
    console.log("New admin created successfully");
    console.log("Email: admin@studyplanner.com");
    console.log("Password: admin123");
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

resetAdmin();
