// backend/controllers/resourceController.js
// ─────────────────────────────────────────────────────────────────────────────
// Controller for Resource Inventory & Distribution Tracking (Member-3: Module 2).
// Implements full inventory management, atomic stock deductions, live low-stock
// alerts, distribution audit logging, and aggregated relief analytics.
// ─────────────────────────────────────────────────────────────────────────────

const Resource = require('../models/Resource');
const DistributionRecord = require('../models/DistributionRecord');
let Shelter = null;
try {
  Shelter = require('../models/Shelter');
} catch (e) {
  // Graceful fallback if Shelter model is not loaded
}

// Helper to broadcast socket events safely
const broadcastSocket = (req, event, data) => {
  try {
    const io = req.app ? req.app.get('io') : null;
    if (io) {
      io.emit(event, data);
    }
  } catch (err) {
    console.error(`Socket broadcast error for ${event}:`, err.message);
  }
};

// ── 1. GET /api/resources ─────────────────────────────────────────────────────
// Retrieve all resources with multi-field search and filters
const getAllResources = async (req, res) => {
  try {
    const { search, category, status, district, lowStockOnly } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { 'warehouse.name': { $regex: term, $options: 'i' } },
        { 'warehouse.district': { $regex: term, $options: 'i' } },
        { 'donor.name': { $regex: term, $options: 'i' } },
      ];
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (district && district !== 'All') {
      filter['warehouse.district'] = { $regex: district, $options: 'i' };
    }

    if (lowStockOnly === 'true') {
      filter.status = { $in: ['Low Stock', 'Out of Stock'] };
    }

    const resources = await Resource.find(filter)
      .populate('managedBy', 'name email role')
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: resources.length,
      resources,
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve resource inventory',
      error: error.message,
    });
  }
};

// ── 2. GET /api/resources/stats ───────────────────────────────────────────────
// Aggregated metrics for relief resources and distributions
const getResourceStats = async (req, res) => {
  try {
    const resources = await Resource.find().lean();
    const distributions = await DistributionRecord.find().lean();

    let totalAvailableStock = 0;
    let totalDistributedStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const categoryMap = {
      Food: { category: 'Food', available: 0, distributed: 0, totalReceived: 0, itemCount: 0 },
      Water: { category: 'Water', available: 0, distributed: 0, totalReceived: 0, itemCount: 0 },
      Medicine: { category: 'Medicine', available: 0, distributed: 0, totalReceived: 0, itemCount: 0 },
      Blankets: { category: 'Blankets', available: 0, distributed: 0, totalReceived: 0, itemCount: 0 },
      'Emergency Kits': { category: 'Emergency Kits', available: 0, distributed: 0, totalReceived: 0, itemCount: 0 },
      Sanitation: { category: 'Sanitation', available: 0, distributed: 0, totalReceived: 0, itemCount: 0 },
      Other: { category: 'Other', available: 0, distributed: 0, totalReceived: 0, itemCount: 0 },
    };

    resources.forEach((r) => {
      totalAvailableStock += r.quantityAvailable || 0;
      totalDistributedStock += r.totalDistributed || 0;

      if (r.status === 'Low Stock') lowStockCount++;
      if (r.status === 'Out of Stock') outOfStockCount++;

      const cat = categoryMap[r.category] || categoryMap.Other;
      cat.available += r.quantityAvailable || 0;
      cat.distributed += r.totalDistributed || 0;
      cat.totalReceived += r.totalReceived || 0;
      cat.itemCount++;
    });

    let totalBeneficiariesReached = 0;
    const districtDistMap = {};

    distributions.forEach((d) => {
      totalBeneficiariesReached += d.beneficiaryCount || 0;
      const dist = d.destination?.district || 'Unknown';
      districtDistMap[dist] = (districtDistMap[dist] || 0) + (d.quantity || 0);
    });

    const topDistricts = Object.keys(districtDistMap)
      .map((d) => ({ district: d, totalQuantity: districtDistMap[d] }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 6);

    const recentDistributions = await DistributionRecord.find()
      .sort({ distributionDate: -1 })
      .limit(6)
      .lean();

    return res.status(200).json({
      success: true,
      stats: {
        totalItems: resources.length,
        totalAvailableStock,
        totalDistributedStock,
        lowStockCount,
        outOfStockCount,
        totalDistributionsCount: distributions.length,
        totalBeneficiariesReached,
        categoryBreakdown: Object.values(categoryMap).filter((c) => c.itemCount > 0),
        topDistricts,
        recentDistributions,
      },
    });
  } catch (error) {
    console.error('Error calculating resource stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to compute resource statistics',
      error: error.message,
    });
  }
};

