const SOSRequest = require('../models/SOSRequest');
const Shelter = require('../models/Shelter');
const HazardZone = require('../models/HazardZone');
const HazardReport = require('../models/HazardReport');
const ReliefCamp = require('../models/ReliefCamp');

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
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
};

const getAllMapData = async (req, res) => {
  try {
    const { status, district } = req.query;

    const sosFilter = { status: { $nin: ['Cancelled'] } };
    const shelterFilter = {};
    const hazardFilter = { status: { $in: ['Active', 'Warning', 'Monitored'] } };
    const crowdHazardFilter = { status: { $in: ['Pending', 'Community Verified', 'Verified'] } };
    const reliefFilter = { status: { $in: ['Active', 'Depleted'] } };

    if (status && status !== 'All') {
      sosFilter.status = status;
    }
    if (district && district !== 'All') {
      sosFilter['location.district'] = new RegExp(district, 'i');
      shelterFilter['location.district'] = new RegExp(district, 'i');
      hazardFilter['location.district'] = new RegExp(district, 'i');
      crowdHazardFilter['location.district'] = new RegExp(district, 'i');
      reliefFilter['location.district'] = new RegExp(district, 'i');
    }

    const [sosList, shelterList, hazardList, crowdHazardList, reliefList] = await Promise.all([
      SOSRequest.find(sosFilter)
        .populate('victim', 'name email')
        .populate('assignedVolunteer', 'name email')
        .sort({ priorityScore: -1, createdAt: -1 })
        .lean(),
      Shelter.find(shelterFilter).lean(),
      HazardZone.find(hazardFilter).sort({ severity: 1, createdAt: -1 }).lean(),
      HazardReport.find(crowdHazardFilter)
        .populate('reporter', 'name role trustScore')
        .sort({ credibilityScore: -1, createdAt: -1 })
        .lean(),
      ReliefCamp.find(reliefFilter).sort({ createdAt: -1 }).lean(),
    ]);

    const sosMarkers = sosList
      .filter((s) => s.location?.latitude && s.location?.longitude)
      .map((s) => ({
        id: s._id,
        type: 'sos',
        lat: s.location.latitude,
        lng: s.location.longitude,
        title: `SOS #${s._id.toString().slice(-6).toUpperCase()}`,
        priorityScore: s.priorityScore || 50,
        priority: s.priority || 'High',
        status: s.status,
        needs: s.needs || [],
        numberOfPeople: s.numberOfPeople || 1,
        vulnerabilities: s.vulnerabilities || { children: 0, elderly: 0, pregnantWomen: 0, injured: 0 },
        address: s.location.address || '',
        district: s.location.district || '',
        description: s.description || '',
        photoUrl: s.photoUrl || null,
        victimName: s.victim?.name || 'Anonymous Citizen',
        volunteerName: s.assignedVolunteer?.name || null,
        createdAt: s.createdAt,
      }));

    const shelterMarkers = shelterList
      .filter((sh) => sh.location?.latitude && sh.location?.longitude)
      .map((sh) => {
        const available = Math.max(0, (sh.capacity?.total || 0) - (sh.capacity?.occupied || 0));
        return {
          id: sh._id,
          type: 'shelter',
          lat: sh.location.latitude,
          lng: sh.location.longitude,
          title: sh.name,
          capacity: sh.capacity,
          availableSpots: available,
          facilities: sh.facilities || {},
          status: sh.status || 'Open',
          address: sh.location.address || '',
          district: sh.location.district || '',
          contactPerson: sh.contactPerson || '',
          contactPhone: sh.contactPhone || '',
          notes: sh.notes || '',
        };
      });

    const hazardMarkers = hazardList
      .filter((h) => h.location?.latitude && h.location?.longitude)
      .map((h) => ({
        id: h._id,
        type: 'hazard',
        lat: h.location.latitude,
        lng: h.location.longitude,
        title: h.name,
        hazardType: h.hazardType,
        severity: h.severity,
        status: h.status,
        radiusMeters: h.radiusMeters || 1500,
        waterLevelFeet: h.waterLevelFeet || 0,
        address: h.location.address || '',
        district: h.location.district || '',
        description: h.description || '',
        createdAt: h.createdAt,
      }));

    const reliefMarkers = reliefList
      .filter((rc) => rc.location?.latitude && rc.location?.longitude)
      .map((rc) => ({
        id: rc._id,
        type: 'reliefCamp',
        lat: rc.location.latitude,
        lng: rc.location.longitude,
        title: rc.name,
        operatingAgency: rc.operatingAgency,
        itemsAvailable: rc.itemsAvailable || [],
        dailyCapacityBeneficiaries: rc.dailyCapacityBeneficiaries || 500,
        status: rc.status,
        contactPerson: rc.contactPerson || '',
        contactPhone: rc.contactPhone || '',
        address: rc.location.address || '',
        district: rc.location.district || '',
        notes: rc.notes || '',
      }));

    const crowdHazardMarkers = crowdHazardList
      .filter((hr) => hr.location?.latitude && hr.location?.longitude)
      .map((hr) => ({
        id: hr._id,
        type: 'hazardReport',
        lat: hr.location.latitude,
        lng: hr.location.longitude,
        title: hr.title,
        hazardType: hr.hazardType,
        severity: hr.severity,
        status: hr.status,
        waterDepthFeet: hr.waterDepthFeet || 0,
        roadPassable: Boolean(hr.roadPassable),
        address: hr.location.address || '',
        district: hr.location.district || '',
        description: hr.description || '',
        photoUrl: hr.photoUrl || null,
        credibilityScore: hr.credibilityScore ?? 50,
        upvoteCount: (hr.upvotes || []).length,
        verificationCount: (hr.verifications || []).length,
        reporterName: hr.reporter?.name || hr.reporterName || 'Citizen',
        reporterTrustScore: hr.reporter?.trustScore ?? hr.reporterTrustSnapshot ?? 50,
        createdAt: hr.createdAt,
      }));

    const stats = {
      totalSOS: sosMarkers.length,
      criticalSOS: sosMarkers.filter((s) => s.priorityScore >= 70).length,
      highSOS: sosMarkers.filter((s) => s.priorityScore >= 45 && s.priorityScore < 70).length,
      pendingSOS: sosMarkers.filter((s) => s.status === 'Pending').length,
      totalShelters: shelterMarkers.length,
      availableShelterSpots: shelterMarkers.reduce((sum, s) => sum + s.availableSpots, 0),
      activeHazards: hazardMarkers.length + crowdHazardMarkers.length,
      crowdsourcedHazards: crowdHazardMarkers.length,
      activeReliefCamps: reliefMarkers.length,
    };

    return res.status(200).json({
      success: true,
      stats,
      data: {
        sosRequests: sosMarkers,
        shelters: shelterMarkers,
        hazardZones: hazardMarkers,
        hazardReports: crowdHazardMarkers,
        reliefCamps: reliefMarkers,
      },
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve live disaster map data.',
    });
  }
};

