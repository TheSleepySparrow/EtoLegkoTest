// benchmark.js
const readline = require('readline');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const TIMEOUT_MS = 15000;
const REQUEST_COUNT = 10;

function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function makeRequest(urlString) {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime.bigint();
    let totalBytes = 0;
    
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(urlString, { timeout: TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      res.on('data', (chunk) => {
        totalBytes += chunk.length;
      });
      
      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1e6;
        resolve({ duration: durationMs, bytes: totalBytes });
      });
      
      res.on('error', reject);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.on('error', reject);
  });
}

async function runBenchmark(urlString) {
  console.log(`\nНачинаю тестирование: ${urlString}`);
  console.log(`Количество запросов: ${REQUEST_COUNT}`);
  console.log(`Таймаут: ${TIMEOUT_MS / 1000} сек\n`);
  
  const results = [];
  
  for (let i = 1; i <= REQUEST_COUNT; i++) {
    try {
      process.stdout.write(`Запрос ${i}/${REQUEST_COUNT}... `);
      const result = await makeRequest(urlString);
      results.push(result);
      console.log(`✓ ${result.duration.toFixed(2)} мс, ${(result.bytes / 1024).toFixed(2)} КБ`);
    } catch (err) {
      console.log(`✗ Ошибка: ${err.message}`);
    }
  }
  
  if (results.length === 0) {
    console.log('\n❌ Все запросы завершились с ошибкой');
    return;
  }
  
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);
  
  const avgTime = totalTime / results.length;
  const avgBytes = totalBytes / results.length;
  
  const totalBytesMB = totalBytes / (1024 * 1024);
  const totalTimeSec = totalTime / 1000;
  const speedMBps = totalBytesMB / totalTimeSec;
  
  console.log('\n' + '='.repeat(50));
  console.log('РЕЗУЛЬТАТЫ ТЕСТирования');
  console.log('='.repeat(50));
  console.log(`Успешных запросов: ${results.length}/${REQUEST_COUNT}`);
  console.log(`Среднее время запроса: ${avgTime.toFixed(2)} мс`);
  console.log(`Общий объем данных: ${(totalBytes / 1024).toFixed(2)} КБ`);
  console.log(`Средний объем данных: ${(avgBytes / 1024).toFixed(2)} КБ`);
  console.log(`Скорость скачивания: ${speedMBps.toFixed(3)} МБ/с`);
  console.log('='.repeat(50) + '\n');
}

async function main() {
  rl.question('Введите URL для тестирования: ', async (urlString) => {
    urlString = urlString.trim();
    
    if (!validateUrl(urlString)) {
      console.log('\n❌ Ошибка: некорректный URL');
      console.log('URL должен начинаться с http:// или https://\n');
      rl.close();
      return;
    }
    
    try {
      console.log('\nПроверяю доступность...');
      await makeRequest(urlString);
      console.log('✓ URL доступен\n');
      await runBenchmark(urlString);
    } catch (err) {
      console.log(`\n❌ Ошибка при проверке URL: ${err.message}`);
      console.log('Дальнейшие расчеты не производятся\n');
    }
    
    rl.close();
  });
}

main();
