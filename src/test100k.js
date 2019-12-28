function getPaddingOnZoomLevel100k() {
  if (map.getZoom() >= 17) {
    return 3;
  }
  if (map.getZoom() < 17 && map.getZoom() >= 15) {
    return 1;
  }
  if (map.getZoom() <= 14 && map.getZoom() >= 12) {
    return 0.15;
  }
  return 0.3;
}

class Grid100k extends L.LayerGroup {
  constructor(bounds) {
    super([]);
    this.bounds = bounds;
    this.north = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getNorth();
    this.south = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getSouth();
    this.east = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getEast();
    this.west = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getWest();
    this.eastingArray = [];
    this.northingArray = [];
    this.lineOptions = {
      color: 'green',
      weight: 4,
      opacity: 0.5,
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
    };
    this.map = map;
    this.layerGroup100k = new L.LayerGroup([]);
    return this;
  }

  determineGrids() {
    // Do not add 1000 meter grids if the zoom level is <= 12
    // if (map.getZoom() <= 12) { return; }
    this.constructor();
    const NEBounds = LLtoUTM({ lat: this.north, lon: this.east });
    const NWBounds = LLtoUTM({ lat: this.constructor().north, lon: this.constructor().west });
    const SEBounds = LLtoUTM({ lat: this.constructor().south, lon: this.constructor().east });
    const SWBounds = LLtoUTM({ lat: this.constructor().south, lon: this.constructor().west });
    let noAdjacentGZD = false;
    if (NEBounds.zoneNumber === NWBounds.zoneNumber || SEBounds.zoneNumber === SWBounds.zoneNumber) {
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
  }

  left(NWBounds) {
    const neLeft = LLtoUTM({ lat: this.north, lon: eastingDict[NWBounds.zoneNumber].right - 0.000000001 });
    const seLeft = LLtoUTM({ lat: this.south, lon: eastingDict[NWBounds.zoneNumber].right - 0.000000001 });
    const swLeft = LLtoUTM({ lat: this.south, lon: this.west });
    let leftEastingIterator = swLeft.easting;
    let leftNorthingIterator = swLeft.northing;
    //* Left Side Easting */
    while (leftEastingIterator <= seLeft.easting) {
      if (leftEastingIterator % 100000 === 0) {
        // this.endCoordNorthing does not change on the easting
        this.eastingArray.push({
          easting: leftEastingIterator,
          zoneNumber: seLeft.zoneNumber,
          zoneLetter: seLeft.zoneLetter,
        });
      }
      leftEastingIterator += 1;
    }
    //* * Left Side Northing */
    while (leftNorthingIterator <= neLeft.northing) {
      if (leftNorthingIterator % 100000 === 0) {
        this.northingArray.push({
          northing: leftNorthingIterator,
          zoneNumber: neLeft.zoneNumber,
          zoneLetter: neLeft.zoneLetter,
        });
      }
      leftNorthingIterator += 1;
    }
    return this.generateSplitGrids('left', NWBounds);
  }

  right(NEBounds, noAdjacentGZD = false) {
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
      if (rightEastingIterator % 100000 === 0) {
        this.eastingArray.push({
          easting: rightEastingIterator,
          zoneNumber: seRight.zoneNumber,
          zoneLetter: seRight.zoneLetter,
        });
      }
      rightEastingIterator += 1;
    }
    // https://stackoverflow.com/questions/9229645/remove-duplicate-values-from-js-array
    // Good info on how to remove duplicates
    //* Right Side Northing */
    while (rightNorthingIterator <= neRight.northing) {
      if (rightNorthingIterator % 100000 === 0) {
        this.northingArray.push({
          northing: rightNorthingIterator,
          zoneNumber: neRight.zoneNumber,
          zoneLetter: neRight.zoneLetter,
        });
      }
      rightNorthingIterator += 1;
    }
    return this.generateSplitGrids('right', NEBounds);
  }

