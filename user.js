import express from "express";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import Stripe from "stripe";

const OlaAPI = process.env.EXPO_PUBLIC_OLA_API_KEY;
dotenv.config();

const app = express();
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const sql = neon(process.env.DATABASE_URL);

// Create new user
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

// Store ride details
app.post("/api/rides", async (req, res) => {
  try {
    const {
      origin_address,
      destination_address,
      origin_latitude,
      origin_longitude,
      destination_latitude,
      destination_longitude,
      ride_time,
      fare_price,
      payment_status,
      driver_id,
      user_id,
    } = req.body;

    if (
      !origin_address ||
      !destination_address ||
      !origin_latitude ||
      !origin_longitude ||
      !destination_latitude ||
      !destination_longitude ||
      !ride_time ||
      !fare_price ||
      !payment_status ||
      !driver_id ||
      !user_id
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const response = await sql`
      INSERT INTO rides ( 
        origin_address, 
        destination_address, 
        origin_latitude, 
        origin_longitude, 
        destination_latitude, 
        destination_longitude, 
        ride_time, 
        fare_price, 
        payment_status, 
        driver_id, 
        user_id
      ) VALUES (
        ${origin_address},
        ${destination_address},
        ${origin_latitude},
        ${origin_longitude},
        ${destination_latitude},
        ${destination_longitude},
        ${ride_time},
        ${fare_price},
        ${payment_status},
        ${driver_id},
        ${user_id}
      )
      RETURNING *;
    `;

    res.status(201).json({ data: response[0] });
  } catch (error) {
    console.error("Error inserting ride:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fetch recent rides for a user
app.get("/api/user/:id/rides", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const response = await sql`
      SELECT
        rides.ride_id,
        rides.origin_address,
        rides.destination_address,
        rides.origin_latitude,
        rides.origin_longitude,
        rides.destination_latitude,
        rides.destination_longitude,
        rides.ride_time,
        rides.fare_price,
        rides.payment_status,
        rides.created_at,
        'driver', json_build_object(
          'driver_id', drivers.id,
          'first_name', drivers.first_name,
          'last_name', drivers.last_name,
          'profile_image_url', drivers.profile_image_url,
          'car_image_url', drivers.car_image_url,
          'car_seats', drivers.car_seats,
          'rating', drivers.rating
        ) AS driver 
      FROM 
        rides
      INNER JOIN
        drivers ON rides.driver_id = drivers.id
      WHERE 
        rides.user_id = ${id}
      ORDER BY 
        rides.created_at DESC;
    `;

    res.json({ data: response });
  } catch (error) {
    console.error("Error fetching recent rides:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Stripe payment
app.post('/payment-sheet', async (req, res) => {
  try {
    const {
      amount,
      currency = 'usd',
      fullName,
      email,
      driverId,
      rideTime,
    } = req.body;

    const finalAmount = amount && Number(amount) > 0 ? Number(amount) : 9.99;

    const customer = await stripe.customers.create({
      name: fullName,
      email,
      metadata: { driverId, rideTime },
    });

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2022-11-15' }
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalAmount * 100),
      currency,
      customer: customer.id,
      metadata: { driverId, rideTime },
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (err) {
    console.error('Payment init error:', err);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});


// Fetch all drivers
app.get("/api/drivers", async (req, res) => {
  try {
    const response = await sql`SELECT * FROM drivers;`;
    res.json({ data: response });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Express backend
app.get('/api/route', async (req, res) => {
  const { origin, destination } = req.query;
  const url = `https://api.olamaps.io/routing/v1/directions?origin=${origin}&destination=${destination}&alternatives=false&steps=false&overview=full&traffic_metadata=false&api_key=OlaAPI`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
