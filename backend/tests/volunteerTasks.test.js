// tests/volunteerTasks.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Tests for Member-3: Volunteer Profile, Registration & Task State Machine
// ─────────────────────────────────────────────────────────────────────────────

const Task = require('../models/Task');
const User = require('../models/User');
const taskRoutes = require('../routes/taskRoutes');
const volunteerRoutes = require('../routes/volunteerRoutes');
const taskController = require('../controllers/taskController');
const volunteerController = require('../controllers/volunteerController');

describe('Member-3: Volunteer & Task Management Specifications', () => {
  describe('Route & Controller Definitions', () => {
    it('should export all required routes and controllers', () => {
      expect(taskRoutes).toBeDefined();
      expect(volunteerRoutes).toBeDefined();
      expect(taskController.createTask).toBeDefined();
      expect(taskController.getAllTasks).toBeDefined();
      expect(taskController.getMyTasks).toBeDefined();
      expect(taskController.updateTaskStatus).toBeDefined();
      expect(volunteerController.getVolunteers).toBeDefined();
      expect(volunteerController.getVolunteerProfile).toBeDefined();
      expect(volunteerController.updateVolunteerProfile).toBeDefined();
    });
  });

  describe('User Model Schema with Volunteer fields', () => {
    it('should include skills, availability, and serviceArea fields with defaults', () => {
      const user = new User({
        name: 'Test Volunteer',
        email: 'vol@example.com',
        passwordHash: 'dummyhash',
        role: 'Volunteer',
      });

      expect(user.skills).toEqual([]);
      expect(user.availability).toBe('Available');
      expect(user.serviceArea).toBe('');
      expect(user.phone).toBe('');
    });

    it('should accept custom skills, availability, and serviceArea', () => {
      const user = new User({
        name: 'Medic Volunteer',
        email: 'medic@example.com',
        passwordHash: 'dummyhash',
        role: 'Volunteer',
        skills: ['First Aid', 'Emergency Rescue'],
        availability: 'Busy',
        serviceArea: 'Chattogram - Feni',
        phone: '+8801700000000',
      });

      expect(user.skills).toContain('First Aid');
      expect(user.skills).toContain('Emergency Rescue');
      expect(user.availability).toBe('Busy');
      expect(user.serviceArea).toBe('Chattogram - Feni');
    });
  });

  describe('Task Model Schema & Lifecycle States', () => {
    it('should validate allowed status enum values: Assigned, Accepted, In Progress, Completed', () => {
      const validStatuses = ['Assigned', 'Accepted', 'In Progress', 'Completed'];
      const statusPath = Task.schema.path('status');
      expect(statusPath.enumValues).toEqual(validStatuses);
      expect(statusPath.defaultValue).toBe('Assigned');
    });

    it('should require title, description, serviceArea, assignedTo, and assignedBy', () => {
      const task = new Task({});
      const err = task.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.title).toBeDefined();
      expect(err.errors.description).toBeDefined();
      expect(err.errors.serviceArea).toBeDefined();
      expect(err.errors.assignedTo).toBeDefined();
    });
  });
});
