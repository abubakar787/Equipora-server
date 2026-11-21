
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";

// ============================================
// COLLECTION
// ============================================

const getEquipmentCollection = () => {
  return getDB().collection("equipment");
};

// ============================================
// HELPER: ESCAPE REGEX
// ============================================

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ============================================
// HELPER: CONVERT AVAILABILITY DATES
// ============================================

const convertAvailabilityDates = (availability) => {
  if (!availability) return undefined;

  return {
    availableFrom: new Date(
      `${availability.availableFrom}T00:00:00.000Z`
    ),
    availableUntil: new Date(
      `${availability.availableUntil}T23:59:59.999Z`
    ),
  };
};

// ============================================
// 1. CREATE EQUIPMENT
// ============================================

export const createEquipment = async (equipmentData, user) => {
  const db = getDB();

  // Check whether category exists and is active
  const category = await db.collection("categories").findOne({
    _id: new ObjectId(equipmentData.categoryId),
    isActive: true,
  });

  if (!category) {
    throw new Error("Invalid or inactive equipment category");
  }

  const equipment = {
    ...equipmentData,

    categoryId: category._id,
    categoryName: category.name,

    availability: convertAvailabilityDates(
      equipmentData.availability
    ),

    ownerId: user.id,
    ownerEmail: user.email,

    status: "pending",
    isAvailable: true,
    isDeleted: false,

    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await getEquipmentCollection().insertOne(equipment);

  return {
    ...equipment,
    _id: result.insertedId,
  };
};

// ============================================
// 2. GET ALL APPROVED EQUIPMENT
// ============================================

export const getAllEquipment = async (filters) => {
  const collection = getEquipmentCollection();

  const {
    search,
    category,
    location,
    sort,
    page,
    limit,
  } = filters;

  const query = {
    status: "approved",
    isAvailable: true,
    isDeleted: { $ne: true },
  };

  if (search) {
    const safeSearch = escapeRegex(search);

    query.$or = [
      {
        title: {
          $regex: safeSearch,
          $options: "i",
        },
      },
      {
        description: {
          $regex: safeSearch,
          $options: "i",
        },
      },
    ];
  }

  if (category) {
    query.categoryId = new ObjectId(category);
  }

  if (location) {
    query.location = {
      $regex: escapeRegex(location),
      $options: "i",
    };
  }

  const sortOptions = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
  };

  const skip = (page - 1) * limit;

  const [equipment, total] = await Promise.all([
    collection
      .find(query)
      .sort(sortOptions[sort])
      .skip(skip)
      .limit(limit)
      .toArray(),

    collection.countDocuments(query),
  ]);

  return {
    equipment,

    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

// ============================================
// 3. GET EQUIPMENT DETAILS BY ID
// ============================================

export const getEquipmentById = async (equipmentId) => {
  if (!ObjectId.isValid(equipmentId)) {
    return null;
  }

  return getEquipmentCollection().findOne({
    _id: new ObjectId(equipmentId),
    status: "approved",
    isDeleted: { $ne: true },
  });
};

// ============================================
// 4. UPDATE EQUIPMENT
// ============================================

export const updateEquipment = async (
  equipmentId,
  ownerId,
  updateData
) => {
  if (!ObjectId.isValid(equipmentId)) {
    return null;
  }

  const collection = getEquipmentCollection();

  const data = { ...updateData };

  // Validate updated category
  if (data.categoryId) {
    if (!ObjectId.isValid(data.categoryId)) {
      return null;
    }

    const category = await getDB()
      .collection("categories")
      .findOne({
        _id: new ObjectId(data.categoryId),
        isActive: true,
      });

    if (!category) {
      throw new Error("Invalid or inactive equipment category");
    }

    data.categoryId = category._id;
    data.categoryName = category.name;
  }

  // Convert updated availability dates
  if (data.availability) {
    data.availability = convertAvailabilityDates(
      data.availability
    );
  }

  const result = await collection.findOneAndUpdate(
    {
      _id: new ObjectId(equipmentId),
      ownerId,
      isDeleted: { $ne: true },
    },
    {
      $set: {
        ...data,
        status: "pending",
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    }
  );

  return result;
};

// ============================================
// 5. DELETE EQUIPMENT (SOFT DELETE)
// ============================================

export const deleteEquipment = async (
  equipmentId,
  ownerId
) => {
  if (!ObjectId.isValid(equipmentId)) {
    return null;
  }

  const result = await getEquipmentCollection().findOneAndUpdate(
    {
      _id: new ObjectId(equipmentId),
      ownerId,
      isDeleted: { $ne: true },
    },
    {
      $set: {
        isDeleted: true,
        isAvailable: false,
        updatedAt: new Date(),
        deletedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    }
  );

  return result;
};

// ============================================
// 6. OWNER: GET MY EQUIPMENT
// ============================================

export const getMyEquipment = async (ownerId, filters) => {
  const collection = getEquipmentCollection();

  const {
    page,
    limit,
    status,
  } = filters;

  const query = { ownerId };

  if (status && status !== "all") {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [equipment, total] = await Promise.all([
    collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),

    collection.countDocuments(query),
  ]);

  return {
    equipment,

    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

// ============================================
// 7. ADMIN: APPROVE OR REJECT EQUIPMENT
// ============================================

export const reviewEquipment = async (
  equipmentId,
  adminId,
  reviewData
) => {
  if (!ObjectId.isValid(equipmentId)) {
    return null;
  }

  const result = await getEquipmentCollection().findOneAndUpdate(
    {
      _id: new ObjectId(equipmentId),
      status: "pending",
      isDeleted: { $ne: true },
    },
    {
      $set: {
        status: reviewData.status,
        reviewNote: reviewData.reviewNote || "",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    }
  );

  return result;
};

// ============================================
// 8. ADMIN: GET PENDING EQUIPMENT
// ============================================

export const getPendingEquipment = async (page, limit) => {
  const collection = getEquipmentCollection();

  const query = {
    status: "pending",
    isDeleted: { $ne: true },
  };

  const skip = (page - 1) * limit;

  const [equipment, total] = await Promise.all([
    collection
      .find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),

    collection.countDocuments(query),
  ]);

  return {
    equipment,

    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};
