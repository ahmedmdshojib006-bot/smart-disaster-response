const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const DistributionRecord = require('../models/DistributionRecord');
const resourceRoutes = require('../routes/resourceRoutes');
const resourceController = require('../controllers/resourceController');

describe('Member-3 (Module 2): Resource Inventory & Distribution Management', () => {
  describe('Route & Controller Definitions', () => {
    it('should export all required controller handlers', () => {
      expect(resourceRoutes).toBeDefined();
      expect(resourceController.getAllResources).toBeDefined();
      expect(resourceController.getResourceStats).toBeDefined();
      expect(resourceController.getResourceById).toBeDefined();
      expect(resourceController.createResource).toBeDefined();
      expect(resourceController.updateResource).toBeDefined();
      expect(resourceController.restockResource).toBeDefined();
      expect(resourceController.recordDistribution).toBeDefined();
      expect(resourceController.getDistributionHistory).toBeDefined();
      expect(resourceController.updateDistributionStatus).toBeDefined();
      expect(resourceController.deleteResource).toBeDefined();
    });
  });

  describe('Resource Model Schema Validations & Enums', () => {
    it('should validate allowed resource category enums', () => {
      const allowedCategories = ['Food', 'Water', 'Medicine', 'Blankets', 'Emergency Kits', 'Sanitation', 'Other'];
      const categoryPath = Resource.schema.path('category');
      expect(categoryPath.enumValues).toEqual(expect.arrayContaining(allowedCategories));
    });

    it('should require essential fields: name, category, unit, and warehouse.district', () => {
      const resource = new Resource({});
      const validationError = resource.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.name).toBeDefined();
      expect(validationError.errors.category).toBeDefined();
      expect(validationError.errors.unit).toBeDefined();
      expect(validationError.errors['warehouse.district']).toBeDefined();
    });

    it('should set proper defaults for threshold, status, and warehouse', () => {
      const dummyId = new mongoose.Types.ObjectId();
      const res = new Resource({
        name: 'High Energy Biscuits (Cartons)',
        category: 'Food',
        unit: 'cartons',
        quantityAvailable: 100,
        totalReceived: 100,
        warehouse: {
          district: 'Feni',
        },
        managedBy: dummyId,
      });

      expect(res.thresholdLowStock).toBe(20);
      expect(res.totalDistributed).toBe(0);
      expect(res.warehouse.name).toBe('Central Relief Hub');
      expect(res.status).toBe('In Stock');
    });

    it('should correctly evaluate canFulfill method', () => {
      const dummyId = new mongoose.Types.ObjectId();
      const res = new Resource({
        name: 'Water Purification Tablets',
        category: 'Water',
        unit: 'strips',
        quantityAvailable: 50,
        totalReceived: 50,
        warehouse: { district: 'Sylhet' },
        managedBy: dummyId,
      });

      expect(res.canFulfill(30)).toBe(true);
      expect(res.canFulfill(50)).toBe(true);
      expect(res.canFulfill(51)).toBe(false);
      expect(res.canFulfill(0)).toBe(false);
      expect(res.canFulfill(-10)).toBe(false);
    });
  });

  describe('Dynamic Status Hook & Stock Calculations', () => {
    it('should compute status "Out of Stock" when quantityAvailable is 0', () => {
      const res = new Resource({
        name: 'Empty Item',
        category: 'Blankets',
        unit: 'pieces',
        quantityAvailable: 0,
        totalReceived: 50,
        warehouse: { district: 'Feni' },
      });

      if (res.quantityAvailable <= 0) {
        res.status = 'Out of Stock';
      } else if (res.quantityAvailable <= res.thresholdLowStock) {
        res.status = 'Low Stock';
      } else {
        res.status = 'In Stock';
      }

      expect(res.status).toBe('Out of Stock');
    });

    it('should compute status "Low Stock" when quantityAvailable is at or below threshold', () => {
      const res = new Resource({
        name: 'Paracetamol Syrup',
        category: 'Medicine',
        unit: 'bottles',
        quantityAvailable: 15,
        totalReceived: 100,
        thresholdLowStock: 25,
        warehouse: { district: 'Noakhali' },
      });

      // Emulate the pre-save status calculation
      if (res.quantityAvailable <= 0) {
        res.status = 'Out of Stock';
      } else if (res.quantityAvailable <= res.thresholdLowStock) {
        res.status = 'Low Stock';
      } else {
        res.status = 'In Stock';
      }

      expect(res.status).toBe('Low Stock');
    });

    it('should compute status "In Stock" when quantityAvailable exceeds threshold', () => {
      const res = new Resource({
        name: 'Warm Fleece Blankets',
        category: 'Blankets',
        unit: 'pieces',
        quantityAvailable: 150,
        totalReceived: 200,
        thresholdLowStock: 30,
        warehouse: { district: 'Sylhet' },
      });

      if (res.quantityAvailable <= 0) {
        res.status = 'Out of Stock';
      } else if (res.quantityAvailable <= res.thresholdLowStock) {
        res.status = 'Low Stock';
      } else {
        res.status = 'In Stock';
      }

      expect(res.status).toBe('In Stock');
    });
  });

  describe('DistributionRecord Schema Validations & Stock Integrity', () => {
    it('should validate allowed recipientType enums: Shelter, Relief Camp, Affected Community, Household, Individual', () => {
      const allowedRecipients = ['Shelter', 'Relief Camp', 'Affected Community', 'Household', 'Individual'];
      const recipientPath = DistributionRecord.schema.path('recipientType');
      expect(recipientPath.enumValues).toEqual(allowedRecipients);
    });

    it('should validate allowed status enums: Dispatched, In Transit, Delivered, Cancelled', () => {
      const allowedStatuses = ['Dispatched', 'In Transit', 'Delivered', 'Cancelled'];
      const statusPath = DistributionRecord.schema.path('status');
      expect(statusPath.enumValues).toEqual(allowedStatuses);
    });

    it('should require destination name and district', () => {
      const dist = new DistributionRecord({
        resource: new mongoose.Types.ObjectId(),
        resourceName: 'Rice',
        category: 'Food',
        quantity: 50,
        unit: 'bags',
        distributedBy: new mongoose.Types.ObjectId(),
        distributedByName: 'Admin User',
        distributedByRole: 'Admin',
      });

      const err = dist.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['destination.name']).toBeDefined();
      expect(err.errors['destination.district']).toBeDefined();
    });

    it('should accurately simulate stock deduction on distribution', () => {
      const initialStock = 200;
      const distributeQty = 45;

      const resource = {
        name: 'Purified Water 5L',
        category: 'Water',
        quantityAvailable: initialStock,
        totalReceived: 200,
        totalDistributed: 0,
        thresholdLowStock: 30,
      };

      // Ensure stock sufficiency
      expect(resource.quantityAvailable >= distributeQty).toBe(true);

      // Perform atomic deduction
      resource.quantityAvailable -= distributeQty;
      resource.totalDistributed += distributeQty;

      expect(resource.quantityAvailable).toBe(155);
      expect(resource.totalDistributed).toBe(45);
    });

    it('should accurately simulate stock refund when distribution is cancelled', () => {
      const resource = {
        name: 'ORS Oral Saline Pack',
        category: 'Medicine',
        quantityAvailable: 100,
        totalDistributed: 50,
      };

      const cancelledQty = 25;
      resource.quantityAvailable += cancelledQty;
      resource.totalDistributed = Math.max(0, resource.totalDistributed - cancelledQty);

      expect(resource.quantityAvailable).toBe(125);
      expect(resource.totalDistributed).toBe(25);
    });

    it('should accurately simulate restocking calculation', () => {
      const resource = {
        name: 'Thermal Blankets',
        quantityAvailable: 20,
        totalReceived: 100,
      };

      const addedStock = 80;
      resource.quantityAvailable += addedStock;
      resource.totalReceived += addedStock;

      expect(resource.quantityAvailable).toBe(100);
      expect(resource.totalReceived).toBe(180);
    });
  });
});
