const dummyLocations = [
  {
    id: 1,
    name: "Brooklyn Public Library",
    type: "library",
    address: "10 Grand Army Plaza, Brooklyn, NY",
    lat: 40.6725,
    lng: -73.9682,
    allowedFlyering: true,
    busyLevel: "medium",
  },
  {
    id: 2,
    name: "FedEx Office Print Center",
    type: "printer",
    address: "123 Flatbush Ave, Brooklyn, NY",
    lat: 40.6880,
    lng: -73.9800,
    allowedFlyering: false,
    busyLevel: "high",
  },
  {
    id: 3,
    name: "Community Help Center",
    type: "community_center",
    address: "50 Court St, Brooklyn, NY",
    lat: 40.6901,
    lng: -73.9917,
    allowedFlyering: true,
    busyLevel: "low",
  },
];

module.exports = dummyLocations;