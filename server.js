import express from "express";
import stripe from "stripe";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(express.json());

// Sirve todos los archivos estáticos (HTML, CSS, JS, imágenes, favicon, etc.)
app.use(express.static(__dirname));

// Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "store.html"));
});

// Ruta para crear la sesión de pago con Stripe
app.post("/create-payment-intent", async (req, res) => {
  try {
    const amount = req.body.amount;

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount,
      currency: "mxn",
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log("Directorio actual:", __dirname);
});
