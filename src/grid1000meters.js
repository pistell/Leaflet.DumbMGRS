// Surprisingly this actually works
// *********************************************************************************** //
// * Leaflet DumbMGRS Plugin - 1000 Meter Grids                                      * //
// *********************************************************************************** //
// If there is a high zoom level, we need to add more padding so the grids generate throughout the whole screen
function getPaddingOnZoomLevel() {
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
      return 0.25;
    case 14:
      return 0.15;
    case 13:
      return 0.1;
    case 12:
      return 0.03;
    default:
      break;
  }
}
//! You might benefit from simplifying these lines https://leafletjs.com/reference-1.6.0.html#lineutil
function Grid1000() {
  this.constructor = function () {
    this.north = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getNorth();
    this.south = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getSouth();
    this.east = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getEast();
    this.west = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getWest();
    this.eastingArray = [];
    this.northingArray = [];
    this.lineOptions = {
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
    this.map = map;
    this.layerGroup1000m = new L.LayerGroup([]);
    this.gridInterval = 1000;
    return this;
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
      console.log('The current map view does not contain multiple Grid Zone Designators');
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
      }
      rightEastingIterator += 1;
    }
    // https://stackoverflow.com/questions/9229645/remove-duplicate-values-from-js-array
    // Good info on how to remove duplicates

    //* Right Side Northing */
    while (rightNorthingIterator <= neRight.northing) {
      if (rightNorthingIterator % this.gridInterval === 0) {
        this.northingArray.push({
          northing: rightNorthingIterator,
          zoneNumber: neRight.zoneNumber,
          zoneLetter: neRight.zoneLetter,
        });
      }
      rightNorthingIterator += 1;
    }
    return this.generateSplitGrids('right', NEBounds);
  };


  this.generateSplitGrids = function (direction, bounds) {
    this.direction = direction;
    this.bounds = bounds;
    // const layerGroup1000m = new L.LayerGroup([]);
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
              this.layerGroup1000m.addLayer(northingLine);
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              const finalNorthingLine = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              // If any Polylines are less than 1000 meters away from the GZD, we can then start connecting them
              if (finalNorthingLine.distanceTo({ lat: element[1].lat, lng: eastingDict[this.bounds.zoneNumber].right - 0.000000001 }) < this.gridInterval) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLine.lat, lon: eastingDict[this.bounds.zoneNumber].right - 0.000000001 });

                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });

                const northingLinetoGZD = new L.Polyline([extendedLine, finalNorthingLine], this.lineOptions);
                this.layerGroup1000m.addLayer(northingLinetoGZD);
              }
            }
            break;
          case 'right':
            if (element[1] && element[0].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const northingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup1000m.addLayer(northingLine);
              // Since element[0] starts on the left, we use that to test if the polyline is extending over the GZD bounds
              const finalNorthingLine = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              if (finalNorthingLine.distanceTo({ lat: element[0].lat, lng: eastingDict[this.bounds.zoneNumber].left }) < this.gridInterval) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLine.lat, lon: eastingDict[this.bounds.zoneNumber].left });
                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });
                const northingLinetoGZD = new L.Polyline([extendedLine, finalNorthingLine], this.lineOptions);
                this.layerGroup1000m.addLayer(northingLinetoGZD);
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
              this.layerGroup1000m.addLayer(eastingLine);
            }
            break;
          case 'right':
            if (element[1] && element[1].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const eastingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup1000m.addLayer(eastingLine);
            }
            break;
          default:
            break;
        }
      }
    });

    // This was supposed to reduce the points on the map instead it did nothing
    // const reducePoints = this.layerGroup1000m.eachLayer((layer) => {
    //   layer.getLatLngs().forEach((j) => {
    //     const pixelPosition0 = new L.point(map.latLngToLayerPoint(j[0]));
    //     const pixelPosition1 = new L.point(map.latLngToLayerPoint(j[1]));
    //     return L.LineUtil.simplify([pixelPosition0, pixelPosition1], 40).map((point) => {
    //       const mynewpoint = map.layerPointToLatLng([point.x, point.y]);
    //       const mynewline = new L.Polyline([mynewpoint], this.lineOptions);
    //       return mynewline;
    //     });
    //   });
    // });
    // reducePoints.addTo(map);
    // All the Polylines are now in this group, we can add it to the map
    this.layerGroup1000m.addTo(this.map);

    // Set layer count and map zoom data only once on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
        document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
      }, 300);
    }, { once: true });

    return this;
  };

  this.clean = function () {
    if (this.layerGroup1000m) {
      this.map.removeLayer(this.layerGroup1000m);
    }
  };
}

// const generate1000meterGrids = new Grid1000(new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()));
// generate1000meterGrids.determineGrids();

// map.addEventListener('moveend', () => {
//   // if (map.getZoom() >= 6) {
//   generate1000meterGrids.clean();
//   generate1000meterGrids.determineGrids();
//   // }

//   // generate100kGrids.clean();
//   // generate100kGrids.determineGrids();
//   setTimeout(() => {
//     document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
//     document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
//   }, 300);
// }, { once: true });

export default Grid1000;
