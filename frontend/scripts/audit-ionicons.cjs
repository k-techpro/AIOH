/* Static guard for Ionicons names used by the mobile application. */
const fs = require("fs");
const path = require("path");

const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules", "@expo", "vector-icons", "build", "vendor", "react-native-vector-icons", "glyphmaps", "Ionicons.json"), "utf8"));
const files = [];
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
  const target = path.join(directory, entry.name);
  if (entry.isDirectory()) { if (!["node_modules", "android", ".expo"].includes(entry.name)) walk(target); }
  else if (/\.(ts|tsx)$/.test(entry.name)) files.push(target);
});
walk(path.join(__dirname, "..", "app"));
walk(path.join(__dirname, "..", "src"));

const patterns = [/<Ionicons[^>]*\bname\s*=\s*["']([^"']+)["']/g, /\bicon\s*:\s*["']([^"']+)["']/g];
const invalid = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) if (!glyphs[match[1]]) invalid.push(`${path.relative(path.join(__dirname, ".."), file)}: ${match[1]}`);
  }
}
if (invalid.length) { console.error(invalid.join("\n")); process.exitCode = 1; }
else console.log("ALL_STATIC_IONICONS_VALID");
