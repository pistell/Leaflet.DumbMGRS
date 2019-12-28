import './styles.scss';
import * as mgrs from 'mgrs';
import L from 'leaflet';

console.log('hello world!');
console.log(L);


const map = L.map('map').setView([40.123503280320634, -77.74869918823244], 14);
L.tileLayer('https://c.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  id: 'osm_map',
}).addTo(map);