const getNearbyMapData = async (req, res) => {
  try {
    const { lat, lng, radius = 15, types } = req.query;

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusKm = Math.min(100, Math.max(0.5, parseFloat(radius) || 15));
    const radiusMeters = radiusKm * 1000;

    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS latitude and longitude coordinates are required for nearby search.',
      });
    }

    const point = {
      type: 'Point',
      coordinates: [lngNum, latNum],
    };

    const typeFilter = types ? types.split(',').map((t) => t.trim().toLowerCase()) : null;

    const queries = [];

    if (!typeFilter || typeFilter.includes('sos')) {
      queries.push(
        SOSRequest.find({
          status: { $nin: ['Cancelled'] },
          'location.coordinates': {
            $near: {
              $geometry: point,
              $maxDistance: radiusMeters,
            },
          },
        })
          .populate('victim', 'name email')
          .populate('assignedVolunteer', 'name email')
          .limit(100)
          .lean()
          .then((docs) =>
            docs.map((doc) => ({
              ...doc,
              entityType: 'sos',
              distanceKm: calculateDistanceKm(latNum, lngNum, doc.location.latitude, doc.location.longitude),
            }))
          )
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    if (!typeFilter || typeFilter.includes('shelters') || typeFilter.includes('shelter')) {
      queries.push(
        Shelter.find({
          'location.coordinates': {
            $near: {
              $geometry: point,
              $maxDistance: radiusMeters,
            },
          },
        })
          .limit(50)
          .lean()
          .then((docs) =>
            docs.map((doc) => ({
              ...doc,
              entityType: 'shelter',
              availableSpots: Math.max(0, (doc.capacity?.total || 0) - (doc.capacity?.occupied || 0)),
              distanceKm: calculateDistanceKm(latNum, lngNum, doc.location.latitude, doc.location.longitude),
            }))
          )
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    if (!typeFilter || typeFilter.includes('hazards') || typeFilter.includes('hazard')) {
      queries.push(
        HazardZone.find({
          status: { $in: ['Active', 'Warning', 'Monitored'] },
          'location.coordinates': {
            $near: {
              $geometry: point,
              $maxDistance: radiusMeters,
            },
          },
        })
          .limit(50)
          .lean()
          .then((docs) =>
            docs.map((doc) => ({
              ...doc,
              entityType: 'hazard',
              distanceKm: calculateDistanceKm(latNum, lngNum, doc.location.latitude, doc.location.longitude),
            }))
          )
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    if (!typeFilter || typeFilter.includes('reliefcamps') || typeFilter.includes('relief')) {
      queries.push(
        ReliefCamp.find({
          status: { $in: ['Active', 'Depleted'] },
          'location.coordinates': {
            $near: {
              $geometry: point,
              $maxDistance: radiusMeters,
            },
          },
        })
          .limit(50)
          .lean()
          .then((docs) =>
            docs.map((doc) => ({
              ...doc,
              entityType: 'reliefCamp',
              distanceKm: calculateDistanceKm(latNum, lngNum, doc.location.latitude, doc.location.longitude),
            }))
          )
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    if (!typeFilter || typeFilter.includes('hazards') || typeFilter.includes('hazard') || typeFilter.includes('hazardreports')) {
      queries.push(
        HazardReport.find({
          status: { $in: ['Pending', 'Community Verified', 'Verified'] },
          'location.coordinates': {
            $near: {
              $geometry: point,
              $maxDistance: radiusMeters,
            },
          },
        })
          .populate('reporter', 'name role trustScore')
          .limit(50)
          .lean()
          .then((docs) =>
            docs.map((doc) => ({
              ...doc,
              entityType: 'hazardReport',
              distanceKm: calculateDistanceKm(latNum, lngNum, doc.location.latitude, doc.location.longitude),
            }))
          )
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    const [nearbySOS, nearbyShelters, nearbyHazards, nearbyReliefCamps, nearbyHazardReports] = await Promise.all(queries);

    return res.status(200).json({
      success: true,
      query: {
        center: { latitude: latNum, longitude: lngNum },
        radiusKm,
        totalFound:
          nearbySOS.length + nearbyShelters.length + nearbyHazards.length + nearbyReliefCamps.length + nearbyHazardReports.length,
      },
      data: {
        sosRequests: nearbySOS,
        shelters: nearbyShelters,
        hazardZones: nearbyHazards,
        hazardReports: nearbyHazardReports,
        reliefCamps: nearbyReliefCamps,
      },
    });
  } catch (error) {
    console.error('Error executing 2dsphere nearby query:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Geospatial query failed.',
    });
  }
};

const createHazardZone = async (req, res) => {
  try {
    const {
      name,
      hazardType,
      severity,
      latitude,
      longitude,
      address,
      district,
      radiusMeters,
      waterLevelFeet,
      description,
    } = req.body;

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS latitude and longitude are required for hazard reporting.',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Hazard zone name/title is required.',
      });
    }

    const hazard = new HazardZone({
      name: name.trim(),
      hazardType: hazardType || 'Flood',
      severity: severity || 'High',
      location: {
        type: 'Point',
        coordinates: [lngNum, latNum],
        latitude: latNum,
        longitude: lngNum,
        address: address ? String(address).trim() : '',
        district: district ? String(district).trim() : '',
      },
      radiusMeters: Math.max(50, parseInt(radiusMeters, 10) || 1500),
      waterLevelFeet: Math.max(0, parseFloat(waterLevelFeet) || 0),
      description: description ? String(description).trim() : '',
      reportedBy: req.user?._id || null,
      status: 'Active',
    });

    await hazard.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('hazard:created', hazard);
    }

    return res.status(201).json({
      success: true,
      message: 'Hazard zone successfully recorded and published to live disaster map.',
      data: hazard,
    });
  } catch (error) {
    console.error('Error creating hazard zone:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create hazard zone.',
    });
  }
};

const createReliefCamp = async (req, res) => {
  try {
    const {
      name,
      operatingAgency,
      latitude,
      longitude,
      address,
      district,
      itemsAvailable,
      dailyCapacityBeneficiaries,
      contactPerson,
      contactPhone,
      notes,
    } = req.body;

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS latitude and longitude are required.',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Relief camp name is required.',
      });
    }

    let items = [];
    if (Array.isArray(itemsAvailable)) {
      items = itemsAvailable;
    } else if (typeof itemsAvailable === 'string') {
      try {
        items = JSON.parse(itemsAvailable);
      } catch {
        items = itemsAvailable.split(',').map((i) => i.trim()).filter(Boolean);
      }
    }

    const camp = new ReliefCamp({
      name: name.trim(),
      operatingAgency: operatingAgency ? String(operatingAgency).trim() : 'District Relief Committee',
      location: {
        type: 'Point',
        coordinates: [lngNum, latNum],
        latitude: latNum,
        longitude: lngNum,
        address: address ? String(address).trim() : '',
        district: district ? String(district).trim() : '',
      },
      itemsAvailable: items,
      dailyCapacityBeneficiaries: Math.max(1, parseInt(dailyCapacityBeneficiaries, 10) || 500),
      contactPerson: contactPerson ? String(contactPerson).trim() : '',
      contactPhone: contactPhone ? String(contactPhone).trim() : '',
      notes: notes ? String(notes).trim() : '',
      status: 'Active',
    });

    await camp.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('reliefCamp:created', camp);
    }

    return res.status(201).json({
      success: true,
      message: 'Relief camp registered successfully.',
      data: camp,
    });
  } catch (error) {
    console.error('Error creating relief camp:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create relief camp.',
    });
  }
};

module.exports = {
  getAllMapData,
  getNearbyMapData,
  createHazardZone,
  createReliefCamp,
};
