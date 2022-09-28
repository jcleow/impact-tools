import { computeCameraPosition } from "./util.js";


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const animateNearbyCondos = async ({
  duration,
  condoMarkers
}) => {
  return new Promise(async (resolve) => {
    console.log("animate nearby condos")
    let startTime


    const frame = async (currentTime) => {
      if (!startTime) startTime = currentTime;
      const animationPhase = (currentTime - startTime) / duration;

      // when the duration is complete, resolve the promise and stop iterating
      if (animationPhase > 1) {

        resolve();
        return;
      }

      condoMarkers.forEach(async (marker)=> {
        setTimeout(()=>{
          marker.togglePopup()
          console.log("popup marker")
        },1000)
      })


      await window.requestAnimationFrame(frame);
    };

    await window.requestAnimationFrame(frame);
  });
};

export default animateNearbyCondos;
