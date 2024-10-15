const shadowBox = document.getElementById("shadowBox");
const boxContent = document.getElementById("boxContent");
const controls = {};
const valueDisplays = {};

["angle", "elevation", "lightSize", "borderRadius", "objectColor", "giIntensity", "globalShadowIntensity"].forEach((control) => {
  controls[control] = document.getElementById(control);
  valueDisplays[control] = document.getElementById(control + "Value");
});

const shadowConfigs = [
  { low: { xy: 6, blur: 6, spread: -3, strength: 0.8 }, high: { xy: 2, blur: 2, spread: -3, strength: 0.8 } },
  { low: { xy: 12, blur: 12, spread: -2, strength: 0.6 }, high: { xy: 3, blur: 3, spread: -2, strength: 0.6 } },
  { low: { xy: 20, blur: 20, spread: -1, strength: 0.45 }, high: { xy: 4, blur: 4, spread: -1.5, strength: 0.4 } },
  { low: { xy: 30, blur: 30, spread: 2, strength: 0.35 }, high: { xy: 6, blur: 6, spread: 0, strength: 0.25 } },
  { low: { xy: 45, blur: 45, spread: 8, strength: 0.25 }, high: { xy: 8, blur: 8, spread: 2, strength: 0.15 } },
  { low: { xy: 60, blur: 60, spread: 20, strength: 0.15 }, high: { xy: 12, blur: 12, spread: 4, strength: 0.05 } },
];

function lerp(low, high, t) {
  return low + (high - low) * t;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function calculateShadow() {
  const elevationValue = controls.elevation.value / 100;

  let height, elevate;
  if (elevationValue <= 0.5) {
    // From 0% to 50%, interpolate from (height: 1, elevate: 0) to (height: 0, elevate: 0)
    const t = easeInOutQuad(elevationValue * 2);
    height = 1 - t;
    elevate = 0;
  } else {
    // From 50% to 100%, interpolate from (height: 0, elevate: 0) to (height: 0, elevate: 1)
    height = 0;
    const t = easeInOutQuad((elevationValue - 0.5) * 2);
    elevate = t;
  }

  const angle = (controls.angle.value * Math.PI) / 180;
  const lightSize = controls.lightSize.value / 100;
  const globalShadowIntensity = controls.globalShadowIntensity.value / 100;
  const giIntensity = controls.giIntensity.value / 100;

  const regularShadow = [];
  const giShadow = [];

  shadowConfigs.forEach((config, index) => {
    let { xy, blur, spread, strength } = config.low;

    xy = lerp(xy, config.high.xy, height);
    blur = lerp(blur, config.high.blur, height);
    spread = lerp(spread, config.high.spread, height);
    strength = lerp(strength, config.high.strength, height);

    blur *= 1 + lightSize;
    strength *= (1 - lightSize * 0.5) * globalShadowIntensity;

    if (index < 3) {
      const elevateStart = index * 0.33;
      const elevateFactor = Math.max(0, Math.min(1, (1 - elevate) / (1 - elevateStart)));
      strength *= elevateFactor;
    }

    const xOffset = Math.cos(angle) * xy;
    const yOffset = Math.sin(angle) * xy;

    regularShadow.push(`${xOffset}px ${yOffset}px ${blur}px ${spread}px rgba(0,0,0,${strength})`);

    const giXOffset = Math.cos(angle + Math.PI) * xy * 0.5;
    const giYOffset = Math.sin(angle + Math.PI) * xy * 0.5;
    const giBlur = blur * 1.5;
    const giStrength = strength * giIntensity;

    giShadow.push(
      `${giXOffset}px ${giYOffset}px ${giBlur}px ${spread}px ${controls.objectColor.value}${Math.round(giStrength * 255)
        .toString(16)
        .padStart(2, "0")}`
    );
  });

  return [regularShadow.join(", "), giShadow.join(", ")];
}

let rafId;
function updateShadowBox() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const [regularShadow, giShadow] = calculateShadow();
    shadowBox.style.boxShadow = `${regularShadow}, ${giShadow}`;
    shadowBox.style.borderRadius = `${controls.borderRadius.value}px`;
    shadowBox.style.backgroundColor = controls.objectColor.value;
  });
}

