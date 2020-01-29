/* eslint-disable no-console */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */
// Import stylesheets
import './styles.scss';
// Import Leaflet
import L from 'leaflet';
// Import the default marker icons from leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
// LLtoUTM and UTMtoLL aren't exported in the original mgrs.js, fork it and import them
// https://github.com/proj4js/mgrs/issues/10
import {
  forward, getLetterDesignator, inverse, toPoint, get100kSetForZone, get100kID, LLtoUTM, UTMtoLL, decode, encode, UTMtoMGRS,
} from './mgrs';
import { northingDict, eastingDict } from './gzdObject';

// *********************************************************************************** //
// * Global Vars/Leaflet setup/Predefined coordinates                                * //
// *********************************************************************************** //
// This coordinate has 3 visible Grid Zone Designator boundaries at zoom level 7 with no northing GZD
const ontarioCA = [51.84935276370605, -86.27563476562501]; // ? 262 child elements
// This coordinate has 6 visible Grid Zone Designator boundaries at zoom level 7
const southNY = [42.285437007491545, -75.04211425781251]; // ? 800 child elements
// This coordinate has 4 visible Grid Zone Designator boundaries within view
const southPA = [40.001780202770966, -78.0005693435669]; // ? 616 child elements
// For some reason the Florida map view generates a ton of child elements
const southFL = [27.381523191705053, -82.82592773437501]; // ? 2235 child elements
const honduras = [14.83861155338482, -87.45117187500001]; // ? 1272 child elements
const norway = [64.27322328178597, 5.603027343750001]; // ? 352 child elements
const iceland = [64.94216049820734, -19.797363281250004]; // ? 140 child elements on 18JAN, 132 elements on 21JAN
const northOfSvalbard = [83.02621885344846, 15.402832031250002]; // use zoom 6
const quito = [0.17578097424708533, -77.84912109375];
const map = L.map('map').setView({ lat: 44.06588017158586, lng: -76.11911773681642 }, 13);
const cc = document.querySelector('.cursorCoordinates');
window.map = map;
// Just a quicker way to add a marker, used for debugging purposes
function mark(element) {
  const marker = new L.marker(element);
  const markerLat = marker.getLatLng().lat;
  const markerLng = marker.getLatLng().lng;
  const markerNorthing = LLtoUTM({ lat: markerLat, lon: markerLng }).northing;
  const markerEasting = LLtoUTM({ lat: markerLat, lon: markerLng }).easting;
  const markerZoneletter = LLtoUTM({ lat: markerLat, lon: markerLng }).zoneLetter;
  const markerZoneNumber = LLtoUTM({ lat: markerLat, lon: markerLng }).zoneNumber;
  const popupContent = `<h3><u>Lat:</u> ${markerLat.toFixed(6)} <u>Lng:</u> ${markerLng.toFixed(6)}</h3>
                        <h3><u>Northing:</u> ${markerNorthing}</h3>
                        <h3><u>Easting:</u> ${markerEasting}</h3>
                        <h3><u>Zone Letter:</u> ${markerZoneletter}</h3>
                        <h3><u>Zone Number:</u> ${markerZoneNumber}</h3>`;
  marker.bindPopup(popupContent).openPopup();
  return marker.addTo(map);
}

// *********************************************************************************** //
// * Enable default images in the marker                                             * //
// *********************************************************************************** //
// https://github.com/Leaflet/Leaflet/issues/4968#issuecomment-264311098
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  // icon is 25x41 pixels, so adjust anchor point
  iconAnchor: [12.5, 41],
  popupAnchor: [0, -41],
});

// Set the default marker icon to the constants provided above
L.Marker.prototype.options.icon = DefaultIcon;

// *********************************************************************************** //
// * Add the Leaflet map to the page                                                 * //
// *********************************************************************************** //
L.tileLayer('https://c.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  id: 'osm_map',
}).addTo(map);

// *********************************************************************************** //
// * Update the MGRS coordinates when the mouse cursor moves (For accuracy checking) * //
// *********************************************************************************** //
map.addEventListener('mousemove', (event) => {
  // Display cursor coordinates in MGRS
  cc.querySelector('.mgrsInfo').innerHTML = `${UTMtoMGRS(LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }), 5, true)}`;
  // Display cursor coordinates in Latitude/Longitude
  cc.querySelector('.latInfo').innerHTML = `${event.latlng.lat.toFixed(8)}`;
  cc.querySelector('.lonInfo').innerHTML = `${event.latlng.lng.toFixed(8)}`;
  // Display cursor coordinates in Easting/Northing
  cc.querySelector('.eastingInfo').innerHTML = `${LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }).easting}`;
  cc.querySelector('.northingInfo').innerHTML = `${LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }).northing}`;
});


// *********************************************************************************** //
// * Leaflet DumbMGRS Plugin - Grid Zone Designators (This works just fine)          * //
// *********************************************************************************** //
class GZD extends L.LayerGroup {
  constructor(northObj, eastObj) {
    super();
    this.northObj = northObj;
    this.eastObj = eastObj;
    this.viz = [];
    return this.getInBoundsGZDs();
  }

  // Find all the Grid Zone Designators that are in your view
  getInBoundsGZDs() {
    // Do not create GZDs if the map is zoomed out at 4 or below
    if (map.getZoom() <= 3) { return; }
    // Combined the northingDict and eastingDict into one object
    const combinedObj = { ...this.northObj, ...this.eastObj };
    // Create an array to store the inBounds values for letter,top, and bottom
    const inBoundsLatitudeLetters = [];
    // Create an array to store the inBounds values for top, right, and id
    const inBoundsUTMNumbers = [];
    this.viz = [];
    const currentVisibleBounds = map.getBounds();

    Object.values(combinedObj).forEach((key) => {
      const { top } = key;
      const { bottom } = key;
      const { left } = key;
      const { right } = key;
      const { id } = key;

      // Since we don't want to create grids for what we can't see this returns all the valid inBounds properties in the northingDict
      if (currentVisibleBounds.getNorthEast().lat >= bottom && currentVisibleBounds.getSouthWest().lat <= top) {
        inBoundsLatitudeLetters.push(key);
      }
      // Same thing here but it returns the valid inBounds properties for the eastingDict
      if (currentVisibleBounds.getNorthEast().lng >= left && currentVisibleBounds.getSouthWest().lng <= right) {
        inBoundsUTMNumbers.push({ left, right, id });
      }
    });

    // Define the "id" property in this object so we can store all the values returned from inBoundsUTMNumbers
    inBoundsLatitudeLetters.forEach((e) => {
      const letterKey = e;
      Object.defineProperties(letterKey, {
        id: {
          value: inBoundsUTMNumbers.map((j) => j),
          writable: true,
        },
      });
    });

    // Iterate over all the returned values and instantiate the class to create the grids
    Object.values(inBoundsLatitudeLetters).forEach((key) => {
      const letterID = key.letter;
      const { top } = key;
      const { bottom } = key;

      for (let index = 0; index < key.id.length; index += 1) {
        const element = key.id[index];
        const { left } = element;
        const { right } = element;
        let { id } = element;
        // This appends the number "0" to GZDs with an ID of less than 10
        // Without it the grids won't load since the ids will be parsed as a number
        // (eg- "01W" will default to "1W" which is invalid)
        if (id < 10) {
          id = `0${id}`;
        }
        this.buildGZD({
          top,
          bottom,
          letterID,
          left,
          right,
          id,
        });
      }
    });
  }


  buildGZD(params) {
    this.params = params;
    // Adjust coordinates for special GZDs around Norway and Svalbard
    const exceptionZones = `${this.params.id}${this.params.letterID}`;
    switch (exceptionZones) {
      case '31X':
        this.params.right = 9;
        break;
      case '32X':
        return;
      case '33X':
        this.params.left = 9;
        this.params.right = 21;
        break;
      case '34X':
        return;
      case '35X':
        this.params.left = 21;
        this.params.right = 33;
        break;
      case '36X':
        return;
      case '37X':
        this.params.left = 33;
        break;
      case '31V':
        this.params.right = 3;
        break;
      case '32V':
        this.params.left = 3;
        break;
      default:
        break;
    }
    // This is where the 100k grids gets it's data from
    this.viz.push({
      top: this.params.top,
      bottom: this.params.bottom,
      letterID: this.params.letterID,
      left: this.params.left,
      right: this.params.right,
      id: this.params.id,
    });

    const topLeft = new L.LatLng(this.params.top, this.params.left);
    const topRight = new L.LatLng(this.params.top, this.params.right);
    const bottomRight = new L.LatLng(this.params.bottom, this.params.right);
    // const bottomLeft = new L.LatLng(this.params.bottom, this.params.left);
    // We do not need bottomLeft and topLeft on the gzdBox, since they just overlap anyways
    const gzdBox = [topLeft, topRight, bottomRight];
    const gzdPolylineBox = new L.Polyline(gzdBox, {
      color: 'red',
      weight: 5,
      opacity: 0.5,
      smoothFactor: 1,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
      noClip: true,
      // Keep interactive false, else the symbols cannot be dropped on polylines
      interactive: false,
      // className: `gzd_${this.params.id}${this.params.letterID}`,
    });

    const gzdPolylineBounds = gzdPolylineBox.getBounds();
    const gzdIdSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Once the polylines are added to the map we can begin centering the Grid Zone Designator
    gzdIdSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Put this into an event listener where if the map zoom is <=7, adjust viewBox to '0 0 200 100' or something
    gzdIdSVG.setAttribute('viewBox', '75 50 50 50');
    gzdIdSVG.innerHTML = `
        <rect width="200" height="100" fill="salmon" stroke="black" stroke-width="1" fill-opacity="0.5"/>
        <text x="100" y="50" fill="black" font-weight="bold" font-family="Arial" font-size="80" text-anchor="middle" dominant-baseline="central">${this.params.id}${this.params.letterID}</text>`;
    // Get the difference between the north east and southwest latitudes/longitudes and divide by 2
    const halfLat = (gzdPolylineBounds.getNorthEast().lat - gzdPolylineBounds.getSouthWest().lat) / 2; // (eg- 40.000 - 48.000 / 2 = 4)
    const halfLng = (gzdPolylineBounds.getNorthEast().lng - gzdPolylineBounds.getSouthWest().lng) / 2; // (eg- -72.000 - -78.000 / 2 = 3)
    // Now add those values to the southwest latitude/longitude to get the center point of the GZD
    const centerLat = gzdPolylineBounds.getSouthWest().lat + halfLat;
    const centerLng = gzdPolylineBounds.getSouthWest().lng + halfLng;
    // Add or subtract a small number on the center latitudes/longitudes, this will give us a legitimate new LatLngBounds
    // Add the pad() method at the end to add padding on all sides of the new boundaries so the GZD ID label can fit
    const centerBounds = new L.LatLngBounds([centerLat + 0.01, centerLng - 0.01], [centerLat - 0.01, centerLng + 0.01]).pad(10.5);
    // Now add the GZD overlays to the center of the GZD
    const gzdLabels = new L.svgOverlay(gzdIdSVG, centerBounds);
    // combine the polylines and the grid labels into their own group
    const gzdGroup = new L.LayerGroup([gzdPolylineBox, gzdLabels]);
    gzdGroup.addTo(map);
    map.addEventListener('moveend', () => {
      map.removeLayer(gzdGroup);
    }, { once: true });
  }

  // these events will be added and removed from the map with the layer
  getEvents() {
    return {
      moveend: this.reset,
    };
  }

  // Reset the grid on move end
  reset() {
    this.getInBoundsGZDs();
  }
}

export const gz = new GZD(eastingDict, northingDict);
gz.addTo(map);