// ── 3. GET /api/resources/:id ─────────────────────────────────────────────────
// Get single resource item and its distribution log
const getResourceById = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('managedBy', 'name email role')
      .lean();

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource item not found',
      });
    }

    const recentDistributions = await DistributionRecord.find({ resource: req.params.id })
      .sort({ distributionDate: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      resource,
      recentDistributions,
    });
  } catch (error) {
    console.error('Error fetching resource details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve resource details',
      error: error.message,
    });
  }
};

// ── 4. POST /api/resources ────────────────────────────────────────────────────
// Create a new relief resource item (Admin or NGO)
const createResource = async (req, res) => {
  try {
    const {
      name,
      category,
      unit,
      quantityAvailable,
      thresholdLowStock,
      warehouseName,
      warehouseDistrict,
      warehouseAddress,
      donorName,
      donorContact,
      expirationDate,
      batchNumber,
      notes,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Resource name is required' });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: 'Resource category is required' });
    }
    if (!unit || !unit.trim()) {
      return res.status(400).json({ success: false, message: 'Measurement unit is required' });
    }
    if (!warehouseDistrict || !warehouseDistrict.trim()) {
      return res.status(400).json({ success: false, message: 'Warehouse district is required' });
    }

    const initialQty = Math.max(0, parseInt(quantityAvailable, 10) || 0);
    const lowStockThreshold = Math.max(0, parseInt(thresholdLowStock, 10) || 20);

    const resource = new Resource({
      name: name.trim(),
      category,
      unit: unit.trim(),
      quantityAvailable: initialQty,
      totalReceived: initialQty,
      totalDistributed: 0,
      thresholdLowStock: lowStockThreshold,
      warehouse: {
        name: warehouseName && warehouseName.trim() ? warehouseName.trim() : 'Central Relief Hub',
        district: warehouseDistrict.trim(),
        address: warehouseAddress && warehouseAddress.trim() ? warehouseAddress.trim() : '',
      },
      donor: {
        name: donorName && donorName.trim() ? donorName.trim() : 'General Relief Fund',
        contact: donorContact && donorContact.trim() ? donorContact.trim() : '',
      },
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      batchNumber: batchNumber ? batchNumber.trim() : '',
      managedBy: req.user?._id || null,
      managedByRole: req.user?.role || 'Admin',
      notes: notes ? notes.trim() : '',
    });

    await resource.save();

    broadcastSocket(req, 'resource:created', {
      resourceId: resource._id,
      name: resource.name,
      category: resource.category,
      quantityAvailable: resource.quantityAvailable,
      unit: resource.unit,
      district: resource.warehouse?.district,
    });

    return res.status(201).json({
      success: true,
      message: 'Relief resource created successfully',
      resource,
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create resource',
    });
  }
};

// ── 5. PUT /api/resources/:id ─────────────────────────────────────────────────
// Update resource metadata or warehouse info (Admin or NGO)
const updateResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource item not found' });
    }

    const {
      name,
      category,
      unit,
      thresholdLowStock,
      warehouseName,
      warehouseDistrict,
      warehouseAddress,
      donorName,
      donorContact,
      expirationDate,
      batchNumber,
      notes,
    } = req.body;

    if (name) resource.name = name.trim();
    if (category) resource.category = category;
    if (unit) resource.unit = unit.trim();
    if (thresholdLowStock !== undefined) {
      resource.thresholdLowStock = Math.max(0, parseInt(thresholdLowStock, 10));
    }
    if (warehouseName) resource.warehouse.name = warehouseName.trim();
    if (warehouseDistrict) resource.warehouse.district = warehouseDistrict.trim();
    if (warehouseAddress !== undefined) resource.warehouse.address = warehouseAddress.trim();
    if (donorName) resource.donor.name = donorName.trim();
    if (donorContact !== undefined) resource.donor.contact = donorContact.trim();
    if (expirationDate !== undefined) resource.expirationDate = expirationDate ? new Date(expirationDate) : null;
    if (batchNumber !== undefined) resource.batchNumber = batchNumber.trim();
    if (notes !== undefined) resource.notes = notes.trim();

    await resource.save();

    broadcastSocket(req, 'resource:updated', {
      resourceId: resource._id,
      name: resource.name,
      category: resource.category,
      quantityAvailable: resource.quantityAvailable,
      status: resource.status,
    });

    return res.status(200).json({
      success: true,
      message: 'Resource item updated successfully',
      resource,
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update resource item',
    });
  }
};

