import { MongoClient } from "mongodb";
import { env } from "./env.js";

const client = new MongoClient(env.mongoUri);

let database;

export const connectDB = async () => {
  try {
    await client.connect();

    database = client.db(env.dbName);

    await database.command({ ping: 1 });

    console.log("MongoDB connected successfully");

    return database;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export const getDB = () => {
  if (!database) {
    throw new Error("Database is not connected yet");
  }

  return database;
};

export const closeDB = async () => {
  await client.close();
};