// *********************************************************************************** //
// * Leaflet DumbMGRS Plugin - 100k Grids (this sorta works?)                        * //
// *********************************************************************************** //
// If there is a high zoom level, we need to add more padding so the grids generate throughout the whole screen
function getPaddingOnZoomLevel() {
  const northBuffer = map.getBounds().getNorth() >= 62 ? 0.2 : 0;
  const zoom = map.getZoom();

  if (zoom >= 18) {
    return 800;
  }

  switch (zoom) {
    case 17:
      return 400;
    case 16:
      return 200;
    case 15:
      return 100;
    case 14:
      return 50;
    case 13:
      return 25;
    case 12:
      return 12;
    case 11:
      return 6;
    case 10:
      return 3 + northBuffer;
    case 9:
      return 0.7 + northBuffer;
    case 8:
      return 0.3 + northBuffer;
    case 7:
      return 0.2 + northBuffer;
    case 6:
      return 0.1 + northBuffer;
    default:
      break;
  }
}

// TODO: Create a grid label toggle
// TODO: combine the 1mil, 100k, and 1000m grids into one class...
function Grid100K() {
  // Note: any comment with the word GZD means "Grid Zone Designator". It's a 1 million by 1 million grid
  this.constructor = function () {
    // Get the North/South/East/West visible bounds and add padding
    this.north = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getNorth();
    this.south = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getSouth();
    this.east = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getEast();
    this.west = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getWest();
    // The eastingArray and northingArray will hold the latlngs for our grids
    this.eastingArray = [];
    this.northingArray = [];
    this.lineOptions = {
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
    };
    // default line style for 100K grids
    this.lineStyle = {
      color: 'black',
      weight: 4,
      opacity: 0.5,
      ...this.lineOptions,
    };
    // line style for debugging
    this.greenLine = {
      color: 'green',
      weight: 8,
      opacity: 0.25,
      ...this.lineOptions,
    };
    // line style for debugging
    this.orangeLine = {
      color: 'orange',
      weight: 8,
      opacity: 0.25,
      ...this.lineOptions,
    };
    // line style for debugging
    this.redLine = {
      color: 'red',
      weight: 2,
      opacity: 0.75,
      ...this.lineOptions,
    };
    this.map = map;
    // gridInterval set at 100k meters, ideally this should be adjustable so I can use it for the 1000 meter grids
    this.gridInterval = 100000;
    // dumb name, but this temporarily holds the visible grids so I can iterate over them
    this.empty = [];
    // visible grid zones from this.empty will be dumped in here
    this.uniqueVisibleGrids = {};
    // Create a new layergroup to hold the grid lines
    this.layerGroup100k = new L.LayerGroup([]);
    // These next 2 are for the 100k grid labels
    this.labelN = [];
    this.labelS = [];
  };


  // Returns the visible grids on the map and their bounds
  this.getVizGrids = function () {
    // Prevent the map from drawing 100K grids when it is zoomed out too far.
    if (map.getZoom() < 6) {
      return;
    }
    // Calling constructor to get it's values (eg- this.northingArray, etc...)
    this.constructor();
    // empty the empty array (I really need a new name for this)
    this.empty.length = 0;
    // GZ is the variable name for the GZD class I instantiated earlier
    gz.viz.forEach((visibleGrid) => {
      // This will tell us what grid squares are visible on the map
      this.empty.push(visibleGrid);
    });
    // This just creates a neater object where I can parse the data easier
    this.uniqueVisibleGrids = Object.keys(this.empty).reduce((acc, k) => {
      const grid = this.empty[k].id;
      acc[grid] = acc[grid] || [];
      acc[grid].push(this.empty[k]);
      return acc;
    }, {});
    this.prepGrids(this.uniqueVisibleGrids);
  };

  // Now that we have the visible grids, we can iterate over them
  this.prepGrids = function (uniqueVisibleGrids) {
    this.uniqueVisibleGrids = uniqueVisibleGrids;
    const visibleGridsIterator = new Map(Object.entries(this.uniqueVisibleGrids));

    // Not sure how useful this promise is. It works fine with just a forEach loop
    //! use async/await or just a forEach loop?
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    visibleGridsIterator.forEach((grid) => {
      delay(20)
        .then(() => {
          // This is where all the grids are generated.
          this.generateGrids(grid);
          return delay(3000);
        })
        .catch((err) => {
          console.error(err);
        });
    });
  };

  this.generateGrids = function (data) {
    this.data = data;
    const buffer = 0.00001;
    Object.values(this.data).forEach((x) => {
      // Get the corners of the visible grids and convert them from latlon to UTM
      const sw = LLtoUTM({ lat: x.bottom + buffer, lon: x.left + buffer });
      const se = LLtoUTM({ lat: x.bottom + buffer, lon: x.right - buffer });
      const ne = LLtoUTM({ lat: x.top - buffer, lon: x.right - buffer });
      const nw = LLtoUTM({ lat: x.top - buffer, lon: x.left + buffer });

      const hemisphere = map.getCenter().lat <= 0 ? 'South' : 'North';
      let northingIteratorNorthHemisphere = sw.northing;
      let eastingIteratorNorthHemisphere = sw.easting;
      let northingIteratorSouthHemisphere = sw.northing;
      let eastingIteratorSouthHemisphere = nw.easting;

      // Check which hemisphere the user is in and make adjustments
      switch (hemisphere) {
        case 'North':
          // Find all northing grids that are divisible by 100,000
          if (sw.zoneLetter === ne.zoneLetter) {
            while (northingIteratorNorthHemisphere <= ne.northing) {
              // This loop basically checks to make sure the easting grid is divisible by 100K
              if (northingIteratorNorthHemisphere % this.gridInterval === 0) {
                this.northingArray.push({
                  northing: northingIteratorNorthHemisphere,
                  zoneNumber: sw.zoneNumber,
                  zoneLetter: sw.zoneLetter,
                });
              } else if (northingIteratorNorthHemisphere % (this.gridInterval / 2) === 0) {
                // Push the coordinates for the 100k grid labels
                this.labelN.push({
                  northing: northingIteratorNorthHemisphere,
                  zoneNumber: sw.zoneNumber,
                  zoneLetter: sw.zoneLetter,
                });
              }

              northingIteratorNorthHemisphere += 1;
            }
          }
          // Find all easting grids that are divisible by 100,000
          if (sw.zoneLetter === se.zoneLetter) {
            while (eastingIteratorNorthHemisphere <= se.easting) {
              if (eastingIteratorNorthHemisphere % this.gridInterval === 0) {
                this.eastingArray.push({
                  easting: eastingIteratorNorthHemisphere,
                  zoneNumber: sw.zoneNumber,
                  zoneLetter: sw.zoneLetter,
                });
                // IOT find smaller grids, just divide this.gridInterval in half
              } else if (eastingIteratorNorthHemisphere % (this.gridInterval / 2) === 0) {
                // Push the coordinates for the 100k grid labels
                this.labelS.push({
                  easting: eastingIteratorNorthHemisphere,
                  zoneNumber: sw.zoneNumber,
                  zoneLetter: sw.zoneLetter,
                });
              }
              eastingIteratorNorthHemisphere += 1;
            }
          }
          break;
        case 'South':
          // Find all northing grids that are divisible by 100,000
          if (sw.zoneLetter === ne.zoneLetter) {
            while (northingIteratorSouthHemisphere <= ne.northing) {
              // This loop basically checks to make sure the easting grid is divisible by 100K
              if (northingIteratorSouthHemisphere % this.gridInterval === 0) {
                this.northingArray.push({
                  northing: northingIteratorSouthHemisphere,
                  zoneNumber: nw.zoneNumber,
                  zoneLetter: nw.zoneLetter,
                });
              } else if (northingIteratorSouthHemisphere % (this.gridInterval / 2) === 0) {
                this.labelN.push({
                  northing: northingIteratorSouthHemisphere,
                  zoneNumber: nw.zoneNumber,
                  zoneLetter: nw.zoneLetter,
                });
              }
              northingIteratorSouthHemisphere += 1;
            }
          }
          // Find all easting grids that are divisible by 100,000
          if (nw.zoneLetter === ne.zoneLetter) {
            while (eastingIteratorSouthHemisphere <= ne.easting) {
              if (eastingIteratorSouthHemisphere % this.gridInterval === 0) {
                this.eastingArray.push({
                  easting: eastingIteratorSouthHemisphere,
                  zoneNumber: nw.zoneNumber,
                  zoneLetter: nw.zoneLetter,
                });
              } else if (eastingIteratorSouthHemisphere % (this.gridInterval / 2) === 0) {
                this.labelS.push({
                  easting: eastingIteratorSouthHemisphere,
                  zoneNumber: nw.zoneNumber,
                  zoneLetter: nw.zoneLetter,
                });
              }
              eastingIteratorSouthHemisphere += 1;
            }
          }
          break;
        default:
          break;
      }
    });


    //* Build the northing grid lines *//
    Object.entries(this.northingArray).forEach((na) => {
      const northingGridsArray = [];
      const bottomNorthing = na[1];
      const southWestCorner = new L.latLng({ lat: this.south, lon: this.west });
      const northEastCorner = new L.latLng({ lat: this.north, lon: this.east });
      const bounds = new L.latLngBounds(southWestCorner, northEastCorner);
      const bottomRow = this.eastingArray.map((j) => {
        if (j.zoneNumber === bottomNorthing.zoneNumber && j.zoneLetter === bottomNorthing.zoneLetter) {
          return [j, bottomNorthing];
        }
      });

      // Since bottomRow now contains grids from this.northingArray and this.eastingArray, we can add them to the empty array to loop over later
      bottomRow.forEach((k) => {
        if (k) {
          const northingGrids = UTMtoLL({
            northing: k[1].northing,
            easting: k[0].easting,
            zoneNumber: k[0].zoneNumber,
            zoneLetter: k[0].zoneLetter,
          });
          // If the northingGrids are within the visible boundaries of the map, then push them to the array
          if (bounds.contains(northingGrids)) {
            northingGridsArray.push(northingGrids);
          }
        }
      });

      const len = northingGridsArray.length;
      for (let index = 0; index < len; index += 1) {
        const element = [northingGridsArray[index], northingGridsArray[index + 1]];
        const northingLine = new L.Polyline([element], this.lineStyle);
        // Create a special grid for oddball grid zones like Norway and Svalbard
        this.handleSpecialZones(element);
        // Since element is an array of objects, check if the 2nd element is available in the array IOT generate a complete grid
        if (element[1]) {
          // If the user is scrolled all the way up to the X zone, then just run cleanLine
          if (this.data[0].letterID === 'X') {
            this.cleanLine(northingLine, this.data[0].left, this.data[0].right);
          }
          // If element[1]'s longitude is less than the right GZD boundary longitude and greater than the left GZD boundary
          if (element[1].lon <= this.data[0].right && element[0].lon >= this.data[0].left) {
            // This is where the northingLine grids will be output from
            // Basically what this.cleanLine aims to do is clip any polylines that go past their GZD boundaries
            this.cleanLine(northingLine, this.data[0].left, this.data[0].right);
            // This will "connect" the 100k grid to the east and west end of the GZD
            let count = 0;
            while (count < this.data.length) {
              // If any Polylines are less than 100k meters away from the GZD, we can then start connecting them
              // Convert element[0] to a LatLng so we can use the distanceTo() method
              const connectingNorthingLineWest = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              this.connectingNorthingLine(connectingNorthingLineWest, element, 0, this.data, count, 'left');
              const connectingNorthingLineEast = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              this.connectingNorthingLine(connectingNorthingLineEast, element, 1, this.data, count, 'right');
              count += 1;
              break;
            }
          }
        }
      }
    });

    //* Build the easting grid lines *//
    Object.entries(this.eastingArray).forEach((ea) => {
      // This empty array will hold all latlngs generated from the "bottomRow" forEach loop.
      const eastingGridsArray = [];
      const bottomEasting = ea[1];
      const southWestCorner = new L.latLng({ lat: this.south, lon: this.west });
      const northEastCorner = new L.latLng({ lat: this.north, lon: this.east });
      const bounds = new L.latLngBounds(southWestCorner, northEastCorner);
      const bottomRow = this.northingArray.map((j) => {
        // match grid zones and grid IDs together
        if (j.zoneNumber === bottomEasting.zoneNumber && j.zoneLetter === bottomEasting.zoneLetter) {
          return [j, bottomEasting];
        }
      });

      // Since bottomRow now contains grids from this.northingArray and this.eastingArray, we can add them to the empty array to loop over later
      bottomRow.forEach((k) => {
        if (k) {
          const eastingGrids = UTMtoLL({
            northing: k[0].northing,
            easting: k[1].easting,
            zoneNumber: k[0].zoneNumber,
            zoneLetter: k[0].zoneLetter,
          });
          // If the eastingGrids are within the visible boundaries of the map, then push them to the array
          if (bounds.contains(eastingGrids)) {
            eastingGridsArray.push(eastingGrids);
          }
        }
      });

      // I was told that setting the length of the loop like this has better performance than just array.length
      const len = eastingGridsArray.length;
      for (let index = 0; index < len; index += 1) {
        const element = [eastingGridsArray[index], eastingGridsArray[index + 1]];
        const eastingLine = new L.Polyline([element], this.lineStyle);
        this.handleSpecialZones(element);
        // Since element is an array of objects, check if the 2nd element is available in the array IOT generate a complete grid
        if (element[1]) {
          // If element[1]'s longitude is less than the left boundary and greater than the right boundary
          if (element[0].lon > this.data[0].left && element[0].lon < this.data[0].right) {
            // Basically what this.cleanLine aims to do is clip any polylines that go past their GZD boundaries
            this.cleanLine(eastingLine, this.data[0].left, this.data[0].right);
            // Connect the easting lines to the north and south parts of the GZD
            // IOT get the bottom latitude for each grid we need to loop over it
            let count = 0;
            while (count < this.data.length) {
              // If any Polylines are less than 100k meters away from the GZD, we can then start connecting them
              const connectingEastingLineSouth = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              this.connectingEastingLine(connectingEastingLineSouth, element, 0, this.data, count, 'bottom');
              const connectingEastingLineNorth = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              this.connectingEastingLine(connectingEastingLineNorth, element, 1, this.data, count, 'top');
              count += 1;
            }
          }
        }
      }
    });
    // Adds the layergroup to the map and then clears out the easting/northing arrays
    return this.clearAll();
  };

  // These 2 functions will "connect" the northing and easting 100k grid lines to their adjacent GZD
  // CONNECTOR is the connecting line we pass in (eg - connectingEastingLineSouth)
  // ELEMENT is the grid lines generated from the for loop. The element is an object with 2 arrays containing latlons
  // DATA is the GZD data (example, this.data contains info on the corner boundaries of the visible GZDs)
  // COUNT is the index used in the while loop
  // DIRECTION is the information we want to access in "this.data[count].top/bottom/left/right"
  this.connectingNorthingLine = function (connector, element, elementIndex, data, count, direction) {
    const southBuffer = this.south > -20 ? 1 : 1.51;
    const connectorDistance = connector.distanceTo({ lat: element[elementIndex].lat, lng: data[count][direction] });
    if (connectorDistance <= this.gridInterval * southBuffer) {
      const northingGridLineEndpoint = LLtoUTM({ lat: connector.lat, lon: data[count][direction] });
      const extendedNorthingLine = UTMtoLL({
        northing: Math.round(northingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
        easting: northingGridLineEndpoint.easting,
        zoneNumber: northingGridLineEndpoint.zoneNumber,
        zoneLetter: northingGridLineEndpoint.zoneLetter,
      });
      const connectingNorthingLineToGZD = new L.Polyline([connector, extendedNorthingLine], this.lineStyle);
      this.layerGroup100k.addLayer(connectingNorthingLineToGZD);
    }
  };

  this.connectingEastingLine = function (connector, element, elementIndex, data, count, direction) {
    // If the map view latitude is above 60, then add a multiplier to the gridInterval since the 100k grids get more spaced out as you go north
    const northBuffer = this.north > 60 ? 1.5 : 1.03;
    if (connector.distanceTo({ lat: data[count][direction], lng: element[elementIndex].lon }) <= this.gridInterval * northBuffer) {
      const eastingGridLineEndpoint = LLtoUTM({ lat: data[count][direction], lon: connector.lng });
      const extendedEastingLine = UTMtoLL({
        northing: eastingGridLineEndpoint.northing,
        // round the easting so it lines up with the bottom grid.
        easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
        zoneNumber: eastingGridLineEndpoint.zoneNumber,
        zoneLetter: eastingGridLineEndpoint.zoneLetter,
      });

      const connectingEastingLineToGZD = new L.Polyline([connector, extendedEastingLine], this.lineStyle);
      this.layerGroup100k.addLayer(connectingEastingLineToGZD);
    }
  };

  // This function takes an easting or northing line and 2 bounds (left and right)
  // It returns a new line with the same slope but bounded
  // A line is defined by y = slope * x + b
  // The only difference here is testing first to see if bounds cut the line
  this.cleanLine = function (line, leftLongitudeLimit, rightLongitudeLimit) {
    // Line is going to be the eastingLine/northingLine variable the gets passed in
    const lineToClean = line.getLatLngs();
    // line style options passed in from eastingLine/northingLine
    const { options } = line;
    // pt1 is element[0]
    let pt1 = lineToClean[0][0];
    // pt2 is element[1]
    let pt2 = lineToClean[0][1];
    // slope is some funky math I copied from https://github.com/trailbehind/leaflet-grids
    const slope = (pt1.lat - pt2.lat) / (pt1.lng - pt2.lng);
    // adding some space to the longitude so lines are more accurate
    const lngBuffer = 0.00125;

    if (pt1.lng < leftLongitudeLimit) {
      const newLat = pt1.lat + (slope * (leftLongitudeLimit - pt1.lng) + lngBuffer);
      pt1 = new L.latLng(newLat, leftLongitudeLimit);
    }

    if (pt2.lng > rightLongitudeLimit) {
      const newLat = pt1.lat + (slope * (rightLongitudeLimit - pt1.lng) + lngBuffer);
      pt2 = new L.latLng(newLat, rightLongitudeLimit);
    }

    if (pt2.lng < leftLongitudeLimit) {
      const newLat = pt1.lat + (slope * (leftLongitudeLimit - pt1.lng) + lngBuffer);
      pt2 = new L.latLng(newLat, leftLongitudeLimit);
    }

    const newLine = new L.Polyline([pt1, pt2], options);
    if (pt2.lat > this.south) {
      this.layerGroup100k.addLayer(newLine);
    }
  };

  // TODO: Finish configuring the special zones exceptions
  this.handleSpecialZones = function (element) {
    const elementUTM = LLtoUTM(element[0]);
    // 31V is that slim GZD between Norway and Britain.
    if (elementUTM.zoneNumber === 31 && elementUTM.zoneLetter === 'V') {
      if (elementUTM.northing % this.gridInterval === 0) {
        const specialLine = new L.Polyline([{ lat: element[0].lat, lng: element[0].lon }, UTMtoLL({
          northing: elementUTM.northing,
          easting: 499999,
          zoneNumber: elementUTM.zoneNumber,
          zoneLetter: elementUTM.zoneLetter,
        })], this.lineStyle);
        // 0.0179 is some dumbass number I came up with IOT adjust the specialLine2 start point in GZD 31V. It's not very accurate but 31V is a stupid fucking GZD and has no land on it anyways. Waste of my fucking time.
        const specialLine2 = new L.Polyline([{ lat: element[0].lat - 0.0179, lng: 0.0000001 }, UTMtoLL({
          northing: elementUTM.northing,
          easting: elementUTM.easting,
          zoneNumber: elementUTM.zoneNumber,
          zoneLetter: elementUTM.zoneLetter,
        })], this.lineStyle);
        this.layerGroup100k.addLayer(specialLine);
        this.layerGroup100k.addLayer(specialLine2);
      }
    }
    if (element[1]) {
      if (elementUTM.zoneNumber === 32 && elementUTM.zoneLetter === 'V') {
        // This is the western longitude of the previous GZD "31V"
        const westBounds = 3;
        if (element[1].lon > westBounds) {
          const eastingLine = new L.Polyline([element], this.lineStyle);
          const connectingNorthingLineWest = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
          //! Remove this if statement and use this.connectingLine()
          // If any Polylines are less than 100k meters away from the GZD, we can then start connecting them
          if (connectingNorthingLineWest.distanceTo({ lat: element[0].lat, lng: westBounds }) <= this.gridInterval) {
            const eastingGridLineEndpoint = LLtoUTM({ lat: connectingNorthingLineWest.lat, lon: westBounds });
            const extendedLineWest = UTMtoLL({
              northing: Math.round(eastingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
              easting: eastingGridLineEndpoint.easting,
              zoneNumber: eastingGridLineEndpoint.zoneNumber,
              zoneLetter: eastingGridLineEndpoint.zoneLetter,
            });
            const connectingNorthingLineWestToGZD = new L.Polyline([connectingNorthingLineWest, extendedLineWest], this.lineStyle);
            this.layerGroup100k.addLayer(connectingNorthingLineWestToGZD);
          }
          this.layerGroup100k.addLayer(eastingLine);
        }
      }
    }
  };


  this.genLabels = function () {
    // do not fire off labels when the map is zoomed out
    if (map.getZoom() <= 6) {
      return;
    }
    Object.entries(this.labelN).forEach((na) => {
      const labelGridsArray = [];
      const bottomNorthing = na[1];
      const southWestCorner = new L.latLng({ lat: this.south, lon: this.west });
      const northEastCorner = new L.latLng({ lat: this.north, lon: this.east });
      const bounds = new L.latLngBounds(southWestCorner, northEastCorner);
      const bottomRow = this.labelS.map((j) => {
        if (j.zoneNumber === bottomNorthing.zoneNumber && j.zoneLetter === bottomNorthing.zoneLetter) {
          return [j, bottomNorthing];
        }
      });

      // Since bottomRow now contains grids from this.labelN and this.labelS, we can add them to the empty array to loop over later
      bottomRow.forEach((k) => {
        if (k) {
          const northingGrids = UTMtoLL({
            northing: k[1].northing,
            easting: k[0].easting,
            zoneNumber: k[0].zoneNumber,
            zoneLetter: k[0].zoneLetter,
          });

          // If the northingGrids are within the visible boundaries of the map, then push them to the array
          if (bounds.contains(northingGrids)) {
            labelGridsArray.push(northingGrids);
          }
        }
      });

      for (let index = 0; index < labelGridsArray.length; index += 1) {
        const element = [labelGridsArray[index], labelGridsArray[index + 1]];
        if (element[0]) {
          const grid100kData = LLtoUTM(element[0]);
          const grid100kLabel = new L.Marker(element[0], {
            interactive: false,
            icon: new L.DivIcon({
              className: 'leaflet-grid-label',
              iconAnchor: new L.Point(10, 10),
              html: `<div class="grid-label">${get100kID(grid100kData.easting, grid100kData.northing, grid100kData.zoneNumber)}</div>`,
            }),
          });
          // Only put labels on the map if they are in bounds
          if (map.getBounds().pad(0.1).contains(element[0])) {
            this.layerGroup100k.addLayer(grid100kLabel);
          }
        }
      }
    });
  };

  this.clearAll = function () {
    this.genLabels();
    this.layerGroup100k.addTo(map);
    this.eastingArray = [];
    this.northingArray = [];
    this.labelN = [];
    this.labelS = [];
  };

  this.regenerate = function () {
    if (this.layerGroup100k) {
      this.layerGroup100k.clearLayers();
      return this.getVizGrids();
    }
  };
}
// Create a new class and give it some boundaries
const generate100KGrids = new Grid100K(new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()));
// Run the class on page load
generate100KGrids.getVizGrids();

// *********************************************************************************** //
// * 1000 Meter Grids                                                                * //
// *********************************************************************************** //
function getPaddingOnZoomLevel1000Meters() {
  const zoom = map.getZoom();
  if (zoom >= 18) {
    return 4;
  }
  switch (zoom) {
    case 17:
      return 1.5;
    case 16:
      return 0.75;
    case 15:
      return 0.4;
    case 14:
      return 0.18;
    case 13:
      return 0.1;
    case 12:
      return 0.04;
    default:
      break;
  }
}

//! BUG: 1000m grids are all jacked up on the southern hemisphere. Use the switch statement in Grid100K
function Grid1000M(enableLabels) {
  this.constructor = function () {
    this.visibleBounds = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel1000Meters());
    this.north = this.visibleBounds.getNorth();
    this.south = this.visibleBounds.getSouth();
    this.east = this.visibleBounds.getEast();
    this.west = this.visibleBounds.getWest();
    this.eastingArray = [];
    this.northingArray = [];
    this.lineOptions = {
      color: 'black',
      weight: 1,
      opacity: 0.5,
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
      // className: 'leaflet-zoom-hide',
    };
    this.map = map;
    this.layerGroup1000m = new L.LayerGroup([]);
    this.layerGroup1000mLabels = new L.LayerGroup([]);
    //! Why am I declaring a global var for this? Because It is the only way I can access it...
    window.globalLabels = this.layerGroup1000mLabels;
    this.gridInterval = 1000;
    this.enableLabels = this.areLabelsEnabled(enableLabels);
    return this;
  };

  //! Is this needed?
  this.areLabelsEnabled = function (val = enableLabels) {
    this.val = val;
    return this.val;
  };

  this.determineGrids = function () {
    // Do not add 1000 meter grids if the zoom level is <= 12
    if (map.getZoom() < 12) {
      return;
    }
    this.constructor();
    const NEBounds = LLtoUTM({ lat: this.north, lon: this.east });
    const NWBounds = LLtoUTM({ lat: this.constructor().north, lon: this.constructor().west });
    const SEBounds = LLtoUTM({ lat: this.constructor().south, lon: this.constructor().east });
    const SWBounds = LLtoUTM({ lat: this.constructor().south, lon: this.constructor().west });

    if (NEBounds.zoneNumber === NWBounds.zoneNumber || SEBounds.zoneNumber === SWBounds.zoneNumber) {
      let noAdjacentGZD = false;
      // Since there are no GZDs that are splitting the map bounds, we only need to run one "side"
      return this.right(NEBounds, noAdjacentGZD = true);
    }
    const leftPromise = new Promise((resolve) => {
      resolve(this.left(NWBounds));
    });
    Promise.all([leftPromise]).then(() => new Promise((resolve) => {
      // Clear out the arrays so the right side can generate grids
      this.eastingArray = [];
      this.northingArray = [];
      setTimeout(() => resolve(this.right(NEBounds)), 10);
    }));
  };

  this.left = function (NWBounds) {
    const neLeft = LLtoUTM({ lat: this.north, lon: eastingDict[NWBounds.zoneNumber].right - 0.000000001 });
    const seLeft = LLtoUTM({ lat: this.south, lon: eastingDict[NWBounds.zoneNumber].right - 0.000000001 });
    const swLeft = LLtoUTM({ lat: this.south, lon: this.west });

    let leftEastingIterator = swLeft.easting;
    let leftNorthingIterator = swLeft.northing;

    //* Left Side Easting */
    while (leftEastingIterator <= seLeft.easting) {
      if (leftEastingIterator % this.gridInterval === 0) {
        // this.endCoordNorthing does not change on the easting
        this.eastingArray.push({
          easting: leftEastingIterator,
          zoneNumber: seLeft.zoneNumber,
          zoneLetter: seLeft.zoneLetter,
        });

        if (this.enableLabels) {
          // Put the easting grid line label at the bottom of the map
          const leftEastingGrid1000MLabelCoords = UTMtoLL({
            easting: leftEastingIterator,
            northing: LLtoUTM(map.getBounds().getSouthWest()).northing + (leftEastingIterator / this.gridInterval % 100),
            zoneNumber: seLeft.zoneNumber,
            zoneLetter: seLeft.zoneLetter,
          });

          const leftEastingGrid1000MLabel = new L.Marker(leftEastingGrid1000MLabelCoords, {
            interactive: false,
            icon: new L.DivIcon({
              className: 'leaflet-grid-label',
              // set an icon offset so they are visible to the user
              iconAnchor: new L.Point(12, 30),
              // example: if leftEastingIterator = 720000
              // then remove the first char, and the last 3 chars and keep the "20"
              html: `<div class="grid-label-1000m">${leftEastingIterator.toString().slice(1, -3)}</div>`,
            }),
          });

          // If the grid label is within the map bounds, then add it to the map
          if (map.getBounds().pad(0.1).contains(leftEastingGrid1000MLabelCoords)) {
            this.layerGroup1000mLabels.addLayer(leftEastingGrid1000MLabel);
          }
        }
      }
      leftEastingIterator += 1;
    }

    //* * Left Side Northing */
    while (leftNorthingIterator <= neLeft.northing) {
      if (leftNorthingIterator % this.gridInterval === 0) {
        this.northingArray.push({
          northing: leftNorthingIterator,
          zoneNumber: neLeft.zoneNumber,
          zoneLetter: neLeft.zoneLetter,
        });

        if (this.enableLabels) {
          const leftNorthingGrid1000MLabelCoords = UTMtoLL({
            easting: LLtoUTM(map.getBounds().getNorthWest()).easting - (leftNorthingIterator / this.gridInterval % 100),
            northing: leftNorthingIterator,
            zoneNumber: neLeft.zoneNumber,
            zoneLetter: neLeft.zoneLetter,
          });

          const leftNorthingGrid1000MLabel = new L.Marker(leftNorthingGrid1000MLabelCoords, {
            interactive: false,
            icon: new L.DivIcon({
              className: 'leaflet-grid-label',
              iconAnchor: new L.Point(-30, 12),
              html: `<div class="grid-label-1000m">${leftNorthingIterator.toString().slice(2, -3)}</div>`,
            }),
          });

          // Set labels that are only greater than 1000m from the SE corner, that way they don't overlap the easting labels
          if (leftNorthingGrid1000MLabel.getLatLng().distanceTo(map.getBounds().getSouthWest()) >= this.gridInterval) {
            if (map.getBounds().pad(0.1).contains(leftNorthingGrid1000MLabelCoords)) {
              this.layerGroup1000mLabels.addLayer(leftNorthingGrid1000MLabel);
            }
          }
        }
      }
      leftNorthingIterator += 1;
    }

    return this.generateSplitGrids('left', NWBounds);
  };

  this.right = function (NEBounds, noAdjacentGZD = false) {
    let swRight;
    if (noAdjacentGZD) {
      swRight = LLtoUTM({ lat: this.south, lon: this.west });
    } else {
      swRight = LLtoUTM({ lat: this.south, lon: eastingDict[NEBounds.zoneNumber].left });
    }

    const neRight = LLtoUTM({ lat: this.north, lon: this.east });
    const seRight = LLtoUTM({ lat: this.south, lon: this.east });
    let rightEastingIterator = swRight.easting;
    let rightNorthingIterator = swRight.northing;

    //* Right Side Easting */
    while (rightEastingIterator <= seRight.easting) {
      if (rightEastingIterator % this.gridInterval === 0) {
        this.eastingArray.push({
          easting: rightEastingIterator,
          zoneNumber: seRight.zoneNumber,
          zoneLetter: seRight.zoneLetter,
        });

        if (this.enableLabels) {
          // Put the easting grid line label at the bottom of the map
          const rightEastingGrid1000MLabelCoords = UTMtoLL({
            easting: rightEastingIterator,
            northing: LLtoUTM(map.getBounds().getSouthWest()).northing + (rightEastingIterator / this.gridInterval % 100),
            zoneNumber: seRight.zoneNumber,
            zoneLetter: seRight.zoneLetter,
          });

          const rightEastingGrid1000MLabel = new L.Marker(rightEastingGrid1000MLabelCoords, {
            interactive: false,
            icon: new L.DivIcon({
              className: 'leaflet-grid-label',
              iconAnchor: new L.Point(12, 30),
              html: `<div class="grid-label-1000m">${rightEastingIterator.toString().slice(1, -3)}</div>`,
            }),
          });

          // Make sure that the label is within the visible bounds of the map
          if (map.getBounds().pad(0.1).contains(rightEastingGrid1000MLabelCoords)) {
            this.layerGroup1000mLabels.addLayer(rightEastingGrid1000MLabel);
          }
        }
      }
      rightEastingIterator += 1;
    }

    //* Right Side Northing */
    while (rightNorthingIterator <= neRight.northing) {
      if (rightNorthingIterator % this.gridInterval === 0) {
        this.northingArray.push({
          northing: rightNorthingIterator,
          zoneNumber: neRight.zoneNumber,
          zoneLetter: neRight.zoneLetter,
        });

        if (this.enableLabels) {
          const rightNorthingGrid1000MLabelCoords = UTMtoLL({
            easting: LLtoUTM(map.getBounds().getNorthEast()).easting - (rightNorthingIterator / this.gridInterval % 100),
            northing: rightNorthingIterator,
            zoneNumber: neRight.zoneNumber,
            zoneLetter: neRight.zoneLetter,
          });

          const rightNorthingGrid1000MLabel = new L.Marker(rightNorthingGrid1000MLabelCoords, {
            interactive: false,
            icon: new L.DivIcon({
              className: 'leaflet-grid-label',
              iconAnchor: new L.Point(50, 12),
              html: `<div class="grid-label-1000m">${rightNorthingIterator.toString().slice(2, -3)}</div>`,
            }),
          });

          // Set labels that are only greater than 1000m from the SE corner, that way they don't overlap the easting labels
          if (rightNorthingGrid1000MLabel.getLatLng().distanceTo(map.getBounds().getSouthEast()) >= this.gridInterval) {
            if (map.getBounds().pad(0.1).contains(rightNorthingGrid1000MLabelCoords)) {
              this.layerGroup1000mLabels.addLayer(rightNorthingGrid1000MLabel);
            }
          }
        }
      }
      rightNorthingIterator += 1;
    }
    return this.generateSplitGrids('right', NEBounds);
  };


  this.generateSplitGrids = function (direction, bounds) {
    this.direction = direction;
    this.bounds = bounds;
    Object.entries(this.northingArray).forEach((e) => {
      const bottomNorthing = e[1];
      const bottomRow = this.eastingArray.map((j) => [j, bottomNorthing]);
      const emptyBottomRowArr = [];

      bottomRow.forEach((k) => {
        const northingGrids1000Meters = UTMtoLL({
          northing: k[1].northing,
          easting: k[0].easting,
          zoneNumber: k[0].zoneNumber,
          zoneLetter: k[0].zoneLetter,
        });

        if (map.getBounds().pad(getPaddingOnZoomLevel1000Meters()).contains(northingGrids1000Meters)) {
          emptyBottomRowArr.push(northingGrids1000Meters);
        }
      });

      for (let index = 0; index < emptyBottomRowArr.length; index += 1) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        switch (this.direction) {
          case 'left':
            // element[1] ensures that each element in the loop has 2 arrays. If there is only 1 array then it's the "odd-man-out" so we disregard it
            // element[1].lon <= eastingDict[NWBounds.zoneNumber].right - 0.000000001 ensures that the lines will not go over the GZD boundaries
            if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
              const northingLineLeft = new L.Polyline([element], this.lineOptions);
              this.layerGroup1000m.addLayer(northingLineLeft);
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              const finalNorthingLineLeft = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              // If any Polylines are less than 1000 meters away from the GZD, we can then start connecting them
              if (finalNorthingLineLeft.distanceTo({ lat: element[1].lat, lng: eastingDict[this.bounds.zoneNumber].right - 0.000000001 }) <= this.gridInterval) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLineLeft.lat, lon: eastingDict[this.bounds.zoneNumber].right - 0.000000001 });
                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });
                const northingLineLeftToGZD = new L.Polyline([extendedLine, finalNorthingLineLeft], this.lineOptions);
                this.layerGroup1000m.addLayer(northingLineLeftToGZD);
              }
            }
            break;
          case 'right':
            if (element[1] && element[0].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const northingLineRight = new L.Polyline([element], this.lineOptions);
              this.layerGroup1000m.addLayer(northingLineRight);
              // Since element[0] starts on the left, we use that to test if the polyline is extending over the GZD bounds
              const finalNorthingLineRight = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              if (finalNorthingLineRight.distanceTo({ lat: element[0].lat, lng: eastingDict[this.bounds.zoneNumber].left }) < this.gridInterval) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLineRight.lat, lon: eastingDict[this.bounds.zoneNumber].left });
                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });
                const northingLineRightToGZD = new L.Polyline([extendedLine, finalNorthingLineRight], this.lineOptions);
                this.layerGroup1000m.addLayer(northingLineRightToGZD);
              }
            }
            break;
          default:
            break;
        }
      }
    });

    Object.entries(this.eastingArray).forEach((e) => {
      const bottomEasting = e[1];
      const bottomRow = this.northingArray.map((j) => [j, bottomEasting]);
      const emptyBottomRowArr = [];

      bottomRow.forEach((k) => {
        const eastingGrids1000Meters = UTMtoLL({
          northing: k[0].northing,
          easting: k[1].easting,
          zoneNumber: k[0].zoneNumber,
          zoneLetter: k[0].zoneLetter,
        });
        if (map.getBounds().pad(getPaddingOnZoomLevel1000Meters()).contains(eastingGrids1000Meters)) {
          emptyBottomRowArr.push(eastingGrids1000Meters);
        }
      });

      for (let index = 0; index < emptyBottomRowArr.length; index += 1) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        switch (this.direction) {
          case 'left':
            if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
              const eastingLineLeft = new L.Polyline([element], this.lineOptions);
              this.layerGroup1000m.addLayer(eastingLineLeft);
            }
            break;
          case 'right':
            if (element[1] && element[1].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const eastingLineRight = new L.Polyline([element], this.lineOptions);
              this.layerGroup1000m.addLayer(eastingLineRight);
            }
            break;
          default:
            break;
        }
      }
    });

    // All the Polylines are now in this group, we can add it to the map
    this.layerGroup1000m.addTo(this.map);
    this.layerGroup1000mLabels.addTo(this.map);
    return this;
  };

  this.regenerate = function () {
    if (this.layerGroup1000m) {
      this.map.removeLayer(this.layerGroup1000m);
      this.map.removeLayer(this.layerGroup1000mLabels);
      this.determineGrids();
    }
  };

  this.cleaner = function () {
    if (this.areLabelsEnabled() === false) {
      window.globalLabels.eachLayer((layer) => {
        map.removeLayer(layer);
      });
    } else {
      this.determineGrids();
    }
  };
}


