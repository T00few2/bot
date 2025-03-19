const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");

// Sample data to mimic a rider object.
const sampleRider = {
  riderId: 12345,
  name: "Anders Hove [DZR]",
  zpCategory: "B",
  race: {
    current: { 
      rating: 1540, 
      mixed: { category: "Sapphire", number: 4 }
    },
    finishes: 40, 
    wins: 3, 
    podiums: 10, 
    dnfs: 2
  },
  weight: 79,    // kg
  zpFTP: 290,    // W
  power: {
    w30: 720,
    wkg30: 9.11,
    w60: 600,
    wkg60: 7.59,
    w300: 370,
    wkg300: 4.68,
    w1200: 300,
    wkg1200: 3.79
  },
  phenotype: { value: "Sprinter" }
};

function roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    return ctx;
  }

async function generateSingleRiderStatsImage(rider) {
  // Layout settings
  const rowCount = 13;
  const rowHeight = 30;
  const topMargin = 150;
  const leftMargin = 50;
  const width = 450;
  const height = topMargin + rowCount * rowHeight + 40;

  // Create the canvas and context
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  roundRect(ctx, 0, 0, canvas.width, canvas.height, 30);
  ctx.clip();

  // Draw background color
  ctx.fillStyle = "#FF6719";
  ctx.fillRect(0, 0, width, height);
  // Set global alpha to 0.5 for 50% opacity
  ctx.globalAlpha = 0.1;

  

  // Load and draw an image (ensure 'zwifters.png' exists in the same directory)
  try {
    const image = await loadImage("zwifters.png");
    // Draw the image at (0,0). You may adjust the size/position if needed.
    ctx.drawImage(image, width * 0.1, topMargin, width*0.8,width*0.8);
  } catch (err) {
    console.error("Failed to load image:", err);
  }
  ctx.globalAlpha = 1.0;

  // Draw a horizontal line under the title
  ctx.beginPath();
  ctx.moveTo(leftMargin, 90);
  ctx.lineTo(width - leftMargin, 90);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  // Title text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 30px Arial";
  ctx.fillText("Rider Stats 🧮", leftMargin, 70);

  // Row labels
  ctx.font = "bold 22px Arial";
  const labels = [
    "Name",
    "Pace Group",
    "vELO Category",
    "Phenotype",
    "FTP",
    "30s",
    "1m",
    "5m",
    "20m",
    "🏁 Finishes",
    "🏆 Wins",
    "🏅 Podiums",
    "😖 DNFs"
  ];

  labels.forEach((label, i) => {
    ctx.fillText(label, leftMargin, topMargin + i * rowHeight);
  });

  // Values for the sample rider
  ctx.font = "bold 16px Arial";
  let yOffset = topMargin;
  const xOffset = leftMargin + 180;

  ctx.fillText(rider.name, xOffset, yOffset);           yOffset += rowHeight;
  ctx.fillText(rider.zpCategory, xOffset, yOffset);       yOffset += rowHeight;
  const veloCat = `${rider.race.current.mixed.category} (${rider.race.current.rating.toFixed(0)})`;
  ctx.fillText(veloCat, xOffset, yOffset);                yOffset += rowHeight;
  ctx.fillText(rider.phenotype.value, xOffset, yOffset);  yOffset += rowHeight;
  const ftpString = `${rider.zpFTP} W (${(rider.zpFTP / rider.weight).toFixed(2)} W/kg)`;
  ctx.fillText(ftpString, xOffset, yOffset);              yOffset += rowHeight;
  const w30String = `${rider.power.w30} W (${rider.power.wkg30.toFixed(2)} W/kg)`;
  ctx.fillText(w30String, xOffset, yOffset);              yOffset += rowHeight;
  const w60String = `${rider.power.w60} W (${rider.power.wkg60.toFixed(2)} W/kg)`;
  ctx.fillText(w60String, xOffset, yOffset);              yOffset += rowHeight;
  const w300String = `${rider.power.w300} W (${rider.power.wkg300.toFixed(2)} W/kg)`;
  ctx.fillText(w300String, xOffset, yOffset);             yOffset += rowHeight;
  const w1200String = `${rider.power.w1200} W (${rider.power.wkg1200.toFixed(2)} W/kg)`;
  ctx.fillText(w1200String, xOffset, yOffset);            yOffset += rowHeight;
  ctx.fillText(`${rider.race.finishes}`, xOffset, yOffset); yOffset += rowHeight;
  ctx.fillText(`${rider.race.wins}`, xOffset, yOffset);     yOffset += rowHeight;
  ctx.fillText(`${rider.race.podiums}`, xOffset, yOffset);  yOffset += rowHeight;
  ctx.fillText(`${rider.race.dnfs}`, xOffset, yOffset);

  return canvas.toBuffer();
}

// Run the function and save the output to a file
(async () => {
  try {
    const buffer = await generateSingleRiderStatsImage(sampleRider);
    fs.writeFileSync("sample_single_rider.png", buffer);
    console.log("✅ Created sample_single_rider.png");
  } catch (error) {
    console.error("❌ Error generating image:", error);
  }
})();
