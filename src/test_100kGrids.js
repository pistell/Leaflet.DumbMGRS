//! experimental 100K grid class.
//! This technically works but it's gross
const MyCubeClass = L.MGRS1000Meters.extend({
  options: {
    gridInterval: 100000,
    showLabels: true,
    hidden: false,
    redraw: 'move',
    maxZoom: 18,
    minZoom: 6,
    gridLetterStyle: 'color: black; font-size:12px;',
    splitGZD: false,
    direction: undefined,
  },

  lineStyle: {
    interactive: false,
    fill: false,
    noClip: true,
    smoothFactor: 4,
    lineCap: 'butt',
    lineJoin: 'miter-clip',
    color: 'black',
    weight: 4,
    opacity: 0.5,
  },
  // line style for debugging
  get orangeLine() {
    const propertyToModify = {
      color: 'orange',
      weight: 8,
      opacity: 0.25,
    };
    const modifiedTarget = { ...this.lineStyle, ...propertyToModify };
    return modifiedTarget;
  },
  // line style for debugging
  get redLine() {
    const propertyToModify = {
      color: 'red',
      weight: 2,
      opacity: 0.75,
    };
    const modifiedTarget = { ...this.lineStyle, ...propertyToModify };
    return modifiedTarget;
  },

  initialize(options) {
    L.LayerGroup.prototype.initialize.call(this);
    L.Util.setOptions(this, options);
  },

  onAdd(map) {
    this._map = map;
    const grids100k = this.regenerate();

    // this._map.on('viewreset  moveend', grids100k.regenerate, grids100k);
    this.eachLayer(map.addLayer, map);
  },

  onRemove(map) {
    map.off(`viewreset ${this.options.redraw}`, this.map);
    this.eachLayer(this.removeLayer, this);
  },

  hideGrids() {
    this.options.hidden = true;
    this.regenerate();
  },

  hideLabels() {
    this.options.showLabels = false;
    this.regenerate();
  },

  showGrids() {
    this.options.hidden = false;
    this.regenerate();
  },

  showLabels() {
    this.options.showLabels = true;
    this.regenerate();
  },


  regenerate() {
    this.layerGroup100k = new L.LayerGroup([]);
    this.layerGroup100kLabels = new L.LayerGroup([]);
    // this.layerGroup100k.clearLayers();
    this.eastingArray = [];
    this.northingArray = [];


    // dumb name, but this temporarily holds the visible grids so I can iterate over them
    this.empty = [];
    // visible grid zones from this.empty will be dumped in here
    this.uniqueVisibleGrids = {};
    // Create a new layergroup to hold the grid lines

    // These next 2 are for the 100k grid labels
    this.labelN = [];
    this.labelS = [];
    this.gridInterval = 100000;
    // Get the North/South/East/West visible bounds and add padding
    this.north = new L.latLngBounds(map.getBounds()).pad(this.getPaddingOnZoomLevel()).getNorth();
    this.south = new L.latLngBounds(map.getBounds()).pad(this.getPaddingOnZoomLevel()).getSouth();
    this.east = new L.latLngBounds(map.getBounds()).pad(this.getPaddingOnZoomLevel()).getEast();
    this.west = new L.latLngBounds(map.getBounds()).pad(this.getPaddingOnZoomLevel()).getWest();
    // The eastingArray and northingArray will hold the latlngs for our grids
    this.getVizGrids();

    return this;
  },


  // Returns the visible grids on the map and their bounds
  getVizGrids() {
    // Prevent the map from drawing 100K grids when it is zoomed out too far.
    if (map.getZoom() < 6) {
      return;
    }
    // Calling constructor to get it's values (eg- this.northingArray, etc...)
    // this.constructor();
    // empty the empty array (I really need a new name for this)
    // this.empty.length = 0;
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
  },

  // Now that we have the visible grids, we can iterate over them
  prepGrids(uniqueVisibleGrids) {
    this.uniqueVisibleGrids = uniqueVisibleGrids;
    const visibleGridsIterator = new Map(Object.entries(this.uniqueVisibleGrids));
    // Not sure how useful this promise is. It works fine with just a forEach loop
    visibleGridsIterator.forEach((grid) => {
      this.generateGrids(grid);
    });
  },

  generateGrids(data) {
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
  },

  // These 2 functions will "connect" the northing and easting 100k grid lines to their adjacent GZD
  // CONNECTOR is the connecting line we pass in (eg - connectingEastingLineSouth)
  // ELEMENT is the grid lines generated from the for loop. The element is an object with 2 arrays containing latlons
  // DATA is the GZD data (example, this.data contains info on the corner boundaries of the visible GZDs)
  // COUNT is the index used in the while loop
  // DIRECTION is the information we want to access in "this.data[count].top/bottom/left/right"
  connectingNorthingLine(connector, element, elementIndex, data, count, direction) {
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
  },

  connectingEastingLine(connector, element, elementIndex, data, count, direction) {
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
  },

  // This function takes an easting or northing line and 2 bounds (left and right)
  // It returns a new line with the same slope but bounded
  // A line is defined by y = slope * x + b
  // The only difference here is testing first to see if bounds cut the line
  cleanLine(line, leftLongitudeLimit, rightLongitudeLimit) {
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
  },

  // TODO: Finish configuring the special zones exceptions
  handleSpecialZones(element) {
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
  },

  genLabels() {
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
            this.layerGroup100kLabels.addLayer(grid100kLabel);
          }
        }
      }
    });
  },

  clearAll() {
    this.genLabels();
    this.layerGroup100k.addTo(map);
    this.layerGroup100kLabels.addTo(map);
    this.eastingArray = [];
    this.northingArray = [];
    this.labelN = [];
    this.labelS = [];
  },

  hideLabels() {
    this.labelN = [];
    this.labelS = [];
    this.layerGroup100kLabels.clearLayers();
  },

  showLabels() {
    this.clearAll();
  },

  getPaddingOnZoomLevel() {
    const northBuffer = map.getBounds().getNorth() >= 62 ? 0.2 : 0;
    const zoom = this._map.getZoom();
    if (zoom >= this.options.maxZoom) {
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
    return this;
  },
  getEvents() {
    return {
      moveend: this._moveEndHandler,
    };
  },

  _moveEndHandler() {
    if (this.layerGroup100k) {
      this.layerGroup100k.clearLayers();
      // return this.getVizGrids();
    }
    this.clearLayers(true);
    this.regenerate();
  },
});

const instance = new MyCubeClass();
instance.addTo(map);
console.log(instance);