// const generate1000meterGrids = new Grid1000M(true);
// generate1000meterGrids.determineGrids();


//! BEGIN PLUGIN TEST
// *********************************************************************************** //
// * TEST PLUGIN                                                                     * //
// *********************************************************************************** //


// L.MGRS1000Meters = L.LayerGroup.extend({
//   // Default options
//   options: {
//     interval: 20,
//     showOriginLabel: true,
//     redraw: 'move',
//     hidden: false,
//     zoomIntervals: [],
//     lineStyle: {
//       color: 'black',
//       weight: 1,
//       opacity: 0.5,
//       interactive: false,
//       fill: false,
//       noClip: true,
//       smoothFactor: 4,
//       lineCap: 'butt',
//       lineJoin: 'miter-clip',
//     },
//     bounds: {
//       visibleBounds: new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel1000Meters()),
//       get north() {
//         return this.visibleBounds.getNorth();
//       },
//       get south() {
//         return this.visibleBounds.getSouth();
//       },
//       get east() {
//         return this.visibleBounds.getEast();
//       },
//       get west() {
//         return this.visibleBounds.getWest();
//       },
//     },
//     enableLabels: true,
//     // eastingArray: [],
//     // northingArray: [],
//     // layerGroup1000m: new L.LayerGroup([]),
//     // layerGroup1000mLabels: new L.LayerGroup([]),
//     gridInterval: 1000,
//   },

