import { computeCameraPosition } from "./util.js";

// const generateMarkers = (map, trackGeoJson) =>{
//   const startGeoJson = {
//     type: "Feature",
//     geometry: {
//       type: "Point",
//       coordinates: trackGeoJson.geometry.coordinates[0]
//     },
//     properties: {
//       title: "Pinnacle @ Duxton",
//       description: "Home base"
//     }
//   }

//   const endGeoJson = {
//     type: "Feature",
//     geometry: {
//       type: "Point",
//       coordinates: trackGeoJson.geometry.coordinates.slice(-1)[0]
//     },
//     properties: {
//       title: "Singapore General Hospital",
//       description : "Place we go to get help"
//     }
//   }

//   const placesOfInterest = [startGeoJson, endGeoJson]


//   // add markers to map
//   for (const feature of placesOfInterest) {
//     // create a HTML element for each feature
//     const el = document.createElement("div");
//     el.className = "marker";

//     // make a marker for each feature and add it to the map
//     const marker = new mapboxgl.Marker(el)
//       .setLngLat(feature.geometry.coordinates)
//       .setPopup(
//         new mapboxgl.Popup({ offset: 25 }) // add popups
//           .setHTML(
//             `<h3>${feature.properties.title}</h3><p>${feature.properties.description}</p>`
//           )
//       )
//       .addTo(map);
//     setTimeout(()=>{
//       marker.togglePopup();
//     },1000)
//   }

// }


const animatePath = async ({
  map,
  duration,
  path,
  startBearing,
  startAltitude,
  pitch,
  prod,
  trackGeoJson
}) => {
  return new Promise(async (resolve) => {
    const pathDistance = turf.lineDistance(path);
    let startTime;

    const frame = async (currentTime) => {
      // generateMarkers(map, trackGeoJson)


      if (!startTime) startTime = currentTime;
      const animationPhase = (currentTime - startTime) / duration;

      // when the duration is complete, resolve the promise and stop iterating
      if (animationPhase > 1) {

        resolve();
        return;
      }


      // calculate the distance along the path based on the animationPhase
      const alongPath = turf.along(path, pathDistance * animationPhase).geometry
        .coordinates;

      const lngLat = {
        lng: alongPath[0],
        lat: alongPath[1],
      };

      // Reduce the visible length of the line by using a line-gradient to cutoff the line
      // animationPhase is a value between 0 and 1 that reprents the progress of the animation
      map.setPaintProperty(
        "line-layer",
        "line-gradient",
        [
          "step",
          ["line-progress"],
          "blue",
          animationPhase,
          "rgba(0, 0, 0, 0)",
       ]
      );

      // slowly rotate the map at a constant rate
      // const bearing = startBearing - animationPhase * 200.0;

      // // compute corrected camera ground position, so that he leading edge of the path is in view
      // var correctedPosition = computeCameraPosition(
      //   pitch,
      //   bearing,
      //   lngLat,
      //   startAltitude,
      //   true // smooth
      // );

      // // set the pitch and bearing of the camera
      // const camera = map.getFreeCameraOptions();
      // camera.setPitchBearing(pitch, bearing);

      // // set the position and altitude of the camera
      // camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
      //   correctedPosition,
      //   startAltitude
      // );

      // // apply the new camera options
      // map.setFreeCameraOptions(camera);

      // repeat!
      await window.requestAnimationFrame(frame);
    };

    await window.requestAnimationFrame(frame);
  });
};

export default animatePath;
