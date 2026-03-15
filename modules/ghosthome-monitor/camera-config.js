// Per-camera configuration store
// Seed with real device IDs once populated from NX Witness

const cameras = [
  // Example entry — replace with real data:
  // {
  //   deviceId: '{a1b2c3d4-e5f6-7890-abcd-ef1234567890}',
  //   label: 'Moreleta Park Pole 3 - Cam A',
  //   poleId: 'pole_003',
  //   expectActivity: true,
  //   quietThresholdHours: 2,
  // },
];

// Note: staleness detection is now handled by time-of-day logic in WF-03.
// expectActivity / quietThresholdHours are no longer used for staleness checks.
const defaults = {
  expectActivity: false,
  quietThresholdHours: 10,
};

function getCameraConfig(deviceId) {
  const cam = cameras.find(c => c.deviceId === deviceId);
  if (cam) return cam;
  return { deviceId, label: 'Unknown', poleId: null, ...defaults };
}

function getAllCameras() {
  return cameras;
}

module.exports = { getCameraConfig, getAllCameras };
