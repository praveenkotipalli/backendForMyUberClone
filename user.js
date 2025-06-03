import express from "express";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();
const app = express();
app.use(express.json());

// const stripe = new Stripe(sk_test_51RVm8JP5qvB67uFKd0IdNGuamND9KL9WHGZSfXlic36C51WyN2SBMgGPNWIxROYoLzi8Z66pyfc5Ac8tBWdlWT2800VNJGJvjR);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

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

app.post("/payment-sheet", async (req, res) => {
  try {
    // 1. Create customer
    const customer = await stripe.customers.create();

    // 2. Create ephemeral key
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2022-11-15' }
    );

    // 3. Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1099, // in cents (e.g., $10.99)
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    console.error("Error creating payment sheet:", error);
    res.status(500).json({ error: "Payment initialization failed" });
  }
});


const PORT =  3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
