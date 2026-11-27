const MissingPerson = require('../models/MissingPerson');
let Shelter = null;
try {
  Shelter = require('../models/Shelter');
} catch (e) {
  
}

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
const getAllMissingPersons = async (req, res) => {
  try {
    const { search, status, district, gender, limit } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { fullName: { $regex: term, $options: 'i' } },
        { physicalDescription: { $regex: term, $options: 'i' } },
        { 'lastSeenLocation.landmark': { $regex: term, $options: 'i' } },
        { 'lastSeenLocation.district': { $regex: term, $options: 'i' } },
        { 'contactPerson.name': { $regex: term, $options: 'i' } },
      ];
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (district && district !== 'All') {
      filter['lastSeenLocation.district'] = { $regex: district, $options: 'i' };
    }

    if (gender && gender !== 'All') {
      filter.gender = gender;
    }

    const maxLimit = Math.min(100, parseInt(limit, 10) || 50);

    const reports = await MissingPerson.find(filter)
      .populate('reportedBy', 'name email role')
      .populate('safetyUpdate.rescueShelter', 'name location capacity')
      .sort({ status: -1, createdAt: -1 }) // Missing first, then newest
      .limit(maxLimit)
      .lean();

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error('Error fetching missing person reports:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve missing persons list',
      error: error.message,
    });
  }
};
const getMissingPersonStats = async (req, res) => {
  try {
    const allReports = await MissingPerson.find().lean();

    let totalMissing = 0;
    let totalFoundSafe = 0;
    const districtCountMap = {};

    allReports.forEach((r) => {
      if (r.status === 'Missing') totalMissing++;
      if (r.status === 'Found / Safe') totalFoundSafe++;

      const dist = r.lastSeenLocation?.district || 'Unknown';
      districtCountMap[dist] = (districtCountMap[dist] || 0) + 1;
    });

    const topDistricts = Object.keys(districtCountMap)
      .map((d) => ({ district: d, count: districtCountMap[d] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const recentFound = await MissingPerson.find({ status: 'Found / Safe' })
      .sort({ 'safetyUpdate.markedSafeAt': -1 })
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      stats: {
        totalReports: allReports.length,
        totalMissing,
        totalFoundSafe,
        reunificationRate: allReports.length > 0 ? Math.round((totalFoundSafe / allReports.length) * 100) : 0,
        topDistricts,
        recentFound,
      },
    });
  } catch (error) {
    console.error('Error calculating missing persons stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to compute missing persons statistics',
      error: error.message,
    });
  }
};
const getMissingPersonById = async (req, res) => {
  try {
    const person = await MissingPerson.findById(req.params.id)
      .populate('reportedBy', 'name email role')
      .populate('safetyUpdate.rescueShelter', 'name location')
      .lean();

    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Missing person record not found',
      });
    }

    return res.status(200).json({
      success: true,
      person,
    });
  } catch (error) {
    console.error('Error fetching missing person details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve missing person record',
      error: error.message,
    });
  }
};
const reportMissingPerson = async (req, res) => {
  try {
    const {
      fullName,
      age,
      gender,
      district,
      upazila,
      landmark,
      latitude,
      longitude,
      lastSeenDate,
      physicalDescription,
      medicalNeeds,
      contactName,
      contactRelationship,
      contactPhone,
      contactAltPhone,
      photoUrl,
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Missing person full name is required' });
    }
    if (age === undefined || age === null || age === '') {
      return res.status(400).json({ success: false, message: 'Age is required' });
    }
    if (!gender) {
      return res.status(400).json({ success: false, message: 'Gender is required' });
    }
    if (!district || !district.trim()) {
      return res.status(400).json({ success: false, message: 'Last seen district is required' });
    }
    if (!landmark || !landmark.trim()) {
      return res.status(400).json({ success: false, message: 'Last seen landmark or area is required' });
    }
    if (!contactName || !contactName.trim() || !contactPhone || !contactPhone.trim()) {
      return res.status(400).json({ success: false, message: 'Contact person name and telephone number are required' });
    }
    let finalPhotoUrl = photoUrl && photoUrl.trim() ? photoUrl.trim() : null;
    if (req.file) {
      finalPhotoUrl = `/uploads/${req.file.filename}`;
    }

    const newPerson = new MissingPerson({
      fullName: fullName.trim(),
      age: Math.max(0, parseInt(age, 10)),
      gender,
      photoUrl: finalPhotoUrl,
      lastSeenLocation: {
        district: district.trim(),
        upazila: upazila ? upazila.trim() : '',
        landmark: landmark.trim(),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
      lastSeenDate: lastSeenDate ? new Date(lastSeenDate) : new Date(),
      physicalDescription: physicalDescription ? physicalDescription.trim() : '',
      medicalNeeds: medicalNeeds ? medicalNeeds.trim() : '',
      status: 'Missing',
      contactPerson: {
        name: contactName.trim(),
        relationship: contactRelationship ? contactRelationship.trim() : 'Relative',
        phone: contactPhone.trim(),
        altPhone: contactAltPhone ? contactAltPhone.trim() : '',
      },
      reportedBy: req.user?._id || null,
      reportedByName: req.user?.name || 'Concerned Citizen',
    });

    await newPerson.save();

    broadcastSocket(req, 'missing-person:reported', {
      personId: newPerson._id,
      fullName: newPerson.fullName,
      age: newPerson.age,
      gender: newPerson.gender,
      district: newPerson.lastSeenLocation.district,
      landmark: newPerson.lastSeenLocation.landmark,
      photoUrl: newPerson.photoUrl,
    });

    return res.status(201).json({
      success: true,
      message: 'Missing person report registered successfully',
      person: newPerson,
    });
  } catch (error) {
    console.error('Error reporting missing person:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit missing person report',
    });
  }
};
const markPersonSafe = async (req, res) => {
  try {
    const { foundLocation, rescueShelterId, notes } = req.body;

    const person = await MissingPerson.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Missing person report not found' });
    }

    if (person.status === 'Found / Safe') {
      return res.status(400).json({ success: false, message: 'This person has already been marked as Safe' });
    }

    let shelterName = '';
    if (rescueShelterId && Shelter) {
      try {
        const shelterDoc = await Shelter.findById(rescueShelterId);
        if (shelterDoc) {
          shelterName = shelterDoc.name;
        }
      } catch (e) {
    
      }
    }

    person.status = 'Found / Safe';
    person.safetyUpdate = {
      markedSafeAt: new Date(),
      markedSafeBy: req.user?._id || null,
      markedSafeByName: req.user?.name || 'Verified Responder',
      foundLocation: foundLocation && foundLocation.trim() ? foundLocation.trim() : 'Relief shelter / Family home',
      rescueShelter: rescueShelterId || null,
      rescueShelterName: shelterName,
      notes: notes && notes.trim() ? notes.trim() : 'Safely reunited with family members.',
    };

    await person.save();

    broadcastSocket(req, 'missing-person:marked-safe', {
      personId: person._id,
      fullName: person.fullName,
      foundLocation: person.safetyUpdate.foundLocation,
      markedSafeByName: person.safetyUpdate.markedSafeByName,
      markedSafeAt: person.safetyUpdate.markedSafeAt,
      shelterName,
    });

    return res.status(200).json({
      success: true,
      message: `🎉 Great news! ${person.fullName} has been marked as Safe and Reunited.`,
      person,
    });
  } catch (error) {
    console.error('Error marking person safe:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update safety status',
      error: error.message,
    });
  }
};
const updateMissingPerson = async (req, res) => {
  try {
    const person = await MissingPerson.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Missing person report not found' });
    }
    if (
      req.user &&
      req.user.role !== 'Admin' &&
      person.reportedBy &&
      person.reportedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this report' });
    }

    const {
      fullName,
      age,
      gender,
      district,
      upazila,
      landmark,
      physicalDescription,
      medicalNeeds,
      contactName,
      contactRelationship,
      contactPhone,
      contactAltPhone,
      photoUrl,
    } = req.body;

    if (fullName) person.fullName = fullName.trim();
    if (age !== undefined) person.age = Math.max(0, parseInt(age, 10));
    if (gender) person.gender = gender;
    if (district) person.lastSeenLocation.district = district.trim();
    if (upazila !== undefined) person.lastSeenLocation.upazila = upazila.trim();
    if (landmark) person.lastSeenLocation.landmark = landmark.trim();
    if (physicalDescription !== undefined) person.physicalDescription = physicalDescription.trim();
    if (medicalNeeds !== undefined) person.medicalNeeds = medicalNeeds.trim();
    if (contactName) person.contactPerson.name = contactName.trim();
    if (contactRelationship) person.contactPerson.relationship = contactRelationship.trim();
    if (contactPhone) person.contactPerson.phone = contactPhone.trim();
    if (contactAltPhone !== undefined) person.contactPerson.altPhone = contactAltPhone.trim();

    if (req.file) {
      person.photoUrl = `/uploads/${req.file.filename}`;
    } else if (photoUrl !== undefined) {
      person.photoUrl = photoUrl.trim() || null;
    }

    await person.save();

    broadcastSocket(req, 'missing-person:updated', { personId: person._id, fullName: person.fullName });

    return res.status(200).json({
      success: true,
      message: 'Report updated successfully',
      person,
    });
  } catch (error) {
    console.error('Error updating missing person:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update missing person report',
    });
  }
};
const deleteMissingPerson = async (req, res) => {
  try {
    const person = await MissingPerson.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (
      req.user &&
      req.user.role !== 'Admin' &&
      person.reportedBy &&
      person.reportedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this report' });
    }

    await MissingPerson.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Report for "${person.fullName}" has been removed`,
    });
  } catch (error) {
    console.error('Error deleting missing person report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete report',
      error: error.message,
    });
  }
};

module.exports = {
  getAllMissingPersons,
  getMissingPersonStats,
  getMissingPersonById,
  reportMissingPerson,
  markPersonSafe,
  updateMissingPerson,
  deleteMissingPerson,
};