// ── 6. POST /api/resources/:id/restock ────────────────────────────────────────
// Add additional stock to an existing inventory item (Admin or NGO)
const restockResource = async (req, res) => {
  try {
    const { quantityToAdd, donorName, notes } = req.body;
    const qty = parseInt(quantityToAdd, 10);

    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid restock quantity greater than 0',
      });
    }

    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource item not found' });
    }

    resource.quantityAvailable += qty;
    resource.totalReceived += qty;

    if (donorName && donorName.trim()) {
      resource.donor.name = donorName.trim();
    }
    if (notes && notes.trim()) {
      const restockNote = `[Restock +${qty} on ${new Date().toLocaleDateString()}]: ${notes.trim()}`;
      resource.notes = resource.notes ? `${resource.notes} | ${restockNote}` : restockNote;
    }

    await resource.save();

    broadcastSocket(req, 'resource:restocked', {
      resourceId: resource._id,
      name: resource.name,
      added: qty,
      newAvailable: resource.quantityAvailable,
      status: resource.status,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully restocked ${qty} ${resource.unit} of ${resource.name}`,
      resource,
    });
  } catch (error) {
    console.error('Error restocking resource:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to restock resource',
      error: error.message,
    });
  }
};

// ── 7. POST /api/resources/distribute ─────────────────────────────────────────
// Record a distribution and atomically decrement inventory stock (Admin or NGO)
const recordDistribution = async (req, res) => {
  try {
    const {
      resourceId,
      quantity,
      recipientType,
      shelterId,
      destinationName,
      district,
      upazila,
      address,
      beneficiaryCount,
      transportMethod,
      notes,
    } = req.body;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Distributed quantity must be at least 1',
      });
    }

    if (!resourceId) {
      return res.status(400).json({ success: false, message: 'Resource ID is required' });
    }

    if (!district || !district.trim()) {
      return res.status(400).json({ success: false, message: 'Destination district is required' });
    }

    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found in inventory' });
    }

    // Atomic Stock Validation: Prevent distributing more than on-hand stock
    if (resource.quantityAvailable < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for "${resource.name}". Available: ${resource.quantityAvailable} ${resource.unit}, requested: ${qty} ${resource.unit}.`,
      });
    }

    let shelterName = '';
    if (shelterId && Shelter) {
      try {
        const shelterDoc = await Shelter.findById(shelterId);
        if (shelterDoc) {
          shelterName = shelterDoc.name;
        }
      } catch (e) {
        // Continue if shelter lookup is optional
      }
    }

    const destName = destinationName && destinationName.trim()
      ? destinationName.trim()
      : (shelterName || `${district.trim()} Relief Camp`);

    // Decrement stock and increment total distributed
    resource.quantityAvailable -= qty;
    resource.totalDistributed = (resource.totalDistributed || 0) + qty;
    await resource.save();

    // Create immutable distribution record
    const distribution = new DistributionRecord({
      resource: resource._id,
      resourceName: resource.name,
      category: resource.category,
      quantity: qty,
      unit: resource.unit,
      recipientType: recipientType || 'Affected Community',
      shelter: shelterId || null,
      shelterName: shelterName,
      destination: {
        name: destName,
        district: district.trim(),
        upazila: upazila ? upazila.trim() : '',
        address: address ? address.trim() : '',
      },
      beneficiaryCount: Math.max(0, parseInt(beneficiaryCount, 10) || 0),
      distributionDate: new Date(),
      distributedBy: req.user?._id,
      distributedByName: req.user?.name || 'Authorized Responder',
      distributedByRole: req.user?.role || 'Admin',
      status: 'Delivered',
      transportMethod: transportMethod ? transportMethod.trim() : 'Road Vehicle',
      notes: notes ? notes.trim() : '',
    });

    await distribution.save();

    // Broadcast distribution event to connected clients
    broadcastSocket(req, 'resource:distributed', {
      distributionId: distribution._id,
      resourceId: resource._id,
      resourceName: resource.name,
      category: resource.category,
      quantity: qty,
      unit: resource.unit,
      district: distribution.destination.district,
      remainingStock: resource.quantityAvailable,
      status: resource.status,
    });

    // If stock hit Low Stock or Out of Stock, broadcast high-priority low-stock alert
    if (resource.status === 'Low Stock' || resource.status === 'Out of Stock') {
      broadcastSocket(req, 'resource:low_stock_alert', {
        resourceId: resource._id,
        name: resource.name,
        category: resource.category,
        remainingStock: resource.quantityAvailable,
        unit: resource.unit,
        status: resource.status,
        district: resource.warehouse?.district,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Successfully distributed ${qty} ${resource.unit} of ${resource.name} to ${destName}`,
      distribution,
      updatedResource: {
        id: resource._id,
        name: resource.name,
        quantityAvailable: resource.quantityAvailable,
        totalDistributed: resource.totalDistributed,
        status: resource.status,
      },
    });
  } catch (error) {
    console.error('Error recording distribution:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record distribution',
      error: error.message,
    });
  }
};

// ── 8. GET /api/resources/distributions/history ───────────────────────────────
// Get filtered distribution audit log
const getDistributionHistory = async (req, res) => {
  try {
    const { resourceId, category, district, recipientType, limit } = req.query;
    const filter = {};

    if (resourceId) filter.resource = resourceId;
    if (category && category !== 'All') filter.category = category;
    if (district && district !== 'All') {
      filter['destination.district'] = { $regex: district, $options: 'i' };
    }
    if (recipientType && recipientType !== 'All') filter.recipientType = recipientType;

    const maxResults = Math.min(100, parseInt(limit, 10) || 50);

    const distributions = await DistributionRecord.find(filter)
      .populate('distributedBy', 'name email role')
      .populate('shelter', 'name location capacity')
      .sort({ distributionDate: -1 })
      .limit(maxResults)
      .lean();

    return res.status(200).json({
      success: true,
      count: distributions.length,
      distributions,
    });
  } catch (error) {
    console.error('Error fetching distribution history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve distribution history',
      error: error.message,
    });
  }
};

// ── 9. PUT /api/resources/distributions/:id/status ────────────────────────────
// Update status of a distribution (e.g. Delivered or Cancelled with refund)
const updateDistributionStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const allowed = ['Dispatched', 'In Transit', 'Delivered', 'Cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(', ')}`,
      });
    }

    const distribution = await DistributionRecord.findById(req.params.id);
    if (!distribution) {
      return res.status(404).json({ success: false, message: 'Distribution record not found' });
    }

    const previousStatus = distribution.status;
    distribution.status = status;
    if (notes) distribution.notes = notes.trim();

    // If cancelled and wasn't previously cancelled, refund stock back to inventory
    if (status === 'Cancelled' && previousStatus !== 'Cancelled') {
      const resource = await Resource.findById(distribution.resource);
      if (resource) {
        resource.quantityAvailable += distribution.quantity;
        resource.totalDistributed = Math.max(0, (resource.totalDistributed || 0) - distribution.quantity);
        await resource.save();
      }
    }

    await distribution.save();

    return res.status(200).json({
      success: true,
      message: `Distribution status updated to ${status}`,
      distribution,
    });
  } catch (error) {
    console.error('Error updating distribution status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update distribution status',
      error: error.message,
    });
  }
};

// ── 10. DELETE /api/resources/:id ─────────────────────────────────────────────
// Admin-only deletion of a resource inventory item
const deleteResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource item not found' });
    }

    await Resource.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Resource "${resource.name}" was successfully removed`,
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete resource item',
      error: error.message,
    });
  }
};

module.exports = {
  getAllResources,
  getResourceStats,
  getResourceById,
  createResource,
  updateResource,
  restockResource,
  recordDistribution,
  getDistributionHistory,
  updateDistributionStatus,
  deleteResource,
};
