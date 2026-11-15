export default async (p, h) => {
  await p.goto(h.url); await p.waitForFunction("document.getElementById('loading')==null", null, {timeout: 90000}).catch(()=>h.logs.push('boot timeout'));
  await p.waitForTimeout(1500); await h.shot('/workspace/slide/dev/b1.png');
};
