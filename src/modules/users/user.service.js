
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";

// Access Better Auth's existing user collection
const getUserCollection = () => getDB().collection("user");

// Find a user using the ID from the authentication middleware
const findUserById = async (userId) => {
  if (!userId) return null;

  const users = getUserCollection();

  const conditions = [{ id: userId }];

  if (ObjectId.isValid(userId)) {
    conditions.push({ _id: new ObjectId(userId) });
  }

  return users.findOne({ $or: conditions });
};

// Get the currently logged-in user's profile
export const getMyProfile = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("User profile not found");
  }

  // Return only safe profile information
  return {
    id: user.id || user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image || "",
    role: user.role || "customer",
    emailVerified: user.emailVerified || false,
    createdAt: user.createdAt,
  };
};

// Update the currently logged-in user's profile
export const updateMyProfile = async (userId, updateData) => {
  const users = getUserCollection();
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("User profile not found");
  }

  // Only allow profile fields, never role or email changes
  const updates = {};

  if (updateData.name !== undefined) {
    updates.name = updateData.name;
  }

  if (updateData.image !== undefined) {
    updates.image = updateData.image;
  }

  updates.updatedAt = new Date();

  const filter = user._id
    ? { _id: user._id }
    : { id: userId };

  await users.updateOne(filter, { $set: updates });

  return getMyProfile(userId);
};

// Get users for the admin dashboard
export const getAllUsers = async (query) => {
  const users = getUserCollection();

  const filter = {};

  if (query.role) {
    filter.role = query.role;
  }

  if (query.search) {
    const escapedSearch = query.search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { email: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    users.find(filter, {
      projection: {
        name: 1,
        email: 1,
        image: 1,
        role: 1,
        emailVerified: 1,
        createdAt: 1,
      },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),

    users.countDocuments(filter),
  ]);

  return {
    data: data.map((user) => ({
      ...user,
      id: user.id || user._id.toString(),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Update a user's role (admin only)
export const updateUserRole = async (userId, role, adminId) => {
  if (!ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID");
  }

  // Prevent an admin from changing their own role through this endpoint
  if (userId === adminId) {
    throw new Error("You cannot change your own role");
  }

  const users = getUserCollection();

  const result = await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        role,
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("User not found");
  }

  return getMyProfile(userId);
};
