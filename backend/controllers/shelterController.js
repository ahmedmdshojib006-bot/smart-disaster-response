const Shelter = require('../models/Shelter');

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

const getAllShelters = async (req, res) => {
  try {
    const { search, district, status, toilet, medicalCare, womenOnlySection, userLat, userLng } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
        { 'location.district': { $regex: search, $options: 'i' } },
      ];
    }

    if (district) {
      filter['location.district'] = { $regex: district, $options: 'i' };
    }

    if (status) {
      filter.status = status;
    }

    if (toilet === 'true') {
      filter['facilities.toilet'] = true;
    }

    if (medicalCare === 'true') {
      filter['facilities.medicalCare'] = true;
    }

    if (womenOnlySection === 'true') {
      filter['facilities.womenOnlySection'] = true;
    }

    let shelters = await Shelter.find(filter).lean();

    const uLat = parseFloat(userLat);
    const uLng = parseFloat(userLng);
    const hasUserCoords = !isNaN(uLat) && !isNaN(uLng);

    shelters = shelters.map((s) => {
      const availableSpots = Math.max(0, s.capacity.total - s.capacity.occupied);
      const occupancyRate = Math.round((s.capacity.occupied / s.capacity.total) * 100);
      let distanceKm = null;

      if (hasUserCoords && s.location?.latitude && s.location?.longitude) {
        distanceKm = calculateHaversineDistance(uLat, uLng, s.location.latitude, s.location.longitude);
      }

      return {
        ...s,
        availableSpots,
        occupancyRate,
        distanceKm,
      };
    });

    if (hasUserCoords) {
      shelters.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    } else {
      shelters.sort((a, b) => b.availableSpots - a.availableSpots);
    }

    return res.status(200).json({
      success: true,
      count: shelters.length,
      data: shelters,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving shelters.',
    });
  }
};

const getNearestShelter = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude coordinates are required.',
      });
    }

    const shelters = await Shelter.find({ status: { $ne: 'Closed' } }).lean();

    if (shelters.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No open shelters available at this time.',
      });
    }

    let nearest = null;
    let minDistance = Infinity;

    shelters.forEach((s) => {
      const available = s.capacity.total - s.capacity.occupied;
      if (s.location?.latitude && s.location?.longitude) {
        const dist = calculateHaversineDistance(lat, lng, s.location.latitude, s.location.longitude);
        if (available > 0 && dist < minDistance) {
          minDistance = dist;
          nearest = {
            ...s,
            distanceKm: dist,
            availableSpots: available,
            occupancyRate: Math.round((s.capacity.occupied / s.capacity.total) * 100),
          };
        }
      }
    });

    if (!nearest) {
      return res.status(404).json({
        success: false,
        message: 'All nearby shelters are currently at full capacity.',
      });
    }

    return res.status(200).json({
      success: true,
      data: nearest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error calculating nearest shelter.',
    });
  }
};

const getShelterById = async (req, res) => {
  try {
    const shelter = await Shelter.findById(req.params.id);
    if (!shelter) {
      return res.status(404).json({
        success: false,
        message: 'Shelter not found.',
      });
    }

    const availableSpots = Math.max(0, shelter.capacity.total - shelter.capacity.occupied);
    const occupancyRate = Math.round((shelter.capacity.occupied / shelter.capacity.total) * 100);

    return res.status(200).json({
      success: true,
      data: {
        ...shelter.toObject(),
        availableSpots,
        occupancyRate,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving shelter details.',
    });
  }
};

const createShelter = async (req, res) => {
  try {
    const { name, location, capacity, facilities, status, contactPerson, contactPhone, notes } = req.body;

    if (!name || !location?.latitude || !location?.longitude || !capacity?.total) {
      return res.status(422).json({
        success: false,
        message: 'Name, latitude, longitude, and total capacity are required.',
      });
    }

    const newShelter = new Shelter({
      name: name.trim(),
      location: {
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        address: location.address ? location.address.trim() : '',
        district: location.district ? location.district.trim() : '',
      },
      capacity: {
        total: parseInt(capacity.total, 10),
        occupied: parseInt(capacity.occupied || 0, 10),
      },
      facilities: {
        toilet: Boolean(facilities?.toilet),
        medicalCare: Boolean(facilities?.medicalCare),
        womenOnlySection: Boolean(facilities?.womenOnlySection),
        drinkingWater: facilities?.drinkingWater !== undefined ? Boolean(facilities.drinkingWater) : true,
        electricityBackup: Boolean(facilities?.electricityBackup),
      },
      status: status || 'Open',
      contactPerson: contactPerson ? contactPerson.trim() : '',
      contactPhone: contactPhone ? contactPhone.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    await newShelter.save();

    return res.status(201).json({
      success: true,
      message: 'Shelter created successfully.',
      data: newShelter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating shelter.',
    });
  }
};

const updateShelter = async (req, res) => {
  try {
    const { name, location, capacity, facilities, status, contactPerson, contactPhone, notes } = req.body;

    const shelter = await Shelter.findById(req.params.id);
    if (!shelter) {
      return res.status(404).json({
        success: false,
        message: 'Shelter not found.',
      });
    }

    if (name) shelter.name = name.trim();
    if (status) shelter.status = status;
    if (contactPerson !== undefined) shelter.contactPerson = contactPerson.trim();
    if (contactPhone !== undefined) shelter.contactPhone = contactPhone.trim();
    if (notes !== undefined) shelter.notes = notes.trim();

    if (location) {
      if (location.latitude !== undefined) shelter.location.latitude = parseFloat(location.latitude);
      if (location.longitude !== undefined) shelter.location.longitude = parseFloat(location.longitude);
      if (location.address !== undefined) shelter.location.address = location.address.trim();
      if (location.district !== undefined) shelter.location.district = location.district.trim();
    }

    if (capacity) {
      if (capacity.total !== undefined) shelter.capacity.total = parseInt(capacity.total, 10);
      if (capacity.occupied !== undefined) shelter.capacity.occupied = parseInt(capacity.occupied, 10);

      if (shelter.capacity.occupied >= shelter.capacity.total) {
        shelter.status = 'Full';
      } else if (shelter.status === 'Full' && shelter.capacity.occupied < shelter.capacity.total) {
        shelter.status = 'Open';
      }
    }

    if (facilities) {
      if (facilities.toilet !== undefined) shelter.facilities.toilet = Boolean(facilities.toilet);
      if (facilities.medicalCare !== undefined) shelter.facilities.medicalCare = Boolean(facilities.medicalCare);
      if (facilities.womenOnlySection !== undefined) shelter.facilities.womenOnlySection = Boolean(facilities.womenOnlySection);
      if (facilities.drinkingWater !== undefined) shelter.facilities.drinkingWater = Boolean(facilities.drinkingWater);
      if (facilities.electricityBackup !== undefined) shelter.facilities.electricityBackup = Boolean(facilities.electricityBackup);
    }

    await shelter.save();

    return res.status(200).json({
      success: true,
      message: 'Shelter updated successfully.',
      data: shelter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error updating shelter.',
    });
  }
};

const deleteShelter = async (req, res) => {
  try {
    const shelter = await Shelter.findByIdAndDelete(req.params.id);
    if (!shelter) {
      return res.status(404).json({
        success: false,
        message: 'Shelter not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Shelter deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error deleting shelter.',
    });
  }
};

module.exports = {
  getAllShelters,
  getNearestShelter,
  getShelterById,
  createShelter,
  updateShelter,
  deleteShelter,
};
