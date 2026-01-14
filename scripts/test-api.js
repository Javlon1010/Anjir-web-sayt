const fetch = require('node-fetch');
(async ()=>{
  try {
    let r = await fetch('http://localhost:3000/api/server-info');
    console.log('/api/server-info', r.status);
    console.log(await r.text());
    r = await fetch('http://localhost:3000/api/products/categories');
    console.log('/api/products/categories', r.status);
    console.log(await r.text());
  } catch (err) {
    console.error('err', err);
  }
})();