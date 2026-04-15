import fetch from "@supabase/node-fetch";

const response = await fetch("http://localhost:5000/api/auth/create-admin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fullName: "Admin",
    email: "admin@studyplanner.com",
    password: "admin123",
    secretKey: "admin-secret-key-12345"
  })
});

const data = await response.json();
console.log(data);