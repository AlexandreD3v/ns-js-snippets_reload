#!/usr/bin/env node
'use strict';

// Substitui o SuiteCloud CLI nos testes. Não abre socket e não fala com o NetSuite.
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');

function refuse(channel) {
    const error = new Error(`fake-suitecloud recusou acesso de rede (${channel})`);
    console.error(error.message);
    throw error;
}

http.request = () => refuse('http.request');
http.get = () => refuse('http.get');
https.request = () => refuse('https.request');
https.get = () => refuse('https.get');
net.connect = () => refuse('net.connect');
net.createConnection = () => refuse('net.createConnection');

const record = {
    script: __filename,
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    time: new Date().toISOString()
};

const logFile = process.env.NS_FAKE_SUITECLOUD_LOG;
if (logFile) {
    fs.appendFileSync(logFile, `${JSON.stringify(record)}\n`);
}

if (record.argv.includes('--version')) {
    process.stdout.write('fake-suitecloud 0.0.0-test\n');
    process.exit(0);
}

process.stdout.write('fake-suitecloud: comando local, sem contato com o NetSuite\n');
process.exit(0);