  generateSplitGrids(direction, bounds) {
    this.direction = direction;
    this.bounds = bounds;
    Object.entries(this.northingArray).forEach((e) => {
      const bottomNorthing = e[1];
      const bottomRow = this.eastingArray.map((j) => [j, bottomNorthing]);
      const emptyBottomRowArr = [];
      bottomRow.forEach((k) => {
        emptyBottomRowArr.push(UTMtoLL({
          northing: k[1].northing,
          easting: k[0].easting,
          zoneNumber: k[0].zoneNumber,
          zoneLetter: k[0].zoneLetter,
        }));
      });
      for (let index = 0; index < emptyBottomRowArr.length; index++) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        switch (this.direction) {
          case 'left':
            // element[1] ensures that each element in the loop has 2 arrays. If there is only 1 array then it's the "odd-man-out" so we disregard it
            // element[1].lon <= eastingDict[NWBounds.zoneNumber].right - 0.000000001 ensures that the lines will not go over the GZD boundaries
            if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
              const northingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup100k.addLayer(northingLine);
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              const finalNorthingLine = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              // If any Polylines are less than 1000 meters away from the GZD, we can then start connecting them
              if (finalNorthingLine.distanceTo({ lat: element[1].lat, lng: eastingDict[this.bounds.zoneNumber].right - 0.000000001 }) < 150000) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLine.lat, lon: eastingDict[this.bounds.zoneNumber].right - 0.000000001 });
                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / 100000) * 100000,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });
                const northingLinetoGZD = new L.Polyline([extendedLine, finalNorthingLine], this.lineOptions);
                console.log('left case shitting off');
                this.layerGroup100k.addLayer(northingLinetoGZD);
              }
            }
            break;
          case 'right':
            if (element[1] && element[0].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const northingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup100k.addLayer(northingLine);
              // Since element[0] starts on the left, we use that to test if the polyline is extending over the GZD bounds
              const finalNorthingLine = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              // console.log(finalNorthingLine.distanceTo({ lat: element[0].lat, lng: eastingDict[this.bounds.zoneNumber].left }));
              if (finalNorthingLine.distanceTo({ lat: element[0].lat, lng: eastingDict[this.bounds.zoneNumber].left }) < 150000) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLine.lat, lon: eastingDict[this.bounds.zoneNumber].left });
                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / 100000) * 100000,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });
                const northingLinetoGZD = new L.Polyline([extendedLine, finalNorthingLine], this.lineOptions);
                this.layerGroup100k.addLayer(northingLinetoGZD);
              }
            }
            break;
          default:
            break;
        }
      }
    });
    Object.entries(this.eastingArray).forEach((e) => {
      const bottomNorthing = e[1];
      const bottomRow = this.northingArray.map((j) => [j, bottomNorthing]);
      const emptyBottomRowArr = [];
      bottomRow.forEach((k) => {
        emptyBottomRowArr.push(UTMtoLL({
          northing: k[0].northing,
          easting: k[1].easting,
          zoneNumber: k[0].zoneNumber,
          zoneLetter: k[0].zoneLetter,
        }));
      });
      for (let index = 0; index < emptyBottomRowArr.length; index++) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        switch (this.direction) {
          case 'left':
            if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
              const eastingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup100k.addLayer(eastingLine);
            }
            break;
          case 'right':
            if (element[1] && element[1].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const eastingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup100k.addLayer(eastingLine);
            }
            break;
          default:
            break;
        }
      }
    });
    // All the Polylines are now in this group, we can add it to the map
    this.layerGroup100k.addTo(this.map);
    map.addEventListener('movestart', () => {
      map.removeLayer(this.layerGroup100k);
    }, { once: true });
  }

  getEvents() {
    return {
      moveend: this.reset,
    };
  }

  // Reset the grid on move end
  reset() {
    this.determineGrids();
  }
}
const generate100kGrids = new Grid100k(new L.latLngBounds(map.getBounds().pad(getPaddingOnZoomLevel100k())));
generate100kGrids.addTo(map);