//   // Leaflet calls the initialize method when an instance of a control plugin is created by calling new directly or by using the factory function
//   initialize(options) {
//     L.LayerGroup.prototype.initialize.call(this);
//     // this._latLng = this.options.bounds.visibleBounds;
//     // L.Util.setOptions() combines the values of the default settings (specified by the options object parameter passed to the L.Class.extend method) with the values of the settings for this instance of the control plugin, which are specified by the options object passed as a parameter to the initialize method.
//     L.Util.setOptions(this, options);
//   },


//   onAdd(map) {
//     // if (map.getZoom() > 12) {
//     this._map = map;

//     // const layerElementTag = 'div';
//     // // Leaflet hides elements with the leaflet-zoom-hide class while the map is zooming to improve performance.
//     // const layerElementClasses = '.my-leaflet-layer leaflet-zoom-hide';
//     // this._container = L.DomUtil.create(layerElementTag, layerElementClasses);
//     // const pane = map.getPanes().overlayPane;
//     // // Leaflet layer plugins must explicitly add themselves to the overlay pane Leaflet provides for plugins.
//     // pane.appendChild(this._container);
//     // // Calculate initial position of container with `L.Map.latLngToLayerPoint()`, `getPixelOrigin()` and/or `getPixelBounds()`
//     // // console.log(this._container);
//     // const position = map.getPixelBounds();
//     // L.DomUtil.setPosition(this._container, position);
//     // // Add and position children elements if needed
//     // // map.on('zoomend viewreset', this._update, this);

