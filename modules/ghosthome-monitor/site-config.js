// Pole-to-ER605 router mapping
// Seed with real data once populated

const sites = [
  // Example entry — replace with real data:
  // {
  //   poleId: 'pole_003',
  //   label: 'Moreleta Park Pole 3',
  //   omadaMac: 'AA:BB:CC:DD:EE:FF',
  //   omadaSiteId: 'site_uuid',
  //   hostName: 'John Smith',
  //   hostWhatsapp: '+27821234567',
  //   cameraIds: ['{nx-uuid-1}', '{nx-uuid-2}'],
  // },
];

function getSiteByPoleId(poleId) {
  return sites.find(s => s.poleId === poleId) || null;
}

function getSiteByDeviceId(deviceId) {
  return sites.find(s => s.cameraIds && s.cameraIds.includes(deviceId)) || null;
}

function getAllSites() {
  return sites;
}

module.exports = { getSiteByPoleId, getSiteByDeviceId, getAllSites };
