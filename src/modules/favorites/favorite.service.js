
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";

// Access MongoDB collections
const getFavoriteCollection = () => getDB().collection("favorites");
const getEquipmentCollection = () => getDB().collection("equipment");

// Add equipment to customer favorites
export const addFavorite = async (equipmentId, customerId) => {
  if (!ObjectId.isValid(equipmentId)) {
    throw new Error("Invalid equipment ID");
  }

  const equipment = await getEquipmentCollection().findOne({
    _id: new ObjectId(equipmentId),
    status: "approved",
  });

  if (!equipment) {
    throw new Error("Approved equipment not found");
  }

  const favorites = getFavoriteCollection();

  // Prevent duplicate favorites
  const existingFavorite = await favorites.findOne({
    customerId,
    equipmentId: new ObjectId(equipmentId),
  });

  if (existingFavorite) {
    throw new Error("Equipment is already in your favorites");
  }

  const favorite = {
    customerId,
    equipmentId: new ObjectId(equipmentId),
    createdAt: new Date(),
  };

  const result = await favorites.insertOne(favorite);

  return {
    _id: result.insertedId,
    ...favorite,
  };
};

// Get the logged-in customer's favorite equipment
export const getMyFavorites = async (customerId, query) => {
  const favorites = getFavoriteCollection();

  const page = query.page || 1;
  const limit = query.limit || 12;
  const skip = (page - 1) * limit;

  // Join favorites with approved equipment
  const pipeline = [
    {
      $match: { customerId },
    },
    {
      $lookup: {
        from: "equipment",
        localField: "equipmentId",
        foreignField: "_id",
        as: "equipment",
      },
    },
    {
      $unwind: "$equipment",
    },
    {
      $match: {
        "equipment.status": "approved",
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              createdAt: 1,
              equipment: 1,
            },
          },
        ],
        metadata: [
          { $count: "total" },
        ],
      },
    },
  ];

  const [result] = await favorites.aggregate(pipeline).toArray();

  const data = result?.data || [];
  const total = result?.metadata[0]?.total || 0;

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Remove equipment from customer favorites
export const removeFavorite = async (equipmentId, customerId) => {
  if (!ObjectId.isValid(equipmentId)) {
    throw new Error("Invalid equipment ID");
  }

  const result = await getFavoriteCollection().deleteOne({
    customerId,
    equipmentId: new ObjectId(equipmentId),
  });

  if (result.deletedCount === 0) {
    throw new Error("Favorite equipment not found");
  }

  return { deleted: true };
};
