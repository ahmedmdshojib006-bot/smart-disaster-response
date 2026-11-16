const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/resourceController');

const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/stats', protect, getResourceStats);
router.get('/distributions/history', protect, getDistributionHistory);
router.get('/', protect, getAllResources);
router.get('/:id', protect, getResourceById);

router.post('/', protect, requireRole(['Admin', 'NGO']), createResource);
router.put('/:id', protect, requireRole(['Admin', 'NGO']), updateResource);
router.post('/:id/restock', protect, requireRole(['Admin', 'NGO']), restockResource);
router.post('/distribute', protect, requireRole(['Admin', 'NGO']), recordDistribution);
router.put('/distributions/:id/status', protect, requireRole(['Admin', 'NGO']), updateDistributionStatus);


router.delete('/:id', protect, requireRole(['Admin']), deleteResource);

module.exports = router;
