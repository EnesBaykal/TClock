// TTF → Three.js "typeface" JSON dönüştürücü (facetype.js algoritması)
// Kullanım: node scripts/ttf2typeface.js <in.ttf> <out.json> "<karakterler>"
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const inPath  = process.argv[2];
const outPath = process.argv[3];
const restrict = process.argv[4] || null; // sadece bu karakterleri göm

const _b = fs.readFileSync(inPath);
const font = opentype.parse(_b.buffer.slice(_b.byteOffset, _b.byteOffset + _b.byteLength));
const scale = (1000 * 100) / ((font.unitsPerEm || 2048) * 72);

const result = { glyphs: {} };
const set = restrict ? new Set(restrict.split('')) : null;

font.glyphs.glyphs && Object.values(font.glyphs.glyphs).forEach((glyph) => {
  if (glyph.unicode === undefined) return;
  const ch = String.fromCharCode(glyph.unicode);
  if (set && !set.has(ch)) return;

  const token = { ha: Math.round(glyph.advanceWidth * scale), x_min: 0, x_max: 0, o: '' };
  if (glyph.xMin !== undefined) token.x_min = Math.round(glyph.xMin * scale);
  if (glyph.xMax !== undefined) token.x_max = Math.round(glyph.xMax * scale);

  const cmds = glyph.path.commands;
  cmds.forEach((c) => {
    let type = c.type.toLowerCase();
    if (type === 'c') type = 'b';        // cubic → b
    token.o += type + ' ';
    if (c.x  !== undefined && c.y  !== undefined) token.o += Math.round(c.x  * scale) + ' ' + Math.round(c.y  * scale) + ' ';
    if (c.x1 !== undefined && c.y1 !== undefined) token.o += Math.round(c.x1 * scale) + ' ' + Math.round(c.y1 * scale) + ' ';
    if (c.x2 !== undefined && c.y2 !== undefined) token.o += Math.round(c.x2 * scale) + ' ' + Math.round(c.y2 * scale) + ' ';
  });

  result.glyphs[ch] = token;
});

result.familyName = (font.names.fontFamily && font.names.fontFamily.en) || 'font';
result.ascender = Math.round(font.ascender * scale);
result.descender = Math.round(font.descender * scale);
const post = font.tables.post || {};
result.underlinePosition  = Math.round((post.underlinePosition  || -100) * scale);
result.underlineThickness = Math.round((post.underlineThickness || 50)   * scale);
const head = font.tables.head || {};
result.boundingBox = {
  yMin: Math.round((head.yMin || 0) * scale),
  xMin: Math.round((head.xMin || 0) * scale),
  yMax: Math.round((head.yMax || 0) * scale),
  xMax: Math.round((head.xMax || 0) * scale),
};
result.resolution = 1000;
result.original_font_information = font.tables.name || {};
result.cssFontWeight = 'normal';
result.cssFontStyle = 'normal';

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result));
console.log('Yazıldı:', outPath, '| glyph sayısı:', Object.keys(result.glyphs).length);
