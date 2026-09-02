/*
  GitHub Pages version of the supplied Spiderman.py

  Python -> Browser equivalents:
    cv2.imread()       -> HTML Image + Canvas
    cv2.resize()       -> off-screen Canvas
    cvtColor()         -> cv.cvtColor()
    threshold()        -> cv.threshold()
    findContours()     -> cv.findContours()
    turtle.Screen()    -> HTML Canvas
    turtle.goto()      -> Canvas lineTo()
    begin_fill/end_fill -> Canvas fill()
    turtle.done()      -> drawing remains on the page
*/

const IMAGE = "spiderman.png";

// Same values as the original Python program.
const TARGET_HEIGHT = 700;
const SCALE = 0.8;
const UPDATE_EVERY = 3;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 575;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");

ctx.fillStyle = "white";
ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

let contoursData = [];
let animationFrame = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function mapPoint(px, py, width, height) {
  // Same coordinate conversion as Python:
  // tx = (px - width / 2) * scale
  // ty = (height / 2 - py) * scale
  return {
    x: (px - width / 2) * SCALE + CANVAS_WIDTH / 2,
    y: (height / 2 - py) * SCALE + CANVAS_HEIGHT / 2
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load " + src));
    img.src = src;
  });
}

function waitForOpenCV() {
  return new Promise((resolve) => {
    if (typeof cv !== "undefined" && cv.Mat) {
      resolve();
      return;
    }

    const timer = setInterval(() => {
      if (typeof cv !== "undefined" && cv.Mat) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

async function prepareContours() {
  setStatus("Loading image…");

  const img = await loadImage(IMAGE);

  // Python:
  // height = 700
  // ratio = height / img.shape[0]
  // width = int(img.shape[1] * ratio)
  // img = cv2.resize(img, (width, height))
  const height = TARGET_HEIGHT;
  const ratio = height / img.naturalHeight;
  const width = Math.floor(img.naturalWidth * ratio);

  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;

  const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
  offCtx.drawImage(img, 0, 0, width, height);

  // Read resized image with OpenCV.
  let src = cv.imread(offscreen);
  let gray = new cv.Mat();
  let thresh = new cv.Mat();
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();

  try {
    // Python: gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Python:
    // _, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)
    cv.threshold(gray, thresh, 180, 255, cv.THRESH_BINARY_INV);

    // Python:
    // cv2.RETR_EXTERNAL + cv2.CHAIN_APPROX_NONE
    cv.findContours(
      thresh,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_NONE
    );

    const data = [];

    // Python:
    // contours = [c for c in contours if cv2.contourArea(c) > 15]
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area > 15) {
        const points = [];

        for (let j = 0; j < contour.data32S.length; j += 2) {
          points.push({
            x: contour.data32S[j],
            y: contour.data32S[j + 1]
          });
        }

        if (points.length >= 2) {
          data.push({
            area,
            points
          });
        }
        contour.delete();
      }
    }

    // Python:
    // contours = sorted(contours, key=cv2.contourArea, reverse=True)
    data.sort((a, b) => b.area - a.area);

    contoursData = data;

    return { width, height };
  } finally {
    src.delete();
    gray.delete();
    thresh.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function drawPointLine(from, to) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawContour(contour, width, height) {
  const points = contour.points;
  if (points.length < 2) return;

  const first = mapPoint(points[0].x, points[0].y, width, height);

  // Equivalent to penup(); goto(); pendown(); begin_fill()
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < points.length; i++) {
    const p = mapPoint(points[i].x, points[i].y, width, height);
    ctx.lineTo(p.x, p.y);
  }

  // Equivalent to pen.goto(x0, y0), closing the shape.
  ctx.lineTo(first.x, first.y);

  // Equivalent to turtle's end_fill().
  ctx.fillStyle = "black";
  ctx.fill();

  // Keep the black outline from turtle's pen.
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  ctx.stroke();
}

async function animateDrawing(width, height) {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
  }

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let contourIndex = 0;
  let pointIndex = 1;
  let pointCounter = 0;

  // The original turtle draws the biggest contours first.
  function frame() {
    let pointsThisFrame = 0;

    while (
      contourIndex < contoursData.length &&
      pointsThisFrame < UPDATE_EVERY
    ) {
      const contour = contoursData[contourIndex];
      const points = contour.points;

      if (points.length < 2) {
        contourIndex++;
        pointIndex = 1;
        continue;
      }

      const first = mapPoint(points[0].x, points[0].y, width, height);

      // Start the contour when its first point is reached.
      if (pointIndex === 1) {
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
      }

      if (pointIndex < points.length) {
        const p = mapPoint(
          points[pointIndex].x,
          points[pointIndex].y,
          width,
          height
        );

        ctx.lineTo(p.x, p.y);
        pointIndex++;
        pointCounter++;
        pointsThisFrame++;
      }

      if (pointIndex >= points.length) {
        // Close the shape exactly like pen.goto(x0, y0).
        ctx.lineTo(first.x, first.y);

        // Stroke first, then fill the completed contour.
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "black";
        ctx.fill();

        contourIndex++;
        pointIndex = 1;
      }
    }

    const percent = contoursData.length
      ? Math.round((contourIndex / contoursData.length) * 100)
      : 100;

    setStatus(
      `Drawing… ${percent}%  |  ${contourIndex}/${contoursData.length} contours`
    );

    if (contourIndex < contoursData.length) {
      animationFrame = requestAnimationFrame(frame);
    } else {
      animationFrame = null;
      setStatus("Drawing complete.");
      restartBtn.disabled = false;
    }
  }

  restartBtn.disabled = true;
  frame();
}

async function start() {
  try {
    restartBtn.disabled = true;
    setStatus("Loading OpenCV.js…");

    await waitForOpenCV();

    setStatus("Detecting contours…");
    const size = await prepareContours();

    if (!contoursData.length) {
      throw new Error("No contours were detected.");
    }

    setStatus(`Found ${contoursData.length} contours. Starting drawing…`);

    // Give the browser a moment to render the status before animation begins.
    setTimeout(() => animateDrawing(size.width, size.height), 100);
  } catch (error) {
    console.error(error);
    setStatus("Error: " + error.message);
    restartBtn.disabled = false;
  }
}

restartBtn.addEventListener("click", start);

// Start automatically, just like running the original Python program.
start();
