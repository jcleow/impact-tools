import { computeCameraPosition } from "./util.js";

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
          "green",
          animationPhase,
          "rgba(0, 0, 0, 0)",
       ]
      );

      // repeat!
      await window.requestAnimationFrame(frame);
    };

    await window.requestAnimationFrame(frame);
  });
};

export default animatePath;
