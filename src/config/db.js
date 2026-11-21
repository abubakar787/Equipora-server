
import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const client = new MongoClient(env.mongoUri);

const database = client.db(env.dbName);

export const connectDB = async () => {
  try {
    await client.connect();
    await database.command({ ping: 1 });

    console.log("MongoDB connected successfully");

    return database;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export const getDB = () => database;

export const closeDB = async () => {
  await client.close();
  console.log("MongoDB connection closed");
};
