const https = require('https');

function compileLatex(latexContent) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    params.set('text', latexContent);
    const postData = params.toString();

    const options = {
      hostname: 'latexonline.cc',
      path: '/compile',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const result = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        if (res.statusCode === 200 && ct.includes('application/pdf')) {
          resolve(result);
        } else {
          reject(new Error(`Kompilierung fehlgeschlagen (${res.statusCode}): ${result.toString('utf8').substring(0, 400)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(24000, () => {
      req.destroy();
      reject(new Error('Zeitüberschreitung bei der LaTeX-Kompilierung (24s). Versuche es erneut oder nutze Overleaf.'));
    });

    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ungültiger Request-Body.' })
    };
  }

  const { latex } = body;
  if (!latex) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Kein LaTeX-Code angegeben.' })
    };
  }

  try {
    const pdfBuffer = await compileLatex(latex);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, pdf: pdfBuffer.toString('base64') })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
