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
const northOfSvalbard = [83.02621885344846, 15.402832031250002]; // use zoom 6
const map = L.map('map').setView(norway, 7);
const cc = document.querySelector('.cursorCoordinates');
window.map = map;
// Just a quicker way to add a marker
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
  if (map.getZoom() >= 17) {
    return 3;
  }
  if (map.getZoom() < 17 && map.getZoom() >= 15) {
    return 1;
  }
  if (map.getZoom() <= 14 && map.getZoom() >= 12) {
    return 0.15;
  }
  return 0.1;
}
//! Issues:
//! Grids fail to draw completely in high northern areas (eg- Northern Canada)
//! Grids fail at the equator (sometimes failing miserably)
//! Grids fail around Antarctica
//! Grids fail around Iceland
//! Grids fail on GZD 31U (This is one of those "special" case grid zones)
//! Grids fail between GZD 31V and 32V (another special case zone)
//! Basically anything above Latitude 64 throws tons of errors, the northingLine Polyline keeps protruding past it's Grid Zone boundaries. This isn't noticeable at latitudes below Iceland but it gets worse as you pan up northwards
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
    this.lineStyle = {
      color: 'black',
      weight: 4,
      opacity: 0.5,
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
    };
    this.greenLine = {
      color: 'green',
      weight: 8,
      opacity: 0.25,
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
    };
    this.orangeLine = {
      color: 'orange',
      weight: 8,
      opacity: 0.5,
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
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
    return this;
  };


  // Returns the visible grids on the map and their bounds
  this.getVizGrids = function () {
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
    return this.prepGrids(this.uniqueVisibleGrids);
  };

  // Now that we have the visible grids, we can iterate over them
  this.prepGrids = function (uniqueVisibleGrids) {
    this.uniqueVisibleGrids = uniqueVisibleGrids;
    const visibleGridsIterator = new Map(Object.entries(this.uniqueVisibleGrids));

    // Not sure how useful this promise is. It works fine with just a forEach loop
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // console.log(visibleGridsIterator.values().next());
    delay(20).then(() => {
      this.generateGrids(visibleGridsIterator.values().next().value);
      return delay(3000);
    }).catch((err) => {
      console.log(err);
    });

    // visibleGridsIterator.forEach((grid) => {
    //   console.log(grid);
    //   delay(20)
    //     .then(() => {
    //       // This is where all the grids are generated.
    //       this.generateGrids(grid);
    //       return delay(3000);
    //     })
    //     .catch((err) => {
    //       console.error(err);
    //     });
    // });
  };

  this.generateGrids = function (data) {
    this.data = data;
    const emptyNorthingArray = [];
    const emptyEastingArray = [];
    Object.values(this.data).forEach((x, i) => {
      // Get the corners of the visible grids and convert them from latlon to UTM
      const neLeft = LLtoUTM({ lat: x.top - 0.00001, lon: x.right - 0.00001 });
      // emptyNorthingArray.push(neLeft.northing);
      const seLeft = LLtoUTM({ lat: x.bottom, lon: x.right - 0.00001 });
      const swLeft = LLtoUTM({ lat: x.bottom, lon: x.left });


      if (this.data[i + 1] && x.letterID === this.data[i].letterID) {
        const sw = LLtoUTM({ lat: x.bottom, lon: x.left + 0.0001 });
        const se = LLtoUTM({ lat: x.bottom, lon: x.right - 0.00001 });
        //! 15JAN - x.top could be this.north. This would cut down on your polylines
        const ne = LLtoUTM({ lat: x.top - 0.00001, lon: x.right - 0.00001 });

        // console.log(sw, ne); // 7100467 - 7991508

        emptyNorthingArray.push(sw, ne);
        emptyEastingArray.push(sw, se);
      } else {
        // const toptop = x.top >= this.north ? this.north : x.top;
        // console.table({ XTOP: x.top, THISNORTH: this.north, TOPTOP: toptop });
        // This return statement prevents duplicate data getting pushed to the arrays
        return;
      }


      const leftEastingIterator = swLeft.easting;
      const leftNorthingIterator = swLeft.northing;


      if (emptyEastingArray.length > 1) {
        const min = emptyEastingArray[0].easting;
        const max = emptyEastingArray[1].easting;
        let iterator = min;
        while (iterator <= max) {
          if (iterator % this.gridInterval === 0) {
            this.eastingArray.push({
              easting: iterator,
              zoneNumber: emptyEastingArray[0].zoneNumber,
              zoneLetter: emptyEastingArray[0].zoneLetter,
            });
          }
          iterator += 1;
        }
      }

      //* Left Side Easting */
      // while (leftEastingIterator <= seLeft.easting) {
      //   // This loop basically checks to make sure the grid easting is divisible by 100K
      //   // eg- "easting: 5200015" is a bad match
      //   // eg- "easting: 5200000" is a good match
      //   if (leftEastingIterator % this.gridInterval === 0) {
      //     for (let index = 0; index < this.data.length; index += 1) {
      //       const element1 = this.data[index];
      //       const element2 = this.data[index + 1];
      //       if (element2) {
      //         if (element1.letterID > element2.letterID) {
      //           this.eastingArray.push({
      //             easting: leftEastingIterator,
      //             zoneNumber: element1.id,
      //             zoneLetter: element1.letterID,
      //           });
      //         }
      //       }
      //     }


      //     // this.eastingArray.push({
      //     //   easting: leftEastingIterator,
      //     //   zoneNumber: seLeft.zoneNumber,
      //     //   zoneLetter: seLeft.zoneLetter,
      //     // });
      //   }
      //   leftEastingIterator += 1;
      // }


      if (emptyNorthingArray.length > 1) {
        const min = emptyNorthingArray[0].northing;
        const max = emptyNorthingArray[1].northing;
        // reducing the min by 500, this is to catch those annoying "mini" 100k grids
        let iterator = min - 500;
        while (iterator <= max) {
          if (iterator % this.gridInterval === 0) {
            this.northingArray.push({
              northing: iterator,
              zoneNumber: emptyNorthingArray[0].zoneNumber,
              zoneLetter: emptyNorthingArray[0].zoneLetter,
            });
          }
          iterator += 1;
        }
      }
      //* * Left Side Northing */
      // while (leftNorthingIterator <= neLeft.northing) {
      //   if (leftNorthingIterator % this.gridInterval === 0) {
      //     for (let index = 0; index < this.data.length; index += 1) {
      //       const element1 = this.data[index];
      //       const element2 = this.data[index + 1];
      //       if (element2) {
      //         if (element1.letterID) {
      //           this.northingArray.push({
      //             northing: leftNorthingIterator,
      //             zoneNumber: element1.id,
      //             zoneLetter: element1.letterID,
      //           });
      //         }
      //       }
      //     }


      //     // this.northingArray.push({
      //     //   northing: leftNorthingIterator,
      //     //   zoneNumber: neLeft.zoneNumber,
      //     //   zoneLetter: neLeft.zoneLetter,
      //     // });
      //   }
      //   leftNorthingIterator += 1;
      // }
    });

    //* Build the northing grid lines *//
    Object.entries(this.northingArray).forEach((na) => {
      const bottomNorthing = na[1];

      const bottomRow = this.eastingArray.map((j) => [j, bottomNorthing]);
      const emptyBottomRowArr = [];

      bottomRow.forEach((k) => {
        if (k[0].zoneLetter === k[1].zoneLetter) {
          emptyBottomRowArr.push(UTMtoLL({
            northing: k[1].northing,
            easting: k[0].easting,
            zoneNumber: k[0].zoneNumber,
            zoneLetter: k[0].zoneLetter,
          }));
        }


        // emptyBottomRowArr.push(UTMtoLL({
        //   northing: k[1].northing,
        //   easting: k[0].easting,
        //   zoneNumber: k[0].zoneNumber,
        //   zoneLetter: k[0].zoneLetter,
        // }));
      });


      // Log each visible GZD
      //! Would be interesting if I could just run this per GZD
      // console.log(`North: ${this.data[0].id}${this.data[0].letterID}, South: ${this.data[1].id}${this.data[1].letterID}`);

      // "emptyBottomRowArr.length / 2" prevents SOME lines from overlapping...idk
      // Removing the "/ 2" will cause the map to draw more polylines
      //! JAN15 - I removed the /2 and it worked. Try it again when all grids are firing
      for (let index = 0; index < emptyBottomRowArr.length / 2; index += 1) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        // Since element is an array of objects, check if the 2nd element is available in the array IOT generate a complete grid

        if (element[1]) {
          const northingLine = new L.Polyline([element], this.lineStyle);

          // If the east boundary of the northingLine is less than the right longitude of the GZD, etc...
          //! 15JAN - this if statement might be useless
          if (northingLine.getBounds().getEast() <= this.east + 0.25) {
            // This will prevent double lines from being drawn on the map
            // northingLine.getLatLngs()[0][0] = element[0] (left)
            // northingLine.getLatLngs()[0][1] = element[1] (right)
            if (northingLine.getLatLngs()[0][0].distanceTo(northingLine.getLatLngs()[0][1]) <= this.gridInterval) {
              if (northingLine.getBounds().getWest() >= this.west - 0.25) {
                this.layerGroup100k.addLayer(northingLine);
              }
            }

            // This will "connect" the 100k grid to the GZD. This is useful because not all 100k grids are 100k meters across
            // Convert the Polyline element to a LatLng so we can use the distanceTo() method
            const connectingNorthingLineWest = new L.latLng({ lat: element[0].lat, lng: element[0].lon });


            if (connectingNorthingLineWest.distanceTo({ lat: element[0].lat, lng: this.west }) <= this.gridInterval) {
              const eastingGridLineEndpoint = LLtoUTM({ lat: connectingNorthingLineWest.lat, lon: this.west });
              const extendedLineSouth = UTMtoLL({
                northing: Math.round(eastingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
                // easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
                easting: eastingGridLineEndpoint.easting,
                zoneNumber: eastingGridLineEndpoint.zoneNumber,
                zoneLetter: eastingGridLineEndpoint.zoneLetter,
              });

              const connectingNorthingLineWestToGZD = new L.Polyline([connectingNorthingLineWest, extendedLineSouth], this.lineStyle);
              // This ensures the connecting west line does not go past the GZD boundary

              if (connectingNorthingLineWestToGZD.getBounds().getWest() >= this.west) {
                // To see how the connecting lines work, just comment this out
                //! 15JAN - this if statement might be useless
                this.layerGroup100k.addLayer(connectingNorthingLineWestToGZD);
              }
            }


            // If any Polylines are less than 100k meters away from the GZD, we can then start connecting them
            // Object.values(this.data).forEach((w) => {
            //   if (connectingNorthingLineWest.distanceTo({ lat: element[0].lat, lng: w.left }) <= this.gridInterval) {
            //     const eastingGridLineEndpoint = LLtoUTM({ lat: connectingNorthingLineWest.lat, lon: w.left });
            //     const extendedLineSouth = UTMtoLL({
            //       northing: Math.round(eastingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
            //       // easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
            //       easting: eastingGridLineEndpoint.easting,
            //       zoneNumber: eastingGridLineEndpoint.zoneNumber,
            //       zoneLetter: eastingGridLineEndpoint.zoneLetter,
            //     });

            //     const connectingNorthingLineWestToGZD = new L.Polyline([connectingNorthingLineWest, extendedLineSouth], this.greenLine);
            //     // This ensures the connecting west line does not go past the GZD boundary

            //     if (connectingNorthingLineWestToGZD.getBounds().getWest() >= w.left) {
            //       // To see how the connecting lines work, just comment this out
            //       return this.layerGroup100k.addLayer(connectingNorthingLineWestToGZD);
            //     }


            //     // Alternative version
            //     // if (!connectingNorthingLineWestToGZD.getBounds().overlaps(northingLine.getBounds())) {
            //     //   return this.layerGroup100k.addLayer(connectingNorthingLineWestToGZD);
            //     // }
            //   }
            // });

            const connectingNorthingLineEast = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
            if (connectingNorthingLineEast.distanceTo({ lat: element[1].lat, lng: this.data[0].right }) <= this.gridInterval) {
              const eastingGridLineEndpoint = LLtoUTM({ lat: connectingNorthingLineEast.lat, lon: this.data[0].right });
              const extendedLineSouth = UTMtoLL({
                northing: Math.round(eastingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
                easting: eastingGridLineEndpoint.easting,
                zoneNumber: eastingGridLineEndpoint.zoneNumber,
                zoneLetter: eastingGridLineEndpoint.zoneLetter,
              });
              const connectingNorthingLineEastToGZD = new L.Polyline([connectingNorthingLineEast, extendedLineSouth], this.lineStyle);
              // e.top / 100 is some arbitrary padding BS I added.
              // example: if e.top = 39, then e.top / 100 is 0.39
              this.layerGroup100k.addLayer(connectingNorthingLineEastToGZD);
              // if (connectingNorthingLineEastToGZD.getBounds().getEast() <= e.right + (e.top / 100)) {
              //   // To see how the connecting lines work, just comment this out
              //   return this.layerGroup100k.addLayer(connectingNorthingLineEastToGZD);
              // }
            }


            // Object.values(this.data).forEach((e) => {
            //   // Multiply gridInterval by 1.5 because some 100k grids are not square shaped and are "fatter" on the bottom
            //   if (connectingNorthingLineEast.distanceTo({ lat: element[1].lat, lng: e.right }) <= this.gridInterval) {
            //     // console.count(); //24
            //     // console.log(connectingNorthingLineEast.distanceTo({ lat: element[1].lat, lng: e.right }));

            //     const eastingGridLineEndpoint = LLtoUTM({ lat: connectingNorthingLineEast.lat, lon: e.right });
            //     const extendedLineSouth = UTMtoLL({
            //       northing: Math.round(eastingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
            //       easting: eastingGridLineEndpoint.easting,
            //       zoneNumber: eastingGridLineEndpoint.zoneNumber,
            //       zoneLetter: eastingGridLineEndpoint.zoneLetter,
            //     });
            //     const connectingNorthingLineEastToGZD = new L.Polyline([connectingNorthingLineEast, extendedLineSouth], this.orangeLine);
            //     // e.top / 100 is some arbitrary padding BS I added.
            //     // example: if e.top = 39, then e.top / 100 is 0.39
            //     if (connectingNorthingLineEastToGZD.getBounds().getEast() <= e.right + (e.top / 100)) {
            //       // To see how the connecting lines work, just comment this out
            //       return this.layerGroup100k.addLayer(connectingNorthingLineEastToGZD);
            //     }
            //     // return this.layerGroup100k.addLayer(connectingNorthingLineEastToGZD);
            //   }
            // });
          }
        }
      }
    });

    //* Build the easting grid lines *//
    Object.entries(this.eastingArray).forEach((ea) => {
      // console.log(ea[1]);
      const bottomNorthing = ea[1];
      const bottomRow = this.northingArray.map((j) => [j, bottomNorthing]);
      const emptyBottomRowArr = [];

      bottomRow.forEach((k) => {
        if (k[0].zoneLetter === k[1].zoneLetter) {
          // console.log(k);
          emptyBottomRowArr.push(UTMtoLL({
            northing: k[0].northing,
            easting: k[1].easting,
            zoneNumber: k[0].zoneNumber,
            zoneLetter: k[0].zoneLetter,
          }));
        }
        // emptyBottomRowArr.push(UTMtoLL({
        //   northing: k[0].northing,
        //   easting: k[1].easting,
        //   zoneNumber: k[0].zoneNumber,
        //   zoneLetter: k[0].zoneLetter,
        // }));
      });

      for (let index = 0; index < emptyBottomRowArr.length; index += 1) {
        const { right } = this.data[0];
        const { left } = this.data[0];
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];

        // If element[1] exists and if element[1]'s latitude is less than the left boundary and greater than the right boundary (plus padding)
        if (element[1] && element[1].lon >= left - 0.01 && element[1].lon <= right + 0.01) {
          const eastingLine = new L.Polyline([element], this.lineStyle);

          if (eastingLine.getBounds().getSouth() >= this.south) {
            //! BUG: This works but the lines will draw over each other resulting in redundant polylines.
            //! There has to be a better way to simplify these lines
            // I do not know why dividing the gridInterval by 2 works, but it does
            if (eastingLine.getLatLngs()[0][0].distanceTo(eastingLine.getLatLngs()[0][1]) >= this.gridInterval / 2) {
              if (eastingLine.getBounds().getNorth() <= this.north + 1) {
                //! this is fucking stupid
                if (eastingLine.getLatLngs()[0][0].lng <= right) {
                  if (eastingLine.getLatLngs()[0][0].lng >= left) {
                    this.layerGroup100k.addLayer(eastingLine);
                  }
                }
              }
            }

            //! JAN15 - This should probably be renamed to connectingEastingLineSouth
            const connectingEastingLineNorth = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
            if (connectingEastingLineNorth.distanceTo({ lat: this.data[0].bottom, lng: element[0].lon }) <= this.gridInterval) {
              // this is the southern most point
              const eastingGridLineEndpoint = LLtoUTM({ lat: this.data[0].bottom, lon: connectingEastingLineNorth.lng });
              const extendedLineSouth = UTMtoLL({
                northing: eastingGridLineEndpoint.northing,
                // round the easting so it lines up with the bottom grid.
                easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
                zoneNumber: eastingGridLineEndpoint.zoneNumber,
                zoneLetter: eastingGridLineEndpoint.zoneLetter,
              });
              const connectingEastingLineNorthToGZD = new L.Polyline([connectingEastingLineNorth, extendedLineSouth], this.lineStyle);
              this.layerGroup100k.addLayer(connectingEastingLineNorthToGZD);
            }
            // If any Polylines are less than 100k meters away from the GZD, we can then start connecting them
            // Object.values(this.data).forEach((b) => {
            //   // Removes the grid gap on latitudes above 64 deg (around Iceland)
            //   // const boostPadding = this.north > 64 ? 10000 : 0;
            //   if (connectingEastingLineNorth.distanceTo({ lat: b.bottom, lng: element[0].lon }) <= this.gridInterval) {
            //     const eastingGridLineEndpoint = LLtoUTM({ lat: b.bottom, lon: connectingEastingLineNorth.lng });
            //     const extendedLineSouth = UTMtoLL({
            //       northing: eastingGridLineEndpoint.northing,
            //       // round the easting so it lines up with the bottom grid.
            //       easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
            //       zoneNumber: eastingGridLineEndpoint.zoneNumber,
            //       zoneLetter: eastingGridLineEndpoint.zoneLetter,
            //     });
            //     const connectingEastingLineNorthToGZD = new L.Polyline([connectingEastingLineNorth, extendedLineSouth], this.lineStyle);
            //     return this.layerGroup100k.addLayer(connectingEastingLineNorthToGZD);
            //   }
            // });
            //! JAN15 - This should probably be renamed to connectingEastingLineNorth
            const connectingEastingLineSouth = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
            if (connectingEastingLineSouth.distanceTo({ lat: this.data[0].top, lng: element[1].lon }) <= this.gridInterval) {
              // console.log(new Number(Math.trunc(connectingEastingLineSouth.distanceTo({ lat: e.top, lng: element[1].lon }))).toLocaleString());
              const eastingGridLineEndpoint = LLtoUTM({ lat: this.data[0].top, lon: connectingEastingLineSouth.lng });
              const extendedLineSouth = UTMtoLL({
                northing: eastingGridLineEndpoint.northing,
                // round the easting so it lines up with the bottom grid.
                easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
                zoneNumber: eastingGridLineEndpoint.zoneNumber,
                zoneLetter: eastingGridLineEndpoint.zoneLetter,
              });
              const connectingEastingLineSouthToGZD = new L.Polyline([connectingEastingLineSouth, extendedLineSouth], this.orangeLine);
              mark(connectingEastingLineSouth);
              this.layerGroup100k.addLayer(connectingEastingLineSouthToGZD);
            }

            // Object.values(this.data).forEach((t) => {
            //   if (connectingEastingLineSouth.distanceTo({ lat: t.top, lng: element[1].lon }) <= this.gridInterval) {
            //     // console.log(new Number(Math.trunc(connectingEastingLineSouth.distanceTo({ lat: e.top, lng: element[1].lon }))).toLocaleString());
            //     const eastingGridLineEndpoint = LLtoUTM({ lat: t.top, lon: connectingEastingLineSouth.lng });
            //     const extendedLineSouth = UTMtoLL({
            //       northing: Math.round(eastingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
            //       // round the easting so it lines up with the bottom grid.
            //       easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
            //       zoneNumber: eastingGridLineEndpoint.zoneNumber,
            //       zoneLetter: eastingGridLineEndpoint.zoneLetter,
            //     });
            //     const connectingEastingLineSouthToGZD = new L.Polyline([connectingEastingLineSouth, extendedLineSouth], this.orangeLine);
            //     mark(connectingEastingLineSouth);
            //     return this.layerGroup100k.addLayer(connectingEastingLineSouthToGZD);
            //   }
            // });
          }
        }
      }
    });

    // this.clean() will add the layergroup to the map and then clear out the easting/northing arrays
    return this.clean();
  };

  // this.test = function () {
  //   this.layerGroup100k.eachLayer((layer) => {
  //     if (layer._latlngs.length > 1) {
  //       const el0 = map.latLngToLayerPoint(layer.getLatLngs()[0]);
  //       const el1 = map.latLngToLayerPoint(layer.getLatLngs()[1]);
  //       const hhh = layer.getLatLngs().reduce((r, i) => (!r.some((j) => !Object.keys(i).some((k) => i[k] !== j[k])) ? [...r, i] : r), []);
  //       console.log(hhh[0]);
  //       if (hhh[1]) {
  //         mark(hhh[1]);
  //       }
  //     }
  //   });
  // };

  this.clean = function () {
    this.layerGroup100k.addTo(map);
    this.eastingArray = [];
    this.northingArray = [];
    // this.test();
  };

  this.regenerate = function () {
    if (this.layerGroup100k) {
      this.layerGroup100k.clearLayers();
      return this.getVizGrids();
    }
  };
}
// Create a new class and give it some boundaries
const generate1000meterGrids = new Grid100K(new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()));
// Run the class on page load
generate1000meterGrids.getVizGrids();


// *********************************************************************************** //
// * Event Listeners                                                                 * //
// *********************************************************************************** //
map.addEventListener('moveend', () => {
  // generate1000meterGrids.regenerate();
  // Clear the grids off the map
  // generate1000meterGrids.clean();
  // Run it again
  // generate1000meterGrids.getVizGrids();
  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
  }, 300);
}, { once: true });

// Add the layer data when the page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
  }, 300);
});

export { map };
