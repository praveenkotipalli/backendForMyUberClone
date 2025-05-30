import express from "express";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const sql = neon('postgresql://neondb_owner:npg_kCyT7DPuNwc3@ep-billowing-glitter-a8a70scn-pooler.eastus2.azure.neon.tech/neondb?sslmode=require');

app.post("/api/user", async (req, res) => {
  try {
    const { name, email, clerkId } = req.body;

    if (!name || !email || !clerkId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const response = await sql`
      INSERT INTO users (name, email, clerk_id)
      VALUES (${name}, ${email}, ${clerkId})
      RETURNING *;
    `;

    res.status(201).json({ data: response });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT =  3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