//     // const graticule = this.redraw();
//     const grid = this.redraw();

//     // Create a listener to redraw the map when it's moving
//     this._map.on(`viewreset ${this.options.redraw}`, () => {
//       grid.redraw();
//     });
//     // this._map.on(`viewreset ${this.options.redraw}`, this.redraw(), this);
//     // this.eachLayer(map.addLayer, map);
//     // }
//   },

//   onRemove(map) {
//     L.DomUtil.remove(this._container);
//     map.off('zoomend viewreset', this._update, this);
//     // map.getPanes().overlayPane.removeChild(this._layerElement);
//     // map.off('viewreset', this._updatePosition, this);
//   },

//   hide() {
//     this.options.hidden = true;
//     this.redraw();
//   },

//   show() {
//     this.options.hidden = false;
//     this.redraw();
//   },


//   // redraw() {
//   //   // this.eastingArray.length = 0;
//   //   // this.northingArray.length = 0;
//   //   this._bounds = this.options.bounds.visibleBounds;
//   //   this._mapZoom = this._map.getZoom();
//   //   this._bounds = this._map.getBounds(); // .pad(0.5);
//   //   if (!this.options.hidden) {
//   //     if (!this.getLayers().length) {
//   //       console.log(this.getLayers().length);
//   //       this.determineGrids();
//   //     } else {
//   //       console.log(this.getLayers().length);
//   //       this.clearLayers();
//   //       // this.eachLayer(this.removeLayer, this);
//   //     }
//   //   }

//   //   return this;
//   // },
//   redraw() {
//     this.gridLabels = [];
//     this.gridLines = [];
//     this.eastingArray = [];
//     this.northingArray = [];
//     this.layerGroup1000m = new L.LayerGroup([]);
//     this.layerGroup1000mLabels = new L.LayerGroup([]);

//     if (this.gridLines.length === 0) {
//       this.determineGrids();
//     }

//     for (let index = 0; index < this.gridLines.length; index += 1) {
//       const element = this.gridLines[index];
//       this.layerGroup1000m.addLayer(element);
//     }
//     // this.eachLayer(this.removeLayer, this);
//     // this.clearLayers();
//     // Second, add the new grid

//     this.layerGroup1000m.addTo(this);
//     return this;
//   },

//   determineGrids() {
//     const NEBounds = LLtoUTM({ lat: this.options.bounds.north, lon: this.options.bounds.east });
//     const NWBounds = LLtoUTM({ lat: this.options.bounds.north, lon: this.options.bounds.west });
//     const SEBounds = LLtoUTM({ lat: this.options.bounds.south, lon: this.options.bounds.east });
//     const SWBounds = LLtoUTM({ lat: this.options.bounds.south, lon: this.options.bounds.west });

//     if (NEBounds.zoneNumber === NWBounds.zoneNumber || SEBounds.zoneNumber === SWBounds.zoneNumber) {
//       let noAdjacentGZD = false;
//       // Since there are no GZDs that are splitting the map bounds, we only need to run one "side"
//       return this.right(NEBounds, noAdjacentGZD = true);
//     }
//     const leftPromise = new Promise((resolve) => {
//       resolve(this.left(NWBounds));
//     });
//     Promise.all([leftPromise]).then(() => new Promise((resolve) => {
//       // Clear out the arrays so the right side can generate grids
//       this.eastingArray = [];
//       this.northingArray = [];
//       setTimeout(() => resolve(this.right(NEBounds)), 10);
//     }));
//     return this;
//   },

//   left(NWBounds) {
//     const neLeft = LLtoUTM({ lat: this.options.bounds.north, lon: eastingDict[NWBounds.zoneNumber].right - 0.000000001 });
//     const seLeft = LLtoUTM({ lat: this.options.bounds.south, lon: eastingDict[NWBounds.zoneNumber].right - 0.000000001 });
//     const swLeft = LLtoUTM({ lat: this.options.bounds.south, lon: this.options.bounds.west });

//     let leftEastingIterator = swLeft.easting;
//     let leftNorthingIterator = swLeft.northing;

//     //* Left Side Easting */
//     while (leftEastingIterator <= seLeft.easting) {
//       if (leftEastingIterator % this.options.gridInterval === 0) {
//         // this.endCoordNorthing does not change on the easting
//         this.eastingArray.push({
//           easting: leftEastingIterator,
//           zoneNumber: seLeft.zoneNumber,
//           zoneLetter: seLeft.zoneLetter,
//         });

//         if (this.options.enableLabels) {
//           // Put the easting grid line label at the bottom of the map
//           const leftEastingGrid1000MLabelCoords = UTMtoLL({
//             easting: leftEastingIterator,
//             northing: LLtoUTM(map.getBounds().getSouthWest()).northing + (leftEastingIterator / this.options.gridInterval % 100),
//             zoneNumber: seLeft.zoneNumber,
//             zoneLetter: seLeft.zoneLetter,
//           });

//           const leftEastingGrid1000MLabel = new L.Marker(leftEastingGrid1000MLabelCoords, {
//             interactive: false,
//             icon: new L.DivIcon({
//               className: 'leaflet-grid-label',
//               // set an icon offset so they are visible to the user
//               iconAnchor: new L.Point(12, 30),
//               // example: if leftEastingIterator = 720000
//               // then remove the first char, and the last 3 chars and keep the "20"
//               html: `<div class="grid-label-1000m">${leftEastingIterator.toString().slice(1, -3)}</div>`,
//             }),
//           });

