
import { getDB } from "../../config/db.js";
import { ObjectId } from "mongodb";

const getCategoryCollection = () => {
  return getDB().collection("categories");
};

export const createCategory = async (data, adminId) => {
  const category = {
    ...data,
    slug: data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    isActive: true,
    createdBy: adminId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await getCategoryCollection().insertOne(category);

  return { ...category, _id: result.insertedId };
};

export const getActiveCategories = async () => {
  return getCategoryCollection()
    .find({ isActive: true })
    .sort({ name: 1 })
    .toArray();
};

export const updateCategory = async (id, data) => {
  if (!ObjectId.isValid(id)) return null;

  const updateData = { ...data, updatedAt: new Date() };

  if (data.name) {
    updateData.slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  return getCategoryCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updateData },
    { returnDocument: "after" }
  );
};

export const deactivateCategory = async (id) => {
  if (!ObjectId.isValid(id)) return null;

  return getCategoryCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        isActive: false,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
};
