const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markOneRead,
  markAllRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getNotifications);

router.patch('/read-all', markAllRead);

router.patch('/:id/read', markOneRead);

module.exports = router;