//           // If the grid label is within the map bounds, then add it to the map
//           if (map.getBounds().pad(0.1).contains(leftEastingGrid1000MLabelCoords)) {
//             // this.options.layerGroup1000mLabels.addLayer(leftEastingGrid1000MLabel);
//             // this.addLayer(leftEastingGrid1000MLabel);
//             this.gridLabels.push(leftEastingGrid1000MLabel);
//           }
//         }
//       }
//       leftEastingIterator += 1;
//     }

//     //* * Left Side Northing */
//     while (leftNorthingIterator <= neLeft.northing) {
//       if (leftNorthingIterator % this.options.gridInterval === 0) {
//         this.northingArray.push({
//           northing: leftNorthingIterator,
//           zoneNumber: neLeft.zoneNumber,
//           zoneLetter: neLeft.zoneLetter,
//         });

//         if (this.options.enableLabels) {
//           const leftNorthingGrid1000MLabelCoords = UTMtoLL({
//             easting: LLtoUTM(map.getBounds().getNorthWest()).easting - (leftNorthingIterator / this.options.gridInterval % 100),
//             northing: leftNorthingIterator,
//             zoneNumber: neLeft.zoneNumber,
//             zoneLetter: neLeft.zoneLetter,
//           });

//           const leftNorthingGrid1000MLabel = new L.Marker(leftNorthingGrid1000MLabelCoords, {
//             interactive: false,
//             icon: new L.DivIcon({
//               className: 'leaflet-grid-label',
//               iconAnchor: new L.Point(-30, 12),
//               html: `<div class="grid-label-1000m">${leftNorthingIterator.toString().slice(2, -3)}</div>`,
//             }),
//           });

//           // Set labels that are only greater than 1000m from the SE corner, that way they don't overlap the easting labels
//           if (leftNorthingGrid1000MLabel.getLatLng().distanceTo(map.getBounds().getSouthWest()) >= this.options.gridInterval) {
//             if (map.getBounds().pad(0.1).contains(leftNorthingGrid1000MLabelCoords)) {
//               // this.options.layerGroup1000mLabels.addLayer(leftNorthingGrid1000MLabel);
//               // this.addLayer(leftNorthingGrid1000MLabel);
//               this.gridLabels.push(leftNorthingGrid1000MLabel);
//             }
//           }
//         }
//       }
//       leftNorthingIterator += 1;
//     }

//     return this.generateSplitGrids('left', NWBounds);
//   },

//   right(NEBounds, noAdjacentGZD = false) {
//     let swRight;
//     if (noAdjacentGZD) {
//       swRight = LLtoUTM({ lat: this.options.bounds.south, lon: this.options.bounds.west });
//     } else {
//       swRight = LLtoUTM({ lat: this.options.bounds.south, lon: eastingDict[NEBounds.zoneNumber].left });
//     }

//     const neRight = LLtoUTM({ lat: this.options.bounds.north, lon: this.options.bounds.east });
//     const seRight = LLtoUTM({ lat: this.options.bounds.south, lon: this.options.bounds.east });
//     let rightEastingIterator = swRight.easting;
//     let rightNorthingIterator = swRight.northing;

//     //* Right Side Easting */
//     while (rightEastingIterator <= seRight.easting) {
//       if (rightEastingIterator % this.options.gridInterval === 0) {
//         this.eastingArray.push({
//           easting: rightEastingIterator,
//           zoneNumber: seRight.zoneNumber,
//           zoneLetter: seRight.zoneLetter,
//         });

//         if (this.options.enableLabels) {
//           // Put the easting grid line label at the bottom of the map
//           const rightEastingGrid1000MLabelCoords = UTMtoLL({
//             easting: rightEastingIterator,
//             northing: LLtoUTM(map.getBounds().getSouthWest()).northing + (rightEastingIterator / this.options.gridInterval % 100),
//             zoneNumber: seRight.zoneNumber,
//             zoneLetter: seRight.zoneLetter,
//           });

//           const rightEastingGrid1000MLabel = new L.Marker(rightEastingGrid1000MLabelCoords, {
//             interactive: false,
//             icon: new L.DivIcon({
//               className: 'leaflet-grid-label',
//               iconAnchor: new L.Point(12, 30),
//               html: `<div class="grid-label-1000m">${rightEastingIterator.toString().slice(1, -3)}</div>`,
//             }),
//           });

//           // Make sure that the label is within the visible bounds of the map
//           if (map.getBounds().pad(0.1).contains(rightEastingGrid1000MLabelCoords)) {
//             // this.options.layerGroup1000mLabels.addLayer(rightEastingGrid1000MLabel);
//             // this.addLayer(rightEastingGrid1000MLabel);
//             this.gridLabels.push(rightEastingGrid1000MLabel);
//           }
//         }
//       }
//       rightEastingIterator += 1;
//     }

//     //* Right Side Northing */
//     while (rightNorthingIterator <= neRight.northing) {
//       if (rightNorthingIterator % this.options.gridInterval === 0) {
//         this.northingArray.push({
//           northing: rightNorthingIterator,
//           zoneNumber: neRight.zoneNumber,
//           zoneLetter: neRight.zoneLetter,
//         });

//         if (this.options.enableLabels) {
//           const rightNorthingGrid1000MLabelCoords = UTMtoLL({
//             easting: LLtoUTM(map.getBounds().getNorthEast()).easting - (rightNorthingIterator / this.options.gridInterval % 100),
//             northing: rightNorthingIterator,
//             zoneNumber: neRight.zoneNumber,
//             zoneLetter: neRight.zoneLetter,
//           });

//           const rightNorthingGrid1000MLabel = new L.Marker(rightNorthingGrid1000MLabelCoords, {
//             interactive: false,
//             icon: new L.DivIcon({
//               className: 'leaflet-grid-label',
//               iconAnchor: new L.Point(50, 12),
//               html: `<div class="grid-label-1000m">${rightNorthingIterator.toString().slice(2, -3)}</div>`,
//             }),
//           });

//           // Set labels that are only greater than 1000m from the SE corner, that way they don't overlap the easting labels
//           if (rightNorthingGrid1000MLabel.getLatLng().distanceTo(map.getBounds().getSouthEast()) >= this.options.gridInterval) {
//             if (map.getBounds().pad(0.1).contains(rightNorthingGrid1000MLabelCoords)) {
//               // this.options.layerGroup1000mLabels.addLayer(rightNorthingGrid1000MLabel);
//               // this.addLayer(rightNorthingGrid1000MLabel);
//               this.gridLabels.push(rightNorthingGrid1000MLabel);
//             }
//           }
//         }
//       }
//       rightNorthingIterator += 1;
//     }
//     this.generateSplitGrids('right', NEBounds);
//   },


//   generateSplitGrids(direction, bounds) {
//     this.direction = direction;
//     this.bounds = bounds;
//     const gridLines = [];
//     Object.entries(this.northingArray).forEach((e) => {
//       const bottomNorthing = e[1];
//       const bottomRow = this.eastingArray.map((j) => [j, bottomNorthing]);
//       const emptyBottomRowArr = [];

//       bottomRow.forEach((k) => {
//         const northingGrids1000Meters = UTMtoLL({
//           northing: k[1].northing,
//           easting: k[0].easting,
//           zoneNumber: k[0].zoneNumber,
//           zoneLetter: k[0].zoneLetter,
//         });

//         if (map.getBounds().pad(getPaddingOnZoomLevel1000Meters()).contains(northingGrids1000Meters)) {
//           emptyBottomRowArr.push(northingGrids1000Meters);
//         }
//       });

//       for (let index = 0; index < emptyBottomRowArr.length; index += 1) {
//         const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
//         switch (this.direction) {
//           case 'left':
//             // element[1] ensures that each element in the loop has 2 arrays. If there is only 1 array then it's the "odd-man-out" so we disregard it
//             // element[1].lon <= eastingDict[NWBounds.zoneNumber].right - 0.000000001 ensures that the lines will not go over the GZD boundaries
//             if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
//               const northingLineLeft = new L.Polyline([element], this.options.lineStyle);
//               // this.options.layerGroup1000m.addLayer(northingLineLeft);
//               // this.addLayer(northingLineLeft);
//               gridLines.push(northingLineLeft);
//               // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
//               // Convert the Polyline element to a LatLng so we can use the distanceTo() method
//               const finalNorthingLineLeft = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
//               // If any Polylines are less than 1000 meters away from the GZD, we can then start connecting them
//               if (finalNorthingLineLeft.distanceTo({ lat: element[1].lat, lng: eastingDict[this.bounds.zoneNumber].right - 0.000000001 }) <= this.options.gridInterval) {
//                 const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLineLeft.lat, lon: eastingDict[this.bounds.zoneNumber].right - 0.000000001 });
//                 const extendedLine = UTMtoLL({
//                   northing: Math.round(gridLineEndpoint.northing / this.options.gridInterval) * this.options.gridInterval,
//                   easting: gridLineEndpoint.easting,
//                   zoneNumber: gridLineEndpoint.zoneNumber,
//                   zoneLetter: gridLineEndpoint.zoneLetter,
//                 });
//                 const northingLineLeftToGZD = new L.Polyline([extendedLine, finalNorthingLineLeft], this.options.lineStyle);
//                 // this.options.layerGroup1000m.addLayer(northingLineLeftToGZD);
//                 // this.addLayer(northingLineLeftToGZD);
//                 gridLines.push(northingLineLeftToGZD);
//               }
//             }
//             break;
//           case 'right':
//             if (element[1] && element[0].lon >= eastingDict[this.bounds.zoneNumber].left) {
//               const northingLineRight = new L.Polyline([element], this.options.lineStyle);
//               // this.options.layerGroup1000m.addLayer(northingLineRight);
//               // this.addLayer(northingLineRight);
//               gridLines.push(northingLineRight);
//               // Since element[0] starts on the left, we use that to test if the polyline is extending over the GZD bounds
//               const finalNorthingLineRight = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
//               // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
//               // Convert the Polyline element to a LatLng so we can use the distanceTo() method
//               if (finalNorthingLineRight.distanceTo({ lat: element[0].lat, lng: eastingDict[this.bounds.zoneNumber].left }) < this.options.gridInterval) {
//                 const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLineRight.lat, lon: eastingDict[this.bounds.zoneNumber].left });
//                 const extendedLine = UTMtoLL({
//                   northing: Math.round(gridLineEndpoint.northing / this.options.gridInterval) * this.options.gridInterval,
//                   easting: gridLineEndpoint.easting,
//                   zoneNumber: gridLineEndpoint.zoneNumber,
//                   zoneLetter: gridLineEndpoint.zoneLetter,
//                 });
//                 const northingLineRightToGZD = new L.Polyline([extendedLine, finalNorthingLineRight], this.options.lineStyle);
//                 // this.options.layerGroup1000m.addLayer(northingLineRightToGZD);
//                 // this.addLayer(northingLineRightToGZD);
//                 gridLines.push(northingLineRightToGZD);
//               }
//             }
//             break;
//           default:
//             break;
//         }
//       }
//     });

//     Object.entries(this.eastingArray).forEach((e) => {
//       const bottomEasting = e[1];
//       const bottomRow = this.northingArray.map((j) => [j, bottomEasting]);
//       const emptyBottomRowArr = [];

