// Trim what a 2D launcher + WebGL game doesn't need (keeps the installer small). SwiftShader/Vulkan are software fallbacks only.
const fs = require('fs'), path = require('path');
exports.default = async function (ctx) {
  const dir = ctx.appOutDir; let saved = 0;
  for (const f of ['vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll', 'dxcompiler.dll', 'dxil.dll']) {
    const p = path.join(dir, f); if (fs.existsSync(p)) { saved += fs.statSync(p).size; fs.rmSync(p); }
  }
  console.log(`  • afterPack: removed ${(saved / 1048576).toFixed(1)} MB of unused runtime files`);
  // Embed the app icon into the .exe (pure-JS; no wine needed)
  try {
    const ResEdit = require('resedit'); const exe = path.join(dir, ctx.packager.appInfo.productFilename + '.exe');
    const data = fs.readFileSync(exe); const e = ResEdit.NtExecutable.from(data); const res = ResEdit.NtExecutableResource.from(e);
    const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map(i => i.data));
    const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
    if (vi) { const v = ctx.packager.appInfo.version.split('.').map(Number); vi.setFileVersion(v[0], v[1], v[2], 0, 1033); vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
      vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileDescription: 'Kingdoms of War Launcher', ProductName: 'Kingdoms of War Launcher', CompanyName: 'piwadev', LegalCopyright: 'piwadev', OriginalFilename: 'Kingdoms of War Launcher.exe', InternalName: 'Kingdoms of War Launcher' }); vi.outputToResourceEntries(res.entries); }
    res.outputResource(e); fs.writeFileSync(exe, Buffer.from(e.generate())); console.log('  • afterPack: icon embedded');
  } catch (err) { console.log('  • afterPack: icon embedding skipped:', err.message); }
};
