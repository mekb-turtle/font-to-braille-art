const sanitize = a => a.replace(/[\x00-\x1f\x7f-\x9f]/g,"");
const m = async (obj) => {
	if (typeof obj != "object" && !Array.isArray(obj))
		throw "argument must be an object";
	var text = obj.text;
	var font = obj.font;
	var size = obj.size;
	var invert = obj.invert;
	if (size == null) size = 50;
	if (invert == null) invert == false;
	if (typeof invert != "boolean")
		throw "invert must be a boolean";
	if (typeof size != "number" || size <= 0 || Math.floor(size) != size)
		throw "size must be a positive integer";
	if (size > 1000)
		throw "size too large";
	if (!text)
		throw "text not specified";
	if (typeof text != "string")
		throw "text must be a string";
	if (!font || (Array.isArray(font) && font.length == 0))
		font = [];
	if (typeof font != "string" && !(Array.isArray(font) && font.filter(e => typeof e == "string").length == font.length))
		throw "font must be a string or an array of strings for fallback";
	if (typeof font == "string")
		font = [ font ];
	var s = font.map(e => !e.match(/^[\w-., ]*$/));
	if (s.includes(true))
		throw "invalid font name \""+font[s.indexOf(true)]+"\"";
	delete s;
	const f = font.length ? (`${size}px `+font.map(f => `"${f}"`).join(", ")) : `${size}px ""`;
	const { createCanvas, loadImage } = require("canvas");
	const canvasTemp = createCanvas(16, 16);
	const ctxTemp = canvasTemp.getContext("2d");
	ctxTemp.font = f;
	const textSize = ctxTemp.measureText(text);
	delete ctxTemp, canvasTemp;
	var width  = textSize.width + size / 2;
	var height = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent + size / 2;
	if (width  % 4 > 0) width  += 4 - width  % 4;
	if (height % 4 > 0) height += 4 - height % 4;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d");
	ctx.font = f;
	ctx.fillText(text, size / 4, textSize.actualBoundingBoxAscent + size / 4);
	const jimp = require("jimp");
	const image = await jimp.read(canvas.toBuffer());
	var s = "";
	for (var y = 0; y < height; y += 4) {
		for (var x = 0; x < width; x += 2) {
			var brailleArray = [ [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3] ];
			var charCode = brailleArray.reduce((total, v, i) => {
				return total + (((
					jimp.intToRGBA(image.getPixelColor(x + v[0], y + v[1])).a > 127
					) ^ (invert)) * (1 << i));
			}, 0x2800);
			var char = String.fromCharCode(charCode);
			s += char;
		}
		if (y < height - 1) s += "\n";
	}
	return s;
};
if (require.main == module) {
	(async()=>{
		var unknownOpt;
		var unknown;
		var opt = {
			unknown: (e) => {
				if (e.startsWith("-")) {
					if (unknownOpt === undefined) unknownOpt = e.startsWith("--") ? e : e.substring(0, 2);
				} else {
					if (unknown === undefined) { unknown = e }
				} return false; },
			string: [ "text", "font" ],
			boolean: [ "help", "stdin", "invert" ],
			alias: { "text": [ "t" ], "font": [ "f" ], "size": [ "s" ], "help": [ "h", "?" ], "stdin": [ "d" ], "invert": [ "i" ] },
		};
		var options = require("minimist")(process.argv.slice(2), opt);
		var k = Object.keys(opt.alias);
		for (var i = 0; i < k.length; ++i) { for (var j = 0; j < opt.alias[k[i]].length; ++j) {
			if (opt.alias[k[i]][j] != k[i]) { delete options[opt.alias[k[i]][j]]; }}}
		delete opt;
		if (options.help || Object.keys(options).length == 1) {
			console.error("--font -f     what font to use");
			console.error("--text -t     the text to use");
			console.error("--stdin -d    read text from stdin");
			console.error("--size -s     size of the font, default is 50");
			console.error("--invert -i   inverts the output");
			process.exit(1);
			return;
		}
		if (options.text != null && options.stdin) { console.error("--text and --stdin cannot both be used"); return; }
		if (options.stdin) {
			var readline = require("readline");
			options.text = "";
			var ended = false;
			process.stdin.on("data", (d) => {
				if (!ended) options.text += d.toString();
			});
			await new Promise((res, rej) => {
				process.stdin.once("end", () => {
					res();
				});
				process.stdin.once("error", rej);
			});
			ended = true;
		}
		if (unknownOpt !== undefined) { console.error("unknown option \""+sanitize(unknownOpt)+"\""); process.exit(2); return; }
		if (unknown !== undefined) { console.error("unexpected \""+sanitize(unknown)+"\""); process.exit(2); return; }
		delete unknownOpt, unknown;
		try {
			var a = await m(options);
			if (a) console.log(a);
			process.exit(0);
			return;
		} catch (err) {
			console.error(typeof err == "string" ? sanitize(err) : err);
			process.exit(3);
			return;
		}
	})();
} else {
	module.exports = m;
}