//       bottomRow.forEach((k) => {
//         const eastingGrids1000Meters = UTMtoLL({
//           northing: k[0].northing,
//           easting: k[1].easting,
//           zoneNumber: k[0].zoneNumber,
//           zoneLetter: k[0].zoneLetter,
//         });
//         if (map.getBounds().pad(getPaddingOnZoomLevel1000Meters()).contains(eastingGrids1000Meters)) {
//           emptyBottomRowArr.push(eastingGrids1000Meters);
//         }
//       });

//       for (let index = 0; index < emptyBottomRowArr.length; index += 1) {
//         const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
//         switch (this.direction) {
//           case 'left':
//             if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
//               const eastingLineLeft = new L.Polyline([element], this.options.lineStyle);
//               // this.options.layerGroup1000m.addLayer(eastingLineLeft);
//               // this.addLayer(eastingLineLeft);
//               gridLines.push(eastingLineLeft);
//             }
//             break;
//           case 'right':
//             if (element[1] && element[1].lon >= eastingDict[this.bounds.zoneNumber].left) {
//               const eastingLineRight = new L.Polyline([element], this.options.lineStyle);
//               // this.options.layerGroup1000m.addLayer(eastingLineRight);
//               // this.addLayer(eastingLineRight);
//               gridLines.push(eastingLineRight);
//             }
//             break;
//           default:
//             break;
//         }
//       }
//     });

//     // All the Polylines are now in this group, we can add it to the map
//     // this.options.layerGroup1000m.addTo(this.map);
//     // this.options.layerGroup1000mLabels.addTo(this.map);
//     // return this;
//     // this.addLayer(this.options.layerGroup1000mLabels);
//     // this.addLayer(this.options.layerGroup1000m);
//     return gridLines;
//   },

//   _update() {
//     // To reposition the layer after a zoom, the _update method first recalculates the screen coordinates of the layer with the latLngToLayerPoint
//     const position = this._map.latLngToLayerPoint(this._latLng);
//     // Recalculate position of container
//     L.DomUtil.setPosition(this._container, position);
//     // Add/remove/reposition children elements if needed
//   },

//   getPaddingOnZoomLevel1000Meters() {
//     const zoom = map.getZoom();
//     if (zoom >= 18) {
//       return 4;
//     }
//     switch (zoom) {
//       case 17:
//         return 1.5;
//       case 16:
//         return 0.75;
//       case 15:
//         return 0.4;
//       case 14:
//         return 0.18;
//       case 13:
//         return 0.1;
//       case 12:
//         return 0.04;
//       default:
//         break;
//     }
//     return this;
//   },

// });
// // The standard Leaflet plugin creation pattern is to implement a factory function that enables the creation of the plugin to be chained with other function calls:
// // The common convention is to name the factory function after the class of the your plugin but make the first letter lower case.
// L.mgrs1000meters = function (options) {
//   return new L.MGRS1000Meters(options);
// };

// L.mgrs1000meters({ color: 'red' }).addTo(map);


