const fs = require("fs");
const parser = require("@babel/parser");

const code = fs.readFileSync("app/dashboard/page.js", "utf8");

try {
	parser.parse(code, { sourceType: "module", plugins: ["jsx"] });
	console.log("babel parse ok");
} catch (e) {
	console.error(e.message);
	console.error("loc", e.loc);
	process.exit(1);
}