const suffixes = {
  angle: "°",
  borderRadius: "px",
  elevation: "%",
  lightSize: "%",
  globalShadowIntensity: "%",
  giIntensity: "%",
};

Object.keys(controls).forEach((control) => {
  const updateFunction = () => {
    if (valueDisplays[control]) {
      valueDisplays[control].textContent = controls[control].value + (suffixes[control] || "");
    }
    updateShadowBox();
  };

  controls[control].addEventListener("input", updateFunction);
});

function makeValuesEditable() {
  const editableValues = document.querySelectorAll(".editable-value");

  editableValues.forEach((valueSpan) => {
    valueSpan.addEventListener("click", function () {
      const control = this.dataset.control;
      const currentValue = controls[control].value;
      const suffix = suffixes[control] || "";
      const input = document.createElement("input");
      input.type = "number";
      input.value = currentValue;

      const contentWidth = (currentValue.length + suffix.length + 1) * 8 + 16;
      input.style.width = `${contentWidth}px`;

      input.addEventListener("blur", function () {
        updateValue(control, this.value);
        this.parentNode.innerHTML = `<span id="${control}Value">${this.value}${suffix}</span>`;
      });

      input.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          updateValue(control, this.value);
          this.blur();
        }
      });

      this.innerHTML = "";
      this.appendChild(input);
      input.focus();
    });
  });
}

function updateValue(control, value) {
  const slider = controls[control];
  slider.value = Math.max(slider.min, Math.min(slider.max, value));
  const inputEvent = new Event("input", { bubbles: true });
  slider.dispatchEvent(inputEvent);
}

function copyShadowCSS() {
  const [regularShadow, giShadow] = calculateShadow();
  const cssCode = `box-shadow: ${regularShadow}, ${giShadow};`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cssCode).then(showCopyMessage, showCopyError);
  } else {
    // Fallback for browsers that don't support the Clipboard API
    const textArea = document.createElement("textarea");
    textArea.value = cssCode;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      showCopyMessage();
    } catch (err) {
      showCopyError();
    }
    document.body.removeChild(textArea);
  }
}

function showCopyMessage() {
  const originalContent = boxContent.innerHTML;
  const messageElement = document.createElement("div");
  messageElement.className = "copy-message";
  messageElement.textContent = "CSS code copied to clipboard!";

  boxContent.style.opacity = "0";
  shadowBox.appendChild(messageElement);

  // Trigger reflow to ensure the opacity transition works
  messageElement.offsetHeight;
  messageElement.style.opacity = "1";

  setTimeout(() => {
    messageElement.style.opacity = "0";
    setTimeout(() => {
      shadowBox.removeChild(messageElement);
      boxContent.style.opacity = "0.1";
    }, 500); // Wait for fade out to complete before removing
  }, 1500); // Show message for 1.5 seconds before fading out
}

function showCopyError() {
  alert("Failed to copy CSS code. Please try again.");
}

// Use both click and touch events for copying
shadowBox.addEventListener("click", copyShadowCSS);
shadowBox.addEventListener("touchend", (event) => {
  event.preventDefault(); // Prevent default touch behavior
  copyShadowCSS();
});

function handleTouch(event) {
  event.preventDefault();
  const touch = event.touches[0];
  const slider = event.target;
  const rect = slider.getBoundingClientRect();
  const offsetX = touch.clientX - rect.left;
  const percentage = (offsetX / rect.width) * 100;
  const value = Math.round((percentage / 100) * (slider.max - slider.min) + parseFloat(slider.min));

  slider.value = Math.max(slider.min, Math.min(slider.max, value));

  // Trigger the input event to update any listeners
  const inputEvent = new Event("input", { bubbles: true });
  slider.dispatchEvent(inputEvent);
}

document.addEventListener("DOMContentLoaded", () => {
  makeValuesEditable();
  updateShadowBox();

  const sliders = document.querySelectorAll('input[type="range"]');
  sliders.forEach((slider) => {
    slider.addEventListener("touchstart", handleTouch);
    slider.addEventListener("touchmove", handleTouch);
  });

  controls.giIntensity.value = 0;
  valueDisplays.giIntensity.textContent = "0%";

  // Set initial value for elevation
  controls.elevation.value = 50;
  valueDisplays.elevation.textContent = "50%";
});

// Initial update
updateShadowBox();