L.OSGraticule = L.LayerGroup.extend({
  options: {
    gridInterval: 1000,
    showLabels: true,
    redraw: 'move',
    maxZoom: 18,
    minZoom: 12,
    gridLetterStyle: 'color: black; font-size:12px;',
  },

  lineStyle: {
    color: 'black',
    weight: 1,
    opacity: 0.5,
    interactive: false,
    clickable: false, // legacy support
    fill: false,
    noClip: true,
    smoothFactor: 4,
    lineCap: 'butt',
    lineJoin: 'miter-clip',
  },


  initialize(options) {
    L.LayerGroup.prototype.initialize.call(this);
    L.Util.setOptions(this, options);
  },

  onAdd(map) {
    this._map = map;
    const graticule = this.redraw();
    this._map.on(`viewreset ${this.options.redraw}`, graticule.redraw, graticule);
    this.eachLayer(map.addLayer, map);
  },

  onRemove(map) {
    map.off(`viewreset ${this.options.redraw}`, this.map);
    this.eachLayer(this.removeLayer, this);
  },

  hide() {
    this.options.hidden = true;
    this.redraw();
  },

  show() {
    this.options.hidden = false;
    this.redraw();
  },

  redraw() {
    this._bounds = this._map.getBounds().pad(getPaddingOnZoomLevel1000Meters());
    this.clearLayers();
    const currentZoom = this._map.getZoom();

    if ((currentZoom >= this.options.minZoom) && (currentZoom <= this.options.maxZoom)) {
      // get all corners
      const NEBounds = LLtoUTM({ lat: this._bounds.getNorth(), lon: this._bounds.getEast() });
      const NWBounds = LLtoUTM({ lat: this._bounds.getNorth(), lon: this._bounds.getWest() });
      const SEBounds = LLtoUTM({ lat: this._bounds.getSouth(), lon: this._bounds.getEast() });
      const SWBounds = LLtoUTM({ lat: this._bounds.getSouth(), lon: this._bounds.getWest() });
      // let noAdjacentGZD = false;
      // this.right(NEBounds, noAdjacentGZD = true);
      this.constructLines(this._bounds);
    }

    return this;
  },

  getOSMins() {
    // rounds up to nearest multiple of x
    const s = this.options.gridInterval;
    const nw = LLtoUTM({ lat: this._bounds.getNorth(), lon: this._bounds.getWest() });
    return {
      easting: Math.floor(nw.easting / s) * s,
      northing: Math.floor(nw.northing / s) * s,
      zoneNumber: nw.zoneNumber,
      zoneLetter: nw.zoneLetter,
    };
  },

  getOSLineCounts() {
    const s = this.options.gridInterval;
    const nw = LLtoUTM({ lat: this._bounds.getNorth(), lon: this._bounds.getWest() });
    const ne = LLtoUTM({ lat: this._bounds.getNorth(), lon: this._bounds.getEast() });
    const sw = LLtoUTM({ lat: this._bounds.getSouth(), lon: this._bounds.getWest() });
    return {
      x: Math.ceil((ne.easting - nw.easting) / s),
      y: Math.ceil((nw.northing - sw.northing) / s),
    };
  },

  constructLines(bounds) {
    const s = this.options.gridInterval;

    const mins = this.getOSMins();
    const counts = this.getOSLineCounts();

    const lines = new Array();
    const labels = new Array();

    //  for vertical lines
    for (let i = 0; i <= counts.x; i++) {
      const e = mins.easting + (s * i);
      const n = mins.northing;

      const topLL = UTMtoLL({
        northing: n,
        easting: e,
        zoneNumber: mins.zoneNumber,
        zoneLetter: mins.zoneLetter,
      });

      const bottomLL = UTMtoLL({
        northing: n - (counts.y * s),
        easting: e,
        zoneNumber: mins.zoneNumber,
        zoneLetter: mins.zoneLetter,
      });

      // var topLL = OSGridToLatLong(e, n);
      // var bottomLL = OSGridToLatLong(e, n - (counts.y * s));
      const line = new L.Polyline([bottomLL, topLL], this.lineStyle);
      lines.push(line);

      // if (this.options.showLabels) {
      //   labels.push(this.buildXLabel(topLL, gridrefNumToLet(e, n, 4).e));
      // }
    }
    // for horizontal lines
    for (let i = 0; i <= counts.y; i++) {
      const e = mins.easting;
      const n = mins.northing - (s * i);
      const leftLL = UTMtoLL({
        northing: n,
        easting: e,
        zoneNumber: mins.zoneNumber,
        zoneLetter: mins.zoneLetter,
      });
      const rightLL = UTMtoLL({
        northing: n,
        easting: e + (counts.x * s),
        zoneNumber: mins.zoneNumber,
        zoneLetter: mins.zoneLetter,
      });
      // var leftLL = OSGridToLatLong(e, n);
      // var rightLL = OSGridToLatLong(e + (counts.x * s) , n);
      // var line = new L.Polyline([leftLL, rightLL], this.lineStyle);
      const line = new L.Polyline([leftLL, rightLL], this.lineStyle);
      lines.push(line);
      if (this.options.showLabels) {
        labels.push(this.buildYLabel(leftLL, n.toString().slice(2, -3)));
      }
    }
    //! Previous lines drawn: 553
    lines.forEach(this.addLayer, this);
    labels.forEach(this.addLayer, this);
  },

  right(NEBounds, noAdjacentGZD = false) {
    this.northingArray = [];
    this.eastingArray = [];
    this.gridLabels = [];
    const s = this.options.gridInterval;

    const mins = this.getOSMins();
    const counts = this.getOSLineCounts();

    const lines = new Array();
    const labels = new Array();

    //  for vertical lines
    for (let i = 0; i <= counts.x; i++) {
      const e = mins.easting + (s * i);
      const n = mins.northing;

      const topLL = UTMtoLL({
        northing: n,
        easting: e,
        zoneNumber: mins.zoneNumber,
        zoneLetter: mins.zoneLetter,
      });

      const bottomLL = UTMtoLL({
        northing: n - (counts.y * s),
        easting: e,
        zoneNumber: mins.zoneNumber,
        zoneLetter: mins.zoneLetter,
      });

      // var topLL = OSGridToLatLong(e, n);
      // var bottomLL = OSGridToLatLong(e, n - (counts.y * s));
      const line = new L.Polyline([bottomLL, topLL], {
        color: 'pink',
        weight: 4,
        opacity: 0.85,
        interactive: false,
        clickable: false, // legacy support
        fill: false,
        noClip: true,
        smoothFactor: 4,
        lineCap: 'butt',
        lineJoin: 'miter-clip',
      });
      lines.push(line);

      // if (this.options.showLabels) {
      //   labels.push(this.buildXLabel(topLL, gridrefNumToLet(e, n, 4).e));
      // }
    }
    // for horizontal lines
    for (let i = 0; i <= counts.y; i++) {
      const e = mins.easting;
      const n = mins.northing - (s * i);
      const leftLL = UTMtoLL({
        northing: n,
        easting: e,
        zoneNumber: mins.zoneNumber,
        zoneLetter: mins.zoneLetter,
      });
      const rightLL = UTMtoLL({
        northing: n,
        easting: e + (counts.x * s),
        zoneNumber: mins.zoneNumber,
        zoneLetter: mins.zoneLetter,
      });
      // var leftLL = OSGridToLatLong(e, n);
      // var rightLL = OSGridToLatLong(e + (counts.x * s) , n);
      // var line = new L.Polyline([leftLL, rightLL], this.lineStyle);
      const line = new L.Polyline([leftLL, rightLL], {
        color: 'pink',
        weight: 4,
        opacity: 0.85,
        interactive: false,
        clickable: false, // legacy support
        fill: false,
        noClip: true,
        smoothFactor: 4,
        lineCap: 'butt',
        lineJoin: 'miter-clip',
      });
      lines.push(line);

      // if (this.options.showLabels) {
      //   labels.push(this.buildYLabel(leftLL, gridrefNumToLet(e, n, 4).n));
      // }
    }
    //! Previous lines drawn: 553
    // lines.forEach(this.addLayer, this);

    let swRight;
    if (noAdjacentGZD) {
      swRight = LLtoUTM({ lat: this._bounds.getSouth(), lon: this._bounds.getWest() });
    } else {
      swRight = LLtoUTM({ lat: this._bounds.getSouth(), lon: eastingDict[NEBounds.zoneNumber].left });
    }


    const neRight = LLtoUTM({ lat: this._bounds.getNorth(), lon: this._bounds.getEast() });
    const seRight = LLtoUTM({ lat: this._bounds.getSouth(), lon: this._bounds.getEast() });
    let rightEastingIterator = swRight.easting;
    let rightNorthingIterator = swRight.northing;

    //* Right Side Easting */
    while (rightEastingIterator <= seRight.easting) {
      if (rightEastingIterator % this.options.gridInterval === 0) {
        this.eastingArray.push({
          easting: rightEastingIterator,
          zoneNumber: seRight.zoneNumber,
          zoneLetter: seRight.zoneLetter,
        });

        if (this.options.enableLabels) {
          // Put the easting grid line label at the bottom of the map
          const rightEastingGrid1000MLabelCoords = UTMtoLL({
            easting: rightEastingIterator,
            northing: LLtoUTM(map.getBounds().getSouthWest()).northing + (rightEastingIterator / this.options.gridInterval % 100),
            zoneNumber: seRight.zoneNumber,
            zoneLetter: seRight.zoneLetter,
          });

          const rightEastingGrid1000MLabel = new L.Marker(rightEastingGrid1000MLabelCoords, {
            interactive: false,
            icon: new L.DivIcon({
              className: 'leaflet-grid-label',
              iconAnchor: new L.Point(12, 30),
              html: `<div class="grid-label-1000m">${rightEastingIterator.toString().slice(1, -3)}</div>`,
            }),
          });

          // Make sure that the label is within the visible bounds of the map
          if (map.getBounds().pad(0.1).contains(rightEastingGrid1000MLabelCoords)) {
            // this.options.layerGroup1000mLabels.addLayer(rightEastingGrid1000MLabel);
            // this.addLayer(rightEastingGrid1000MLabel);
            this.gridLabels.push(rightEastingGrid1000MLabel);
          }
        }
      }
      rightEastingIterator += 1;
    }

    //* Right Side Northing */
    while (rightNorthingIterator <= neRight.northing) {
      if (rightNorthingIterator % this.options.gridInterval === 0) {
        this.northingArray.push({
          northing: rightNorthingIterator,
          zoneNumber: neRight.zoneNumber,
          zoneLetter: neRight.zoneLetter,
        });

        if (this.options.enableLabels) {
          const rightNorthingGrid1000MLabelCoords = UTMtoLL({
            easting: LLtoUTM(map.getBounds().getNorthEast()).easting - (rightNorthingIterator / this.options.gridInterval % 100),
            northing: rightNorthingIterator,
            zoneNumber: neRight.zoneNumber,
            zoneLetter: neRight.zoneLetter,
          });

          const rightNorthingGrid1000MLabel = new L.Marker(rightNorthingGrid1000MLabelCoords, {
            interactive: false,
            icon: new L.DivIcon({
              className: 'leaflet-grid-label',
              iconAnchor: new L.Point(50, 12),
              html: `<div class="grid-label-1000m">${rightNorthingIterator.toString().slice(2, -3)}</div>`,
            }),
          });

          // Set labels that are only greater than 1000m from the SE corner, that way they don't overlap the easting labels
          if (rightNorthingGrid1000MLabel.getLatLng().distanceTo(map.getBounds().getSouthEast()) >= this.options.gridInterval) {
            if (map.getBounds().pad(0.1).contains(rightNorthingGrid1000MLabelCoords)) {
              // this.options.layerGroup1000mLabels.addLayer(rightNorthingGrid1000MLabel);
              // this.addLayer(rightNorthingGrid1000MLabel);
              this.gridLabels.push(rightNorthingGrid1000MLabel);
            }
          }
        }
      }
      rightNorthingIterator += 1;
    }

    // this.northingArray.forEach(this.addLayer, this);
    // this.eastingArray.forEach(this.addLayer, this);
    // this.addLayer(this.generateSplitGrids('right', NEBounds));
    this.generateSplitGrids('right', NEBounds).forEach(this.addLayer, this);
    this.gridLabels.forEach(this.addLayer, this);
    // this.generateSplitGrids('right', NEBounds);
  },

  generateSplitGrids(direction, bounds) {
    this.direction = direction;
    this.bounds = bounds;
    const gridLines = [];
    Object.entries(this.northingArray).forEach((e) => {
      const bottomNorthing = e[1];
      const bottomRow = this.eastingArray.map((j) => [j, bottomNorthing]);
      const emptyBottomRowArr = [];

      bottomRow.forEach((k) => {
        const northingGrids1000Meters = UTMtoLL({
          northing: k[1].northing,
          easting: k[0].easting,
          zoneNumber: k[0].zoneNumber,
          zoneLetter: k[0].zoneLetter,
        });

        if (map.getBounds().pad(getPaddingOnZoomLevel1000Meters()).contains(northingGrids1000Meters)) {
          emptyBottomRowArr.push(northingGrids1000Meters);
        }
      });

      for (let index = 0; index < emptyBottomRowArr.length; index += 1) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        switch (this.direction) {
          case 'left':
            // element[1] ensures that each element in the loop has 2 arrays. If there is only 1 array then it's the "odd-man-out" so we disregard it
            // element[1].lon <= eastingDict[NWBounds.zoneNumber].right - 0.000000001 ensures that the lines will not go over the GZD boundaries
            if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
              const northingLineLeft = new L.Polyline([element], this.lineStyle);
              // this.options.layerGroup1000m.addLayer(northingLineLeft);
              // this.addLayer(northingLineLeft);
              gridLines.push(northingLineLeft);
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              const finalNorthingLineLeft = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              // If any Polylines are less than 1000 meters away from the GZD, we can then start connecting them
              if (finalNorthingLineLeft.distanceTo({ lat: element[1].lat, lng: eastingDict[this.bounds.zoneNumber].right - 0.000000001 }) <= this.options.gridInterval) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLineLeft.lat, lon: eastingDict[this.bounds.zoneNumber].right - 0.000000001 });
                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / this.options.gridInterval) * this.options.gridInterval,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });
                const northingLineLeftToGZD = new L.Polyline([extendedLine, finalNorthingLineLeft], this.lineStyle);
                // this.options.layerGroup1000m.addLayer(northingLineLeftToGZD);
                // this.addLayer(northingLineLeftToGZD);
                gridLines.push(northingLineLeftToGZD);
              }
            }
            break;
          case 'right':
            if (element[1] && element[0].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const northingLineRight = new L.Polyline([element], this.lineStyle);
              // this.options.layerGroup1000m.addLayer(northingLineRight);
              // this.addLayer(northingLineRight);
              gridLines.push(northingLineRight);
              // Since element[0] starts on the left, we use that to test if the polyline is extending over the GZD bounds
              const finalNorthingLineRight = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              if (finalNorthingLineRight.distanceTo({ lat: element[0].lat, lng: eastingDict[this.bounds.zoneNumber].left }) < this.options.gridInterval) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLineRight.lat, lon: eastingDict[this.bounds.zoneNumber].left });
                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / this.options.gridInterval) * this.options.gridInterval,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });
                const northingLineRightToGZD = new L.Polyline([extendedLine, finalNorthingLineRight], this.lineStyle);
                // this.options.layerGroup1000m.addLayer(northingLineRightToGZD);
                // this.addLayer(northingLineRightToGZD);
                gridLines.push(northingLineRightToGZD);
              }
            }
            break;
          default:
            break;
        }
      }
    });

    Object.entries(this.eastingArray).forEach((e) => {
      const bottomEasting = e[1];
      const bottomRow = this.northingArray.map((j) => [j, bottomEasting]);
      const emptyBottomRowArr = [];

      bottomRow.forEach((k) => {
        const eastingGrids1000Meters = UTMtoLL({
          northing: k[0].northing,
          easting: k[1].easting,
          zoneNumber: k[0].zoneNumber,
          zoneLetter: k[0].zoneLetter,
        });
        if (map.getBounds().pad(getPaddingOnZoomLevel1000Meters()).contains(eastingGrids1000Meters)) {
          emptyBottomRowArr.push(eastingGrids1000Meters);
        }
      });

      for (let index = 0; index < emptyBottomRowArr.length; index += 1) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        switch (this.direction) {
          case 'left':
            if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
              const eastingLineLeft = new L.Polyline([element], this.lineStyle);
              // this.options.layerGroup1000m.addLayer(eastingLineLeft);
              // this.addLayer(eastingLineLeft);
              gridLines.push(eastingLineLeft);
            }
            break;
          case 'right':
            if (element[1] && element[1].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const eastingLineRight = new L.Polyline([element], this.lineStyle);
              // this.options.layerGroup1000m.addLayer(eastingLineRight);
              // this.addLayer(eastingLineRight);
              gridLines.push(eastingLineRight);
            }
            break;
          default:
            break;
        }
      }
    });

    // All the Polylines are now in this group, we can add it to the map
    // this.options.layerGroup1000m.addTo(this.map);
    // this.options.layerGroup1000mLabels.addTo(this.map);
    // return this;
    // this.addLayer(this.options.layerGroup1000mLabels);
    // this.addLayer(this.options.layerGroup1000m);

    return gridLines;
  },


  // buildXLabel: function(pos, label) {
  //   var bounds = this._map.getBounds().pad(-0.001);
  //   pos.lat = bounds.getNorth();

  //   return L.marker(pos, {
  //     interactive: false,
  //     clickable: false, //legacy support
  //     icon: L.divIcon({
  //       iconSize: [0, 0],
  //       iconAnchor: [-10, 0],
  //       className: 'leaflet-grid-label',
  //       html: '<div style="'+ this.options.gridLetterStyle + '">' + label + '</div>'
  //     })
  //   });
  // },

  buildYLabel(pos, label) {
    const bounds = this._map.getBounds().pad(-0.001);
    pos.lng = bounds.getWest();

    return L.marker(pos, {
      interactive: false,
      clickable: false, // legacy support
      icon: L.divIcon({
        iconSize: [0, 0],
        iconAnchor: [-5, 12],
        className: 'leaflet-grid-label',
        html: `<div class="grid-label-1000m" style="${this.options.gridLetterStyle}">${label}</div>`,
      }),
    });
  },

  getPaddingOnZoomLevel1000Meters() {
    const zoom = map.getZoom();
    if (zoom >= 18) {
      return 4;
    }
    switch (zoom) {
      case 17:
        return 1.5;
      case 16:
        return 0.75;
      case 15:
        return 0.4;
      case 14:
        return 0.18;
      case 13:
        return 0.1;
      case 12:
        return 0.04;
      default:
        break;
    }
    return this;
  },


});

L.osGraticule = function (options) {
  return new L.OSGraticule(options);
};

const options = {
  enableLabels: true,
};
L.osGraticule(options).addTo(map);
//! END PLUGIN TEST


// *********************************************************************************** //
// * Event Listeners                                                                 * //
// *********************************************************************************** //
map.addEventListener('moveend', () => {
  // removes and adds the 100k grids to the map on moveend
  generate100KGrids.regenerate();
  // removes and adds the 100m meter grids to the map on moveend
  // generate1000meterGrids.regenerate();
  // const generate1000meterGrids3 = (val) => new Grid1000M(val);
  // generate1000meterGrids3(document.querySelector('#myonoffswitch').hasAttribute('checked')).determineGrids();
  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
    document.querySelector('.numberOfLayers > .div6').innerHTML = `${document.querySelectorAll('.leaflet-grid-label').length}`;
  }, 300);
}, { once: true });

// Add the layer data when the page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
    document.querySelector('.numberOfLayers > .div6').innerHTML = `${document.querySelectorAll('.leaflet-grid-label').length}`;
    document.querySelector('#myonoffswitch').toggleAttribute('checked');
  }, 300);
});

//! Bug: When ticked, the grid labels will be removed. However when a user moves a map, the labels show up again.
// document.querySelector('#myonoffswitch').addEventListener('change', (event) => {
//   const checkbox = event.target;
//   //! I wonder if it is because I am instantiating a new class that the labels keep showing up.
//   const generate1000meterGrids2 = (val) => new Grid1000M(val);
//   generate1000meterGrids2(checkbox.checked).cleaner();
//   if (checkbox.checked) {
//     document.querySelector('#myonoffswitch').toggleAttribute('checked');
//   } else {
//     document.querySelector('#myonoffswitch').toggleAttribute('checked');
//   }
// });


export { map };
